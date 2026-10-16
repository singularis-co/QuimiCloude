# QC-277 — modulos-por-empresa · requirements.md

> Zona: `fullstack` · Complejidad: `high` · `depends_on`: QC-162 (Finalizado) · Rama:
> `feature/QC-277-modulos-por-empresa`
>
> **Sembrado por el leader (2026-10-14)** desde la descripción del issue QC-277 y el mapa
> `progress/modulos-por-empresa.md`. La ficha llegó sin `/afinar-feature`: el alcance y las
> decisiones se cerraron con el humano el 2026-10-13 y no se reabren. `spec_author` completa los
> requisitos EARS y la columna «Cubierta por».

## Alcance

Motor de módulos por empresa: el Maestro prende y apaga **añadidos enteros** en una empresa, uno
a uno o todos a la vez. El núcleo no se apaga nunca.

Entra:

- **Catálogo de módulos:** núcleo fijo y añadidos apagables.
- **Añadidos activos de cada empresa.**
- **Recorte de permisos:** el permiso efectivo es rol ∩ módulos activos. Se resuelve en la sesión
  en cada petición, así que el cambio tiene efecto inmediato. Absorbe QC-188 (cancelada).
- **Operación del Maestro** para prender y apagar, con el permiso `empresas.modificar`.
- **Cierre de todos los puntos cruzados y huecos:**
  - los botones que cuelgan del permiso de otro módulo;
  - el logo y el aterrizaje, hoy fijos a `/asignacion`;
  - el webhook de documentos y los crons, que corren fuera de la sesión.
- **Enmienda de** `docs/architecture.md:43` y revisión de `docs/architecture.md:557`.

No entra:

- La pantalla de interruptores en el área del Maestro: QC-278, que depende de QC-166.
- Las plantillas o planes: QC-182, que pasa a ser «conjunto de módulos + precio».
- Suscripción, cobro y bloqueo: QC-187 y QC-183 a QC-192.
- El proveedor de IA por empresa: QC-275.

Fuente de hechos del código (con citas): `progress/modulos-por-empresa.md`.

## Decisiones cerradas (no reabrir)

Decisiones del humano tomadas el 2026-10-13 y escritas en la descripción del issue QC-277 y en
`progress/modulos-por-empresa.md`. Este spec no las abre.

