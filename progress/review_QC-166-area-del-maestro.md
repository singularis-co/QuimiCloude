# Review QC-166 — area-del-maestro (F2.2, vuelta 1)

Rama `feature/QC-166-area-del-maestro` en `db3d52ea`, diff contra `origin/dev` (`aa1ed9d7`,
merge-base = `origin/dev`, `git fetch` hecho). 91 archivos, sin `package.json`, sin
`db/schema.prisma`, sin migraciones, sin servidor.

El grafo no tiene proyecto para este worktree (lo anotó también el implementer): exploración con
Grep/Read.

## Verificación ejecutada por el reviewer

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | verde (exit 0) |
| `pnpm run lint` | 0 errores, 10 warnings, todos en archivos ajenos al diff (`step-evidence.tsx` y tres tests) |
| `pnpm exec vitest run guard` | 80 archivos, 1096 pass / 20 skip / 0 fail |
| Los 32 tests añadidos o tocados por el diff | 32 archivos, 448 pass / 5 skip (los `ctx.skip` condicionales preexistentes de `account-status-scope` y `data-table-alcance`) |
| `vitest related` sobre todos los archivos del diff | cortado por el `timeout 900` bajo carga (se solapó con el barrido siguiente); sustituido por la fila anterior y las dos siguientes |
| Tests que leen del disco y que `related` no elige (95 de `tests/unit|ui` con `readdirSync`/`walkCodeFiles` que nombran `app`, `e2e`, `components` o `lib`) | **94 pass, 1 FAIL: `tests/unit/identity/roles/maestro-rol.test.ts` R17** (ver B1) |
| Resto de tests que leen fuentes por ruta (`CATALOGO.md`, `routes.ts`, `private-nav.ts`, `e2e/`…; 36 + 61 archivos) | 97 archivos, 1358 pass, 0 fail |
| E2E `maestro-acceso` + `maestro-administradores` (chromium) | 5 passed (ver sección «E2E») |

`tests/baseline-rojos.json` no lista `maestro-rol.test.ts`, y los cuatro archivos que denuncia
son todos de este diff: el rojo es NUEVO y lo pondría `gate-completo` en rojo en el PR.

## Checklist

### Especificación
- [x] `requirements.md` con R1–R49 en EARS (R34 enmendado; decisiones del 2026-10-16 registradas).
- [x] `design.md` con `## 9. Alternativas descartadas`.
- [x] `tasks.md`: T1–T12 (incl. T10b) todas `[x]`.
- [x] `design.md` abre con `## Lo que ya existe` con búsqueda real; el diff no re-crea nada de lo
      listado (reutiliza `DataTable`, `FormSheet`, `ConfirmDialog`, `CountrySelect`, `UrlTabs`,
      `homeHrefFor`, `AppSidebar` sin tocar su código).

### Equipo
- [x] Rama publicada con `wt.sh new` (commit `8974ae19` «feature tomada por ArqDev»). La tabla de
      `progress/features/QC-166.md` sigue diciendo `assignee: sin asignar` / `pending` (menor m9).

### Trazabilidad
- [x] Mapa consolidado R1–R49 → test en `progress/impl_QC-166.md > T12`. Comprobado por script:
      cada `R1`…`R49` aparece en el nombre de al menos un `it`/`test` de los archivos del diff, y
      los tests leídos (navegación, acceso, E2E, fix de T4) afirman de verdad lo que nombran.
- [x] E2E paga el diferido: QC-161 (aterrizaje del Maestro, solo «Plataforma», ERP → 404, usuario
      de empresa → 404, cierre de sesión: `maestro-acceso.spec.ts`), QC-162 (alta con
      Administrador inicial, baja con nombre erróneo/correcto, filtro «De baja», reactivación,
      Historial, sesión cortada: `maestro-empresas.spec.ts`), QC-235 (cambio de país visto en la
      columna País: `maestro-empresas.spec.ts` paso 2), QC-165 (alta eligiendo empresa, edición con
      empresa fija, reenvío solo en pendiente con aviso `sent|failed`, último no se da de baja, baja
      del que no es el último: `maestro-administradores.spec.ts`).

### Calidad de código
- [x] typecheck, [x] lint (0 errores).
- [ ] **`gate-completo` en verde: NO lo estará** — `maestro-rol.test.ts` R17 rojo nuevo (B1).
- [x] Flujo crítico (permisos, autenticación) con E2E de Playwright y salida en la bitácora.
- [x] Sin dependencias nuevas.

### Seguridad / Configuración
- [x] Sin secretos ni URLs hardcodeadas; el E2E toma el Maestro de `SEED_MAESTRO_*`.
- [x] Sin webhooks.

