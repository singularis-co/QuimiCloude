# QC-236 — Teléfono de cliente con código de país · review

## Vuelta 1 (completa, `origin/dev...7e307a6d`)

Revisado: `fdacb5b4`, `315547cd`, `7e307a6d` contra `specs/QC-236-telefono-de-cliente-con-codigo-de-pais/`
(R1–R34, D1–D13), `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`,
`CHECKPOINTS.md`, `docs/checkpoints-proyecto.md` y `docs/perfil-agentes.md > reviewer`.

Grafo: no se consultó; la revisión se hizo con Grep/Read y git sobre el worktree.

**Aviso sobre el worktree.** Mientras revisaba aparecieron cambios **sin commitear** de otra sesión en
`customer-phone-field.tsx` (`initialCountry`: al editar un cliente sin teléfono se abre con el país
de la empresa), `legacy-phone-backfill.int.test.ts`, `customer-phone-field.test.tsx` y
`legacy-phone-backfill.test.ts`. **No entran en esta vuelta**: se revisó `HEAD = 7e307a6d`. Lo que
se ve de ellos:
- el comentario nuevo cita «(R31)», que choca con la regla 9 si se commitea así;
- parece la resolución de la desviación 6. Se revisa en la vuelta 2.

### Verificación ejecutada (salida real, 2026-10-19)

| Comando | Resultado |
| --- | --- |
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | exit 0, `✖ 10 problems (0 errors, 10 warnings)`. Los avisos son de archivos ajenos al diff (`step-evidence.tsx`, tests de `asignaciones`, `documentos` y `pedidos`). |
| `pnpm exec vitest run guard` | `Test Files 81 passed (81)`, `Tests 1110 passed \| 20 skipped` |
| `vitest run --project node --project ui` sobre `tests/unit/clientes`, `tests/unit/clientes-ui`, `tests/ui/clientes`, `country-select-pinned`, `build.test.ts`, `deploy-hook.test.ts`, `tests/unit/errores`, `tests/unit/paridad`, `session-once-per-request-render`, `confirm-dialog-montado` | **`Test Files 1 failed \| 65 passed (66)`, `Tests 1 failed \| 1078 passed \| 5 skipped`**. El rojo es `tests/unit/clientes/scope.test.ts`; no está en `tests/baseline-rojos.json` (ver H1). |
| `git merge-tree HEAD origin/dev` | conflictos en `docs/diseno/canvas/canvas.json` y `tests/unit/errores/catalogo.test.ts` (ver H6) |

**No corrido (pendiente de verificación, hecho conocido: no hay `.env` ni base):**
- los cuatro `.int` nuevos: `customers-phone-migration`, `customer-phone-uniqueness`,
  `legacy-phone-backfill` y `company-country-read`;
- los dos `.int` ajustados de `clientes`;
- `e2e/clientes-telefono.spec.ts` y `e2e/clientes.spec.ts`;
- `pnpm db:seed:demo`.

Mientras no corran, quedan **sin evidencia ejecutable** cuatro cosas:
- UP → DOWN → UP sobre Postgres;
- los CHECK y el índice parcial en la base;
- que el relleno escriba con `FORCE ROW LEVEL SECURITY` activa (§ 3.3 del diseño lo dejaba a T5);
- que `meta.target` de Prisma 6.19.3 traiga `phone_e164` o el nombre del índice en el `P2002`.

Los corre CI (`gate-completo`) o un humano con base.

### Checklist

**Trazabilidad**
- [x] R1–R34: cada uno tiene al menos un test con aserciones reales; se comprobaron por muestreo
  R5, R8, R14, R17, R26, R33 y R34. El mapa consolidado está en `progress/impl_QC-236.md > Cierre`.
- [~] R13 solo tiene cobertura `.int`, sin correr: pendiente de verificación.
- [~] R14, R16 y R23 en la base, R24–R27 de punta a punta y la parte de base de R32 y R34: igual,
  solo `.int` sin correr. Los unitarios cubren el dominio y el texto del SQL.
- [~] R6, R11 y R29 se prueban con el formato **que da la librería** (`300 1234567`), no con el
  literal del requisito (`300 123 4567`). Depende de la desviación 1.
- [~] R29 no tiene tarjeta en teléfono; R33 deja el país en 44 px y no en 48. Ver las desviaciones
  5 y N1.

