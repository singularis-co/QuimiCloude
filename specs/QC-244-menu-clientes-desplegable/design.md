# QC-244 — menu-clientes-desplegable · design.md

> Zona: `frontend` · Complejidad: `low` · depends_on: — · Rama:
> `feature/QC-244-menu-clientes-desplegable`
>
> El **qué** está en `requirements.md` (R1–R15). Aquí va el **cómo**. Precedentes directos:
>
> - **QC-222**, el grupo «Integraciones» y sus páginas cascarón: `specs/QC-222-menu-de-integraciones/design.md`.
> - **QC-75**: el `NavGroup` sin permiso propio, el filtrado y el corte por permiso en cada `page.tsx`.
> - **QC-155**: el item de clientes y su test que lee el permiso de la fuente de `page.tsx`.
> - **QC-257**: el icono `square-user` de Clientes (D11/P3).
>
> **Regla transversal** (`docs/conventions.md > Comentarios`). Ningún comentario nuevo de
> producción ni de test cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests,
> `R<n>` va en el **nombre del caso**.

---

## Lo que ya existe

Términos buscados: `contactos`/`Contactos`, `desplegable`, `nav-clientes`, `CUSTOMER_CONTACTS`,
«placeholder»/«cascarón», `EmptyState`, `PageHeader`. Se buscaron en tres sitios:

- `feature_list.json`, por `name` y `description`;
- `specs/`, con grep;
- el código del worktree, con Grep/Read sobre `app/`, `components/`, `lib/`, `tests/` y `e2e/`.

El grafo (`codebase-memory-mcp`) **no se consultó** en esta tanda: todo lo de abajo sale de Grep/Read.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-245, QC-246 (`pending`) | Backend de WhatsApp y pantalla de chat. QC-246 reemplaza este placeholder y cambia el permiso a `whatsapp.consultar` | Son los eslabones siguientes, no la misma ficha. Nada suyo entra aquí |
| QC-236…QC-243 (`pending`) | Citan «contactos» como la tabla de contactos de WhatsApp (backend) | No se solapan: aquí no hay datos |
| QC-277 D1 (`specs/QC-277-modulos-por-empresa/requirements.md:50`) | El añadido «Integraciones» arrastrará a Contactos | No aplica todavía. Con `clientes.consultar`, que es permiso de núcleo (`CORE_PERMISSIONS` en `lib/modules/identity/domain/company-addons.ts`), el añadido no recorta nada. Lo resuelve QC-245/246 al cambiar de permiso |
| QC-257 D11/P3 (`specs/QC-257-shell-rediseno/requirements.md:57`) | Clientes pasa a `square-user`, y «QC-244 ajustará su icono» | **Se respeta**: el grupo lleva `square-user` (P1 de `requirements.md`). La unión `NavIconName` sigue teniendo `'contact'` sin uso; quitarlo no es de esta ficha |
| QC-222: grupo `nav-integraciones` en `lib/shared/navigation/private-nav.ts`, `IntegrationPlaceholder` en `app/(private)/integraciones/components/integration-placeholder.tsx` | El patrón de grupo y de página cascarón | El grupo **se calca** (D1). El placeholder **no se importa**: es propio de la ruta de integraciones y trae su texto fijo. Se sigue su forma (título más estado vacío, sin controles) con las piezas catalogadas de abajo |
| `components/shared/CATALOGO.md` > `PageShell`, `PageHeader`, `EmptyState` | Contenedor de página, cabecera con el único `h1` y vacío con borde discontinuo | **Paso 1 de la regla de decisión: se reutilizan** sin tocarlas. `EmptyState` pinta el mismo marcado que `IntegrationPlaceholder` (`flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center` con un `<p>` atenuado). No se crea ningún componente nuevo, así que no hace falta pase `/design` |
| `NavGroupInline` y `NavGroupFloating` en `components/private/app-sidebar.tsx` | Dibujan cualquier `NavGroup`. El submenú arranca abierto si un hijo es la ruta activa | Se reutilizan **sin tocarlos** (R15). El grupo nuevo es un dato más |
| `filterNavItemsByPermissions` y `firstVisibleNavHref` en `private-nav.ts` | Quitan el grupo sin hijos visibles y aterrizan en su primer hijo | Se reutilizan sin cambios. Dan R4, R5 y R13 por construcción |

Conclusión: no hay nada equivalente ya hecho. Se reutilizan el patrón de QC-222 y tres piezas del
catálogo.

---

## 0. Hallazgos al leer el código

Las líneas son de este worktree. T0 las vuelve a medir contra `dev` sincronizado.

