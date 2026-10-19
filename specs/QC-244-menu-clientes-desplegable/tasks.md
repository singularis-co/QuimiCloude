# QC-244 — menu-clientes-desplegable · tasks.md

> Cada task cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>`. Las guardias van con
> `pnpm exec vitest run guard`. La suite completa la corre CI (`gate-completo`).
> `[P]` = paralelizable con las demás `[P]` de su mismo bloque. Las referencias `§` son a `design.md`.

## Bloque 0 — Preparación

- [ ] **T0. Sincronizar y medir.**
  - `git fetch origin dev && git merge origin/dev`.
  - Volver a medir los hallazgos 6–9 de `design.md > 0`:
    - las cifras y líneas de §6.2 (anclas de `guard-nav-permisos-declarados`,
      `RUTAS_ESPERADAS_HOY`, `nav-iconos`, `orden-secciones`);
    - los dos casos de §6.3;
    - la estructura del indicador activo en el submenú (§7.2).
  - Buscar otros censos cerrados de exports de `lib/shared/routes.ts` o de `private-nav.ts`.
  - Correr una vez, antes de tocar nada, los tests de la lista «siguen verdes» de §6.2, para tener
    la línea base.

  **Hecho cuando** las cifras reales y cualquier test rojo nuevo están anotados en
  `progress/impl_QC-244-menu-clientes-desplegable.md`. Si aparece algo fuera de §6.2 o §6.3, se
  para y se avisa al leader (§9).

## Bloque 1 — Producción

- [ ] **T1. Ruta y etiqueta.** (depende de T0)
  - `CUSTOMER_CONTACTS_ROUTE = \`${CUSTOMERS_ROUTE}/contactos\`` en `lib/shared/routes.ts`, con el
    comentario de una línea de §3 y **sin** tocar `PRIVATE_ROUTE_PREFIXES`.
  - `CUSTOMER_CONTACTS_LABEL = 'Contactos'` en `private-nav.ts`, junto a `CUSTOMERS_LABEL`.

  **Hecho cuando** typecheck y lint están en verde y `PRIVATE_ROUTE_PREFIXES` no tiene diff.
- [ ] **T2. El grupo del menú.** (depende de T1)
  - En `PRIVATE_NAV_ITEMS`, el enlace `nav-clientes` se sustituye **en su misma posición** por el
    `NavGroup` de §4.2.
  - Se reescribe el comentario de encima (§4.2), sin `QC-<n>` ni `R<n>`.
  - No se toca ningún tipo ni función del archivo.

  **Hecho cuando** el diff de `private-nav.ts` se limita a: el import, la etiqueta, el item y su
  comentario.
- [ ] **T3. La página cascarón.** (depende de T1) `[P]` con T2
  - `app/(private)/clientes/contactos/components/contact-texts.ts` y su `index.ts` (§5.1), sin
    `'use client'`.
  - `app/(private)/clientes/contactos/page.tsx` exactamente con la forma de §5.2: corte primero,
    `PageShell` + `PageHeader` + `EmptyState`, sin comentarios.

  **Hecho cuando** typecheck y lint están en verde y `clientes-convenciones.test.ts` sigue verde
  con la carpeta nueva dentro.

## Bloque 2 — Tests unitarios (dependen de T2 y T3)

- [ ] **T4. `private-nav-clientes.test.ts` reescrito** (§6.1): R1–R5, R13 y la comparación
  menú-página por cada hijo. `[P]`

  **Hecho cuando** el archivo está en verde y cada caso lleva su `R<n>` en el nombre.
- [ ] **T5. `contactos-page.test.tsx` nuevo** (§6.1): R3 (parte de página), R7, R8, R9 (página) y
  R11. `[P]`

  **Hecho cuando** está en verde y no localiza nada por copy literal.
- [ ] **T6. `customer-contacts-route-contract.test.ts` nuevo** (§6.1): R10 y R9 (borde). `[P]`

  **Hecho cuando** está en verde.
