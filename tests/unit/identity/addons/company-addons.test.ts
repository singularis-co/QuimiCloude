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

  it('R2 — exactamente seis añadidos, con sus permisos', () => {
    expect([...ADDONS]).toEqual([
      'dashboard',
      'proveedores',
      'lectura_pdf',
      'importacion_excel',
      'integraciones',
      'agente_ia_whatsapp',
    ])
    expect(ADDON_PERMISSIONS).toEqual({
      dashboard: ['dashboard.consultar'],
      proveedores: ['proveedores.consultar', 'proveedores.modificar'],
      lectura_pdf: ['documentos.consultar', 'documentos.modificar'],
      importacion_excel: [],
      integraciones: ['integraciones.modificar', 'whatsapp.enviar', 'whatsapp.consultar'],
      agente_ia_whatsapp: ['agente_ia.consultar', 'agente_ia.modificar'],
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
    expect(ADDON_REQUIRES.agente_ia_whatsapp).toEqual(['integraciones'])
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

describe('QC-137 — las notificaciones son núcleo', () => {
  it('QC-137 R18: ADDONS no incluye notificaciones', () => {
    // Lista escrita a mano: un añadido nuevo rompe la igualdad sin tener que nombrarlo aquí.
    expect([...ADDONS]).toEqual([
      'dashboard',
      'proveedores',
      'lectura_pdf',
      'importacion_excel',
      'integraciones',
      'agente_ia_whatsapp',
    ])
    expect(Object.keys(ADDON_PERMISSIONS).sort()).toEqual([...ADDONS].sort())
    expect(Object.keys(ADDON_REQUIRES).sort()).toEqual([...ADDONS].sort())
  })
})

describe('el permiso whatsapp.enviar viaja con el añadido integraciones', () => {
  const ENVIAR = 'whatsapp.enviar'

  it('R3 — whatsapp.enviar es de integraciones, de ningún otro añadido y no es núcleo', () => {
    expect(ADDON_PERMISSIONS.integraciones).toContain(ENVIAR)
    for (const addon of ADDONS.filter((a) => a !== 'integraciones')) {
      expect(ADDON_PERMISSIONS[addon] as readonly string[], addon).not.toContain(ENVIAR)
    }
    expect(CORE_PERMISSIONS as readonly string[]).not.toContain(ENVIAR)
  })

  it('R3 — con integraciones apagado la sesión pierde whatsapp.enviar; encendido lo conserva', () => {
    const rol = ['clientes.consultar', ENVIAR]
    expect(effectivePermissions(rol, [])).toEqual(['clientes.consultar'])
    expect(effectivePermissions(rol, ['dashboard', 'proveedores'])).toEqual(['clientes.consultar'])
    expect(effectivePermissions(rol, ['integraciones'])).toEqual(rol)
  })
})

describe('el permiso whatsapp.consultar viaja con el añadido integraciones', () => {
  const CONSULTAR = 'whatsapp.consultar'

  it('R3 — whatsapp.consultar es de integraciones, de ningún otro añadido y no es núcleo', () => {
    expect(ADDON_PERMISSIONS.integraciones).toContain(CONSULTAR)
    for (const addon of ADDONS.filter((a) => a !== 'integraciones')) {
      expect(ADDON_PERMISSIONS[addon] as readonly string[], addon).not.toContain(CONSULTAR)
    }
    expect(CORE_PERMISSIONS as readonly string[]).not.toContain(CONSULTAR)
  })

  it('R3 — con integraciones apagado la sesión pierde whatsapp.consultar; encendido lo conserva', () => {
    const rol = ['clientes.consultar', CONSULTAR, 'whatsapp.enviar']
    expect(effectivePermissions(rol, [])).toEqual(['clientes.consultar'])
    expect(effectivePermissions(rol, ['dashboard', 'proveedores', 'lectura_pdf'])).toEqual(['clientes.consultar'])
    expect(effectivePermissions(rol, ['integraciones'])).toEqual(rol)
  })
})

describe('los permisos de planes son del núcleo', () => {
  const PLANES = ['planes.consultar', 'planes.modificar']

  it('R30 — CORE_PERMISSIONS los contiene y ningún añadido los declara', () => {
    for (const codigo of PLANES) {
      expect(CORE_PERMISSIONS as readonly string[], codigo).toContain(codigo)
      expect(deAnadidos, codigo).not.toContain(codigo)
    }
  })

  it('R30 — effectivePermissions los conserva con ningún añadido activo y con cualquiera', () => {
    const maestro = ['empresas.consultar', 'empresas.modificar', ...PLANES]
    expect(effectivePermissions(maestro, [])).toEqual(maestro)
    for (const addon of ADDONS) {
      expect(effectivePermissions(maestro, [addon]), addon).toEqual(maestro)
    }
    expect(effectivePermissions(maestro, [...ADDONS])).toEqual(maestro)
  })
})

describe('el añadido agente_ia_whatsapp', () => {
  const AGENTE = ['agente_ia.consultar', 'agente_ia.modificar']

  it('R1 — está en el catálogo de añadidos, al final, y isAddon lo reconoce solo con su clave exacta', () => {
    expect(ADDONS.at(-1)).toBe('agente_ia_whatsapp')
    expect(isAddon('agente_ia_whatsapp')).toBe(true)
    for (const otra of ['agente_ia', 'Agente_ia_whatsapp', 'agente-ia-whatsapp', ' agente_ia_whatsapp']) {
      expect(isAddon(otra), otra).toBe(false)
    }
  })

  it('R2 — requiere integraciones: prendido sin integraciones no es activo; con integraciones, sí', () => {
    expect(ADDON_REQUIRES.agente_ia_whatsapp).toEqual(['integraciones'])
    expect(effectiveAddons(['agente_ia_whatsapp'])).toEqual([])
    expect(effectiveAddons(['agente_ia_whatsapp', 'dashboard', 'lectura_pdf'])).toEqual(['dashboard'])
    expect(effectiveAddons(['agente_ia_whatsapp', 'integraciones'])).toEqual(['integraciones', 'agente_ia_whatsapp'])
    // Integraciones sola no prende el agente.
    expect(effectiveAddons(['integraciones'])).toEqual(['integraciones'])
  })

  it('R3, R4 — sus permisos son solo suyos, no del núcleo ni de otro añadido', () => {
    expect(ADDON_PERMISSIONS.agente_ia_whatsapp).toEqual(AGENTE)
    for (const addon of ADDONS.filter((a) => a !== 'agente_ia_whatsapp')) {
      for (const codigo of AGENTE) {
        expect(ADDON_PERMISSIONS[addon] as readonly string[], addon).not.toContain(codigo)
      }
    }
    for (const codigo of AGENTE) expect(CORE_PERMISSIONS as readonly string[], codigo).not.toContain(codigo)
  })

  it('R4 — con el añadido no activo se quitan agente_ia.consultar y agente_ia.modificar; activo, se conservan', () => {
    const rol = ['clientes.consultar', 'whatsapp.consultar', ...AGENTE]
    expect(effectivePermissions(rol, [])).toEqual(['clientes.consultar'])
    expect(effectivePermissions(rol, ['integraciones'])).toEqual(['clientes.consultar', 'whatsapp.consultar'])
    expect(effectivePermissions(rol, effectiveAddons(['agente_ia_whatsapp']))).toEqual(['clientes.consultar'])
    expect(effectivePermissions(rol, effectiveAddons(['agente_ia_whatsapp', 'integraciones']))).toEqual(rol)
  })
})