**Tasks**
- [x] T1–T10 marcadas.
- [ ] **T11 (E2E) y T12 (cierre) sin marcar.** Hecho conocido: el E2E no corrió por falta de base, y
  la revisión visual a 1440/820/375 y `./init.sh` siguen pendientes. No cuenta como hallazgo de
  código, pero la feature no se cierra hasta que estén.

**`CHECKPOINTS.md`**
- [x] `requirements.md` con EARS numerados.
- [x] `design.md` con alternativas descartadas (§ 10).
- [ ] `tasks.md` con todo `[x]`: faltan T11 y T12 (pendientes).
- [x] `design.md` abre con `## Lo que ya existe`, con búsqueda declarada y tabla, y el diff no
  re-crea nada de esa lista:
  - extiende `CountrySelect`;
  - reutiliza `TextField`, `FieldError`, `StatusBadge` y `country-options`;
  - amplía `CompanyCountryRepository`;
  - `libphonenumber-js` ya estaba.
- [x] El mapa `R → test` está en `impl_QC-236.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo`: no hay PR todavía. Con el rojo de H1, saldría rojo.
- [x] No hay dependencias nuevas. `libphonenumber-js/max` es un subpath del paquete aprobado,
  declarado en § 11 y en `docs/architecture.md`.
- [x] Sin secretos y sin webhooks.
- [x] Sin hardcode que cambie por entorno. El `'CO'` de respaldo es regla de negocio de la ficha.
- [ ] `./init.sh` en verde: no se corrió entero. Sus piezas sí: typecheck, lint y guardias en
  verde; los `related` tienen el rojo de H1.

**`docs/checkpoints-proyecto.md`**
- [x] UI multiplataforma, ver regla 6.
- [x] Pieza extendida de `components/shared` con su fila del catálogo actualizada: puntos de
  extensión y `TelefonoCliente.dc.html` en «Diseño».
- [x] Componente nuevo o cambio visual con pase `/design` aprobado y citado: `TelefonoCliente.dc.html`
  en `design.md § 1`, D7.
- [x] No hay tabla nueva. `customers` ya tenía RLS forzada (QC-154). Toda consulta nueva de
  `customers` pasa por `customerCompanyScope`, y la guardia `guard-ambito-empresa-clientes` está en
  verde.
- [x] El permiso se comprueba en el caso de uso y antes de validar (R17, con test).
- [x] El acceso a datos solo pasa por adaptadores driven.
  - `identity.findCountryOf` usa `$queryRaw` parametrizado: es la misma práctica del archivo.
- [x] Migración versionada con `down.sql`:
  - el UP no destruye nada (D6): tres columnas nulas sin `DEFAULT`, cuatro CHECK, un índice y ningún `UPDATE`;
  - el DOWN es exactamente el inverso;
  - parcial porque el UP/DOWN/UP real queda pendiente (`.int` sin correr).
- [x] Módulos hexagonales:
  - `domain/` solo importa `libphonenumber-js/max` y `zod`;
  - la composición ata `CompanyCountryLookup` a `identity.getCompanyCountry` sin que `clientes`
    importe `identity`;
  - el driving no instancia el driven;
  - guardias en verde.
- [x] `page.tsx` corta por permiso antes de leer el país. El país sale de la sesión firmada y el
  conteo de lecturas de sesión sigue en 1 (test añadido).

**Reglas del proyecto (`perfil-agentes > reviewer`)**
- [x] 5 · Calidad y seguridad:
  - aislamiento por empresa en el índice (`company_id, phone_e164`), en los casos de uso y en el
    relleno, que va empresa por empresa;
  - R17 probado.
  - Ver H2 para un caso de pérdida de datos.
- [x] 6 · Multiplataforma:
  - número con `text-base` (16 px) y `min-h-11` / `max-lg:min-h-12`;
  - disparador de 44×44 (`clientes-viewport.test.tsx`);
  - sin `100vh` y sin `:hover` como única vía.
  - Con esto cumple el mínimo de la regla. El 48 px de R33 es otra cosa: ver N1.
- [x] 7 · Dependencias: `package.json` solo añade un script, ninguna dependencia.
- [x] 8 · Aislamiento: no hay modelo nuevo. Las consultas nuevas de `customers` van con ámbito. El
  acceso cruzado rechazado se prueba en R10 (otra empresa → `not_found`) y en R13 (otra empresa no
  es duplicado), los dos `.int` sin correr.