1. **El item de hoy** (`private-nav.ts:326-336`) es un `kind: 'link'`:
   - `href: CUSTOMERS_ROUTE`, `label: CUSTOMERS_LABEL`, `testId: 'nav-clientes'`;
   - `permission: 'clientes.consultar'`, `icon: 'square-user'`, `section: NAV_SECTION_DIRECTORY`.

   Va justo detrás de `nav-proveedores`. Su comentario cita el test de coherencia
   menú-página (`tests/unit/clientes-ui/private-nav-clientes.test.ts`).
2. **`NavGroup` no lleva permiso** (`private-nav.ts:243-251`). El filtrado lo quita entero si no
   le queda ningún hijo visible (`:475-496`). R4 y R5 salen de ahí.
3. **El aterrizaje entra en los grupos.** `firstVisibleNavHref` (`:509-518`) devuelve el primer
   hijo de un grupo. El primer hijo es `CUSTOMERS_ROUTE`, en la misma posición que el enlace de
   hoy, así que el aterrizaje no cambia para nadie (R13). El Administrador aterriza antes en
   `/dashboard`.
4. **`/clientes/contactos` ya está cubierta por sesión.** `PRIVATE_ROUTE_PREFIXES` compara por
   segmentos (`route === prefix || route.startsWith(prefix + '/')`), y `CUSTOMERS_ROUTE` está en la
   lista (`lib/shared/routes.ts:369`). `guard-rutas-privadas-cubiertas` acepta la página nueva sin
   fila nueva (D2, R10).
5. **El corte de página** es `requirePagePermission(code)`: sin sesión redirige a
   `LOGIN_ROUTE_SESSION_ENDED`, y sin el permiso llama a `notFound()`. Es el mismo de
   `app/(private)/integraciones/inventarios/page.tsx`.
6. **Tests que fijan la forma del menú o el censo de pantallas, y se ponen rojos** (§6.2):
   - `guard-nav-permisos-declarados` (ancla de 15 enlaces);
   - `guard-pantallas-exigen-permiso` (`RUTAS_ESPERADAS_HOY`, 29 pantallas);
   - `tests/unit/shell/nav-iconos.test.ts` (forma exacta de cada destino);
   - `tests/unit/navegacion/orden-secciones.test.ts:75` (la clave de un grupo es su `testId`);
   - `tests/unit/clientes-ui/private-nav-clientes.test.ts` (entero).
7. **Tests de alcance de clientes que la página nueva pisa** (§6.3):
   - `tests/unit/clientes/scope.test.ts:203-214`, R26: el literal `'clientes.consultar'` solo
     puede estar en `app/(private)/clientes/page.tsx`, **por ruta exacta**;
   - `tests/unit/recetas-ui/recipe-route-contract.test.ts:1389+`: el censo **cerrado** de exports
     de `lib/shared/routes.ts`.
8. **Tests de clientes que barren la carpeta de la ruta** y verán `contactos/`:
   `tests/unit/clientes-ui/clientes-convenciones.test.ts` (`FUENTES_DE_LA_RUTA` es recursivo). Los
   archivos nuevos cumplen sus reglas si:
   - no dicen `order`;
   - no usan `100vh` ni `h-screen`;
   - no declaran `'use client'`;
   - no hacen `fetch` propio.

   El caso de la raíz de la ruta solo mira archivos, no carpetas, así que `contactos/` no le
   afecta. Esto no se enmienda: se cumple.
9. **E2E que dependen de `nav-clientes`.** Ninguno hace clic en él:
   - `e2e/clientes.spec.ts:306` y `:425` solo cuentan el `testId` (1 y 0). Siguen valiendo con el
     disparador del grupo (D4).
   - `e2e/movimiento.spec.ts:615` **sí se rompe**: afirma que el indicador del item activo cubre
     `nav-clientes` al cargar `/clientes`, y desde aquí lo activo es el hijo `nav-clientes-lista`,
     dentro de la sublista. Además, su paso R13 desliza el indicador de Clientes a Proveedores
     «dentro de la misma lista»: ya no son la misma lista, así que habría fundido y no
     deslizamiento (§7.2).
   - `e2e/marca-componentes.spec.ts:442` (`FIRST_GROUP`) y los tests de `sidebar-*` y
     `app-sidebar` toman el **primer** grupo del array, que pasa a ser Clientes en vez de
     Integraciones. Lo derivan del dato. Clientes es de núcleo y lo ve el Administrador, así que no
     cambia nada de lo que afirman. T0 lo confirma.

---

