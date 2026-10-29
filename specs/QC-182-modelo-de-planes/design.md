# QC-182 — modelo-de-planes · design.md

> Requisitos: `requirements.md` (R1–R33; preguntas P1 y P2 con su defecto). Aquí va el **cómo**.
>
> **Regla transversal.** Ningún comentario nuevo de producción (incluidos `db/schema.prisma` y las
> migraciones) cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada»
> (`docs/conventions.md > Comentarios`). En los tests, `R<n>` va en el nombre del caso.
>
> **Sin UI.** No hay componente ni cambio visual: no aplica la regla de decisión de componentes
> ni el pase `/design` (`docs/perfil-agentes.md > Todos los agentes`).
>
> **Dependencias nuevas:** ninguna.

---

## Lo que ya existe

Términos buscados: «plan», «planes», «suscripción», «precio mensual/anual», «moneda»,
«currency», «plans», «billing», «módulos por empresa», «addons».

Sitios:

- el board (`feature_list.json`, todos los estados, por `name` y `description`);
- `specs/` con grep;
- el código con Grep/Read. **El grafo no tiene indexado este worktree** (`list_projects` no
  devuelve `.worktrees/QC-182-modelo-de-planes`); se siguió con Grep/Read sobre `lib/`, `db/` y
  `tests/`.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board | **QC-185** (`pending`, crud-de-planes), **QC-186** (pantalla), **QC-187** (suscripción), **QC-188** (permisos limitados por plan). Ninguna crea la tabla de planes: todas dependen de esta. | Fuera de alcance (bloque «Lo que NO entra»). § 9 dice qué les deja esta ficha. |
| Board | **QC-185** dice todavía «precio mensual y anual positivos» y «al menos un permiso»; QC-186 dice «permisos incluidos». Contradicen las decisiones cerradas de esta ficha (0 vale, al menos UNO de los dos precios, módulos y no permisos, plan sin módulos válido). | No se reabre nada aquí. Se avisa al leader para que el board de QC-185 y QC-186 se alinee al afinarlas (§ 9). |
| `specs/` | **QC-277** D13: catálogo `addons` con PK de texto, sembrado por migración, RLS forzada, exento en `guard-empresa-en-esquema`; D16: «plan = conjunto de módulos + precio». § 6.3 anuncia que con planes «prendido» pasará a ser «plan + excepciones». | Se reutiliza la tabla `addons` como destino de la FK de los módulos del plan (§ 2). La regla de «prendido» con plan es de QC-188 y no se toca. |
| `specs/` | **QC-161**: rol Maestro y sus dos permisos por migración de datos (`20261001160815_platform_maestro_role`). **QC-221/QC-245**: un permiso nuevo = entrada en `PERMISSIONS` + `SEED_ROLE_PERMISSIONS` + migración de datos con `ON CONFLICT DO NOTHING` + test estático + test de integración. | Mismo patrón para `planes.*` (§ 4). |
| `specs/` | **QC-61**: `guard-empresa-en-esquema` con su lista `EXENTAS` y el bullet de `docs/architecture.md` que la repite. | Las dos tablas nuevas entran en `EXENTAS` con motivo, y el bullet pasa de doce a catorce (§ 2.4). |
| Código | `lib/modules/identity/domain/permissions.ts`: `PERMISSIONS`, `SEED_ROLE_PERMISSIONS`, `ADMIN_EXCLUDED_PERMISSIONS`. `seed-initial-access.ts` deriva permisos y asignaciones de esas constantes. | Se amplían; el seed no cambia de código (§ 4.3). |
| Código | `lib/modules/identity/domain/company-addons.ts`: `CORE_PERMISSIONS` escrito uno a uno; un test exige `CORE ∪ ADDON = PERMISSIONS`. | `planes.*` entran en `CORE_PERMISSIONS` (§ 4.1). |
| Código | `platform-actor.ts`: `PlatformActor` y `requirePlatformPermission`, para operaciones del Maestro. | No se usa aquí (no hay casos de uso); es lo que usará QC-185. |
| Código | Precio con `decimal(14,4)` y `CHECK` de no negativo: `orders.sale_price` (`20261022120000_orders_sale_price`). Formato por `CHECK` a mano: `companies.country`. Unicidad por índice funcional parcial `lower(...) WHERE deleted_at IS NULL`: `users`, `companies`. | Mismos patrones en `plans` (§ 2.2). |
| Código | Ninguna tabla, modelo ni símbolo de planes, suscripciones o monedas en `db/schema.prisma` ni en `lib/`. | Nada que reutilizar ni que duplicar. |