**Enmienda del 2026-10-15 (D13–D16).** Cambia solo el modelo de datos de los interruptores: de una
lista guardada en la fila de la empresa a una tabla de excepciones por empresa con su catálogo.
Los requisitos de comportamiento y D1–D12 no cambian. Detalle técnico en `design.md > 2` y
`> 15`.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| D1 | Módulos **enteros**, no permisos sueltos. «Integraciones» es un solo interruptor: Proveedor IA, Inventarios y WhatsApp; arrastra la lectura de PDF, Contactos y las notificaciones | humano, 2026-10-13 (QC-277) | — | R1, R2, R4 |
| D2 | **Núcleo, no se apaga nunca:** usuarios y grupos, unidades, presentaciones, inventario (lotes, reservas, terminado, herramientas y máquinas), fórmulas, pedidos, asignación y ejecución, empaque, acondicionamiento, terminados, entregas y clientes | humano, 2026-10-13 (QC-277) | — | R1, R3, R32 |
| D3 | **Añadidos:** dashboard y recorrido; proveedores; lectura de PDF con IA; importación desde Excel; integraciones. En el futuro: evidencia por paso (QC-214), notificaciones (QC-137) y proveedores de lo que falta (QC-139) | humano, 2026-10-13 (QC-277) | — | R2 |
| D4 | La lectura de PDF con IA depende de Integraciones > Proveedor IA (QC-275 pasa la key a cada empresa y bloquea la lectura sin proveedor) | humano, 2026-10-13 (`progress/modulos-por-empresa.md`) | — | R4, R22 |
| D5 | **Un añadido apagado desaparece del todo:** sin menú ni botón, y 404 si se entra por URL | humano, 2026-10-13 (QC-277) | — | R12, R13, R14, R15, R16, R17 |
| D6 | **Al apagar, se descarta lo pendiente:** los trabajos en cola no se procesan y las revisiones sin confirmar dejan de verse. Lo ya confirmado se conserva | humano, 2026-10-13 (QC-277) | — | R22, R23, R24 |
| D7 | **Una empresa nueva nace solo con el núcleo** | humano, 2026-10-13 (QC-277) | QC-162 (alta de empresa) | R5 |
| D8 | El permiso efectivo es rol ∩ módulos activos, resuelto en la sesión en cada petición: efecto inmediato | humano, 2026-10-13 (QC-277) | `docs/architecture.md:43`, `:557` | R8, R9, R10, R11, R37 |
| D9 | El Maestro prende y apaga uno a uno o todos a la vez, con `empresas.modificar` | humano, 2026-10-13 (QC-277) | — | R27, R28, R29, R30, R31, R32, R33, R34 |
| D10 | Todos los huecos se cierran: puntos cruzados con permiso de otro módulo, logo y aterrizaje fijos, webhook y crons fuera de sesión | humano, 2026-10-13 (QC-277) | — | R15, R16, R17, R18, R19, R20, R21, R22, R25, R26 |
| D11 | **Validación en el servidor y en el menú.** Lleva E2E | humano, 2026-10-13 (QC-277) | — | R12, R13, R14, R35, R36 |
| D12 | El cron de caducidad de pedidos es **núcleo**: corre para toda empresa activa, sin depender de añadidos | humano, 2026-10-14 (cierra P1) | — | R25, R26 |
| D13 | **El catálogo de añadidos tiene su tabla en la base**, espejo del catálogo del código, sembrada por migración. El código sigue mandando y una guardia comprueba que código y tabla coinciden. Las excepciones por empresa apuntan a esa tabla con FK. Se descarta la variante sin FK | Christian Quevedo, comentarios 10575 y 10576 en QC-277 (2026-10-15); Carlos Restrepo, 2026-10-15 («dale como mejor lo veas») | Modelo de datos aprobado (columna de interruptores en la empresa) | R2, R32 |
| D14 | **Apagar guarda una excepción «apagado»; no borra.** Así, cuando haya planes, se podrá apagar lo que trae el plan. «Apagar todos» deja los cinco apagados en una transacción (R29), con su evento en el historial en esa misma transacción (R33) | Christian Quevedo (10575, 10576) y Carlos Restrepo, 2026-10-15 | ídem | R28, R29, R33 |
| D15 | **El autor de cada excepción apunta al usuario, sin empresa en la referencia:** el Maestro no tiene empresa. La tabla de excepciones es tabla de empresa: lleva su columna de empresa y el control de acceso a filas activado y forzado, como el resto | Christian Quevedo (10575, 10576) y Carlos Restrepo, 2026-10-15 | ídem | R28, R33 |
| D16 | **Solo se construye la tabla de excepciones.** Los planes y su lista de añadidos, y el plan de cada empresa, son de QC-182. Sin planes, los añadidos de una empresa son solo sus excepciones prendidas | Christian Quevedo (10575, 10576) y Carlos Restrepo, 2026-10-15 | ídem | R5, R6, R8 |

## Requisitos (EARS)

Vocabulario de este documento:

- **Añadido:** un módulo apagable de D3. **Interruptor:** lo que el Maestro guarda para un
  añadido de una empresa (prendido o apagado).
- **Añadido activo:** el que tiene el interruptor prendido **y** cumple sus dependencias (R4).
- **Permiso efectivo:** el que el sistema usa para autorizar, mostrar el menú y elegir el
  aterrizaje (R8).

### Catálogo

- **R1** — El sistema DEBE clasificar cada permiso del catálogo en exactamente uno de estos grupos:
  el núcleo o un único añadido. Un permiso sin clasificar o clasificado dos veces es un error que
  se detecta antes de desplegar.
- **R2** — El sistema DEBE reconocer exactamente cinco añadidos, cada uno con los permisos que
  arrastra:
  - **dashboard y recorrido:** `dashboard.consultar`;
  - **proveedores:** `proveedores.consultar` y `proveedores.modificar`;
  - **lectura de PDF con IA:** `documentos.consultar` y `documentos.modificar`;
  - **importación desde Excel:** ningún permiso propio;
  - **integraciones (Proveedor IA, Inventarios y WhatsApp):** `integraciones.modificar`.
