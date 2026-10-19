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

## Tanda 3 — T5 y T6 (frontend_dev, 2026-10-19)

### Archivos creados

- `app/(private)/maestro/empresas/[id]/components/modulos/modules-section.tsx` — `ModulesSection` (Server async): una llamada a `getCompanyAddonsAction(companyId)`; error → `ErrorState` «No pudimos cargar los módulos» (`company-modules-error`, `retry={{ kind: 'refresh' }}`, `company-modules-retry`) y nada más; éxito → `AddonSwitchList` + `CoreModuleChips`
- `app/(private)/maestro/empresas/[id]/components/modulos/company-modules-tab.tsx` — `CompanyModulesTab` (Server): `Suspense` con `ModulesSkeleton`; `CompanyModulesTabProps` readonly; sin `tabpanel` propio
- `app/(private)/maestro/empresas/[id]/components/modulos/index.ts` — barrel sin `'use client'`: solo `CompanyModulesTab` y `type CompanyModulesTabProps`
- `tests/ui/maestro/company-modules-tab.test.tsx` — 5 casos
- `e2e/maestro-modulos.spec.ts` — 1 caso (R25)

### Archivos modificados

- `app/(private)/maestro/empresas/[id]/page.tsx` — el comentario del panel se sustituye por el montaje de design § 3 y `CompanyModulesTab` entra en el import de `'./components'`. Nada más.
- `app/(private)/maestro/empresas/[id]/components/index.ts` — `export * from './modulos';`
- `tests/ui/maestro/company-detail-page.test.tsx` — solo los dos casos de QC-166 R30 (enmienda E5). Al irse el único uso de `archivosDe`, se quitan ese helper y los imports `readdirSync`/`statSync` (lint los marcaría sin uso). Los demás casos intactos.
- `tests/guards/guard-identificador-de-request.test.ts` — alta de `'maestro-modulos.spec.ts'` en `E2E_ESPERADOS` con su motivo, tras las de QC-166.

### Mapa `R<n> → test` (tanda 3)

| R | Caso |
|---|---|
| R1 | `company-modules-tab.test.tsx` «R1: recibe empresa, baja y canModify por props y no lee la sesión» (incluye el estático: ningún archivo de `components/modulos/` importa `@/lib/composition`, `next/headers`, `assertPermission` ni `requirePagePermission`; y el barrel solo exporta la pestaña y su tipo, sin `'use client'`); `company-detail-page.test.tsx` «R1 (QC-278): con tab=modulos el panel Módulos monta la pestaña con las cuatro props», «R1 (QC-278): la página no importa ni llama a getCompanyAddonsAction; la pide la pestaña» |
| R2 | `company-modules-tab.test.tsx` «R2: pide la vista de añadidos una sola vez con el id de la empresa» |
| R3 | `company-modules-tab.test.tsx` «R3: mientras carga muestra Cargando los módulos… en una región status» |
| R4 | `company-modules-tab.test.tsx` «R4: si la lectura falla muestra No pudimos cargar los módulos con Reintentar y ningún interruptor» |
| R20 | `company-modules-tab.test.tsx` «R20: de baja también muestra añadidos y Núcleo» |
| R25 | `e2e/maestro-modulos.spec.ts` «R25: el Maestro prende y apaga Proveedores y el menú del Administrador lo sigue» |

### Notas y desviaciones

- `ModulesSection` envuelve la lista y el Núcleo en un `div flex-col gap-8`: el design no fija el
  espacio entre las dos secciones.
- Los tests de R1 de la página inspeccionan el árbol que devuelve la página (como el caso R31 de
  QC-166) y no lo pintan: pintar la pestaña haría correr en el cliente el componente async.
- El E2E no importa `ADDON_SWITCH_LIST_TESTIDS`/`TEXTS`: `addon-switch-list.tsx` es `'use client'` y
  arrastra las Server Actions; los testids y textos van literales.
- R20 en el test de la pestaña comprueba `aria-disabled="true"` en los `switch` (el `Switch` de
  Base UI no pone `disabled` nativo en el `span`).

### Salida de los comandos

