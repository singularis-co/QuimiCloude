# QC-278 — review (F2.2)

## Vuelta 1 (origin/dev..8d856ac6)

Reviewer, 2026-10-19. Spec: `specs/QC-278-pantalla-modulos-por-empresa/` con las enmiendas
`design.md > 0` (E1–E16) y `> 0.1` (E17–E19), aprobadas por el humano. Bitácora:
`progress/impl_QC-278-pantalla-modulos-por-empresa.md`.

### Verificación ejecutada por el reviewer (en el worktree, sobre HEAD 8d856ac6)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | 0 errores |
| `pnpm run lint` | 0 errores, 10 avisos, todos en archivos fuera del diff (`step-evidence.tsx`, tres tests de `asignaciones`, `documentos`, `pedidos`) |
| `pnpm exec vitest related --run <los .ts/.tsx del diff>` | 11 archivos, 148 tests en verde |
| `pnpm exec vitest run` sobre los 5 tests de la ficha + `tests/unit/proveedores/module-contract.test.ts` + `tests/unit/shared/addon-names.test.ts` | 7 archivos, 65 tests en verde |
| `pnpm exec vitest run guard` | 81 archivos; 1106 en verde, 20 saltados, 0 rojos |
| `./init.sh` (rápido) | `== init OK ==` (120 archivos, 1685 en verde, 37 saltados) |
| E2E `e2e/maestro-modulos.spec.ts` | No lo corrí: lo corre el CI. La bitácora trae `2 passed (28.2s)` en Chromium y WebKit (tanda 4) |

Los `.int` no aplican: el diff no toca adaptadores, esquema ni casos de uso.

### Checklist

**Reviewer (puntos 1–4)**

- [x] 1. Trazabilidad R1–R25: cada R tiene un test que lo verifica de verdad (mapa abajo). Ninguno vacío.
- [ ] 2. Tasks: T1–T5 y T6b `[x]`; **T6 y T7 siguen `[ ]`** (ver menor m1). El trabajo de las dos está hecho y verificado; solo falta la marca, y en T6 la verificación manual a 390/768 px, que es del humano.
- [x] 3. Checkpoints: recorridos abajo. `design.md > ## Lo que ya existe` existe y está lleno; el diff no re-crea nada de esa lista (`ADDON_NAMES`, acciones de QC-277, panel de QC-166, helpers de E2E se reutilizan).
- [x] 4. Verificación ejecutable: tabla de arriba.

**Perfil del proyecto (puntos 5–11)**

- [x] 5. Calidad y seguridad: sin tablas, sin webhooks, sin secretos, sin contexto hardcodeado. Capas: la pestaña no lee sesión ni permisos (estático en `company-modules-tab.test.tsx` R1); del barrel de identity solo tipos en el cliente (estático R22).
- [x] 6. Multiplataforma: sin `100vh`/`h-screen`, sin `hover:`, sin inputs. `Switch` con `min-h-11 min-w-11` bajo `md`, botones `touch="mobile"` (`max-md:min-h-11`) y `w-full` bajo `md` (afirmado en el caso R24). Librerías ya verificadas (`@base-ui/react`, `sonner`, `lucide-react`).
- [x] 7. Dependencias: `package.json` no se toca.
- [x] 8. Aislamiento por empresa: no toca `db/schema.prisma` ni consultas; las tres acciones de QC-277 filtran y autorizan en su caso de uso.
- [x] 9. Comentarios: ninguna línea de producción añadida cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada» (grep en `components/modulos/*`, `page.tsx`, `lib/shared/ui/addon-details.ts`). La cita de QC-278 en `tests/guards/guard-identificador-de-request.test.ts:503` es de test y sigue el patrón de las entradas vecinas.
- [x] 10. Duplicados: `addon-switch-list` y `core-module-chips` declaran el paso 3 (Compón) y por qué no bastan las filas del catálogo (`design.md:88-105`). `ADDON_DETAILS` es nuevo y no cubre lo de `ADDON_NAMES` (lo complementa).
- [x] 11. Diseño: las dos piezas nuevas citan `docs/diseno/canvas/MaestroEmpresa.dc.html` y `ModalesMaestro.dc.html` (`design.md:95-102`, § 1). Son de ruta: sin fila en el catálogo. `ADDON_DETAILS` es `sin UI` y su fila está en `## Apoyos` con `Diseño` = `—`, como `ADDON_NAMES`.

