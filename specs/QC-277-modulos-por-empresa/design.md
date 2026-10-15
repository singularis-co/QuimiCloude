# QC-277 — Módulos por empresa · design.md

> Requisitos: `requirements.md` (R1–R38, decisiones D1–D16, preguntas P2–P7 con su defecto).
> Aquí va el **cómo**.
>
> **Enmienda del 2026-10-15 (D13–D16).** Los interruptores dejan la columna `companies.addons` y
> pasan a dos tablas: el catálogo `addons` y las excepciones `company_addon_overrides`. Se
> reescriben § 2.2, 2.3, 2.5, 3.1, 6.3, 10, 11 (punto 1), 13 y 14. Qué cambia y qué no, en § 15.
>
> **Regla transversal.** Ningún comentario nuevo de producción cita `QC-<n>`, `R<n>`, `design.md` ni
> «decisión cerrada» (`docs/conventions.md > Comentarios`). En los tests, `R<n>` va en el nombre del
> caso. Al tocar una línea con comentario viejo, se limpia esa línea; el resto no se arrastra.
>
> **Sin UI nueva.** No hay componente nuevo ni cambio visual: el logo cambia de destino y el botón
> «Importar» de Inventario gana una condición más. No hace falta pase `/design`
> (`docs/perfil-agentes.md > Pase de diseño`). La pantalla de interruptores es de QC-278.

---

## Lo que ya existe

Términos buscados: «módulo», «añadido», «plan», «permisos por empresa», «company_modules»,
«addons», «interruptor», «aterrizaje», «logo», «webhook», «cron».

Sitios:

- el board (`feature_list.json`, todos los estados, por `name` y `description`);
- `specs/` con grep;
- el código con el grafo (`search_graph`, `get_code_snippet`) y con Grep/Read.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board | **QC-188** (`cancelled`): «permisos limitados por el plan», el mismo recorte rol ∩ plan resuelto en la sesión. | Absorbida por esta ficha (alcance sembrado). No se reabre. |
| Board | **QC-182 / QC-185 / QC-186** (`pending`): planes con lista de permisos. | Fuera de alcance (D16). Cuando lleguen, un plan será «conjunto de añadidos + precio»: sus añadidos serán la base, y las excepciones de `company_addon_overrides` prenden o apagan sobre ella (§ 2.3). |
| Board | **QC-278** (`pending`): pantalla de interruptores. | Fuera. Consume las tres Server Actions de § 6. |
| Board | **QC-275** (`in_progress`, Christian; su código ya está en `dev`): proveedor IA por empresa. | Se reutiliza tal cual (§ 8.1). Choques en § 12. |
| Board | **QC-280** (`in_progress`, Christian): botón de PDF con tooltip cuando falta el proveedor. | No se toca su código. El botón ya se oculta solo por `canUploadDocuments` (§ 5.3). |
| Board | **QC-214** (`done`): evidencia por paso. | Fuera de esta ficha; queda núcleo de hecho (P5). |
| `specs/` | **QC-162**: tabla `company_events`, cuyo `kind` admite tipos nuevos sin migrar (`<ambito>.<accion>`). Anuncia que QC-277 escribirá `{ "module": … }` y que, si vive fuera de `identity`, tendrá que pedirlo por su contrato. | Se reutiliza el historial con dos tipos nuevos. Todo vive en `identity`, así que no hace falta contrato nuevo. |
| `specs/` | **QC-75**: menú y corte de pantalla por permiso. **QC-93**: aterrizaje derivado del menú filtrado. | Se reutilizan sin cambiar su regla: el permiso efectivo entra por el mismo campo. |
| Código: sesión | `resolve-session.ts` relee rol, permisos y empresa **en cada petición** con un solo `findFirst` (`session-user-prisma.ts:78-98`). La empresa ya viaja en ese `JOIN` (`company: { select: { deletedAt } }`). | Punto de cruce de D8 (§ 3). Las excepciones prendidas salen como relación de ese mismo `findFirst`: una invocación del lector, como hoy (§ 3.1, P6). |
| Código: catálogo en la base | `ai_providers` (QC-275, `20261013150000_ai_providers`): catálogo global con PK de texto, sembrado por la migración, RLS forzada y exento en `guard-empresa-en-esquema`. | Mismo patrón para `addons` (§ 2.3). |
| Código: catálogo | `PERMISSIONS` y `SEED_ROLE_PERMISSIONS` en `identity/domain/permissions.ts`, centralizados a propósito. | El catálogo de añadidos vive al lado (§ 2.1). |
| Código: menú | `filterNavItemsByPermissions` y `firstVisibleNavHref` (`lib/shared/navigation/private-nav.ts:503-546`). El grupo «Integraciones» cuelga entero de `integraciones.modificar`. | Sin cambios de regla: el layout ya les pasa `user.permissions`, que pasa a ser el permiso efectivo. |
| Código: corte de pantalla | `requirePagePermission` (`identity/adapters/driving/require-page-permission.ts:48-56`). | Se reutiliza. Nace su hermana `requirePageAddon` para las tres pantallas sin permiso propio (§ 5.2). |
| Código: puntos cruzados | La importación de catálogo exige `proveedores.modificar` y la de fórmula `recetas.modificar` (`documentos/domain/actor.ts:45,52`). La de Excel exige `inventario.modificar` (`inventario/adapters/driving/inventory-import-actions.ts:73,91`). | El recorte por permiso no las apaga. Se cierran con `requireAddon` en el caso de uso (§ 5.1). |
| Código: logo y aterrizaje | Logo fijo a `ASSIGNED_ORDERS_ROUTE` (`components/private/app-sidebar.tsx:119`). El middleware manda `/login` con sesión a `ASSIGNED_ORDERS_ROUTE` (`route-guard-middleware.ts:125`). El login ya aterriza en `firstVisibleNavHref` (`login-action.ts:122-126`). | Logo y middleware pasan por una ruta nueva `/inicio` (§ 7). |
| Código: fuera de sesión | Dos rutas en `app/api`: el webhook de documentos (`documentos/trabajos`) y el cron de caducidad (`cron/caducar-pedidos`, recorre `listActiveCompanyIds`). `WHATSAPP_WEBHOOK_ROUTE_BASE` está declarada pero sin ruta. | El webhook gana un interruptor (§ 8). El cron no cambia (D12). Una guardia clasifica toda ruta futura (§ 9.3). |
| Código: E2E | `e2e/helpers/landing.ts` deriva el aterrizaje de los permisos del rol leídos de la base. Unos 70 specs crean su propia empresa con `prisma.company.create`. | El helper pasa a usar el permiso efectivo. Nace `e2e/helpers/addons.ts` (§ 10.2). |

**Componentes** (`components/shared/CATALOGO.md`). Filas consultadas:

- `BrandLogo`: no cubre «el enlace a inicio», que vive en `AppSidebar`. Se cambia solo el `href`.
- `DocumentUpload` y `AiProviderRequiredTooltip`: sin cambios.

No hay componente nuevo; pasos 3 y 4 de la regla de decisión: no aplican.

**Conclusión:** nada existente resuelve el alcance. Se reutiliza lo de la tabla y no se re-crea
nada.

---

## 1. Resumen técnico

- **Datos (enmienda D13–D16):** dos tablas nuevas.
  - `addons`: espejo del catálogo del código, sembrado por la migración. Una guardia comprueba que
    código y tabla coinciden.
  - `company_addon_overrides`: una fila por empresa y añadido con `enabled` verdadero o falso.
  - Sin planes, los interruptores prendidos de una empresa son sus filas con `enabled = true`.
- **Catálogo** en `identity/domain/company-addons.ts`. Tiene:
  - los cinco añadidos y los permisos que arrastra cada uno;
  - la dependencia `lectura_pdf → integraciones`;
  - la lista del núcleo;
  - las funciones puras `effectiveAddons` y `effectivePermissions`.
- **Sesión:** el `findFirst` de siempre trae también las excepciones prendidas de la empresa
  (P6). `resolveSession` recorta los
  permisos y expone `addons` en el `SessionUser`. A partir de ahí, menú, `requirePagePermission`,
  casos de uso y aterrizaje se apagan solos.
- **Puntos sin permiso propio:**
  - `requireAddon` en los casos de uso de importación (Excel, fórmula y catálogo);
  - `requirePageAddon` en sus tres pantallas;
  - `hasAddon` para el botón «Importar».
- **Logo y aterrizaje:** ruta `/inicio`, que redirige al primer enlace del menú efectivo.
- **Webhook de documentos:** termina en fallo definitivo el trabajo de una empresa sin la lectura
  de PDF activa.
- **Cron de caducidad:** sin cambios.
- **Operación del Maestro:** tres casos de uso (`getCompanyAddons`, `setCompanyAddon`,
  `setAllCompanyAddons`) y sus Server Actions en `company-actions.ts`. Cada cambio deja un evento
  en `company_events`.