- [x] 9 · Comentarios: ninguna línea añadida de producción (`app`, `components`, `lib`, `scripts`,
  `db`) cita `QC-`, `R<n>`, `D<n>`, `design.md` ni «decisión cerrada». Se comprobó con grep sobre el diff.
- [x] 10 · Duplicados: `CustomerPhoneField` declara el paso 3, componer, y `CountrySelect` el paso 2,
  extender.
- [x] 11 · Diseño: hay referencia en `design.md § 1` y en la fila del catálogo.
  `CustomerPhoneField` es componente de ruta y no lleva fila.

### Prioridades del leader

1. **Migración** (`db/migrations/20261019130000_customers_phone_e164/`).
   - No es destructiva: añade columnas nulas, sin `DEFAULT` y sin `UPDATE`; `phone` no se toca.
   - El índice es único y parcial: `(company_id, phone_e164) WHERE deleted_at IS NULL AND phone_e164 IS NOT NULL`.
   - Es reversible: el `down.sql` es el inverso exacto.
   - Los CHECK coinciden con `design.md § 2.1`.
   - Correcto en texto. La ejecución real queda pendiente.
2. **Relleno.**
   - **Idempotente:** `PENDING` se repite en la lectura y en cada `UPDATE`, así que una segunda pasada no
     encuentra filas.
   - **Desempate D11:** `createdAt` desc y después `id` desc, con test unitario. «Ya tomado» deja el
     grupo entero como `duplicate`.
   - **R27:** el `UPDATE` solo escribe las tres columnas, sin `updated_at`.
   - **R34/D12:** al guardar un migrado con el número vacío, `phone`, `phone_country` y `phone_issue`
     se conservan. `updateKeepingLegacyPhone` pone el teléfono a nulo solo si `phone_issue IS NULL`,
     dentro de la transacción y con la fila ya bloqueada por el primer `UPDATE`.
     - Lo prueban `customer-service.test.ts` y el `.int` (×2), que no corrió.
     - **Pero** el mismo camino borra el `phone` de una fila **pendiente** (H2).
3. **Aislamiento y RLS.**
   - Todo pasa por `customerCompanyScope`.
   - El relleno no lee dos empresas a la vez.
   - `findCountryOf` lee la empresa de la sesión, no de la entrada.
   - El RLS forzado sobre la escritura del relleno sigue sin verificar (`.int`).
4. **`scripts/build.mjs`.**
   - El relleno entra en `CON_TODO` y `CON_TODO_Y_DEMO`, después de `GENERAR`, y en `DE_BASE`.
   - Un fallo tumba el build (`process.exit(1)` y el test del build).
   - Development y los entornos sin `VERCEL_ENV` lo saltan.
   - `guard-despliegue-produccion` y `deploy-hook.test.ts` están ajustados y en verde.
   - El script es una cáscara como `seed.ts`: import dinámico después de `loadDotEnv` y
     `$disconnect` en `finally`.
   - Correcto. El orden respecto a R28 queda pendiente de decisión (desviación 3).

### Hallazgos

**H1 · BLOQUEANTE — rojo nuevo en `tests/unit/clientes/scope.test.ts`.**
- **Qué falla:** el caso «R28 — los ÚNICOS E2E que nombran clientes… > ningún otro archivo de `e2e/`…
  nombra clientes» da `expected [ 'clientes-telefono.spec.ts' ] to deeply equal []`.
- **Por qué:** el E2E nuevo no está dado de alta en `E2E_PERMITIDOS`, que es una lista cerrada con
  su nota fechada, como las anteriores.
- **Origen:** el archivo no está en `tests/baseline-rojos.json`, así que es un rojo del diff.
- `gate-completo` saldría rojo.
- Falta añadirlo a la lista con su nota.

**H2 · BLOQUEANTE — editar un cliente pendiente de relleno borra su `phone` sin aviso (D6/D12).**

Una fila **pendiente** tiene `phone` y no tiene `phone_e164` ni `phone_issue`. Pasa con ella lo
siguiente:
1. la lista la pinta como sin teléfono (`describeCustomerPhone` → `none` → `MissingValue`);
2. el formulario la abre con el número vacío y sin etiqueta;
3. al guardar cualquier otro dato, `keep_legacy_or_clear` encuentra `phone_issue IS NULL` y pone las
   cuatro columnas a nulo. **El texto antiguo se pierde.**

