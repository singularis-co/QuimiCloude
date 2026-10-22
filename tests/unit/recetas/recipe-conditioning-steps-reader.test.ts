// Lector de pasos de acondicionamiento, sin base: la funcion pura, la consulta que arma y que las
// lecturas del operador y del empacador no piden pasos de acondicionamiento.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFirst = vi.fn()

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: { recipe: { findFirst } } }))

const {
  findRecipeConditioningStepsById,
  findRecipeExecutionContentById,
  findRecipePackingStepsById,
  toRecipeConditioningSteps,
  toRecipeExecutionContent,
} = await import('@/lib/modules/recetas/adapters/driven/persistence/recipe-catalog-prisma')

const EMPRESA = '00000000-0000-4000-8000-0000000000aa'

function paso(text: string) {
  return { blocks: [{ kind: 'paragraph', spans: [{ text }] }] }
}

const ROTULAR = { ...paso('Rotular cajas'), requiresAssignment: true, requiresEvidence: true }
const PALETIZAR = paso('Paletizar')
const MEZCLAR = paso('Mezclar en frio')
const ENVASAR = paso('Envasar en garrafas')

beforeEach(() => {
  findFirst.mockReset()
})

describe('toRecipeConditioningSteps', () => {
  it('R15: una original devuelve sus propios pasos con sus marcas, en orden', () => {
    expect(toRecipeConditioningSteps({ conditioningSteps: [ROTULAR, PALETIZAR], parent: null })).toEqual([
      ROTULAR,
      PALETIZAR,
    ])
  })

  it('R15: una version devuelve los de su original aunque la fila traiga propios', () => {
    expect(
      toRecipeConditioningSteps({ conditioningSteps: [MEZCLAR], parent: { conditioningSteps: [PALETIZAR, ROTULAR] } }),
    ).toEqual([PALETIZAR, ROTULAR])
  })

  it('R15: descarta el elemento invalido conservando el orden y tolera una columna que no es lista', () => {
    expect(
      toRecipeConditioningSteps({
        conditioningSteps: [ROTULAR, { id: 'invalido' }, 'Sellar', { ...PALETIZAR, requiresAssignment: 'si' }, PALETIZAR],
        parent: null,
      }),
    ).toEqual([ROTULAR, PALETIZAR])
    expect(toRecipeConditioningSteps({ conditioningSteps: { no: 'es lista' }, parent: null })).toEqual([])
  })
})

describe('findRecipeConditioningStepsById', () => {
  it('R15, R30: filtra por empresa e id, sin deletedAt, y pide solo conditioningSteps propios y de la original', async () => {
    findFirst.mockResolvedValue({ conditioningSteps: [ROTULAR], parent: null })

    await expect(findRecipeConditioningStepsById('r-1', EMPRESA)).resolves.toEqual([ROTULAR])

    const args = findFirst.mock.calls[0]?.[0]
    expect(args.where).toEqual({ AND: [{ companyId: EMPRESA }, { id: 'r-1' }] })
    expect(JSON.stringify(args.where)).not.toContain('deletedAt')
    expect(args.select).toEqual({ conditioningSteps: true, parent: { select: { conditioningSteps: true } } })
  })

  it('R15: devuelve null cuando la receta no existe o es de otra empresa', async () => {
    findFirst.mockResolvedValue(null)

    await expect(findRecipeConditioningStepsById('r-de-otra-empresa', EMPRESA)).resolves.toBeNull()
  })
})

describe('el operador y el empacador no reciben pasos de acondicionamiento', () => {
  it('R30: el select de findExecutionContentById no pide conditioningSteps', async () => {
    findFirst.mockResolvedValue({ id: 'r-1', name: 'X', deletedAt: null, steps: [], parent: null, lines: [], tools: [] })

    await findRecipeExecutionContentById('r-1', EMPRESA)

    const args = findFirst.mock.calls[0]?.[0]
    expect(JSON.stringify(args.select)).not.toContain('conditioningSteps')
    expect(JSON.stringify(args.select)).not.toContain('conditioning_steps')
  })

  it('R30: el select de findPackingStepsById no pide conditioningSteps', async () => {
    findFirst.mockResolvedValue({ packingSteps: [ENVASAR], parent: null })

    await expect(findRecipePackingStepsById('r-1', EMPRESA)).resolves.toEqual([ENVASAR])

    const args = findFirst.mock.calls[0]?.[0]
    expect(JSON.stringify(args.select)).not.toContain('conditioningSteps')
  })

  it('R30: toRecipeExecutionContent no devuelve pasos de acondicionamiento aunque la fila los traiga', () => {
    const fila = {
      id: 'r-version',
      name: 'Sin perfume',
      deletedAt: null,
      steps: [],
      conditioningSteps: [ROTULAR],
      parent: { name: 'Crema base', steps: [MEZCLAR], conditioningSteps: [PALETIZAR] },
      lines: [],
      tools: [],
    }

    const contenido = toRecipeExecutionContent(fila)

    expect(Object.keys(contenido).sort()).toEqual(['id', 'isDeleted', 'lines', 'name', 'steps', 'tools'])
    expect(contenido.steps).toEqual([MEZCLAR])
    expect(JSON.stringify(contenido)).not.toContain('Rotular')
    expect(JSON.stringify(contenido)).not.toContain('Paletizar')
  })
})
