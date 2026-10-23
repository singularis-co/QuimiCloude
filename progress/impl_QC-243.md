# QC-243 — bitácora de implementación (plantillas-whatsapp-frontend)

Implementer, 2026-10-22. Worktree `.worktrees/QC-243-plantillas-whatsapp-frontend`, rama
`feature/QC-243-plantillas-whatsapp-frontend`. Todo delegado en `frontend_dev`: la feature es solo
frontend y consume las Server Actions de QC-242 sin cambios. Decisiones del humano: P1 traducción
en el front, P2 sin descripción (R58), P3 relacionar solo local, y P4–P7 con su default.

## Commits (sin push: lo hace el leader)

| Commit | Tasks |
|---|---|
| `1518e3be` | T1, T2, T3: reglas puras, constantes (P1) y `WaBubble` |
| `663a59c8` | T4: pestañas y carga en paralelo |
| `fc5dcf83` | T5, T6, T7, T11: sincronización, listado, interruptor, eliminar y pestaña Variables |
| `557c7b21` | T8, T9 y el sheet de T10: alta, duplicar, relacionar (autónomo); `whatsapp-page.test.tsx` pasa a `setupUser` |
| `55a79ca7` | T12 y el enganche de T10; `FormSheet.showCloseButton`; WhatsApp como 13.ª consumidora de `DataTable` |
| `a3d9cfe5` | T13: E2E |
| `0e39b330` | T14: Popover del motivo (respaldo de design.md §8), prueba de R37 y corrección de R60 |

## Archivos

Creados, en `app/(private)/integraciones/whatsapp/components/`:
- `whatsapp-system-constants.ts`
- `whatsapp-template-rules.ts`
- `whatsapp-variable-rules.ts`
- `wa-bubble.tsx`
- `whatsapp-templates-panel.tsx`
- `whatsapp-template-sync-bar.tsx`
- `whatsapp-template-table.tsx`
- `whatsapp-template-status.tsx`
- `whatsapp-template-usage.tsx`
- `whatsapp-template-delete-dialog.tsx`
- `whatsapp-template-form-sheet.tsx`
- `whatsapp-template-variable-menu.tsx`
- `whatsapp-template-relate-sheet.tsx`
- `whatsapp-variables-panel.tsx`
- `whatsapp-variable-form-sheet.tsx`

Modificados en la app:
- `app/(private)/integraciones/whatsapp/page.tsx`
- `components/whatsapp-integration-tabs.tsx`
- `components/shared/form-sheet.tsx`: prop opcional `showCloseButton`, paso 2 de la regla de decisión. Los usos actuales no cambian. Da una X «Cerrar» de 44 px en lugar de la X «Close» `icon-sm`.
- `components/shared/CATALOGO.md`: fila de `FormSheet`.

Tests nuevos, en `tests/unit/integraciones-ui/`:
- `whatsapp-template-rules.test.ts`
- `whatsapp-variable-rules.test.ts`
- `wa-bubble.test.tsx`
- `whatsapp-templates-panel.test.tsx`
- `whatsapp-template-form-sheet.test.tsx`
- `whatsapp-template-relate-sheet.test.tsx`
- `whatsapp-variables-panel.test.tsx`
- `whatsapp-variable-form-sheet.test.tsx`
- `whatsapp-textos.test.ts`

Tests modificados:
- `tests/unit/integraciones-ui/whatsapp-page.test.tsx`
- `tests/unit/shared/data-table-alcance.test.ts`: la pantalla de WhatsApp entra como 13.ª consumidora autorizada, con nota que cita la fila «Listado de plantillas» de design.md.
- `tests/guards/guard-identificador-de-request.test.ts`: alta del spec nuevo en `E2E_ESPERADOS`.

E2E:
- `e2e/integraciones-whatsapp-plantillas.spec.ts`: nuevo.
- `e2e/integraciones-whatsapp.spec.ts`: solo cambia la aserción de la pestaña.

Sin cambios en `lib/`, `db/`, `package.json` ni el lockfile. Ninguna dependencia nueva.

## Mapa R → test

Rutas: `U/` es `tests/unit/integraciones-ui/`, `E2E-P` es `e2e/integraciones-whatsapp-plantillas.spec.ts` y `E2E-W` es `e2e/integraciones-whatsapp.spec.ts`.