- **Docs:** enmiendas a `docs/architecture.md` (§ 11).
- **Dependencias nuevas:** ninguna.

---

## 2. Modelo de datos

### 2.1 Catálogo — `lib/modules/identity/domain/company-addons.ts` (nuevo)

```ts
export const ADDONS = ['dashboard', 'proveedores', 'lectura_pdf', 'importacion_excel', 'integraciones'] as const;
export type Addon = (typeof ADDONS)[number];

export const ADDON_PERMISSIONS: Readonly<Record<Addon, readonly PermissionCode[]>> = {
  dashboard: ['dashboard.consultar'],
  proveedores: ['proveedores.consultar', 'proveedores.modificar'],
  lectura_pdf: ['documentos.consultar', 'documentos.modificar'],
  importacion_excel: [],
  integraciones: ['integraciones.modificar'],
};

export const ADDON_REQUIRES: Readonly<Record<Addon, readonly Addon[]>> = {
  dashboard: [], proveedores: [], importacion_excel: [], integraciones: [],
  lectura_pdf: ['integraciones'],
};

// Escrito uno a uno, no derivado: un permiso nuevo tiene que clasificarse a mano.
export const CORE_PERMISSIONS: readonly PermissionCode[] = [
  'inventario.consultar', 'inventario.modificar', 'recetas.consultar', 'recetas.modificar',
  'unidades.consultar', 'unidades.modificar', 'pedidos.consultar', 'pedidos.modificar',
  'usuarios.consultar', 'usuarios.modificar', 'asignaciones.consultar', 'asignaciones.modificar',
  'asignaciones.ejecutar', 'terminados.consultar', 'clientes.consultar', 'clientes.modificar',
  'empaque.modificar', 'empresas.consultar', 'empresas.modificar', 'acondicionamiento.modificar',
  'entregas.modificar', 'entregas.anular',
];

export function isAddon(value: string): value is Addon;
/** Interruptores guardados -> añadidos activos, en el orden de ADDONS. Claves desconocidas o
 *  repetidas se ignoran; un añadido cuya dependencia no está prendida no es activo. */
export function effectiveAddons(stored: readonly string[]): readonly Addon[];
/** Permisos del rol menos los de cada añadido no activo. Nunca añade nada. */
export function effectivePermissions(rolePermissions: readonly string[], active: readonly Addon[]): readonly string[];

export type AddonBearer = { readonly addons?: readonly string[] };
export function assertAddon(bearer: AddonBearer | null | undefined, addon: Addon, onDenied: () => Error): void;
export function hasAddon(bearer: AddonBearer | null | undefined, addon: Addon): boolean;
```

- **Las claves van en español y en minúsculas**, como el `<modulo>` del catálogo de permisos.
  `ADDONS` es la fuente de verdad. La tabla `addons` es su espejo (D13), y la guardia de § 9.4
  pone el gate en rojo si difieren (R2).
- **Esta sección no cambia con la enmienda.** `effectiveAddons` sigue recibiendo `string[]` con
  los interruptores prendidos; ahora sale de las filas `enabled = true` y no de una columna.
- **Dependencia de un solo nivel.** `effectiveAddons` mira si la dependencia tiene el interruptor
  prendido, no si está activa en cascada. Con un solo nivel da lo mismo, y el test de
  `ADDON_REQUIRES` impide que un añadido dependa de otro que a su vez depende (R4).
- **`effectivePermissions` solo resta** (R11). Un permiso del rol que no está en ningún añadido
  pasa tal cual, aunque no esté en el catálogo: decidir eso no le toca a esta función.
- **`assertAddon`/`hasAddon` fallan cerrado.** Portador ausente, `addons` ausente o sin la clave:
  denegado. `addons` es opcional en el portador a propósito (§ 3.2).
- **Barril:** `identity/index.ts` reexporta los nombres de arriba.

### 2.2 Prisma (`db/schema.prisma`) — enmienda D13–D16

`Company` **pierde** `addons String[]` y gana la relación inversa `addonOverrides`. Nacen dos
modelos, los dos con `/// @module identity` como el resto de `identity`:

```prisma
/// Espejo del catálogo `ADDONS` del código, que es el que manda. Lo siembra la migración; un
/// añadido nuevo es otra migración con su INSERT. Lo vigila la guardia del catálogo de añadidos.
/// @module identity
model Addon {
  key       String                 @id
  overrides CompanyAddonOverride[]

  @@map("addons")
}

/// Excepción de una empresa sobre un añadido. Sin planes, el añadido está prendido solo si hay
/// fila con `enabled = true`. Apagar no borra: escribe `enabled = false`.
/// @module identity
model CompanyAddonOverride {
  companyId String   @map("company_id") @db.Uuid
  addonKey  String   @map("addon_key")
  enabled   Boolean
  source    String   @default("manual")
  createdBy String?  @map("created_by") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  addon   Addon   @relation(fields: [addonKey], references: [key], onDelete: Restrict, onUpdate: Cascade)
  author  User?   @relation(fields: [createdBy], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@id([companyId, addonKey], map: "company_addon_overrides_pkey")
  @@index([addonKey], map: "company_addon_overrides_addon_key_idx")
  @@index([createdBy], map: "company_addon_overrides_created_by_idx")
  @@map("company_addon_overrides")
}
```

- `User` gana la relación inversa `addonOverridesCreated CompanyAddonOverride[]`.
- **Relaciones declaradas, no escalares sueltos** (a diferencia de `ai_provider_connections`): la
  sesión necesita `company.addonOverrides` dentro del mismo `findFirst` (§ 3.1).

### 2.3 Migración `db/migrations/20261014190000_company_addons/` — reescrita en sitio

**No está en `dev` ni aplicada en ninguna base compartida**, así que se reescribe en su carpeta
con el mismo nombre; no nace una segunda migración. Quien la tenga aplicada en una base local
corre `pnpm run db:rollback` con el `down.sql` **viejo** antes de traer la rama (riesgo 5, § 14).

`migration.sql`:

```sql
-- 1. Catálogo de añadidos: espejo de ADDONS (identity/domain/company-addons.ts).
CREATE TABLE "addons" (
  "key" TEXT NOT NULL,
  CONSTRAINT "addons_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "addons_key_format" CHECK ("key" ~ '^[a-z][a-z_]*$')
);

INSERT INTO "addons" ("key") VALUES
  ('dashboard'), ('proveedores'), ('lectura_pdf'), ('importacion_excel'), ('integraciones');

-- 2. Excepciones por empresa.
CREATE TABLE "company_addon_overrides" (
  "company_id" UUID NOT NULL,
  "addon_key"  TEXT NOT NULL,
  "enabled"    BOOLEAN NOT NULL,
  "source"     TEXT NOT NULL DEFAULT 'manual',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_addon_overrides_pkey" PRIMARY KEY ("company_id", "addon_key"),
  CONSTRAINT "company_addon_overrides_source_format" CHECK ("source" ~ '^[a-z][a-z_]*$')
);

CREATE INDEX "company_addon_overrides_addon_key_idx" ON "company_addon_overrides" ("addon_key");
CREATE INDEX "company_addon_overrides_created_by_idx" ON "company_addon_overrides" ("created_by");

ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_addon_key_fkey"
  FOREIGN KEY ("addon_key") REFERENCES "addons"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Defecto de P2: las empresas que ya existen conservan los cinco. Autor vacío = sembrado (P7).
INSERT INTO "company_addon_overrides" ("company_id", "addon_key", "enabled", "source")
SELECT c."id", a."key", true, 'manual' FROM "companies" c CROSS JOIN "addons" a;

-- 4. RLS activada y forzada, sin policies, al final.
ALTER TABLE "addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "addons" FORCE ROW LEVEL SECURITY;
ALTER TABLE "company_addon_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_addon_overrides" FORCE ROW LEVEL SECURITY;
```

`down.sql` (R38: deshace exactamente lo de arriba; los índices, FK y filas caen con sus tablas):

```sql
DROP TABLE "company_addon_overrides";
DROP TABLE "addons";
```

Decisiones de la migración:

- **Sin filas, sin añadidos: D7 en la base** (R5). `createWithAdministrator` (`company-prisma.ts`)
  no cambia; la empresa nace sin excepciones. Vale para cualquier otra vía de alta, fixtures de
  test incluidas.
- **El INSERT del paso 3 es el defecto de P2** (R6). Cinco filas `enabled = true` por empresa,
  también para las de baja: si se reactivan, vuelven como estaban. Si P2 se responde al revés, el
  paso 3 sale y nada más cambia.
- **Lista cerrada en la base, por FK** (D13). Una clave fuera de `addons` no se puede guardar
  (`23503`). Un añadido nuevo es una migración con su `INSERT INTO "addons"`, y la guardia de
  § 9.4 obliga a escribirla.