### Proyecto (`docs/checkpoints-proyecto.md`)
- [x] Multiplataforma: sin `100vh`/`h-screen`, sin activación solo por `:hover`, disparadores de
      44 px (tests de R16, R28, R31, R42), campos con `TextField`/`SelectField` del catálogo.
- [x] Catálogo: `AdministratorFields` y `ADDON_NAMES` con su fila y `Diseño`; ajustada tras
      `270e92c2` (teléfono y documento obligatorios).
- [x] Pase `/design`: tableros en `docs/diseno/canvas/` y citados en `design.md > 2`.
- [x] Sin tablas nuevas → no aplica RLS ni columna de empresa.
- [x] Permisos: las tres páginas cortan con `requirePagePermission('empresas.consultar')` en la
      primera línea (test que lo fija); la escritura la autoriza el caso de uso de QC-162/QC-165
      (`empresas.modificar`); `canModify` solo decide qué se pinta.
- [x] Mutaciones por Server Actions existentes; datos por props / acciones de lectura (patrón
      `user-sheet`).
- [x] Hexagonal: `lib/shared/ui/addon-names.ts` no importa dominio (claves propias igualadas por
      test de tipos); nada nuevo en la raíz de `lib/`.

### Reglas del reviewer (perfil, 5–11)
- [x] 5 Calidad y seguridad. [x] 6 Multiplataforma. [x] 7 Dependencias (no toca `package.json`).
- [x] 8 Aislamiento por empresa (no aplica: sin modelos ni consultas nuevas).
- [ ] **9 Comentarios: un comentario añadido en producción cita `design.md`** (B2).
- [x] 10 Duplicados: cada pieza nueva declara su paso de la regla de decisión en `design.md`.
- [x] 11 Diseño: referencia en `design.md` y en la celda `Diseño`.

### Puntos pedidos por el leader
1. **Los 10 tests que T1 ajustó no se aflojaron.** Cada centinela de lista exacta sigue siendo
   exacta y se TENSA (11→13 entradas, 13→15 enlaces, 26/28→29 pantallas, cinco→seis secciones,
   lista cerrada de rutas de recetas con los tres nombres). `login-action` cambia la expectativa
   QC-161 R33 («respaldo, ningún enlace pide `empresas.*`») por R4 (`MAESTRO_COMPANIES_ROUTE`), que
   es justo lo que QC-161 R33 preveía. `private-nav-integraciones` «el grupo es el último del
   array» pasa a «último de Configuración; detrás solo Plataforma», que conserva la intención
   (nada del ERP detrás del grupo). Además se añaden casos nuevos de R2/R3/R5. OK.
2. **Guardias de lista cerrada.** `data-table-alcance`: entran `/maestro/empresas` y
   `/maestro/administradores` nombradas una a una, el ancla de consumidores se tensa a `> 11` y el
   mensaje nombra las doce. `account-status-scope`: entra un solo archivo,
   `administrator-columns.tsx`, con su motivo; `administrator-list-params.ts` deja de nombrar el
   estado. `guard-identificador-de-request`: los tres E2E dados de alta uno a uno. Las tres
   correctas. **Pero falta una cuarta lista cerrada que el diff toca: `maestro-rol.test.ts`
   `RUTAS_ABIERTAS_EMPRESAS` (B1).**
3. **Fix de T4** (`a2563b66`): correcto (se omiten las claves vacías para que no tapen el
   `?? DOCUMENT_TYPE_CODES[0]`), con test de regresión que afirma `adminDocumentTypeCode` del
   `FormData` sin tocar el select. El alta de Administrador no tiene el mismo fallo
   (`defaultValues={}` en el alta; test de `administrator-sheet` líneas 193 y 261). OK.
4. **Desvíos menores**, clasificados abajo (m1–m5): ninguno incumple un requisito; dos se apartan
   del tablero aprobado y quedan para el humano.
5. **Tests de disco que el gate rápido no elige:** corridos 192 (ver tabla). Uno rojo: B1.

## Hallazgos

### BLOQUEANTE

