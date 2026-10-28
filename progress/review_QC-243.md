# QC-243 — plantillas-whatsapp-frontend · revisión

Reviewer, 2026-10-22. Vuelta 1, trazabilidad completa. Rango: `e5ef652d..HEAD` (`8ab6fc3a`), es decir,
los cambios de implementación desde `1518e3be`. Worktree `.worktrees/QC-243-plantillas-whatsapp-frontend`.

## Verificación ejecutable (corrida por el reviewer)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | rc=0 |
| `pnpm run lint` | 0 errores y 10 warnings, todos en archivos ajenos a la feature (`step-evidence`, `list-execution-traces`, `confirm-catalog-import`, `order-service`) |
| `pnpm exec vitest run tests/unit/integraciones-ui tests/unit/shared/data-table-alcance.test.ts` | 19 archivos y 320 tests en verde. Los 2 skipped son de `data-table-alcance` («fuera de la rama de QC-56»), ya existían |
| `pnpm exec vitest run guard` | 87 archivos en verde: 1276 tests pasados y 22 skipped |
| `pnpm exec playwright test e2e/integraciones-whatsapp-plantillas.spec.ts e2e/integraciones-whatsapp.spec.ts --workers=1` | 8 passed (1.6 min), chromium y webkit |
| R62: `git diff --name-only <merge-base dev>...HEAD \| grep -E '^(lib/\|db/\|package.json\|pnpm-lock)'` | vacío (rc=1). Tampoco hay nada en `lib/` dentro de `e5ef652d..HEAD` |