- **`source` con `CHECK` de forma, no de lista**, como `company_events.kind`. Hoy solo se escribe
  `'manual'`; QC-182 decidirá si hay más orígenes.
- **`created_by` admite vacío** (P7). Vacío = lo sembró la migración o el seed. Toda escritura del
  Maestro lo rellena: el puerto exige `actorId` (§ 6.2).
- **`ON DELETE CASCADE` hacia `companies`.** Una excepción no significa nada sin su empresa. El
  quién y cuándo vive en `company_events`, que sigue con `RESTRICT`. En producción las empresas no
  se borran (baja lógica); el borrado físico solo lo hacen los tests y las limpiezas E2E, que así
  no tienen que conocer esta tabla.
- **RLS y aislamiento** (D15):
  - las dos tablas, `ENABLE` + `FORCE` sin policies, como `ai_providers` y `company_events`. Lo
    vigila `guard-rls-force`;
  - `company_addon_overrides` tiene `company_id`: `guard-empresa-en-esquema` la juzga como tabla de
    empresa, sin exención;
  - `addons` es catálogo compartido. Entra en `EXENTAS` de esa guardia con su motivo, y en la
    lista de exentas de `docs/architecture.md > Dominio`, que pasa de diez a once (§ 10.3, punto 6).
- **La FK compuesta del patrón no aplica aquí.** El repo usa `(x_id, company_id) → padre(id,
  company_id)` cuando el padre es tabla de empresa (`work_group_members`, `order_step_evidence`,
  `order_delivery_voids`). Ninguno de los tres padres de esta tabla lo es:
  - `companies` es la propia empresa;
  - `addons` es catálogo global;
  - `users` va con FK simple por D15, porque el Maestro no tiene empresa.

  La PK `(company_id, addon_key)` deja listo el destino compuesto si un día cuelga algo de aquí.
- **Re-fechado:** si `dev` trae una migración posterior antes del merge, se re-fecha en F2.3. Mismo
  procedimiento que QC-162.

### 2.4 Historial (`identity/domain/company-event.ts`)

- `COMPANY_EVENT_KINDS` gana `'addon.enabled'` y `'addon.disabled'`. El `CHECK` de forma de
  `company_events.kind` ya los admite: no se migra.
- `details` de estos eventos: `{ "addon": "<clave>" }`.
- `CompanyEventView` (`company-view.ts`) gana `addon: string | null`. Sale de `details.addon` si es
  texto, y si no, `null` (R34). `fields` sigue siendo `[]` para estos eventos.

### 2.5 Seed (R7)

`initial-access-repository-prisma.ts`: al crear la empresa inicial con alcance `full`, la crea con
sus cinco excepciones prendidas en el mismo `create` anidado:
`addonOverrides: { create: ADDONS.map((addonKey) => ({ addonKey, enabled: true })) }`, sin autor
(P7). Con alcance `platform-only` (producción) no crea empresa y no cambia nada. Una QuimiCloud que
ya existía la cubre el paso 3 de § 2.3. En la carrera del `P2002`, la empresa releída no se toca:
ya trae sus filas de la migración o de la primera creación.

---

## 3. Dónde se cruza rol ∩ añadidos: la sesión

### 3.1 Lectura (`session-user-prisma.ts`)

Enmienda D13–D16, con el defecto de P6:

```ts
company: {
  select: {
    deletedAt: true,
    addonOverrides: { where: { enabled: true }, select: { addonKey: true } },
  },
},
...
companyAddons: usuario.company?.addonOverrides.map((o) => o.addonKey) ?? [],
```

- `SessionUserRecord` (`ports/session-user-reader.ts`) **no cambia**: sigue con
  `readonly companyAddons: readonly string[]`, crudo, igual que `companyDeletedAt`. Sin planes,
  «prendido» es «fila con `enabled = true`» (D16).
- **Coste (P6).** El lector se sigue invocando **una vez** por petición, que es lo que mide el
  contador de `session-user.int.test.ts` (R8). Prisma, sin `relationJoins`, resuelve la relación
  con **una sentencia SQL más**: `SELECT addon_key FROM company_addon_overrides WHERE company_id = ?
  AND enabled`, por el prefijo de la PK. Devuelve como mucho cinco filas. Es el mismo coste que
  QC-23 aceptó por `revokedSessions`. Sale un array de textos cortos, sin PII y fuera de todo log.
- **Por qué no `relationLoadStrategy: 'join'`.** Pide activar la vista previa `relationJoins` en el
  `generator` de `db/schema.prisma`, y eso cambia cómo se cargan las relaciones en toda la
  aplicación. No lo decide esta ficha. Si la ficha de sesión de Christian (P6) lo trae, esta
  lectura lo hereda sin tocar nada más.
- **Lo que sigue igual:** `resolveSession` (§ 3.2), `effectiveAddons` y `effectivePermissions`
  reciben el mismo `string[]`.

### 3.2 Recorte (`resolve-session.ts`, paso 9)

```ts
const addons = record.companyId === null ? [] : effectiveAddons(record.companyAddons);
const permissions = record.companyId === null
  ? record.permissions
  : effectivePermissions(record.permissions, addons);
return { user: { ..., permissions, addons }, context: ... };
```

- **Los cortes 1–8 no cambian.** El recorte va después: decide qué puede hacer la persona, no si
  hay sesión.
- **Sin empresa, sin recorte** (R10). Hoy solo el Maestro, que tiene `empresas.*`, del núcleo.
- `SessionUser` (`domain/session-user.ts`) gana `readonly addons?: readonly string[]`, con los
  añadidos activos.
  - `resolveSession` lo rellena siempre.
  - Es opcional en el tipo para no obligar a reescribir las decenas de `SessionUser` de los tests.
    Como `assertAddon` falla cerrado, un portador sin `addons` no tiene ningún añadido.
- **Efecto inmediato** (R9). La sesión ya se resuelve en cada petición; el cambio del Maestro se ve
  en la siguiente, sin cookie nueva.
- **Una lectura por petición** (QC-104): sin cambios; el recorte es cálculo puro sobre esa lectura.
- `SessionContext` no cambia: la empresa sigue sin autorizar nada por sí sola.

### 3.3 Por qué con esto basta para la mayoría

Todo lo que ya pregunta por un permiso de añadido se apaga sin tocarlo:

- **El menú.** `layout.tsx:79` filtra con `user.permissions`. El grupo «Integraciones» desaparece
  entero (QC-75 R3).
- **Las pantallas.** `requirePagePermission`:
  - dashboard y recorrido (`dashboard.consultar`);
  - proveedores y su detalle (`proveedores.consultar`);
  - las tres de integraciones (`integraciones.modificar`).
- **Las operaciones.** Cada caso de uso con `requirePermission`:
  - el actor de cada módulo copia `sessionUser.permissions`;
  - eso incluye las acciones de `documentos`, `proveedores`, `integraciones` y las del recorrido.
- **Los botones.** Con esa misma copia:
  - «Subir PDF» (`canUploadDocuments`, en `formulas/page.tsx:30` y `proveedores/[id]/page.tsx:101`);
  - «Ver recorrido» (`canViewExecutionTrace`, `asignacion/page.tsx:60-68`).
- **El aterrizaje del login.** `login-action.ts:125` filtra con `user.permissions`.

Cada uno se prueba igual (§ 10), pero ninguno cambia de código.

---

## 4. Integraciones arrastra la lectura de PDF (D1, D4)

- La lectura de PDF solo está activa si los dos interruptores están prendidos (`ADDON_REQUIRES`,
  R4). Con integraciones apagado:
  - `documentos.*` sale del permiso efectivo;
  - el webhook descarta los trabajos (§ 8).
- **Proveedor IA (QC-275) no cambia.** Con los dos añadidos activos, la lectura puede seguir
  bloqueada si la empresa no conectó su proveedor: eso es `ai_provider_missing` de QC-275. Son dos
  capas independientes: el añadido dice «esta empresa tiene la función», y el proveedor dice
  «tiene con qué leer».
- **P3 (defecto).** Prender la lectura con integraciones apagado se guarda y no surte efecto.
  Apagar integraciones no toca el interruptor de la lectura.

---

## 5. Puntos cruzados sin permiso propio (D10)

### 5.1 Casos de uso

Cada módulo afectado gana en su `domain/actor.ts`:

- un campo opcional en su `Actor`: `readonly addons?: readonly string[]`;
- un `requireAddon(actor, addon)` que delega en `assertAddon` del barril de `identity` y lanza su
  propio `UnauthorizedError`. Mismo patrón que `requirePermission`.