| R | Test |
|---|---|
| R1–R6 | `U/whatsapp-page.test.tsx`: casos «QC-243 R1» … «QC-243 R6». Para R4 siguen verdes los casos de QC-237. R2 también en E2E-W |
| R7 | `U/whatsapp-template-rules.test.ts` (fecha con zona fija, `null` → marca) y `U/whatsapp-templates-panel.test.tsx` «R7: …» |
| R8, R9 | `U/whatsapp-templates-panel.test.tsx` «R8: …» y «R9: …» |
| R10, R11 | `U/whatsapp-templates-panel.test.tsx` y `U/whatsapp-template-rules.test.ts` (tonos y textos) |
| R12 | `U/whatsapp-templates-panel.test.tsx` «R12: con 760 px o menos, tarjeta…» |
| R13 | `U/whatsapp-templates-panel.test.tsx`, tres casos: nombre accesible y globo al enfocar; motivo como texto en la tarjeta; Popover al pulsar y con Enter. En E2E-P, caso de teléfono: step «R13» (texto en la tarjeta) y step «R13, R60» (tablet horizontal táctil, `tap()` sobre el «!» abre el Popover) |
| R14 | `U/whatsapp-templates-panel.test.tsx` «R14: …» (interruptor, «Sin relacionar», «No compatible»; «Relacionar» abre el panel de relación) |
| R15 | `U/whatsapp-template-rules.test.ts` «R15: …» (contenido vacío, variable con nombre, `{{n}}`, clave relacionada) |
| R16 | `U/whatsapp-templates-panel.test.tsx` «R16: …»: llamada, aviso, y vuelta atrás si hay error |
| R17–R20 | `U/whatsapp-templates-panel.test.tsx` «R17: …» … «R20: …» |
| R21–R27, R29–R31, R33–R36 | `U/whatsapp-template-form-sheet.test.tsx` «R<n>: …». R34: forma exacta del borrador, con `header: null`, `buttons: []`, claves con punto (P1) y `constantLabels`. R27 y R34 también en E2E-P, step «R27, R34» |
| R28 | `U/whatsapp-template-form-sheet.test.tsx` «R28: …»: el borrador se conserva y la variable nueva está en el menú |
| R32 | `U/wa-bubble.test.tsx` «R32: …» y `U/whatsapp-template-rules.test.ts` (`dictionaryOf`) |
| R37 | `U/whatsapp-textos.test.ts`: recorre todos los `*_TEXTS` de diálogos y paneles de alta, relación y variable. También en los casos R37 de form-sheet, relate-sheet, variable-form-sheet y variables-panel |
| R38 | `U/whatsapp-template-form-sheet.test.tsx` y `U/whatsapp-template-relate-sheet.test.tsx` (< 768 px con pestañas), y E2E-P step «R38» (390 × 844, WebKit y Chromium) |
| R39 | `U/wa-bubble.test.tsx` «R39: …»: clase de animación y `motion-reduce` |
| R40 | `U/whatsapp-template-rules.test.ts` (`draftFromView`) y `U/whatsapp-template-form-sheet.test.tsx` «R40: …» |
| R41 | `U/whatsapp-templates-panel.test.tsx` «R41: …» |
| R42–R45 | `U/whatsapp-template-relate-sheet.test.tsx` «R42: …» … «R45: …». R44 también en `U/wa-bubble.test.tsx` |
| R46 | `U/whatsapp-template-relate-sheet.test.tsx` «R46: …» (pares con clave con punto, éxito y error) y `U/whatsapp-templates-panel.test.tsx` «R46: …» (enganche, fila con interruptor y fundido) |
| R47–R49, R59 | `U/whatsapp-variables-panel.test.tsx` «R47: …», «R48: …», «R49: …» (sin columna Descripción, por P2) y «R59: …» |
| R50–R58 | `U/whatsapp-variable-form-sheet.test.tsx` «R50: …» … «R58: …». R51, R52 y R57 también en `U/whatsapp-variable-rules.test.ts`. R50, R51 y R54 también en E2E-P, step «R50, R54» |
| R60 | `U/whatsapp-template-form-sheet.test.tsx`, `U/whatsapp-variable-form-sheet.test.tsx` y `U/whatsapp-variables-panel.test.tsx` «R60: …» (44 px y 16 px), y E2E-P (44 × 44 del «!»). La revisión control por control está abajo |
| R61 | E2E-P, step «R61»: crear → «Pendiente» → POST firmado al webhook con APPROVED → «Aprobada» |
| R62 | Comprobación del diff: `git diff --name-only $(git merge-base HEAD origin/dev)...HEAD`, filtrado por `^(lib/modules/\|db/\|lib/composition/\|package.json\|pnpm-lock)`, no devuelve nada (grep rc=1) |

### Revisión de R60

Cada control interactivo nuevo usa `touch`, `touchTarget` o `min-h-11`, y los campos de texto miden `text-base` (16 px).

