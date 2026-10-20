import { describe, expect, it, vi } from 'vitest'

import { createSyncAllWhatsappTemplates } from '@/lib/modules/integraciones/domain/sync-all-whatsapp-templates'
import type { WhatsappConnectionRecord, WhatsappConnectionStatus } from '@/lib/modules/integraciones/domain/whatsapp-connection'

import {
  ACCESS_TOKEN,
  NOW,
  makeCipher,
  makeGraph,
  makeRepository,
  makeTemplateRepository,
  storedConnection,
} from '../whatsapp-doubles'

const COMPANY_A = '00000000-0000-4000-8000-0000000001a1'
const COMPANY_B = '00000000-0000-4000-8000-0000000001b2'
const COMPANY_C = '00000000-0000-4000-8000-0000000001c3'
const CONNECTION_OF: Record<string, string> = {
  [COMPANY_A]: '00000000-0000-4000-8000-0000000002a1',
  [COMPANY_B]: '00000000-0000-4000-8000-0000000002b2',
  [COMPANY_C]: '00000000-0000-4000-8000-0000000002c3',
}
const WABA_OF: Record<string, string> = { [COMPANY_A]: '1111', [COMPANY_B]: '2222', [COMPANY_C]: '3333' }

type CompanySpec = { companyId: string; status?: WhatsappConnectionStatus | null; addonOn?: boolean }

function setup(companies: CompanySpec[], options: { budgetMs?: number; listCompanyIds?: () => Promise<readonly string[]> } = {}) {
  const cipher = makeCipher()
  const connections: WhatsappConnectionRecord[] = companies
    .filter((spec) => spec.status !== null)
    .map((spec) =>
      storedConnection(cipher.seed, {
        id: CONNECTION_OF[spec.companyId],
        companyId: spec.companyId,
        wabaId: WABA_OF[spec.companyId],
        status: spec.status ?? 'ACTIVE',
      }),
    )
  const repo = makeRepository(connections)
  const graph = makeGraph()
  const templates = makeTemplateRepository()
  const addonOn = new Map(companies.map((spec) => [spec.companyId, spec.addonOn ?? true]))
  const isOn = vi.fn(async (companyId: string) => addonOn.get(companyId) ?? false)
  const listCompanyIds = vi.fn(options.listCompanyIds ?? (async () => companies.map((spec) => spec.companyId)))
  const run = createSyncAllWhatsappTemplates({
    listCompanyIds,
    integrations: { isOn },
    connections: repo.connections,
    cipher: cipher.cipher,
    graph: graph.graph,
    templates: templates.templates,
    now: () => NOW,
    budgetMs: options.budgetMs,
  })
  return { cipher, repo, graph, templates, isOn, listCompanyIds, run }
}

function syncedWabas(graph: ReturnType<typeof makeGraph>): string[] {
  return graph.listTemplatesPage.mock.calls.map(([input]) => input.wabaId)
}

describe('cron de plantillas: que conexiones sincroniza', () => {
  it('R32: sincroniza la conexion ACTIVE de cada empresa con su token y su WABA', async () => {
    const { graph, templates, run } = setup([{ companyId: COMPANY_A }, { companyId: COMPANY_B }])

    expect(await run()).toEqual({ synced: 2, failed: [] })
    expect(graph.listTemplatesPage.mock.calls.map(([input]) => input)).toEqual([
      { wabaId: WABA_OF[COMPANY_A], accessToken: ACCESS_TOKEN, after: null },
      { wabaId: WABA_OF[COMPANY_B], accessToken: ACCESS_TOKEN, after: null },
    ])
    expect(templates.applySync.mock.calls.map(([connectionId, , , , scope]) => [connectionId, scope])).toEqual([
      [CONNECTION_OF[COMPANY_A], { companyId: COMPANY_A }],
      [CONNECTION_OF[COMPANY_B], { companyId: COMPANY_B }],
    ])
  })

  it.each(['PENDING', 'ERROR', 'DISABLED'] as const)(
    'R32: no sincroniza una conexion %s ni descifra su token',
    async (status) => {
      const { graph, cipher, templates, run } = setup([{ companyId: COMPANY_A, status }])

      expect(await run()).toEqual({ synced: 0, failed: [] })
      expect(graph.listTemplatesPage).not.toHaveBeenCalled()
      expect(cipher.decrypt).not.toHaveBeenCalled()
      expect(templates.listForSync).not.toHaveBeenCalled()
    },
  )

  it('R32: una empresa con el anadido apagado no se lee ni se sincroniza', async () => {
    const { graph, repo, run } = setup([{ companyId: COMPANY_A, addonOn: false }, { companyId: COMPANY_B }])

    expect(await run()).toEqual({ synced: 1, failed: [] })
    expect(repo.findLive).toHaveBeenCalledTimes(1)
    expect(repo.findLive).toHaveBeenCalledWith({ companyId: COMPANY_B })
    expect(syncedWabas(graph)).toEqual([WABA_OF[COMPANY_B]])
  })

  it('R32: una empresa sin conexion viva se salta sin fallo', async () => {
    const { graph, run } = setup([{ companyId: COMPANY_A, status: null }, { companyId: COMPANY_B }])

    expect(await run()).toEqual({ synced: 1, failed: [] })
    expect(syncedWabas(graph)).toEqual([WABA_OF[COMPANY_B]])
  })

  it('R32: recorre las empresas de una en una: cada lectura lleva el ambito de una sola', async () => {
    const { repo, templates, isOn, run } = setup([{ companyId: COMPANY_A }, { companyId: COMPANY_B }, { companyId: COMPANY_C }])
    await run()

    expect(isOn.mock.calls.map(([companyId]) => companyId)).toEqual([COMPANY_A, COMPANY_B, COMPANY_C])
    expect(repo.findLive.mock.calls.map(([scope]) => scope)).toEqual([
      { companyId: COMPANY_A },
      { companyId: COMPANY_B },
      { companyId: COMPANY_C },
    ])
    for (const [connectionId, scope] of templates.listForSync.mock.calls) {
      expect(CONNECTION_OF[scope.companyId]).toBe(connectionId)
    }
    expect(repo.findLiveById).not.toHaveBeenCalled()
  })
})