- [ ] **T7. Tensar los tests de forma** (§6.2), con las cifras reales de T0. `[P]`
  - `guard-nav-permisos-declarados`: 15 → 16, con la lista exacta.
  - `guard-pantallas-exigen-permiso`: 29 → 30, con `'/clientes/contactos'` como entrada.
  - `nav-iconos`: `SIN_ICONO` y forma de R3.
  - `orden-secciones`: la clave del grupo.

  **Hecho cuando** los cuatro están en verde exigiendo la lista o la cifra exactas, y
  `pnpm exec vitest run guard` está en verde.
- [ ] **T8. Enmiendas de alcance** (§6.3). `[P]`
  - `clientes/scope.test.ts` R26: admite `app/(private)/clientes/contactos/page.tsx` por ruta exacta.
  - `recipe-route-contract.test.ts`: alta de `CUSTOMER_CONTACTS_ROUTE` en el censo.
  - Cualquier otro censo que encuentre T0, con la misma forma.

  **Hecho cuando** los dos casos están en verde y sus casos de sensibilidad («dispara con un archivo
  fabricado») siguen en verde.

## Bloque 3 — E2E (depende de T2 y T3)

- [ ] **T9. `e2e/clientes.spec.ts`** (§7.1): el caso nuevo del Administrador, la ampliación de R42
  para el Operador y el párrafo de la cabecera. `[P]`

  **Hecho cuando** `pnpm exec playwright test e2e/clientes.spec.ts` está en verde en Chromium y
  WebKit.
- [ ] **T10. `e2e/movimiento.spec.ts`** (§7.2): `NAV_CUSTOMERS_TESTID`, la búsqueda de lista en
  `indicatorFit` y `watchSlide`, el paso de deslizamiento entre los hijos y el paso a Proveedores
  antes del modo icono. `[P]`

  **Hecho cuando** `pnpm exec playwright test e2e/movimiento.spec.ts` está en verde en los dos
  modos (normal y movimiento reducido), sin quitar ninguna aserción.

## Bloque 4 — Cierre

- [ ] **T11. Verificación y trazabilidad.** (depende de T4–T10)
  - `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest run guard` y
    `pnpm exec vitest related --run <todos los archivos del diff>`.
  - `./init.sh`; si no cierra en local, se deja escrito el motivo y manda `gate-completo`.
  - El mapa `R<n> -> test` de `design.md > 12`, con los nombres reales de los casos, en
    `progress/impl_QC-244-menu-clientes-desplegable.md`.
  - El diff es exactamente la lista de abajo.

  **Hecho cuando** todo está en verde, el mapa cubre R1–R15 y no hay archivos fuera de la lista.

## Archivos esperados

- `lib/shared/routes.ts`
- `lib/shared/navigation/private-nav.ts`
- `app/(private)/clientes/contactos/page.tsx`
- `app/(private)/clientes/contactos/components/index.ts`
- `app/(private)/clientes/contactos/components/contact-texts.ts`
- `tests/unit/clientes-ui/private-nav-clientes.test.ts`
- `tests/unit/clientes-ui/contactos-page.test.tsx`
- `tests/unit/clientes-ui/customer-contacts-route-contract.test.ts`
- `tests/guards/guard-nav-permisos-declarados.test.ts`
- `tests/guards/guard-pantallas-exigen-permiso.test.ts`
- `tests/unit/shell/nav-iconos.test.ts`
- `tests/unit/navegacion/orden-secciones.test.ts`
- `tests/unit/clientes/scope.test.ts`
- `tests/unit/recetas-ui/recipe-route-contract.test.ts`
- `e2e/clientes.spec.ts`
- `e2e/movimiento.spec.ts`
- `specs/QC-244-menu-clientes-desplegable/requirements.md`
- `specs/QC-244-menu-clientes-desplegable/design.md`
- `specs/QC-244-menu-clientes-desplegable/tasks.md`
- `progress/impl_QC-244-menu-clientes-desplegable.md`
- `progress/features/QC-244.md`
