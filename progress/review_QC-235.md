# Review QC-235 — pais-de-la-empresa · vuelta 1

Rango: `origin/dev...HEAD` (16 commits, 43 archivos). Reviewer, 2026-10-13.
El grafo no se usó: el diff es pequeño y todo es nuevo o apéndice, así que bastaron Grep y Read.

## Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | verde |
| `pnpm exec eslint <archivos del diff de producción y sus tests>` | 0 errores, 0 avisos |
| `pnpm exec vitest run` set-company-country, company-actions, companies-country-migration, country-options, country-select, catalogo, maestro-rol, scope, maestro-sin-empresa-actions | 9 archivos, 152 pass, 5 skipped |
| `pnpm exec vitest run guard` | 75/75 archivos, 1047 pass, 20 skipped |
| `pnpm exec vitest run tests/integration/identity/company-country.int.test.ts tests/integration/proveedores/catalog-line.int.test.ts` | company-country 5/5. catalog-line: 1 rojo (R32) |

**El rojo de `catalog-line` R32 se debe al entorno; está confirmado.** En la base local,
`current_setting('lc_messages')` = `Spanish_Colombia.1252`. El fallo es el que describe `f2be3eb8`:
`meta.constraint` llega como objeto, no como cadena, y el test espera cadena. El diff no toca
`proveedores`, `lib/shared/db` ni ese test. No es un hallazgo de QC-235.

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con requisitos EARS de R1 a R26.
- [x] `design.md` con alternativas descartadas y su porqué (§ 9, siete).
- [ ] Todas las tasks marcadas `[x]`: T10 sigue `[ ]`, porque su «Hecho» pide `./init.sh` verde y
      en local sale rojo por QC-270, que es ajena (contexto del leader). Lo demás de T10 está hecho:
      el mapa R→test está y `archivos-en-vuelo` se repitió. No bloquea esta revisión. El leader marca
      T10 cuando `gate-completo` esté verde en CI.
- [x] `## Lo que ya existe` existe y no está vacía. El diff no re-crea nada de esa lista: reutiliza
      `empresas.modificar`, `Autocomplete`, `Sheet`, `useIsMobile`, `FieldError` y `touchTarget`, y
      no crea un segundo selector.
- [x] Equipo: hay assignee y la rama se publicó con `wt.sh new` (`aee07638`). El humano aprobó los
      choques con QC-214, QC-225 y QC-262.
- [x] Trazabilidad: cada R<n> tiene un test real (tabla abajo). El mapa está en el `impl`.
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en CI: pendiente del PR. No es un hallazgo.
- [x] Flujo crítico (permisos): no hay E2E porque el humano lo difirió a QC-166 (decisión cerrada).
      El permiso se prueba en el dominio y en la acción.
- [x] Dependencia: `libphonenumber-js` tiene su fila en `docs/dependencias.md` con los cuatro checks
      y la aprobación humana, que el `design.md` § 6 cita.
- [x] No hay secretos ni configuración hardcodeada, y no hay webhooks.

### docs/checkpoints-proyecto.md
- [x] Multiplataforma:
  - disparador de 44 px;
  - buscador a 16 px en todas las tallas (`text-base md:text-base`);
  - opciones `min-h-11` en el popup y `min-h-12` en la hoja;
  - `85dvh` y safe-area;
  - sin `:hover` como única vía;
  - con `motion-reduce`.
- [x] Catálogo al día: `Autocomplete` (+`AutocompleteTrigger`), `country-options` («sin UI»),
      `CountrySelect` (Diseño = tablero) y `useIsMobile` (`breakpoint`). `guard-catalogo-de-componentes`
      en verde.
- [x] Pase `/design`: el tablero `docs/diseno/canvas/CountrySelect.dc.html` está citado en el
      `design.md` y en la fila.
- [x] Sin tabla nueva. `companies` ya tiene RLS forzada, y la tabla está exenta de la columna de
      empresa.
- [x] El permiso se valida en el dominio (`requirePlatformPermission`, en la primera línea) y tiene
      test (R4 y R5).
- [x] Acceso a datos solo por el adaptador driven de Prisma (`updateMany` con `deletedAt: null`).
- [x] La migración tiene `down.sql`, que hace la reversión exacta en orden inverso. El implementer
      verificó el rollback en una copia.
