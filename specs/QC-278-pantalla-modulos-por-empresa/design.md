# QC-278 — pantalla-modulos-por-empresa · design.md

> Zona: `frontend` · `depends_on`: QC-166 (detalle de empresa, mergeado en `dev`, PR #267) y
> QC-277 (motor de módulos, en `dev`). Requisitos: `requirements.md` (R1–R25).
>
> **Spec aprobado el 2026-10-19** («Apruebo con defectos», P1–P4 con su defecto) y **enmendado el
> mismo día contra `dev`** (merge `a01b5c11`, que trae QC-166 y QC-263): ver § 0. La enmienda solo
> corrige rutas, nombres, citas, tests y tareas; no cambia el comportamiento de R1–R25.
> **Segunda enmienda el mismo día, tras la tanda 1** (§ 0.1, E17–E19): descripciones e iconos a
> `lib/shared/ui/`, línea bajo el error de la fila (R16) y «Apagar todos» en singular (R12).

## 0. Enmienda contra dev (2026-10-19)

El spec se escribió contra el **spec** de QC-166; esto es lo que cambia al contrastarlo con su
**código** mergeado. Regla: en lo visual manda el tablero (no cambia nada visual); en columnas y
datos manda lo mergeado. Ningún requisito cambia de comportamiento.

| # | Qué decía el spec | Qué hay en `dev` | Qué cambia aquí |
|---|---|---|---|
| E1 | La línea de montaje en `page.tsx` y `export * from './modulos';` «solo si QC-166 no la deja puesta» | `page.tsx` deja el panel vacío con un comentario (`app/(private)/maestro/empresas/[id]/page.tsx:108-121`, comentario en l. 120); el barrel no exporta `./modulos` (`[id]/components/index.ts:1-5`) | Las dos líneas las pone **siempre** esta ficha (T6). § 3, § 10, tasks T6 y `Archivos esperados` |
| E2 | Uso: `isDeleted={company.deletedAt !== null}` | `CompanyDetail.status: 'active' \| 'deleted'` y `deletedAt` (`lib/modules/identity/domain/company-view.ts:3, 15-24`); QC-166 fija `company.status === 'deleted'` (`specs/QC-166-area-del-maestro/design.md:354-356`) | El snippet de § 3 usa `company.status === 'deleted'` (equivalente) |
| E3 | Uso: `canModify={permissions.includes('empresas.modificar')}` | La página ya calcula `canModify` con `canModifyCompanies()` → `assertPermission(user, 'empresas.modificar', …)` (`page.tsx:45-54, 96`) | El snippet de § 3 pasa la `canModify` que ya existe |
| E4 | La pestaña «se monta cuando `tab === 'modulos'`» | El panel `role="tabpanel"` con `aria-label` «Módulos» y `data-testid="company-detail-panel-modulos"` ya lo pinta la página (`page.tsx:108-113`; `company-detail-tabs.ts:15-19, 28-30`) | `CompanyModulesTab` va **dentro** de ese panel y no pinta otro `tabpanel` (§ 3) |
| E5 | Ningún test existente se tocaba | Dos casos de QC-166 R30 se ponen rojos al montar la pestaña: «con tab=modulos deja el panel «Módulos» vacio y no pide los añadidos» (`tests/ui/maestro/company-detail-page.test.tsx:240-246`) y «ni la pagina ni sus componentes importan los añadidos ni una carpeta de modulos» (`:248-253`) | T6 los reescribe: con `tab=modulos` el panel monta la pestaña con las cuatro props y la **página** sigue sin llamar a `getCompanyAddonsAction` (la llama la pestaña, R2). Se listan en `Archivos esperados`. Lo que QC-166 R30 pedía era el hueco «listo para que lo llene QC-278» (`specs/QC-166-area-del-maestro/requirements.md:151-152`) |
| E6 | Tests en `tests/ui/maestro/` | QC-166 pone los de componente en `tests/ui/maestro/` (`company-detail-page.test.tsx`, `company-history-panel.test.tsx`, …) y los puros en `tests/unit/maestro/` (`company-event-text.test.ts`) | Los `*.test.tsx` van a `tests/ui/maestro/` y `addon-labels.test.ts` a `tests/unit/maestro/`. Caen en los mismos proyectos de vitest (`vitest.config.mts:60, 75`). § 7, tasks y `Archivos esperados` |
| E7 | `ADDON_NAMES` «lo crea QC-166»; T1 dependía de su merge; riesgo de orden de merge | Existe: `lib/shared/ui/addon-names.ts:2-15`, clave `AddonNameKey` igualada a `Addon` por `tests/unit/shared/addon-names.test.ts:8`; fila en `components/shared/CATALOGO.md:111`; ya lo consume `company-event-text.ts:2, 27` | Se quita la dependencia de T1 y el riesgo de § 12. `ADDON_NAMES[addon]` se indexa con `Addon` sin conversión (los tipos son iguales) |
| E8 | Acciones en `company-actions.ts:44-49, 222-266` | Tipos en `lib/modules/identity/adapters/driving/company-actions.ts:44-49`; acciones en `:214-258`. `CompanyAddonState`/`CompanyAddonsView` en `domain/company-addons-view.ts:3-15`, exportados por `lib/modules/identity/index.ts:428`; `type Addon` en `:413` | Citas corregidas (§ Lo que ya existe, § 6) |
| E9 | R1 estático: «no importa `getSessionUser` ni `next/headers`» | La sesión se lee como `identity.getSessionUser()` de `@/lib/composition`, y el permiso con `assertPermission`/`requirePagePermission` (`page.tsx:9, 11, 13, 46, 64`) | El test de R1 comprueba que los archivos de la pestaña no importan `@/lib/composition`, `next/headers`, `assertPermission` ni `requirePagePermission` (§ 7.1) |
| E10 | `<ErrorState … retry={{ kind: 'refresh' }} … />` | `testId` es obligatorio y `retryTestId` va con `retry` (`components/shared/error-state.tsx:14-27`); patrón de QC-166 en `company-history-panel.tsx:234-244` | § 4.1 nombra `testId="company-modules-error"` y `retryTestId="company-modules-retry"` |
| E11 | Esqueleto con `role="status"` | QC-166 lo hace con `role="status"`, `aria-busy="true"` y `aria-label` del texto de carga (`company-history-panel.tsx:207-224`) | `ModulesSkeleton` sigue ese patrón (`data-testid="company-modules-skeleton"`); R3 no cambia |
| E12 | `ConfirmDialog` «controlado, `onConfirm` por callback» | Además exige `testIds` `{ dialog, dismiss, confirm }` (`components/shared/confirm-dialog.tsx:33-41, 365`); `onConfirm` se llama tras `onOpenChange(false)` (`:159-160`) | § 4.3 nombra los `testIds`. El cierre antes de escribir ya era el flujo de § 4.2 |
| E13 | E2E con `createFixtureUser` y limpieza «como `modulos-por-empresa.spec.ts`» | QC-166 dejó `maestroCredentials()` y `deleteFixtureCompanies(prefix, createdBefore)` (`e2e/helpers/maestro.ts:32-37, 44-65`), usados por `e2e/maestro-empresas.spec.ts:35-40, 124`; `loginAndLand` en `e2e/helpers/landing.ts:78`; `maestroCompanyRoute(id, 'modulos')` en `lib/shared/routes.ts:319-322` | § 7.2 usa esos helpers en vez de leer `SEED_MAESTRO_*` o borrar a mano |
| E14 | Nada sobre guardias de E2E | Todo spec E2E nuevo se da de alta, uno a uno y con su motivo, en la lista cerrada `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts:57-503` (precedentes: QC-277 en `:430-441`, QC-166 en `:480-502`) | T6 añade `maestro-modulos.spec.ts` a esa lista. En `Archivos esperados` |
| E15 | «el `Switch` ya da 44 px bajo 768 px» | `touchTarget` = `min-h-11 min-w-11` y `md:min-h-9` (`components/ui/switch.tsx:22-23`, `lib/shared/ui/touch-target.ts:2`); `Button` `touch="mobile"` = `max-md:min-h-11` (`components/ui/button.tsx:40-44`) | Confirmado: R24 sin clases propias de talla |
| E16 | `<Toaster />` en `app/(private)/layout.tsx:152` | `<Toaster richColors />` en esa línea | Sin cambio |

Comprobado sin cambios (las piezas y props que usa § 4 existen tal cual en el árbol tras el merge de
QC-263): `StatusBadge` con tonos `success`, `waiting`, `muted` (`lib/shared/ui/status-tone.ts:1`),
`Notice` con `tone="warning"` (`components/shared/notice.tsx:10`), `ErrorAlert` con `before`
(`components/shared/error-alert.tsx:22`), `Badge` `outline`, `Skeleton`, `Spinner`, y las filas del
catálogo citadas abajo. QC-263 no toca nada de lo que usa esta ficha.

### 0.1 Enmienda 2026-10-19 tras la tanda 1

Decisiones de Carlos Restrepo tras el gate rojo de la tanda 1 (`progress/features/QC-278.md >
Decisiones`, última entrada). E17 no cambia comportamiento; E18 y E19 sí, y por eso enmiendan R16
y R12.

| # | Qué decía el spec | Qué hay | Qué cambia aquí |
|---|---|---|---|
| E17 | Descripciones e iconos en `components/modulos/addon-labels.ts`, con un `Record<Addon, …>` de claves literales (§ 5; alternativa D) | La guardia `tests/unit/proveedores/module-contract.test.ts:364-376` prohíbe `/proveedores\|supplier/i` en el contenido sin comentarios de **todo** `app/` fuera de `app/(private)/proveedores`. Hoy la rompen `addon-labels.ts:25-27` (clave `proveedores`, `ADDON_NAMES.proveedores` y la descripción) y `addon-off-consequences.ts:8` (clave `proveedores: []`). La guardia **no se toca** | Descripciones **e iconos** (el mapa de iconos también lleva la clave) se mueven a un archivo hermano, `lib/shared/ui/addon-details.ts` (`ADDON_DETAILS`, `Record<AddonNameKey, …>`), junto a `ADDON_NAMES`; `lib/shared/**` puede importar paquetes npm (`docs/architecture.md:399`; precedente `lucide-react` en `lib/shared/navigation/nav-icons.ts:19`). Ningún archivo de esta ficha bajo `app/` contiene la palabra: `ADDON_LABELS` se arma **iterando** las claves de `ADDON_NAMES`, y `OFF_CONSEQUENCES` pasa a `Partial<Record<Addon, …>>` solo con los tres que descartan algo (`?? []`). El E2E (`e2e/`) y los tests (`tests/`) no están bajo `app/` y no les aplica. Al ser `lib/shared/ui/`, lleva fila en `components/shared/CATALOGO.md > Apoyos` (lo exige `tests/guards/guard-catalogo-de-componentes.test.ts:137`) y el «No cubre» de la fila de `ADDON_NAMES` (l. 111) pasa a remitir a `ADDON_DETAILS`. § 4, § 5, § 8 D, § 10 |
| E18 | R16: `ErrorAlert` «No se guardó el cambio» junto a la fila, sin más texto | El tablero pinta bajo el aviso `<p class="cap">El interruptor vuelve a su posición anterior.</p>` (`docs/diseno/canvas/ModalesMaestro.dc.html:114`) | R16 añade esa línea, en texto de apoyo, bajo el `ErrorAlert` de la **fila** (no en el de «todos», R17). § 4.2 |
| E19 | R12: título «¿Apagar los <n> módulos prendidos?» y «<A>, <B> y <C> desaparecen…» siempre en plural | Con un solo añadido prendido saldría «¿Apagar los 1 módulos prendidos?» y «<A> desaparecen» | Con un solo añadido: «¿Apagar el módulo prendido?» y «<A> desaparece para todos los usuarios de **<empresa>** desde su siguiente acción. Lo ya confirmado no se borra.». Botón, lista y acción iguales (sigue `setAllCompanyAddonsAction`, § 4.2 `via`). Mismo criterio que P4. § 4.3 |

## Lo que ya existe

Búsqueda hecha el 2026-10-16 (`docs/specs.md > Antes de especificar: lo que ya existe`).

**Términos buscados:** `módulos por empresa`, `addon`, `añadido`, `interruptor`,
`CompanyAddons`, `maestro/empresas`, `addon-switch-list`, `core-module-chips`.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board (`feature_list.json`) | QC-277 (motor, `depends_on`), QC-166 (detalle de empresa que monta la pestaña, `depends_on`). Ninguna otra ficha con la pantalla de interruptores | Se consume QC-277 y se monta en QC-166; nada duplicado |
| `specs/` | Solo `specs/QC-277-modulos-por-empresa/design.md` cita las acciones (§ 6.5) y deja la pantalla a QC-278 (§ 6.1 «para que QC-278 no tenga que releer», § 12) | Contrato de I/O tomado de ahí |
| `specs/QC-166-area-del-maestro/` (en `dev` desde PR #267) | Su `design.md > 6.4` adopta el contrato de § 3 tal cual; `> 6.5` crea `lib/shared/ui/addon-names.ts` (`ADDON_NAMES`) para su Historial | Se monta según § 3; los nombres de los añadidos se toman de `ADDON_NAMES` (§ 5) |
| Código de QC-166 (en `dev`) | `app/(private)/maestro/empresas/[id]/page.tsx` (detalle, `UrlTabs`, panel `role="tabpanel"` vacío para Módulos en l. 108-121, `canModify` en l. 45-54 y 96), `[id]/components/index.ts` (barrel), `[id]/components/company-detail-tabs.ts` (`COMPANY_DETAIL_TABS`, `companyDetailPanelTestId`), `[id]/components/company-history-panel.tsx` (patrón de panel async + esqueleto + `ErrorState`), `lib/shared/ui/addon-names.ts`, `e2e/helpers/maestro.ts`, `tests/ui/maestro/company-detail-page.test.tsx` | Se monta en el panel existente; se sigue el patrón del Historial; se reescriben dos casos de R30 (§ 0, E5) |
| Código de QC-277 (grafo + Grep) | `getCompanyAddonsAction`, `setCompanyAddonAction`, `setAllCompanyAddonsAction` y sus tipos `CompanyAddonsResult`, `CompanyAddonsFormState` en `lib/modules/identity/adapters/driving/company-actions.ts:44-49, 214-258`; `CompanyAddonsView` en `lib/modules/identity/domain/company-addons-view.ts:12-15`; `ADDONS`, `ADDON_REQUIRES`, `type Addon` en `lib/modules/identity/domain/company-addons.ts:3-14`. Ninguna descripción ni icono de añadido ni nombre del núcleo en código | Se reutilizan tal cual; descripciones, iconos y núcleo se crean (§ 5) |
| `e2e/` | `e2e/modulos-por-empresa.spec.ts` (QC-277: interruptores por Prisma, menú del Administrador), `e2e/maestro-empresas.spec.ts` (QC-166), `e2e/helpers/maestro.ts`, `e2e/helpers/landing.ts`, `e2e/helpers/fixture-user.ts` | El E2E nuevo reutiliza los helpers y los `data-testid` del menú (`nav-proveedores`) |

### Filas de `components/shared/CATALOGO.md` consultadas

| Pieza | Paso de la regla | Para qué aquí |
|---|---|---|
| `Switch` (`components/ui/switch.tsx`) | 1. Reutiliza | El interruptor de cada fila: `role="switch"`, teclado, 44 px bajo 768 px, `children` para el indicador de carga (R14, R23, R24) |
| `StatusBadge` (`components/shared/status-badge.tsx`) | 1. Reutiliza | Prendido `success`, Sin efecto `waiting`, Apagado `muted`, los tonos del tablero (R6) |
| `ConfirmDialog` (`components/shared/confirm-dialog.tsx`) | 1. Reutiliza | Apagar uno y Apagar todos, apertura controlada, `variant="destructive"`, `onConfirm` por callback (R10, R12) |
| `Notice` (`components/shared/notice.tsx`) | 1. Reutiliza | Aviso «Esta empresa está de baja», tono `warning` (R20) |
| `ErrorState` (`components/shared/error-state.tsx`) | 1. Reutiliza | Error de carga con título y «Reintentar» por `router.refresh()` (R4) |
| `ErrorAlert` (`components/shared/error-alert.tsx`) | 1. Reutiliza | Error al guardar junto a la fila o bajo los botones, con título por `before` (R16, R17) — decisión cerrada «¿Error al guardar?» |
| `Button` (`components/ui/button.tsx`) | 1. Reutiliza | «Prender todos» y «Apagar todos», `variant="outline"`, `touch="mobile"` (R11–R13, R24) |
| `Skeleton` (`components/ui/skeleton.tsx`), `Spinner` (`components/shared/spinner.tsx`) | 1. Reutiliza | Esqueleto de carga y spinner del interruptor (R3, R14) |
| `Badge` (`components/ui/badge.tsx`) | 1. Reutiliza | Cada ficha del Núcleo, `variant="outline"` con el candado delante (R19) |
| `Toaster` (`components/ui/sonner.tsx`) + `toast` de `sonner` | 1. Reutiliza | Avisos de éxito, sobre el `<Toaster />` que ya monta el layout de `(private)` (R15) |
| `UrlTabs`, `PageHeader` | No aplica aquí | Las usa QC-166 para el detalle y sus pestañas; esta ficha no las toca |
| `Tabs`, `AlertDialog`, `DeleteConfirmDialog` | Descartadas | `Tabs` es de paneles en la misma página (las pestañas son enlaces, QC-166); `ConfirmDialog` ya envuelve `AlertDialog`; `DeleteConfirmDialog` trae «Eliminar», que no es el texto |

### Piezas nuevas y su justificación

Las dos que nombra el tablero (`MaestroEmpresaMovil.dc.html > Reutiliza`: «nuevo en la ruta:
`addon-switch-list` … y `core-module-chips`»). Ninguna sube a `components/shared`: solo las usa
esta ruta (`docs/architecture.md > Componentes > Regla: sin sobre-ingenieria`), así que **no
llevan fila en el catálogo** (`docs/perfil-agentes.md > frontend_dev`, regla 13).

- **`addon-switch-list`** — paso **3. Compón**. No hay en el catálogo una lista de interruptores
  con estado, dependencia y confirmación: `Switch` es el control suelto y no cubre «la ayuda o el
  error del campo»; `ConfirmDialog` no lleva el estado de la operación (lo dice su fila). Se compone
  con `Switch`, `StatusBadge`, `ConfirmDialog`, `ErrorAlert`, `Button` y `Spinner`. Introduce UI
  visible nueva (fila de módulo con icono que se tiñe al quedar activa), así que lleva tablero:
  `docs/diseno/canvas/MaestroEmpresa.dc.html`.
- **`core-module-chips`** — paso **3. Compón**. Una lista de `Badge` con candado. No hay pieza de
  fichas fijas en el catálogo. Tablero: el mismo (sección «Núcleo»).

Internas, sin tablero propio porque solo componen piezas catalogadas (excepción de
`docs/perfil-agentes.md > Pase de diseño`): `modules-section` (servidor), `modules-skeleton`.

## 1. Tableros aprobados (decisión cerrada «¿Diseño?»)

| Tablero | Qué se toma |
|---|---|
| `docs/diseno/canvas/MaestroEmpresa.dc.html`, pestaña Módulos, `estado` = `activa` (por defecto), `de-baja`, `cargando`, `error` | Escritorio: sección «Añadidos» (cabecera con contador y los dos botones; cinco filas con icono, nombre, descripción, «Necesita…», estado y Switch); sección «Núcleo» (11 fichas con candado); aviso de baja; esqueleto «Cargando los módulos…»; recuadro «No pudimos cargar los módulos» con «Reintentar»; el diálogo de apagar y los toasts (script, l. 162-240) |
| `docs/diseno/canvas/MaestroEmpresaTablet.dc.html` | Mismas filas a ancho completo (la barra lateral en modo icono es de QC-166) |
| `docs/diseno/canvas/MaestroEmpresaMovil.dc.html` | Ficha con **Reutiliza** (piezas de arriba), **Librerías** (`@base-ui/react` Switch y AlertDialog, `sonner`, `lucide-react`; todas en `docs/dependencias.md`), **Escritorio**, **Tablet**, **Teléfono** (Switch a la derecha del nombre con 44 px, estado bajo la descripción, botones a todo el ancho: R24), **Animación** (Switch, spinner mientras guarda, icono que se tiñe, esqueleto, toasts) y **Por confirmar** (resuelto: § 9) |
| `docs/diseno/canvas/ModalesMaestro.dc.html` | «AlertDialog · Apagar un módulo» (l. 88-95), «AlertDialog · Apagar todos» (l. 99-106) y «Fila de módulo · error al guardar el interruptor» (l. 110-115): textos exactos de R10, R12 y R16 |

**Animación.** El tablero pide el Switch en 150 ms; el `Switch` del catálogo anima en 200 ms y se
queda quieto con movimiento reducido. Se usa el del catálogo sin tocarlo: cambiarlo sería un
cambio visual de una pieza compartida con su propio pase.

## 2. Modelo de datos

**Sin cambios.** Ni tablas, ni RLS, ni migraciones: la feature es solo de presentación. Todo lo
persistente es de QC-277 (`company_addon_overrides`, `addons`, `company_events`, con RLS forzado;
`specs/QC-277-modulos-por-empresa/design.md > 2`). El control de acceso a los datos lo hacen los
casos de uso de QC-277 (`empresas.consultar` para leer, `empresas.modificar` para escribir:
QC-277 R27, R28, R30), no esta pantalla (R22).

## 3. Contrato con QC-166 (decisión cerrada «¿Dónde va?»)

QC-166 es dueño de `/maestro/empresas/[id]`, de su `page.tsx`, de `UrlTabs` y de la lectura del
detalle (`getCompanyAction`) y de los permisos de la sesión. Esta ficha entrega **una pieza** que
la página monta cuando `tab === 'modulos'`:

```tsx
// app/(private)/maestro/empresas/[id]/components/modulos/index.ts  (barrel de la pestaña)
export { CompanyModulesTab, type CompanyModulesTabProps } from './company-modules-tab';

export type CompanyModulesTabProps = {
  readonly companyId: string;    // CompanyDetail.id
  readonly companyName: string;  // CompanyDetail.name — lo citan los diálogos (R10, R12)
  readonly isDeleted: boolean;   // CompanyDetail.status === 'deleted' (≡ deletedAt !== null) (R20)
  readonly canModify: boolean;   // la sesión trae `empresas.modificar` (R21); lo resuelve la página
};
```

Montaje en la página de QC-166 (Server Component), **en lugar del comentario** de
`page.tsx:120`, dentro del `<div role="tabpanel">` que ya existe (`page.tsx:108-113`; enmienda E1,
E4):

```tsx
{tab === 'modulos' ? (
  <CompanyModulesTab
    companyId={company.id}
    companyName={company.name}
    isDeleted={company.status === 'deleted'}
    canModify={canModify}            // la de `canModifyCompanies()`, page.tsx:96
  />
) : null}
```

El import se añade a la lista que la página ya trae de `'./components'` (`page.tsx:17-31`).

- `CompanyModulesTab` es un **Server Component** que envuelve `ModulesSection` en un
  `<Suspense fallback={<ModulesSkeleton />}>` (R3). La página no tiene que poner su propio
  `Suspense` (el Historial sí lo pone en la página, `page.tsx:115-119`; aquí el contrato aprobado
  lo deja dentro de la pestaña y no se cambia).
- **No pinta otro `tabpanel`**: el panel, su nombre accesible «Módulos» y su
  `data-testid="company-detail-panel-modulos"` son de la página (`page.tsx:108-113`,
  `company-detail-tabs.ts:28-30`).
- **No lee la sesión ni decide permisos** (R1): `canModify` llega hecho. Que el Maestro tenga
  `empresas.consultar` para ver la página lo comprueba QC-166 (`requirePagePermission`,
  `page.tsx:64`); y si no lo tuviera, la acción responde `unauthorized` y la pestaña pinta el error
  de R4.
- **Barrel.** Los componentes de la pestaña viven en la subcarpeta `components/modulos/` con su
  propio `index.ts`; el `components/index.ts` de la ruta (de QC-166) solo gana la línea
  `export * from './modulos';`. Así las dos fichas no se pisan el barrel (§ 10).
- **Carpeta.** `app/(private)/maestro/empresas/[id]/`, fijada por el spec de QC-166 (pregunta
  abierta 5, cerrada). El área del Maestro no tiene layout propio: el `<Toaster />` que pide R15 es
  el de `app/(private)/layout.tsx:152`.
- **Alineación con QC-166.** Su `design.md > 6.4` adopta este contrato tal cual (props y montaje)
  y deja a esta ficha las dos líneas (`specs/QC-166-area-del-maestro/design.md:356-357`).
- **Nombres de los añadidos.** `lib/shared/ui/addon-names.ts` (`ADDON_NAMES`, l. 9-15) ya está en
  `dev` (QC-166 `design.md > 6.5`). Esta ficha los toma de ahí y no los repite (§ 5).

## 4. Componentes y flujo

```
app/(private)/maestro/empresas/[id]/components/modulos/
  index.ts                       ← barrel de la pestaña (sin 'use client')
  company-modules-tab.tsx        ← Server: <Suspense fallback={<ModulesSkeleton/>}><ModulesSection …/></Suspense>
  modules-section.tsx            ← Server async: getCompanyAddonsAction(companyId) → error (R4) o lista + núcleo
  modules-skeleton.tsx           ← Server: «Cargando los módulos…», role="status" + aria-busy, 4 Skeleton de 68 px (R3; patrón CompanyHistorySkeleton)
  addon-switch-list.tsx          ← 'use client': estado, escrituras, diálogo, toasts, errores (R5–R18, R20–R24)
  core-module-chips.tsx          ← Server: sección «Núcleo» con 11 Badge y candado (R19)
  addon-labels.ts                ← ADDON_LABELS armado por iteración de ADDON_NAMES + ADDON_DETAILS; textos de toast (§ 5)
  core-modules.ts                ← nombres del núcleo, en orden (§ 5)
  addon-off-consequences.ts      ← qué se descarta al apagar, y el armado de la lista sin repetir (R10, R12)

lib/shared/ui/
  addon-details.ts               ← descripción e icono de cada añadido, junto a addon-names.ts (enmienda E17)
```

Ningún archivo de `components/modulos/` contiene «proveedores» ni «supplier» (guardia
`tests/unit/proveedores/module-contract.test.ts:364-376`; enmienda E17).

### 4.1 `ModulesSection` (Server, async)

1. `const result = await getCompanyAddonsAction(companyId)` — importada por su ruta exacta
   (`@/lib/modules/identity/adapters/driving/company-actions`), como `CompanyHistoryPanel` con
   `listCompanyEventsAction` (`company-history-panel.tsx:21, 232`). Una sola llamada (R2).
2. `result.status === 'error'` → `<ErrorState error={result} title="No pudimos cargar los módulos"
   testId="company-modules-error" retry={{ kind: 'refresh' }} retryTestId="company-modules-retry" />`
   y nada más (R4). Mismo patrón que `company-history-panel.tsx:234-244` (enmienda E10).
3. Éxito → `<AddonSwitchList initialView={result.data} companyName isDeleted canModify />` (que
   pinta arriba el `Notice` de baja si `isDeleted`, R20) y `<CoreModuleChips />`.

### 4.2 `AddonSwitchList` (cliente)

Estado local:

```ts
type Pending = { readonly addons: readonly Addon[] } | null;        // qué cambia la escritura en vuelo
type ListError = { readonly at: Addon | 'all'; readonly error: ErrorState } | null;
const [view, setView] = useState<CompanyAddonsView>(initialView);
const [pending, setPending] = useState<Pending>(null);
const [error, setError] = useState<ListError>(null);
const [confirm, setConfirm] = useState<{ readonly addons: readonly Addon[] } | null>(null);
const [, startTransition] = useTransition();
```

- **Deshabilitado** (R13, R14, R20, R21): `locked = isDeleted || !canModify || pending !== null`.
  Cada `Switch` lleva `disabled={locked}`. «Prender todos»: `locked || ningún enabled=false`.
  «Apagar todos»: `locked || ningún enabled=true`.
- **Estado por fila** (R6): `active ? 'Prendido' : enabled ? 'Sin efecto' : 'Apagado'`. Sale solo
  de `view` (R22).
- **Dependencia** (R7): si `requires.length > 0`, «Necesita <nombres de requires>.»; si la fila
  está «Sin efecto», tono de advertencia y «Préndela para que funcione.».
- **Contador** (R8): `view.addons.filter((a) => a.enabled).length` «de 5 prendidos.».
- **Prender uno** (R9): `onCheckedChange(true)` → `write([addon], true, 'one')`.
- **Apagar uno** (R10): `onCheckedChange(false)` → `setConfirm({ addons: [addon], via: 'one' })`.
  El `Switch` sigue en su posición guardada hasta que se confirme (es controlado por `view`).
- **Prender todos** (R11): `write(apagados, true, 'all')`.
- **Apagar todos** (R12): `setConfirm({ addons: prendidos, via: 'all' })`.
- **Confirmar**: cierra el diálogo y llama a `write(confirm.addons, false, confirm.via)`; el
  progreso se ve en el spinner de cada interruptor afectado, como en el tablero (`save()` cierra el
  diálogo y marca `busy`). El estado `confirm` lleva, por tanto, `{ addons, via }`.

```ts
function write(addons: readonly Addon[], enabled: boolean, via: 'one' | 'all') {
  const formData = new FormData();
  formData.set('companyId', view.companyId);
  formData.set('enabled', String(enabled));
  const single = via === 'one';                          // «todos» va siempre por la acción de todos
  if (single) formData.set('addon', addons[0]);
  setError(null);                                        // R18
  setPending({ addons });                                // R14
  startTransition(async () => {
    const result = single
      ? await setCompanyAddonAction({ status: 'idle' }, formData)
      : await setAllCompanyAddonsAction({ status: 'idle' }, formData);
    setPending(null);
    if (result.status === 'success') {
      const changed = changedAddons(view, result.data);  // los que de verdad cambiaron
      setView(result.data);                              // R15: sin releer ni router.refresh()
      toast.success(successMessage(changed, enabled));   // R15
    } else if (result.status === 'error') {
      setError({ at: single ? addons[0] : 'all', error: result });  // R16, R17; `view` no cambia
    }
  });
}
```

- **Por qué el interruptor «vuelve» solo** (R16): es controlado por `view`, y `view` no cambia si
  la escritura falla. No hay estado optimista que deshacer.
- **Una escritura a la vez** (R14): mientras hay una en vuelo, todo queda deshabilitado. Ver la
  alternativa B de § 8.
- **Errores**: `<ErrorAlert error={…} before={<b>No se guardó el cambio</b>} />` bajo la fila
  (`at === addon`) o bajo los botones (`at === 'all'`), con `role="alert"` (R16, R17). Bajo el de
  la **fila**, y solo ahí, un `<p>` de texto de apoyo «El interruptor vuelve a su posición
  anterior.» (R16, enmienda E18; `ModalesMaestro.dc.html:114`). El mensaje
  sale del catálogo de errores (`company_not_found` si la empresa se dio de baja mientras tanto,
  `unauthorized`, inesperado con referencia).
- **`via`**: «Prender todos» y «Apagar todos» usan siempre `setAllCompanyAddonsAction`
  aunque solo quede un añadido por cambiar, porque es la operación atómica de QC-277 R29.
- **`changedAddons(prev, next)`**: los añadidos cuyo `enabled` difiere. Es la <n> del toast (R15).
  Pura, en `addon-labels.ts`, con test.

### 4.3 Diálogo (R10, R12)

`ConfirmDialog` controlado (`open={confirm !== null}`, `onOpenChange` que pone `confirm` a `null`),
`variant="destructive"`, `onConfirm` (se llama después de `onOpenChange(false)`,
`confirm-dialog.tsx:159-160`) y `testIds` obligatorios
`{ dialog: 'company-addon-off-dialog', dismiss: 'company-addon-off-dismiss', confirm: 'company-addon-off-confirm' }`
(`confirm-dialog.tsx:33-41, 365`; enmienda E12):

| | Un añadido | Todos |
|---|---|---|
| Título | `¿Apagar ${nombre}?` | `¿Apagar los ${n} módulos prendidos?` |
| Cuerpo | «Desaparece del menú y de las pantallas de todos los usuarios de **<empresa>** desde su siguiente acción. Lo ya confirmado no se borra.» | «<A>, <B> y <C> desaparecen para todos los usuarios de **<empresa>** desde su siguiente acción. Lo ya confirmado no se borra.» |
| Lista | `offConsequences([addon], view)` | `offConsequences(prendidos, view)` |
| Botones | «Volver» · «Apagar» | «Volver» · «Apagar todos» |

**«Todos» con un solo añadido prendido** (R12, enmienda E19): título «¿Apagar el módulo
prendido?» y cuerpo «<A> desaparece para todos los usuarios de **<empresa>** desde su siguiente
acción. Lo ya confirmado no se borra.». Lista, botones y acción (`setAllCompanyAddonsAction`) no
cambian.

`offConsequences(addons, view)` (en `addon-off-consequences.ts`, pura):

- `lectura_pdf` → «Las lecturas de PDF en cola terminan como fallidas.», «Las revisiones sin
  confirmar quedan ocultas hasta que lo vuelvas a prender.»;
- `importacion_excel` → «Las revisiones sin confirmar quedan ocultas hasta que lo vuelvas a
  prender.»;
- `integraciones` → «Lectura de PDF con IA deja de funcionar aunque siga prendida, porque la
  necesita.», solo si va sola y `lectura_pdf` tiene el interruptor prendido (P3, cerrada con este defecto el 2026-10-19);
- sin repetir líneas, en el orden de `ADDONS` (R12).

La unión de nombres «A, B y C» usa `Intl.ListFormat('es', { type: 'conjunction' })` (soportado en
Safari 14.1+ y Chrome Android 72+), no una función a mano.

### 4.4 Teléfono y tablet (R24)

Rejilla por fila, mobile-first: bajo 768 px, `[icono] [nombre + Switch] / [descripción] / [estado]`
con el Switch a la derecha del nombre (el `Switch` ya da 44 px bajo 768 px, su fila del catálogo);
desde 768 px, `[icono] [nombre, descripción, dependencia] [estado] [Switch]` como el tablero.
Los dos botones van a `w-full` bajo 768 px. Sin `:hover` como única vía, sin `100vh`. **No hay
excepción de escritorio.**

## 5. Dónde viven las etiquetas (no existen en código)

**No en el dominio.** Descripciones e iconos en `lib/shared/ui/`, junto a los nombres (enmienda
E17); en la carpeta de la pestaña solo el armado, sin ninguna clave literal:

```ts
// lib/shared/ui/addon-details.ts  (hermano de addon-names.ts; no importa dominio)
import type { LucideIcon } from 'lucide-react';
import type { AddonNameKey } from './addon-names';

export const ADDON_DETAILS: Readonly<Record<AddonNameKey, { description: string; icon: LucideIcon }>> = {
  /* una entrada por cada AddonNameKey: descripción de P1 e icono de lucide-react (abajo) */
};
```

```ts
// app/(private)/maestro/empresas/[id]/components/modulos/addon-labels.ts
import type { Addon } from '@/lib/modules/identity';   // solo el tipo (index.ts:413): no arrastra servidor al cliente
import { ADDON_NAMES, type AddonNameKey } from '@/lib/shared/ui/addon-names';   // de QC-166: fuente única de los nombres
import { ADDON_DETAILS } from '@/lib/shared/ui/addon-details';                   // enmienda E17
// `AddonNameKey` es igual a `Addon` (tests/unit/shared/addon-names.test.ts:8): se indexa sin conversión.

export const ADDON_LABELS: Readonly<Record<Addon, { name: string; description: string; icon: LucideIcon }>> =
  /* Object.fromEntries((Object.keys(ADDON_NAMES) as AddonNameKey[])
       .map((addon) => [addon, { name: ADDON_NAMES[addon], ...ADDON_DETAILS[addon] }])) */;
```

- **Sin claves literales en `app/`** (E17): `ADDON_LABELS` se arma iterando `ADDON_NAMES`;
  `addon-off-consequences.ts` usa `Partial<Record<Addon, readonly string[]>>` solo con
  `lectura_pdf`, `importacion_excel` e `integraciones`, y `?? []` para el resto.
- **`Record<AddonNameKey, …>`** en `ADDON_DETAILS`: un sexto añadido en `ADDON_NAMES` (y por el
  test de tipos, en `ADDONS`) rompe el typecheck hasta tener descripción e icono.
- **Nombres**: **no se escriben aquí**. Salen de `ADDON_NAMES` (`lib/shared/ui/addon-names.ts:9-15`,
  en `dev` desde QC-166, que ya lo usa en `company-event-text.ts:27`): los del tablero, que son
  los de QC-277 D3 con mayúscula inicial. Esta ficha no edita ese archivo; de su fila del catálogo
  (`components/shared/CATALOGO.md:111`) solo cambia el «No cubre: descripción ni icono», que pasa a
  remitir a `ADDON_DETAILS`, y se añade la fila de `ADDON_DETAILS` en `## Apoyos` (E17).
- **Descripciones**: las de la pregunta 1, **cerrada el 2026-10-19 con el texto propuesto**. La de
  Integraciones ya está en el tablero.
- **Iconos**: de `lucide-react`; el tablero dibuja trazos propios y no nombra el icono, así que el
  implementer elige el de `lucide-react` más parecido a cada uno (cuadrícula, camión, documento,
  hoja de cálculo, pieza de puzle; candado `Lock` para el núcleo; eslabón `Link` para «Necesita»).
- **`core-modules.ts`**: `CORE_MODULE_NAMES`, los 11 del tablero (P2, cerrada con este defecto el 2026-10-19).
  No se deriva de `CORE_PERMISSIONS`: son permisos, no módulos con nombre.

## 6. Contratos de entrada y salida (QC-277, sin cambios)

| Acción | Entrada | Éxito | Error |
|---|---|---|---|
| `getCompanyAddonsAction(companyId: string)` | — | `{ status: 'success', data: CompanyAddonsView }` | `ErrorState` (`unauthorized`, `company_not_found`, `invalid_input`, inesperado) |
| `setCompanyAddonAction(prev, FormData)` | `companyId`, `addon`, `enabled` (`'true'`/`'false'`) | `{ status: 'success', data: CompanyAddonsView }` (vista nueva) | `ErrorState`; `company_not_found` si está de baja (QC-277 R31) |
| `setAllCompanyAddonsAction(prev, FormData)` | `companyId`, `enabled` | ídem | ídem |

`CompanyAddonsView = { companyId; addons: { addon; enabled; active; requires }[] }`, en el orden
de `ADDONS`. La lectura vale con la empresa de baja (QC-277 R27); la escritura no.

Sin rutas ni endpoints nuevos. Sin `revalidatePath` (las acciones no lo hacen y la vista viene en
la respuesta: decisión cerrada «¿Releer tras guardar?»).

## 7. Pruebas y trazabilidad

Tests de componente en el proyecto `ui` de vitest (`*.test.tsx`, `docs/perfil-agentes.md >
frontend_dev > Tests`), con las tres acciones simuladas con `vi.mock` de su ruta exacta (la forma
de `tests/ui/maestro/company-detail-page.test.tsx:51-64`) y `sonner` simulado. Carpetas las de
QC-166 (enmienda E6): componentes en `tests/ui/maestro/`, puros en `tests/unit/maestro/`.

| Archivo | Tipo | Qué cubre |
|---|---|---|
| `tests/ui/maestro/company-modules-tab.test.tsx` | ui | R1 (props, sin leer sesión: ningún archivo de `components/modulos/` importa `@/lib/composition`, `next/headers`, `assertPermission` ni `requirePagePermission`, enmienda E9), R2 (una llamada con el `companyId`), R3 (el `fallback` del `Suspense` es `ModulesSkeleton`; el esqueleto pinta «Cargando los módulos…» en `role="status"`), R4 (error → título, mensaje, referencia y «Reintentar»; sin `switch` ni Núcleo) |
| `tests/ui/maestro/addon-switch-list.test.tsx` | ui | R5–R18, R20–R24 (ver mapa) |
| `tests/ui/maestro/core-module-chips.test.tsx` | ui | R19 (11 fichas en orden, sin `switch` ni botón) |
| `tests/unit/maestro/addon-labels.test.ts` | unit | R5 (una etiqueta por cada `ADDONS`, ni una más; nombre, descripción e icono tomados de `ADDON_NAMES` y `ADDON_DETAILS`, E17), R15 (`changedAddons`, mensajes singular y plural), R10/R12 (`offConsequences`: líneas por añadido, sin repetir, regla de Integraciones) |
| `e2e/maestro-modulos.spec.ts` | E2E (Playwright) | R25 |
| `tests/ui/maestro/company-detail-page.test.tsx` (de QC-166, **se modifica**) | ui | R1 (montaje): los dos casos de QC-166 R30 de las l. 240-253 se reescriben (enmienda E5): con `tab=modulos` el panel «Módulos» contiene la pestaña montada con `companyId`, `companyName`, `isDeleted` y `canModify` de la página, y `page.tsx` sigue sin importar ni llamar a `getCompanyAddonsAction` (la llama la pestaña) |
| `tests/guards/guard-identificador-de-request.test.ts` (**se modifica**) | guardia | Alta de `maestro-modulos.spec.ts` en `E2E_ESPERADOS` (l. 57-503) con su motivo (enmienda E14) |
| `tests/unit/proveedores/module-contract.test.ts` (**no se toca**) | guardia | Debe quedar en verde: ningún archivo de esta ficha bajo `app/` menciona «proveedores» ni «supplier» (enmienda E17) |
| `tests/guards/guard-catalogo-de-componentes.test.ts` (**no se toca**) | guardia | Debe quedar en verde con la fila nueva de `ADDON_DETAILS` en `CATALOGO.md` (enmienda E17) |

### 7.1 Mapa `R<n> → test`

| R | Test |
|---|---|
| R1 | `company-modules-tab.test.tsx` «R1: recibe empresa, baja y canModify por props y no lee la sesión»; `company-detail-page.test.tsx` «R1 (QC-278): con tab=modulos el panel Módulos monta la pestaña con las cuatro props» |
| R2 | `company-modules-tab.test.tsx` «R2: pide la vista de añadidos una sola vez con el id de la empresa» |
| R3 | `company-modules-tab.test.tsx` «R3: mientras carga muestra Cargando los módulos… en una región status» |
| R4 | `company-modules-tab.test.tsx` «R4: si la lectura falla muestra No pudimos cargar los módulos con Reintentar y ningún interruptor» |
| R5 | `addon-switch-list.test.tsx` «R5: pinta los cinco añadidos en el orden de la vista con nombre, descripción y estado»; `addon-labels.test.ts` «R5: hay una etiqueta por añadido del catálogo» |
| R6 | `addon-switch-list.test.tsx` «R6: Prendido si activo, Sin efecto si prendido sin activo, Apagado si apagado» |
| R7 | `addon-switch-list.test.tsx` «R7: Lectura de PDF dice Necesita Integraciones y en advertencia si está Sin efecto» |
| R8 | `addon-switch-list.test.tsx` «R8: la cabecera cuenta los interruptores prendidos de cinco» |
| R9 | `addon-switch-list.test.tsx` «R9: prender un añadido llama a setCompanyAddonAction sin diálogo» |
| R10 | `addon-switch-list.test.tsx` «R10: apagar un añadido abre la confirmación con su nombre, la empresa y lo que se descarta», «R10: Volver cierra sin escribir»; `addon-labels.test.ts` «R10: Integraciones solo avisa de la lectura si está prendida» |
| R11 | `addon-switch-list.test.tsx` «R11: Prender todos llama a setAllCompanyAddonsAction con enabled=true sin diálogo» |
| R12 | `addon-switch-list.test.tsx` «R12: Apagar todos confirma con el número, los nombres y las consecuencias sin repetir», «R12: con un solo añadido prendido, Apagar todos va en singular» (E19) |
| R13 | `addon-switch-list.test.tsx` «R13: Prender todos deshabilitado sin apagados y Apagar todos sin prendidos» |
| R14 | `addon-switch-list.test.tsx` «R14: mientras guarda hay spinner en el interruptor afectado y todo deshabilitado» |
| R15 | `addon-switch-list.test.tsx` «R15: con éxito pinta la vista devuelta sin releer y avisa por toast»; `addon-labels.test.ts` «R15: mensajes de toast en singular y plural» |
| R16 | `addon-switch-list.test.tsx` «R16: si falla uno, el interruptor vuelve y aparece No se guardó el cambio junto a su fila» (con la línea «El interruptor vuelve a su posición anterior.» bajo el aviso de la fila y no bajo el de «todos», E18) |
| R17 | `addon-switch-list.test.tsx` «R17: si falla todos, nada cambia y el error va bajo los botones» |
| R18 | `addon-switch-list.test.tsx` «R18: el siguiente cambio quita el error anterior» |
| R19 | `core-module-chips.test.tsx` «R19: once fichas del núcleo con candado y nada pulsable» |
| R20 | `addon-switch-list.test.tsx` «R20: empresa de baja: aviso y todos los controles deshabilitados»; `company-modules-tab.test.tsx` «R20: de baja también muestra añadidos y Núcleo» |
| R21 | `addon-switch-list.test.tsx` «R21: sin empresas.modificar todos los controles deshabilitados» |
| R22 | `addon-switch-list.test.tsx` «R22: el estado sale de active de la vista aunque enabled y requires digan otra cosa»; estático en el mismo archivo: el componente no importa `effectiveAddons` ni `ADDON_REQUIRES` |
| R23 | `addon-switch-list.test.tsx` «R23: cada interruptor es un switch con nombre Prender o Apagar y responde a teclado» |
| R24 | `addon-switch-list.test.tsx` «R24: clases mobile-first: Switch junto al nombre y botones a todo el ancho bajo md»; verificación manual en WebKit (el E2E corre en Chromium y WebKit) |
| R25 | `e2e/maestro-modulos.spec.ts` «R25: el Maestro prende y apaga Proveedores y el menú del Administrador lo sigue» |

**Cobertura de las decisiones cerradas:**

| Decisión | R |
|---|---|
| ¿Diseño? | R3, R4, R5–R8, R10, R12, R16, R19, R20, R24 |
| ¿Dónde va? | R1 |
| ¿Confirmación? | R9, R10, R11, R12 |
| ¿Estados de un añadido? | R6, R7 |
| ¿Núcleo? | R19 |
| ¿Empresa de baja? | R20 |
| ¿Error al guardar? | R16, R17 |
| ¿Releer tras guardar? | R15 |
| ¿Permisos? | R1, R21, R22 |
| ¿E2E? | R25 |

### 7.2 E2E — `e2e/maestro-modulos.spec.ts` (R25, flujo de permisos)

- **Fixture:** empresa propia con prefijo `qc278_e2e_` y un Administrador, como
  `e2e/modulos-por-empresa.spec.ts` (`createFixtureUser` de `e2e/helpers/fixture-user.ts:30`,
  `normalizeCompanyName`). Limpieza por edad con `deleteFixtureCompanies(prefix, createdBefore)`
  (`e2e/helpers/maestro.ts:44-65`), como `e2e/maestro-empresas.spec.ts:124`. Se fija Proveedores
  apagado al empezar con Prisma (mismo `upsert` que el `setAddons` local de
  `e2e/modulos-por-empresa.spec.ts:68-81`).
- **Maestro:** el del seed, con `maestroCredentials()` (`e2e/helpers/maestro.ts:32-37`), que lee
  `SEED_MAESTRO_USERNAME` y `SEED_MAESTRO_PASSWORD` (los pone `.github/workflows/gate.yml:191-193,
  374-376`) y falla nombrando la variable si falta; no se salta. Un Maestro efímero no vale: la
  empresa vacía es única del Maestro (`e2e/integraciones.spec.ts:100-105`).
- **Entrada:** los dos con `loginAndLand` (`e2e/helpers/landing.ts:78`; lo exige
  `tests/guards/guard-e2e-landing.test.ts`). La URL del detalle con
  `maestroCompanyRoute(id, 'modulos')` (`lib/shared/routes.ts:319-322`).
- **Dos contextos** de navegador: el del Maestro y el del Administrador.
- **Guardia:** el archivo se da de alta en `E2E_ESPERADOS`
  (`tests/guards/guard-identificador-de-request.test.ts:57-503`), con el motivo de las demás: no
  lee ni afirma nada sobre el identificador de petición ni sobre `reference` (enmienda E14).

Casos:

1. El Administrador entra; su menú no tiene `nav-proveedores`.
2. El Maestro abre `maestroCompanyRoute(<id>, 'modulos')` (`/maestro/empresas/<id>?tab=modulos`), pulsa el `switch` «Prender
   Proveedores»; ve el toast «Proveedores prendido.» y el estado «Prendido».
3. El Administrador recarga, sin volver a entrar: `nav-proveedores` aparece.
4. El Maestro pulsa «Apagar Proveedores», ve el diálogo «¿Apagar Proveedores?», pulsa «Apagar»;
   ve «Proveedores apagado.».
5. El Administrador recarga: `nav-proveedores` ya no está.

La ruta de QC-166 ya está en `dev` (enmienda E1): T6 no espera a nadie.

## 8. Alternativas descartadas

**A. Que la página de QC-166 lea la vista y la pase por props.** La pestaña quedaría como un
componente puro de cliente y la página haría `getCompanyAddonsAction` junto a `getCompanyAction`.
Se descarta: la lectura correría también con las pestañas Datos o Historial abiertas (o la página
tendría que condicionarla), y el esqueleto de R3 no tendría su propio `Suspense`. Con la pestaña
leyendo lo suyo, QC-166 solo pasa cuatro valores que ya tiene y no sabe nada de añadidos.

**B. Escrituras en paralelo, una por fila, con `useActionState` por interruptor (como pinta el
tablero, que deshabilita solo la fila que guarda).** Se descarta: cada respuesta trae la vista
**entera**, y dos escrituras sobre la misma empresa se serializan en el servidor (`FOR UPDATE`,
QC-277 § 6.3) pero pueden responder en otro orden. La última en llegar pintaría una vista vieja y
el interruptor de la otra fila volvería atrás sin error. Bloquear todo durante la escritura (unos
cientos de ms) evita la carrera sin lógica de orden. Coste: no se pueden prender dos añadidos
seguidos sin esperar; para eso está «Prender todos».

**C. Interruptor optimista** (moverlo al pulsar y deshacer si falla). Se descarta: obliga a
mantener una vista provisional y a deshacerla; con el interruptor controlado por la última vista
del servidor, R16 («vuelve a su posición») sale gratis y R22 se cumple por construcción.

**D. Etiquetas en el dominio (`identity/domain/company-addons.ts`).** Se descarta: el dominio no
lleva textos de pantalla. **Repetir los nombres aquí** también se descarta: dos copias divergen.
*(Enmienda E17.)* El spec original dejaba descripciones e iconos en la carpeta de la pestaña
porque solo los usa una ruta; se descartó tras la tanda 1: un mapa con la clave `proveedores` en
`app/` rompe `tests/unit/proveedores/module-contract.test.ts:364-376`. **D2. Relajar esa guardia**
(excepción para `components/modulos/`) también se descarta, por decisión del humano: la guardia
cierra que nada de `app/` fuera de la pantalla de QC-44 conozca el módulo, y una excepción por
ficha la abre. **D3. Meterlas en `addon-names.ts`** se descarta: es de QC-166, es solo texto y lo
consume también el Historial; un hermano deja intactos su archivo y su test.

**E. Un `<form action>` por fila con `useActionState`.** Se descarta por B y porque apagar pasa
por el diálogo, que ya llama por callback (`onConfirm`). El patrón de llamar a la acción con un
`FormData` construido dentro de `startTransition` ya existe
(`app/(private)/integraciones/whatsapp/components/whatsapp-connection-actions.tsx:85-95`).

## 9. Lo que el tablero dejaba «Por confirmar»

| Punto | Resuelto por |
|---|---|
| Descripción de cada añadido | P1, cerrada el 2026-10-19 con el texto propuesto en el seed |
| Si apagar pide confirmación | Decisión cerrada «¿Confirmación?» |
| Nombres de los módulos del núcleo | Decisión cerrada «¿Núcleo?» + P2 (cerrada el 2026-10-19: 11 fichas) |
| Si el Historial nombra al Maestro | De QC-166, fuera de esta ficha |
| Texto de error al guardar | Decisión cerrada «¿Error al guardar?»: `ErrorAlert` junto a la fila |

## 10. Choques con otras features

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `app/(private)/maestro/empresas/[id]/page.tsx` | QC-166 (dueño, mergeado) | QC-166 dejó el hueco vacío (`page.tsx:120`): **esta ficha** pone el import y la línea de montaje de § 3 (T6; enmienda E1) |
| `app/(private)/maestro/empresas/[id]/components/index.ts` | QC-166 (dueño, mergeado) | Una línea: `export * from './modulos';` (T6) |
| `tests/ui/maestro/company-detail-page.test.tsx` | QC-166 (dueño, mergeado) | Se reescriben los dos casos de R30 que exigían el panel vacío y ninguna carpeta `modulos` (l. 240-253; enmienda E5) |
| `tests/guards/guard-identificador-de-request.test.ts` | Toda ficha con E2E nuevo | Una entrada en `E2E_ESPERADOS` (enmienda E14) |
| `lib/shared/ui/addon-names.ts` | QC-166 (dueño, en `dev`) | **Solo se importa** `ADDON_NAMES`; no se edita |
| `lib/shared/ui/addon-details.ts` | Nadie (nuevo, enmienda E17) | Lo crea esta ficha, hermano de `addon-names.ts` |
| `components/shared/CATALOGO.md` | Toda ficha que añade una pieza | Una fila nueva (`ADDON_DETAILS`) en `## Apoyos` y el «No cubre» de la fila de `ADDON_NAMES` (l. 111) remitiendo a ella (E17) |
| `e2e/helpers/*` | Toda ficha con E2E | Solo se leen; no se cambian |

## 11. Dependencias de terceros

Ninguna nueva. Se usan `@base-ui/react` (vía `Switch` y `ConfirmDialog`), `sonner` y
`lucide-react`, ya en `docs/dependencias.md` (l. 35, 73, 58). `Intl.ListFormat` es del navegador.

## 12. Riesgos y desconocidos

- ~~**Orden de merge con QC-166.**~~ **Resuelto el 2026-10-19:** QC-166 está en `dev` y en la
  rama (merge `a01b5c11`), con `lib/shared/ui/addon-names.ts` y la ruta (enmiendas E1, E7). Sigue
  valiendo que **no** se crea aquí una copia de `ADDON_NAMES`.
- **Maestro del seed en local.** `progress/deudas.md` D27 registra entornos sin `SEED_MAESTRO_*`
  en `.env`; ahí el E2E falla con su mensaje. En CI están.