- **R3** — El sistema DEBE tratar como núcleo todos los demás permisos del catálogo, y ninguna
  operación DEBE poder apagar un permiso del núcleo.
- **R4** — MIENTRAS el añadido integraciones no esté activo en una empresa, el sistema DEBE tratar
  la lectura de PDF con IA como no activa en esa empresa, aunque su interruptor esté prendido.

### Estado de cada empresa

- **R5** — CUANDO el Maestro da de alta una empresa, el sistema DEBE crearla sin ningún añadido
  prendido.
- **R6** — CUANDO se aplica la migración de esta ficha, el sistema DEBE dejar prendidos los cinco
  añadidos en toda empresa que ya exista (sujeto a P2).
- **R7** — CUANDO el seed crea la empresa inicial fuera de producción, el sistema DEBE crearla con
  los cinco añadidos prendidos (sujeto a P2).

### Permiso efectivo

- **R8** — MIENTRAS un usuario con empresa tenga sesión, el sistema DEBE calcular en cada petición
  su permiso efectivo:
  - son los permisos de su rol, menos los de cada añadido que no esté activo en su empresa;
  - se calcula en la misma lectura de sesión que ya existe, sin ninguna consulta adicional.
- **R9** — CUANDO cambian los añadidos de una empresa, el sistema DEBE aplicar el permiso efectivo
  nuevo desde la siguiente petición de cada usuario de esa empresa, sin cerrar ni volver a iniciar
  su sesión.
- **R10** — SI el usuario no tiene empresa, ENTONCES el sistema DEBE usar los permisos de su rol
  sin recortar.
- **R11** — El sistema NO DEBE conceder a un usuario ningún permiso que su rol no tenga, esté
  activo o no el añadido de ese permiso.

### Menú, pantallas y operaciones

- **R12** — MIENTRAS un añadido no esté activo en la empresa del usuario, el sistema NO DEBE
  incluir en el menú ningún enlace de ese añadido. Un grupo del menú al que no le quede ningún
  enlace NO DEBE aparecer.
- **R13** — CUANDO un usuario pide por URL una pantalla de un añadido que no está activo en su
  empresa, el sistema DEBE responder 404 dentro de la zona privada, igual que sin permiso.
  - Son pantallas de añadido: dashboard y recorrido, proveedores y su detalle, la revisión de una
    importación de fórmula o de catálogo desde PDF, la importación desde Excel y las tres pantallas
    de integraciones.
- **R14** — CUANDO un usuario invoca una operación de un añadido que no está activo en su empresa,
  el sistema DEBE rechazarla:
  - con el mismo error de autorización que daría sin permiso;
  - sin leer ni escribir datos de la empresa.
- **R15** — MIENTRAS la lectura de PDF con IA no esté activa en la empresa del usuario, el sistema
  DEBE comportarse así, aunque el usuario tenga `recetas.modificar` o `proveedores.modificar`:
  - NO DEBE mostrar el botón de subir PDF en Fórmulas ni en el detalle de proveedor;
  - DEBE rechazar la vista previa y la confirmación de una importación de fórmula o de catálogo.
- **R16** — MIENTRAS la importación desde Excel no esté activa en la empresa del usuario, el
  sistema DEBE comportarse así, aunque el usuario tenga `inventario.modificar`:
  - NO DEBE mostrar el botón «Importar» de Inventario;
  - DEBE rechazar la plantilla, los valores reconocidos, la vista previa y la confirmación de la
    importación.
- **R17** — MIENTRAS el añadido dashboard no esté activo en la empresa del usuario, el sistema NO
  DEBE ofrecer «Ver recorrido» en las filas de Asignación.

### Logo y aterrizaje

- **R18** — CUANDO un usuario con sesión pulsa el logo de la barra lateral, el sistema DEBE
  llevarlo al primer enlace de su menú efectivo.
- **R19** — CUANDO un usuario con sesión válida entra al login sin destino de vuelta, el sistema
  DEBE llevarlo al primer enlace de su menú efectivo.
