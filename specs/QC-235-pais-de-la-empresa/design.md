# QC-235 — País de la empresa · design

Requisitos: `specs/QC-235-pais-de-la-empresa/requirements.md` (R1–R26).
Tablero aprobado por el humano el 2026-10-13: **`docs/diseno/canvas/CountrySelect.dc.html`**.

## Lo que ya existe

Términos buscados: «country», «país», «prefijo», «CountrySelect», «libphonenumber», «empresas.modificar».

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board (`feature_list.json`) | QC-236 (teléfono del cliente, depende de QC-235), QC-166 (Área del Maestro, consume la acción y el componente), QC-230 (seed demo, `done`). Ninguna otra ficha con país de empresa. | Nada se duplica: QC-235 deja el servidor y el componente; la pantalla es de QC-166 y el teléfono de QC-236 (alcance sembrado). |
| `specs/` | Solo este spec nombra «country». `libphonenumber-js` aparece **descartada** en QC-42, QC-43, QC-66 y QC-154, siempre porque allí no se validaba formato; ninguna lo prohíbe para un país. | La aprobación del humano (2026-10-09) la trae ahora. **Choque real:** `tests/unit/identity/usuarios/scope.test.ts` (QC-66 R47) exige que **no** esté instalada → se ajusta (§ 6.3). |
| Código: permisos | `empresas.consultar` y `empresas.modificar` en `lib/modules/identity/domain/permissions.ts:220-226`, solo para el Maestro (`:310`). | Se reutiliza `empresas.modificar`; sin permiso nuevo. |
| Código: `Company` | `db/schema.prisma:151` (`@module identity`), RLS activado y forzado desde `20260904180600_companies_and_user_company`. Única escritura de empresas hoy: `initial-access-repository-prisma.ts`. | Se añade una columna; RLS ya está. |
| Código: actor sin empresa | El Maestro no tiene empresa (QC-161, `design.md > 9`); todo `currentActor()` actual devuelve `null` sin `getSessionContext()` (`tests/unit/identity/maestro-sin-empresa-actions.test.ts`). | Se necesita un actor de plataforma sin empresa (§ 3.1). Es la primera operación del Maestro. |
| Código: errores | Catálogo único en `lib/modules/errores/domain/error-codes.ts` y `error-catalog.ts`; no existe `company_not_found`. | Se añade (§ 3.4). |
| `components/shared/CATALOGO.md` | Filas consultadas: `Autocomplete` (`components/ui/autocomplete.tsx`), `AsyncAutocomplete`, `SharedSelect`/`SharedSelectControl`, `SelectField`, `PresentationSelect`, `Select`, `Sheet`, `FormSheet`, `FieldError`, `Label`, `Button`, `useIsMobile`, `touchTarget`. | Ninguna pieza elige país. `CountrySelect` es **nueva, paso 3 (componer)**: § 7.2. |

## 1. Resumen técnico

- Columna `companies.country` (`VARCHAR(2)`, nullable, `CHECK` de formato).
- Caso de uso `setCompanyCountry` en `identity`, autorizado con `empresas.modificar` sobre un
  **actor de plataforma** (sin empresa), validado con `zod` contra `getCountries()`.
- Server Action `setCompanyCountryAction` (`FormData`), sin `revalidatePath`.
- `libphonenumber-js` entra en `package.json`, en `docs/dependencias.md` y en la lista de paquetes
  puros del dominio.
- `components/shared/country-select.tsx` compone `Autocomplete` (escritorio y tablet) y `Sheet`
  (teléfono). Sus datos salen de `components/shared/country-options.ts`, un archivo puro.

## 2. Modelo de datos

### 2.1 Prisma

```prisma
model Company {
  ...
  country        String?   @db.VarChar(2)
  ...
}
```

Nombre en inglés y sin `@map`, porque columna y campo coinciden (decisión heredada de QC-4).

### 2.2 Migración `db/migrations/20261013120000_companies_country/`

`migration.sql`:

```sql
ALTER TABLE "companies" ADD COLUMN "country" VARCHAR(2);
ALTER TABLE "companies" ADD CONSTRAINT "companies_country_format"
  CHECK ("country" IS NULL OR "country" ~ '^[A-Z]{2}$');
```

`down.sql`:

```sql
ALTER TABLE "companies" DROP CONSTRAINT "companies_country_format";
ALTER TABLE "companies" DROP COLUMN "country";
```

- Las filas existentes quedan en `NULL` (R1): `ADD COLUMN` sin `DEFAULT` no reescribe datos.
- El `CHECK` vigila **el formato**, no la lista (R10). La lista cambia con la versión de la
  librería: atarla a la base obligaría a migrar en cada actualización. La lista la valida el
  dominio (R6).
- **RLS:** `companies` ya tiene `ENABLE` y `FORCE ROW LEVEL SECURITY`. Esta migración no añade
  tablas ni policies y no toca RLS. La autorización vive en el caso de uso
  (`docs/architecture.md > Acceso a datos y autorizacion`).
- `guard-empresa-en-esquema` ya exime a `companies` (es la propia empresa). No cambia.

## 3. Dominio (`lib/modules/identity/domain/`)

### 3.1 Actor de plataforma — `platform-actor.ts` (nuevo)

```ts
export type PlatformActor = { readonly id: string; readonly permissions: readonly string[] };
export function requirePlatformPermission(
  actor: PlatformActor | null | undefined,
  permission: PermissionCode,
): asserts actor is PlatformActor  // delega en assertPermission con UnauthorizedError
```

- No lleva `companyId`, y eso es lo que pide R5: el Maestro no tiene empresa, y la empresa sobre la
  que actúa llega en la entrada.
- Delega en `assertPermission` (`require-permission.ts`): la pertenencia exacta sigue teniendo una
  sola implementación (QC-74 R12).
- `Actor` (con empresa) no cambia, y ninguna operación con ámbito de empresa usa este tipo.

### 3.2 Entrada — `company-country-input.ts` (nuevo)

```ts
const COUNTRIES: ReadonlySet<string> = new Set(getCountries());
export const setCompanyCountrySchema = z.strictObject({
  companyId: z.uuid(),
  country: z.union([
    z.literal('').transform(() => null),
    z.string().refine((c) => COUNTRIES.has(c)),
  ]),
});
// salida: { companyId: string; country: CountryCode | null }
```

- `''` significa «sin país» (R3). Un campo ausente o `null` **no** pasa (R7): un formulario que no
  manda el campo no vacía el país por accidente.
- Comparación exacta, sin `trim` ni mayúsculas (R6). El componente nunca produce esas formas.
- Usa `z.uuid()` o el validador de UUID que ya usen los esquemas de `identity`
  (`work-group-input.ts`). El implementer lo alinea al leerlo.

### 3.3 Caso de uso — `set-company-country.ts` (nuevo)

```ts
export type SetCompanyCountryDeps = { readonly companies: CompanyCountryRepository };
export function createSetCompanyCountry(deps): (
  actor: PlatformActor | null | undefined, input: unknown) => Promise<void>
```

El orden es el de `rename-work-group.ts`:

1. `requirePlatformPermission(actor, 'empresas.modificar')` (R4). Va primero: antes de `zod` y
   antes del puerto.
2. `setCompanyCountrySchema.safeParse(input)` → si falla, `ValidationError` (R6, R7).
3. `deps.companies.setCountryOfAlive(companyId, country)` → `'ok' | 'not_found'`.
4. Si devuelve `'not_found'` → `CompanyNotFoundError` (R8).

### 3.4 Error — `CompanyNotFoundError` (nuevo, en `errors.ts`)

- `code = 'company_not_found'`.
- Enmienda al catálogo único:
  - `error-codes.ts`: el código y su línea de enmienda (2026-10-13, QC-235).
  - `error-catalog.ts`: la clave `errors.company_not_found` con el texto «La empresa solicitada no
    existe.», el mismo patrón que `user_not_found`, `work_group_not_found` y `customer_not_found`.
- La aprobación del spec incluye esta enmienda, como pasó en QC-81 y QC-92.
- «No existe» y «dada de baja» comparten código. El Maestro ve todas las empresas, así que aquí
  no hay oráculo entre empresas. Se mantiene el mismo criterio que el resto de `*_not_found`.

### 3.5 Pureza del dominio

`company-country-input.ts` importa `libphonenumber-js` desde `domain/`. Para eso hay que hacer dos
cambios:

- añadir `'libphonenumber-js'` a `PURE_PACKAGES` en
  `tests/guards/guard-arquitectura-modulos.test.ts:288`;
- actualizar las dos menciones de «paquetes puros (hoy: `zod`, `papaparse`)» en
  `docs/architecture.md` (líneas 344 y 392).

Es un paquete de datos y funciones puras: no hace E/S, no usa framework y no tiene estado global
mutable. Se admite con el mismo criterio que `papaparse`. QC-236 lo necesitará también en el
dominio de `clientes` para normalizar teléfonos.

## 4. Puerto y adaptador driven

`lib/modules/identity/ports/company-country-repository.ts` (nuevo):

```ts
export interface CompanyCountryRepository {
  setCountryOfAlive(companyId: string, country: CountryCode | null): Promise<'ok' | 'not_found'>;
}
```

`CountryCode` se declara en el dominio como `string` con marca, o se importa como tipo de
`libphonenumber-js` (`import type`, que es puro). El implementer elige una de las dos, pero tiene
que ser **la misma** en dominio, puerto y componente.

`lib/modules/identity/adapters/driven/persistence/company-country-prisma.ts` (nuevo):

```ts
const { count } = await prisma.company.updateMany({
  where: { id: companyId, deletedAt: null },
  data: { country },
});
return count === 1 ? 'ok' : 'not_found';
```

- Hace una sola sentencia, sin leer antes: `updateMany` con `deletedAt: null` resuelve «no existe» y
  «dada de baja» sin carrera.
- Solo escribe `country`. `updatedAt` lo pone `@updatedAt` (R2).
- No se amplía `company-directory-prisma.ts`. Ese archivo es de lectura y su comentario dice que
  es la única consulta que cruza todas las empresas. Mezclar una escritura ahí empeora ese contrato.

## 5. Composición y Server Action

### 5.1 Composición

`lib/composition/index.ts`: dentro del objeto `identity`, añadir
`setCompanyCountry: createSetCompanyCountry({ companies: companyCountryRepository })`. El barrel
`lib/modules/identity/index.ts` reexporta `createSetCompanyCountry`, `SetCompanyCountryDeps`,
`PlatformActor`, `CompanyNotFoundError` y el tipo del puerto.

### 5.2 `lib/modules/identity/adapters/driving/company-actions.ts` (nuevo, `'use server'`)

```ts
export type SetCompanyCountryFormState = { status: 'idle' } | { status: 'success' } | ErrorState;

export async function setCompanyCountryAction(
  _prev: SetCompanyCountryFormState, formData: FormData,
): Promise<SetCompanyCountryFormState>
```

| Entrada (`FormData`) | Valor |
|---|---|
| `companyId` | UUID de la empresa |
| `country` | código ISO (`CO`) o `''` para dejarla sin país |

- **Actor (R5, R9):** `currentPlatformActor()` lee solo `identity.getSessionUser()` dentro de
  `runInRequestScope` y devuelve `{ id, permissions }`, o `null` si no hay sesión. No llama a
  `getSessionContext()`: exigir empresa dejaría fuera al Maestro, que es el único que tiene
  el permiso.
- Los valores se pasan crudos al caso de uso (`formData.get(...)`). Un campo ausente llega como
  `null` y lo rechaza el esquema (R7).
- Los errores pasan por `createErrorStateTranslator(IdentityError, observabilidad.readRequestIdHeader)`,
  como en `work-group-actions.ts`.
- No llama a `revalidatePath` (R9): `/maestro/empresas` aún no existe, y adivinarla sería inventarla.
  QC-166 la añadirá.
- La acción no se reexporta desde `index.ts`: QC-166 la importa por su ruta exacta, como hace
  QC-85 con las de grupos.
- **Contrato con QC-166:** el formulario manda `country` con un `<input type="hidden">` alimentado
  por el `value` de `CountrySelect` (`value ?? ''`). El componente no lleva `name` (§ 7.3).

## 6. Dependencia `libphonenumber-js`

### 6.1 Qué hace y qué código nos ahorra

Se usan `getCountries()` (la lista de regiones con prefijo, unas 240), `getCountryCallingCode()`
(el prefijo de cada una) y el tipo `CountryCode`. Sin la librería habría que mantener a mano una
tabla de unos 240 países con su prefijo, y actualizarla cuando cambien. QC-236 la usará además para
parsear y validar teléfonos, que es su función principal. Así hay una sola fuente para país y
teléfono (decisión cerrada «¿Librería?»).

