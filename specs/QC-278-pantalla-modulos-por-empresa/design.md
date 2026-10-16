# QC-278 — pantalla-modulos-por-empresa · design.md

> Zona: `frontend` · `depends_on`: QC-166 (detalle de empresa, en especificación en paralelo) y
> QC-277 (motor de módulos, en `dev`). Requisitos: `requirements.md` (R1–R25).

## Lo que ya existe

Búsqueda hecha el 2026-10-16 (`docs/specs.md > Antes de especificar: lo que ya existe`).

**Términos buscados:** `módulos por empresa`, `addon`, `añadido`, `interruptor`,
`CompanyAddons`, `maestro/empresas`, `addon-switch-list`, `core-module-chips`.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board (`feature_list.json`) | QC-277 (motor, `depends_on`), QC-166 (detalle de empresa que monta la pestaña, `depends_on`). Ninguna otra ficha con la pantalla de interruptores | Se consume QC-277 y se monta en QC-166; nada duplicado |
| `specs/` | Solo `specs/QC-277-modulos-por-empresa/design.md` cita las acciones (§ 6.5) y deja la pantalla a QC-278 (§ 6.1 «para que QC-278 no tenga que releer», § 12) | Contrato de I/O tomado de ahí |
| `.worktrees/QC-166-area-del-maestro/specs/QC-166-area-del-maestro/` | Solo `requirements.md` sembrado (Alcance: «pestañas Datos, Módulos (la llena QC-278) e Historial»). Sin `design.md` | El contrato de montaje lo fija este spec (§ 3) y QC-166 lo adopta |
| Código (grafo + Grep) | `getCompanyAddonsAction`, `setCompanyAddonAction`, `setAllCompanyAddonsAction` y sus tipos `CompanyAddonsResult`, `CompanyAddonsFormState` en `lib/modules/identity/adapters/driving/company-actions.ts:44-49, 222-266`; `CompanyAddonsView` en `lib/modules/identity/domain/company-addons-view.ts`; `ADDONS`, `ADDON_REQUIRES`, `type Addon` en `lib/modules/identity/domain/company-addons.ts`. Ninguna ruta `app/**/maestro/**`. Ningún nombre visible de añadido ni del núcleo en código | Se reutilizan tal cual; las etiquetas se crean (§ 5) |
| `e2e/` | `e2e/modulos-por-empresa.spec.ts` (QC-277: interruptores por Prisma, menú del Administrador), `e2e/helpers/addons.ts`, `e2e/helpers/landing.ts`, `e2e/helpers/fixture-user.ts` | El E2E nuevo reutiliza los helpers y los `data-testid` del menú (`nav-proveedores`) |

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
  readonly isDeleted: boolean;   // CompanyDetail.deletedAt !== null (R20)
  readonly canModify: boolean;   // la sesión trae `empresas.modificar` (R21); lo resuelve la página
};
```

Uso esperado en la página de QC-166 (Server Component):

```tsx
{tab === 'modulos' ? (
  <CompanyModulesTab
    companyId={company.id}
    companyName={company.name}
    isDeleted={company.deletedAt !== null}
    canModify={permissions.includes('empresas.modificar')}
  />
) : null}
```

- `CompanyModulesTab` es un **Server Component** que envuelve `ModulesSection` en un
  `<Suspense fallback={<ModulesSkeleton />}>` (R3). La página no tiene que poner su propio
  `Suspense`.
- **No lee la sesión ni decide permisos** (R1): `canModify` llega hecho. Que el Maestro tenga
  `empresas.consultar` para ver la página lo comprueba QC-166; y si no lo tuviera, la acción
  responde `unauthorized` y la pestaña pinta el error de R4.
- **Barrel.** Los componentes de la pestaña viven en la subcarpeta `components/modulos/` con su
  propio `index.ts`; el `components/index.ts` de la ruta (de QC-166) solo gana la línea
  `export * from './modulos';`. Así las dos fichas no se pisan el barrel (§ 10).
- **Carpeta.** `app/(private)/` es el defecto de la pregunta abierta 5: el `<Toaster />` que pide
  R15 lo monta hoy `app/(private)/layout.tsx:152`. Si QC-166 elige otro grupo, se mueven las
  rutas; el contrato no cambia. Si el layout del área del Maestro no monta un `<Toaster />`, los
  toasts no se ven: QC-166 lo tiene que montar (se le anota en su ficha al integrar).
- **Alineación con QC-166.** Su `design.md` no existe al escribir este spec. Cuando exista, si
  nombra otra forma de props, gana la que se acuerde en la revisión de los dos specs; este
  contrato es la propuesta.

## 4. Componentes y flujo

```
app/(private)/maestro/empresas/[id]/components/modulos/
  index.ts                       ← barrel de la pestaña (sin 'use client')
  company-modules-tab.tsx        ← Server: <Suspense fallback={<ModulesSkeleton/>}><ModulesSection …/></Suspense>
  modules-section.tsx            ← Server async: getCompanyAddonsAction(companyId) → error (R4) o lista + núcleo
  modules-skeleton.tsx           ← Server: «Cargando los módulos…», role="status", 4 Skeleton de 68 px (R3)
  addon-switch-list.tsx          ← 'use client': estado, escrituras, diálogo, toasts, errores (R5–R18, R20–R24)
  core-module-chips.tsx          ← Server: sección «Núcleo» con 11 Badge y candado (R19)
  addon-labels.ts                ← nombres, descripciones, iconos y textos de toast por añadido (§ 5)
  core-modules.ts                ← nombres del núcleo, en orden (§ 5)
  addon-off-consequences.ts      ← qué se descarta al apagar, y el armado de la lista sin repetir (R10, R12)
