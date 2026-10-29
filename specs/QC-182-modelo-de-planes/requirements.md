# QC-182 — modelo-de-planes · requirements.md

> Zona: `backend` · Complejidad: `medium` · depends_on: QC-161 · Rama: `feature/QC-182-modelo-de-planes`
>
> **Alcance.** La tabla de planes de la plataforma, su migración y los permisos nuevos
> `planes.consultar` y `planes.modificar`, solo para el Maestro. Un plan es de la plataforma, no
> de una empresa. Tiene nombre, descripción, moneda, precio mensual y/o anual, si está activo, y
> la lista de **módulos** (los añadidos de QC-277) que trae. El núcleo va siempre y no se lista.
>
> **Lo que NO entra.**
> - Los casos de uso de alta, consulta, edición y desactivación: QC-185.
> - La pantalla de planes: QC-186.
> - El plan de cada empresa y la suscripción: QC-187.
> - Que los módulos del plan prendan añadidos en la empresa, combinados con las excepciones de
>   QC-277: QC-188.
> - Pasarela, métodos de pago, prueba, cobro y gracia: QC-183 y QC-189 a QC-192.
>
> Sembrado por `/afinar-feature` el 2026-10-28. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> «Guardar» en estos requisitos es escribir en la base, por cualquier vía. Los casos de uso que
> validan antes de escribir son de QC-185; aquí se exige lo que la propia base garantiza.
> Los requisitos marcados **[P1]** dependen de la propuesta por defecto de la pregunta abierta
> P1 (unicidad del nombre); si el humano la responde de otra forma, cambian o salen.

### Plan de plataforma

- **R1.** El sistema DEBE guardar los planes como datos de la plataforma: ni la tabla de planes
  ni la de sus módulos tienen columna de empresa.
- **R2.** El sistema DEBE guardar de cada plan su nombre, su descripción, su moneda, su precio
  mensual, su precio anual, si está activo, su fecha de alta, su fecha de última modificación y su
  fecha de borrado lógico.
- **R3.** Los nombres de las tablas y columnas de planes DEBEN estar en inglés y en `snake_case`.
- **R4.** SI un plan se guarda sin nombre o con un nombre que solo tiene espacios, ENTONCES el
  sistema DEBE rechazarlo.
- **R5.** SI un plan se guarda sin indicar si está activo, ENTONCES el sistema DEBE rechazarlo.
- **R6.** El sistema DEBE admitir un plan sin descripción (defecto de P2).

### Moneda y precios

- **R7.** El sistema DEBE guardar una sola moneda por plan, y esa moneda DEBE ser `CRC` o `USD`.
- **R8.** SI un plan se guarda sin moneda o con una moneda distinta de `CRC` y `USD` (incluidas
  `crc` o `usd` en minúsculas), ENTONCES el sistema DEBE rechazarlo.
- **R9.** SI un plan se guarda sin precio mensual y sin precio anual, ENTONCES el sistema DEBE
  rechazarlo.
- **R10.** El sistema DEBE admitir un plan con solo precio mensual, uno con solo precio anual y
  uno con los dos.
- **R11.** SI un precio de un plan es negativo, ENTONCES el sistema DEBE rechazar el plan.
- **R12.** El sistema DEBE admitir 0 como precio mensual y como precio anual, y DEBE distinguir
  un precio 0 de un precio ausente.
- **R13.** El sistema DEBE guardar cada precio como decimal exacto de hasta diez enteros y cuatro
  decimales, y DEBE devolverlo sin pérdida de precisión.

### Módulos del plan

- **R14.** El sistema DEBE guardar los módulos de un plan como claves del catálogo de añadidos
  que ya existe en la base.
- **R15.** SI se guarda en un plan un módulo que no está en el catálogo de añadidos (incluido un
  nombre del núcleo, como `pedidos` o `inventario`), ENTONCES el sistema DEBE rechazarlo.
- **R16.** SI se guarda dos veces el mismo módulo en el mismo plan, ENTONCES el sistema DEBE
  rechazar la segunda.
- **R17.** El sistema DEBE admitir un plan sin ningún módulo.
- **R18.** MIENTRAS algún plan traiga un módulo, el sistema DEBE impedir que ese módulo se borre
  del catálogo de añadidos.
- **R19.** El sistema DEBE permitir cambiar los precios y los módulos de un plan ya guardado
  conservando su identidad, aunque haya empresas suscritas. Cuándo rige el precio nuevo para cada
  empresa es de QC-187.
- **R20.** CUANDO se guarda, se cambia o se da de baja un plan, el sistema DEBE dejar sin cambios
  las excepciones de añadidos de todas las empresas.

### Estado, auditoría y borrado

- **R21.** CUANDO se guarda un plan, el sistema DEBE fijar su fecha de alta y su fecha de última
  modificación; CUANDO se cambia, DEBE actualizar la fecha de última modificación y conservar la
  de alta.
- **R22.** El sistema DEBE guardar «activo» y «borrado» por separado: un plan puede estar activo
  o inactivo sin estar borrado.
- **R23.** CUANDO un plan se da de baja, el sistema DEBE conservar su fila y sus módulos y
  marcarlo con la fecha de borrado lógico.
- **R24.** **[P1]** SI se guarda un plan cuyo nombre coincide sin distinguir mayúsculas con el de
  otro plan no borrado, ENTONCES el sistema DEBE rechazarlo. Un plan inactivo no borrado también
  reserva su nombre.
- **R25.** **[P1]** El sistema DEBE admitir un plan con el nombre de otro plan ya borrado.