**CHECKPOINTS.md**

- [x] requirements.md con EARS R1–R25.
- [x] design.md con alternativas descartadas (§ 8, A–E y D2/D3).
- [ ] tasks.md todas `[x]` → m1.
- [x] `## Lo que ya existe` y nada re-creado.
- [x] Equipo: rama `feature/QC-278-pantalla-modulos-por-empresa`, commit `bb498d1c chore(QC-278): feature tomada por ArqDev`.
- [x] Mapa `R<n> → test` en `progress/impl_…md` (sección «Consolidado»).
- [x] typecheck y lint sin errores.
- [ ] `gate-completo` en CI: aún no hay PR (lo verá el leader en F3).
- [x] Flujo crítico (permisos): E2E de Playwright `e2e/maestro-modulos.spec.ts` y su salida en la bitácora; dado de alta en `E2E_ESPERADOS`.
- [x] Sin dependencias nuevas, sin secretos, sin webhooks, nada de entorno hardcodeado (el Maestro sale de `maestroCredentials()`).
- [x] `./init.sh` verde en el worktree.
- [ ] `progress/features/QC-278.md > Cierre` y desmontar el worktree: pasos posteriores del leader, no se evalúan aquí.

**docs/checkpoints-proyecto.md**

- [x] Calidad: typecheck, lint, E2E en Playwright, multiplataforma (punto 6), catálogo al día (fila nueva de `ADDON_DETAILS` y «No cubre» de `ADDON_NAMES` remitiendo a ella; `guard-catalogo-de-componentes` verde), pase `/design` citado.
- [x] Datos y seguridad: sin tablas ni migraciones ni Supabase; los permisos (`empresas.consultar`/`modificar`) los valida el caso de uso de QC-277, con sus tests allí.
- [x] Hexagonales: `lib/shared/ui/addon-details.ts` solo importa `lucide-react` y `./addon-names` (hoja del grafo); de identity, contrato por el barrel y la ruta de las acciones `'use server'` igual que el resto de `maestro/empresas`; ningún `'use server'` reexportado.
- [x] Permisos: la página de QC-166 valida en servidor; la pestaña recibe `canModify` por props; las mutaciones son Server Actions.

### Hallazgos

Ninguno BLOQUEANTE.

- **m1 — menor.** `specs/QC-278-pantalla-modulos-por-empresa/tasks.md:68` (T6) y `:116` (T7) siguen `[ ]`.
  T6: todo hecho salvo la verificación manual a 390/768 px, pendiente del humano (por indicación del
  leader no la cuento como hallazgo; queda anotada). T7: su «Hecho» se cumple (mapa de 25 filas en la
  bitácora, guardias e `./init.sh` verdes, comprobados aquí; ningún componente de la ficha en
  `components/shared`). Falta solo marcar las dos antes del merge (T6 tras la verificación manual).
- **m2 — menor (decisión pedida: `OFF_CONSEQUENCES` sin `integraciones`).**
  `app/(private)/maestro/empresas/[id]/components/modulos/addon-off-consequences.ts:7-10` deja solo
  `lectura_pdf` e `importacion_excel`; `design.md:51` (E17, «solo con los tres que descartan algo») y
  `design.md:357-358` (§ 5, «solo con `lectura_pdf`, `importacion_excel` e `integraciones`») nombran
  tres. La entrada de `integraciones` sería `[]` (su línea es condicional y sale de
  `pdfStopsWhenAlone`, l. 13-17), y T6b (`tasks.md:98-99`), instrucción posterior y más concreta,
  pide quitar las vacías. El comportamiento de R10/R12/P3 es idéntico y lo afirman
  `addon-labels.test.ts` («R10: Integraciones solo avisa de la lectura si está prendida», «R12: …sin la
  línea de Integraciones»). **Dictamen:** menor; no requiere enmienda del spec ni nueva aprobación.
  Opcional: alinear la frase de E17 y § 5 al código en una edición solo de texto.