**Conclusión:** nada existente resuelve el alcance. Se reutiliza la tabla `addons`, el patrón de
permisos de plataforma y los patrones de dinero, formato y unicidad.

---

## 1. Resumen técnico

- **Dos tablas nuevas**, de plataforma, dueño `identity`:
  - `plans`: nombre, descripción, moneda, precio mensual y anual, `active`, `created_at`,
    `updated_at`, `deleted_at`;
  - `plan_addons`: un par `(plan_id, addon_key)` por módulo del plan, con FK a `addons`.
- **Toda la integridad en la base**, con `CHECK`, FK, PK e índice único parcial: R4–R18, R24 y R25
  se cumplen escriba quien escriba. Los casos de uso de QC-185 validarán además en el dominio
  para dar errores legibles, pero la base es la última palabra.
- **Una constante de dominio** `PLAN_CURRENCIES = ['CRC', 'USD']`, para que el `CHECK` de la
  migración tenga contra qué compararse en un test, y para que QC-185 la use en su `zod`.
- **Dos permisos nuevos** `planes.consultar` y `planes.modificar`, solo del Maestro, del núcleo.
- **Dos migraciones**: el esquema (`_plans`) y los datos de permisos (`_plans_permissions`),
  cada una con su `down.sql`.
- **Sin puertos, adaptadores, casos de uso, Server Actions ni rutas**: son de QC-185.

---

## 2. Modelo de datos

### 2.1 Dueño del modelo: `identity`

Los dos modelos llevan `/// @module identity`, como `Addon` y `CompanyAddonOverride`. Motivo:
`plan_addons` cuelga con relación Prisma de `Addon`, y `identity` es el único módulo que escribe
el catálogo de añadidos (QC-277 § 6.3). Ver alternativa 1 (§ 8).

### 2.2 Prisma (`db/schema.prisma`)

Se colocan detrás de `CompanyAddonOverride`. `Addon` gana la relación inversa `plans PlanAddon[]`.

```prisma
/// Plan de la plataforma, no de una empresa. Al menos uno de los dos precios, en la moneda del
/// plan. La unicidad del nombre, los CHECK y la moneda permitida van escritos a mano en la
/// migración: Prisma no los modela.
/// @module identity
model Plan {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name         String
  description  String?
  currency     String    @db.VarChar(3)
  monthlyPrice Decimal?  @map("monthly_price") @db.Decimal(14, 4)
  annualPrice  Decimal?  @map("annual_price") @db.Decimal(14, 4)
  active       Boolean
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt    DateTime? @map("deleted_at") @db.Timestamptz(6)

  addons PlanAddon[]

  @@map("plans")
}

/// Módulo que trae un plan. El núcleo no se lista: solo caben claves del catálogo de añadidos.
/// @module identity
model PlanAddon {
  planId   String @map("plan_id") @db.Uuid
  addonKey String @map("addon_key")

  plan  Plan  @relation(fields: [planId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  addon Addon @relation(fields: [addonKey], references: [key], onDelete: Restrict, onUpdate: Cascade)

  @@id([planId, addonKey], map: "plan_addons_pkey")
  @@index([addonKey], map: "plan_addons_addon_key_idx")
  @@map("plan_addons")
}
```

Decisiones:

- **`active` sin `@default`** (R5). Quien crea el plan dice si nace activo; la base no lo supone.
  Lo decide QC-185 en su caso de uso.