- **R20** — CUANDO un usuario inicia sesión sin destino de vuelta válido, el sistema DEBE
  aterrizarlo en el primer enlace de su menú calculado con el permiso efectivo.
- **R21** — SI al resolver el destino de R18 o R19 la sesión ya no es válida, ENTONCES el sistema
  DEBE llevar al login con la marca de sesión terminada, sin entrar en un bucle de redirecciones.

### Lo que corre fuera de la sesión

- **R22** — CUANDO la cola entrega el trabajo de un PDF de una empresa cuya lectura de PDF con IA
  no está activa, el sistema DEBE terminarlo como fallo definitivo:
  - sin descargar el PDF y sin llamar a la IA;
  - sin pedir a la cola que lo reintente.
- **R23** — MIENTRAS la lectura de PDF con IA no esté activa, una revisión de importación sin
  confirmar NO DEBE poder verse ni confirmarse.
- **R24** — CUANDO se apaga un añadido, el sistema NO DEBE borrar ni modificar ningún dato ya
  confirmado: recetas, proveedores, líneas de catálogo, inventario importado ni conexiones de
  integración.
- **R25** — El proceso diario de caducidad de pedidos DEBE recorrer toda empresa viva, sin
  consultar sus añadidos.
- **R26** — El sistema DEBE clasificar como núcleo o como de un añadido cada ruta del servidor que
  corre sin sesión.
  - Una ruta de añadido DEBE comprobar que el añadido está activo en la empresa del trabajo antes
    de actuar.
  - Una ruta nueva sin clasificar es un error que se detecta antes de desplegar.

### Operación del Maestro

- **R27** — CUANDO el Maestro pide los añadidos de una empresa, viva o de baja, el sistema DEBE
  devolver por cada añadido su interruptor y si está activo. Exige `empresas.consultar`.
- **R28** — CUANDO el Maestro prende o apaga un añadido de una empresa viva, el sistema DEBE
  guardar el interruptor. Exige `empresas.modificar`.
- **R29** — CUANDO el Maestro prende o apaga todos los añadidos de una empresa viva a la vez, el
  sistema DEBE dejar los cinco en ese estado en una sola operación: o cambian todos los que deban
  cambiar, o ninguno.
- **R30** — SI quien pide no tiene el permiso exigido, ENTONCES el sistema DEBE rechazar con
  `unauthorized` sin leer ni escribir. Vale también sin sesión y para cualquier rol de empresa.
- **R31** — SI la empresa no existe, o está de baja y la operación escribe, ENTONCES el sistema
  DEBE rechazar con `company_not_found` sin escribir.
- **R32** — SI la clave pedida no es uno de los cinco añadidos (incluido cualquier nombre del
  núcleo), ENTONCES el sistema DEBE rechazar con `invalid_input` sin escribir.
- **R33** — CUANDO una operación cambia el interruptor de un añadido, el sistema DEBE registrar en
  el historial de la empresa un evento por cada añadido cambiado:
  - con tipo `addon.enabled` o `addon.disabled`, el autor, el instante y la clave del añadido;
  - en la misma transacción que el cambio.
  Un añadido que ya estaba en el estado pedido no genera escritura ni evento.
- **R34** — CUANDO el Maestro lee el historial de una empresa, el sistema DEBE devolver la clave del
  añadido en cada evento de añadido.

### Validación, documentación y migración

- **R35** — El sistema DEBE aplicar el recorte en el servidor y en el menú: en la sesión, en el
  corte de cada pantalla, en cada caso de uso y en cada trabajo fuera de sesión. Ningún componente
  de cliente decide qué añadido está activo.
- **R36** — Un E2E DEBE cubrir una empresa sin añadidos:
  - menú sin dashboard, proveedores ni integraciones, y sin el botón «Importar»;
  - 404 al entrar por URL a una pantalla de cada añadido;
  - aterrizaje y logo en el primer enlace del menú efectivo;
  - al prender los añadidos, todo aparece en la siguiente petición, sin volver a iniciar sesión.
- **R37** — `docs/architecture.md` DEBE decir que el permiso efectivo es rol ∩ añadidos activos,
  resuelto en cada petición:
  - la regla «nada de permisos por empresa más allá de su rol» queda enmendada;
  - la viñeta «los permisos de la sesión son una foto del instante del login» queda sustituida.
