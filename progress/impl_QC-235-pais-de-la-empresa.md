# QC-235 — impl

## frontend_dev · T7 y T8

### Archivos
- T7: `components/shared/country-options.ts` (nuevo), `tests/unit/shared-ui/country-options.test.ts`
  (nuevo), fila «sin UI» en `components/shared/CATALOGO.md`.
- T8: `components/ui/autocomplete.tsx` (`AutocompleteTrigger`), `hooks/use-mobile.ts`
  (`breakpoint = 768`), filas `Autocomplete` y `useIsMobile` en `components/shared/CATALOGO.md`.

### R → test
| R | Test |
|---|---|
| R13 | `country-options.test.ts` › «R13 — una opción por cada código…», «R13 — ordenadas…», «R13 — +1 separadas (CA, US)», «R13 — una vez por módulo» |
| R16 | `country-options.test.ts` › «R16 — peru → Perú, MEXICO → México», «R16 — no se trata como prefijo» |
| R17 | `country-options.test.ts` › «R17 — 57 y +57 → Colombia», «R17 — 1 → CA y US» |
| R18 | `country-options.test.ts` › «R18 — sin coincidencias → vacía», «R18 — vacío → todas» |

(R13–R18 en el DOM se cubren en T9, `country-select.test.tsx`.)

### Salida
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (`confirm-catalog-import.test.ts`,
  `order-service.test.ts`), ninguno en archivos tocados.
- `pnpm exec vitest run guard`: 74/75 archivos, 1046 pass, 1 fail:
  `guard-identificador-de-request` › «db/ no gana ni una migracion…» — la detona
  `db/migrations/20261013120000_companies_country` (T2, backend). No está en
  `tests/baseline-rojos.json`; no es de T7/T8. `guard-catalogo-de-componentes` en verde.
- `pnpm exec vitest related --run <archivos T7/T8>`: 132 archivos, 2192 pass, 1 skipped.
- `pnpm exec vitest run async-autocomplete sidebar country-options`: 12 archivos, 141 pass
  (incluye `async-autocomplete`, `async-autocomplete-ampliado`, todos los `sidebar-*`).

### Veredicto
T7 y T8 hechas y en verde; el único rojo de guardias es de la migración de T2.

## frontend_dev · T9

### Archivos
- `components/shared/country-select.tsx` (nuevo).
- `tests/unit/shared-ui/country-select.test.tsx` (nuevo, proyecto `ui`).
- `components/shared/CATALOGO.md`: fila `CountrySelect` añadida tras la de `country-options.ts`
  (solo una línea nueva; nada reordenado).

### R → test (`tests/unit/shared-ui/country-select.test.tsx`)
| R | Caso |
|---|---|
| R13 (DOM) | «R13 — una opción por país, con nombre y prefijo, en el orden de la lista» |
| R14 | «R14 — con el buscador vacío, «Sin país» es la primera opción» |
| R15 | «R15 — el disparador muestra «Colombia (+57)» o «Sin país» atenuado…» |
| R16 | «R16 — un texto filtra por nombre sin tildes ni mayúsculas y quita «Sin país»» |
| R17 | «R17 — dígitos con o sin «+» filtran por prefijo, y «1» lista por separado CA y US» |
| R18 | «R18 — sin coincidencias muestra «Ningún país coincide con «<texto>».»» |
| R19 | «R19 — elegir notifica el código o null, cierra la lista y vacía el buscador (clic y Enter)» |
| R20 | «R20 — las flechas mueven el resaltado y Escape cierra sin notificar» |
| R21 | «R21 — al abrir con un país elegido, su opción está marcada y se desplaza a la vista» |
| R22 | «R22 — a 1024 px abre un popup anclado con el buscador arriba y opciones de 44 px» |
| R23 | «R23 — a 375 px abre una hoja con título, «Cerrar», foco en un buscador de 48 px…», «R23 — en la hoja, elegir notifica y cierra» |
| R24 | «R24 — deshabilitado no abre la lista ni notifica, en escritorio y en teléfono» |
| R25 | «R25 — con error, el disparador es inválido y el mensaje lo describe», «R25 — sin error…» |
| R26 | «R26 — se monta solo, sin providers ni servidor, y su fuente no importa lógica de servidor» |

### `aria-selected` y resaltado inicial (R21, `design.md > 7.5`)
Verificado en el paquete instalado, que es **`@base-ui/react@1.7.0`** (el `design.md` cita 1.8.0;
`package.json` pide `^1.7.0`). Las líneas citadas existen igual en 1.7.0:
- `combobox/item/ComboboxItem.js:126`: `'aria-selected': selectable ? selected : undefined`, con
  `selectable = selectionMode !== 'none'`. `AutocompleteRoot.js:96` fija `selectionMode: "none"`,
  así que el primitivo **no pone `aria-selected`** en ninguna opción: ni por valor ni por
  resaltado. Las props del elemento se mezclan después de las del primitivo
  (`props: [itemProps, defaultProps, elementProps, getButtonProps]`), así que el componente pone
  `aria-selected={elegida}` (true/false) y `data-selected` en cada opción. El estado accesible de
  «elegida» va por valor, no por resaltado.
