// `ai` y `@ai-sdk/*` solo entran por los dos archivos del adaptador conversacional: el dominio, los
// puertos, el contrato y la lectura de PDF de `documentos` no los ven.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

const ADAPTADORES = [
  'lib/modules/integraciones/adapters/driven/ai/ai-sdk-models.ts',
  'lib/modules/integraciones/adapters/driven/ai/conversational-model-ai-sdk.ts',
]
const ARBOL_VIGILADO = ['lib', 'app', 'components', 'scripts']

function archivosDe(absDir: string): readonly string[] {
  if (!existsSync(absDir)) return []
  const salida: string[] = []
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre)
      if (statSync(ruta).isDirectory()) recorrer(ruta)
      else if (/\.(ts|tsx|mts|mjs|js|cjs)$/.test(ruta)) salida.push(ruta)
    }
  }
  recorrer(absDir)
  return salida
}

function fuenteSinComentarios(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/[^\n]*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
}

const ESPECIFICADOR = `['"](?:ai|@ai-sdk/[^'"]+)(?:/[^'"]*)?['"]`
const IMPORTA_AI_SDK = new RegExp(
  `from\\s+${ESPECIFICADOR}|import\\s+${ESPECIFICADOR}|require\\(\\s*${ESPECIFICADOR}\\s*\\)|import\\(\\s*${ESPECIFICADOR}\\s*\\)`,
)

function importaAiSdk(source: string): boolean {
  return IMPORTA_AI_SDK.test(fuenteSinComentarios(source))
}

function importadores(): string[] {
  return ARBOL_VIGILADO.flatMap((dir) => archivosDe(join(repoRoot, dir)))
    .filter((abs) => importaAiSdk(readFileSync(abs, 'utf8')))
    .map((abs) => relative(repoRoot, abs).split(sep).join('/'))
    .sort()
}

describe('aislamiento del AI SDK', () => {
  it('R47: el barrido mira el arbol de verdad', () => {
    const fuentes = ARBOL_VIGILADO.flatMap((dir) => archivosDe(join(repoRoot, dir)))
    expect(fuentes.length).toBeGreaterThan(100)
    for (const adaptador of ADAPTADORES) expect(existsSync(join(repoRoot, adaptador)), adaptador).toBe(true)
  })

  it('R47: solo los dos archivos del adaptador conversacional importan ai o @ai-sdk/*', () => {
    expect(importadores()).toEqual(ADAPTADORES)
  })

  it('R47: ni el dominio, ni los puertos, ni el contrato de integraciones los arrastran', () => {
    const fuera = importadores().filter(
      (ruta) =>
        ruta.startsWith('lib/modules/integraciones/domain/') ||
        ruta.startsWith('lib/modules/integraciones/ports/') ||
        ruta === 'lib/modules/integraciones/index.ts',
    )
    expect(fuera).toEqual([])
  })

  it('R49: la lectura de PDF de documentos no importa ai ni @ai-sdk/*', () => {
    expect(importadores().filter((ruta) => ruta.startsWith('lib/modules/documentos/'))).toEqual([])
    const lectores = archivosDe(join(repoRoot, 'lib', 'modules', 'documentos', 'adapters', 'driven', 'ai'))
    expect(lectores.length).toBeGreaterThan(0)
  })

  it('R47 (sensibilidad): el patron reconoce las formas de importar y no confunde nombres parecidos', () => {
    expect(importaAiSdk("import { generateText } from 'ai'")).toBe(true)
    expect(importaAiSdk('import { MockLanguageModelV4 } from "ai/test"')).toBe(true)
    expect(importaAiSdk("import { createOpenAI } from '@ai-sdk/openai'")).toBe(true)
    expect(importaAiSdk("import type { LanguageModelV4 } from '@ai-sdk/provider'")).toBe(true)
    expect(importaAiSdk("import 'ai'")).toBe(true)
    expect(importaAiSdk("const m = await import('@ai-sdk/google')")).toBe(true)
    expect(importaAiSdk("const ai = require('ai')")).toBe(true)
    expect(importaAiSdk("import x from 'ai-otro'")).toBe(false)
    expect(importaAiSdk("import x from '@/lib/ai'")).toBe(false)
    expect(importaAiSdk("import x from './ai'")).toBe(false)
    expect(importaAiSdk("import x from 'openai'")).toBe(false)
    expect(importaAiSdk("// import { generateText } from 'ai'")).toBe(false)
  })
})