- **B1. `tests/unit/identity/roles/maestro-rol.test.ts` > R17 en rojo, nuevo, no está en el
  baseline.** El barrido exige que `empresas.consultar`/`empresas.modificar` solo aparezcan en el
  catálogo y en `RUTAS_ABIERTAS_EMPRESAS`, y el diff los nombra en cuatro archivos de producción:
  `lib/shared/navigation/private-nav.ts`, `app/(private)/maestro/empresas/page.tsx`,
  `app/(private)/maestro/empresas/[id]/page.tsx` y `app/(private)/maestro/administradores/page.tsx`.
  El gate rápido no lo ve (`vitest related` no lo selecciona: lee del disco) y por eso `init.sh`
  salió verde; `gate-completo` lo pondrá rojo. Qué falta: abrir en `RUTAS_ABIERTAS_EMPRESAS` esas
  cuatro rutas exactas con su bloque «Enmienda QC-166» (mismo trato que QC-162/QC-165/QC-277: el
  menú declara el permiso del enlace y las páginas cortan con él), mantener el anti-cegado
  (`toEqual` exacto), y anotarlo en `design.md` junto a las otras listas cerradas que toca la
  ficha. Volver a correr el archivo.
- **B2. Comentario que cita `design.md` en una línea añadida de producción** (regla 9 del perfil):
  `app/(private)/maestro/administradores/components/administrator-columns.tsx:32-33`
  «…y solo este archivo lo pinta (`design.md > 5.2`).» (entró con `c4d7d07c`). Qué falta: quitar
  la cita y dejar solo el motivo. Es la única cita de `QC-`/`R<n>`/`design.md` en líneas añadidas
  de `app/`, `lib/` y `components/`.

### menor

- **m1. `<Suspense>` de la lista de empresas sin `key={query}`** (`design.md > 3.3` lo pide con
  `key`). **Aceptable:** R15 (esqueleto mientras carga) se cumple en la primera carga; en las
  navegaciones la tabla queda con `aria-busy` dentro de `startTransition`, que es el patrón de
  `clientes/page.tsx` y conserva el foco de la búsqueda. Falta solo poner `design.md > 3.3` al día.
- **m2. Aviso de la baja de empresa encima de las cifras** (el tablero `ModalesMaestro` pone
  cifras → aviso → campo). **Desvío del tablero, no de R23** (que no fija orden). La justificación
  («`ConfirmDialog` no deja otro orden sin extenderlo») no es del todo cierta: el aviso podría ir
  en `children`, delante del `TextField`, y la cifra seguiría en `aside`. Decide el humano si se
  acepta o se reordena.
- **m3. Miga del detalle «Empresas › <nombre>»** (el tablero pinta solo «Empresas ›»).
  **Aceptable:** R27 se cumple (miga «Empresas» enlazada a la lista) y es la convención del repo
  (`producto-terminado/[id]`: «Inventario › Producto terminado › <nombre>»); `PageHeader` marca el
  último paso como actual.
- **m4. Diálogos sin el icono del tablero.** El implementer anota el de correo del reenvío; el
  tablero también pinta icono en la baja de empresa (`dlg-ic danger`) y en la de Administrador, y
  tampoco salen. **Desvío visual del tablero, no de requisito** (R39, R46 no lo piden).
  `ConfirmDialog` se apoya en `AlertDialog`, que ya trae `AlertDialogMedia`: extenderlo con una
  prop `icon` es el paso 2 de la regla de decisión. Decide el humano (aquí o deuda).
- **m5. Placeholder de Fecha de nacimiento `aaaa-mm-dd`** frente a `dd/mm/aaaa` del tablero.
  **Aceptable:** coincide con lo que pinta `DatePicker` (`YYYY-MM-DD`) y no hay requisito que fije
  el formato del campo (la pregunta abierta 2 trata de cómo se pintan las fechas en lista e
  Historial, y ahí sí se usa `dd/mm/aaaa`). Queda la incoherencia visual campo/lista para el
  humano o una ficha de `DatePicker`.
- **m6. `design.md` no recoge dos decisiones del 2026-10-16:** `> 2.1/2.2` solo declara como
  obligatoria la fecha de nacimiento (ya son también teléfono y documento), y `> 3.3`/§ 6 siguen
  sin decir que el detalle no lleva esqueleto. `requirements.md` sí está al día.
- **m7. `docs/diseno/canvas/Sidebar.dc.html` cambia también la rama ERP** (`area="erp"`: secciones
  Operación/Cadena/Configuración, «Producción» como grupo, Usuarios en Operación) y ya no coincide
  con el menú del código (Seguimiento/Operación/Producción/Directorio/Configuración). No es de esta
  ficha; si es del rediseño, que lo recoja su ficha, para que nadie tome ese tablero como verdad
  del menú ERP actual.
- **m8. Archivo fuera de `tasks.md > Archivos esperados`:**
  `app/(private)/maestro/empresas/components/company-data-fields.tsx` (subcomponente interno que
  solo compone `TextField`; declarado en la bitácora). Aceptable.
