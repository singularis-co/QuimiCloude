# QC-301 — quitar-entregados-del-acondicionador · tasks.md

> **Orden:**
> - T1 primero: quita la vista del tipo, y el typecheck señala el resto.
> - T2 y T3 en paralelo tras T1.
> - T4 tras T2 y T3. T5 cuando quieras.
>
> **Cierre de cada task:** `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos de la task>` (`docs/perfil-agentes.md > Todos los
> agentes`). Commit por task: `feat(QC-301): …` o `test(QC-301): …`.

## Tasks

- [ ] **T1 — Dominio y fachada** (R1, R3, R6, R7)
  - Código:
    - `assignment-views.ts`: sale `'acondicionados_entregados'` del tipo y del `push`, y se
      ajusta el JSDoc.
    - Se borra `list-delivered-conditioned-orders.ts`, con su exportación en
      `lib/modules/asignaciones/index.ts` y su cableado en `lib/composition/index.ts`.
    - El puerto y el adaptador NO se tocan (`design.md > Lo que ya existe`).
  - Tests:
    - se ajustan `assignment-views.test.ts`, `acondicionamiento-authorization.test.ts`,
      `asignaciones-facade.test.ts` y `acondicionamiento-rol.test.ts` (rutas: de 12 a 11);
    - se borra `list-delivered-conditioned-orders.test.ts`.
  - **Hecho:**
    - el rol devuelve exactamente `['por_acondicionar', 'acondicionados']`;
    - `resolveAssignmentView('acondicionados_entregados', …)` cae a `allowed[0]`;
    - un grep de `listDeliveredConditionedOrders` en `lib/` y `app/` sale vacío.

- [ ] **T2 [P] — UI de `/asignacion`** (R2, R3, R5)
  - Código:
    - se borra `delivered-conditioned-orders-list-section.tsx`, con su exportación en
      `components/index.ts`;
    - sale la clave de `assignment-view-tabs.tsx`, `assignment-view-tabs-section.tsx`,
      `conditioning-orders-empty.tsx` y `conditioning-orders-skeleton.tsx`;
    - se estrecha la prop `view` de `conditioned-orders-table.tsx`;
    - sale la rama de `page.tsx`.
  - Tests:
    - se ajustan `assignment-view-counts.test.ts`, `assignment-hrefs.test.ts`,
      `assignment-view-tabs.test.tsx`, `asignacion-page.test.tsx` y la paridad, con la
      instantánea regenerada;
    - se borra `delivered-conditioned-orders-list-section.test.tsx`.
  - **Hecho:**
    - dos pestañas;
    - `?vista=acondicionados_entregados` monta «Por acondicionar»;
    - un grep de `acondicionados_entregados` en `app/` y `lib/` sale vacío.

- [ ] **T3 [P] — Vuelta desde un `ENTREGADO`** (R4)
  - Código: en `conditioning-order-screen.tsx`, `ENTREGADO` vuelve a «Acondicionados» y sale
    `backToDelivered`.
  - Tests: se ajustan `conditioning-order-screen.test.tsx`, `conditioning-order-page.test.tsx` y
    la instantánea de paridad del detalle.
  - **Hecho:** el enlace dice «Volver a «Acondicionados»» con href `/asignacion?vista=acondicionados`.

- [ ] **T4 — E2E** (R2, R3, R5)
  - `e2e/acondicionamiento.spec.ts`:
    - el paso 1 espera dos pestañas;
    - un paso nuevo comprueba que `?vista=acondicionados_entregados` aterriza en «Por
      acondicionar».
  - `e2e/operario-rediseno.spec.ts`: sale `TAB_TESTIDS.entregados` y su fila.
  - **Hecho:** pasan `pnpm exec playwright test e2e/acondicionamiento.spec.ts` y
    `pnpm exec playwright test e2e/operario-rediseno.spec.ts`.

- [ ] **T5 [P] — Enmienda en QC-219** (trazabilidad)
  - En `specs/QC-219-datos-de-lote-en-acondicionamiento/requirements.md`, bajo R20, va la nota:
    *«(Derogado por QC-301, 2026-10-19: el acondicionador ya no tiene «Entregados»; los
    `ENTREGADO` salen de sus vistas.)»*
  - Bajo R21 va la nota: *«(Enmienda QC-301, 2026-10-19: la vuelta es «Volver a
    «Acondicionados»».)»*
  - **Hecho:** las dos notas están, con fecha; el resto del archivo queda igual.

## Archivos esperados

- `lib/modules/asignaciones/domain/assignment-views.ts`
- `lib/modules/asignaciones/domain/list-delivered-conditioned-orders.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/composition/index.ts`
- `app/(private)/asignacion/page.tsx`
- `app/(private)/asignacion/components/index.ts`
- `app/(private)/asignacion/components/assignment-view-tabs.tsx`
- `app/(private)/asignacion/components/assignment-view-tabs-section.tsx`
- `app/(private)/asignacion/components/delivered-conditioned-orders-list-section.tsx`
- `app/(private)/asignacion/components/conditioning-orders-empty.tsx`
- `app/(private)/asignacion/components/conditioning-orders-skeleton.tsx`
- `app/(private)/asignacion/components/conditioned-orders-table.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`
- `tests/unit/asignaciones/assignment-views.test.ts`
- `tests/unit/asignaciones/acondicionamiento-authorization.test.ts`
- `tests/unit/asignaciones/list-delivered-conditioned-orders.test.ts`
- `tests/unit/asignaciones-ui/assignment-view-counts.test.ts`
- `tests/unit/asignaciones-ui/assignment-hrefs.test.ts`
- `tests/unit/asignaciones-ui/assignment-view-tabs.test.tsx`
- `tests/unit/asignaciones-ui/asignacion-page.test.tsx`
- `tests/unit/asignaciones-ui/delivered-conditioned-orders-list-section.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-page.test.tsx`
- `tests/unit/composition/asignaciones-facade.test.ts`
- `tests/unit/identity/roles/acondicionamiento-rol.test.ts`
- `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/asignacion-acondicionamiento-paridad.test.tsx.snap`
- `e2e/acondicionamiento.spec.ts`
- `e2e/operario-rediseno.spec.ts`
- `specs/QC-219-datos-de-lote-en-acondicionamiento/requirements.md`
