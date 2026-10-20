# Review QC-301 — quitar-entregados-del-acondicionador

Vuelta 1, alcance completo. HEAD revisado: `1acc816b`, comparado con `origin/dev`
(35 archivos, +563 / −862). Grafo de código no consultado: la feature es de borrado y se
verificó con grep y lectura del diff.

## Verificación ejecutada (reviewer, 2026-10-19)

- `pnpm run typecheck` → exit 0.
- `pnpm run lint` → 0 errores. Hay 10 avisos y todos son previos (`tests/unit/pedidos/order-service.test.ts`, etc.).
- `pnpm exec vitest run` sobre los 11 archivos de test tocados más `list-conditioned-orders.test.ts`
  → **12 archivos, 299/299 en verde**.
- `pnpm exec vitest run guard` → **81 archivos, 1106 en verde y 20 omitidos**.
- E2E: no lo corrí, por indicación del leader. La bitácora registra
  `acondicionamiento.spec.ts` 6 passed y `operario-rediseno.spec.ts` 40 passed. Revisé el código del
  arreglo heredado (abajo).
- Greps:
  - `acondicionados_entregados|listDeliveredConditionedOrders|DeliveredConditioned|backToDelivered`
    en `app/ lib/ components/ hooks/` → 0;
  - citas `QC-<n>|R<n>|design.md|decisión` en las líneas `+` de producción (`app lib components`) → 0;
  - el diff no toca `db/`, `package.json`, `pnpm-lock.yaml` ni `lib/modules/identity` → sin
    migraciones, dependencias ni cambios de permisos o roles.

## Checklist

### Trazabilidad (R → test)
- [x] **R1**:
  - `assignment-views.test.ts`:
    - «QC-301 R1: el rol sembrado … exactamente `por_acondicionar` y `acondicionados`»;
    - «… las dos van al final, en el mismo orden y sin una tercera».
  - `acondicionamiento-authorization.test.ts`: «R2, QC-301 R1».
- [x] **R2**:
  - `asignacion-page.test.tsx` «QC-301 R2»: renderiza las pestañas y comprueba los dos textos y que no hay «Entregados»;
  - `assignment-view-tabs.test.tsx`:
    - «QC-301 R2: pinta exactamente dos pestañas … con su contador» (`Por acondicionar4`, `Acondicionados7`);
    - «QC-301 R2: no lee el número de pedidos entregados» (el doble `listDeliveredConditionedOrders` no se llama);
  - `assignment-view-counts.test.ts`;
  - E2E: paso 1 de `acondicionamiento.spec.ts` y R9 de `operario-rediseno.spec.ts`.
- [x] **R3**:
  - `assignment-views.test.ts`: con y sin el permiso, y para cada rol sembrado;
  - `asignacion-page.test.tsx`:
    - el acondicionador: el árbol es idéntico al de la vista por defecto y el fallback es `por_acondicionar`;
    - operador y empacador;
  - E2E: paso 6 nuevo.
- [x] **R4**: `conditioning-order-screen.test.tsx`, `conditioning-order-page.test.tsx` (texto y href
  `/asignacion?vista=acondicionados`) y la instantánea de paridad del `ENTREGADO`.
  - El 404 del `ENTREGADO` ajeno sigue cubierto («R21: un ENTREGADO que no deja ver el caso de uso sigue dando 404»).
  - «Datos de lote» sigue editable y Terminar deshabilitado: los dos se comprueban en el mismo caso.
- [x] **R5**:
  - `list-conditioned-orders.test.ts` (R11: solo `TERMINADO`, `conditionedBy` = actor; en verde);
  - E2E: paso 4 (E no sale en «Acondicionados») y paso 6 (E no sale en «Por acondicionar»);
  - ya no existe ninguna sección que liste `ENTREGADO` para el acondicionador.
- [x] **R6**:
  - `asignaciones-facade.test.ts`: censo de 34 y «QC-301 R6: la fachada no expone…»;
  - `acondicionamiento-rol.test.ts`: once rutas exactas.
- [x] **R7**:
  - `assignment-views.test.ts` «QC-301 R7» (administrador, operador y empacador sin cambios);
  - el diff no trae migraciones ni cambios en permisos o roles sembrados.
- [x] **R8**: typecheck y guardias en verde; `package.json` sin tocar.
- [x] `progress/impl_QC-301.md` lleva el mapa R → test consolidado.

### Tasks
- [x] T1–T5 marcadas `[x]` en `tasks.md`.

### Puntos pedidos por el leader
- [x] El acondicionador conserva solo «Por acondicionar» y «Acondicionados»:
  - `resolveAssignmentViews` hace `push('por_acondicionar', 'acondicionados')`;
  - salen la clave de los `Record` por vista y la rama de `page.tsx`.