## 1. Qué cambia (resumen)

| Pieza | Cambio |
|---|---|
| `lib/shared/routes.ts` | Nueva `CUSTOMER_CONTACTS_ROUTE`, derivada de `CUSTOMERS_ROUTE`. `PRIVATE_ROUTE_PREFIXES` **no** cambia |
| `lib/shared/navigation/private-nav.ts` | Nueva `CUSTOMER_CONTACTS_LABEL`. El item `nav-clientes` pasa a `NavGroup` con dos hijos. Se ajusta el comentario que hoy tiene encima |
| `app/(private)/clientes/contactos/page.tsx` | Nueva página cascarón |
| `app/(private)/clientes/contactos/components/` | `contact-texts.ts` (texto y `testId`) y su `index.ts` |
| Tests | Nuevos (§6.1), tensados (§6.2) y enmiendas de alcance (§6.3) |
| `e2e/clientes.spec.ts`, `e2e/movimiento.spec.ts` | §7 |

**No se tocan:**

- `components/private/app-sidebar.tsx`, `components/ui/**` y `components/shared/**` (tampoco el
  catálogo);
- los tipos y las funciones de `private-nav.ts`, ni `nav-icons.ts`;
- `lib/modules/**`, `lib/composition/**`, `db/**` y `middleware.ts`;
- `package.json`;
- `app/(private)/clientes/page.tsx` y `app/(private)/clientes/components/**` (R12).

---

## 2. Modelo de datos, RLS y migraciones

**Ninguno.** No hay tablas, columnas, policies, migraciones ni seed. La página no lee datos (R7).
`clientes.consultar` ya existe y ya lo tiene el Administrador (`SEED_ROLE_PERMISSIONS`).

---

## 3. Rutas

En `lib/shared/routes.ts`, justo debajo de `CUSTOMERS_ROUTE`:

```ts
export const CUSTOMER_CONTACTS_ROUTE = `${CUSTOMERS_ROUTE}/contactos`;
```

- **Derivada, no literal.** El segmento `/clientes` sigue escrito una sola vez. Tiene el patrón de
  `NEW_RECIPE_ROUTE` e `INVENTORY_IMPORT_ROUTE`, y `customers-route-contract.test.ts` sigue verde,
  porque su regex exige la URL entera entre comillas.
- **Sin fila en `PRIVATE_ROUTE_PREFIXES`** (D2, hallazgo 4). Le basta un comentario de una línea
  que diga que la cubre el prefijo de `CUSTOMERS_ROUTE`, como el de `INVENTORY_IMPORT_ROUTE`.
- **Cortes:**
  - sin sesión, el borde redirige al login por el prefijo `/clientes` (R9);
  - sin el permiso, la página da `notFound()` (R8).

  El middleware no cambia.

---

## 4. El grupo del menú

### 4.1 Etiqueta

En `private-nav.ts`, junto a `CUSTOMERS_LABEL`:

```ts
export const CUSTOMER_CONTACTS_LABEL = 'Contactos';
```

Es la única copia del texto (R11). El hijo «Clientes» y el grupo reutilizan `CUSTOMERS_LABEL`
(P2).

### 4.2 El grupo

Sustituye al enlace **en su misma posición** del array, entre `nav-proveedores` y `nav-usuarios`:

```ts
{
  kind: 'group',
  label: CUSTOMERS_LABEL,
  testId: 'nav-clientes',
  icon: 'square-user',
  section: NAV_SECTION_DIRECTORY,
  items: [
    { kind: 'link', href: CUSTOMERS_ROUTE, label: CUSTOMERS_LABEL,
      testId: 'nav-clientes-lista', permission: 'clientes.consultar' },
    { kind: 'link', href: CUSTOMER_CONTACTS_ROUTE, label: CUSTOMER_CONTACTS_LABEL,
      testId: 'nav-clientes-contactos', permission: 'clientes.consultar' },
  ],
},
```

- **El `testId` del grupo es `nav-clientes`** (D4). Lo que buscaba el enlace por `testId` ahora
  encuentra el disparador.
- **Los hijos van sin `icon` ni `section`**, como los de Integraciones. El componente no les dibuja
  icono.
- **El permiso de cada hijo es el de su página** (R3). Lo vigila el test de §6.1, que lee el código
  de la fuente de la `page.tsx` derivada del `href`.
- **El comentario de encima se reescribe.** Dice lo mismo, pero para los dos hijos: el permiso de
  cada hijo es el que exige su pantalla, y lo vigila `private-nav-clientes.test.ts`.