- **`description` anulable** (R6, defecto de P2). Si P2 se responde «obligatoria», pasa a
  `String` con `CHECK` de no vacío, como `name`.
- **`currency` como texto con `CHECK` de lista cerrada**, no `enum` de Postgres (alternativa 2).
- **Precios anulables**: ausente no es 0 (R12). El `CHECK` de «al menos uno» va en la migración.
- **Sin `created_by`/`updated_by`.** El alcance no pide autoría ni historial de planes. Si QC-185
  lo quiere, es su migración (alternativa 5).
- **`ON DELETE CASCADE` de `plan_addons` hacia `plans`.** Los planes se dan de baja por
  `deleted_at` y su fila se conserva con sus módulos (R23); el borrado físico solo lo hacen tests
  y limpiezas, que así no tienen que conocer `plan_addons`. Mismo criterio que
  `company_addon_overrides → companies`.
- **`ON DELETE RESTRICT` hacia `addons`** (R18): retirar un añadido del catálogo que algún plan
  trae falla con `23503`. Retirarlo obliga a decidir antes qué pasa con esos planes.
- **Sin relación con `companies` ni `users`**: los planes no son de nadie (R1).

### 2.3 Migración `db/migrations/20261028120000_plans/`

El timestamp tiene que ser posterior a la última migración de `dev` al implementar (hoy
`20261024130000_whatsapp_contacts_last_read`); si `dev` trae una posterior antes del merge, se
re-fecha en F2.3.

`migration.sql` (se genera con `pnpm run db:migrate:create` y se completa a mano; lo que Prisma
no modela es drift conocido y se deja escrito):

```sql
-- 1. Planes de la plataforma: sin empresa.
CREATE TABLE "plans" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "currency"      VARCHAR(3) NOT NULL,
  "monthly_price" DECIMAL(14,4),
  "annual_price"  DECIMAL(14,4),
  "active"        BOOLEAN NOT NULL,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ(6) NOT NULL,
  "deleted_at"    TIMESTAMPTZ(6),
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plans_name_not_blank" CHECK (btrim("name") <> ''),
  CONSTRAINT "plans_currency_allowed" CHECK ("currency" IN ('CRC', 'USD')),
  CONSTRAINT "plans_monthly_price_non_negative" CHECK ("monthly_price" IS NULL OR "monthly_price" >= 0),
  CONSTRAINT "plans_annual_price_non_negative" CHECK ("annual_price" IS NULL OR "annual_price" >= 0),
  CONSTRAINT "plans_has_price" CHECK ("monthly_price" IS NOT NULL OR "annual_price" IS NOT NULL)
);

-- 2. Nombre único sin distinguir mayúsculas entre los planes no borrados.
CREATE UNIQUE INDEX "plans_name_unique" ON "plans" (lower("name")) WHERE "deleted_at" IS NULL;

-- 3. Módulos del plan: solo claves del catálogo de añadidos.
CREATE TABLE "plan_addons" (
  "plan_id"   UUID NOT NULL,
  "addon_key" TEXT NOT NULL,
  CONSTRAINT "plan_addons_pkey" PRIMARY KEY ("plan_id", "addon_key")
);

CREATE INDEX "plan_addons_addon_key_idx" ON "plan_addons" ("addon_key");

ALTER TABLE "plan_addons" ADD CONSTRAINT "plan_addons_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_addons" ADD CONSTRAINT "plan_addons_addon_key_fkey"
  FOREIGN KEY ("addon_key") REFERENCES "addons"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. RLS activada y forzada, sin policies, al final.
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" FORCE ROW LEVEL SECURITY;
ALTER TABLE "plan_addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_addons" FORCE ROW LEVEL SECURITY;
```

`down.sql` (R33; índices, FK y `CHECK` caen con sus tablas):

```sql
DROP TABLE "plan_addons";
DROP TABLE "plans";
```

Notas:

- **El paso 2 depende de P1** (R24, R25). Si P1 se responde «puede repetirse», el índice sale y
  nada más cambia. Es `lower("name")`, el mismo patrón de `users_username_unique`; recortar
  espacios lo hará QC-185 en su entrada, no el índice.