- Resaltado inicial: **no se puede llevar a la opción elegida con la API pública.** El índice
  inicial sale de `selectedIndex`, que `ComboboxItem.js:89-96` solo fija cuando la opción coincide
  con `selectedValue`, y en modo `none` no hay valor elegido. `actionsRef` de Autocomplete solo
  expone `unmount` y `onItemHighlighted` es una notificación, no un control. Se deja sin resaltado
  inicial (la primera flecha va a la primera opción) y el elegido se marca y se desplaza a la
  vista con `scrollIntoView({ block: 'nearest' })` un fotograma después de montarse su opción.
- `aria-haspopup`: con el buscador dentro del popup el primitivo pone `role="combobox"` y
  `aria-haspopup="dialog"` en el disparador (`ComboboxTrigger.js:141-143`), porque el popup es un
  `role="dialog"` (`ComboboxPopup.js:89`). El tablero dibuja `listbox`. Se deja el del primitivo:
  anunciar `listbox` sería falso para lo que se abre. En la hoja de teléfono el disparador propio
  lleva también `aria-haspopup="dialog"`.

### Revisión visual contra el tablero (1440, 820, 375 px)
**Pendiente la captura real.** En esta sesión no hay navegador con el que renderizar, y ninguna
ruta monta todavía el componente (lo consume QC-166). Lo comprobado leyendo clases contra
`docs/diseno/canvas/CountrySelect.dc.html` y `qc.css`:
- Disparador: 44 px (`h-11` + `touchTarget`), 16 px, chevron que gira 180° con `aria-expanded`,
  «(+57)» en mono atenuado, «Sin país» en `text-muted-foreground`.
- Popup (1440 y 820 px): anclado al disparador, ancho del disparador (`w-(--anchor-width)`),
  padding 6 px, buscador arriba con icono y 16 px, lista `max-h-66` (264 px) con scroll, gap 2 px,
  opciones `min-h-11`, prefijo mono 13 px a la derecha, check al final con opacidad 0/1, el
  elegido con fondo `accent` (como `.opt.hl`), cambio de fondo en 100 ms.
- Hoja (375 px): asa 40×4, título = etiqueta, X ghost con `aria-label="Cerrar"` de 44 px,
  buscador `h-12`, opciones `min-h-12`, esquinas 16 px arriba, `max-h-[85dvh]`, safe-area abajo,
  sube con `translate-y-full` en 250 ms y sin desplazamiento con movimiento reducido.
- Desvíos menores: el buscador del popup mide 44 px (tablero: 40) por la regla de 44 px táctiles;
  el aviso sin coincidencias va en el área `role="status"` de `AutocompleteEmpty`, no como `.opt`.

### Salida
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (`confirm-catalog-import.test.ts`,
  `order-service.test.ts`); ninguno en archivos de T9.
- `pnpm exec vitest run tests/unit/shared-ui/country-select.test.tsx tests/unit/shared-ui/country-options.test.ts`:
  2 archivos, 26 pass.
- `pnpm exec vitest run guard`: 74/75 archivos, 1046 pass, 20 skipped, **1 fail**:
  `guard-buscadores` › «R7 (primitivo-fuera): ningun archivo de app/, components/ o hooks/
  importa los primitivos». La detona `components/shared/country-select.tsx`. No está en
  `tests/baseline-rojos.json`. `guard-catalogo-de-componentes` en verde.

### Bloqueo: choque del `design.md` con `guard-buscadores` (QC-233)
`design.md > 7.2/7.5` manda componer `components/ui/autocomplete`, pero
`tests/guards/guard-buscadores.test.ts` solo deja importarlo a `AsyncAutocomplete` y a su
definición, y su caso «R20: las excepciones son exactamente tres» congela la lista. El spec no
menciona esta guardia. Salidas posibles (decide el humano/leader; no toco `tests/guards`):
1. añadir `components/shared/country-select.tsx` a `EXCEPCIONES` con motivo («lista local fija,
   sin servidor») y actualizar el caso R20 a cuatro;
2. otra composición que no importe `components/ui/autocomplete` (exigiría cambiar el `design.md`).

### Veredicto
T9 implementada y con sus tests en verde; queda roja `guard-buscadores` por un choque del spec que
decide el leader, y la captura visual real pendiente.

## backend_dev · T1–T6 (consolidado por el implementer)

### Archivos
- T1: `package.json`, `pnpm-lock.yaml` (`libphonenumber-js@1.13.15`, sin peerDependencies, exporta
  `getCountries`, `getCountryCallingCode` y `CountryCode` desde la raíz; `metadata.min.json` 81,9 KB,
  19,6 KB gzip), `docs/architecture.md`, `tests/guards/guard-arquitectura-modulos.test.ts`
  (`PURE_PACKAGES`), `tests/unit/identity/usuarios/scope.test.ts`, `design.md > 6.2` (checks).
