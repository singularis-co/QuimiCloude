import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { WhatsappTemplateIssue } from '@/lib/modules/integraciones/domain/whatsapp-template-draft'
import {
  isConstantKey,
  isOwnKey,
  validateWhatsappVariableKeyInput,
  WHATSAPP_CONSTANT_KEY_PATTERN,
  WHATSAPP_VARIABLE_KEY_LIMITS,
  WHATSAPP_VARIABLE_KEY_PATTERN,
} from '@/lib/modules/integraciones/domain/whatsapp-variable-key'

const domainDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'lib', 'modules', 'integraciones', 'domain')

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { key: 'cuenta_numero', label: 'Número de cuenta', value: '0012-3456', ...overrides }
}

function issues(value: unknown): WhatsappTemplateIssue[] {
  const result = validateWhatsappVariableKeyInput(value)
  return result.ok ? [] : [...result.issues]
}

function codesAt(value: unknown, field: string): string[] {
  return issues(value)
    .filter((issue) => issue.field === field)
    .map((issue) => issue.code)
}

describe('validateWhatsappVariableKeyInput', () => {
  it('R54: una variable valida devuelve exactamente sus tres campos', () => {
    expect(validateWhatsappVariableKeyInput({ ...input(), extra: 'x' })).toEqual({
      ok: true,
      value: { key: 'cuenta_numero', label: 'Número de cuenta', value: '0012-3456' },
    })
  })

  it('R54: la clave admite 40 caracteres y rechaza 41', () => {
    expect(WHATSAPP_VARIABLE_KEY_LIMITS.keyMaxLength).toBe(40)
    expect(codesAt(input({ key: `a${'b'.repeat(39)}` }), 'key')).toEqual([])
    expect(codesAt(input({ key: `a${'b'.repeat(40)}` }), 'key')).toEqual(['too_long'])
  })

  it.each([
    ['empieza por digito', '1cuenta'],
    ['mayuscula', 'Cuenta'],
    ['guion', 'cuenta-numero'],
    ['punto', 'cuenta.numero'],
    ['empieza por guion bajo', '_cuenta'],
    ['espacio', 'cuenta numero'],
  ])('R54: clave invalida (%s)', (_caso, key) => {
    expect(codesAt(input({ key }), 'key')).toEqual(['invalid_chars'])
  })

  it('R54: clave vacia o solo espacios es obligatoria', () => {
    expect(codesAt(input({ key: '' }), 'key')).toEqual(['required'])
    expect(codesAt(input({ key: '   ' }), 'key')).toEqual(['required'])
  })

  it('R54: la etiqueta admite 60 caracteres (puntos de codigo) y rechaza 61', () => {
    expect(WHATSAPP_VARIABLE_KEY_LIMITS.labelMaxLength).toBe(60)
    expect(codesAt(input({ label: 'ñ'.repeat(60) }), 'label')).toEqual([])
    expect(codesAt(input({ label: '😀'.repeat(60) }), 'label')).toEqual([])
    expect(codesAt(input({ label: 'ñ'.repeat(61) }), 'label')).toEqual(['too_long'])
  })

  it('R54: etiqueta vacia o solo espacios es obligatoria; con U+0000 no se admite', () => {
    expect(codesAt(input({ label: '' }), 'label')).toEqual(['required'])
    expect(codesAt(input({ label: '   ' }), 'label')).toEqual(['required'])
    expect(codesAt(input({ label: 'Nombre\u0000' }), 'label')).toEqual(['invalid_chars'])
  })

  it('R54: valor ausente, vacio o solo espacios es obligatorio', () => {
    expect(codesAt({ key: 'cuenta_numero', label: 'Número de cuenta' }, 'value')).toEqual(['required'])
    expect(codesAt(input({ value: '' }), 'value')).toEqual(['required'])
    expect(codesAt(input({ value: '  ' }), 'value')).toEqual(['required'])
  })

  it('R54: el valor admite 50 caracteres y rechaza 51', () => {
    expect(WHATSAPP_VARIABLE_KEY_LIMITS.valueMaxLength).toBe(50)
    expect(codesAt(input({ value: 'x'.repeat(50) }), 'value')).toEqual([])
    expect(codesAt(input({ value: 'x'.repeat(51) }), 'value')).toEqual(['too_long'])
  })

  it('R54: el valor no admite {{ ni }}', () => {
    expect(codesAt(input({ value: 'cuenta {{1}}' }), 'value')).toEqual(['not_allowed'])
    expect(codesAt(input({ value: 'abre {{' }), 'value')).toEqual(['not_allowed'])
    expect(codesAt(input({ value: 'cierra }}' }), 'value')).toEqual(['not_allowed'])
    expect(codesAt(input({ value: 'un { solo }' }), 'value')).toEqual([])
  })

  it('R54: devuelve los problemas de los tres campos a la vez', () => {
    expect(issues({ key: 'X', label: '', value: '' }).map((i) => i.field)).toEqual(['key', 'label', 'value'])
  })

  it('R54: una entrada que no es un objeto falla sin lanzar', () => {
    expect(validateWhatsappVariableKeyInput(null).ok).toBe(false)
    expect(validateWhatsappVariableKeyInput({ key: 1, label: 'x', value: 'y' }).ok).toBe(false)
  })
})