El diseño (§ 3.3) daba por hecho que «tras el despliegue, ningún guardado deja una fila en ese
estado». Con lo implementado esa suposición no se cumple, porque hay filas pendientes en tres casos
reales:
- **Clientes de una empresa dada de baja y después reactivada.** Existe `reactivateCompany` en
  `identity`. Por la desviación 4 el relleno nunca los vio, y siguen pendientes hasta el siguiente
  build.
- **Altas o ediciones que hace el despliegue anterior** entre el relleno y la promoción del build
  nuevo. Vercel sigue sirviendo el código viejo mientras construye, y ese código escribe `phone` sin
  `phone_e164`.
- **Bases locales o de development** migradas sin pasar por `build.mjs`.

Qué falta:
- que el adaptador trate «pendiente» como antiguo (no borrar si `phone_e164 IS NULL AND phone IS NOT NULL`
  sin aviso), o que se defina otra salida;
- su test `.int`.

Es un fallo de datos y no solo de presentación, así que bloquea independientemente de lo que se
decida en la desviación 4.

**H3 · menor — no hay test propio de `errorId` en `CountrySelect`.** La prop nueva se prueba solo de
forma indirecta: el R8 de `customer-phone-field.test.tsx` comprueba `aria-describedby` = id del
error y que el campo no pinta el suyo. Las demás props nuevas sí tienen tests en
`country-select-pinned.test.tsx`. Es un test barato y cierra el punto de extensión.

**H4 · menor — `describeCustomerPhone` esconde el `phone` de las filas pendientes.** Es la cara
visible de H2. Si H2 se resuelve conservando el dato, conviene que la lista muestre el texto antiguo
en vez de «—».

**H5 · menor — el resumen del relleno cuenta filas que pudo no escribir.** El `UPDATE` con
`PENDING` puede saltarse una fila editada entre la lectura y la escritura, pero `summarize` cuenta el
plan, no los `count` del `updateMany`. Solo afecta a la línea de log del build.

**H6 · menor — la rama ya no mergea limpia con `origin/dev`.** Hay conflictos en
`docs/diseno/canvas/canvas.json` y `tests/unit/errores/catalogo.test.ts`, que es el contador del
catálogo. Hay que hacer merge de `dev` antes del PR y volver a correr `catalogo.test.ts`. La
migración `20261019130000` sigue siendo la última también contra el `dev` actual.

**H7 · menor — los documentos del spec no reflejan el nombre real de la migración.**
`design.md § 2.4` y `tasks.md > Archivos esperados` dicen `20261019120000_…`, y en el diff es
`20261019130000_…`. Si el humano acepta la desviación 2, se corrige la ruta en los dos.

### Desviaciones pendientes de decisión humana (evaluadas como riesgo)

| # | Desviación | Riesgo | Evaluación |
| --- | --- | --- | --- |
| 1 | CO en el formato de libphonenumber (`300 1234567`, `+57 300 1234567`) en vez de `300 123 4567` | Bajo para los datos: `phone_e164` no cambia y el `phone` legible es solo para mostrar. Medio frente al spec: R6, R11 y R29 y el tablero fijan otro literal. Los tests derivan el esperado de `formatPhone*`, salvo la instantánea de `clientes-paridad`, así que el cambio en cualquier sentido es barato. Un formato propio supondría código nuevo y divergiría de la librería en otros países. | Decide el humano. Si acepta, se enmiendan R6, R11 y R29 y la ficha del tablero. |
| 2 | Migración `20261019130000` en vez de `120000` | Bajo. Es necesaria: con `120000` ordenaría antes que `whatsapp_connections_drop_meta_app_id`, que ya está en `dev`, y `db:rollback` revertiría la migración equivocada. Ninguna de `dev` es posterior. | Razonable. Hay que corregir el spec (H7). |
| 3 | Relleno después de `migrate` **y** `generate` | Bajo. Entre `migrate` y el relleno nada toca la base, y antes de `generate` el cliente cacheado por Vercel no conoce las columnas. Si falla, el build sigue fallando. | Razonable. R28 dice «justo después de `migrate deploy`»: se enmienda el texto. |
| 4 | Relleno solo de empresas activas (`listActiveCompanyIds`), sin `FOR UPDATE` y sin `listCompaniesWithPending` | Medio. La guardia `guard-ambito-empresa-clientes` no tiene excepciones, así que una consulta entre empresas no tiene cabida; sustituir el `FOR UPDATE` por `PENDING` repetido en cada `UPDATE` más un reintento ante el índice es correcto. **El riesgo está en las empresas reactivadas:** sus clientes quedan pendientes hasta el siguiente build y, con H2, una edición borra su teléfono. R24 dice «cada cliente vivo», y estos lo son. | Decide el humano. Aunque lo acepte, H2 tiene que resolverse. |
| 5 | Sin tarjeta de la lista en teléfono | Medio frente al spec. R29 pide expresamente la tarjeta a ≤ 640 px. `design.md § 8.4` mandaba parar y decirlo, y el implementer lo dijo. Hoy se ve la tabla en todos los anchos, con scroll horizontal. Es un cambio visual de la lista (`card` en `CustomerTable`). | Decide el humano: o se hace, o se saca de R29 a una ficha. |
| 6 | Al editar un cliente sin teléfono sale «Sin país», no el país de la empresa | Bajo. El spec no lo fija (R2 es el alta y R4 un cliente con número). Fricción: para añadir un número a un cliente existente hay que elegir el país. | Hay cambios sin commitear que parecen resolverlo (ver el aviso de arriba). Se revisa en la vuelta 2. |
| 7 | Prop extra `errorId` en `CountrySelect` | Bajo. Es opcional, sin ella nada cambia, sigue el paso 2 de la regla y tiene su fila del catálogo actualizada. | Razonable. Falta un test propio (H3). |