- **R38** — La migración de esta ficha DEBE tener un `down.sql` que deshaga exactamente lo que hace.

## Preguntas abiertas

P1 (cron de caducidad de pedidos) se cerró el 2026-10-14 como D12. Las que siguen no bloquean el
spec: cada una lleva el defecto con el que se diseñó, y cambiarlo toca solo lo que se cita. P6 y
P7 nacen con la enmienda del 2026-10-15.

- **P2 — Empresas que ya existen y empresa del seed.** D7 fija la empresa **nueva**, pero no dice
  qué pasa con las que ya existen (en producción, QuimiCloud: QC-162 P5). Si la migración las deja
  solo con el núcleo, en producción pierden dashboard, proveedores, PDF, Excel e integraciones al
  desplegar, y el Maestro no tiene pantalla para prenderlos hasta QC-278. **Defecto:** la migración
  prende los cinco añadidos en las que ya existen (R6), y el seed de desarrollo, preview y E2E crea
  QuimiCloud con los cinco (R7). Cambiarlo toca R6, R7, el sembrado de excepciones de la migración
  y el seed.
- **P3 — Prender la lectura de PDF con integraciones apagada.** D1 dice que integraciones
  «arrastra» la lectura de PDF, pero no dice si el Maestro puede prender la lectura con
  integraciones apagado. **Defecto:** se guarda el interruptor pero no surte efecto hasta que
  integraciones se prenda (R4). Apagar integraciones tampoco toca el interruptor de la lectura: al
  volver a prender integraciones, la lectura vuelve como estaba. La alternativa (rechazar el
  cambio, o apagar en cascada) cambia R4, R28 y R29.
- **P4 — Volver a prender la lectura de PDF.** D6 dice que las revisiones sin confirmar «dejan de
  verse», pero no dice si vuelven al prender otra vez. **Defecto:** no se borra ni se marca nada, así
  que una revisión sin confirmar vuelve a abrirse por su enlace. Los trabajos que llegaron con la
  lectura apagada sí quedan terminados en error y no vuelven (R22). Si deben descartarse para
  siempre, hace falta una escritura en `documentos` al apagar, que esta ficha no tiene.
- **P5 — Evidencia por paso (QC-214).** D3 la lista entre los añadidos «en el futuro», pero QC-214
  ya está en `dev`. Sus operaciones cuelgan de permisos del núcleo (`asignaciones.ejecutar`,
  `empaque.modificar`, `recetas.modificar`). **Defecto:** queda fuera de esta ficha y sigue siendo
  núcleo de hecho hasta que una ficha propia la convierta en el sexto añadido. El catálogo de R2
  está hecho para que eso sea una entrada más y sus guardas.
- **P6 — Cómo lee la sesión los añadidos con la tabla de excepciones (D13–D16).** Christian
  Quevedo (2026-10-15) dice que «la lectura de la sesión la estamos resolviendo aparte», sin ficha
  citada. Esa ficha es desconocida para este spec. R8 pide calcular el permiso efectivo «en la
  misma lectura de sesión que ya existe, sin ninguna consulta adicional». **Defecto:** el lector de
  sesión trae las excepciones prendidas de la empresa como relación de la misma consulta del
  usuario, por la clave primaria de la tabla de excepciones. El lector se sigue invocando una vez
  por petición. Prisma resuelve esa relación con una sentencia SQL más, como ya pasó con las
  sesiones revocadas (QC-23). «Consulta adicional» se mide como entonces: invocaciones del lector,
  no sentencias SQL (`design.md > 3.1`). Si la ficha de Christian cambia la lectura, toca solo
  `session-user-prisma.ts` y su test de integración. Los recortes del dominio no cambian.
- **P7 — Autor de las excepciones sembradas por la migración y por el seed (D15).** R6 y R7 crean
  excepciones sin que nadie las pida, así que no hay autor. **Defecto:** el autor queda vacío en
  esas filas, y vacío significa «lo sembró el sistema». Toda escritura del Maestro lleva su autor
  (R33). La alternativa es buscar un usuario Maestro al migrar, pero puede no existir en una base
  recién creada.
