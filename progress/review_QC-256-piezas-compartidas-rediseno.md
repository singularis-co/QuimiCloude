# Review QC-256 — piezas-compartidas-rediseno

Rama `feature/QC-256-piezas-compartidas-rediseno`, diff `origin/dev...HEAD` (merge-base `2cfd4efd`,
el último `dev`, con QC-257 dentro; `git merge-tree` contra `origin/dev` sin conflictos). 14 commits,
89 archivos. Reviewer, 2026-10-11.

## Checklist

### Especificación
- [x] `requirements.md` con R1–R58 en EARS y D1–D17 cerradas.
- [x] `design.md` abre con `## Lo que ya existe`: términos buscados, filas del catálogo consultadas,
      el paso de la regla de decisión por pieza y la excepción de subida a `shared` con sus
      consumidores. El diff no re-crea nada de esa lista: `CredentialField` se absorbe y se borra;
      `OrderStatusBadge` y compañía, `CredentialInput` y las pestañas a mano se dejan (D7).
- [x] `design.md > 12. Alternativas descartadas`.
- [x] `tasks.md`: 129 `[x]`, ninguna `[ ]`.

### Equipo
- [x] Feature tomada (`1d20292e`), rama del worktree.

### Trazabilidad
- [x] El mapa `R → test` está en `progress/impl_QC-256.md` (tabla final). Comprobado con grep que
      R1–R46 y R49–R58 aparecen en los tests nuevos o enmendados del diff.
      - R47 → `tests/unit/marca/badges-estado.test.tsx`, que existe y sigue verde. Además los
        snapshots de paridad de pedidos solo cambian botones y chips (ver más abajo).
      - R48 → `guard-dependencias-aprobadas`, y `package.json`/lockfile sin diff.
- [x] Muestreo de tests: no hay tests vacíos. Los de R9, R18, R50 y R58 afirman clases y tokens:
      es el límite de jsdom. R33 tiene un E2E de navegador real.

### Calidad de código
- [x] `./init.sh` (rápido) en el worktree: **`== init OK ==`, exit 0**.
  - typecheck limpio.
  - lint con 0 errores y 7 avisos previos ajenos.
  - `vitest related`: 309 archivos, 4671 tests en verde y 1 omitido.
  - guardias y resto: 109 archivos, 1531 tests en verde y 35 omitidos.
  - Avisos amarillos: sin `DATABASE_URL` en el worktree (no hay `.int` afectados) y los 62 tests
    que solo corre el CI.
- [ ] `gate-completo` en CI: pendiente del PR.
- [x] Flujo crítico: no toca autenticación, permisos, inventario, importes ni webhooks. El E2E de
      R33 es de Playwright y su salida está en la bitácora (chromium y webkit, 2 en verde).
- [x] Dependencias: `git diff origin/dev...HEAD -- package.json pnpm-lock.yaml` vacío. `Alert` se
      copió a mano del registro de shadcn, sin el CLI, que metía `cn@^0.4.0`.

### Seguridad y configuración
- [x] Sin secretos. El `.env` copiado para el E2E no está en el worktree ni en ningún commit.
- [x] Sin webhooks ni configuración por entorno.

### `docs/checkpoints-proyecto.md`
- [x] Multiplataforma (sin hallazgos):
  - sin `100vh`;
  - el `hover` de `ArrowLink` y del chip es decorativo y va por `btn-veil` o `hover:` (gateado en
    Tailwind v4);
  - objetivos táctiles: chips 44 px, X de filtro 44, ojo `size-11`, «Acciones» con `touch`,
    ítems del menú centrado `min-h-12`, `UrlTabs` `min-h-11`;
  - inputs nuevos con `text-base` (`FIELD_TEXT`, `PasswordField`).
- [x] Catálogo:
  - cada pieza nueva, extendida o borrada tiene su fila al día;
  - `CredentialField` desaparece;
  - la fila de `DataTable` menciona los chips y «Limpiar filtros»;
  - lo verifican `catalogo-qc256.test.ts` y `guard-catalogo-de-componentes`.
- [x] Diseño: cada pieza con UI cita su tablero (`Botones`, `Estados`, `Campos`, `Avisos`, `Tabla`,
      `Superficies` y `Dominio` `.dc.html`) en `design.md` y en su celda `Diseño`.
- [x] Módulos: `lib/shared/ui/{order-status,status-tone,avatar-tone}.ts` no importan
      `lib/modules/*` (D17). Las rutas importan del mapa compartido.
- [n/a] Supabase, RLS, migraciones y permisos: el diff no toca datos ni servidor.