### Aislamiento

- **R26.** Las tablas de planes y de módulos del plan DEBEN tener RLS activada y forzada, sin
  policies de empresa.

### Permisos

- **R27.** El catálogo de permisos DEBE incluir `planes.consultar` (consultar los planes de la
  plataforma) y `planes.modificar` (dar de alta, editar y desactivar los planes de la plataforma),
  cada uno una sola vez, sin cambiar ninguna otra entrada del catálogo.
- **R28.** El rol Maestro DEBE recibir exactamente `empresas.consultar`, `empresas.modificar`,
  `planes.consultar` y `planes.modificar`.
- **R29.** Ningún rol que no sea el Maestro DEBE recibir `planes.consultar` ni
  `planes.modificar`.
- **R30.** Los dos permisos de planes DEBEN ser del núcleo: ningún recorte por añadidos los
  quita.
- **R31.** CUANDO se aplica la migración de permisos a una base ya sembrada, el sistema DEBE
  crear los dos permisos y asignarlos solo al Maestro; aplicarla sobre una base que ya los tiene
  NO DEBE cambiar nada.
- **R32.** CUANDO corre el seed sobre una base vacía o sobre una ya sembrada sin los permisos de
  planes, el sistema DEBE dejar los dos permisos creados y asignados solo al Maestro; una segunda
  corrida NO DEBE cambiar nada.

### Migraciones

- **R33.** CUANDO se revierte cada migración de esta feature con su `down.sql`, el sistema DEBE
  quedar como antes de aplicarla: sin las tablas de planes en un caso, y sin los dos permisos ni
  sus asignaciones en el otro, con el resto intacto.

### Cobertura de las decisiones cerradas

| Decisión (fecha 2026-10-28) | Requisitos |
|---|---|
| Un plan otorga módulos del catálogo de QC-277; el núcleo no se lista; las excepciones siguen encima | R14, R15, R20 |
| Un plan puede no traer módulos | R17 |
| Una moneda por plan, `CRC` o `USD`; no cierra «Moneda por empresa» | R7, R8 |
| Al menos un precio, mensual o anual | R9, R10 |
| Precio 0 sí, negativo nunca; `decimal(14,4)` | R11, R12, R13 |
| Se edita un plan con suscripciones vivas | R19 |
| Borrado lógico con `created_at`, `updated_at`, `deleted_at`, aparte de `active` | R2, R21, R22, R23 |
| Identificadores en inglés | R3 |
| Fuera de la guardia de empresa; FK al catálogo de añadidos | R1, R14, R26 |
| Sin E2E | No describe comportamiento del sistema: se cumple en `tasks.md` (ninguna tarea de E2E) y lo comprueba el reviewer. |

## Preguntas abiertas

- **P1. Unicidad del nombre.** ¿Dos planes pueden llamarse igual? La propuesta es único sin
  distinguir mayúsculas entre los planes no borrados (patrón de QC-4). No la decidió el humano:
  `spec_author` la deja como pregunta con esa propuesta por defecto. **Dependen de ella R24 y
  R25.**
- **P2. ¿La descripción es obligatoria?** El alcance dice que un plan «tiene descripción», pero no
  si puede faltar. Propuesta por defecto: opcional (R6), porque en un plan solo con el núcleo puede
  no haber nada que describir. Si se responde «obligatoria», R6 pasa a ser un rechazo como R4.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-28 | ¿Qué otorga un plan a la empresa suscrita? | Un conjunto de **módulos**: el catálogo de añadidos de QC-277 (`dashboard`, `proveedores`, `lectura_pdf`, `importacion_excel`, `integraciones`), no permisos sueltos. Hereda QC-277 D16 («plan = conjunto de módulos + precio»). El núcleo no se lista: va siempre. Las excepciones por empresa de QC-277 siguen encima del plan (QC-277 D14). La tarjeta decía «lista de permisos»; se corrigió en el board. |
| 2026-10-28 | ¿Un plan puede no traer módulos? | Sí. Un plan solo con el núcleo es válido. |
| 2026-10-28 | ¿En qué moneda va el precio? | Una moneda por plan, `CRC` o `USD`; los precios del plan van en esa moneda. Es la primera moneda que se guarda en el sistema y no cierra la pregunta abierta «Moneda por empresa» de `docs/architecture.md`, que es la del costo. |
| 2026-10-28 | ¿Mensual, anual o los dos? | Al menos uno de los dos; el otro puede faltar. |
| 2026-10-28 | ¿Se admite precio 0? | Sí (plan gratuito); negativo nunca. El dinero va en `decimal(14,4)`, nunca `float` (`docs/architecture.md`). |
| 2026-10-28 | ¿Se edita un plan con suscripciones vivas? | Sí. Un precio nuevo rige desde la próxima renovación de cada empresa; los módulos cambian ya. La mecánica del precio vigente por suscripción es de QC-187. |
| 2026-10-28 | Borrado | Lógico, con `created_at`, `updated_at` y `deleted_at`, aparte de `active` (hereda QC-4). |
| 2026-10-28 | Idioma de los identificadores | Inglés (hereda QC-4). |
| 2026-10-28 | ¿La tabla de planes entra en la guardia de empresa (QC-61)? | No: es de plataforma, sin columna de empresa ni RLS de empresa, como la tabla del catálogo de añadidos (QC-277 D13). La relación plan↔módulo apunta con FK a esa tabla de catálogo. |
| 2026-10-28 | ¿E2E? | No: es modelo, migración y permisos, sin pantalla. El E2E entra con la pantalla (QC-186). |