- **`plans_currency_allowed` es sensible a mayúsculas** (R8): `'crc'` no pasa. Sumar una moneda
  es otra migración que rehace el `CHECK` y la constante del § 3, y el test estático del § 7 pone
  el gate en rojo si difieren.
- **Sin filas sembradas.** Ningún plan nace con la migración: los crea el Maestro (QC-185/186).
  Que las empresas existentes queden con algún plan es pregunta abierta de QC-187.
- **No toca `company_addon_overrides`** ni ninguna otra tabla existente (R20).

### 2.4 Guardia de empresa y documentación

- `tests/guards/guard-empresa-en-esquema.test.ts`, `EXENTAS` gana dos entradas al final:
  - `{ tabla: 'plans', motivo: 'planes de la plataforma, compartidos por todas las empresas' }`;
  - `{ tabla: 'plan_addons', motivo: 'cuelga de un plan de la plataforma y del catalogo de añadidos' }`.
  
  El caso «EXENTAS son exactamente las doce» pasa a catorce, con las dos al final.
- `docs/architecture.md > Dominio`, punto 1, bullet de exentas: «lista corta y cerrada de **catorce**
  tablas», y se añade el grupo «los planes de la plataforma (`plans`, `plan_addons`)». La guardia
  compara ese bullet con `EXENTAS` (su caso R14).
- `docs/architecture.md > Preguntas abiertas del dominio`, punto 5 (Moneda por empresa): una
  frase que dice que la moneda de los **planes** se guarda por plan (`CRC` o `USD`) y que eso **no**
  cierra la moneda del costo, que sigue implícita. Lo pide la decisión cerrada de la moneda.
- `guard-rls-force` descubre las tablas leyendo el SQL: las dos tienen `ENABLE` + `FORCE` (R26).
- `tests/guards/guard-identificador-de-request.test.ts`, `MIGRACIONES_ESPERADAS`: las dos
  carpetas nuevas al final, con su línea de «no toca el identificador».

---

## 3. Dominio: `lib/modules/identity/domain/plan-currency.ts` (nuevo)

```ts
export const PLAN_CURRENCIES = ['CRC', 'USD'] as const;
export type PlanCurrency = (typeof PLAN_CURRENCIES)[number];
```

- Reexportado por `lib/modules/identity/index.ts`.
- Es la fuente de verdad de la lista; el `CHECK` de la migración es su espejo y el test estático
  del § 7 los compara (mismo esquema que `ADDONS` ↔ tabla `addons`).
- **Nada más en el dominio.** Ni tipo `Plan`, ni puerto, ni validación `zod`: los define QC-185
  con su contrato de entrada y salida. Escribirlos aquí sin consumidor sería infraestructura «por
  si acaso» (`docs/architecture.md`).

---

## 4. Permisos

### 4.1 `lib/modules/identity/domain/permissions.ts`

- `PERMISSIONS` gana, **al final** y en este orden:

  ```ts
  { code: 'planes.consultar', module: 'planes', action: 'consultar',
    description: 'Consultar los planes de la plataforma.' },
  { code: 'planes.modificar', module: 'planes', action: 'modificar',
    description: 'Dar de alta, editar y desactivar los planes de la plataforma.' },
  ```

- JSDoc de `PERMISSIONS`: un párrafo corto, sin citas, como el de `empresas`: suma
  `planes.consultar` y `planes.modificar`; como `empresas`, su módulo no es una carpeta de
  `lib/modules/`; solo los recibe el Maestro.
- `SEED_ROLE_PERMISSIONS[ROLE_MAESTRO]` pasa a
  `['empresas.consultar', 'empresas.modificar', 'planes.consultar', 'planes.modificar']` (R28).
  Su JSDoc («El Maestro nace con exactamente…») se actualiza con los cuatro.