### Reglas de `docs/perfil-agentes.md > reviewer`
- [x] 5 Calidad y seguridad: nada aplicable.
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: ninguna.
- [x] 8 Empresa: no toca `schema.prisma` ni consultas.
- [ ] **9 Comentarios: un comentario de producción añadido cita `R17`** (hallazgo 1).
- [x] 10 Duplicados: la tabla «Filas consultadas y paso» de `design.md` justifica cada pieza nueva
      con el paso aplicado.
- [x] 11 Diseño: ver arriba.
- [x] Regla de decisión:
  - `Notice` compone `Alert`, rehecho en la tanda 5;
  - `ArrowLink` compone `buttonVariants`;
  - `PasswordField` compone `Input` y `CredentialRequirements`;
  - `UrlTabs` compone `Tabs` + `TabsIndicator`;
  - `DataTableCards` es interno de `data-table/` y no sale del barrel.
  - Las piezas nacen en `shared` sin una segunda ruta, con la excepción declarada y sus
    consumidores identificados.

## Juicios pedidos por el leader

### Commits de snapshots de paridad: solo cambian lo que declaran
Lo comprobé con scripts propios. No me fié del control de la bitácora.

- **`f44390eb` (Button, D7).** 17 `.snap` y nada más. 721 pares de líneas quitada/añadida; fuera
  de `class`, todas idénticas (0 diferencias, 0 hunks desparejados). Dentro de `class`, solo cuatro
  firmas, y las 721 líneas son de `buttonVariants` (todas llevan `group/button`):
  - `h-8 px-2.5 → h-9 px-3.5` (503);
  - `size-8 → size-9` (167);
  - `size-7 → size-8` (45);
  - `h-7 px-2.5 text-[0.8rem] → h-8 px-3 text-[13px]` (6).
- **`8c4bd257` (Spinner/Avatar).** 3 `.snap`, 18 pares, 0 cambios fuera de `class`:
  - `animate-spin → animate-[spin_0.9s_linear_infinite]` (16);
  - las doce clases `group-data-[tone=N]/avatar:*` añadidas a `AvatarFallback` (2).
- **`5873567f` (chips, D14).** 12 `.snap` y nada más. 27 entradas cambiadas. Quitando el subárbol
  con raíz en `data-table-filters`, `data-table-chips`, `data-table-filter-*` o
  `data-table-toolbar-actions`, las 27 son idénticas. El contenido de `data-table-toolbar-actions`
  se movió de sitio, pero es idéntico byte a byte en las 5 entradas que lo tienen.
- Ningún otro commit toca `__snapshots__`.

**Veredicto: los tres commits solo cambian lo que declaran.**

### `package.json`
Sin cambios, ni él ni `pnpm-lock.yaml`. R48 se cumple.

### Limpieza del E2E (`e2e/piezas-compartidas.spec.ts`)
Toda la limpieza va acotada a `qc256_e2e_`:
- **`beforeAll`:** los `deleteMany` de `unit`, `user` y `company` filtran por
  `startsWith: 'qc256_e2e_'` y además por `createdAt < now − 1 h`.
- **`afterAll`:** borra por el prefijo con `RUN_ID` de las unidades y por el nombre exacto del
  usuario y de la empresa de la ejecución, en `try/finally` anidados.
- **Esquema:** todas las relaciones son `onDelete: Restrict`, así que un borrado no puede arrastrar
  datos ajenos en cascada. Si algo lo referencia, falla.
- **Usuario:** se crea con `createFixtureUser`, como exige la guardia.
- **Lista cerrada de E2E:** el spec está dado de alta en `guard-identificador-de-request` (punto de
  extensión).

**Veredicto: correcto.**

### ¿La paginación `sticky` que tapaba el ⋯ de la última fila es un defecto del componente?
**No es un defecto del contrato del componente, ni de esta ficha.** `DataTablePagination` es
`sticky bottom-0` por decisión humana del 2026-09-07 (documentada en el propio archivo; el
último cambio es de QC-231). Al llegar al final del desplazamiento, vuelve a su hueco en el flujo y
no tapa la última fila. Lo confirma la propia bitácora: `locator.click()` desplazaba hasta
destaparla. El solape transitorio es inherente a cualquier pie `sticky`: lo de debajo se alcanza
desplazando. El ajuste del E2E (asomar el disparador sobre la barra, comprobar con
`elementFromPoint` y pulsar con `page.mouse.click`) no debilita R33. Al contrario, añade que abrir
no mueve la página.

**Efecto secundario real** (menor, previo, fuera del diff). Con teclado, el navegador desplaza el
foco a la vista sin contar los elementos `sticky`. Un control de la última fila visible puede quedar
oculto bajo la paginación: WCAG 2.2, 2.4.11 «Focus Not Obscured». Se arregla con un
`scroll-padding-bottom` del alto de la barra en el contenedor que desplaza. Va a `progress/deudas.md`
como ficha del board, no a QC-256.