describe('cron de plantillas: fallos', () => {
  it('R33: si falla la segunda conexion sigue con la tercera y el fallo lleva la empresa y el codigo', async () => {
    const { graph, run } = setup([{ companyId: COMPANY_A }, { companyId: COMPANY_B }, { companyId: COMPANY_C }])
    graph.listTemplatesPage.mockImplementation(async ({ wabaId }) =>
      wabaId === WABA_OF[COMPANY_B]
        ? { ok: false, kind: 'unreachable', message: null }
        : { ok: true, items: [], next: null },
    )

    expect(await run()).toEqual({
      synced: 2,
      failed: [{ stage: 'connection', companyId: COMPANY_B, code: 'whatsapp_meta_unreachable' }],
    })
    expect(syncedWabas(graph)).toEqual([WABA_OF[COMPANY_A], WABA_OF[COMPANY_B], WABA_OF[COMPANY_C]])
  })

  it('R33: el fallo no lleva el mensaje de Meta ni el token', async () => {
    const { graph, run } = setup([{ companyId: COMPANY_A }])
    graph.listTemplatesPage.mockResolvedValueOnce({ ok: false, kind: 'rejected', message: `token ${ACCESS_TOKEN} caducado` })

    const result = await run()

    expect(result).toEqual({ synced: 0, failed: [{ stage: 'connection', companyId: COMPANY_A, code: 'whatsapp_meta_rejected' }] })
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
  })

  it('R33: un token ilegible deja la conexion en ERROR, cuenta como fallo y sigue', async () => {
    const { repo, run } = setup([{ companyId: COMPANY_A }, { companyId: COMPANY_B }])
    await repo.connections.update(CONNECTION_OF[COMPANY_A], { accessTokenEnc: 'v1:ilegible' }, { companyId: COMPANY_A })
    repo.update.mockClear()

    expect(await run()).toEqual({
      synced: 1,
      failed: [{ stage: 'connection', companyId: COMPANY_A, code: 'integration_secret_unreadable' }],
    })
    expect(repo.row(CONNECTION_OF[COMPANY_A])).toMatchObject({ status: 'ERROR' })
  })

  it('R33: un fallo al escribir o al leer el anadido de una empresa tambien se anota y sigue', async () => {
    const { templates, isOn, run } = setup([{ companyId: COMPANY_A }, { companyId: COMPANY_B }, { companyId: COMPANY_C }])
    templates.applySync.mockRejectedValueOnce(new Error('la base fallo'))
    isOn.mockImplementation(async (companyId) => {
      if (companyId === COMPANY_B) throw new Error('directorio caido')
      return true
    })

    expect(await run()).toEqual({
      synced: 1,
      failed: [
        { stage: 'connection', companyId: COMPANY_A, code: 'unexpected' },
        { stage: 'connection', companyId: COMPANY_B, code: 'unexpected' },
      ],
    })
  })

  it('R33: un fallo al listar las empresas termina con stage companies sin leer ninguna conexion', async () => {
    const { repo, isOn, graph, run } = setup([{ companyId: COMPANY_A }], {
      listCompanyIds: async () => {
        throw new Error('la base fallo')
      },
    })

    expect(await run()).toEqual({ synced: 0, failed: [{ stage: 'companies', code: 'unexpected' }] })
    expect(isOn).not.toHaveBeenCalled()
    expect(repo.findLive).not.toHaveBeenCalled()
    expect(graph.listTemplatesPage).not.toHaveBeenCalled()
  })

  it('R33: con el presupuesto agotado no empieza ninguna empresa mas', async () => {
    const { repo, graph, run } = setup([{ companyId: COMPANY_A }, { companyId: COMPANY_B }], { budgetMs: 0 })

    expect(await run()).toEqual({ synced: 0, failed: [] })
    expect(repo.findLive).not.toHaveBeenCalled()
    expect(graph.listTemplatesPage).not.toHaveBeenCalled()
  })

  it('R27 R32: el cron nunca crea ni borra plantillas en Meta', async () => {
    const { graph, run } = setup([{ companyId: COMPANY_A }, { companyId: COMPANY_B }])
    await run()
    expect(graph.createTemplate).not.toHaveBeenCalled()
    expect(graph.deleteTemplate).not.toHaveBeenCalled()
  })
})
