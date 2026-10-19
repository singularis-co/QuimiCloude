// Catálogo de añadidos: partición del catálogo de permisos, dependencia de un nivel, recorte que
// solo resta y portadores que fallan cerrado.
import { describe, expect, it } from 'vitest'

import {
  ADDONS,
  ADDON_PERMISSIONS,
  ADDON_REQUIRES,
  CORE_PERMISSIONS,
  PERMISSIONS,
  assertAddon,
  effectiveAddons,
  effectivePermissions,
  hasAddon,
  isAddon,
  type AddonBearer,
} from '@/lib/modules/identity'

class ErrorDePrueba extends Error {}
const onDenied = () => new ErrorDePrueba('denegado')

const catalogo = PERMISSIONS.map((p) => p.code as string)
const deAnadidos = ADDONS.flatMap((addon) => ADDON_PERMISSIONS[addon] as readonly string[])

describe('catálogo de añadidos', () => {
  it('R1, R3 — núcleo ∪ permisos de añadidos = PERMISSIONS, disjuntos y sin repetidos', () => {
    const union = [...CORE_PERMISSIONS, ...deAnadidos]
    expect(new Set(union).size).toBe(union.length)
    expect([...union].sort()).toEqual([...catalogo].sort())
    expect(CORE_PERMISSIONS.filter((p) => deAnadidos.includes(p))).toEqual([])
  })

  it('R2, QC-137 R18 — exactamente seis añadidos, con sus permisos', () => {
    expect([...ADDONS]).toEqual([
      'dashboard',
      'proveedores',
      'lectura_pdf',
      'importacion_excel',
      'integraciones',
      'notificaciones',
    ])
    expect(ADDON_PERMISSIONS).toEqual({
      dashboard: ['dashboard.consultar'],
      proveedores: ['proveedores.consultar', 'proveedores.modificar'],
      lectura_pdf: ['documentos.consultar', 'documentos.modificar'],
      importacion_excel: [],
      integraciones: ['integraciones.modificar'],
      notificaciones: ['notificaciones.consultar'],
    })
  })

  it('R2 — importacion_excel no arrastra ningún permiso', () => {
    expect(ADDON_PERMISSIONS.importacion_excel).toEqual([])
  })

  it('R2 — isAddon reconoce solo las seis claves, exactas', () => {
    for (const addon of ADDONS) expect(isAddon(addon)).toBe(true)
    for (const otra of ['pedidos', 'x', '', 'Dashboard', ' dashboard', 'lectura-pdf']) {
      expect(isAddon(otra)).toBe(false)
    }
  })

  it('R4 — dependencia de un solo nivel: ningún añadido requerido tiene requisitos', () => {
    for (const addon of ADDONS) {
      for (const dep of ADDON_REQUIRES[addon]) {
        expect(ADDONS).toContain(dep)
        expect(dep).not.toBe(addon)
        expect(ADDON_REQUIRES[dep]).toEqual([])
      }
    }
    expect(ADDON_REQUIRES.lectura_pdf).toEqual(['integraciones'])
  })
})

describe('effectiveAddons', () => {
  it('R4 — lectura_pdf sin integraciones no es activo', () => {
    expect(effectiveAddons(['lectura_pdf'])).toEqual([])
  })

  it('R4 — lectura_pdf con integraciones: activos los dos', () => {
    expect(effectiveAddons(['lectura_pdf', 'integraciones'])).toEqual(['lectura_pdf', 'integraciones'])
  })

  it('R2 — claves desconocidas o repetidas se ignoran y sale en el orden de ADDONS', () => {
    expect(effectiveAddons(['integraciones', 'x', 'dashboard', 'dashboard', 'pedidos', 'Proveedores'])).toEqual([
      'dashboard',
      'integraciones',
    ])
    expect(effectiveAddons([])).toEqual([])
    expect(effectiveAddons([...ADDONS].reverse())).toEqual([...ADDONS])
  })
})