- [x] `?vista=acondicionados_entregados` cae a la vista por defecto del rol, con
  `resolveAssignmentView` → `allowed[0]`. Lo prueban los unitarios y el E2E del paso 6.
- [x] «Volver» desde `ENTREGADO` lleva a «Acondicionados»: `backLink` une `TERMINADO || ENTREGADO`.
- [x] El caso de uso `list-delivered-conditioned-orders.ts` está borrado, igual que su export, su
  cableado y su test.
  - `OrderCatalog.listAliveSummariesInCompany` y el filtro `conditionedBy` siguen.
  - Los usa `list-conditioned-orders.ts:41-47` («Acondicionados»), como dice el `design.md`.
- [x] Otros roles sin cambios. Lo prueban R7 y los casos de operador y empacador en `asignacion-page.test.tsx`.
  - En `operario-rediseno.spec.ts` solo sale la fila de «Entregados».
- [x] Notas en QC-219: bajo R20, «Derogado por QC-301, 2026-10-19 …»; bajo R21, «Enmienda
  QC-301, 2026-10-19: la vuelta es «Volver a «Acondicionados»»». Llevan fecha y el resto del archivo
  queda igual, tabla de decisiones incluida.
- [x] Arreglo E2E heredado (paso 2 de `acondicionamiento.spec.ts`, commit `1acc816b`):
  - **solo toca el test**: el commit cambia `e2e/acondicionamiento.spec.ts` y la bitácora, nada de
    producción;
  - **coincide con `9a330ab2`** (en `origin/dev`):
    - `orderDistributionLineText` pinta `N × envase · <trimDecimal(content)> <símbolo>`;
    - `OrderDistributionFull` une las líneas con `' / '`;
    - el seed usa la unidad `litro`, cuyo símbolo es `l` (`db/migrations/20260903121404_units_catalog`);
    - `PRESENTATION_CONTENT = '1'`;
  - por tanto `2 × E1 · 1 l / 3 × E2 · 1 l` es el texto esperado.
- [x] Ninguna cita de ticket en comentarios de producción nuevos o modificados:
  - el JSDoc de `assignment-views.ts`, el de `conditioned-orders-table.tsx` y el de
    `conditioning-orders-skeleton.tsx` quedan limpios;
  - las citas `QC-301` están solo en tests y en el E2E, donde se permiten.

### CHECKPOINTS.md
- [x] requirements (EARS, R1–R8), design con alternativa descartada y tasks completas.
- [x] `design.md` abre con `## Lo que ya existe`, que no está vacía. El diff no re-crea nada; solo borra.
- [x] Mapa R → test en la bitácora.
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en CI: pendiente del PR, fuera de mi alcance.
- [x] Flujo crítico (permisos): las vistas por permiso las cubre el E2E
  `acondicionamiento.spec.ts`, cuya salida local está en la bitácora.
- [x] Sin dependencias, secretos, webhooks ni configuración hardcodeada nuevos.
- [ ] Cierre de `progress/features/QC-301.md` y desmontaje del worktree: pasos del leader después
  del review.

### docs/checkpoints-proyecto.md
- [x] TypeScript strict y lint en verde.
- [x] UI: no hay componente nuevo ni cambio visual nuevo; solo desaparece una pestaña. No toca CSS,
  así que no aplica multiplataforma. La sección borrada era local de la ruta y no tenía fila en
  `CATALOGO.md`.
- [x] Sin tablas, RLS ni migraciones nuevas.
- [x] El permiso se sigue validando en los casos de uso que quedan; el diff no toca ninguno.
- [x] Hexagonal: el diff solo borra un caso de uso con su export y su cableado; no añade imports.

### Reglas del proyecto (perfil-agentes > reviewer 5–11)
- [x] 5 Calidad/seguridad: nada nuevo.
- [x] 6 Multiplataforma: no aplica.
- [x] 7 Dependencias: `package.json` sin tocar.
- [x] 8 Aislamiento por empresa: sin modelos ni consultas nuevas.
- [x] 9 Comentarios: 0 citas en líneas `+` de producción.
- [x] 10 Duplicados / 11 Diseño: sin componentes nuevos.

## Hallazgos

1. **menor**: en `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` el texto
   todavía habla de tres listas.
   - Pasa en `describe('paridad del acondicionador — sus tres listas', …)` (l. 304) y en el
     comentario de cabecera (l. 38, «filas de sus tres listas»).
   - El acondicionador ya tiene dos listas. Es solo texto de test: el nombre arrastra las claves
     de la `.snap`, y renombrarlo obliga a regenerarla.
2. **menor**: en `tests/unit/asignaciones-ui/assignment-hrefs.test.ts`, el caso que sustituye al
   de `acondicionados_entregados` es un segundo `acondicionados` con otra página y otro tamaño.
   - Es redundante con la fila anterior, pero no hace daño.

No hay bloqueantes.

## Veredicto

**OK**: 0 bloqueantes y 2 menores.