- `CUSTOMER_CONTACTS_ROUTE` se importa de `../routes` con el resto.

### 4.3 Lo que da por construcción

| Requisito | Por qué se cumple sin código nuevo |
|---|---|
| R4, R5 | `filterNavItemsByPermissions` deja el grupo con los hijos visibles o lo quita entero. Con el mismo permiso en los dos hijos, o se ven los dos o ninguno |
| R6 | `NavGroupInline` (botón con `aria-expanded`, panel con los hijos) y `NavGroupFloating` (modo icono) |
| R13 | Misma posición y sección. El primer hijo es el `href` de hoy, así que `firstVisibleNavHref` no cambia y `groupNavItemsBySection` no cambia de orden |

---

## 5. La página cascarón

### 5.1 Archivos

```
app/(private)/clientes/contactos/
  page.tsx
  components/
    index.ts           ← reexporta lo de contact-texts.ts
    contact-texts.ts   ← texto del vacío y testIds
```

`contact-texts.ts` (sin `'use client'`):

```ts
export const CUSTOMER_CONTACTS_EMPTY_MESSAGE =
  'Aquí verás las conversaciones de WhatsApp con tus clientes.';
export const CUSTOMER_CONTACTS_TITLE_TESTID = 'customer-contacts-title';
export const CUSTOMER_CONTACTS_EMPTY_TESTID = 'customer-contacts-empty';
```

**Por qué una carpeta `components/` sin componentes:**

- una `page.tsx` de Next no puede exportar constantes arbitrarias, y los tests necesitan importar el
  texto y los `testId`;
- `docs/perfil-agentes.md > frontend_dev > 8` exige que la página importe del barrel, nunca de un
  archivo suelto junto a ella;
- hay precedente: `clientes/components/customer-labels.ts` y
  `configuracion/unidades/components/unit-labels.ts`.

### 5.2 `page.tsx`

```tsx
import type { Metadata } from 'next';

import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { BRAND_LABEL, CUSTOMER_CONTACTS_LABEL } from '@/lib/shared/navigation/private-nav';

import {
  CUSTOMER_CONTACTS_EMPTY_MESSAGE,
  CUSTOMER_CONTACTS_EMPTY_TESTID,
  CUSTOMER_CONTACTS_TITLE_TESTID,
} from './components';

export const metadata: Metadata = {
  title: `${CUSTOMER_CONTACTS_LABEL} · ${BRAND_LABEL}`,
};

export default async function CustomerContactsPage() {
  await requirePagePermission('clientes.consultar');

  return (
    <PageShell>
      <PageHeader title={CUSTOMER_CONTACTS_LABEL} titleTestId={CUSTOMER_CONTACTS_TITLE_TESTID} />
      <EmptyState testId={CUSTOMER_CONTACTS_EMPTY_TESTID} message={CUSTOMER_CONTACTS_EMPTY_MESSAGE} />
    </PageShell>
  );
}
```

- **El corte es la primera sentencia y es uno solo** (R3, R8, R9).
- **No recibe `params` ni `searchParams`, y no llama a ninguna action** (R7).
- **Sin miga de pan, acciones, icono ni encabezado en el vacío.** La ficha pide título y texto. Con
  eso no hay ni un enlace ni un botón (R7), y la pantalla tiene **dos bloques** (cabecera y vacío),
  que es lo que mide la entrada de pantalla en `movimiento.spec.ts` (§7.2).
- **Sin literal de URL ni de copy** (R10, R11). Sin comentarios: el porqué está aquí.

### 5.3 Multiplataforma

No hay controles nuevos. `PageShell`, `PageHeader` y `EmptyState` ya están revisados para móvil (su
fila en el catálogo). No hay `100vh` ni `:hover` como única vía. **No se declara ninguna excepción.**

---

## 6. Tests

### 6.1 Nuevos o reescritos