describe('effectivePermissions', () => {
  const rolCompleto = [...catalogo]

  it('R8 — sin añadidos activos quedan solo los del núcleo', () => {
    expect([...effectivePermissions(rolCompleto, [])].sort()).toEqual([...CORE_PERMISSIONS].sort())
  })

  it('R8 — con todos activos no se recorta nada', () => {
    expect(effectivePermissions(rolCompleto, ADDONS)).toEqual(rolCompleto)
  })

  it('R8 — resta solo los permisos de los añadidos no activos', () => {
    const efectivos = effectivePermissions(rolCompleto, ['dashboard', 'integraciones'])
    expect(efectivos).toContain('dashboard.consultar')
    expect(efectivos).toContain('integraciones.modificar')
    expect(efectivos).not.toContain('proveedores.consultar')
    expect(efectivos).not.toContain('documentos.modificar')
  })

  it('R11 — un añadido activo no añade lo que el rol no tiene', () => {
    expect(effectivePermissions(['inventario.consultar'], ADDONS)).toEqual(['inventario.consultar'])
    expect(effectivePermissions([], ADDONS)).toEqual([])
  })

  it('R11 — un permiso fuera del catálogo pasa tal cual', () => {
    expect(effectivePermissions(['algo.raro', 'dashboard.consultar'], [])).toEqual(['algo.raro'])
  })

  it('R3 — ningún recorte apaga un permiso del núcleo', () => {
    expect(effectivePermissions(CORE_PERMISSIONS, [])).toEqual(CORE_PERMISSIONS)
  })
})

describe('assertAddon / hasAddon', () => {
  const RECHAZADOS: readonly (readonly [string, AddonBearer | null | undefined])[] = [
    ['portador null', null],
    ['portador undefined', undefined],
    ['sin addons', {}],
    ['addons que no son un array', { addons: 'dashboard' } as unknown as AddonBearer],
    ['addons vacío', { addons: [] }],
    ['sin la clave', { addons: ['proveedores'] }],
    ['la clave con otra caja', { addons: ['Dashboard'] }],
  ]

  for (const [nombre, portador] of RECHAZADOS) {
    it(`R14 — falla cerrado: ${nombre}`, () => {
      expect(hasAddon(portador, 'dashboard')).toBe(false)
      expect(() => assertAddon(portador, 'dashboard', onDenied)).toThrow(ErrorDePrueba)
    })
  }

  it('R14 — con la clave pasa', () => {
    const portador = { addons: ['dashboard'] }
    expect(hasAddon(portador, 'dashboard')).toBe(true)
    expect(() => assertAddon(portador, 'dashboard', onDenied)).not.toThrow()
  })
})

describe('añadido notificaciones', () => {
  const PERMISO = 'notificaciones.consultar'
  const otros = ADDONS.filter((addon) => addon !== 'notificaciones')

  it('QC-137 R18 — el permiso efectivo es rol ∩ añadido: hace falta que el rol lo tenga y el añadido esté activo', () => {
    expect(effectivePermissions([PERMISO, 'inventario.consultar'], ['notificaciones'])).toContain(PERMISO)
    expect(effectivePermissions([PERMISO, 'inventario.consultar'], otros)).not.toContain(PERMISO)
    expect(effectivePermissions([PERMISO], [])).toEqual([])
    expect(effectivePermissions(['inventario.consultar'], ADDONS)).not.toContain(PERMISO)
  })

  it('QC-137 R18 — su permiso es del añadido, no del núcleo', () => {
    expect(CORE_PERMISSIONS).not.toContain(PERMISO)
    expect(catalogo).toContain(PERMISO)
  })

  it('QC-137 R53 — no depende de ningún otro añadido: activo solo, sin integraciones', () => {
    expect(ADDON_REQUIRES.notificaciones).toEqual([])
    expect(effectiveAddons(['notificaciones'])).toEqual(['notificaciones'])
  })

  it('QC-137 R53 — ningún añadido depende de él: prenderlo o apagarlo no cambia los demás', () => {
    for (const addon of ADDONS) expect(ADDON_REQUIRES[addon]).not.toContain('notificaciones')

    const combinaciones: readonly (readonly string[])[] = [
      [],
      ['integraciones'],
      ['lectura_pdf'],
      ['lectura_pdf', 'integraciones'],
      otros,
    ]
    for (const resto of combinaciones) {
      const sin = effectiveAddons(resto)
      const con = effectiveAddons([...resto, 'notificaciones'])
      expect(con.filter((addon) => addon !== 'notificaciones'), resto.join(',')).toEqual(sin)
      expect(con).toContain('notificaciones')
    }
  })
})