- `ADMIN_EXCLUDED_PERMISSIONS` gana `'planes.consultar'` y `'planes.modificar'` al final (R29). Sin
  esto, los tests que calculan «lo del Administrador = catálogo − excluidos» exigirían que el
  Administrador los tuviera. Su JSDoc ya dice «las empresas son cosa de la plataforma»; se amplía
  a «las empresas y los planes».
- **Ningún otro rol cambia.**

### 4.2 `lib/modules/identity/domain/company-addons.ts`

`CORE_PERMISSIONS` gana `'planes.consultar'` y `'planes.modificar'` al final (R30). Sin ellos, el
test de partición `CORE ∪ ADDON = PERMISSIONS` se pone rojo. Además, el Maestro no tiene empresa y
`resolveSession` no le aplica recorte; ser del núcleo deja eso explícito para QC-188.

### 4.3 Migración de datos `db/migrations/20261028120100_plans_permissions/`

Mismo patrón que `20261024120000_whatsapp_read_permission` y que el paso 3–4 de
`20261001160815_platform_maestro_role`:

```sql
-- Migracion de DATOS: solo escribe filas en `permissions` y `role_permissions`. Idempotente por
-- `ON CONFLICT ... DO NOTHING`. Los literales se duplican porque una migracion no puede importar
-- TypeScript; un test estatico los compara con las constantes de la app.

INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('planes.consultar', 'planes', 'consultar', 'Consultar los planes de la plataforma.', CURRENT_TIMESTAMP),
  ('planes.modificar', 'planes', 'modificar', 'Dar de alta, editar y desactivar los planes de la plataforma.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", "p"."code" FROM "roles" AS "r"
CROSS JOIN (VALUES ('planes.consultar'), ('planes.modificar')) AS "p"("code")
WHERE "r"."name" = 'Maestro'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
```

`down.sql` (R33):

```sql
DELETE FROM "role_permissions" WHERE "permission_code" IN ('planes.consultar', 'planes.modificar');
DELETE FROM "permissions" WHERE "code" IN ('planes.consultar', 'planes.modificar');
```

- **Base sin el rol Maestro** (una base que nunca corrió la migración del Maestro no existe, pero
  una de test podría): el segundo `INSERT` no inserta nada y el seed lo completa (R32).
- **El seed no cambia de código.** `seed-initial-access.ts` deriva los permisos que faltan de
  `PERMISSIONS` y las asignaciones de `SEED_ROLE_PERMISSIONS` (R32).
- **Ningún usuario referencia un permiso**: el `down.sql` no puede fallar por datos.
- **RLS**: `permissions` y `role_permissions` ya la tienen forzada; no se toca.

### 4.4 Por qué dos migraciones y no una

El esquema y los datos de permisos se revierten y se prueban por separado, como en todo permiso
desde QC-142. Los tests de permisos localizan su carpeta por sufijo (`/_plans_permissions$/`);
juntarlo con las tablas los obligaría a separar el SQL a mano.

---

## 5. Lo que NO cambia

- `resolveSession`, `effectiveAddons`, `effectivePermissions`, la sesión y el menú. El plan no
  prende ni apaga nada todavía (QC-188).
- `company_addon_overrides` y sus casos de uso (R20).
- `lib/composition/index.ts`: no hay puerto que atar.
- Navegación y pantallas: no hay enlace ni página, así que `guard-nav-permisos-declarados` y
  `guard-pantallas-exigen-permiso` no cambian.

---

## 6. Tests que se tocan por arrastre

Fijan a mano el catálogo o el conjunto del Maestro, a propósito: cambian con él.