| Archivo | Proyecto | Cubre |
|---|---|---|
| `tests/unit/clientes-ui/private-nav-clientes.test.ts` (**se reescribe**) | unit | **R1**: un solo `NavGroup` con `testId` `nav-clientes` (`kind`, `label` = `CUSTOMERS_LABEL`, `icon` `square-user` con fila en `NAV_ICONS`, `section` = `NAV_SECTION_DIRECTORY`), justo detrás del enlace de `SUPPLIERS_ROUTE` en el array y último de «Directorio». Ningún enlace de nivel superior apunta ya a `CUSTOMERS_ROUTE`. **R2**: hijos exactos y en orden (`href` por constante, `label` por constante, `testId`), sin `icon` ni `section`; `CUSTOMERS_ROUTE` y `CUSTOMER_CONTACTS_ROUTE` aparecen una sola vez en el menú aplanado. **R3**: para cada hijo, la `page.tsx` derivada de su `href` (`app/(private)/<segmentos>/page.tsx`) declara exactamente un `requirePagePermission`, y su código es el `permission` del hijo. Es la comparación de hoy, generalizada. **R4**: con `SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]`, el filtrado deja el grupo con los dos hijos. **R5**: para cada rol de semilla sin `clientes.consultar` (derivados del seed, con un ancla de que hay al menos uno y de que el Administrador sí lo tiene), el grupo no está y `JSON.stringify` del resultado no contiene ninguna de las dos etiquetas, rutas ni `testId`. **R13**: `firstVisibleNavHref` es igual con y sin el grupo para cada rol de semilla, y el orden de los `testId` de nivel superior es el de antes |
| `tests/unit/clientes-ui/contactos-page.test.tsx` (nuevo) | ui | Con el patrón de `tests/unit/integraciones-ui/integration-pages.test.tsx`: `@/lib/composition` (`identity.getSessionUser`) y `next/navigation` (`notFound`, `redirect`) simulados y lanzando. **R7**: con sesión y permiso, el render tiene un único `h1`, con `testId` `CUSTOMER_CONTACTS_TITLE_TESTID` y texto `CUSTOMER_CONTACTS_LABEL`, y el vacío `CUSTOMER_CONTACTS_EMPTY_TESTID` con texto `CUSTOMER_CONTACTS_EMPTY_MESSAGE`. Un caso ancla esa constante al literal de R7. No hay `a`, `button`, `form`, `input`, `select` ni `textarea`. Por fuente, sin comentarios: la página no declara `params` ni `searchParams`, y sus imports son exactamente los de §5.2. **R8**: con sesión sin el permiso, se llama a `notFound` y no se pinta nada. **R9** (parte de página): sin sesión, se llama a `redirect` con `LOGIN_ROUTE_SESSION_ENDED`. **R11**: `metadata.title` es `` `${CUSTOMER_CONTACTS_LABEL} · ${BRAND_LABEL}` ``, y por fuente la página no contiene el literal «Contactos». **R3** (parte de página): por fuente, `requirePagePermission('clientes.consultar')` es la primera sentencia del cuerpo. Localiza por `testId`, rol o constante, nunca por copy literal (`clientes-convenciones` R40) |
| `tests/unit/clientes-ui/customer-contacts-route-contract.test.ts` (nuevo) | unit | **R10**: `CUSTOMER_CONTACTS_ROUTE === '/clientes/contactos'`, y `routes.ts` lo construye desde `CUSTOMERS_ROUTE` (la fuente no tiene `'/clientes/contactos'` como literal). Ningún archivo de `lib/`, `app/` ni `components/` lleva la URL entera entre comillas. `PRIVATE_ROUTE_PREFIXES` no la contiene y `CUSTOMERS_ROUTE` sigue estando una sola vez. La `page.tsx` vive en la carpeta derivada de la constante. **R9** (parte de borde): `decideRouteAccess` con los prefijos reales y sin sesión da `redirect` para `CUSTOMER_CONTACTS_ROUTE`. Mismo patrón que `customers-route-contract.test.ts` |

### 6.2 Tests que hoy fijan la forma y se tensan

**Se tensan, nunca se relajan**: siguen exigiendo la lista o la cifra exactas.

| Archivo | Qué fija | Cambio |
|---|---|---|
| `tests/guards/guard-nav-permisos-declarados.test.ts:106-131` | Ancla: 15 enlaces reales, lista exacta | **16**: sale `nav-clientes` (ya no es enlace) y entran `nav-clientes-contactos` y `nav-clientes-lista`. Se renombra el caso a la cifra nueva y se añade una línea al comentario de ampliaciones |
| `tests/guards/guard-pantallas-exigen-permiso.test.ts:270-306` | `RUTAS_ESPERADAS_HOY`: 29 pantallas | **30**: `'/clientes/contactos'` entra como **entrada** de la lista, no como excepción (R14). Se renombra el caso y se añade la línea «TENSADA» con su motivo |
| `tests/unit/shell/nav-iconos.test.ts:35-131` | Tabla de iconos, hijos sin icono, forma exacta de cada destino | `nav-clientes` sigue con `square-user` en la tabla. `SIN_ICONO` suma `nav-clientes-lista` y `nav-clientes-contactos`, y el caso pasa a decir «los hijos de grupo siguen sin icono». En la lista de R3, la fila de Clientes pasa a `{ kind: 'group', label: 'Clientes', testId: 'nav-clientes', section: 'Directorio' }` seguida de las dos filas de hijos (`section: undefined`) |
| `tests/unit/navegacion/orden-secciones.test.ts:75` | Directorio = `[SUPPLIERS_ROUTE, CUSTOMERS_ROUTE]` | `[SUPPLIERS_ROUTE, 'nav-clientes']`: la clave de un grupo es su `testId`, como `'nav-integraciones'`. Si otros casos del archivo nombran `CUSTOMERS_ROUTE` como clave, se cambian igual |