### 6.2 Los cuatro checks

Este `design.md` se escribió **sin red**: el subagente no tiene `npm` ni acceso al registro. Por la
regla 6 de `CLAUDE.md`, un check sin verificar es **desconocido**, no un sí. Lo que se sepa de
memoria no cuenta.

| Check | Resultado |
|---|---|
| 1. No `deprecated` | **DESCONOCIDO** (sin verificar) |
| 2. Release en los últimos 12 meses | **DESCONOCIDO** (sin verificar) |
| 3. ≥ 10.000 descargas semanales | **DESCONOCIDO** (sin verificar) |
| 4. Licencia MIT / Apache-2.0 / BSD / ISC | **DESCONOCIDO** (sin verificar) |

Se cierran en **T1**, antes de instalar, con
`npm view libphonenumber-js deprecated time.modified license version` y la API de descargas de npm.
**Si alguno falla, se para y se devuelve al humano.** No se instala, ni siquiera como excepción,
sin una nueva decisión suya.

Lo que falta verificar del paquete, también en T1:

- que exporta `getCountries`, `getCountryCallingCode` y el tipo `CountryCode` desde la raíz;
- sus `peerDependencies` (se espera que no tenga ninguna);
- su tamaño en el bundle del cliente. Importa la metadata «min» por defecto, y ese tamaño no se ha
  medido.

### 6.3 Fila propuesta para `docs/dependencias.md` (se escribe en T1 con los datos reales)

```
| `libphonenumber-js` | Lista de países (`getCountries`) y prefijo de cada uno (`getCountryCallingCode`) para el país de la empresa y `CountrySelect` (QC-235); QC-236 la usará para parsear y validar teléfonos. La alternativa es mantener a mano una tabla de ~240 países con su prefijo | aprobada | <fecha de T1> | Los cuatro checks verificados el <fecha> contra el registro de npm: <deprecated>; última release `<versión>` del <fecha>; <N> descargas semanales; licencia <licencia>. Aprobada por el humano el 2026-10-09 al acotar QC-235 y reafirmada al aprobar el spec (F1.4). Paquete puro admitido en el dominio (`PURE_PACKAGES`), como `papaparse`. Enmienda QC-66 R47: `tests/unit/identity/usuarios/scope.test.ts` la tenía como descartada porque allí no se validaba formato; ese motivo sigue valiendo para usuarios y no se valida ningún teléfono de usuario. |
```

**`tests/unit/identity/usuarios/scope.test.ts`** (QC-66 R47) prohíbe que esté instalada, y con la
instalación se pondría rojo. Se quita `'libphonenumber-js'` de `CANDIDATAS_DESCARTADAS` y su
mención del JSDoc. Las otras cuatro candidatas y el ancla `bcryptjs` no cambian. Es una enmienda
explícita a un test ajeno, aprobada con este spec. No es un test que se debilita a escondidas.

## 7. `CountrySelect`

### 7.1 Referencia de diseño

`docs/diseno/canvas/CountrySelect.dc.html`, aprobado por el humano el 2026-10-13. Decisiones del
tablero que este spec fija:

- escritorio y tablet usan un popup anclado con buscador; teléfono (≤ 640 px) usa una hoja inferior;
- «Sin país» va siempre primero;
- se busca por nombre (sin tildes ni mayúsculas) o por prefijo (`57`/`+57`);
- los países que comparten prefijo se listan por separado;
- los nombres salen de `Intl.DisplayNames('es')` y se ordenan con `localeCompare('es')`.

### 7.2 Regla de decisión (`docs/perfil-agentes.md > Regla de decisión para componentes`)

1. **Reutilizar:** no hay ninguna pieza que elija país. `SharedSelect`/`SelectField`/`Select` no
   tienen búsqueda («No cubre: búsqueda»). `AsyncAutocomplete` y `PresentationSelect` consultan al
   servidor por páginas, y aquí la lista es local y fija.
2. **Extender:** meter búsqueda local en `SharedSelectControl` cambiaría su primitivo (Base UI
   `Select` no tiene buscador). Meter lista local en `AsyncAutocomplete` contradice su alcance
   («No cubre: filtrar en el cliente»). Ninguna de las dos es una prop opcional sin romper.