| Caso de uso | Hoy exige | Gana, justo después del permiso |
|---|---|---|
| `inventario/domain/get-inventory-import-template.ts` (plantilla y valores, l. 41 y 49) | `inventario.modificar` | `requireAddon(actor, 'importacion_excel')` |
| `inventario/domain/preview-inventory-import.ts:168` | `inventario.modificar` | ídem |
| `inventario/domain/confirm-inventory-import.ts:156` | `inventario.modificar` | ídem |
| `documentos/domain/preview-formula-import.ts:111` | `recetas.modificar` | `requireAddon(actor, 'lectura_pdf')` |
| `documentos/domain/confirm-formula-import.ts:81` | `recetas.modificar` | ídem |
| `documentos/domain/preview-catalog-import.ts:245` | `proveedores.modificar` | ídem |
| `documentos/domain/confirm-catalog-import.ts:107` | `proveedores.modificar` | ídem |

- **Mismo error que sin permiso** (`unauthorized`, R14): «apagado» y «sin permiso» no se
  distinguen.
- **Antes de validar y antes de tocar un puerto.** Ningún dato se lee si se rechaza (R14).
- Las tres Server Actions que construyen esos actores copian `addons: sessionUser.addons` en su
  `currentActor()`:
  - `inventory-import-actions.ts`;
  - `formula-import-actions.ts`;
  - `catalog-import-actions.ts`.

  Las demás acciones de esos módulos no lo necesitan. Si alguna llamara a estos casos de uso sin
  pasarlo, fallaría cerrado.
- `asignaciones`, `proveedores`, `recetas` e `integraciones` no ganan nada: no tienen puntos sin
  permiso propio.

### 5.2 Pantallas — `requirePageAddon` (nuevo, `identity/adapters/driving/require-page-addon.ts`)

```ts
export async function requirePageAddon(addon: Addon): Promise<void> {
  const user = await identity.getSessionUser();
  if (user === null) redirect(LOGIN_ROUTE_SESSION_ENDED);
  assertAddon(user, addon, () => notFound());
}
```

Es hermana de `requirePagePermission`: misma lectura de sesión, mismo 404 y misma marca de sesión
terminada. Se llama **después** de `requirePagePermission`:

| Pantalla | Añadido |
|---|---|
| `app/(private)/inventario/importar/page.tsx` | `importacion_excel` |
| `app/(private)/produccion/formulas/importar/[documentoId]/page.tsx` | `lectura_pdf` |
| `app/(private)/proveedores/[id]/importar/[documentoId]/page.tsx` | `lectura_pdf` |

Con esto, una revisión sin confirmar deja de verse por su enlace (R23).

### 5.3 Botones

- **«Importar» de Inventario** (`inventario/page.tsx:87`):
  `canImport = canAdjustBatchStock(sessionUser) && hasAddon(sessionUser, 'importacion_excel')`.
  Es la misma lectura de sesión de la petición.
- **«Subir PDF».** En Fórmulas y en el detalle de proveedor, `canUploadDocuments` ya mira
  `documentos.modificar`, que el recorte quita. **Esos dos archivos no se tocan**: son de QC-275 y
  QC-280.
- **«Ver recorrido».** Ya mira `dashboard.consultar`: no se toca.

---

## 6. Operación del Maestro (D9)

### 6.1 Casos de uso (`identity/domain/`)

Todos siguen el orden de los de QC-162:

1. `requirePlatformPermission`, antes de nada;
2. `safeParse`, que da `ValidationError` si falla;
3. el puerto;
4. la traducción del resultado.

`now?: () => Date` se puede inyectar.

| Archivo | Permiso | Entrada (`zod`, en `company-addon-input.ts`) | Puerto → resultado | Errores |
|---|---|---|---|---|
| `get-company-addons.ts` | `empresas.consultar` | `{ companyId: uuid }` | `addons.findByCompany(id)` → `{ stored: string[] } \| null` | `company_not_found` |
| `set-company-addon.ts` | `empresas.modificar` | `{ companyId: uuid, addon: z.enum(ADDONS), enabled: boolean }` | `addons.apply({ companyId, enable \| disable, actorId, now })` → `{ changed: AddonChange[] } \| 'not_found'` | `company_not_found`, `invalid_input` |
| `set-all-company-addons.ts` | `empresas.modificar` | `{ companyId: uuid, enabled: boolean }` | `addons.apply({ companyId, enable: ADDONS \| disable: ADDONS, ... })` | `company_not_found` |

- **Vista** (`company-addons-view.ts`):
  `CompanyAddonsView = { companyId; addons: { addon: Addon; enabled: boolean; active: boolean; requires: readonly Addon[] }[] }`,
  en el orden de `ADDONS`. `enabled` es el interruptor; `active` sale de `effectiveAddons` (R27).
- **Lectura:** vale con empresa viva o de baja, como `getCompany` (R27).
- **Escrituras:** solo con empresa viva (R31).
- **Clave fuera del catálogo** (`'pedidos'`, `'inventario'`, `'x'`): `z.enum` la rechaza como
  `invalid_input` (R32). El núcleo no tiene interruptor: no existe ninguna clave que lo apague.
- **Resultado de las escrituras:** devuelven la vista ya actualizada, para que QC-278 no tenga que
  releer.

### 6.2 Puerto `identity/ports/company-addon-repository.ts` (nuevo)

```ts
export type AddonChange = { readonly addon: Addon; readonly enabled: boolean };
export interface CompanyAddonRepository {
  findByCompany(companyId: string): Promise<{ stored: readonly string[]; alive: boolean } | null>;
  apply(input: { companyId: string; enable?: readonly Addon[]; disable?: readonly Addon[];
    actorId: string; now: Date }): Promise<{ stored: readonly string[]; changed: readonly AddonChange[] } | 'not_found'>;
}
```

### 6.3 Adaptador `identity/adapters/driven/persistence/company-addons-prisma.ts` (nuevo)

`createCompanyAddonRepository(db = prisma)` es una fábrica sobre el cliente, como
`company-prisma.ts`, y usa el mismo `atomically`, que ese archivo ya exporta (`company-prisma.ts:40`,
driven a driven del mismo módulo).

**Enmienda D13–D16.** El puerto de § 6.2 **no cambia**; cambia lo que hay debajo.

`findByCompany`:

```ts
db.company.findUnique({
  where: { id: companyId },
  select: { deletedAt: true, addonOverrides: { where: { enabled: true }, select: { addonKey: true } } },
})
```

`stored` son esas claves en el orden de `ADDONS`. Sin claves desconocidas: la FK no las deja
entrar (D13).

`apply` corre entero dentro de una transacción:

1. Bloquea la fila de la empresa con `SELECT id FROM companies WHERE id = $1 AND deleted_at IS NULL
   FOR UPDATE`. Si no hay fila, devuelve `'not_found'` (R31). El bloqueo es sobre `companies` y no
   sobre las excepciones, que pueden no existir todavía: así dos `apply` a la vez sobre la misma
   empresa se serializan igual que antes.
2. Lee las excepciones de la empresa (`findMany` por `company_id`). Prendido = fila con
   `enabled = true`; no hay fila o `enabled = false` = apagado (D16, sin planes).
3. `changed` son los añadidos pedidos cuyo interruptor cambia. Si no hay ninguno, devuelve sin
   escribir: ni excepción, ni `updated_at`, ni evento (R33). Apagar un añadido sin fila no escribe
   nada, porque ya está apagado.
4. Si hay cambios:
   - un `upsert` por cambio sobre la PK `(company_id, addon_key)`:
     - `create`: `{ companyId, addonKey, enabled, source: 'manual', createdBy: actorId, createdAt: now }`;
     - `update`: `{ enabled, createdBy: actorId, createdAt: now }`.
     
     Apagar escribe `enabled = false`; **no borra** (D14). La fila guarda quién fijó su valor
     vigente y cuándo; la historia entera vive en `company_events`;
   - `UPDATE companies SET updated_at = $now`, como hasta ahora: el test de «sin cambios, sin
     `updated_at`» sigue valiendo;
   - un `company_events` por cada cambio: `kind` `addon.enabled` o `addon.disabled`, `actor_id`,
     `occurred_at = now` y `details = { addon }` (R33).

Notas:

- **Todos a la vez es la misma transacción** (R29, D14): `apply` recibe la lista entera. Con los
  cinco prendidos, «apagar todos» son cinco `upsert` a `enabled = false` y cinco eventos. O se
  escribe todo, o nada.
- **Con planes (QC-182, fuera de alcance):** un añadido sin fila puede venir prendido por el plan.
  Apagarlo creará una fila `enabled = false`. El paso 2 es el único que cambia entonces: «prendido»
  pasa a ser «plan + excepciones prendidas − excepciones apagadas».
- **Solo `identity` escribe `companies` y `company_events`** (QC-162 § 11.6), y ahora también
  `addons` (solo por migración) y `company_addon_overrides`: todo vive en su módulo, sin contrato
  nuevo.
- **Append-only:** el test `company-events-append-only` de QC-162 sigue verde. Aquí solo hay
  `create`.