**T0 confirma que siguen verdes sin tocarlos**, porque derivan del dato o miran otra cosa:

- `app-sidebar.test.tsx`: 13 entradas de nivel superior, orden del DOM por el primer `testId` de
  cada `li` (el disparador `nav-clientes`) y casos de «primer grupo»;
- `sidebar-desktop`, `sidebar-mobile`, `marca/sidebar-grupos`, `navegacion/private-layout-menu`,
  `identity/addons/menu-recortado` e `integraciones-ui/private-nav-integraciones:102`;
- `clientes-ui/customers-route-contract`, `clientes-ui/clientes-convenciones` y
  `clientes-ui/clientes-page`;
- `guard-rutas-privadas-cubiertas`, `guard-nav-serializable` y `configuracion-ui/grupos/alcance`.

Si alguno se pone rojo, se para y se avisa al leader **antes** de tocarlo (§9).

### 6.3 Enmiendas a tests de alcance

| Archivo | Caso | Cambio |
|---|---|---|
| `tests/unit/clientes/scope.test.ts:196-214` | R26 de QC-153: el literal del permiso solo en archivos permitidos, por ruta exacta | Se añade `app/(private)/clientes/contactos/page.tsx` **por ruta exacta**, junto a `PANTALLA_PERMITIDA`, con su comentario: es el corte de la pantalla hermana. Sigue sin admitirse ninguna carpeta `components/`. Se amplía el título del caso para nombrarla |
| `tests/unit/recetas-ui/recipe-route-contract.test.ts:1389+` | Censo cerrado de exports de `routes.ts` | Alta de `'CUSTOMER_CONTACTS_ROUTE'` con su comentario, con el patrón de las altas previas: no es una ruta del asistente de lectura. La lista sigue cerrada |

T0 busca otros censos cerrados de exports de `routes.ts` o de `private-nav.ts` (grep de
`CUSTOMERS_ROUTE'` y `CUSTOMERS_LABEL'` dentro de listas). Si aparece alguno, se da de alta igual
y se anota en `progress/impl_QC-244-menu-clientes-desplegable.md`.

### 6.4 Lo que se verifica en revisión

**R15.** Que no hay permisos nuevos lo garantiza `tests/unit/navegacion/qc75-convenciones.test.ts`
(«tiene exactamente los codigos de CODIGOS_QC74»), y `package.json` lo vigila
`guard-dependencias-aprobadas`. El resto lo comprueba el reviewer: el diff es exactamente
`tasks.md > Archivos esperados`, y no toca `components/**`, `lib/modules/**`,
`lib/composition/**`, `db/**` ni `middleware.ts`.

---

## 7. E2E

### 7.1 `e2e/clientes.spec.ts`

Se reutilizan sus datos: empresa efímera, Administrador y Operador del seed, y entrada por
`loginAndLand`. No hace falta un spec nuevo ni un alta en `E2E_ESPERADOS` de
`guard-identificador-de-request` (alternativa 5).

- **Caso nuevo, Administrador (R4, R6, R7).** Pasos:
  1. `loginAndLand`;
  2. `nav-clientes` visible y clic;
  3. `nav-clientes-lista` y `nav-clientes-contactos` visibles;
  4. clic en `nav-clientes-contactos`, `waitForURL` a `CUSTOMER_CONTACTS_ROUTE`, título con
     `toHaveText(CUSTOMER_CONTACTS_LABEL)` y vacío visible;
  5. clic en `nav-clientes-lista` (el submenú sigue abierto porque tiene un hijo activo),
     `waitForURL` a `CUSTOMERS_ROUTE` y el título de clientes visible;
  6. `page.goto(CUSTOMER_CONTACTS_ROUTE)` da `status() === 200`.
- **Recorrido R42 de hoy, Operador, se amplía (R5, R8).** Pasos:
  - `toHaveCount(0)` también sobre `nav-clientes-lista` y `nav-clientes-contactos`;
  - `page.goto(CUSTOMER_CONTACTS_ROUTE)` da 404 con `private-not-found` visible, como ya hace con
    `CUSTOMERS_ROUTE`.