- **m3 — menor.** `addon-off-consequences.ts:4` escribe a mano «Lectura de PDF con IA» dentro de
  `PDF_STOPS`, en vez de tomarlo de `ADDON_NAMES.lectura_pdf`. Es el texto exacto del tablero y del
  design (§ 4.3), pero repite un nombre que el spec quiere con fuente única (§ 5, alternativa D: «dos
  copias divergen»). Si el nombre cambia en `ADDON_NAMES`, esta línea se queda vieja.
- **m4 — menor (E5, QC-166 R30).** Los dos casos reescritos en
  `tests/ui/maestro/company-detail-page.test.tsx:234` y `:256` se llaman ahora «R1 (QC-278): …» y
  pierden la etiqueta R30. Lo que queda de QC-166 R30 sigue cubierto: el panel existe con su nombre
  «Módulos» y su `data-testid` y está listo (ahora lleno) para QC-278 (l. 234-253), y la **página** no
  importa ni llama a `getCompanyAddonsAction` (mock sin llamar y estático sobre `page.tsx`,
  l. 256-260). La parte «no pide los añadidos» se supera a propósito por QC-278 R2 (E5, aprobada). Pero
  el mapa de QC-166 (`progress/impl_QC-166.md:142`, `specs/QC-166-area-del-maestro/design.md:520`)
  apunta a casos que ya no existen con ese nombre, y un grep de «R30» en el archivo ya no los
  encuentra. Sugerencia: nombres «R30 (QC-166) / R1 (QC-278): …».

Notas, no hallazgos:

- Desviaciones del implementer, revisadas y aceptables: `successMessage` con un tercer argumento
  `via` (necesario para distinguir «Proveedores prendido.» de «Se prendió 1 módulo.», R15); diálogo
  con `offOpen` + `offRequest` en vez de `open={confirm !== null}` (mismo comportamiento, sin texto
  vacío en la salida); R18 limpia el error también al abrir el diálogo de apagar.
- Textos contrastados con `ModalesMaestro.dc.html:88-115` y `MaestroEmpresa.dc.html`: título y
  cuerpo de los dos diálogos, «Volver»/«Apagar»/«Apagar todos», línea de apoyo bajo el error de la
  fila, «Necesita … Préndela para que funcione.», «Cargando los módulos…», «No pudimos cargar los
  módulos», subtítulo del Núcleo: coinciden.
- **Pendiente del humano:** verificación manual a 390 px y 768 px contra
  `MaestroEmpresaMovil.dc.html` y `MaestroEmpresaTablet.dc.html` (cierre de T6).
- El MCP del grafo no se usó: el diff es pequeño y de UI; se revisó con Read/Grep.

### Mapa `R<n> → test` (verificado leyendo cada caso)