### 6.4 Lectura de sistema para el webhook — `identity/domain/is-company-addon-active.ts` (nuevo)

```ts
export function createIsCompanyAddonActive(deps: { addons: Pick<CompanyAddonRepository, 'findByCompany'> }):
  (companyId: string, addon: Addon) => Promise<boolean>;
```

Sin actor: es una consulta del sistema, como `listActiveCompanyIds`. Devuelve `false` si la
empresa no existe o está de baja.

### 6.5 Server Actions (`identity/adapters/driving/company-actions.ts`, amplía QC-162)

Siguen el patrón del archivo:

- el mismo `currentPlatformActor()`, que solo llama a `getSessionUser()`;
- el mismo `toErrorState`;
- sin `revalidatePath`.

| Acción | Entrada | Éxito |
|---|---|---|
| `getCompanyAddonsAction(companyId: string)` | — | `{ status: 'success', data: CompanyAddonsView }` |
| `setCompanyAddonAction(prev, formData)` | `companyId`, `addon`, `enabled` (`'true'`/`'false'`) | `{ status: 'success', data: CompanyAddonsView }` |
| `setAllCompanyAddonsAction(prev, formData)` | `companyId`, `enabled` | `{ status: 'success', data: CompanyAddonsView }` |

`enabled` llega de `FormData` como texto. Solo `'true'` y `'false'` pasan; cualquier otro valor
da `invalid_input`.

### 6.6 Composición (`lib/composition/index.ts`)

```ts
const companyAddonRepository = createCompanyAddonRepository();
// en `identity`, claves nuevas al final:
getCompanyAddons, setCompanyAddon, setAllCompanyAddons,      // { addons: companyAddonRepository }
isCompanyAddonActive: createIsCompanyAddonActive({ addons: companyAddonRepository }),
```

---

## 7. Logo y aterrizaje (D10)

### 7.1 Una sola regla: `homeHrefFor`

`lib/shared/navigation/private-nav.ts` gana:

```ts
export function homeHrefFor(permissions: readonly string[]): string {
  return firstVisibleNavHref(filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permissions)) ?? DASHBOARD_ROUTE;
}
```

Es literalmente lo que hoy compone `login-action.ts:122-126`, que pasa a llamarla. El respaldo
`DASHBOARD_ROUTE` no cambia: con el menú vacío lleva al 404 dentro de la zona privada, con su
salida (QC-93).

### 7.2 Ruta `/inicio` (nueva)

- `lib/shared/routes.ts`: `export const HOME_ROUTE = '/inicio'`.
- `app/inicio/route.ts` solo reexporta `GET` de
  `lib/modules/identity/adapters/driving/home-route.ts` y declara `runtime = 'nodejs'`.
- `home-route.ts`:

  ```ts
  export async function GET(request: Request): Promise<Response> {
    const user = await identity.getSessionUser();
    const to = user === null ? LOGIN_ROUTE_SESSION_ENDED : homeHrefFor(user.permissions);
    return Response.redirect(new URL(to, request.url), 307);
  }
  ```

- **Sin sesión válida va al login con la marca** (R21). La cookie puede seguir firmada y viva (por
  ejemplo, empresa dada de baja). Sin la marca, el middleware devolvería `/login` a `/inicio` y
  habría bucle; es el mismo motivo que `layout.tsx:65-70`.
- **No es pantalla:** no tiene `page.tsx` y no entra en `PRIVATE_ROUTE_PREFIXES`.
  `guard-rutas-privadas-cubiertas` y `guard-pantallas-exigen-permiso` miran `page.tsx` y no cambian.
  Resuelve la sesión por su cuenta, como el layout.
- **Middleware** (`route-guard-middleware.ts:125`): `landing: HOME_ROUTE`. El borde sigue sin tocar
  la base (`guard-middleware-edge`): solo cambia una constante.
- **Logo** (`components/private/app-sidebar.tsx:119`): `href={HOME_ROUTE}`. `AppSidebar` no
  decide nada nuevo y no recibe props nuevas.

### 7.3 Por qué una ruta y no calcular el destino en el layout

El logo podría recibir el `href` ya calculado por el layout. El middleware, en cambio, no puede: no
conoce permisos ni añadidos, y no puede consultarlos. Una ruta sirve para los dos y deja una sola
regla. Coste: una redirección más al pulsar el logo. Ver § 13, alternativa 5.

---

## 8. Webhook de documentos y crons (D6, D10, D12)

### 8.1 `documentos/domain/run-document-job.ts`

`RunDocumentJobDeps` gana `readonly pdfReading: PdfReadingSwitch`. El puerto es nuevo
(`documentos/ports/pdf-reading-switch.ts`):

```ts
export interface PdfReadingSwitch { isOn(companyId: string): Promise<boolean> }
```

En `ejecutar`, justo después de `claim` y **antes** de `readBatch` y de `aiProvider.readerFor`:

```ts
if (!(await deps.pdfReading.isOn(claimed.companyId))) {
  const outcome = { kind: outcomeKindOf(failureKind('unauthorized')), code: 'unauthorized',
    reason: 'run-document-job: la lectura de PDF no esta activa en la empresa' } as const;
  await terminar(claimed.id, outcome);
  return { kind: outcome.kind };
}
```

- **Definitivo, sin descarga y sin IA** (R22). `failureKind('unauthorized')` ya da `definitive`: el
  código está fuera de la lista y `failure-kind.ts` no se toca. El webhook responde 200 y la cola no
  reintenta (`document-job-route.ts:53`).
- **Código `unauthorized` reutilizado.** «La empresa ya no tiene la función» es una denegación. No
  hace falta código ni texto nuevo en `errores`, y nadie lo ve: con el añadido apagado no hay
  diálogo de subida.
- **El PDF se queda en el bucket**, como en cualquier otro fallo definitivo (por ejemplo
  `ai_provider_missing` de QC-275). Al prender otra vez, ese trabajo no se reprocesa (P4).
- **Composición:**
  `pdfReading: { isOn: (companyId) => identity.isCompanyAddonActive(companyId, 'lectura_pdf') }`.
  La clave de añadido vive en la composición, no en `documentos`.
- **La lectura ya en curso al apagar** termina como estaba. D6 habla de lo que está en cola.

### 8.2 Cron de caducidad (D12)

No cambia. `listActiveCompanyIds` (`company-directory-prisma.ts`) no mira `addons`, y R25 lo fija
con un test de integración: una empresa viva sin añadidos sale en la lista.

### 8.3 Lo que no existe todavía

- El webhook de WhatsApp tiene ruta declarada (`WHATSAPP_WEBHOOK_ROUTE_BASE`) pero no handler.
- Contactos y notificaciones no tienen código.

Cuando lleguen, la guardia de § 9.3 obliga a clasificarlos y a probar su interruptor (R26).

---

## 9. Guardias y tests de forma

### 9.1 Partición del catálogo (R1, R3)

`tests/unit/identity/addons/company-addons.test.ts`:

- `CORE_PERMISSIONS ∪ ADDON_PERMISSIONS = PERMISSIONS`, disjuntos y sin repetidos;
- `ADDON_REQUIRES` tiene un solo nivel y no tiene ciclos.

### 9.2 Pantallas de añadido sin permiso propio (R13, R23)

`tests/guards/guard-pantallas-de-anadido.test.ts` recorre los `page.tsx` de `app/(private)/`:

- Toda ruta que contenga el segmento `importar` tiene que estar en un mapa ruta → añadido.
- Cada página del mapa tiene que llamar a `requirePageAddon('<añadido>')`, con su clave.
- Se comprueba a sí misma con un fuente sintético.

### 9.3 Rutas fuera de sesión (R26)

`tests/guards/guard-rutas-fuera-de-sesion.test.ts` recorre `app/api/**/route.ts` contra un mapa:

```ts
{ 'app/api/cron/caducar-pedidos/route.ts': { nucleo: true, prueba: 'tests/integration/identity/company-directory-addons.int.test.ts' },
  'app/api/documentos/trabajos/route.ts': { anadido: 'lectura_pdf', prueba: 'tests/unit/documentos/run-document-job-addon.test.ts' } }
```

- Una ruta sin entrada, o una entrada sin ruta, pone la guardia en rojo.
- Cada entrada tiene que nombrar un archivo de prueba que exista.
- El webhook de WhatsApp tendrá que entrar aquí con su prueba.

### 9.4 Catálogo del código igual a la tabla (D13, R2) — enmienda

`tests/guards/guard-catalogo-de-anadidos.test.ts`. Como toda guardia, lee texto y no toca la base:

- recorre `db/migrations/*/migration.sql` en orden de carpeta;
- acumula las claves de cada `INSERT INTO "addons"` y resta las de cada `DELETE FROM "addons"`;
- el conjunto resultante tiene que ser exactamente `ADDONS`, importado del dominio y no copiado.

