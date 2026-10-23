# QC-243 — bitácora de implementación

## Tanda 1 · T1 y T2 (frontend_dev)

### Archivos creados
- `app/(private)/integraciones/whatsapp/components/whatsapp-system-constants.ts` — las tres constantes y la traducción de claves (P1): `toBackendText`, `toDisplayText`, `toBackendKey`, `displayKeyOf`, `constantLabelsForBackend`.
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-rules.ts` — `dictionaryOf`, `labelOfKey`, `isMappable`, `isUnmapped`, `notCompatibleReasonOf` (P5), `slotMarkOf`, `numberedContentOf`, `metaLengthOf`, `statusBadgeOf`, `usageBadgeOf`, `categoryLabelOf`, `formatSyncDateTime`, `LANGUAGE_OPTIONS`, `draftFromView`, `TEMPLATE_RULES_TEXTS`.
- `app/(private)/integraciones/whatsapp/components/whatsapp-variable-rules.ts` — `keyFromLabel`, `keyProblemOf`, `valueFormatWarning`, `VARIABLE_RULES_TEXTS`.
- `tests/unit/integraciones-ui/whatsapp-template-rules.test.ts`
- `tests/unit/integraciones-ui/whatsapp-variable-rules.test.ts`

No se tocó `index.ts` (solo exporta lo que usa `page.tsx`), ni `lib/`, `db/`, `package.json`.

### Mapa R → test
| R | Test |
|---|---|
| R7 | `whatsapp-template-rules.test.ts` › fecha de sincronización (marca de vacío; zona fija) |
| R10 | › estado y categoría › «R10: cada categoría con su nombre» |
| R11 | › estado y categoría › «R11: cada estado con su texto y su tono» |
| R15 | › relacionable (contenido vacío, variable con nombre, `{{n}}`, clave relacionada, URL) |
| R24 | › idiomas (códigos y nombres) |
| R26 | › contador (`{{nombre_del_cliente}}` cuenta 5; repetida; puntos de código) |
| R32 (diccionario) | › diccionario de pantalla |
| R40 | › duplicar (`_v2`, huecos `{{n}}`, sin header ni botones, `AUTHENTICATION` → `UTILITY`, no compatible) |
| R42 (marcas y texto numerado) | › huecos |
| R48 | › constantes del sistema › «R48: …» |
| P1 | › constantes del sistema (ida y vuelta; clave con punto desconocida intacta; `constantLabels`) |
| R51 | `whatsapp-variable-rules.test.ts` › keyFromLabel |
| R52 | › keyProblemOf (vacía, repetida con propia, igual a constante) |
| R57 | › valueFormatWarning |

### Verificación
El worktree no tiene `node_modules` propio (`pnpm exec vitest` → «Command "vitest" not found»); se corrió con los binarios de la raíz (mismo `package.json`/`pnpm-lock.yaml` que la rama de la raíz).
- `vitest related --run <5 archivos>` → `Test Files 2 passed (2) · Tests 40 passed (40)`.
- `tsc --noEmit` → 0 errores en los archivos de esta tanda; 1545 errores ajenos del entorno (cliente de Prisma sin generar: `TS2305 '@prisma/client' has no exported member 'Prisma'`, tipos de Next sin generar: `LayoutProps`).
- `eslint <5 archivos>` → sin hallazgos (exit 0).

Veredicto: T1 y T2 hechas, 40/40 en verde; typecheck y lint limpios en lo tocado.

## T3 — WaBubble (frontend_dev)

Archivos creados:
- `app/(private)/integraciones/whatsapp/components/wa-bubble.tsx`
- `tests/unit/integraciones-ui/wa-bubble.test.tsx`

No se añade al barrel `index.ts`: `page.tsx` no la usa (design §7); la importan los sheets de la ruta.

| R | Test (`wa-bubble.test.tsx`) |
|---|---|
| R32 | propia → valor; constante → etiqueta; desconocida → `[clave]`; `{{n}}` sin resolver → `[n]`; vacío → «Escribe el mensaje para verlo aquí.»; encabezado, pie, hora y botones; nombre accesible |
| R44 | hueco sin elegir → «[n sin relacionar]»; encabezado con su propia relación |
| R39 | clases `animate-in fade-in slide-in-from-bottom-1 duration-240 motion-reduce:animate-none` en variables y botones; las variables ya pintadas no se vuelven a montar |

Salida:
- `pnpm exec vitest related --run wa-bubble.tsx wa-bubble.test.tsx` → Test Files 1 passed, Tests 11 passed
- `pnpm run typecheck` → `tsc --noEmit` sin errores (tras `pnpm install --frozen-lockfile`, `prisma generate` y `next typegen`: el worktree no tenía `node_modules`)
- `pnpm run lint` → 0 errors, 10 warnings (ninguno en estos archivos)
- `pnpm exec vitest run guard-movimiento guard-anillo` → 2 passed, 19 tests

Veredicto: T3 hecha; WaBubble recibe el diccionario por props, sin acoplarse a T1.

## T4 — pestañas y página

Archivos:
- `app/(private)/integraciones/whatsapp/components/whatsapp-integration-tabs.tsx` (modificado): lista de pestañas `TabSpec[]` (valor, texto, testid, `disabled`, `describedBy`, `refreshOnEnter`, panel); QC-248 añade la suya como una entrada más.
- `app/(private)/integraciones/whatsapp/page.tsx` (modificado): conexión → plantillas (solo con conexión) en paralelo con el diccionario.
- `app/(private)/integraciones/whatsapp/components/whatsapp-templates-panel.tsx` (nuevo, esqueleto para T5).
- `app/(private)/integraciones/whatsapp/components/whatsapp-variables-panel.tsx` (nuevo, esqueleto para T11).
- `tests/unit/integraciones-ui/whatsapp-page.test.tsx` (modificado).
- `e2e/integraciones-whatsapp.spec.ts` (modificado, solo la aserción de la pestaña: `WHATSAPP_TABS_TEXTS.comingSoon` desaparece y el typecheck lo exige). No ejecutado.

Los paneles no van al barrel: `page.tsx` no los usa.

| R | Test (`whatsapp-page.test.tsx`) |
|---|---|
| R1 | `QC-243 R1`: una sola tablist, orden Conexión/Plantillas/Variables, Conexión activa |
| R2 | `QC-243 R2`: Plantillas deshabilitada con `aria-describedby` → «Conecta tu número primero para ver Plantillas.», Variables habilitada, sin llamada a plantillas |
| R3 | `QC-243 R3`: con conexión habilitada, sin pista, panel con el listado cargado |
| R4 | `QC-243 R4, R36` y `QC-243 R4, R37` + los casos de QC-237 sin cambios (R35 44 px ahora con tres pestañas) |
| R5 | `QC-243 R5`: refresh al entrar en Plantillas y Variables; no en Conexión |
| R6 | `QC-243 R6` ×3: error de plantillas, error del diccionario, error de la conexión |

Salida:
- `pnpm exec vitest related --run <page, tabs, 2 paneles, test>` → Test Files 5 passed, Tests 67 passed
- `pnpm run typecheck` → `tsc --noEmit` sin errores
- `pnpm run lint` → 0 errors, 10 warnings (ninguno en archivos tocados)

Supuestos a validar: títulos de `ErrorState` «No se pudo cargar la lista de plantillas.» / «… de variables.» (no están en el spec ni en el tablero; siguen el patrón del repo). Si falla la consulta de la conexión, Plantillas queda deshabilitada con la pista de R2.

Veredicto: T4 hecha; tres pestañas con refresco y error por pestaña, paneles listos para T5 y T11.