```
pnpm run typecheck
> tsc --noEmit            (sin errores)

pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (las mismas 10 preexistentes; ninguna en archivos de esta tanda)

pnpm exec vitest related --run <modulos/company-modules-tab.tsx, modulos/index.ts, modulos/modules-section.tsx,
  components/index.ts, page.tsx, los dos tests de ui y la guardia>
 Test Files  8 passed (8)
      Tests  118 passed (118)

pnpm exec vitest run tests/ui/maestro/company-detail-page.test.tsx tests/ui/maestro/company-modules-tab.test.tsx
 Test Files  2 passed (2)
      Tests  22 passed (22)

pnpm exec vitest run guard
 Test Files  81 passed (81)
      Tests  1106 passed | 20 skipped (1126)

pnpm exec playwright test e2e/maestro-modulos.spec.ts      (EXIT 1, por entorno)
Running 2 tests using 2 workers
  x  1 [webkit] › e2e\maestro-modulos.spec.ts:130:5 › R25: el Maestro prende y apaga Proveedores y el menú del Administrador lo sigue (0ms)
  x  2 [chromium] › e2e\maestro-modulos.spec.ts:130:5 › R25: el Maestro prende y apaga Proveedores y el menú del Administrador lo sigue (0ms)
    PrismaClientInitializationError:
    Invalid `prisma.role.findUnique()` invocation in e2e\maestro-modulos.spec.ts:75:34
    Can't reach database server at `localhost:5433`
  2 failed
```