**Desviaciones declaradas en la bitácora (T9, puntos 2–5) que no están en la lista del leader y
también necesitan al humano:**
- **N1:** el disparador del país mide 44 px en teléfono y no 48, como pide R33 («los controles miden
  48 px»). El número sí mide 48. El mínimo táctil de 44 de la regla 6 se cumple, pero R33 no.
- **N2:** el número no lleva placeholder porque `TextField` no tiene la prop. El tablero lo dibuja.
- **N3:** el error de número no lleva la animación `qc-err` del tablero, porque no existe en la app.
- **N4:** el error del número va bajo su columna y no bajo toda la fila, como en el tablero.

Que sean bloqueantes o no depende de que el humano las acepte. Hoy son incumplimientos de R33 y del
tablero no aprobados.

### Veredicto

**RECHAZADO** — 2 bloqueantes (H1, H2) y 5 menores (H3–H7). Además quedan 7 + 4 desviaciones
pendientes de decisión humana y la verificación de los `.int`, el E2E y el seed, que no corrieron
por falta de base.

Para pasar a OK:
1. H1: dar de alta `clientes-telefono.spec.ts` en `E2E_PERMITIDOS` de `scope.test.ts`, con su nota.
2. H2: que editar una fila pendiente no borre su `phone`, con un test `.int`.
3. Que el humano decida las desviaciones 1–7 y N1–N4, y que el spec se enmiende con lo que se acepte.
4. Que T11 y T12 se cierren con el E2E y los `.int` en verde en CI.

## Vuelta 2 (acotada a 7b017082..HEAD; amplía a piezas compartidas: `country-select.tsx`, `text-field.tsx` y `CATALOGO.md`)

Commits: 5574e902 (T13, T14), 15da3fd6 (merge de `origin/dev`; solo se miran `canvas.json` y
`catalogo.test.ts`), 174ebc6d (H1, H2, H5 en backend), 82b1bd3c (H2 en la UI, H3, N1–N4) y la
enmienda del spec 944d9e5e (D14–D21). Grafo: no consultado; Grep/Read sobre el worktree.

### Verificación ejecutada (salida real)
- `pnpm run typecheck` → `tsc --noEmit` sin errores.
- `eslint` sobre los 9 archivos de producción y test tocados → exit 0, sin salida.
- `vitest run` de `catalogo`, `scope`, `customer-phone`, `legacy-phone-prisma`,
  `legacy-phone-backfill`, `tests/ui/clientes`, `text-field-extension`, `country-select-pinned` y
  `formularios-paridad` → `Test Files 10 passed`, `Tests 255 passed`.
- `vitest related --run --project ui --project node` sobre los 7 archivos de producción tocados
  (incluidos `country-select.tsx` y `text-field.tsx`, que arrastran `company-edit-sheet` y los
  16 usos de `TextField`) → `Test Files 403 passed (403)`, `Tests 6878 passed | 1 skipped`.
- `vitest run tests/guards` → `Test Files 73 passed`, `Tests 1011 passed | 14 skipped`.
- `git merge-tree HEAD origin/dev` → limpio.
- Los `.int` y el E2E siguen sin correr (no hay base): pendiente conocido.