| Archivo | Qué cambia |
|---|---|
| `tests/unit/identity/permissions.test.ts` | `CODIGOS_DEL_REQUISITO` gana los dos al final con su línea de fecha; los casos que fijan el Maestro con `toEqual([...empresas])` (l. 806, 1004, 1180, 1327, 1492) pasan a compararlo **sin** `planes.*` mediante un `sinPlanes`, como ya hace el archivo con `sinEnviar` y compañía; un `describe` nuevo para R27–R29. |
| `tests/unit/identity/seed/seed-initial-access.test.ts` | El caso de l. 901 (Maestro exacto) con los cuatro. |
| `tests/unit/navegacion/qc75-convenciones.test.ts` | Lista del catálogo: los dos al final. |
| `tests/unit/asignaciones/schema/order-assignments-migration.test.ts` | Lista del catálogo: los dos al final. |
| `tests/unit/identity/addons/company-addons.test.ts` | Caso nuevo de R30; la partición sigue igual. |
| `tests/guards/guard-empresa-en-esquema.test.ts` | `EXENTAS` y su recuento (§ 2.4). |
| `tests/guards/guard-identificador-de-request.test.ts` | `MIGRACIONES_ESPERADAS` (§ 2.4). |
| `tests/integration/identity/identity-seed.int.test.ts` | Caso nuevo de R32, calcado del de `whatsapp.consultar`. |
| `tests/integration/aislamiento.json` | Los tres `.int.test.ts` nuevos en `transaccion`. |

Si al implementar aparece otro test que fije el catálogo o el Maestro, se amplía igual y se anota
en `progress/impl_QC-182.md`.

---

## 7. Tests nuevos y trazabilidad

| Test | Tipo | Requisitos |
|---|---|---|
| `tests/unit/identity/schema/plans-migration.test.ts` | estático (lee `migration.sql`, `down.sql` y `db/schema.prisma`; cada predicado contra el SQL real y contra una copia mutada en memoria) | R1 (sin `company_id`), R3 (columnas exactas en inglés y `snake_case`), R7 (el `CHECK` de moneda = `PLAN_CURRENCIES`), R13 (`DECIMAL(14,4)` en los dos precios), R26 (`ENABLE` + `FORCE` de las dos, sin `CREATE POLICY`), R33 (el `down.sql` borra exactamente las dos tablas, en orden) |
| `tests/integration/identity/plans-constraints.int.test.ts` | integración, transacción con ROLLBACK y `SAVEPOINT` para lo que debe fallar | R2, R4, R5, R6, R8, R9, R10, R11, R12, R13 (ida y vuelta de `1234567890.1234` y `0.3` exactos), R14, R15 (`pedidos`, `inventario`, `x` → `23503`), R16 (`23505`), R17, R18 (`DELETE FROM addons` con un plan que lo trae → `23503`), R19, R20 (excepciones de una empresa iguales antes y después), R21 (Prisma `update` mueve `updated_at` y no `created_at`), R22, R23, R24, R25 |
| `tests/integration/identity/plans-migration.int.test.ts` | integración: aplica el `down.sql` y el `migration.sql` reales dentro de la transacción | R33 (tras el down no existen `plans` ni `plan_addons`; tras el up vuelven con sus restricciones), R26 (`relrowsecurity` y `relforcerowsecurity` en `pg_class`) |
| `tests/unit/identity/schema/plans-permissions-migration.test.ts` | estático, mismo patrón que `whatsapp-read-permission-migration.test.ts` | R27 (literales = `PERMISSIONS`), R28 (solo el rol `ROLE_MAESTRO`), R31 (`ON CONFLICT DO NOTHING` en los dos `INSERT`), R33 (el down borra exactamente esos dos códigos) |
| `tests/integration/identity/plans-permissions-migration.int.test.ts` | integración, mismo patrón que `whatsapp-read-permission-migration.int.test.ts` | R31 (sobre base sin los permisos, crea y asigna solo al Maestro; segunda aplicación no cambia nada), R33 (el down deja la base como antes) |
| `tests/unit/identity/permissions.test.ts` (ampliado) | unit | R27, R28, R29 |
| `tests/unit/identity/addons/company-addons.test.ts` (ampliado) | unit | R30 (`CORE_PERMISSIONS` los contiene; `effectivePermissions` los conserva con ningún añadido activo) |
| `tests/integration/identity/identity-seed.int.test.ts` (ampliado) | integración | R32 |

Sin E2E (decisión cerrada): no hay pantalla.

---

## 8. Alternativas descartadas