```

### 4.1 `ModulesSection` (Server, async)

1. `const result = await getCompanyAddonsAction(companyId)` — importada por su ruta exacta
   (`@/lib/modules/identity/adapters/driving/company-actions`), como `customer-list-section.tsx`.
   Una sola llamada (R2).
2. `result.status === 'error'` → `<ErrorState error={result} title="No pudimos cargar los módulos"
   retry={{ kind: 'refresh' }} … />` y nada más (R4).
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
  (`at === addon`) o bajo los botones (`at === 'all'`), con `role="alert"` (R16, R17). El mensaje
  sale del catálogo de errores (`company_not_found` si la empresa se dio de baja mientras tanto,
  `unauthorized`, inesperado con referencia).
- **`via`**: «Prender todos» y «Apagar todos» usan siempre `setAllCompanyAddonsAction`
  aunque solo quede un añadido por cambiar, porque es la operación atómica de QC-277 R29.
- **`changedAddons(prev, next)`**: los añadidos cuyo `enabled` difiere. Es la <n> del toast (R15).
  Pura, en `addon-labels.ts`, con test.

### 4.3 Diálogo (R10, R12)

`ConfirmDialog` controlado (`open={confirm !== null}`), `variant="destructive"`, `onConfirm`:

| | Un añadido | Todos |
|---|---|---|
| Título | `¿Apagar ${nombre}?` | `¿Apagar los ${n} módulos prendidos?` |
| Cuerpo | «Desaparece del menú y de las pantallas de todos los usuarios de **<empresa>** desde su siguiente acción. Lo ya confirmado no se borra.» | «<A>, <B> y <C> desaparecen para todos los usuarios de **<empresa>** desde su siguiente acción. Lo ya confirmado no se borra.» |
| Lista | `offConsequences([addon], view)` | `offConsequences(prendidos, view)` |
| Botones | «Volver» · «Apagar» | «Volver» · «Apagar todos» |

`offConsequences(addons, view)` (en `addon-off-consequences.ts`, pura):

- `lectura_pdf` → «Las lecturas de PDF en cola terminan como fallidas.», «Las revisiones sin
  confirmar quedan ocultas hasta que lo vuelvas a prender.»;
- `importacion_excel` → «Las revisiones sin confirmar quedan ocultas hasta que lo vuelvas a
  prender.»;
- `integraciones` → «Lectura de PDF con IA deja de funcionar aunque siga prendida, porque la
  necesita.», solo si va sola y `lectura_pdf` tiene el interruptor prendido (pregunta abierta 3);
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

En la carpeta de la pestaña, **no en el dominio**:

```ts
// addon-labels.ts
import type { Addon } from '@/lib/modules/identity';   // solo el tipo: no arrastra servidor al cliente
export const ADDON_LABELS: Readonly<Record<Addon, { name: string; description: string; icon: LucideIcon }>> = {
  dashboard:         { name: 'Dashboard y recorrido',   description: '…', icon: LayoutDashboard },
  proveedores:       { name: 'Proveedores',             description: '…', icon: Truck },
  lectura_pdf:       { name: 'Lectura de PDF con IA',   description: '…', icon: FileText },
  importacion_excel: { name: 'Importación desde Excel', description: '…', icon: Sheet },
  integraciones:     { name: 'Integraciones',           description: 'Proveedor IA, Inventarios y WhatsApp.', icon: Puzzle },
};
```

- **`Record<Addon, …>`**: un sexto añadido en `ADDONS` rompe el typecheck hasta tener etiqueta.
- **Nombres**: los del tablero, que son los de QC-277 D3 con mayúscula inicial.
- **Descripciones**: las de la pregunta abierta 1 (propuestas; el humano las confirma en la
  revisión). La de Integraciones ya está en el tablero.
- **Iconos**: de `lucide-react`; el tablero dibuja trazos propios y no nombra el icono, así que el
  implementer elige el de `lucide-react` más parecido a cada uno (cuadrícula, camión, documento,
  hoja de cálculo, pieza de puzle; candado `Lock` para el núcleo; eslabón `Link` para «Necesita»).
- **`core-modules.ts`**: `CORE_MODULE_NAMES`, los 11 del tablero (pregunta abierta 2).
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
frontend_dev > Tests`), con las tres acciones simuladas con `vi.mock` de su ruta exacta y
`sonner` simulado. Prefijo `tests/unit/maestro-ui/`.