describe('forma de las claves', () => {
  const segment40 = `a${'b'.repeat(39)}`
  const segment41 = `a${'b'.repeat(40)}`

  it('R88: una constante son dos segmentos de forma propia unidos por un punto', () => {
    expect(isConstantKey('cliente.nombre')).toBe(true)
    expect(isConstantKey('pedido.numero_2')).toBe(true)
    expect(isConstantKey(`${segment40}.${segment40}`)).toBe(true)
    expect(WHATSAPP_CONSTANT_KEY_PATTERN.test('cliente.nombre')).toBe(true)
  })

  it.each([
    ['tres segmentos', 'cliente.direccion.ciudad'],
    ['un segmento', 'cliente'],
    ['segmento vacio', 'cliente.'],
    ['segmento que empieza por digito', 'cliente.1nombre'],
    ['mayuscula', 'Cliente.nombre'],
  ])('R88: no es una constante (%s)', (_caso, key) => {
    expect(isConstantKey(key)).toBe(false)
  })

  it('R88: cada segmento de una constante admite 40 caracteres y rechaza 41', () => {
    expect(isConstantKey(`cliente.${segment40}`)).toBe(true)
    expect(isConstantKey(`cliente.${segment41}`)).toBe(false)
    expect(isConstantKey(`${segment41}.nombre`)).toBe(false)
  })

  it('R88: una propia no lleva punto y nunca casa con la forma de constante, ni al reves', () => {
    expect(isOwnKey('cuenta_numero')).toBe(true)
    expect(isOwnKey(segment40)).toBe(true)
    expect(isOwnKey(segment41)).toBe(false)
    expect(isOwnKey('cuenta.numero')).toBe(false)
    expect(isConstantKey('cuenta_numero')).toBe(false)
    expect(WHATSAPP_VARIABLE_KEY_PATTERN.test('cuenta.numero')).toBe(false)
  })

  it('R89: crear o modificar una propia con punto da un problema en la clave', () => {
    expect(codesAt(input({ key: 'cliente.nombre' }), 'key')).toEqual(['invalid_chars'])
  })

  it('R87: el dominio no tiene catalogo de constantes', () => {
    expect(existsSync(join(domainDir, 'whatsapp-system-variables.ts'))).toBe(false)
  })

  it('R54: el archivo solo importa zod y domain/', () => {
    const source = readFileSync(join(domainDir, 'whatsapp-variable-key.ts'), 'utf8')
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] as string)
    for (const specifier of specifiers) {
      expect(specifier === 'zod' || specifier.startsWith('./'), specifier).toBe(true)
    }
  })
})