- [x] Hexagonal:
  - el dominio importa solo `zod` y `libphonenumber-js` (admitido en `PURE_PACKAGES`);
  - la acción pide el caso de uso a `@/lib/composition`;
  - `'use server'` no se reexporta;
  - `Company` ya tenía `/// @module identity`.
- [x] La lógica está en el dominio: el orden es permiso → zod → puerto → error.
- [x] La mutación es una Server Action.

### perfil-agentes > reviewer (5–11)
- [x] 5. Calidad y seguridad: el actor sale de la sesión y nunca de la entrada; hay test de que unos
      `permissions` metidos en el FormData no autorizan.
- [x] 6. Multiplataforma: ver arriba.
- [x] 7. Dependencias: tienen fila y aprobación.
- [x] 8. Aislamiento: no hay modelo nuevo. El Maestro opera entre empresas por diseño (R5), y la
      operación es de plataforma.
- [x] 9. Comentarios: ninguna línea de producción añadida cita `QC-`, `R<n>`, `design.md` ni
      «decisión cerrada». Las citas a QC-235 están solo en tests.
- [x] 10. Duplicados: el paso 3 (componer) está justificado en § 7.2, y los pasos 1 y 2 se
      descartan con motivo.
- [x] 11. Diseño: el tablero está citado.

## Trazabilidad R → test (verificada leyendo los casos)

| R | Test |
|---|---|
| R1 | `companies-country-migration.test.ts`: sin NOT NULL, DEFAULT ni backfill, con detector que muerde. `company-country.int.test.ts` «R1» |
| R2, R3 | `set-company-country.test.ts`: llegan `CO` y `null` al puerto. `.int`: persiste, y `name`, `nameNormalized`, `createdAt` y `deletedAt` quedan intactos |
| R4 | `set-company-country.test.ts`: cinco actores sin permiso, con entrada inválida a propósito, dan `unauthorized` sin llamar al puerto |
| R5 | `set-company-country.test.ts` y `company-actions.test.ts` «R5» |
| R6 | `co`, ` CO`, `CO `, `COL`, `ZZ` dan `invalid_input` |
| R7 | país `null` o ausente, `companyId` ausente, `null` o no UUID |
| R8 | unit (`not_found` da `CompanyNotFoundError`) y `.int` (empresa inexistente y dada de baja: no cambia ninguna fila) |
| R9 | `company-actions.test.ts`: cinco casos (sesión y no entrada, `getSessionContext` no llamado, `revalidatePath` no llamado, `code` en el error) |
| R10 | `.int` con SQL crudo bajo SAVEPOINT. Migración: CHECK `^[A-Z]{2}$` |
| R11 | `companies-country-migration.test.ts`: tres casos |
| R12 | `guard-dependencias-aprobadas` (verde) y `scope.test.ts` enmendado |
| R13–R18 | `country-options.test.ts` (lógica) y `country-select.test.tsx` (DOM) |
| R19–R26 | `country-select.test.tsx`: un caso por R, dos para R23 y dos para R25 |

## Juicio de las desviaciones que decidió el implementer

1. **Conteos fijos (dependencias 42→43, migraciones +1, catálogo de errores 87→88): ACEPTADA.**
   Son aserciones literales que cuentan dependencias, migraciones y códigos. Añadir una dependencia,
   una migración y un código, como pide el spec, las cambia por fuerza, y el cambio sigue el patrón
   histórico de cada archivo (una línea con fecha y motivo). «Sin cambios en sus aserciones» en T3
   era un error del spec: el código nuevo no puede entrar sin mover el 87. El cambio no debilita
   ninguna aserción. Ver el hallazgo m1.
2. **R10, `'COL'` → `22001` en vez de `23514`: ACEPTADA.** R10 pide que la base *rechace* la
   escritura, y la rechaza: `VARCHAR(2)` corta antes del CHECK. Para `'co'` y `'C1'` el test exige
   `23514`, así que el CHECK sí se prueba, y fijar el SQLSTATE exacto de cada caso es más estricto,
   no menos. El § 8 del `design.md` sigue diciendo `23514` para los tres (m1).
3. **El tipo del puerto no se reexporta desde `index.ts`: ACEPTADA.** El contrato del módulo solo
   reexporta `./domain` (regla del perfil y guardia de barrel). El § 5.1 del `design.md` pedía algo
   que contradice la arquitectura. Ningún consumidor de fuera necesita el puerto. Composición y tests
   lo toman de `ports/`, igual que el resto de puertos (m1).