- T2: `db/schema.prisma`, `db/migrations/20261013120000_companies_country/{migration,down}.sql`,
  `tests/unit/identity/schema/companies-country-migration.test.ts`,
  `tests/guards/guard-identificador-de-request.test.ts` (conteos, ver desviaciones).
- T3: `lib/modules/errores/domain/{error-codes,error-catalog}.ts`, `lib/modules/identity/domain/errors.ts`,
  `tests/unit/errores/catalogo.test.ts` (87 → 88).
- T4: `lib/modules/identity/domain/{platform-actor,company-country-input,set-company-country}.ts`,
  `lib/modules/identity/ports/company-country-repository.ts`, `lib/modules/identity/index.ts`,
  `tests/unit/identity/set-company-country.test.ts`.
- T5: `lib/modules/identity/adapters/driven/persistence/company-country-prisma.ts`,
  `tests/integration/identity/company-country.int.test.ts`, `tests/integration/aislamiento.json`.
- T6: `lib/composition/index.ts`, `lib/modules/identity/adapters/driving/company-actions.ts`,
  `tests/unit/identity/company-actions.test.ts`.

### Salida (reportada por backend_dev)
- typecheck 0 errores; lint 0 errores (7 warnings previos, ajenos).
- Unitarios catálogo + T4 + T6 + `maestro-sin-empresa-actions`: 4 archivos, 88/88.
- `company-country.int.test.ts`: 5/5 contra base efímera.
- Migración: aplicada en la plantilla de test; rollback y re-up verificados en una copia.
- `vitest run guard`: todo verde salvo `guard-buscadores` R7 (ver bloqueo de T9).

## Mapa R<n> → test (consolidado)

| R | Test |
|---|---|
| R1 | `tests/integration/identity/company-country.int.test.ts` «R1: …»; `tests/unit/identity/schema/companies-country-migration.test.ts` «R1: …» |
| R2 | `tests/unit/identity/set-company-country.test.ts` «R2»; `company-country.int.test.ts` «R2» |
| R3 | `set-company-country.test.ts` «R3»; `company-country.int.test.ts` «R3» |
| R4 | `set-company-country.test.ts` «R4» (actor null, sin permisos, solo consultar) |
| R5 | `set-company-country.test.ts` «R5»; `tests/unit/identity/company-actions.test.ts` «R5» |
| R6 | `set-company-country.test.ts` «R6» (`co`, ` CO`, `COL`, `ZZ`) |
| R7 | `set-company-country.test.ts` «R7» |
| R8 | `set-company-country.test.ts` «R8»; `company-country.int.test.ts` «R8» |
| R9 | `company-actions.test.ts` «R9» (5 casos) |
| R10 | `company-country.int.test.ts` «R10»; `companies-country-migration.test.ts` «R10» |
| R11 | `companies-country-migration.test.ts` «R11» (3 casos) |
| R12 | `tests/guards/guard-dependencias-aprobadas.test.ts` (verde) |
| R13–R18 | `tests/unit/shared-ui/country-options.test.ts` y `country-select.test.tsx` (secciones de frontend arriba) |
| R19–R26 | `tests/unit/shared-ui/country-select.test.tsx` (sección T9 arriba) |

Ningún R sin test.

## Desviaciones del spec (decididas por el implementer, a revisar)
1. Conteos literales que el spec no previó, actualizados siguiendo el histórico de cada archivo:
   `DEPENDENCIAS_ESPERADAS` 42 → 43 y `MIGRACIONES_ESPERADAS` + `companies_country`
   (`guard-identificador-de-request.test.ts`); `catalogo.test.ts` 87 → 88 (T3 decía «sin cambios
   en sus aserciones»).
2. R10 con `'COL'`: la base responde `22001` (no cabe en `VARCHAR(2)`), no `23514`. La escritura se
   rechaza igual; el test espera `22001` para ese caso.
3. El barrel no reexporta el tipo del puerto (la guardia de barrel solo admite `./domain`).
4. El adaptador es una fábrica que recibe la conexión, para probarlo dentro de una transacción.
5. T9: `@base-ui/react` instalado es 1.7.0 (design decía 1.8.0); `aria-haspopup="dialog"` (tablero:
   `listbox`); buscador del popup 44 px (tablero: 40).

## Pendiente
- **Bloqueo T9:** `guard-buscadores` R7 (QC-233) prohíbe importar `components/ui/autocomplete` fuera
  de `AsyncAutocomplete` y R20 fija tres excepciones; `design.md > 7.2, 7.5` manda componerlo.
  Decide el leader/humano: excepción para `country-select.tsx` (R20 → cuatro) o cambiar el design.
- Revisión visual real a 1440/820/375 px.
- T10 (`./init.sh` verde, `archivos-en-vuelo --candidata`) espera al bloqueo.