Da rojo en dos casos, y se comprueba a sí misma con SQL sintético:

- un añadido nuevo en `ADDONS` sin su migración;
- una migración que siembra una clave que el código no conoce.

Un `UPDATE "addons" SET "key"` también la pone en rojo: renombrar una clave es borrar una y crear
otra, cada una con su sentencia.

Además, `company-addons.int.test.ts` lee la tabla real de la base de la corrida y la compara con
`ADDONS`. Es la misma comprobación, hecha contra lo que de verdad quedó aplicado.

---

## 10. Pruebas y trazabilidad

### 10.1 Mapa

| R | Test |
|---|---|
| R1, R2, R3 | `tests/unit/identity/addons/company-addons.test.ts` (partición, cinco claves, permisos por añadido, `importacion_excel` sin permisos) |
| R4 | `company-addons.test.ts` (`effectiveAddons(['lectura_pdf'])` → `[]`; con `integraciones` → los dos) + `run-document-job-addon.test.ts` (interruptor de PDF prendido e integraciones apagado → descartado) |
| R2 (D13) | `tests/guards/guard-catalogo-de-anadidos.test.ts` (§ 9.4) + `company-addons.int.test.ts` (la tabla `addons` de la base = `ADDONS`; una excepción con clave `'futuro'` → `23503`) |
| R5 | `tests/integration/identity/company-addons.int.test.ts` (`createWithAdministrator` → cero filas en `company_addon_overrides`) |
| R6, R38 | `tests/unit/identity/schema/company-addons-migration.test.ts`, reescrito: crea `addons` y `company_addon_overrides` con PK, FK y RLS `ENABLE` + `FORCE`; el `INSERT INTO "addons"` lista exactamente `ADDONS`; el sembrado de excepciones es `enabled = true` por cada empresa × añadido; `down.sql` borra exactamente las dos tablas, hija antes que padre |
| R7 | `tests/unit/identity/seed/seed-initial-access.test.ts` (ampliado: `create` anidado con las cinco excepciones) + `tests/integration/identity/identity-seed.int.test.ts` (ampliado: empresa inicial con cinco filas `enabled = true`) |
| R8, R10, R11 | `tests/unit/identity/resolve-session.test.ts` (ampliado: recorte con empresa; sin empresa, sin recorte; un añadido activo no concede un permiso que el rol no tiene; `addons` expuesto) + `tests/integration/identity/session-user.int.test.ts` (ampliado: `companyAddons` en la misma invocación; el contador de invocaciones no sube) |
| R9 | `tests/integration/identity/company-addons.int.test.ts` (apagar con `apply` y releer con la selección de la sesión → recortado sin emitir sesión) + E2E |
| R12 | `tests/unit/identity/addons/menu-recortado.test.ts` (`filterNavItemsByPermissions` con el permiso efectivo: sin dashboard, proveedores ni grupo «Integraciones») + E2E |
| R13 | `tests/unit/identity/require-page-addon.test.ts` (404 sin el añadido, redirección con marca sin sesión, sin comparaciones manuales) + guardia § 9.2 + E2E |
| R14, R16 | `tests/unit/inventario/importar/inventory-import-addon.test.ts` (cuatro casos de uso: con `inventario.modificar` y sin el añadido → `unauthorized`, dobles que fallan si se llaman) + `tests/unit/inventario/importar/importar-page.test.tsx` (ampliado) + `tests/unit/inventario/product-page.test.tsx` (ampliado: sin el añadido no hay `inventory-import-link`) |
| R14, R15, R23 | `tests/unit/documentos/import-addon.test.ts` (los cuatro casos de uso de importación con `recetas.modificar` o `proveedores.modificar` y sin el añadido → `unauthorized`) + `tests/unit/recetas-ui/formula-import-page.test.tsx` y `tests/unit/proveedores-ui/catalog-import-page.test.tsx` (ampliados: 404) + `tests/unit/documentos-ui/formulas-upload.test.tsx` y `supplier-detail-upload.test.tsx` (ampliados: con permisos recortados no hay botón) |
| R17 | `tests/unit/identity/addons/menu-recortado.test.ts` (sin `dashboard.consultar` efectivo, `canViewExecutionTrace` → `false`; se ejercita por la página en `tests/unit/asignaciones-ui/assigned-orders-route-contract.test.ts` ampliado) |
| R18, R19, R21 | `tests/unit/identity/home-route.test.ts` (destino = `homeHrefFor(permisos)`; sin sesión → `LOGIN_ROUTE_SESSION_ENDED`) + `tests/unit/identity/route-guard-middleware.test.ts` (enmendado: `/login` con sesión → `HOME_ROUTE`) + `tests/unit/app-sidebar.test.tsx` y `tests/unit/marca/sidebar-carril.test.ts` (enmendados: logo → `HOME_ROUTE`) + E2E |
| R20 | `tests/unit/identity/login-action.test.ts` (ampliado: usa `homeHrefFor` con el permiso efectivo) + `tests/unit/e2e-helpers/landing.test.ts` (ampliado) + E2E |
| R22 | `tests/unit/documentos/run-document-job-addon.test.ts` (apagado → `terminar` con `unauthorized` definitivo; `readBatch`, `readerFor`, descarga y pipeline no se llaman; resultado no es `requeue`) + `tests/unit/composition/documentos-facade.test.ts` (ampliado: el interruptor se ata a `isCompanyAddonActive(…, 'lectura_pdf')`) |
| R24 | `tests/integration/identity/company-addons.int.test.ts` (apagar los cinco: las filas de `recipes`, `suppliers`, `supplier_catalog_lines`, `product_batches` y `ai_provider_connections` de la empresa no cambian) |
| R25 | `tests/integration/identity/company-directory-addons.int.test.ts` (empresa viva sin añadidos está en `listActiveCompanyIds`) |
| R26 | `tests/guards/guard-rutas-fuera-de-sesion.test.ts` |
| R27–R32 | `tests/unit/identity/companies/get-company-addons.test.ts`, `set-company-addon.test.ts`, `set-all-company-addons.test.ts` (permiso primero con dobles que fallan; `consultar` en escrituras y `modificar` en lectura → `unauthorized`; `not_found`; claves `'pedidos'` y `'x'` → `invalid_input`) + `tests/unit/identity/company-actions.test.ts` (ampliado: tres acciones, `enabled` solo `'true'`/`'false'`) + `tests/integration/identity/company-addons.int.test.ts` (empresa de baja: lectura sí, escritura `not_found`; todos a la vez atómico: un fallo del evento deshace la fila) |
| R33, R34 (D14, D15) | `company-addons.int.test.ts` (un evento por cambio con `details.addon`; sin cambios → ni `updated_at` ni evento; apagar deja la fila con `enabled = false` y `created_by` = el Maestro, sin borrarla; «apagar todos» con los cinco prendidos → cinco filas `false` y cinco eventos, y un fallo del evento deshace las cinco) + `tests/unit/identity/companies/company-event.test.ts` y `list-company-events.test.ts` (ampliados: tipos nuevos y `addon` en la vista) |
| R35 | La suma de R8, R12–R16 y R22. Además, `tests/unit/identity/addons/sin-decision-en-cliente.test.ts`: ningún archivo `'use client'` importa `effectiveAddons`, `hasAddon` ni `assertAddon` |
| R36 | `e2e/modulos-por-empresa.spec.ts` |
| R37 | `tests/unit/identity/addons/architecture-doc.test.ts`: lee `docs/architecture.md`; ya no contiene «foto del instante del login» y sí la regla «rol ∩ añadidos activos» |

Las enmiendas a tests de otras fichas están en § 10.3. Los dos archivos de integración nuevos
(`company-addons.int.test.ts`, `company-directory-addons.int.test.ts`) se declaran en
`tests/integration/aislamiento.json > transaccion`, como los de QC-162.

### 10.2 E2E (D11, R36)

`e2e/modulos-por-empresa.spec.ts`:

- **Fixture:** empresa propia con prefijo y limpieza por edad, como `aislamiento-proveedores.spec.ts`,
  y un Administrador.
- **Interruptores:** se ponen con Prisma a través de `e2e/helpers/addons.ts` (enmienda: `upsert`
  de excepciones; antes `company.update({ addons })`), no con la acción del Maestro. La operación
  tiene sus tests unitarios y de integración, y la pantalla es de QC-278.

Casos:

1. Sin añadidos:
   - `loginAndLand` aterriza en `/inventario`, el primer enlace efectivo del Administrador;
   - el menú no tiene `nav-dashboard`, `nav-proveedores` ni `nav-integraciones`;
   - no hay `inventory-import-link`;
   - el logo lleva a `/inventario`.
2. Sin añadidos, `page.goto` de `/dashboard`, `/proveedores`, `/inventario/importar` e
   `/integraciones/proveedor-ia` → 404 dentro de la zona privada, con menú y «cerrar sesión».