## Hallazgos

1. **BLOQUEANTE (regla 9 del reviewer, `docs/conventions.md > Comentarios`).**
   `components/shared/notice.tsx:25`, línea añadida por el diff:
   `// sustituye al grid base vía tailwind-merge, y el role de Alert se sobrescribe por props (R17).`
   Cita `R17` en un archivo de producción. Arreglo: quitar `(R17)`; el resto del comentario explica
   un porqué y puede quedarse. Es la única coincidencia: busqué `QC-n`, `Rn`, `design.md` y
   «decisión cerrada» en todas las líneas añadidas de `app/`, `components/`, `lib/` y `hooks/`.
2. **menor.** R45 pide tablero en `Diseño` para «el mapa de pedido» y «el color de avatar», pero
   sus filas (`ORDER_*`, `STATUS_TONES` y `avatarTone`) llevan `sin UI`. Es la convención del
   catálogo para apoyos de `lib/shared/ui` (`CATALOGO.md`, línea 10) y lo acepta
   `catalogo-qc256.test.ts`. El código está bien; la redacción de R45 es imprecisa.
3. **menor.** El botón «Acciones» de la tarjeta tiene el texto visible «Acciones» y como nombre
   accesible `triggerLabel`, como pide R35. Si un consumidor pasa un `triggerLabel` que no contiene
   «Acciones», incumple WCAG 2.5.3 «Label in Name». Recomendación: que las fichas de módulo usen
   etiquetas que empiecen por el texto visible, o anotarlo en la fila de `RowActionsMenu`.
4. **menor.** Con `card`, `DataTable` pinta la tabla y las tarjetas a la vez y duplica `data-testid`
   (por ejemplo, el `triggerTestId` del ⋯). Está declarado en la bitácora («Avisos para las fichas
   de módulo»). Conviene que pase a `deudas.md` o a la fila del catálogo para que las fichas
   QC-260 a QC-267 lo vean.
5. **menor (fuera del diff, previo).** Paginación `sticky` contra el foco con teclado: ver el juicio
   de arriba. Va a deudas.
6. **menor (previo, no lo introduce el diff).** Los dos `Input` del filtro `numberRange` comparten el
   nombre accesible `column.label`, así que mínimo y máximo no se distinguen con lector de
   pantalla. Ya pasaba en `origin/dev`; ahora que viven en el popover del chip, es buen momento
   para una ficha.

## Veredicto

**RECHAZADO.** Un solo bloqueante, el hallazgo 1: la referencia `R17` en el comentario de
`components/shared/notice.tsx:25`. Todo lo demás está en verde:
- la trazabilidad;
- las tasks;
- los checkpoints;
- la regla de catálogo y diseño;
- `./init.sh`;
- los snapshots;
- `package.json`;
- la limpieza del E2E.

La vuelta 2 puede acotarse al commit que quite esa referencia.

## Vuelta 2 (acotada a e35b7e21)

El commit toca tres archivos: `components/shared/notice.tsx`, `components/shared/CATALOGO.md` y
`progress/deudas.md`.

- **Hallazgo 1 (BLOQUEANTE): resuelto.** `notice.tsx:25` ya no cita `R17`; el resto del comentario
  no cambia. Volví a buscar `QC-n`, `Rn`, `design.md` y «decisión cerrada» en las líneas que añade
  el commit en `app/`, `components/`, `lib/` y `hooks/`: ninguna coincidencia.
- **Menores: anotados.**
  - La fila `DataTable` de `CATALOGO.md` añade una sola frase, que avisa del DOM doble de `card` y
    de los `data-testid` duplicados. El resto de la fila no cambia (comprobado con `--word-diff`).
  - `progress/deudas.md` gana la sección «QC-256 (review, 2026-10-11)» con los cinco menores:
    R45 y `sin UI`, Label in Name de «Acciones», DOM doble de `card`, nombre accesible de
    `numberRange` y foco tapado por la paginación `sticky`.
- **Sin regresiones.** El commit no cambia código ejecutable, solo un comentario.
- **`./init.sh`.**
  - La primera pasada salió roja (exit 1) por un test que no toca este commit:
    `tests/unit/inventario/adjust-batch-dialog.test.tsx`, el caso «R9 — con el lote sobre-reservado…»
    (mock llamado 0 veces).
  - Corrido solo, ese archivo pasa: 30 de 30.
  - La segunda pasada de `./init.sh` terminó en `== init OK ==` y exit 0: 309 archivos en verde,
    más 109 de guardias y resto.
  - Lo trato como un test intermitente con la máquina cargada, no como un rojo de esta ficha.

**Veredicto: OK.**
