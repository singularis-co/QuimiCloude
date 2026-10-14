// Los cinco codigos de la evidencia por paso y las clases que los lanzan: codigo estable, mensaje
// del catalogo y frase propia.
import { describe, expect, it } from 'vitest'

import {
  AsignacionesError,
  EvidenceInvalidFileError,
  EvidenceLimitError,
  EvidenceNotFoundError,
  EvidenceRequiredError,
} from '@/lib/modules/asignaciones'
import { ERROR_CODES, ERROR_MESSAGE_KEY, errorMessage } from '@/lib/modules/errores'
import { RecetasError, RecipeStepsLockedError } from '@/lib/modules/recetas'

const casos = [
  ['R34, R35, R36', EvidenceRequiredError, 'evidence_required', AsignacionesError],
  ['R29', EvidenceLimitError, 'evidence_limit', AsignacionesError],
  ['R32', EvidenceInvalidFileError, 'evidence_invalid_file', AsignacionesError],
  ['R19', EvidenceNotFoundError, 'evidence_not_found', AsignacionesError],
  ['R9, R10', RecipeStepsLockedError, 'recipe_steps_locked', RecetasError],
] as const

describe('codigos de la evidencia por paso', () => {
  for (const [requisitos, Clase, code, Base] of casos) {
    it(`${requisitos}: ${code} esta en el catalogo con su clave y un texto`, () => {
      const codigos: readonly string[] = ERROR_CODES
      expect(codigos).toContain(code)
      expect(ERROR_MESSAGE_KEY[code]).toBe(`errors.${code}`)
      expect(errorMessage(code).trim().length).toBeGreaterThan(0)
    })

    it(`${requisitos}: ${Clase.name} lanza ${code} con el mensaje del catalogo y el diagnostico aparte`, () => {
      const error = new Clase('dato de diagnostico')
      expect(error).toBeInstanceOf(Base)
      expect(error).toBeInstanceOf(Clase)
      expect(error.code).toBe(code)
      expect(error.message).toBe(errorMessage(code))
      expect(error.diagnostic).toBe('dato de diagnostico')
      expect(error.name).toBe(Clase.name)
    })
  }

  it('R29, R32, R34: las frases no se confunden con las genericas', () => {
    for (const [, , code] of casos) {
      expect(errorMessage(code)).not.toBe(errorMessage('invalid_input'))
      expect(errorMessage(code)).not.toBe(errorMessage('order_not_found'))
    }
  })
})