| Archivo | Tipo | Qué cubre |
|---|---|---|
| `tests/unit/maestro-ui/company-modules-tab.test.tsx` | ui | R1 (props, sin leer sesión: el módulo no importa `getSessionUser` ni `next/headers`), R2 (una llamada con el `companyId`), R3 (el `fallback` del `Suspense` es `ModulesSkeleton`; el esqueleto pinta «Cargando los módulos…» en `role="status"`), R4 (error → título, mensaje, referencia y «Reintentar»; sin `switch` ni Núcleo) |
| `tests/unit/maestro-ui/addon-switch-list.test.tsx` | ui | R5–R18, R20–R24 (ver mapa) |
| `tests/unit/maestro-ui/core-module-chips.test.tsx` | ui | R19 (11 fichas en orden, sin `switch` ni botón) |
| `tests/unit/maestro-ui/addon-labels.test.ts` | unit | R5 (una etiqueta por cada `ADDONS`, ni una más), R15 (`changedAddons`, mensajes singular y plural), R10/R12 (`offConsequences`: líneas por añadido, sin repetir, regla de Integraciones) |
| `e2e/maestro-modulos.spec.ts` | E2E (Playwright) | R25 |

### 7.1 Mapa `R<n> → test`

| R | Test |
|---|---|
| R1 | `company-modules-tab.test.tsx` «R1: recibe empresa, baja y canModify por props y no lee la sesión» |
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
| R12 | `addon-switch-list.test.tsx` «R12: Apagar todos confirma con el número, los nombres y las consecuencias sin repetir» |
| R13 | `addon-switch-list.test.tsx` «R13: Prender todos deshabilitado sin apagados y Apagar todos sin prendidos» |
| R14 | `addon-switch-list.test.tsx` «R14: mientras guarda hay spinner en el interruptor afectado y todo deshabilitado» |
| R15 | `addon-switch-list.test.tsx` «R15: con éxito pinta la vista devuelta sin releer y avisa por toast»; `addon-labels.test.ts` «R15: mensajes de toast en singular y plural» |
| R16 | `addon-switch-list.test.tsx` «R16: si falla uno, el interruptor vuelve y aparece No se guardó el cambio junto a su fila» |
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

- **Fixture:** empresa propia con prefijo `qc278_e2e_` y limpieza por edad, y un Administrador,
  como `e2e/modulos-por-empresa.spec.ts` (`createFixtureUser`, `normalizeCompanyName`). Se fija
  Proveedores apagado al empezar con Prisma (mismo `upsert` que su `setAddons`).