- **m9. `progress/features/QC-166.md`**: la tabla de cabecera sigue con `assignee: sin asignar` y
  `estado: pending`, y «Preguntas abiertas: Sin acotar todavía»; `## Cierre` vacío (se rellena al
  cerrar). El leader lo pone al día.
- **m10. Revisión visual de `CountrySelect` a 1440/820/375 px** que QC-235 (m4 de su review) dejó
  «como tarde en QC-166»: no consta hecha. Es del humano.

## E2E

Corrido por el reviewer: `pnpm exec playwright test e2e/maestro-acceso.spec.ts
e2e/maestro-administradores.spec.ts --project=chromium` → **5 passed (26.1s)** (los cuatro casos de
R43 y el de R45). En local el buzón de correo falla («fallo al escribir el enlace en el buzon»), así
que el alta y el reenvío pasan por la rama `mail: 'failed'`, que el spec acepta a propósito
(`design.md > 10`). `maestro-empresas.spec.ts` (R44) no se volvió a correr: la salida del
implementer (Chromium y WebKit en verde) consta en `progress/impl_QC-166.md > T8`.

## Veredicto

**RECHAZADO** por B1 (rojo nuevo de `maestro-rol.test.ts` R17 que tumbaría `gate-completo`) y B2
(cita de `design.md` en un comentario de producción). Los dos son cambios pequeños y no tocan
comportamiento; el resto (trazabilidad R1–R49, E2E de los cuatro diferidos, guardias, tests
ajustados) está bien.

Decisiones humanas pendientes: m2 (orden del aviso de baja), m4 (iconos de los diálogos), m5
(formato del campo de fecha), m10 (revisión visual de `CountrySelect`), y aceptar m1/m3 como
desvíos del design/tablero.

## Vuelta 2 (acotada a db3d52ea..16a23491)

Revisado solo ese rango contra B1, B2 y los menores de la vuelta 1, más sus regresiones. 11 commits;
en código tocan `components/shared/confirm-dialog.tsx`, su fila de `CATALOGO.md`, los cuatro diálogos
del área, `administrator-columns.tsx` y `maestro-rol.test.ts`.

### Verificación ejecutada

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | verde |
| `pnpm run lint` | 0 errores; los mismos 10 warnings ajenos |
| `pnpm exec vitest run guard` | 80 archivos, 1096 pass / 20 skip |
| `vitest related` de `confirm-dialog.tsx` y de los archivos del rango (todos los consumidores de `ConfirmDialog`) | 275 archivos, 4689 pass / 1 skip, 0 fail |
| Barrido otra vez de los tests que leen del disco (148 de `tests/unit` y `tests/ui`; los de la vuelta 1 más los que leen fuentes por ruta), en tres tandas | 148/148 en verde. En la primera tanda, 4 se cortaron por el timeout de 20 s bajo carga (`clientes-convenciones`, `configuracion-convenciones`, `pdf-converter`, `catalogo-sin-total-fijo`); corridos solos: 4/4 en verde. **`maestro-rol.test.ts` en verde.** |
| Citas `QC-`/`R<n>`/`design.md` en líneas añadidas de `app/`, `components/` y `lib/` | ninguna |

### Estado de los hallazgos de la vuelta 1

- **B1 — resuelto** (`eb68f1c7`). Entran las cuatro rutas exactas en `RUTAS_ABIERTAS_EMPRESAS` con su
  bloque «Enmienda QC-166»; el anti-cegado sigue con `toEqual` exacto; el test pasa.
- **B2 — resuelto** (`62ec0f37`). El comentario se queda con el motivo, sin la cita.
- **m1, m3, m5, m6 — resueltos en `design.md`** (`54ad432c`, `c3270e2b`). Anotados como desvíos con
  su motivo; ya figuran teléfono y documento obligatorios y el detalle sin esqueleto.
- **m2 — resuelto** (`1d1f10d4`). Nueva prop opcional `descriptionPlacement: 'header' | 'after-aside'`.
  Motivo dado para no usar `children` (`design.md`): moverlo dejaba la cabecera sin descripción o con
  el texto repetido. Es válido: así el aviso sigue siendo el `AlertDialogDescription`, y por tanto
  la descripción accesible del diálogo.
- **m4 — resuelto** (`6cf6341c`, `c34fc7e1`). Nueva prop opcional `icon` con `glyph`, `tone` y
  `testId`, pintada en `AlertDialogMedia`. La llevan las dos bajas, el reenvío y la reactivación. Los
  tokens de tono existen en `app/globals.css`. Hay tests en cada diálogo.
