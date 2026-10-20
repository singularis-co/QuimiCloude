import { describe, expect, it } from 'vitest'

import { createCreateWhatsappConnection } from '@/lib/modules/integraciones/domain/create-whatsapp-connection'
import { ValidationError, WhatsappConnectionExistsError } from '@/lib/modules/integraciones/domain/errors'
import { GRAPH_UNREACHABLE_MESSAGE, HIDDEN_SECRET_MARK } from '@/lib/modules/integraciones/domain/graph-failure'
import {
  WHATSAPP_DISPLAY_NAME_MAX_LENGTH,
  WHATSAPP_SECRET_MAX_LENGTH,
} from '@/lib/modules/integraciones/domain/whatsapp-connection-input'
import type { GraphProbeResult } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'

import {
  ACCESS_TOKEN,
  ACTOR_ID,
  APP_SECRET,
  COMPANY_ID,
  GOOD_PROBE,
  NEW_CONNECTION_ID,
  NOW,
  admin,
  makeCipher,
  makeDigest,
  makeGraph,
  makeRandom,
  makeRepository,
  makeTemplateRepository,
  storedConnection,
  validCreateInput,
} from './whatsapp-doubles'

function setup(probe: GraphProbeResult = GOOD_PROBE, initial: Parameters<typeof makeRepository>[0] = []) {
  const repo = makeRepository(initial)
  const cipher = makeCipher()
  const graph = makeGraph(probe)
  const digest = makeDigest()
  const random = makeRandom(['verify-token-nuevo'])
  const templates = makeTemplateRepository()
  const create = createCreateWhatsappConnection({
    connections: repo.connections,
    graph: graph.graph,
    templates: templates.templates,
    cipher: cipher.cipher,
    digest,
    random,
    now: () => NOW,
  })
  return { repo, cipher, graph, digest, random, templates, create }
}

