# QC-278 — impl (bitácora de implementación)

## Tanda 1 — T1, T2, T3 (frontend_dev, 2026-10-19)

### Archivos creados

- `app/(private)/maestro/empresas/[id]/components/modulos/addon-labels.ts` — `ADDON_LABELS`, `changedAddons`, `successMessage`
- `app/(private)/maestro/empresas/[id]/components/modulos/addon-off-consequences.ts` — `offConsequences`
- `app/(private)/maestro/empresas/[id]/components/modulos/core-modules.ts` — `CORE_MODULE_NAMES` (11)
- `app/(private)/maestro/empresas/[id]/components/modulos/core-module-chips.tsx` — `CoreModuleChips` (Server)
- `app/(private)/maestro/empresas/[id]/components/modulos/modules-skeleton.tsx` — `ModulesSkeleton` (Server)
- `tests/unit/maestro/addon-labels.test.ts`
- `tests/ui/maestro/core-module-chips.test.tsx`

### Notas

- `successMessage` lleva un tercer argumento `via: 'one' | 'all'` (design § 4.2 lo nombra con dos).
  Con dos no se distingue «Proveedores prendido.» (uno) de «Se prendió 1 módulo.» («todos» con un
  solo cambio), y R15 pide los dos. T4 lo llama con el `via` que ya tiene `write()`.
- `offConsequences` ordena por `view.addons` (que viene en el orden de `ADDONS`) para no importar
  el valor `ADDONS` del barrel de identity desde código que acaba en el cliente.

### Mapa `R<n> → test` (tanda 1)

| R | Test |
|---|---|
| R5 | `tests/unit/maestro/addon-labels.test.ts` «R5: hay una etiqueta por añadido del catálogo», «R5: las descripciones son las de la pregunta 1, cerrada» |
| R10 | `tests/unit/maestro/addon-labels.test.ts` «R10: cada añadido lista lo que se descarta al apagarlo», «R10: Integraciones solo avisa de la lectura si está prendida» |
| R12 | `tests/unit/maestro/addon-labels.test.ts` «R12: Apagar todos junta lo que se descarta sin repetir, en el orden del catálogo y sin la línea de Integraciones» |
| R15 | `tests/unit/maestro/addon-labels.test.ts` «R15: devuelve solo los añadidos cuyo interruptor cambió, en el orden de la vista», «R15: mensajes de toast en singular y plural» |
| R19 | `tests/ui/maestro/core-module-chips.test.tsx` «R19: once fichas del núcleo con candado y nada pulsable» |
| R3 | `ModulesSkeleton` sin test propio: lo cubre el caso R3 de T5 |

### Salida de los comandos

```
pnpm exec vitest related --run <los 5 archivos de modulos/ + los 2 tests>
 Test Files  2 passed (2)
      Tests  8 passed (8)

pnpm run typecheck
> tsc --noEmit            (sin errores)

pnpm run lint
ESLint: 0 errors, 10 warnings in 4 files   (todas preexistentes, ninguna en archivos de esta tanda)

pnpm exec vitest run guard
 Test Files  81 passed (81)
      Tests  1106 passed | 20 skipped (1126)
```

### Veredicto

T1, T2 y T3 hechas: 8/8 tests en verde, typecheck, lint y guardias en verde.

## Tanda 2 — T4 `AddonSwitchList` (frontend_dev, 2026-10-19)

### Archivos creados

- `app/(private)/maestro/empresas/[id]/components/modulos/addon-switch-list.tsx` — `AddonSwitchList` (`'use client'`), `ADDON_SWITCH_LIST_TESTIDS`, `ADDON_SWITCH_LIST_TEXTS`
- `tests/ui/maestro/addon-switch-list.test.tsx` — 21 casos

Acciones importadas de `@/lib/modules/identity/adapters/driving/company-actions` (archivo `'use server'`,
ya importado así por cuatro componentes cliente de `maestro/empresas/components/`). Del barrel de
identity solo tipos. Piezas del catálogo: `Switch`, `StatusBadge`, `ConfirmDialog`, `ErrorAlert`,
`Notice`, `Button touch="mobile"`, `Spinner`. Nada nuevo en `components/shared` ni en el catálogo;
ninguna dependencia.