- **La cabecera del archivo** dice que la navegación es siempre por URL «salvo la única
  comprobación de `nav-clientes`». Se reescribe ese párrafo: hay un caso que recorre el menú a
  propósito, y es el del grupo. Los demás siguen yendo por URL.

### 7.2 `e2e/movimiento.spec.ts`

El caso «R13, R15, R19, R20, R21» se adapta **sin aflojar nada** de lo que afirma (hallazgo 9):

- `NAV_CUSTOMERS_TESTID` pasa a `'nav-clientes-lista'`: es el item activo en `/clientes`.
- `indicatorFit` y `watchSlide` buscan la lista con
  `closest('[data-slot="sidebar-menu-sub"], [data-slot="sidebar-menu"]')`. Así cogen la lista más
  cercana, sea el submenú o el menú, y su contenedor es el `SidebarActiveIndicator` de esa lista
  (`components/private/sidebar-active-indicator.tsx`). La aserción sigue exigiendo item activo,
  `data-indicator-ready`, opacidad 1 y desfase menor de 1 px.
- **R13 y R19, deslizamiento dentro de la misma lista.** El paso pasa a ser de `nav-clientes-lista`
  a `nav-clientes-contactos`, hermanos de la misma sublista:
  - `watchSlide` y clic sobre `nav-clientes-contactos`;
  - `waitForURL` a `CUSTOMER_CONTACTS_ROUTE` y su título visible;
  - la entrada de pantalla se mide sobre `CUSTOMER_CONTACTS_ROUTE`. Tiene dos bloques (§5.2), así
    que `blocks.length >= 2` sigue en pie;
  - las duraciones, curvas y el retardo del segundo bloque se afirman igual que hoy.
- **R15 en modo icono.** Antes de plegar la barra, clic en `nav-proveedores` y espera a su título.
  El salto entre listas es un fundido, y aquí no se afirma nada de él. Después, el modo icono y el
  re-expandido se afirman sobre `NAV_SUPPLIERS_TESTID`, exactamente como hoy.
- **R20** (buscar dentro del módulo) sigue en `/clientes` sin cambios.

**Si T0 mide que el submenú no lleva su propio `SidebarActiveIndicator`** o que la estructura no es
la descrita, se para y se avisa: no se inventa otra forma de medir.

`e2e/marca-componentes.spec.ts` no se toca (hallazgo 9). Si su `FIRST_GROUP` sobre Clientes
pusiera algo en rojo, se para y se avisa.

---

## 8. Contratos de entrada y salida

| Superficie | Entrada | Salida |
|---|---|---|
| `GET /clientes/contactos` sin sesión | — | El borde redirige al login (R9) |
| Lo mismo, con sesión **sin** `clientes.consultar` | — | 404 con `private-not-found` dentro del layout privado (R8) |
| Lo mismo, con sesión **con** el permiso | — | 200: título `CUSTOMER_CONTACTS_LABEL` y vacío con `CUSTOMER_CONTACTS_EMPTY_MESSAGE` (R7) |
| Layout privado → `AppSidebar` | `filterNavItemsByPermissions(PRIVATE_NAV_ITEMS, permisos)` | Con el permiso: el grupo y sus dos hijos. Sin él: nada del grupo (R4, R5) |

No hay Server Actions, route handlers ni integraciones externas.

---

## 9. Orden y sincronización

T0 sincroniza con `git fetch origin dev && git merge origin/dev` y vuelve a medir los hallazgos
6–9 contra el árbol sincronizado.

Las cifras de §6.2 (15→16 y 29→30) son de este worktree. Si `dev` trae otras, se tensa a la cifra
real más una, con la lista exacta.

Un test rojo que no esté en §6.2 o §6.3 **no se toca**: se para y se pide decisión al leader, como
en QC-222 E1.

---

## 10. Alternativas descartadas

1. **Reutilizar `IntegrationPlaceholder`** subiéndolo a `components/shared` con una prop `message`.
   Es el paso 2 de la regla de decisión, pero:
   - obliga a tocar las páginas de integraciones (de otra ficha) y el catálogo;
   - duplicaría lo que ya hace `EmptyState`, que pinta ese mismo marcado y ya está catalogado;
   - la pieza desaparece en cuanto QC-246 sustituya esta página.

   Reutilizar `PageShell` + `PageHeader` + `EmptyState` es el paso 1 y no crea nada.