- **Corregido en T14:** «Nueva variable» medía 36 px desde 768 px.
- **Interruptor de uso:** lleva `md:min-h-11`, porque el `Switch` del catálogo baja a 36 px en escritorio.
- **Puntero:** no hay `group-hover`, `opacity-0` ni `onMouseEnter`. El motivo del rechazo ya no depende del puntero: se puede leer en el nombre accesible, como texto en la tarjeta o en el Popover.

## Salida real de la verificación (cierre, sobre HEAD `0e39b330`)

```
pnpm run typecheck                        -> tsc --noEmit, rc=0
pnpm run lint                             -> 10 problems (0 errors, 10 warnings), ninguno en archivos de QC-243
pnpm exec vitest related --run <diff .ts/.tsx sin e2e>
                                          -> Test Files 226 passed (226) · Tests 3952 passed | 3 skipped
pnpm exec vitest run guard                -> Test Files 87 passed (87) · Tests 1276 passed | 22 skipped
pnpm exec playwright test e2e/integraciones-whatsapp-plantillas.spec.ts e2e/integraciones-whatsapp.spec.ts --workers=1
                                          -> 8 passed (1.3m): chromium 4/4, webkit 4/4
```

`vitest related` arrastra 226 archivos porque el diff toca `components/shared/form-sheet.tsx`.

## `./init.sh` no queda verde, y no es por esta feature

`./init.sh` (modo rápido) **no llega a los tests**: se para en el validador de `feature_list.json`.
Lee `../../feature_list.json`, la copia local sin versionar del checkout principal, y ahí encuentra:
- fichas de otro board: QT-290, QT-291, QT-292;
- ids duplicados: 290, 291, 292;
- features en vuelo sin assignee: QC-162, QC-166, QC-262, QC-263, QC-264, QT-291.

Es estado del board o de la última importación (F0), que corresponde al leader. Por eso corrí a mano
las mismas fases que cubre el gate rápido; su salida está en el bloque de arriba.

## Supuestos y cosas para el reviewer

1. **T11:** la pestaña Variables usa `Table` del catálogo y no `DataTable`, aunque la fila «Pestaña Variables» de design.md dice `DataTable`. `DataTable` siempre pinta paginación y barra de filtros, y el tablero no trae ninguna de las dos. La lista de propias pasa a tarjetas por debajo de `md`.
2. **`FormSheet.showCloseButton`:** extensión de una pieza compartida (paso 2), con su fila del catálogo. Quitarla devuelve la X «Close» de `SheetContent`, que mide menos de 44 px.
3. **R13, el Popover complementa al Tooltip:** el Tooltip sigue abriéndose con puntero y foco, y el Popover se abre al tocar, con clic o con teclado. Lo prevé design.md §8 para el caso confirmado en el E2E: el globo no se abre al tocar (WebKit y Chromium táctiles).
4. **Textos que no fija ni el spec ni el tablero.** Siguen el patrón del repo:
   - títulos del `ErrorState` de las pestañas: «No se pudo cargar la lista de plantillas.» y «… de variables.»;
   - vacío de propias: «Todavía no hay variables propias.»;
   - hora fija «09:41» en la burbuja, la del tablero;
   - avisos «Falta relacionar el hueco Encabezado {{1}}.» para los huecos que no son del cuerpo.
5. **R37, alcance literal:** diálogos de confirmación y paneles de alta, relación y variable. La barra de sincronización, la tabla («Estado en Meta») y la intro de la pestaña Variables nombran a Meta porque lo pide el tablero, y quedan fuera del test.
6. **Alta:**
   - un pie vacío se envía como `footer: null`;
   - `constantLabels` solo lleva las constantes usadas (R34), así que queda `{}` si no se usa ninguna;
   - si el envío falla, el diálogo se cierra y el error sale arriba del panel, con el borrador intacto (R36).
7. **Variable:** el valor se envía sin recortar, y «cambia» compara el texto exacto (R56 y R57).
8. **Fila recién relacionada:** el fundido se aplica a las celdas de nombre, estado y uso, porque `DataTable` no admite clases por fila.
9. **Si falla la consulta de la conexión,** Plantillas queda deshabilitada con la pista de R2. El spec no cubre ese caso.

## Entorno

- **Dependencias del worktree:** no traía `node_modules`. Se instalaron con `pnpm install --frozen-lockfile`, más `prisma generate` y `next typegen`; ni `package.json` ni el lockfile cambiaron.
- **`.env` del E2E:** el worktree no tiene `.env`. Los E2E se corrieron cargando `../../.env` solo en la shell, sin copiar archivos.
- **Disco:** C: está casi lleno (0–190 MB libres). Con varios workers de Playwright los navegadores se caían, así que los E2E se corrieron con `--workers=1`.