### Notas y desviaciones

- El diálogo usa `open={offOpen}` más la última petición (`offRequest`) en vez de
  `open={confirm !== null}` (design § 4.2/4.3): así el título y la lista no se vacían durante la
  animación de salida. Mismo comportamiento.
- `successMessage(changed, enabled, via)` con el tercer argumento de la tanda 1.
- R18: el error se quita también al abrir el diálogo de apagar (es «cambiar de nuevo un interruptor»
  o «pulsar un botón»), no solo al escribir.
- Icono del diálogo: `PowerIcon` en tono `warning` (el tablero pinta ese glifo en `dlg-ic warn`).
- No se pinta la línea «El interruptor vuelve a su posición anterior.» de `ModalesMaestro.dc.html`
  l. 114: R16 no la pide y parece nota del tablero. Pendiente de confirmar.
- «Apagar todos» con un solo prendido sigue el texto del spec al pie de la letra: «¿Apagar los 1
  módulos prendidos?» y «<A> desaparecen…». El spec (R12) y el tablero no traen singular. Pendiente
  de decidir (como la pregunta 4 para el toast).

### Mapa `R<n> → test` (tanda 2, `tests/ui/maestro/addon-switch-list.test.tsx`)

| R | Caso |
|---|---|
| R5 | «R5: pinta los cinco añadidos en el orden de la vista con nombre, descripción y estado» |
| R6 | «R6: Prendido si activo, Sin efecto si prendido sin activo, Apagado si apagado» |
| R7 | «R7: Lectura de PDF dice Necesita Integraciones y en advertencia si está Sin efecto» |
| R8 | «R8: la cabecera cuenta los interruptores prendidos de cinco» |
| R9 | «R9: prender un añadido llama a setCompanyAddonAction sin diálogo» |
| R10 | «R10: apagar un añadido abre la confirmación con su nombre, la empresa y lo que se descarta», «R10: Volver cierra sin escribir» |
| R11 | «R11: Prender todos llama a setAllCompanyAddonsAction con enabled=true sin diálogo» |
| R12 | «R12: Apagar todos confirma con el número, los nombres y las consecuencias sin repetir» |
| R13 | «R13: Prender todos deshabilitado sin apagados y Apagar todos sin prendidos» |
| R14 | «R14: mientras guarda hay spinner en el interruptor afectado y todo deshabilitado» |
| R15 | «R15: con éxito pinta la vista devuelta sin releer y avisa por toast» |
| R16 | «R16: si falla uno, el interruptor vuelve y aparece No se guardó el cambio junto a su fila» |
| R17 | «R17: si falla todos, nada cambia y el error va bajo los botones» |
| R18 | «R18: el siguiente cambio quita el error anterior» |
| R20 | «R20: empresa de baja: aviso y todos los controles deshabilitados» |
| R21 | «R21: sin empresas.modificar todos los controles deshabilitados» |
| R22 | «R22: el estado sale de active de la vista aunque enabled y requires digan otra cosa», «R22: el componente no importa effectiveAddons ni ADDON_REQUIRES» (estático) |
| R23 | «R23: cada interruptor es un switch con nombre Prender o Apagar y responde a teclado» |
| R24 | «R24: clases mobile-first: Switch junto al nombre y botones a todo el ancho bajo md» |

### Salida de los comandos

```
pnpm run typecheck
> tsc --noEmit            (sin errores)

pnpm run lint
ESLint: 0 errors, 10 warnings in 4 files   (las mismas 10 preexistentes; ninguna en archivos de esta tanda)

pnpm exec vitest related --run addon-switch-list.tsx tests/ui/maestro/addon-switch-list.test.tsx
 Test Files  1 passed (1)
      Tests  21 passed (21)

pnpm exec vitest run guard
 Test Files  81 passed (81)
      Tests  1106 passed | 20 skipped (1126)
```

### Veredicto

T4 hecha: 21/21 casos en verde (R5–R18, R20–R24, con el estático de R22); typecheck, lint y guardias en verde.