3. `/login` con sesión → `/inicio` → `/inventario`.
4. Con la sesión abierta se prenden los cinco por Prisma y se recarga, sin volver a entrar:
   - aparecen los tres enlaces y el botón;
   - `/dashboard` responde;
   - el logo lleva a `/dashboard`.

  Es el efecto inmediato de R9.
5. Solo `lectura_pdf` prendido, con integraciones apagado: no hay botón «Subir PDF» en Fórmulas
   (R4).

**`e2e/helpers/landing.ts`** (enmienda): `permissionsForUsername` lee también las excepciones
prendidas de la empresa (`company.addonOverrides` con `enabled: true`; antes `company.addons`) y
devuelve `effectivePermissions(...)`, y `landingRouteForPermissions` pasa a ser `homeHrefFor`.
Sin esto, cada E2E con empresa sin añadidos esperaría `/dashboard`.

**`e2e/helpers/addons.ts`** (nuevo): `enableAllAddons(companyId)`, que hace `upsert` de las cinco
excepciones a `enabled = true` sin autor (P7). La función local de `e2e/modulos-por-empresa.spec.ts`
que fija los interruptores (hoy `company.update({ addons })`, l. 61) y su comprobación de «nace
sin añadidos» (l. 115-117) pasan a escribir y contar excepciones. Lo llaman los specs que crean su
empresa y entran en un añadido. El censo se hace en T20: correr la suite E2E completa sobre base
limpia y añadir la llamada donde falle por esta causa, y solo por esta. Los candidatos están en
`tasks.md > Archivos esperados`.

### 10.3 Enmiendas a tests de otras fichas (explícitas, aprobadas con este spec)

1. `tests/unit/identity/roles/maestro-rol.test.ts` R17: `RUTAS_ABIERTAS_EMPRESAS` gana
   `get-company-addons.ts`, `set-company-addon.ts` y `set-all-company-addons.ts`. El anti-cegado no
   se toca.
2. `tests/unit/identity/route-guard-middleware.test.ts` (l. 173, 389, 431): el destino esperado
   pasa a `HOME_ROUTE`.
3. `tests/unit/app-sidebar.test.tsx`, `tests/unit/marca/sidebar-carril.test.ts` y
   `e2e/marca-componentes.spec.ts`: el `href` del logo pasa a `HOME_ROUTE`.
4. `tests/guards/guard-e2e-landing.test.ts`, si fija el cuerpo de `landing.ts`: se ajusta a la
   composición nueva.
5. Las fixtures de `SessionUser` que esperan el botón «Importar» ganan
   `addons: ['importacion_excel']`.
6. **Enmienda D13–D16.** `tests/guards/guard-empresa-en-esquema.test.ts`: `EXENTAS` gana
   `{ tabla: 'addons', motivo: 'catalogo de añadidos, compartido por todas las empresas' }` y su
   caso R7 pasa de «las diez» a «las once». El bullet de exentas de `docs/architecture.md > Dominio`
   nombra `addons` y dice «once tablas» (lo exige su caso R14).
7. **Enmienda D13–D16.** `tests/unit/identity/addons/architecture-doc.test.ts`: la viñeta
   enmendada nombra `company_addon_overrides` en vez de `companies.addons` (§ 11, punto 1).
8. **Enmienda D13–D16.** Comentarios que citan «la columna `companies.addons`» en
   `tests/unit/recetas-ui/recipe-route-contract.test.ts` (l. 567) y
   `tests/guards/guard-identificador-de-request.test.ts` (l. 643) pasan a «las tablas de
   añadidos». El nombre de la migración no cambia, así que sus listas no cambian.
9. **Enmienda D13–D16, opción A (decisión del humano, 2026-10-15).** La relación inversa
   `User.addonOverridesCreated` y el modelo `CompanyAddonOverride` (§ 2.2) entran en las listas cerradas
   de Prisma.dmmf de otras fichas, igual que entró `CompanyEvent` con QC-162. No se afloja nada más y se
   mantiene la igualdad exacta:
   - `tests/unit/identity/credential-policy-contract.test.ts` (QC-19 R21): los campos de `User` ganan
     `addonOverridesCreated`;
   - `tests/unit/proveedores/module-contract.test.ts` R22 (dos casos) y
     `tests/unit/identity/schema/account-status-schema.test.ts`: `relationTargets('User')` gana
     `CompanyAddonOverride`;
   - `tests/unit/identity/schema/identity-schema.test.ts` R12: `CompanyAddonOverride` se excluye de la
     búsqueda de tablas intermedias, como `CompanyEvent`, porque es una excepción de añadido y no da a
     nadie una segunda empresa.

---

## 11. Enmiendas a `docs/architecture.md`

1. **`## Dominio`, punto 1, viñeta «Nada de infraestructura por si acaso» (l. 41-44).**
   - Se mantiene la prohibición de «un usuario en varias empresas» y de conceder permisos por
     empresa.
   - Se cambia «permisos por empresa mas alla de su rol» por: «permisos por empresa **que amplíen**
     su rol. Lo único por empresa son sus **añadidos activos** (`company_addon_overrides`), que
     solo **recortan**: el permiso efectivo es rol ∩ añadidos activos (QC-277)». Enmienda
     D13–D16: antes decía `companies.addons`; T16 ya lo escribió así y T29 lo corrige.
   - Bullet de exentas del mismo apartado: gana `addons` y pasa de diez a once tablas (§ 10.3,
     punto 6).
2. **`## Permisos y autenticacion`, viñeta «Los permisos de la sesion son una foto del instante del
   login» (hoy l. 558-560; la ficha la cita como `:557`, la línea de encima).** Se sustituye por:
   «Los permisos se resuelven en cada petición, en la misma lectura de sesión: los del rol actual
   menos los de los añadidos no activos de la empresa. Un cambio de rol o de añadidos vale desde la
   siguiente petición; lo ya pintado en pantalla no se repinta solo». El párrafo «Permisos que
   envejecen» de su `### Por qué` pasa a explicar esto.
3. **`## Permisos y autenticacion`**, viñeta nueva:
   - el catálogo de añadidos vive en `identity/domain/company-addons.ts`;
   - las operaciones de añadido sin permiso propio se cortan con `requireAddon` y
     `requirePageAddon`;
   - lo que corre sin sesión comprueba el añadido por empresa, y lo vigila
     `guard-rutas-fuera-de-sesion`.
4. **`## Server Actions vs Route Handlers > Crons internos`**: «los crons son núcleo y no miran
   añadidos; el webhook de un añadido sí».

`docs/architecture.md` también lo tocó QC-275 (ya en `dev`): estas son ediciones de líneas
distintas.

---

## 12. Choques con otras features

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `lib/modules/documentos/domain/run-document-job.ts` | **QC-275** (Christian; código en `dev`, ficha aún «En curso») | Solo un bloque nuevo tras `claim` y una dependencia nueva. Si QC-275 vuelve a tocar el archivo antes del merge, se integra en F2.3 (`git merge origin/dev`). |
| `lib/composition/index.ts` | QC-275 y todas | Solo dos claves al final de `identity` y una dependencia nueva en el bloque de `runDocumentJob`. |
| `db/schema.prisma`, `db/migrations/` | Cualquiera con esquema | Dos modelos nuevos y una relación inversa en `Company` y en `User` (enmienda D13–D16). Timestamp re-fechado si hace falta. |
| `tests/guards/guard-empresa-en-esquema.test.ts`, bullet de exentas de `docs/architecture.md` | Cualquier ficha que cree un catálogo global | Una entrada más en `EXENTAS` y en el bullet. Si otra ficha añade una exenta antes del merge, se suman las dos al integrar en F2.3. |
| `docs/architecture.md` | QC-275 | Líneas distintas (§ 11). |
| `app/(private)/produccion/formulas/page.tsx`, `proveedores/[id]/page.tsx` | QC-275, **QC-280** (Christian, en curso) | **No se tocan**: el recorte de `documentos.modificar` ya oculta el botón. |
| `lib/modules/identity/adapters/driving/company-actions.ts`, `company-event.ts`, `company-view.ts` | QC-165 / QC-166 / QC-278 (pendientes) | Solo se añaden cosas al final. |
| `e2e/helpers/landing.ts` | Toda ficha con E2E | Cambio de cuerpo, misma firma pública. |

**QC-275 en concreto.** No hay solape de responsabilidad. QC-275 decide «con qué proveedor se lee»;
esta ficha decide «si la empresa tiene la función». No se toca ningún archivo de su pantalla ni de
sus adaptadores de IA. El único archivo compartido con lógica es `run-document-job.ts`.

---

## 13. Alternativas descartadas

> **Enmienda D13–D16.** La alternativa 1 de la versión aprobada (tabla por empresa y módulo) pasa
> a ser **la elegida**, con catálogo propio y FK (§ 2.2, 2.3). Las descartadas por la enmienda son
> la 1 y la 9; la 4 queda absorbida.