- **m9 — al día** en la ficha.
- **m10 — hecho** (`040bf0cb`). Hay 15 capturas en `progress/qc166-revision-visual/`; lo que salió
  va a las deudas D64 y D65. Aprobar las capturas sigue siendo cosa del humano.
- **m7 y m8**: sin cambios y siguen siendo aceptables; m7 es de otra ficha.

### ¿Las dos props nuevas de `ConfirmDialog` son aditivas?

**Sí.**
- `descriptionPlacement` vale `'header'` por defecto, y entonces `lateDescription` es `null`.
- Con `icon` en `undefined` no se pinta `AlertDialogMedia`.
- La descripción conserva su `data-testid` en las dos posiciones.

Ningún consumidor existente las pasa. `tests/unit/shared-ui/confirm-dialog-extension.test.tsx`
comprueba que, sin las props o con `'header'`, el árbol es idéntico, y cubre las tres disposiciones
con `after-aside` y los tonos del icono. Los 275 archivos relacionados están en verde.

### Hallazgos de la vuelta 2

- **B3 (BLOQUEANTE, regla 11 del perfil y `checkpoints-proyecto > Calidad`).** La fila de
  `ConfirmDialog` en `components/shared/CATALOGO.md` gana `icon` y `descriptionPlacement`, que son un
  cambio visual de una pieza compartida sacado de los tableros del Maestro. Sin embargo, la celda
  `Diseño` sigue en «previo al rediseño».
  - El repo sigue esta convención cuando extiende una pieza «previa»: `Avatar` con `tone` cita
    `Dominio.dc.html`, y `Checkbox` y `RowActionsMenu` citan el suyo.
  - Qué falta: poner en esa celda `docs/diseno/canvas/ModalesMaestro.dc.html` (icono y orden de la
    baja de empresa) y `docs/diseno/canvas/MaestroAdministradores.dc.html` (icono del reenvío).
  - `design.md` ya cita el tablero, así que es solo esa celda.
- **menor m11.** El tono `info` del icono usa `bg-accent text-accent-foreground`. No he podido
  comprobar que sea el mismo color que el `dlg-ic info` del tablero. Las capturas de m10 son de
  `CountrySelect`, no de los diálogos. Que lo mire el humano en la revisión visual.

### Veredicto de la vuelta 2

**RECHAZADO**, solo por B3, que es una celda del catálogo. Con B3 corregido, y sin más cambios de
código, el veredicto pasa a OK.

Decisiones humanas pendientes:
- aprobar las capturas de `CountrySelect` (m10) y las deudas D64 y D65;
- revisar a ojo los iconos y el tono `info` de los diálogos (m11).

## Vuelta 3 (acotada a 16a23491..37864266)

Hice `git fetch`: la rama está al día con `origin/feature/QC-166-area-del-maestro` y lleva **0
commits por detrás de `origin/dev`**.

### Verificación ejecutada

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | verde |
| `pnpm run lint` | 0 errores; los mismos 10 warnings ajenos |
| `pnpm exec vitest run guard` | 80 archivos, 1096 pass / 20 skip |
| `vitest related` de `confirm-dialog.tsx` y de su test de extensión (todos sus consumidores) | 274 archivos, 4680 pass / 1 skip, 0 fail |
| Tests no guardia que leen `CATALOGO.md` | 2 archivos, 18 pass |
| Citas `QC-`/`R<n>`/`design.md` en líneas añadidas de producción | ninguna |

### Hallazgos

- **B3 — resuelto** (`b1396174`). La celda `Diseño` de `ConfirmDialog` cita
  `docs/diseno/canvas/ModalesMaestro.dc.html` y `docs/diseno/canvas/MaestroAdministradores.dc.html`.
- **`f77225d8` no cambia el modo por defecto.**
  - `AlertDialogDescription` solo recibe `LATE_DESCRIPTION_CLASS` si la descripción no va en la
    cabecera.
  - `AlertDialogHeader` solo recibe `HEADER_WITHOUT_DESCRIPTION_CLASS` con `after-aside` y
    además un icono.
  - En cualquier otro caso las dos clases quedan en `undefined`, como antes.
  - Siguen en verde los tests «con header el árbol es el mismo» y «sin icon el árbol no cambia», los
    2 tests nuevos y los 274 archivos de consumidores.
- **m11 — hay capturas** (`b87cf3a5`). La de la baja de empresa a 1440 px enseña icono, cifras,
  aviso y campo en el orden del tablero. Aprobar el tono `info` sigue siendo cosa del humano.

### Veredicto de la vuelta 3

**OK.** No queda ningún bloqueante.