### Checklist
- [x] **H1 cerrado.** `clientes-telefono.spec.ts` está en `E2E_PERMITIDOS`, con nota fechada.
  `scope.test.ts` en verde.
- [x] **H2 cerrado en el código.** El segundo `UPDATE` de `updateKeepingLegacyPhone` tiene
  `phoneIssue: null, OR: [{ phone: null }, { phoneE164: { not: null } }]` más `deletedAt` y el
  ámbito. Se vacía solo con `phone_issue IS NULL AND (phone IS NULL OR phone_e164 IS NOT NULL)`.
  Revisado caso por caso:
  - fila con aviso: se conserva;
  - pendiente (`phone`, sin `e164` ni aviso): se conserva;
  - convertida: se vacía;
  - sin teléfono: se vacía (no-op).

  El primer `UPDATE` sigue bloqueando la fila, así que el criterio de D21 se mantiene.
  `.int` «R34 — editar una fila pendiente de relleno…» escrito, sin correr. La UI pinta la variante
  `legacy` en la lista y la ayuda «Antes: …» en el formulario, con tests.
- [x] **H3 cerrado.** Hay 3 casos `CountrySelect · errorId` en `country-select-pinned.test.tsx`.
- [x] **H4 cerrado.** La lista muestra el `phone` de la fila pendiente en gris y mono.
- [x] **H5 cerrado.** `summarize(written)` solo cuenta los `count === 1`. Tiene un test unitario
  nuevo con `count` 0.
- [x] **H6 cerrado.**
  - Merge resuelto. `canvas.json` es JSON válido y conserva las entradas de dev (QC-288 y otras) y
    la de `TelefonoCliente.dc.html` (una vez en `boards` y otra en `order`). No se solapa con
    ningún tablero de la página «proveedores».
  - `catalogo.test.ts` en 106 (103 de dev más 3 códigos de QC-236), en verde.
  - Hoy mergea limpio con `origin/dev`.
- [x] **H7 cerrado.** El spec nombra `20261019130000` en design § 2.4 y en tasks T1 y «Archivos
  esperados».
- [x] **D14–D21 y R35 frente al código:**
  - D14: formato de la librería; el placeholder del número también lo es.
  - D15, D16 y D17 (más T14): tests unitarios del filtro de empresas activas y `.int` escrito.
  - D18: sin tarjeta.
  - D19 y R35: `initialCountry`; con aviso sin país conserva el suyo, sin teléfono va el de la
    empresa, y R4 y R31 siguen verdes.
  - D20: `errorId`.
  - D21: dos `UPDATE`.

  Excepción: el arreglo de H2 (hallazgo V2-H1).
- [x] **N1–N4 según el tablero.**
  - N1: país `max-lg:h-12`, 48 px como el número.
  - N2: placeholder con el ejemplo de móvil del país.
  - N3: entrada `motion-safe:animate-in fade-in slide-in-from-top-1` con `--dur-fast` y
    `--ease-enter`; `tw-animate-css` ya está en `package.json` y en `globals.css`.
  - N4: los dos errores van bajo toda la fila, con icono y `role="alert"`; el número queda
    enlazado por `errorId`.
- [x] **Piezas compartidas.**
  - `CountrySelect.triggerClassName` se añade con `cn` y no cambia nada si se omite.
  - `TextField.placeholder` y `errorOutside` (por defecto `false`): con `errorOutside`, el
    `input` conserva `aria-invalid` y `aria-describedby={errorId}`.
  - `TextField` no tenía rest props, así que ningún uso de fuera podía pasar ya `placeholder`.
  - El único otro uso de `CountrySelect` es `company-edit-sheet.tsx`: no pasa las props nuevas y
    sus tests están en verde.
  - `CATALOGO.md` tiene las tres props nuevas, en las filas de `CountrySelect` y `TextField`, con
    «sin ellas no cambia nada».
  - Ninguna es un cambio visual por defecto: la regla 11 no aplica.
- [x] **`libphonenumber-js/mobile/examples`.**
  - Lo importa `app/(private)/clientes/components/customer-phone-field.tsx`, no el dominio:
    `PURE_PACKAGES` y `guard-arquitectura-modulos` no aplican, y las guardias están en verde.
  - Es un subpath del paquete aprobado: no hay dependencia nueva ni cambia `package.json`.
  - `getExampleNumber` sale del punto de entrada `min`, pero `country-options.ts` ya cargaba ese
    bundle.
  - Comprobado en los 245 países: el `formatNational()` del ejemplo es idéntico con `min` y con
    `max`, y ninguno falta.