1. **Columna `companies.addons TEXT[]`** (lo que se aprobó primero y se implementó en T2).
   - A favor: sale en el `JOIN` que ya existe, sin sentencia SQL nueva en la sesión.
   - **Se descarta por los planes** (Christian Quevedo, 10575 y 10576). Con QC-182 hay que
     distinguir tres estados por añadido: lo trae el plan, el Maestro lo prendió aparte, el Maestro
     lo apagó aunque lo traiga el plan. Una lista de prendidos solo distingue dos.
   - Además deja la lista abierta en la base: una clave mal escrita se guarda y no concede nada.
     Con la FK no se puede guardar.
   - El coste aceptado a cambio es una sentencia SQL más en la sesión (§ 3.1, P6), sin invocación
     nueva del lector.
2. **Guardar los añadidos apagados en vez de los prendidos.**
   - Ahorraría el sembrado de excepciones de la migración y el censo de E2E: una empresa sin filas lo tendría todo.
   - Pero falla abierto: un alta por cualquier vía nueva nacería con todo, en contra de D7, y un
     añadido futuro se prendería solo en todas las empresas.
   - Se prefiere fallar cerrado y pagar el censo.
3. **Quitar filas de `role_permissions` al apagar.** Los roles son del sistema y se comparten entre
   empresas (`docs/architecture.md > Dominio`): apagar en una empresa lo apagaría en todas.
4. **`CHECK ("addons" <@ ARRAY[...])` con la lista cerrada en la base.** Absorbida por la
   enmienda: D13 cierra la lista con la FK a `addons`, y cada añadido futuro es una migración con
   su `INSERT`. La guardia de § 9.4 impide que código y tabla se separen, que era el riesgo de
   cerrar la lista en la base.
5. **Calcular el destino del logo en el layout y pasarlo como prop.** Resuelve el logo, pero no el
   middleware, que no puede consultar nada. Habría dos caminos para la misma regla. `/inicio` sirve
   a los dos.
6. **Permisos nuevos para los puntos sin permiso propio** (p. ej. `importacion.modificar`). Cambia
   el catálogo y los roles de todas las empresas para algo que es por empresa. D1 dice «módulos
   enteros, no permisos sueltos».
7. **Cortar en el middleware.** El borde no conoce permisos ni puede consultar la base
   (`guard-middleware-edge`).
8. **Código de fallo nuevo `addon_disabled` para el trabajo descartado.** Exigiría un código y un
   texto en `errores` y tocar `failure-kind.ts` de QC-275, para un mensaje que nadie ve.
   `unauthorized` ya es definitivo.
9. **Excepciones sin tabla `addons` ni FK** (`addon_key` texto libre). Descartada por D13. Ahorra
   una tabla y su sembrado, pero deja entrar claves que el código no conoce, y QC-182 tendría que
   crear el catálogo igualmente para `plan_addons`.
10. **Apagar borrando la fila** en vez de escribir `enabled = false`. Descartada por D14. Sin
    planes da lo mismo, pero con QC-182 no habría forma de apagar lo que trae el plan.
11. **Crear ya `plans`, `plan_addons` y `companies.plan_id`.** Descartada por D16: es QC-182, y
    sin precio ni cobro no hay quien los use.

---

## 14. Riesgos y desconocidos

1. **Censo de E2E.** Unos 70 specs crean su empresa. Los que entren en un añadido fallarán hasta
   llamar a `enableAllAddons`. El helper de aterrizaje cubre el resto. El censo exacto solo sale
   corriendo la suite (T20), y puede añadir archivos a `tasks.md > Archivos esperados`.
2. **P2–P7 abiertas** con su defecto. P2 es la que más pesa, porque decide qué ve producción al
   desplegar.
3. **El PDF de un trabajo descartado se queda en el bucket**, como en los demás fallos definitivos.
   Si eso molesta, es ficha de limpieza aparte.
4. **Sin pantalla hasta QC-278.** El Maestro no puede prender ni apagar desde la app. Con el defecto
   de P2, nadie pierde nada al desplegar.
5. **Migración reescrita en sitio (enmienda).** Cualquier base local o efímera que ya aplicó la
   versión con la columna tiene `20261014190000_company_addons` en `_prisma_migrations` con otro
   checksum. Hay que revertirla con el `down.sql` viejo (`DROP COLUMN`) **antes** de traer el
   nuevo, o recrear la base. No hay base compartida afectada: la migración no está en `dev`
   (`progress/impl_QC-277.md` lo confirma para `QuimiCloude`).
6. **Una sentencia SQL más por petición en la sesión** (§ 3.1). Pendiente de lo que traiga la ficha
   de Christian (P6). Si se exige cero sentencias, el camino es `relationJoins`, que es decisión de
   todo el repo, no de esta ficha.
7. **Limpiezas E2E y de integración que borran empresas.** Con `ON DELETE CASCADE` no tienen que
   conocer la tabla nueva. Si alguna borra usuarios Maestro que sean autores de excepciones, el
   `RESTRICT` de `created_by` la frenará; los E2E escriben sin autor (P7), así que no debería
   pasar.
8. **Censo E2E de T20.** Las llamadas a `enableAllAddons` que ya existan siguen valiendo: cambia el
   cuerpo del helper, no su firma.

---

## 15. Enmienda del 2026-10-15: qué cambia y qué no

Fuente: comentarios de Christian Quevedo en QC-277 (ids 10575 y 10576) y la respuesta de Carlos
Restrepo del mismo día (D13–D16 en `requirements.md`).

**Cambia** (solo la capa de datos y sus pruebas; tareas T22–T31):

| Pieza | Cambio | § |
|---|---|---|
| `db/schema.prisma` | Fuera `Company.addons`; nacen `Addon` y `CompanyAddonOverride`, con relaciones inversas en `Company` y `User` | 2.2 |
| `db/migrations/20261014190000_company_addons/` | Reescrita en sitio: dos tablas, sembrado del catálogo, cinco excepciones prendidas por empresa existente, RLS; `down.sql` borra las dos tablas | 2.3 |
| `session-user-prisma.ts` | La relación `company.addonOverrides` (`enabled: true`) en vez de la columna | 3.1 |
| `company-addons-prisma.ts` | `findByCompany` lee excepciones; `apply` bloquea la empresa, hace `upsert` por cambio y escribe los eventos en la misma transacción | 6.3 |
| `initial-access-repository-prisma.ts` | `create` anidado con las cinco excepciones | 2.5 |
| `e2e/helpers/addons.ts`, `e2e/helpers/landing.ts`, `e2e/modulos-por-empresa.spec.ts` | Escriben y leen excepciones | 10.2 |
| Guardia nueva `guard-catalogo-de-anadidos` | Código = tabla | 9.4 |
| `guard-empresa-en-esquema`, `docs/architecture.md`, `architecture-doc.test.ts` | `addons` exenta; la viñeta nombra `company_addon_overrides` | 10.3, 11 |
| Tests `.int` y de migración | Siembran y miran excepciones en vez de la columna | 10.1 |

**No cambia** (y su código ya hecho se queda como está):

- **Dominio:** `company-addons.ts` entero (`ADDONS`, `ADDON_PERMISSIONS`, `ADDON_REQUIRES`,
  `CORE_PERMISSIONS`, `effectiveAddons` y `effectivePermissions` con `string[]`, `assertAddon`,
  `hasAddon`).
- **Sesión, del puerto hacia arriba:** `SessionUserRecord.companyAddons`, `resolveSession` y
  `SessionUser.addons`.
- **Puerto `CompanyAddonRepository`** (§ 6.2) y `is-company-addon-active.ts`.
- **Casos de uso y acciones del Maestro (T15):** `get-company-addons.ts`, `set-company-addon.ts`,
  `set-all-company-addons.ts`, sus vistas, entradas y Server Actions, y sus tests unitarios.
- **Cortes:** `requireAddon` en los casos de uso de importación, `requirePageAddon`, el botón
  «Importar», el menú, la guardia de pantallas de añadido y la de rutas fuera de sesión.
- **`/inicio`, logo, middleware y login.**
- **Webhook de documentos y cron** (§ 8).
- **Historial** (`company-event.ts`, `company-view.ts`).
- **Las fixtures de `SessionUser` y `Actor` con `addons: [...]`** de los tests unitarios: siguen
  siendo `string[]` en memoria.

**Fuera de alcance (D16):** `plans`, `plan_addons` y `companies.plan_id` son de QC-182. Cuando
lleguen, la regla «añadidos activos = plan + excepciones prendidas − excepciones apagadas, luego
dependencias (R4)» cambia solo el paso 2 de `apply`, `findByCompany` y la lectura de § 3.1. El
dominio sigue recibiendo la lista de prendidos.