- **Maestro:** el del seed, con `SEED_MAESTRO_USERNAME` y `SEED_MAESTRO_PASSWORD` (los pone
  `.github/workflows/gate.yml:191-193, 374-376`). Sin ellos el spec falla con un mensaje que lo
  dice; no se salta. Un Maestro efímero no vale: la empresa vacía es única del Maestro
  (`e2e/integraciones.spec.ts:101-107`).
- **Dos contextos** de navegador: el del Maestro y el del Administrador.

Casos:

1. El Administrador entra; su menú no tiene `nav-proveedores`.
2. El Maestro abre `/maestro/empresas/<id>?tab=modulos`, pulsa el `switch` «Prender
   Proveedores»; ve el toast «Proveedores prendido.» y el estado «Prendido».
3. El Administrador recarga, sin volver a entrar: `nav-proveedores` aparece.
4. El Maestro pulsa «Apagar Proveedores», ve el diálogo «¿Apagar Proveedores?», pulsa «Apagar»;
   ve «Proveedores apagado.».
5. El Administrador recarga: `nav-proveedores` ya no está.

Depende de que QC-166 haya mergeado la ruta (T6).

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

**D. Etiquetas en el dominio (`identity/domain/company-addons.ts`) o en `lib/shared/ui/`.** Se
descarta: el dominio no lleva textos de pantalla, y `lib/shared/ui` es para lo que usan varias
rutas; hoy solo esta las usa. Si una segunda ruta las necesita (p. ej. el Historial de QC-166, que
nombra «Prendió Proveedores»), suben a `lib/shared/ui/` en ese commit con su fila en el catálogo.
Se anota a QC-166 en § 10.

**E. Un `<form action>` por fila con `useActionState`.** Se descarta por B y porque apagar pasa
por el diálogo, que ya llama por callback (`onConfirm`). El patrón de llamar a la acción con un
`FormData` construido dentro de `startTransition` ya existe
(`app/(private)/integraciones/whatsapp/components/whatsapp-connection-actions.tsx:85-95`).

## 9. Lo que el tablero dejaba «Por confirmar»

| Punto | Resuelto por |
|---|---|
| Descripción de cada añadido | Pregunta abierta 1 (propuesta en el seed) |
| Si apagar pide confirmación | Decisión cerrada «¿Confirmación?» |
| Nombres de los módulos del núcleo | Decisión cerrada «¿Núcleo?» + pregunta abierta 2 |
| Si el Historial nombra al Maestro | De QC-166, fuera de esta ficha |
| Texto de error al guardar | Decisión cerrada «¿Error al guardar?»: `ErrorAlert` junto a la fila |

## 10. Choques con otras features

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `app/(private)/maestro/empresas/[id]/page.tsx` | QC-166 (dueño) | **No se toca.** QC-166 monta `CompanyModulesTab` con el contrato de § 3. Si QC-166 se mergea antes y deja el hueco, la línea de montaje la pone QC-166; si no, esta ficha la añade en F2.3 al integrar |
| `app/(private)/maestro/empresas/[id]/components/index.ts` | QC-166 (dueño) | Una línea: `export * from './modulos';` |
| `e2e/helpers/*` | Toda ficha con E2E | Solo se leen; no se cambian |

Para QC-166 quedan dos notas: montar el `<Toaster />` si su área tiene layout propio (§ 3) y, si
su Historial pinta nombres de añadidos, reutilizar `ADDON_LABELS` subiéndolo a `lib/shared/ui/`
(§ 8.D).

## 11. Dependencias de terceros

Ninguna nueva. Se usan `@base-ui/react` (vía `Switch` y `ConfirmDialog`), `sonner` y
`lucide-react`, ya en `docs/dependencias.md` (l. 35, 73, 58). `Intl.ListFormat` es del navegador.

## 12. Riesgos y desconocidos

- **QC-166 sin diseño.** El contrato de § 3 es una propuesta. Si QC-166 lo cambia, cambia
  `company-modules-tab.tsx` y su test, nada más.
- **Grupo de rutas** (pregunta abierta 5): mover rutas, sin cambio de lógica.
- **Maestro del seed en local.** `progress/deudas.md` D27 registra entornos sin `SEED_MAESTRO_*`
  en `.env`; ahí el E2E falla con su mensaje. En CI están.