| R | Test | Qué afirma |
|---|---|---|
| R1 | `tests/ui/maestro/company-modules-tab.test.tsx` «R1: recibe empresa, baja y canModify por props y no lee la sesión»; `tests/ui/maestro/company-detail-page.test.tsx` «R1 (QC-278): con tab=modulos el panel Módulos monta la pestaña con las cuatro props», «R1 (QC-278): la página no importa ni llama a getCompanyAddonsAction; la pide la pestaña» | props pasadas tal cual; estático sin `@/lib/composition`, `next/headers`, `assertPermission`, `requirePagePermission`; barrel exacto; montaje dentro del `tabpanel` «Módulos» con `isDeleted`/`canModify` de la página |
| R2 | `company-modules-tab.test.tsx` «R2: pide la vista de añadidos una sola vez con el id de la empresa» | 1 llamada con el id |
| R3 | `company-modules-tab.test.tsx` «R3: mientras carga muestra Cargando los módulos… en una región status» | `fallback` del `Suspense` es `ModulesSkeleton`; `role="status"`, `aria-busy` |
| R4 | `company-modules-tab.test.tsx` «R4: si la lectura falla muestra No pudimos cargar los módulos con Reintentar y ningún interruptor» | título, mensaje, referencia, sin `switch` ni Núcleo, Reintentar → `router.refresh` |
| R5 | `tests/ui/maestro/addon-switch-list.test.tsx` «R5: pinta los cinco añadidos en el orden de la vista…»; `tests/unit/maestro/addon-labels.test.ts` «R5: hay una etiqueta por añadido…», «R5: las descripciones son las de la pregunta 1, cerrada» | orden de la vista (invertido), nombre/descripción/estado/switch; etiquetas = `ADDON_NAMES` + `ADDON_DETAILS` |
| R6 | `addon-switch-list.test.tsx` «R6: Prendido si activo, Sin efecto…, Apagado…» | texto y tono de cada estado |
| R7 | «R7: Lectura de PDF dice Necesita Integraciones y en advertencia si está Sin efecto» | texto con y sin «Préndela…», tono |
| R8 | «R8: la cabecera cuenta los interruptores prendidos de cinco» | «3 de 5 prendidos.» + nota; «0 de 5» |
| R9 | «R9: prender un añadido llama a setCompanyAddonAction sin diálogo» | FormData exacto, sin diálogo |
| R10 | «R10: apagar un añadido abre la confirmación…», «R10: Volver cierra sin escribir»; `addon-labels.test.ts` «R10: cada añadido lista lo que se descarta…», «R10: Integraciones solo avisa de la lectura si está prendida» | título, empresa en `strong`, lista, botones, escritura tras confirmar; regla de P3 |
| R11 | «R11: Prender todos llama a setAllCompanyAddonsAction con enabled=true sin diálogo» | |
| R12 | «R12: Apagar todos confirma con el número, los nombres y las consecuencias sin repetir», «R12: con un solo añadido prendido, Apagar todos va en singular»; `addon-labels.test.ts` «R12: …sin repetir, en el orden del catálogo y sin la línea de Integraciones» | plural y singular (E19), acción de todos |
| R13 | «R13: Prender todos deshabilitado sin apagados y Apagar todos sin prendidos» | |
| R14 | «R14: mientras guarda hay spinner en el interruptor afectado y todo deshabilitado» | spinner solo en el afectado, `aria-busy`, todo deshabilitado y se libera |
| R15 | «R15: con éxito pinta la vista devuelta sin releer y avisa por toast»; `addon-labels.test.ts` «R15: mensajes de toast en singular y plural», «R15: devuelve solo los añadidos cuyo interruptor cambió…» | sin `getCompanyAddonsAction`; «Integraciones prendido.», «Se prendió 1 módulo.» |
| R16 | «R16: si falla uno, el interruptor vuelve y aparece No se guardó el cambio junto a su fila» | `role="alert"` en la fila, mensaje y referencia, línea de apoyo después (E18), interruptor sin mover |
| R17 | «R17: si falla todos, nada cambia y el error va bajo los botones» | error tras los botones, sin errores de fila ni línea de apoyo |
| R18 | «R18: el siguiente cambio quita el error anterior» | por interruptor y por botón |
| R19 | `tests/ui/maestro/core-module-chips.test.tsx` «R19: once fichas del núcleo con candado y nada pulsable» | 11 en orden, `lucide-lock`, nada enfocable |
| R20 | «R20: empresa de baja: aviso y todos los controles deshabilitados»; `company-modules-tab.test.tsx` «R20: de baja también muestra añadidos y Núcleo» | |
| R21 | «R21: sin empresas.modificar todos los controles deshabilitados» | |
| R22 | «R22: el estado sale de active de la vista…», «R22: el componente no importa effectiveAddons ni ADDON_REQUIRES» | estado contra `enabled`/`requires`; estático, de identity solo tipos |
| R23 | «R23: cada interruptor es un switch con nombre Prender o Apagar y responde a teclado» | nombres, Espacio y Enter |
| R24 | «R24: clases mobile-first: Switch junto al nombre y botones a todo el ancho bajo md» | rejilla, posición del Switch, 44 px, botones `w-full`; manual 390/768 px pendiente del humano |
| R25 | `e2e/maestro-modulos.spec.ts` «R25: el Maestro prende y apaga Proveedores y el menú del Administrador lo sigue» | dos contextos, recarga sin volver a entrar; verde en Chromium y WebKit según la bitácora |

### Veredicto

**OK** — 0 bloqueantes, 4 menores (m1–m4). Antes del merge hay que marcar T6 (tras la verificación
manual del humano a 390/768 px) y T7 en `tasks.md`; m2–m4 pueden ir en esta ficha o quedar como deuda.