3. **Componer → sí.** `CountrySelect` compone `Autocomplete` (`components/ui/autocomplete`),
   `Sheet`/`SheetContent`, `Button`, `Label`, `FieldError` y `useIsMobile`.

**Excepción declarada para `components/shared`** (`> Regla de decisión`, «Subirla antes solo con
excepción declarada»): hoy no lo consume ninguna ruta. Nace compartido porque tiene dos consumidores
identificados en el board: **QC-166** (`/maestro/empresas`, edición del país de la empresa) y
**QC-236** (formulario de cliente, país del teléfono). La decisión cerrada «Un solo
`CountrySelect`, reutilizado en QC-236» lo pide así.

### 7.3 Contrato

`components/shared/country-select.tsx` (`'use client'`):

```ts
type CountrySelectProps = {
  readonly value: CountryCode | null;
  readonly onChange: (value: CountryCode | null) => void;
  readonly label: string;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly id?: string;      // base de los id de etiqueta, error y lista; por defecto useId()
  readonly testId?: string;  // data-testid del disparador; la lista y opciones derivan de él
};
```

- Las props `value`, `onChange`, `label`, `disabled` y `error` son las del tablero. `id` y `testId`
  son las mismas que ya tienen otros campos compartidos (`TextField`, `PasswordField`) y no cambian
  la UI.
- **Sin `name`, sin `<input>` oculto:** el tablero no lo pide, y el consumidor lo pone (§ 5.2).
- **Solo controlado:** no hay `defaultValue`.
- No importa nada de `lib/modules/**`, `lib/composition` ni de Server Actions (R26).

### 7.4 Datos — `components/shared/country-options.ts` (nuevo, puro, «sin UI»)

```ts
export type CountryOption = { code: CountryCode; name: string; callingCode: string };
export function listCountryOptions(): readonly CountryOption[];               // R13
export function filterCountryOptions(options, query: string): readonly CountryOption[]; // R16, R17
export function countryOptionLabel(option: CountryOption): string;            // «Colombia (+57)», R15
export function isCallingCodeQuery(query: string): boolean;                   // /^\+?\d+$/ tras trim
```

- `listCountryOptions()` se calcula una vez por módulo:
  - `getCountries()` → `{ code, name: displayNames.of(code) ?? code, callingCode: getCountryCallingCode(code) }`;
  - después, `sort((a, b) => a.name.localeCompare(b.name, 'es'))`.
- Si `Intl.DisplayNames` no conoce una región, devuelve `undefined` o el propio código. En ese
  caso la opción se muestra con el código: nada queda sin nombre.
- `filterCountryOptions`:
  - **Si el texto es de prefijo** (`isCallingCodeQuery`): quita el `+` y se queda con las opciones
    cuyo `callingCode.startsWith(dígitos)`.
  - **Si no:** normaliza con `toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')`, que es la
    misma regla que el script del tablero, y se queda con las opciones cuyo nombre normalizado
    `includes` el texto normalizado.
  - El texto vacío (tras `trim`) devuelve todas las opciones.
- «Sin país» no es una `CountryOption`: lo pinta el componente cuando el texto está vacío (R14).
  Así el filtro no tiene casos especiales.
- Separar este archivo hace que la lógica de R13, R16 y R17 se pruebe sin DOM. Lleva fila
  propia en el catálogo, «sin UI», con el mismo criterio que `file-types.ts`.

### 7.5 Comportamiento y composición

| Ventana | Primitivo | Estructura |
|---|---|---|
| > 640 px (R22) | `Autocomplete` controlado (`open`, `value` = texto del buscador, `filteredItems` = `filterCountryOptions(...)`, `mode="none"`) | Disparador `AutocompleteTrigger` (botón con el valor y el chevron) → `AutocompleteContent` anclado al disparador → dentro, `AutocompleteInputGroup` con `AutocompleteIcon` + `AutocompleteInput` arriba y `AutocompleteList` de 264 px de alto máximo con scroll. |
| ≤ 640 px (R23) | `Sheet` + `SheetContent side="bottom"` con `Autocomplete` en `inline open` dentro | Asa decorativa, título = `label`, botón «Cerrar» (ghost, icono X, `aria-label="Cerrar"`), buscador de 48 px y la misma lista con opciones de 48 px. |