describe('crear la conexion de WhatsApp', () => {
  it('R21: la prueba contra Graph se ejecuta antes de persistir, con el Phone Number ID y el token escritos', async () => {
    const { repo, graph, create } = setup()
    await create(validCreateInput(), admin())

    expect(graph.fetchPhoneNumber).toHaveBeenCalledWith({ phoneNumberId: '3456789012', accessToken: ACCESS_TOKEN })
    expect(graph.fetchPhoneNumber.mock.invocationCallOrder[0]).toBeLessThan(
      repo.create.mock.invocationCallOrder[0] ?? Number.NaN,
    )
  })

  it('R22, R8: prueba buena crea la conexion PENDING, MANUAL, con numero, nombre verificado, createdById y lastCheckedAt', async () => {
    const { repo, create } = setup()
    const result = await create(validCreateInput({ displayName: '  Ventas  ' }), admin())

    expect(result.status).toBe('created')
    const [row, scope] = repo.create.mock.calls[0] ?? []
    expect(scope).toEqual({ companyId: COMPANY_ID })
    expect(row).toMatchObject({
      id: NEW_CONNECTION_ID,
      origin: 'MANUAL',
      displayName: 'Ventas',
      wabaId: '2345678901',
      phoneNumberId: '3456789012',
      displayPhoneNumber: '+57 300 1234567',
      verifiedName: 'Empresa Verificada',
      status: 'PENDING',
      lastError: null,
      lastCheckedAt: NOW,
      createdById: ACTOR_ID,
    })
    if (result.status === 'created') {
      expect(result.connection).toMatchObject({ id: NEW_CONNECTION_ID, status: 'PENDING' })
    }
  })

  it('R9: cada secreto se cifra con {companyId, recordId = id de la conexion, field} y solo el valor cifrado llega a la base', async () => {
    const { repo, cipher, random, create } = setup()
    await create(validCreateInput(), admin())

    expect(cipher.encrypt.mock.calls).toEqual([
      [ACCESS_TOKEN, { companyId: COMPANY_ID, recordId: NEW_CONNECTION_ID, field: 'access_token' }],
      [APP_SECRET, { companyId: COMPANY_ID, recordId: NEW_CONNECTION_ID, field: 'app_secret' }],
    ])
    expect(random.newId.mock.invocationCallOrder[0]).toBeLessThan(cipher.encrypt.mock.invocationCallOrder[0] ?? Number.NaN)

    const [row] = repo.create.mock.calls[0] ?? []
    expect(row?.accessTokenEnc).toBe(await cipher.encrypt.mock.results[0]?.value)
    expect(row?.appSecretEnc).toBe(await cipher.encrypt.mock.results[1]?.value)
    const json = JSON.stringify(row)
    expect(json).not.toContain(ACCESS_TOKEN)
    expect(json).not.toContain(APP_SECRET)
  })

  it('R14: guarda solo el resumen del verify token y lo devuelve en claro en la respuesta del alta', async () => {
    const { repo, digest, create } = setup()
    const result = await create(validCreateInput(), admin())

    const [row] = repo.create.mock.calls[0] ?? []
    expect(row?.verifyTokenHash).toBe(digest.digestOf('verify-token-nuevo'))
    expect(JSON.stringify(row)).not.toContain('verify-token-nuevo')
    expect(result).toMatchObject({ status: 'created', verifyToken: 'verify-token-nuevo' })
    if (result.status === 'created') expect(JSON.stringify(result.connection)).not.toContain('verify-token-nuevo')
  })

  it('R23: prueba rechazada por Meta no crea ninguna fila y devuelve el mensaje de Meta saneado', async () => {
    const { repo, cipher, random, create } = setup({
      ok: false,
      kind: 'rejected',
      message: `Invalid OAuth access token ${ACCESS_TOKEN} for app ${APP_SECRET}`,
    })
    const result = await create(validCreateInput(), admin())

    expect(result).toEqual({
      status: 'test_failed',
      message: `Invalid OAuth access token ${HIDDEN_SECRET_MARK} for app ${HIDDEN_SECRET_MARK}`,
    })
    expect(repo.create).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
    expect(cipher.encrypt).not.toHaveBeenCalled()
    expect(random.newVerifyToken).not.toHaveBeenCalled()
  })

  it('R23: Meta inalcanzable devuelve el texto fijo y no crea nada', async () => {
    const { repo, create } = setup({ ok: false, kind: 'unreachable', message: null })
    expect(await create(validCreateInput(), admin())).toEqual({ status: 'test_failed', message: GRAPH_UNREACHABLE_MESSAGE })
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('R6: con una conexion viva en la empresa rechaza con whatsapp_connection_exists sin llamar a Graph', async () => {
    const seedCipher = makeCipher()
    const { repo, graph, create } = setup(GOOD_PROBE, [storedConnection(seedCipher.seed)])

    await expect(create(validCreateInput(), admin())).rejects.toBeInstanceOf(WhatsappConnectionExistsError)
    expect(graph.fetchPhoneNumber).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
  })

  const INVALIDOS: ReadonlyArray<[string, Record<string, unknown>]> = [
    ['displayName vacio tras recortar', { displayName: '   ' }],
    ['displayName de mas de 80 caracteres', { displayName: 'a'.repeat(WHATSAPP_DISPLAY_NAME_MAX_LENGTH + 1) }],
    ['wabaId vacio', { wabaId: '' }],
    ['phoneNumberId vacio',{ phoneNumberId: '\t' }],
    ['accessToken vacio', { accessToken: '  ' }],
    ['appSecret vacio', { appSecret: '' }],
    ['accessToken de mas de 1024 caracteres', { accessToken: 'x'.repeat(WHATSAPP_SECRET_MAX_LENGTH + 1) }],
    ['appSecret de mas de 1024 caracteres', { appSecret: 'x'.repeat(WHATSAPP_SECRET_MAX_LENGTH + 1) }],
    ['un campo que no es texto', { wabaId: 42 }],
    ['un campo ausente', { wabaId: undefined }],
  ]
  for (const [caso, cambio] of INVALIDOS) {
    it(`R24: ${caso} rechaza con invalid_input sin llamar a Graph ni escribir`, async () => {
      const { repo, graph, create } = setup()
      const promesa = create(validCreateInput(cambio), admin())
      await expect(promesa).rejects.toBeInstanceOf(ValidationError)
      await expect(promesa).rejects.toMatchObject({ code: 'invalid_input' })
      expect(graph.fetchPhoneNumber).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
    })
  }

  it('R24: displayName de 80 caracteres y secretos de 1024 se aceptan', async () => {
    const { create } = setup()
    const result = await create(
      validCreateInput({
        displayName: 'a'.repeat(WHATSAPP_DISPLAY_NAME_MAX_LENGTH),
        accessToken: 't'.repeat(WHATSAPP_SECRET_MAX_LENGTH),
        appSecret: 's'.repeat(WHATSAPP_SECRET_MAX_LENGTH),
      }),
      admin(),
    )
    expect(result.status).toBe('created')
  })

  it('R24: IDs de Meta con letras, simbolos o muy largos se aceptan recortados y llegan a la prueba', async () => {
    const { repo, graph, create } = setup()
    const largo = '9'.repeat(300)
    await create(validCreateInput({ wabaId: 'waba/2?x', phoneNumberId: ` ${largo}#x ` }), admin())

    expect(graph.fetchPhoneNumber).toHaveBeenCalledWith({ phoneNumberId: `${largo}#x`, accessToken: ACCESS_TOKEN })
    expect(repo.create.mock.calls[0]?.[0]).toMatchObject({ wabaId: 'waba/2?x', phoneNumberId: `${largo}#x` })
  })

  it('R24: un ID que Meta no reconoce termina como prueba fallida, no como invalid_input', async () => {
    const { repo, create } = setup({ ok: false, kind: 'rejected', message: 'Unsupported get request. Object with ID abc-1 does not exist' })
    const result = await create(validCreateInput({ phoneNumberId: 'abc-1' }), admin())
    expect(result).toEqual({ status: 'test_failed', message: 'Unsupported get request. Object with ID abc-1 does not exist' })
    expect(repo.create).not.toHaveBeenCalled()
  })
})

describe('crear la conexion de WhatsApp: importacion de plantillas', () => {
  const metaItem = {
    id: '7001',
    name: 'bienvenida',
    language: 'es',
    status: 'APPROVED',
    category: 'UTILITY',
    components: [{ type: 'BODY', text: 'Hola' }],
  }

  it('R29: tras guardar la conexion sincroniza sus plantillas con el token del formulario y la WABA escrita', async () => {
    const { repo, graph, templates, create } = setup()
    graph.listTemplatesPage.mockResolvedValueOnce({ ok: true, items: [metaItem], next: null })

    const result = await create(validCreateInput(), admin())

    expect(graph.listTemplatesPage).toHaveBeenCalledTimes(1)
    expect(graph.listTemplatesPage).toHaveBeenCalledWith({ wabaId: '2345678901', accessToken: ACCESS_TOKEN, after: null })
    expect(repo.create.mock.invocationCallOrder[0]).toBeLessThan(
      graph.listTemplatesPage.mock.invocationCallOrder[0] ?? Number.NaN,
    )
    expect(templates.applySync).toHaveBeenCalledWith(NEW_CONNECTION_ID, expect.anything(), NOW, NOW, { companyId: COMPANY_ID })
    expect(templates.all()).toMatchObject([
      { connectionId: NEW_CONNECTION_ID, companyId: COMPANY_ID, metaTemplateId: '7001', status: 'APPROVED', createdById: null },
    ])
    expect(result).toMatchObject({
      status: 'created',
      templateImport: { ok: true, summary: { imported: 1, updated: 0, deleted: 0, skipped: 0, syncedAt: NOW.toISOString() } },
    })
  })

  it('R29: no vuelve a descifrar el token guardado: usa el recien validado', async () => {
    const { cipher, create } = setup()
    await create(validCreateInput(), admin())
    expect(cipher.decrypt).not.toHaveBeenCalled()
  })

  it.each([
    ['Meta rechaza la lista', { ok: false, kind: 'rejected', message: `token ${ACCESS_TOKEN} invalido` }, 'whatsapp_meta_rejected'],
    ['Meta no responde', { ok: false, kind: 'unreachable', message: null }, 'whatsapp_meta_unreachable'],
  ] as const)(
    'R30: si %s la conexion queda creada con su verify token y el resultado lleva solo el codigo del fallo',
    async (_caso, page, code) => {
      const { repo, graph, templates, create } = setup()
      graph.listTemplatesPage.mockResolvedValueOnce(page)

      const result = await create(validCreateInput(), admin())

      expect(repo.create).toHaveBeenCalledTimes(1)
      expect(repo.row(NEW_CONNECTION_ID)).toBeDefined()
      expect(templates.applySync).not.toHaveBeenCalled()
      expect(result).toMatchObject({
        status: 'created',
        verifyToken: 'verify-token-nuevo',
        connection: { id: NEW_CONNECTION_ID },
        templateImport: { ok: false, code },
      })
      if (result.status === 'created') expect(Object.keys(result.templateImport).sort()).toEqual(['code', 'ok'])
      const json = JSON.stringify(result)
      expect(json).not.toContain(ACCESS_TOKEN)
      expect(json).not.toContain(APP_SECRET)
    },
  )

  it('R30: un fallo al escribir las plantillas tampoco deshace el alta y sale como su codigo o unexpected', async () => {
    const { templates, create } = setup()
    templates.applySync.mockRejectedValueOnce(new Error(`la base fallo con ${ACCESS_TOKEN}`))

    const result = await create(validCreateInput(), admin())

    expect(result).toMatchObject({ status: 'created', templateImport: { ok: false, code: 'unexpected' } })
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
  })

  it('R29: una prueba fallida no crea la conexion ni toca las plantillas', async () => {
    const { graph, templates, create } = setup({ ok: false, kind: 'unreachable', message: null })
    await create(validCreateInput(), admin())
    expect(graph.listTemplatesPage).not.toHaveBeenCalled()
    expect(templates.applySync).not.toHaveBeenCalled()
  })
})
