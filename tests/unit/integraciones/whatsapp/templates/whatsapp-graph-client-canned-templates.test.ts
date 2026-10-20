// El doble de Graph para las plantillas: guarda en memoria lo creado, sin red.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CANNED_TAKEN_NAME_SUBCODE,
  resetCannedTemplates,
  whatsappGraphClientCanned,
} from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned'
import { TEMPLATE_NAME_TAKEN_SUBCODE } from '@/lib/modules/integraciones/domain/template-graph-failure'
import { interpretMetaTemplate } from '@/lib/modules/integraciones/domain/whatsapp-template-meta'

const WABA = '2345678901'
const OTHER_WABA = '9876543210'
const COMPONENTS = [{ type: 'BODY', text: 'Hola' }]

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetCannedTemplates()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function create(name: string, wabaId = WABA, language = 'es') {
  return whatsappGraphClientCanned.createTemplate({
    wabaId,
    accessToken: 'EAAG-cualquiera',
    name,
    language,
    category: 'UTILITY',
    components: COMPONENTS,
  })
}

async function listed(wabaId = WABA): Promise<readonly unknown[]> {
  const page = await whatsappGraphClientCanned.listTemplatesPage({ wabaId, accessToken: 'x', after: null })
  if (!page.ok) throw new Error('el doble no deberia fallar al listar')
  expect(page.next).toBeNull()
  return page.items
}

describe('R27: el doble canned de plantillas', () => {
  it('crear devuelve un id numerico creciente y la plantilla PENDING con su categoria', async () => {
    const first = await create('bienvenida')
    const second = await create('recordatorio')

    expect(first).toMatchObject({ ok: true, status: 'PENDING', category: 'UTILITY' })
    if (!first.ok || !second.ok) throw new Error('el alta deberia ser buena')
    expect(first.id).toMatch(/^[1-9]\d*$/)
    expect(Number(second.id)).toBeGreaterThan(Number(first.id))
  })

  it('listar devuelve lo creado en esa WABA, en una sola pagina y con la forma que interpreta el dominio', async () => {
    const created = await create('bienvenida')
    await create('otra_waba', OTHER_WABA)
    if (!created.ok) throw new Error('el alta deberia ser buena')

    const items = await listed()
    expect(items).toHaveLength(1)
    expect(interpretMetaTemplate(items[0])).toEqual({
      ok: true,
      template: {
        metaTemplateId: created.id,
        name: 'bienvenida',
        language: 'es',
        category: 'UTILITY',
        status: 'PENDING',
        statusRaw: null,
        rejectedReason: null,
        components: COMPONENTS,
      },
    })
  })

  it('borrar quita solo la de ese id y nombre; la del otro idioma sigue', async () => {
    const es = await create('bienvenida', WABA, 'es')
    const en = await create('bienvenida', WABA, 'en')
    if (!es.ok || !en.ok) throw new Error('el alta deberia ser buena')

    await expect(
      whatsappGraphClientCanned.deleteTemplate({ wabaId: WABA, accessToken: 'x', hsmId: es.id, name: 'bienvenida' }),
    ).resolves.toEqual({ ok: true })

    expect((await listed()).map((item) => (item as { id: string }).id)).toEqual([en.id])
  })

  it('un nombre que empieza por e2e_repetida da el fallo de nombre repetido de Meta y no se guarda', async () => {
    const result = await create('e2e_repetida_promo')

    expect(result).toEqual({
      ok: false,
      kind: 'rejected',
      message: expect.any(String),
      code: 100,
      subcode: TEMPLATE_NAME_TAKEN_SUBCODE,
    })
    expect(CANNED_TAKEN_NAME_SUBCODE).toBe(2388024)
    expect(await listed()).toEqual([])
  })

  it('resetCannedTemplates vacia lo guardado y reinicia los ids', async () => {
    const before = await create('bienvenida')
    resetCannedTemplates()
    expect(await listed()).toEqual([])
    const after = await create('bienvenida')
    expect(after).toEqual(before)
  })

  it('no sale a la red ni lee WHATSAPP_GRAPH_API_VERSION', async () => {
    const saved = process.env.WHATSAPP_GRAPH_API_VERSION
    delete process.env.WHATSAPP_GRAPH_API_VERSION
    try {
      await create('bienvenida')
      await listed()
      await whatsappGraphClientCanned.deleteTemplate({ wabaId: WABA, accessToken: 'x', hsmId: '1', name: 'a' })
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      if (saved !== undefined) process.env.WHATSAPP_GRAPH_API_VERSION = saved
    }
  })
})
