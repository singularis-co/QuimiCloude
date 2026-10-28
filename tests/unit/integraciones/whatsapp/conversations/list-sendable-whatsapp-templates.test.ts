import { describe, expect, it } from 'vitest'

import { WHATSAPP_READ_PERMISSION, type Actor } from '@/lib/modules/integraciones/domain/actor'
import { UnauthorizedError } from '@/lib/modules/integraciones/domain/errors'
import { createListSendableWhatsappTemplates } from '@/lib/modules/integraciones/domain/list-sendable-whatsapp-templates'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'
import { toMetaComponents } from '@/lib/modules/integraciones/domain/whatsapp-template-components'

import {
  CONNECTION_ID,
  NEW_CONNECTION_ID,
  OTHER_COMPANY_ID,
  TEMPLATE_ID,
  admin,
  makeRepository,
  makeTemplateRepository,
  makeVariableKeyRepository,
  storedConnection,
  storedTemplate,
  storedVariableKey,
} from '../whatsapp-doubles'

const CUENTA = storedVariableKey()
const idOf = (n: number) => `00000000-0000-4000-8000-${String(200000000000 + n)}`

const content = {
  header: { text: 'Cuenta {{1}}', example: 'Numero' },
  body: { text: 'Hola {{1}}, tu pedido {{2}}', examples: ['Ana', '77'] },
  footer: 'Gracias',
  buttons: [{ type: 'QUICK_REPLY' as const, text: 'Ok' }],
}

const mapped = storedTemplate({
  components: toMetaComponents(content),
  variables: [
    { slot: 'header', kind: 'company', variableKeyId: CUENTA.id },
    { slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' },
    { slot: 'body.2', kind: 'system', systemKey: 'pedido.numero' },
  ],
})

function reader(overrides: Partial<Actor> = {}): Actor {
  return admin({ permissions: [WHATSAPP_READ_PERMISSION], ...overrides })
}

function setup(options: { templates?: WhatsappTemplateRecord[]; connected?: boolean } = {}) {
  const connection = storedConnection(() => 'cifrado', { status: 'ACTIVE' })
  const repo = makeRepository(options.connected === false ? [] : [connection])
  const templates = makeTemplateRepository(options.templates ?? [mapped])
  const keys = makeVariableKeyRepository([CUENTA, storedVariableKey({ id: idOf(9), companyId: OTHER_COMPANY_ID })])
  const listSendable = createListSendableWhatsappTemplates({
    connections: repo.connections,
    templates: templates.templates,
    variableKeys: keys.variableKeys,
  })
  return { listSendable, repo, templates, keys }
}

describe('listSendableWhatsappTemplates', () => {
  it.each<[string, Actor | null]>([
    ['sin whatsapp.consultar', reader({ permissions: ['whatsapp.enviar', 'integraciones.modificar'] })],
    ['sin empresa', reader({ companyId: '' })],
    ['sin actor', null],
  ])('R4: %s responde unauthorized sin tocar un puerto', async (_, actor) => {
    const { listSendable, repo, templates, keys } = setup()
    await expect(listSendable(actor)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(repo.findLive).not.toHaveBeenCalled()
    expect(templates.listLive).not.toHaveBeenCalled()
    expect(keys.listAll).not.toHaveBeenCalled()
  })

  it('R32: sin conexión viva devuelve una lista vacía sin leer plantillas', async () => {
    const { listSendable, templates } = setup({ connected: false })
    await expect(listSendable(reader())).resolves.toEqual({ templates: [] })
    expect(templates.listLive).not.toHaveBeenCalled()
  })

  it('R32: solo las enviables de la conexión: fuera las no aprobadas, apagadas, sin mapear y de otra conexión', async () => {
    const { listSendable, templates } = setup({
      templates: [
        mapped,
        storedTemplate({ id: idOf(1), name: 'pendiente', status: 'PENDING' }),
        storedTemplate({ id: idOf(2), name: 'apagada', enabled: false }),
        storedTemplate({ id: idOf(3), name: 'sin_mapear', mappingStatus: 'UNMAPPED' }),
        storedTemplate({ id: idOf(4), name: 'otra_conexion', connectionId: NEW_CONNECTION_ID }),
        storedTemplate({ id: idOf(5), name: 'de_otra_empresa', companyId: OTHER_COMPANY_ID }),
      ],
    })
    const result = await listSendable(reader())
    expect(result.templates.map((template) => template.id)).toEqual([TEMPLATE_ID])
    expect(templates.listLive).toHaveBeenCalledWith(CONNECTION_ID, { onlyApproved: true }, expect.anything())
  })

  it('R33: cada plantilla trae id, nombre, idioma, categoría, contenido y variables; las propias con etiqueta y valor', async () => {
    const { listSendable } = setup()
    const { templates } = await listSendable(reader())
    expect(templates).toEqual([
      {
        id: TEMPLATE_ID,
        name: 'bienvenida',
        language: 'es',
        category: 'UTILITY',
        content: {
          header: { text: 'Cuenta {{cuenta_numero}}', example: 'Numero' },
          body: { text: 'Hola {{cliente.nombre}}, tu pedido {{pedido.numero}}', examples: ['Ana', '77'] },
          footer: 'Gracias',
          buttons: [{ type: 'QUICK_REPLY', text: 'Ok' }],
        },
        variables: [
          { slot: 'header', position: 1, kind: 'company', key: 'cuenta_numero', label: CUENTA.label, value: CUENTA.value },
          { slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: null, value: null },
          { slot: 'body.2', position: 2, kind: 'system', key: 'pedido.numero', label: null, value: null },
        ],
      },
    ])
    expect(Object.keys(templates[0]).sort()).toEqual(['category', 'content', 'id', 'language', 'name', 'variables'])
  })
})