- [x] **Instantáneas de `formularios-paridad` (5).**
  - 1 de alta: solo añade `max-lg:h-12` al disparador.
  - 4 de edición: `max-lg:h-12`, `aria-describedby="<id>-help"` en el grupo y el párrafo «Antes:
    3001234567. Escribe un número…».
  - Las causa que el cliente de prueba tiene `phone` sin `phoneE164` (fila pendiente). El cambio
    es el esperado y no se ha colado ningún otro.
- [x] **Comentarios.** Ninguna línea añadida en `app/`, `lib/` o `components/` cita `R<n>`, `D<n>`,
  `QC-<n>` ni `design.md`. Se quitó el comentario que citaba R31. Hay un matiz menor en V2-m1.
- [ ] **Tasks.** T13 y T14 están `[x]`. T11 y T12 siguen `[ ]`: es el pendiente conocido (E2E y
  `.int` en CI).

### Hallazgos

**V2-H1 · BLOQUEANTE: el spec no recoge el arreglo de H2, y el código contradice R10 tal como
está escrito.**

Qué dice hoy el spec y qué hace el código:
- **R10:** «La única excepción es la edición de un cliente migrado con `phone_issue` (R34)». El
  adaptador tiene ahora una segunda excepción: la fila pendiente conserva `phone`.
- **`design.md § 4.5`** (conservar el teléfono antiguo) describe el segundo `UPDATE` con solo
  `phone_issue IS NULL`.
- **`design.md § 3.3`** sigue diciendo que «tras el despliegue, ningún guardado deja una fila en
  ese estado».
- **`design.md § 4.1` y `§ 8.4`** no tienen la variante `{ kind: 'legacy' }` de
  `describeCustomerPhone` ni su celda en la lista.
- **`design.md § 8.1`** no tiene la ayuda del formulario para la fila pendiente. Su texto («Antes:
  <phone>. Escribe un número para reemplazarlo; si lo dejas vacío, se conserva.») es nuevo, no está
  en el tablero y nadie lo ha aprobado.
- **Tests:** los casos nuevos se llaman `R34 —`, `R35 —` y `R29 —`, pero ninguno de esos
  requisitos describe la fila pendiente. La trazabilidad apunta a requisitos que no lo dicen.

No se reabre ninguna decisión: el comportamiento es el correcto y el que pedía H2. Lo que falta es
que esté especificado. Falta:
- una enmienda del spec (`spec_author`) que añada la fila pendiente como excepción en R10/R34 o
  en un requisito nuevo, y su presentación en lista y formulario, con su D;
- que el humano apruebe el texto de la ayuda;
- renombrar los casos de test al requisito que corresponda.

**V2-m1 · menor: comentario con historia en producción.**
`customer-phone-field.tsx:120` dice «… como el alta (humano, 2026-10-19)». No cita `R`, `D` ni
`QC`, pero quién lo decidió y cuándo es historia que vive en `specs/` (`docs/conventions.md >
Comentarios`). Basta con quitar el paréntesis.

**V2-m2 · menor: el subpath `libphonenumber-js/mobile/examples` no está documentado.**
- `design.md § 11` solo habla de `/max` y su coste de bundle.
- La fila de `docs/dependencias.md` no nombra los ejemplos.
- No es una dependencia nueva, pero conviene una línea con el uso (placeholder) y el coste.

**V2-m3 · menor: rango de la enmienda.** La cabecera de `requirements.md` (l. 4 y l. 260) y la de
`tasks.md` (l. 14) dicen «D14–D20», y D21 existe.

### Veredicto

**RECHAZADO**: 1 bloqueante (V2-H1, solo de spec) y 3 menores (V2-m1–m3). H1–H7 de la vuelta 1
están cerrados en el código, verdes y sin regresiones en las piezas compartidas.

Para pasar a OK:
1. Enmendar el spec con la fila pendiente (R10/R34 o un R nuevo, y design § 3.3, § 4.1, § 4.5,
   § 8.1 y § 8.4), con el texto de la ayuda aprobado por el humano.
2. Renombrar los casos de test al requisito que corresponda.

Siguen pendientes, fuera de esta vuelta, T11 y T12 con los `.int` y el E2E en verde en CI.