2. **Copiar el marcado del placeholder de Integraciones** (`div` + `h1` + `div` discontinuo) en la
   página. Sería una tercera copia de un marcado que `EmptyState` ya centraliza, y
   `guard-piezas-base` existe para que esas copias no vuelvan.
3. **Una fila `CUSTOMER_CONTACTS_ROUTE` en `PRIVATE_ROUTE_PREFIXES`.** La guardia la aceptaría,
   porque hay página debajo, pero es redundante: la cubre `CUSTOMERS_ROUTE` por segmentos, y D2 lo
   da por hecho. Contradice además el criterio de `INVENTORY_IMPORT_ROUTE` y del detalle de
   proveedores, que no tienen fila propia, y obligaría a tocar
   `customers-route-contract.test.ts`.
4. **Un `testId` nuevo para el grupo** (`nav-clientes-grupo`) dejando `nav-clientes` al hijo. Lo
   descarta D4. Además, el hijo «Clientes» con `nav-clientes` haría creer a los tests de hoy que
   siguen viendo un enlace de nivel superior.
5. **Un spec E2E nuevo** (`e2e/clientes-contactos.spec.ts`). Duplicaría la preparación de datos de
   `clientes.spec.ts` y exigiría un alta en `E2E_ESPERADOS` de `guard-identificador-de-request`.
   Ampliar el spec que ya tiene al Administrador y al Operador es menos código y no toca guardias.
6. **Contactos en `/contactos`**, como enlace de nivel superior. Lo descarta D2: es una vista de los
   clientes, y saldría del prefijo privado de `/clientes`.
7. **Dar al grupo un permiso propio.** Lo prohíbe QC-75: `NavGroup` no admite `permission`.
8. **Medir el indicador de `movimiento.spec.ts` solo en el nivel superior**, cambiando el módulo de
   arranque a uno que no esté en un grupo. Para R20 haría falta sembrar otra entidad, y se dejaría
   sin cubrir el indicador de una sublista, que esta ficha estrena en una pantalla con datos.

---

## 11. Dependencias de terceros

**Ninguna nueva.** `square-user` ya está en `NAV_ICONS`, y `EmptyState`, `PageHeader` y `PageShell`
son piezas del repo. No hay librería que evaluar con los cuatro checks.

---

## 12. Trazabilidad prevista (R<n> → test)

| R | Test |
|---|---|
| R1 | `private-nav-clientes.test.ts` (forma del grupo, posición, icono, sección); `nav-iconos.test.ts` (fila de `nav-clientes`) |
| R2 | `private-nav-clientes.test.ts` (hijos exactos); `nav-iconos.test.ts` (forma y sin icono) |
| R3 | `private-nav-clientes.test.ts` (permiso de cada hijo = el de su `page.tsx`); `contactos-page.test.tsx` (corte único y primero) |
| R4 | `private-nav-clientes.test.ts` (Administrador); `e2e/clientes.spec.ts` (caso nuevo) |
| R5 | `private-nav-clientes.test.ts` (roles sin permiso, serializado); `e2e/clientes.spec.ts` (R42 ampliado) |
| R6 | `e2e/clientes.spec.ts` (caso nuevo: desplegar y navegar a cada hijo) |
| R7 | `contactos-page.test.tsx`; `e2e/clientes.spec.ts` (caso nuevo) |
| R8 | `contactos-page.test.tsx` (`notFound`); `e2e/clientes.spec.ts` (R42 ampliado, 404) |
| R9 | `contactos-page.test.tsx` (`redirect`); `customer-contacts-route-contract.test.ts` (`decideRouteAccess`) |
| R10 | `customer-contacts-route-contract.test.ts`; `guard-rutas-privadas-cubiertas` |
| R11 | `contactos-page.test.tsx` (título y metadata por constante, sin literal) |
| R12 | `clientes-page.test.tsx` y `e2e/clientes.spec.ts` R41, sin cambios; `private-nav-clientes.test.ts` R3 sobre `CUSTOMERS_ROUTE` |
| R13 | `private-nav-clientes.test.ts` (aterrizaje y orden); `orden-secciones.test.ts`; `app-sidebar.test.tsx` (13 entradas) |
| R14 | `guard-nav-permisos-declarados`, `guard-pantallas-exigen-permiso`, `guard-rutas-privadas-cubiertas`, `guard-nav-serializable`, `private-nav-clientes.test.ts` R3 |
| R15 | `qc75-convenciones.test.ts` (catálogo de permisos exacto); `guard-dependencias-aprobadas`; revisión del diff contra `tasks.md > Archivos esperados` |