No conté `./init.sh` porque se para en el validador de `feature_list.json` por el estado del board, que no tiene que ver con esta feature (lo indica el leader). Corrí a mano las fases equivalentes. No usé el grafo de código: para un diff que solo toca una ruta, me bastaron Read y Grep.

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con R1–R62 en EARS.
- [x] `design.md` con alternativas descartadas (§13, siete).
- [x] `tasks.md`: T1–T14 marcadas `[x]`; no queda ninguna sin marcar.
- [x] `design.md` abre con `## Lo que ya existe`, con la búsqueda hecha. El diff no re-crea nada de esa lista: consume QC-242 tal cual desde el barrel y las acciones, extiende `whatsapp-integration-tabs.tsx` y no importa `relative-time.ts` ni `usernameFromNames`.
- [x] Equipo: hay assignee (Christian Quevedo) en `progress/features/QC-243.md`, y la ficha se tomó con `trello.mjs tomar` más el worktree. No lo verifiqué contra el tracker.
- [x] Trazabilidad: cada R tiene un test concreto (ver abajo) y el mapa está en `progress/impl_QC-243.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: queda pendiente del PR, no aplica en esta fase.
- [x] Flujo crítico: la feature toca permisos (la página exige `integraciones.modificar`) y un webhook (R61). El E2E de Playwright lo cubre y su salida está en la bitácora. Yo también lo corrí.
- [x] Sin dependencias nuevas: `package.json` y el lockfile no cambian.
- [x] Sin secretos ni configuración hardcodeada. El E2E firma el webhook con el App Secret que él mismo escribe.
- [ ] Verificación final (`init.sh`, cierre, desmontar el worktree): corresponde a F3, fuera de esta revisión.

### docs/checkpoints-proyecto.md
- [x] typecheck y lint en verde.
- [x] El E2E del flujo crítico es de Playwright.
- [x] Multiplataforma:
  - controles con `touch`, `touchTarget` o `min-h-11`;
  - inputs con `text-base`: `TextField` lo trae por defecto y `Textarea` lo lleva explícito;
  - sin `100vh`, sin `hover:` como única vía y sin `onMouseEnter`;
  - el motivo del rechazo se puede leer sin puntero (nombre accesible, texto en la tarjeta y Popover). El caso táctil está probado en WebKit.
- [x] Catálogo: la extensión de `FormSheet` (`showCloseButton`) tiene su fila al día en el mismo commit (`55a79ca7`).
- [x] Pase `/design`: hay siete tableros en `docs/diseno/canvas/`, citados en `design.md > 1`. La única pieza visual nueva es `WaBubble`, que vive en la ruta y tiene tablero propio (`WaBurbuja.dc.html`). No hay pieza nueva en `components/shared`.
- [x] Datos y seguridad, módulos hexagonales: no aplican. No hay tablas, migraciones, dominio ni composition (R62). Los permisos y el ámbito de empresa los aplican las acciones de QC-242.
- [x] Permisos: la página sigue con `requirePagePermission('integraciones.modificar')`. Las mutaciones van por Server Actions, sin `fetch` a `/api`.

### Reglas del perfil (`docs/perfil-agentes.md > reviewer`, puntos 5–11)
- [x] 5. Calidad y seguridad: sin secretos, con las capas separadas. El front solo llama a las acciones.
- [x] 6. Multiplataforma: ver arriba.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: el diff no añade modelos ni consultas.
- [x] 9. Comentarios: ninguna línea de producción añadida cita `QC-`, `R<n>`, `design.md` ni «decisión cerrada». Las referencias a QC-243 están solo en tests y en la nota de `E2E_ESPERADOS` y `data-table-alcance`, que son tests y es lo esperado.
- [x] 10. Duplicados: ningún componente nuevo cubre una fila del catálogo. Se reutilizan `DataTable`, `Table`, `FormSheet`, `ConfirmDialog`, `DeleteConfirmDialog`, `Notice`, `EmptyState`, `StatusBadge`, `Tooltip`, `Popover` y `Select`.
- [x] 11. Diseño: no hay cambio visual en piezas compartidas. La X de 44 px de `FormSheet` es opcional y no se activa sola.
- [x] Regla 8 del frontend: los componentes van en `<ruta>/components/`; `index.ts` no cambia ni declara `'use client'`; `page.tsx` importa del barrel.

## Trazabilidad R → test

La comprobé leyendo los tests, no solo la bitácora. Cada caso lleva `R<n>` en el nombre y tiene aserciones reales; ninguno es un `it.skip` ni un `todo`.

| R | Test |
|---|---|
| R1–R6 | `whatsapp-page.test.tsx` «QC-243 R1…R6». En R5 se comprueba `router.refresh` al entrar en Plantillas y Variables, y que al volver a Conexión no se llama. R2 está también en el E2E de `integraciones-whatsapp.spec.ts` |
| R7–R20 | `whatsapp-templates-panel.test.tsx`, con un caso por R, más `whatsapp-template-rules.test.ts` para R7, R11 y R15. R12 comprueba los campos de la tarjeta y el menú «Acciones». R13 tiene tres casos más dos steps del E2E (texto en la tarjeta y toque en el «!») |
| R21–R36, R38, R40 | `whatsapp-template-form-sheet.test.tsx`. R34 comprueba la forma exacta del borrador: `header: null`, `buttons: []`, claves con punto y `constantLabels`. R27, R34 y R38 también están en el E2E |
| R32, R39, R44 | `wa-bubble.test.tsx`; R32 también en `dictionaryOf` |
| R37 | `whatsapp-textos.test.ts` (recorre los `*_TEXTS`), más los casos R37 de cada panel |
| R41 | `whatsapp-templates-panel.test.tsx` «R41» |
| R42–R46 | `whatsapp-template-relate-sheet.test.tsx`. R46 también en panel (fila con interruptor y fundido) |
| R47–R49, R59 | `whatsapp-variables-panel.test.tsx` |
| R50–R58 | `whatsapp-variable-form-sheet.test.tsx`, y `whatsapp-variable-rules.test.ts` para R51, R52 y R57. R50, R51 y R54 también en el E2E |
| R60 | Tres tests de componente (44 px y 16 px) y el E2E (el «!» de 44 × 44 al tocar) |
| R61 | E2E, step «R61»: crear → «Pendiente» → POST firmado APPROVED → «Aprobada». Lo corrí en verde |
| R62 | Comprobación del diff, como fija `design.md > 11`; la hice yo (tabla de arriba) |

## Supuestos del implementer: qué concluyo de cada uno

1. **`Table` en vez de `DataTable` en Variables.** Lo acepto: es el paso 1 de la regla de decisión, porque `Table` está en el catálogo, así que no es un duplicado. `DataTable` siempre pinta paginación y la barra de filtros, y el tablero `PlantillasWhatsappVariables` no trae ninguna de las dos. Además, añadir `DataTable` habría subido otra vez la lista cerrada de `data-table-alcance`. Pero se aparta de la fila «Pestaña Variables» de `design.md` sin que el spec lo recoja (**menor M1**).
2. **`FormSheet.showCloseButton`.** Es un paso 2 correcto: la prop es opcional y se pasa tal cual a `SheetContent`, cuyo valor por defecto es `true`. Los consumidores actuales no cambian y la fila del catálogo está al día. No hay test propio de la pieza compartida: solo lo cubre de forma indirecta el «Cerrar» de `whatsapp-variable-form-sheet.test.tsx` (**menor M2**).
3. **Altas en listas cerradas.**
   - `data-table-alcance.test.ts`: la decimotercera consumidora está respaldada por la fila «Listado de plantillas» del `design.md` aprobado, que dice «reutiliza `DataTable`». El ancla sube de forma coherente (`> 12`) y el mensaje se actualizó.
   - `E2E_ESPERADOS`: darse de alta es el punto de extensión de esa lista y la nota dice qué ejercita el spec.

   Las dos son legítimas.
4. **Popover de respaldo en R13.** Es lo que prevé `design.md > 8` si el globo no abre al tocar, y el E2E en WebKit con `hasTouch` lo confirma. El Tooltip sigue abriendo con puntero y con foco, y se desactiva mientras el Popover está abierto. Cumple R13 y R60.
5. **Textos que no fijan ni el spec ni el tablero.** Son razonables y siguen el patrón del repo:
   - los títulos de `ErrorState`;
   - «Todavía no hay variables propias.»;
   - la hora «09:41» del tablero;
   - «Falta relacionar el hueco Encabezado {{1}}.».

   No contradicen ningún literal. En cambio, los literales de R55, R56 y R59 con N = 1 quedan en plural («Lo usan 1 plantillas», «la usan 1 plantillas», «se envía en 1 plantillas») (**menor M3**).
6. **Alcance de R37.** El literal de R37 limita la regla a «diálogos de confirmación y paneles de alta, relación y variable». La barra de sincronización, la columna «Estado en Meta», el aviso de sin relacionar y la intro de Variables están fuera de esos paneles, y son literales de R7, R10, R17 y R47 tomados del tablero. La lectura es correcta. El test lo hace explícito, con un caso de control que demuestra que el detector sí encuentra «Meta».
7. **R62.** Lo verifiqué: no se tocan `lib/modules`, `db`, `lib/composition`, `package.json` ni el lockfile.
8. **Decisiones P1–P7 de F1.4.**
   - P1: la traducción vive solo en `whatsapp-system-constants.ts` (`toBackendText`, `toDisplayText`, `toBackendKey` y `displayKeyOf`), y R34 y R46 prueban las claves con punto.
   - P2: no hay campo ni columna de descripción en las propias.
   - P3: relacionar solo llama a `relateWhatsappTemplateVariablesAction`.
   - P4–P7: siguen el default (sin tipo de sincronización, los motivos de P5, el aviso de P6 y `EMPTY_MARK` para P7).

## Hallazgos

- **M1 · menor.** `design.md > Componentes`, fila «Pestaña Variables y panel de variable», dice que compone `DataTable`, pero la implementación usa `Table`. El motivo está bien (ver supuesto 1), pero solo consta en la bitácora. Conviene anotarlo en `progress/features/QC-243.md > Cierre`, o en una nota del `design.md`, para que el spec no diga algo distinto del código.
- **M2 · menor.** `components/shared/form-sheet.tsx` gana `showCloseButton` sin un test de la pieza compartida. Haría falta uno que compruebe dos cosas: que por defecto sigue la X de `SheetContent` y que con `false` desaparece. Hoy esto se sostiene en la lectura del código (el valor por defecto es `true` en `components/ui/sheet.tsx:81`) y en el test de la ruta.
- **M3 · menor.** Faltan los singulares con N = 1 en `valueHintInUse` y `confirmDescription` (`whatsapp-variable-form-sheet.tsx`) y en `deleteBlocked` (`whatsapp-variables-panel.tsx`): salen «1 plantillas». El spec y el tablero solo dan la forma «N plantillas», así que no incumple ningún requisito. R17 sí distingue singular y plural. Si se corrige, es un ajuste de texto, y se puede dejar como deuda.

Ningún bloqueante.

## Veredicto

**OK.** No hay bloqueantes; quedan 3 menores (M1–M3) que no impiden pasar a F3.