- **Disparador del popup:** con el buscador dentro del popup, Base UI ancla el posicionador al
  `Trigger` del Autocomplete. Está verificado en `@base-ui/react@1.8.0`
  (`ComboboxPositioner.js:64`: `anchor ?? (inputInsidePopup ? triggerElement : ...)`), y
  `Autocomplete.Trigger` existe (`autocomplete/index.parts.d.ts:3`). `components/ui/autocomplete.tsx`
  no lo exporta → **extensión (paso 2):** se añade `AutocompleteTrigger`, una envoltura fina con
  `data-slot="autocomplete-trigger"`. Los usos actuales no cambian, porque solo se suma una
  exportación, y la fila del catálogo se actualiza.
- **Elegir (R19):** cada `AutocompleteItem` lleva `onClick` → `onChange(code)` o `onChange(null)`.
  Después cierra y vacía el buscador. `AsyncAutocomplete` ya elige así (`async-autocomplete.tsx:314`).
  Enter sobre la opción resaltada dispara el mismo clic del primitivo.
- **Teclado (R20):** las flechas y Enter los da el primitivo. Escape cierra en el popup (por
  defecto del primitivo). En la hoja, `Sheet` se monta con `disableEscapeDismissal={false}` y
  `disablePointerDismissal={false}`, igual que el cajón de `sidebar.tsx`: cerrar no es perder un
  formulario, y R20 pide que Escape cierre sin cambiar nada.
- **Elegido al abrir (R21):**
  - la opción de `value` lleva `data-selected` y la marca de verificación visible (opacidad 1,
    como en el tablero);
  - al abrir, el componente llama a `scrollIntoView({ block: 'nearest' })` sobre ella.
  - Si el primitivo controla `aria-selected` por el resaltado, el estado accesible de «elegida» se
    da resaltando esa opción al abrir (`onItemHighlighted`/`actionsRef` si el primitivo lo
    permite). El implementer lo verifica en el paquete instalado y lo anota en
    `progress/impl_QC-235*.md`. El test comprueba la marca y el desplazamiento.
- **Hoja de teléfono (R23):** el foco va al buscador con `initialFocus` de `SheetContent`, que se
  reenvía al `Popup` de Base UI Dialog. Se usa `showCloseButton={false}` y el botón «Cerrar» lo pone
  el componente, porque el de `SheetContent` está fijo en inglés («Close»).
- **Deshabilitado (R24):** el disparador va `disabled` y no abre.
- **Error (R25):** el disparador lleva `aria-invalid="true"` y `aria-describedby` apunta al id de
  `FieldError`, que se pinta bajo el campo con su icono, como en el tablero.
- **Etiqueta (R15):** `Label` con id → el disparador lleva `aria-labelledby`. El primitivo pone
  `aria-haspopup`/`aria-expanded`; el test los comprueba igual.
- **Ventana:** `useIsMobile(641)` (§ 7.6) decide cuál de las dos se monta. Hasta montar devuelve
  `false`, así que el primer pintado es el disparador, que es igual en los dos casos. No hay
  parpadeo de la lista, porque nace cerrada.

### 7.6 Extensión de `useIsMobile` (paso 2)

El tablero corta en **640 px** y `useIsMobile` en 768 (`hooks/use-mobile.ts:3`). Se añade un
parámetro opcional `breakpoint = 768`. El cuerpo y el patrón SSR del archivo generado por shadcn no
cambian; solo `MOBILE_BREAKPOINT` pasa a ser el valor por defecto del parámetro. `sidebar.tsx`, el
único consumidor, sigue llamando sin argumentos. Fila del catálogo: «Puntos de extensión:
`breakpoint`».

### 7.7 Medidas, animación y multiplataforma (del tablero)

- **Disparador:** 44 px de alto (`touchTarget`), letra de 16 px. Muestra el valor como «Nombre» y
  el «(+57)» en monoespaciada atenuada; «Sin país» va en `muted-foreground`. El chevron gira 180°
  al abrir.