El E2E falla en el `beforeAll`, antes de abrir el navegador: la base local (`localhost:5433`, PG17
en Docker) no responde porque Docker Desktop no está arrancado (`docker ps`: «failed to connect to
the docker API at npipe:////./pipe/dockerDesktopLinuxEngine»). No se tocó config ni servidor.
`.env` sí trae las `SEED_MAESTRO_*`. Pendiente: correrlo con la base arriba (o que lo corra el CI)
y hacer la verificación manual en 390 px y 768 px que pide el «Hecho» de T6.

### Veredicto

T5 hecha y T6 hecha en código: 22/22 en los dos tests de ui, guardias, typecheck y lint en verde. El E2E de R25 está escrito pero sin correr: la base local está caída (bloqueo de entorno).

## Consolidado (implementer, 2026-10-19)

### Mapa `R<n> → test` (R1–R25)

| R | Test |
|---|---|
| R1 | `tests/ui/maestro/company-modules-tab.test.tsx` «R1: recibe empresa, baja y canModify por props y no lee la sesión» (incluye el estático E9); `tests/ui/maestro/company-detail-page.test.tsx` «R1 (QC-278): con tab=modulos el panel Módulos monta la pestaña con las cuatro props» y «R1 (QC-278): la página no importa ni llama a getCompanyAddonsAction; la pide la pestaña» |
| R2 | `company-modules-tab.test.tsx` «R2: pide la vista de añadidos una sola vez con el id de la empresa» |
| R3 | `company-modules-tab.test.tsx` «R3: mientras carga muestra Cargando los módulos… en una región status» |
| R4 | `company-modules-tab.test.tsx` «R4: si la lectura falla muestra No pudimos cargar los módulos con Reintentar y ningún interruptor» |
| R5 | `tests/ui/maestro/addon-switch-list.test.tsx` «R5: pinta los cinco añadidos en el orden de la vista con nombre, descripción y estado»; `tests/unit/maestro/addon-labels.test.ts` «R5: hay una etiqueta por añadido del catálogo», «R5: las descripciones son las de la pregunta 1, cerrada» |
| R6 | `addon-switch-list.test.tsx` «R6: Prendido si activo, Sin efecto si prendido sin activo, Apagado si apagado» |
| R7 | `addon-switch-list.test.tsx` «R7: Lectura de PDF dice Necesita Integraciones y en advertencia si está Sin efecto» |
| R8 | `addon-switch-list.test.tsx` «R8: la cabecera cuenta los interruptores prendidos de cinco» |
| R9 | `addon-switch-list.test.tsx` «R9: prender un añadido llama a setCompanyAddonAction sin diálogo» |
| R10 | `addon-switch-list.test.tsx` «R10: apagar un añadido abre la confirmación con su nombre, la empresa y lo que se descarta», «R10: Volver cierra sin escribir»; `addon-labels.test.ts` «R10: cada añadido lista lo que se descarta al apagarlo», «R10: Integraciones solo avisa de la lectura si está prendida» |
| R11 | `addon-switch-list.test.tsx` «R11: Prender todos llama a setAllCompanyAddonsAction con enabled=true sin diálogo» |
| R12 | `addon-switch-list.test.tsx` «R12: Apagar todos confirma con el número, los nombres y las consecuencias sin repetir»; `addon-labels.test.ts` «R12: Apagar todos junta lo que se descarta sin repetir, en el orden del catálogo y sin la línea de Integraciones» |
| R13 | `addon-switch-list.test.tsx` «R13: Prender todos deshabilitado sin apagados y Apagar todos sin prendidos» |
| R14 | `addon-switch-list.test.tsx` «R14: mientras guarda hay spinner en el interruptor afectado y todo deshabilitado» |
| R15 | `addon-switch-list.test.tsx` «R15: con éxito pinta la vista devuelta sin releer y avisa por toast»; `addon-labels.test.ts` «R15: mensajes de toast en singular y plural», «R15: devuelve solo los añadidos cuyo interruptor cambió, en el orden de la vista» |
| R16 | `addon-switch-list.test.tsx` «R16: si falla uno, el interruptor vuelve y aparece No se guardó el cambio junto a su fila» |
| R17 | `addon-switch-list.test.tsx` «R17: si falla todos, nada cambia y el error va bajo los botones» |
| R18 | `addon-switch-list.test.tsx` «R18: el siguiente cambio quita el error anterior» |
| R19 | `tests/ui/maestro/core-module-chips.test.tsx` «R19: once fichas del núcleo con candado y nada pulsable» |
| R20 | `addon-switch-list.test.tsx` «R20: empresa de baja: aviso y todos los controles deshabilitados»; `company-modules-tab.test.tsx` «R20: de baja también muestra añadidos y Núcleo» |
| R21 | `addon-switch-list.test.tsx` «R21: sin empresas.modificar todos los controles deshabilitados» |
| R22 | `addon-switch-list.test.tsx` «R22: el estado sale de active de la vista aunque enabled y requires digan otra cosa», «R22: el componente no importa effectiveAddons ni ADDON_REQUIRES» |
| R23 | `addon-switch-list.test.tsx` «R23: cada interruptor es un switch con nombre Prender o Apagar y responde a teclado» |
| R24 | `addon-switch-list.test.tsx` «R24: clases mobile-first: Switch junto al nombre y botones a todo el ancho bajo md»; verificación manual 390/768 px **pendiente** |
| R25 | `e2e/maestro-modulos.spec.ts` «R25: el Maestro prende y apaga Proveedores y el menú del Administrador lo sigue» — **escrito, no ejecutado en verde**: falla en `beforeAll` por entorno (Docker/PG en localhost:5433 caído), salida en la tanda 3 |

### Estado de las tasks

- T1–T5 `[x]`. T6 hecha en código; queda `[ ]` hasta que el E2E pase en Chromium y WebKit y se haga la verificación manual en 390 y 768 px (su «Hecho»). T7 pendiente del gate (`./init.sh`) del leader.

### Puntos para decidir (no bloquean el código; hoy se sigue el spec al pie de la letra)

1. `ModalesMaestro.dc.html` l. 114 trae «El interruptor vuelve a su posición anterior.» bajo el error de la fila. R16 y el design no la piden; no se pintó.
2. «Apagar todos» con un solo añadido prendido: con R12 literal sale «¿Apagar los 1 módulos prendidos?» y «<A> desaparecen…». Ni spec ni tablero traen singular (mismo caso que la pregunta 4 resolvió para el toast).

### Desviaciones aceptadas por el implementer

- `successMessage(changed, enabled, via)` lleva un tercer argumento (R15 distingue «Proveedores prendido.» de «Se prendió 1 módulo.»).
- Diálogo con booleano `offOpen` + última petición `offRequest`, para que el texto no se vacíe al cerrarse; mismo comportamiento.
- El error previo también se limpia al abrir el diálogo de apagar (lectura de R18).