1. **Módulo nuevo `suscripciones` (o `planes`) como dueño de las tablas.** La épica lo invita, pero
   hoy no tendría ni un caso de uso: `guard-arquitectura-modulos` exige un armazón (bloque 1) que
   quedaría vacío, y `PlanAddon` necesita relación Prisma con `Addon`, de `identity`. Con el modelo
   en `identity`, QC-185 puede decidir mover el dueño cambiando solo el `/// @module` si nace el
   módulo. Descartado por ahora.
2. **`enum` de Postgres para la moneda.** Tipa el cliente de Prisma, pero sumar una moneda es
   `ALTER TYPE ... ADD VALUE`, que no se puede revertir en un `down.sql` sin recrear el tipo, y un
   nombre genérico (`Currency`) invitaría a reutilizarlo para la moneda del costo, que sigue
   abierta en `docs/architecture.md`. El patrón `CHECK` de `companies.country` se revierte con un
   `DROP CONSTRAINT`.
3. **Módulos del plan como columna `text[]` en `plans`.** Es lo que QC-277 abandonó en su enmienda
   D13: un array no admite FK, así que una clave fuera del catálogo o del núcleo entraría sin
   error (R15) y retirar un añadido no sabría qué planes lo traen (R18).
4. **Módulos del plan como permisos sueltos** (lo que decía la tarjeta original). Lo cierra la
   primera decisión del humano: el plan otorga módulos.
5. **Autoría e historial de planes (`created_by`, tabla de eventos).** Nadie lo pidió en el
   alcance; es infraestructura «por si acaso». Si QC-185 lo necesita, es una migración aditiva.
6. **Validar solo en el dominio, sin `CHECK`.** Prisma se conecta como dueño y cualquier camino
   (seed, script, test, otro caso de uso) podría saltarse la validación. Los requisitos de forma
   son baratos de garantizar en la base, como `orders_sale_price_non_negative`.
7. **Un `CHECK` de que el nombre no lleve espacios al borde.** Endurece la base contra algo que la
   entrada de QC-185 resuelve recortando; un nombre mal recortado no rompe ningún invariante.

---

## 9. Lo que queda para las fichas siguientes

| Ficha | Qué recibe de aquí | Qué decide ella |
|---|---|---|
| **QC-185** (crud-de-planes) | Tablas con integridad en la base; `PLAN_CURRENCIES`; `planes.consultar` y `planes.modificar` sembrados al Maestro; `requirePlatformPermission` ya existente. | Puerto y adaptador Prisma, casos de uso con `zod`, mensajes de error (mapear `23505` de `plans_name_unique` y `23503` de `plan_addons_addon_key_fkey`), si `active` nace en verdadero, recorte del nombre, si la moneda puede cambiar con suscripciones vivas, paginación, autoría. **Su tarjeta del board debe alinearse** con las decisiones de esta ficha: 0 es válido, basta un precio, módulos y no permisos, plan sin módulos válido. |
| **QC-186** (pantalla) | Los dos permisos para su enlace de menú y su `requirePagePermission`. | Todo lo visual; su tarjeta dice «permisos incluidos» y debe decir «módulos». |
| **QC-187** (suscripción) | `plans.id` como destino de su FK. | Precio congelado por periodo (la decisión «un precio nuevo rige desde la próxima renovación»), qué plan tienen las empresas existentes. |
| **QC-188** (plan → añadidos) | `plan_addons`. | «Prendido» = módulos del plan + excepciones prendidas − apagadas, en la sesión; que los módulos cambien ya al editar el plan. |

---

## 10. Riesgos

1. **Choque de migraciones** con otras fichas en vuelo que añadan permisos o tablas: los tests que
   fijan el catálogo (§ 6) se tocan en cada ficha de permisos. Se resuelve en F2.3 al sincronizar
   con `dev`, re-fechando si hace falta.
2. **Choque en `guard-empresa-en-esquema.test.ts` y `docs/architecture.md`** si otra ficha suma una
   exenta a la vez: el recuento lo tienen que sumar las dos.