- **Popup:** opciones de al menos 44 px (R22). El tablero las pide en tablet y se aplican también
  en escritorio por `docs/perfil-agentes.md > frontend_dev` regla 9: es un solo tamaño y no hay
  `:hover` como única vía. El prefijo va a la derecha en monoespaciada de 13 px y la marca de
  verificación al final. El buscador va a 16 px en todas las tallas: `md:text-base` sobre el
  `md:text-sm` del primitivo, para que iPad no haga zoom.
- **Animación:**
  - popup: la de `AutocompleteContent`, que entra en `--dur-base` (200 ms) y sale en `--dur-fast`
    (150 ms), con fundido y escala `zoom-in-95` desde `--transform-origin`. El tablero dice `.96`;
    se usa la del primitivo, la misma de los popups de Campos, que el tablero cita como referencia;
  - resaltado: cambio de fondo en 100 ms (`transition-colors duration-100`);
  - hoja: sube del 100 % a 0 en 250 ms (clases sobre `SheetContent`: `data-starting-style` y
    `data-ending-style` con `translate-y-full` y `duration-[250ms]`);
  - con movimiento reducido no hay desplazamiento: `motion-reduce:transition-none`.
- **Hoja:** `pb-[env(safe-area-inset-bottom)]` y altura máxima `85dvh` con la lista en scroll.
- **Solo escritorio:** nada.

### 7.8 Desvío del texto del tablero, no de su dibujo

La ficha del tablero dice que, en teléfono, «la lista va en la hoja inferior de `FormSheet`». Lo he
comprobado en el código y no encaja:

- `FormSheet` (`components/shared/form-sheet.tsx`) monta un `<form>` con `formAction` obligatorio y
  un pie con «Cancelar» y «Guardar» (`SaveButton`).
- La hoja del dibujo no tiene pie ni guardar: tiene asa, título, X, buscador y lista.
- Montarla con `FormSheet` obligaría a pasar una acción falsa y pintaría dos botones que el
  tablero no tiene. Además metería un `<form>` dentro del formulario de QC-166.

Se usa la base de `FormSheet`: `Sheet` + `SheetContent side="bottom"`, sin `isForm`, que da
exactamente el dibujo aprobado. **Lo confirma el humano al aprobar este spec (F1.4).**

### 7.9 Catálogo (`components/shared/CATALOGO.md`), en el mismo commit que cada pieza

- `Autocomplete`: se añade `AutocompleteTrigger` a «Pieza» y a «Cubre» («disparador de botón para
  el buscador dentro del popup»).
- `CountrySelect` (nueva, `components/shared/country-select.tsx`):
  - Alcance: elegir un país o ninguno; búsqueda por nombre o prefijo; popup y hoja de teléfono.
    No cubre teléfono, país por defecto ni `name` de formulario.
  - Puntos de extensión: `id`, `testId`.
  - Base de: `Autocomplete`, `Button`, `FieldError`, `Label`, `Sheet`, `useIsMobile`,
    `touchTarget`, `listCountryOptions`.
  - Diseño: `docs/diseno/canvas/CountrySelect.dc.html`.
- `listCountryOptions`, `filterCountryOptions`, `countryOptionLabel`, `isCallingCodeQuery`
  (`components/shared/country-options.ts`): fila «sin UI».
- `useIsMobile`: punto de extensión `breakpoint`.

## 8. Pruebas y trazabilidad

No hay E2E (decisión cerrada, va en QC-166).