4. **Diferencias con el tablero: ACEPTADAS las tres.**
   - `aria-haspopup="dialog"`: lo pone el primitivo, porque el popup que se abre es `role="dialog"`
     con el buscador y la lista dentro. En teléfono lo que se abre es una hoja (diálogo).
     Anunciar `listbox` sería falso. En escritorio el disparador lleva `role="combobox"`, que sí
     comunica la lista. Ver el hallazgo m2 sobre la letra de R15.
   - Buscador de 44 px (el tablero dice 40): lo exige la regla de objetivos táctiles de 44 px del
     perfil, que manda sobre el dibujo.
   - Base UI 1.7.0: es la versión fijada en el lock (`^1.7.0`; `node_modules` = 1.7.0). El 1.8.0 del
     design era una errata, y las líneas citadas existen igual en 1.7.0.
5. **`maestro-rol` R17 abre solo `set-company-country.ts`: ACEPTADA.** El propio test ordena: «la
   ficha que empiece a exigir estos permisos, relaja este barrido abriendo aquí las rutas exactas».
   Se abrió una sola ruta, la que exige `empresas.modificar`. El anti-cegado sigue intacto y es
   ahora más estricto: igualdad exacta con el conjunto abierto, así que una ruta abierta que deje
   de nombrar el código también da rojo. Ni la acción ni `platform-actor.ts` nombran el código. La
   enmienda está anotada en § 6.3 (m3).
6. **Cuarta excepción de `guard-buscadores` R20: ACEPTADA; bien acotada y documentada.**
   - Abre un solo archivo (`components/shared/country-select.tsx`) y una sola regla
     (`primitivo-fuera`). `hook-fuera` sigue vigente para él.
   - Lleva motivo.
   - R20 pasa a «exactamente cuatro» con la lista explícita y comprueba que el archivo existe.
   - Está documentada en `design.md` § 7.2 y en `requirements.md > Decisiones cerradas`. La aprobó
     el humano.
   - La guardia está verde.

## Hallazgos

Ninguno BLOQUEANTE.

- **m1 (menor).** El spec no refleja las desviaciones 1–3:
  - `design.md` § 8 (R10) dice `23514` para `'COL'`;
  - § 5.1 sigue pidiendo reexportar el tipo del puerto;
  - § 7.5 cita `@base-ui/react@1.8.0`;
  - T3 dice «sin cambios en sus aserciones».

  Están anotadas en el `impl`, pero el spec debería decir lo que hace el código. Hay que corregir
  esas cuatro líneas.
- **m2 (menor).** R15 dice «anunciar que abre una lista», y el código anuncia `dialog`, que es lo
  correcto en ARIA. El tablero muestra `aria-haspopup="listbox"`. Además, el test de R15 solo
  comprueba que `aria-haspopup` existe, no su valor. El humano tiene que confirmarlo o se ajusta el
  texto de R15 y el test fija `dialog`.
- **m3 (menor).** El mensaje de error de `maestro-rol` R17 sigue diciendo «solo pueden nombrarse en
  ${CATALOGO_DE_PERMISOS}». Ahora también se pueden nombrar en las rutas abiertas, así que el
  mensaje engaña a quien lo lea en rojo.
- **m4 (menor).** Falta la revisión visual real a 1440, 820 y 375 px, que el «Hecho» de T9 exige.
  T9 se marcó por decisión del leader. Ninguna ruta monta el componente hasta QC-166. La revisión
  le toca al humano antes de cerrar QC-235 o, como mucho, en QC-166, y queda en deudas si se
  difiere.
- **m5 (menor).** El tablero dice «al abrir, la lista arranca en el país elegido», y no hay
  resaltado inicial: el primitivo en modo `none` no lo permite, y está verificado y anotado. R21
  (marcado y desplazado a la vista) sí se cumple.
- **m6 (menor).** Faltan dos pruebas de R20:
  - cerrar el popup de escritorio pulsando fuera, sin elegir;
  - Escape en la hoja de teléfono.

  Están cubiertos Escape en el popup y «Cerrar» en la hoja.
- **m7 (menor).** El comentario de cabecera de `components/shared/country-options.ts` repite la
  ruta del archivo.

## Veredicto

**OK.** Ninguno de los hallazgos bloquea. Quedan pendientes fuera de esta revisión: marcar T10 cuando
`gate-completo` esté verde en CI y la revisión visual del humano (m4).