| R | Test |
|---|---|
| R1 | `tests/unit/identity/schema/companies-country-migration.test.ts` (columna nullable, sin `DEFAULT`, sin backfill) + `tests/integration/identity/company-country.int.test.ts` (fila previa queda `NULL`) |
| R2, R3 | `tests/unit/identity/set-company-country.test.ts` (puerto simulado recibe `CO` / `null`) + `company-country.int.test.ts` (persiste `CO` y `NULL`; `name`, `nameNormalized`, `createdAt`, `deletedAt` intactos) |
| R4, R5 | `set-company-country.test.ts` (actor `null`, sin permisos, `empresas.consultar` solo → `unauthorized` sin tocar el puerto; actor sin empresa con `empresas.modificar` → ok) |
| R6, R7 | `set-company-country.test.ts` (`co`, ` CO`, `COL`, `ZZ`, `null`, ausente, `companyId` no UUID → `invalid_input`, puerto intacto) |
| R8 | `set-company-country.test.ts` (puerto `not_found` → `company_not_found`) + `company-country.int.test.ts` (inexistente y dada de baja → `not_found`, ninguna fila cambia) |
| R9 | `tests/unit/identity/company-actions.test.ts` (composición doble: actor solo de `getSessionUser`, `getSessionContext` no se llama; `success` y estado de error con `code`; `revalidatePath` no se llama) |
| R10 | `company-country.int.test.ts` (`'co'`, `'COL'`, `'C1'` por SQL crudo → `23514`, con `SAVEPOINT`) |
| R11 | `companies-country-migration.test.ts` (`down.sql` quita restricción y columna, y nada más) |
| R12 | `tests/guards/guard-dependencias-aprobadas.test.ts` (existente, verde con la fila) + `tests/unit/identity/usuarios/scope.test.ts` (enmendado) |
| R13, R16, R17, R18 (lógica) | `tests/unit/shared-ui/country-options.test.ts` (todos los de `getCountries()`; orden `localeCompare('es')`; `peru`→Perú; `57`/`+57`→Colombia; `1`→CA y US separados; sin coincidencias → vacío) |
| R13–R26 (UI) | `tests/unit/shared-ui/country-select.test.tsx` (proyecto `ui`; `matchMedia` simulado a 1024 y 375 px; `scrollIntoView` espiado; montado sin providers ni mocks de servidor) |
| R26 (aislamiento) | `country-select.test.tsx`: un caso lee el fuente y comprueba que no importa `@/lib/modules`, `@/lib/composition` ni `'use server'` |

Los nombres de los casos llevan `R<n>` (`docs/perfil-agentes.md > Comentarios`).
`company-country.int.test.ts` se declara en `tests/integration/aislamiento.json > transaccion`.

## 9. Alternativas descartadas

1. **Validar la lista de países con un `CHECK ... IN (...)` en la base.** Ataría la migración a la
   versión de la librería: cada actualización que añada o quite una región exigiría una migración.
   Se queda el `CHECK` de formato (R10), y la lista la valida el dominio (R6).
2. **Un puerto `CountryCatalog` con adaptador driven en vez de admitir `libphonenumber-js` en el
   dominio.** Es una capa más para una función pura sin E/S, y QC-236 tendría que repetir el
   puerto en `clientes`. Se descarta en favor de `PURE_PACKAGES`, el mismo precedente que
   `papaparse`.
3. **Reutilizar el `Actor` con empresa y exigir `getSessionContext()`.** El Maestro no tiene
   empresa y quedaría fuera de la única operación que su permiso le da (QC-161 `design.md > 9`).
4. **Base UI `Combobox` en vez de `Autocomplete`.** Tiene valor seleccionado nativo, pero
   `components/ui` no lo envuelve: habría que añadir un primitivo nuevo con su fila y su pase de
   diseño. El tablero pide componer `components/ui/autocomplete`, y `AsyncAutocomplete` ya
   demuestra el patrón de elegir con `onClick`.
5. **Montar la hoja con `FormSheet`.** § 7.8.
6. **Usar `useIsMobile()` tal cual (768 px).** Pondría la hoja en tablets de 641–767 px, en contra
   del tablero aprobado (≤ 640 px).
7. **Mantener una tabla de países propia en el repo.** Es lo que la librería ahorra (§ 6.1) y
   contradice la decisión cerrada «¿Librería?».

## 10. Riesgos y desconocidos

- **Los cuatro checks de `libphonenumber-js`: DESCONOCIDOS** hasta T1 (§ 6.2). Si alguno falla, se
  para.
- **Nombres de `Intl.DisplayNames` distintos entre Node y el navegador.** La ICU de Node y la de
  Safari o Chrome pueden diferir en alguna región rara, y el disparador se pinta en el servidor.
  Para los países habituales no se espera diferencia, pero **no está verificado**. Si apareciera un
  aviso de hidratación en QC-166, la salida es calcular la etiqueta del disparador tras montar. Los
  tests no fijan nombres salvo Colombia, Perú, México, Canadá y Estados Unidos.
- **Que Base UI marque `aria-selected` por resaltado y no por valor:** se verifica en T8 (§ 7.5).
- **Tamaño de la metadata en el bundle del cliente:** no medido; se anota en T1.
