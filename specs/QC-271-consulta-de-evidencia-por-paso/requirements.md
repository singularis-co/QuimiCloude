# QC-271 — consulta-de-evidencia-por-paso · requirements.md

> **Zona:** fullstack · **Complejidad:** medium · **depends_on:** QC-214 · **Rama:** `feature/QC-271-consulta-de-evidencia-por-paso`
>
> **Alcance.** Ver, en solo lectura, las fotos de evidencia por paso que se subieron al ejecutar un
> pedido (QC-214), en dos lugares:
> - **Recorrido de ejecución del dashboard** (`/dashboard/recorrido/[id]`, QC-167): las fotos de
>   fabricación junto a su «Paso N» en la línea de tiempo; las de envasado en un bloque «Envasado»
>   aparte, agrupadas por paso.
> - **Ficha de producto terminado** (QC-225): en cada lote que tiene pedido de origen, las fotos de
>   ese pedido, agrupadas por fase (fabricación / envasado) y por paso. Solo las ve quien tiene
>   `pedidos.consultar` (hoy, el Administrador); el resto de quienes ven la ficha no las ve.
>
> **Lo que NO entra.**
> - Subir, cambiar o quitar fotos: sigue en la ejecución y el empaque (QC-214).
> - Una página de detalle del pedido o una opción «Ver evidencia» en /pedidos: QC-35 descartó la
>   página de detalle y se decidió no abrir otra entrada. Sin ficha.
> - Que el empaque anote sus cambios de paso en el registro de ejecución: descartado; el envasado
>   se muestra en su bloque. Sin ficha.
> - Abrir la evidencia a otros roles o crear un permiso nuevo: descartado. Sin ficha.
> - Limpieza de fotos de pedidos cancelados o de subidas huérfanas: queda «aparte» como dejó
>   QC-214 (`specs/QC-214-evidencia-por-paso/design.md:387-388`), sin ficha.
>
> Sembrado por `/afinar-feature` el 2026-10-14. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

Las etiquetas entre corchetes remiten a las filas de `## Decisiones cerradas (no reabrir)` por su
tema: [Dónde], [Quién], [Envasado], [Fórmula editada], [Lectura], [Cancelado], [Estados], [E2E],
[Identificadores], [Diseño], [Repetido], [Tarjeta Envasado], [Lotes], [Fijada], [Estados de las
fotos]. La tabla de cobertura está al final de esta sección.

### Glosario

- **Foto guardada**: una fila de evidencia por paso de un pedido (QC-214), de la empresa del actor,
  con su fase, su número de paso y su casilla.
- **Fase**: fabricación (los pasos de la fórmula) o envasado (los pasos de envasado).
- **Número de paso**: el número de paso guardado con la foto al subirla (1, 2, …). No es la posición
  que ese paso tenga hoy en la fórmula.
- **Grupo de paso**: las fotos guardadas de un pedido con la misma fase y el mismo número de paso.
- **Anotación**: una entrada del registro de ejecución del pedido que el recorrido ya muestra
  (QC-167), con número de paso o sin él.
- **Recorrido**: la pantalla `/dashboard/recorrido/[id]` (QC-167).
- **Ficha**: la ficha de producto terminado (QC-225); **Lotes** es su pestaña de lotes.
- **Pedido de origen de un lote**: el definido en QC-225 (el pedido del asiento `production` del lote).
- **Lectura firmada**: una URL de lectura de 15 minutos sobre el bucket privado de evidencia
  (QC-106/QC-214).
- **Modo consulta**: la forma de pintar fotos de estas dos pantallas, solo para ver (R20, R21).

### Acceso y ámbito de empresa

- **R1** [Quién] CUANDO el recorrido pide las fotos de un pedido, el sistema DEBE exigir
  `dashboard.consultar` antes de validar la entrada y de leer nada. SI el actor no lo tiene,
  ENTONCES DEBE responder `unauthorized` sin listar ni firmar ninguna foto.
- **R2** [Quién] CUANDO la ficha pide el conteo de fotos de los pedidos de sus lotes o las fotos de
  un pedido, el sistema DEBE exigir `pedidos.consultar` antes de validar la entrada y de leer nada.
  SI el actor no lo tiene, ENTONCES DEBE responder `unauthorized` sin contar, listar ni firmar
  ninguna foto, aunque tenga `inventario.consultar`.
- **R3** [Quién] El servidor DEBE decidir el acceso a las fotos por el permiso y nunca por el rol: un
  actor con el permiso exigido y un rol cualquiera DEBE ser aceptado, y un Administrador sin ese
  permiso en su conjunto DEBE ser rechazado.
- **R4** [Quién, Lotes] SI quien ve la ficha no tiene `pedidos.consultar`, ENTONCES Lotes NO DEBE
  pintar la columna «Evidencia» ni ningún control o texto de fotos, NO DEBE pedir el conteo y el
  resto de la ficha DEBE pintarse igual que hoy. SI la consulta del conteo falla, ENTONCES Lotes
  DEBE pintarse igual que hoy, sin la columna «Evidencia». *(Ver P2.)*
- **R5** [Quién] SI el pedido cuyas fotos se piden no tiene forma de uuid, no existe o es de otra
  empresa, ENTONCES la lectura (del recorrido y de la ficha) DEBE responder `order_not_found`, igual
  en los tres casos, sin listar ni firmar ninguna foto.
- **R6** [Quién] La consulta del conteo DEBE aceptar una lista de hasta 25 identificadores de pedido
  con forma de uuid. SI la lista no cumple eso, ENTONCES DEBE responder `invalid_input`. Un pedido
  inexistente o de otra empresa NO DEBE aportar ninguna foto al conteo.

### Qué fotos se leen

- **R7** [Fórmula editada] La lectura de las fotos de un pedido DEBE devolver todas sus fotos
  guardadas de las dos fases, agrupadas por fase y número de paso, sin filtrar por la lista actual
  de pasos de la fórmula ni por si ese paso pide hoy evidencia. Un paso que hoy no existe o ya no
  pide foto DEBE seguir saliendo con sus fotos.
- **R8** [Fórmula editada] Cada grupo de paso DEBE rotularse con su número de paso guardado («Paso
  N») y nunca con la posición actual. Los grupos DEBEN ordenarse por número de paso ascendente y las
  fotos de cada grupo por su casilla.
- **R9** [Cancelado, Fijada] MIENTRAS el pedido esté cancelado o dado de baja, la lectura DEBE
  devolver sus fotos igual que las de un pedido vigente, y la pantalla NO DEBE añadir ninguna marca
  propia de las fotos para ese caso: el estado se reconoce por el badge que la pantalla ya tiene.
- **R10** [Lectura] Cada foto devuelta DEBE llevar una lectura firmada de 15 minutos. La ruta interna
  del archivo en el bucket NO DEBE salir en la respuesta. SI el pedido no tiene fotos, ENTONCES la
  lectura NO DEBE firmar nada.
- **R11** [Lectura, Estados de las fotos] SI la firma de las lecturas falla, ENTONCES la lectura NO
  DEBE fallar entera: DEBE devolver cada grupo de paso con su fase, su número y su cantidad de fotos,
  sin URL y marcado como no disponible.

### Recorrido

- **R12** [Repetido, Dónde] Las fotos de fabricación del paso N DEBEN pintarse bajo la ÚLTIMA
  anotación del recorrido cuyo número de paso es N, y bajo ninguna otra anotación.
- **R13** [Repetido] SI hay fotos de fabricación del paso N y ninguna anotación tiene el número N,
  ENTONCES DEBEN pintarse en un bloque «Otros pasos con fotos» al final de Anotaciones, rotuladas
  «Paso N». SI no hay ningún paso así, ENTONCES el bloque NO DEBE pintarse.
- **R14** [Envasado, Tarjeta Envasado] MIENTRAS el pedido tenga fotos de envasado, el recorrido DEBE
  mostrar una tarjeta «Envasado» después de Anotaciones, con el total de fotos de envasado y una
  fila por paso rotulada «Paso N», seguida de « · <nombre>» solo si el paso tiene un nombre conocido
  *(ver P1)*. SI no tiene fotos de envasado, ENTONCES la tarjeta NO DEBE pintarse. Ninguna foto de
  envasado DEBE pintarse bajo una anotación.
- **R15** [Envasado, Dónde] La lectura de las fotos NO DEBE cambiar las anotaciones, su número, el
  estado, la duración ni las vueltas atrás del recorrido. SI la lectura de las fotos falla entera,
  ENTONCES el recorrido DEBE pintarse completo y mostrar un único aviso «No se pudieron cargar las
  fotos.» con «Reintentar» al final de Anotaciones.

### Ficha de producto terminado

- **R16** [Lotes] MIENTRAS el actor tenga `pedidos.consultar`, Lotes DEBE mostrar una columna
  «Evidencia» al final. En un lote con pedido de origen que tiene al menos una foto, la celda DEBE ser
  un botón con icono de cámara y el total de fotos del pedido, de las dos fases («1 foto», «N
  fotos»). En un lote sin pedido de origen, o cuyo pedido no tiene fotos, la celda DEBE mostrar «—».
- **R17** [Lotes] CUANDO el usuario pulsa el botón de un lote, el sistema DEBE abrir un diálogo
  titulado «Evidencia · Lote <lote> · Pedido <número>» con un grupo «Fabricación» y un grupo
  «Envasado», cada uno con su total de fotos y una fila por paso rotulada como en R14. Un grupo sin
  fotos NO DEBE pintarse.
- **R18** [Lotes] MIENTRAS la ventana tenga ancho de teléfono, el diálogo DEBE ocupar la pantalla, y
  la tabla de Lotes DEBE seguir con desplazamiento horizontal, como en QC-225.
- **R19** [Lotes] El conteo y las fotos DEBEN ser los del pedido de origen: dos lotes con el mismo
  pedido de origen DEBEN mostrar el mismo total y las mismas fotos.

### Cómo se pintan las fotos

- **R20** [Lectura, Estados de las fotos] Cada grupo de paso DEBE pintarse con la pieza de evidencia
  por paso en modo consulta: cuadrícula de hasta 3 casillas, contador «n/3» y, al pulsar una foto,
  el visor ampliado de esa pieza con el rótulo «Foto <n> del paso <N>» y «Cerrar». NO DEBE ofrecer
  añadir, cambiar ni quitar fotos.
- **R21** [Fijada] En modo consulta NO DEBEN mostrarse «Fijada al terminar» ni «Obligatoria · de 1 a
  3 fotos» ni los textos de ayuda de la pieza. En la ejecución y en el empaque (QC-214) la pieza DEBE
  seguir pintándose como hoy.
- **R22** [Estados, Estados de las fotos] MIENTRAS una foto o la lectura del diálogo carga, su
  casilla DEBE mostrarse como miniatura esqueleto, con el texto «Cargando fotos…» para lectores de
  pantalla.
- **R23** [Estados, Estados de las fotos] SI no se pueden mostrar las fotos de un grupo (R11) o la
  lectura del diálogo falla, ENTONCES en su lugar DEBE mostrarse el aviso en línea «No se pudieron
  cargar las fotos.» con un botón «Reintentar». CUANDO el usuario pulsa «Reintentar», el sistema DEBE
  repetir la lectura.
- **R24** [Estados de las fotos, Lectura] SI una miniatura no carga desde su lectura firmada (por
  ejemplo, porque venció), ENTONCES su casilla DEBE mostrar «Vista vencida» con un botón «Recargar».
  CUANDO el usuario pulsa «Recargar», el sistema DEBE pedir lecturas firmadas nuevas y volver a
  pintar las fotos.
- **R25** [Estados] Un pedido o un paso sin fotos NO DEBE dejar hueco: ni bloque, ni encabezado, ni
  aviso de vacío. Una anotación sin fotos DEBE pintarse como hoy.
- **R26** [Dónde, Diseño] Ni el recorrido ni la ficha DEBEN ofrecer subir, cambiar ni quitar fotos, y
  ningún archivo de sus rutas DEBE importar una Server Action de escritura de evidencia.

### E2E, datos y dependencias

- **R27** [E2E] Un recorrido E2E DEBE, con el Administrador: abrir el recorrido de un pedido con fotos
  de fabricación y de envasado y ver las de fabricación bajo la última anotación de su paso y las de
  envasado en la tarjeta «Envasado»; después, abrir la ficha del producto terminado de ese pedido,
  ver en Lotes el total de fotos y abrir el diálogo con los grupos «Fabricación» y «Envasado».
- **R28** [E2E, Quién] Otro caso E2E DEBE comprobar que el Operador abre la misma ficha, ve Lotes y
  no ve la columna «Evidencia» ni ninguna foto.
- **R29** [E2E, Quién] Un test DEBE comprobar el rechazo entre empresas: con un actor de la empresa
  A, pedir las fotos de un pedido de la empresa B responde `order_not_found` sin firmar nada, y su
  conteo no aporta ninguna foto.
- **R30** [Identificadores, Quién] La feature NO DEBE crear tablas, columnas, valores de enum,
  migraciones ni permisos; NO DEBE escribir en ninguna tabla ni en el bucket; NO DEBE añadir
  dependencias a `package.json`. Los identificadores nuevos de código DEBEN estar en inglés.

### Cobertura de las decisiones cerradas

| Decisión (tema) | Requisitos |
|---|---|
| ¿Dónde se ven las fotos? [Dónde] | R12, R15, R16, R26 |
| ¿Quién las ve? [Quién] | R1, R2, R3, R4, R5, R6, R28, R29, R30 |
| ¿Cómo entran las fotos de envasado? [Envasado] | R14, R15 |
| Fórmula editada después [Fórmula editada] | R7, R8 |
| ¿Cómo se leen? [Lectura] | R10, R11, R20, R24 |
| Pedido dado de baja o cancelado [Cancelado] | R9 |
| Estados de la vista [Estados] | R22, R23, R25 |
| ¿Hace falta E2E? [E2E] | R27, R28, R29 |
| Identificadores [Identificadores] | R30 |
| Pase `/design` [Diseño] | R26; el resto de la UI (R12–R25) se implementa contra los tableros que cita `design.md` |
| Paso repetido en el recorrido [Repetido] | R12, R13 |
| Recorrido, envasado [Tarjeta Envasado] | R14 |
| Ficha, pestaña Lotes [Lotes] | R4, R16, R17, R18, R19 |
| «Fijada al terminar» [Fijada] | R9, R21 |
| Estados de las fotos [Estados de las fotos] | R11, R20, R22, R23, R24 |

## Preguntas abiertas

Ninguna. La P1 del pase `/design` y las P1/P2 de F1.2 se cerraron el 2026-10-14 (ver `## Decisiones cerradas`).

## Decisiones cerradas (no reabrir)` por su
tema: [Dónde], [Quién], [Envasado], [Fórmula editada], [Lectura], [Cancelado], [Estados], [E2E],
[Identificadores], [Diseño], [Repetido], [Tarjeta Envasado], [Lotes], [Fijada], [Estados de las
fotos]. La tabla de cobertura está al final de esta sección.

### Glosario

- **Foto guardada**: una fila de evidencia por paso de un pedido (QC-214), de la empresa del actor,
  con su fase, su número de paso y su casilla.
- **Fase**: fabricación (los pasos de la fórmula) o envasado (los pasos de envasado).
- **Número de paso**: el número de paso guardado con la foto al subirla (1, 2, …). No es la posición
  que ese paso tenga hoy en la fórmula.
- **Grupo de paso**: las fotos guardadas de un pedido con la misma fase y el mismo número de paso.
- **Anotación**: una entrada del registro de ejecución del pedido que el recorrido ya muestra
  (QC-167), con número de paso o sin él.
- **Recorrido**: la pantalla `/dashboard/recorrido/[id]` (QC-167).
- **Ficha**: la ficha de producto terminado (QC-225); **Lotes** es su pestaña de lotes.
- **Pedido de origen de un lote**: el definido en QC-225 (el pedido del asiento `production` del lote).
- **Lectura firmada**: una URL de lectura de 15 minutos sobre el bucket privado de evidencia
  (QC-106/QC-214).
- **Modo consulta**: la forma de pintar fotos de estas dos pantallas, solo para ver (R20, R21).

### Acceso y ámbito de empresa

- **R1** [Quién] CUANDO el recorrido pide las fotos de un pedido, el sistema DEBE exigir
  `dashboard.consultar` antes de validar la entrada y de leer nada. SI el actor no lo tiene,
  ENTONCES DEBE responder `unauthorized` sin listar ni firmar ninguna foto.
- **R2** [Quién] CUANDO la ficha pide el conteo de fotos de los pedidos de sus lotes o las fotos de
  un pedido, el sistema DEBE exigir `pedidos.consultar` antes de validar la entrada y de leer nada.
  SI el actor no lo tiene, ENTONCES DEBE responder `unauthorized` sin contar, listar ni firmar
  ninguna foto, aunque tenga `inventario.consultar`.
- **R3** [Quién] El servidor DEBE decidir el acceso a las fotos por el permiso y nunca por el rol: un
  actor con el permiso exigido y un rol cualquiera DEBE ser aceptado, y un Administrador sin ese
  permiso en su conjunto DEBE ser rechazado.
- **R4** [Quién, Lotes] SI quien ve la ficha no tiene `pedidos.consultar`, ENTONCES Lotes NO DEBE
  pintar la columna «Evidencia» ni ningún control o texto de fotos, NO DEBE pedir el conteo y el
  resto de la ficha DEBE pintarse igual que hoy. SI la consulta del conteo falla, ENTONCES Lotes
  DEBE pintarse igual que hoy, sin la columna «Evidencia». *(Ver P2.)*
- **R5** [Quién] SI el pedido cuyas fotos se piden no tiene forma de uuid, no existe o es de otra
  empresa, ENTONCES la lectura (del recorrido y de la ficha) DEBE responder `order_not_found`, igual
  en los tres casos, sin listar ni firmar ninguna foto.
- **R6** [Quién] La consulta del conteo DEBE aceptar una lista de hasta 25 identificadores de pedido
  con forma de uuid. SI la lista no cumple eso, ENTONCES DEBE responder `invalid_input`. Un pedido
  inexistente o de otra empresa NO DEBE aportar ninguna foto al conteo.

### Qué fotos se leen

- **R7** [Fórmula editada] La lectura de las fotos de un pedido DEBE devolver todas sus fotos
  guardadas de las dos fases, agrupadas por fase y número de paso, sin filtrar por la lista actual
  de pasos de la fórmula ni por si ese paso pide hoy evidencia. Un paso que hoy no existe o ya no
  pide foto DEBE seguir saliendo con sus fotos.
- **R8** [Fórmula editada] Cada grupo de paso DEBE rotularse con su número de paso guardado («Paso
  N») y nunca con la posición actual. Los grupos DEBEN ordenarse por número de paso ascendente y las
  fotos de cada grupo por su casilla.
- **R9** [Cancelado, Fijada] MIENTRAS el pedido esté cancelado o dado de baja, la lectura DEBE
  devolver sus fotos igual que las de un pedido vigente, y la pantalla NO DEBE añadir ninguna marca
  propia de las fotos para ese caso: el estado se reconoce por el badge que la pantalla ya tiene.
- **R10** [Lectura] Cada foto devuelta DEBE llevar una lectura firmada de 15 minutos. La ruta interna
  del archivo en el bucket NO DEBE salir en la respuesta. SI el pedido no tiene fotos, ENTONCES la
  lectura NO DEBE firmar nada.
- **R11** [Lectura, Estados de las fotos] SI la firma de las lecturas falla, ENTONCES la lectura NO
  DEBE fallar entera: DEBE devolver cada grupo de paso con su fase, su número y su cantidad de fotos,
  sin URL y marcado como no disponible.

### Recorrido

- **R12** [Repetido, Dónde] Las fotos de fabricación del paso N DEBEN pintarse bajo la ÚLTIMA
  anotación del recorrido cuyo número de paso es N, y bajo ninguna otra anotación.
- **R13** [Repetido] SI hay fotos de fabricación del paso N y ninguna anotación tiene el número N,
  ENTONCES DEBEN pintarse en un bloque «Otros pasos con fotos» al final de Anotaciones, rotuladas
  «Paso N». SI no hay ningún paso así, ENTONCES el bloque NO DEBE pintarse.
- **R14** [Envasado, Tarjeta Envasado] MIENTRAS el pedido tenga fotos de envasado, el recorrido DEBE
  mostrar una tarjeta «Envasado» después de Anotaciones, con el total de fotos de envasado y una
  fila por paso rotulada «Paso N», seguida de « · <nombre>» solo si el paso tiene un nombre conocido
  *(ver P1)*. SI no tiene fotos de envasado, ENTONCES la tarjeta NO DEBE pintarse. Ninguna foto de
  envasado DEBE pintarse bajo una anotación.
- **R15** [Envasado, Dónde] La lectura de las fotos NO DEBE cambiar las anotaciones, su número, el
  estado, la duración ni las vueltas atrás del recorrido. SI la lectura de las fotos falla entera,
  ENTONCES el recorrido DEBE pintarse completo y mostrar un único aviso «No se pudieron cargar las
  fotos.» con «Reintentar» al final de Anotaciones.

### Ficha de producto terminado

- **R16** [Lotes] MIENTRAS el actor tenga `pedidos.consultar`, Lotes DEBE mostrar una columna
  «Evidencia» al final. En un lote con pedido de origen que tiene al menos una foto, la celda DEBE ser
  un botón con icono de cámara y el total de fotos del pedido, de las dos fases («1 foto», «N
  fotos»). En un lote sin pedido de origen, o cuyo pedido no tiene fotos, la celda DEBE mostrar «—».
- **R17** [Lotes] CUANDO el usuario pulsa el botón de un lote, el sistema DEBE abrir un diálogo
  titulado «Evidencia · Lote <lote> · Pedido <número>» con un grupo «Fabricación» y un grupo
  «Envasado», cada uno con su total de fotos y una fila por paso rotulada como en R14. Un grupo sin
  fotos NO DEBE pintarse.
- **R18** [Lotes] MIENTRAS la ventana tenga ancho de teléfono, el diálogo DEBE ocupar la pantalla, y
  la tabla de Lotes DEBE seguir con desplazamiento horizontal, como en QC-225.
- **R19** [Lotes] El conteo y las fotos DEBEN ser los del pedido de origen: dos lotes con el mismo
  pedido de origen DEBEN mostrar el mismo total y las mismas fotos.

### Cómo se pintan las fotos

- **R20** [Lectura, Estados de las fotos] Cada grupo de paso DEBE pintarse con la pieza de evidencia
  por paso en modo consulta: cuadrícula de hasta 3 casillas, contador «n/3» y, al pulsar una foto,
  el visor ampliado de esa pieza con el rótulo «Foto <n> del paso <N>» y «Cerrar». NO DEBE ofrecer
  añadir, cambiar ni quitar fotos.
- **R21** [Fijada] En modo consulta NO DEBEN mostrarse «Fijada al terminar» ni «Obligatoria · de 1 a
  3 fotos» ni los textos de ayuda de la pieza. En la ejecución y en el empaque (QC-214) la pieza DEBE
  seguir pintándose como hoy.
- **R22** [Estados, Estados de las fotos] MIENTRAS una foto o la lectura del diálogo carga, su
  casilla DEBE mostrarse como miniatura esqueleto, con el texto «Cargando fotos…» para lectores de
  pantalla.
- **R23** [Estados, Estados de las fotos] SI no se pueden mostrar las fotos de un grupo (R11) o la
  lectura del diálogo falla, ENTONCES en su lugar DEBE mostrarse el aviso en línea «No se pudieron
  cargar las fotos.» con un botón «Reintentar». CUANDO el usuario pulsa «Reintentar», el sistema DEBE
  repetir la lectura.
- **R24** [Estados de las fotos, Lectura] SI una miniatura no carga desde su lectura firmada (por
  ejemplo, porque venció), ENTONCES su casilla DEBE mostrar «Vista vencida» con un botón «Recargar».
  CUANDO el usuario pulsa «Recargar», el sistema DEBE pedir lecturas firmadas nuevas y volver a
  pintar las fotos.
- **R25** [Estados] Un pedido o un paso sin fotos NO DEBE dejar hueco: ni bloque, ni encabezado, ni
  aviso de vacío. Una anotación sin fotos DEBE pintarse como hoy.
- **R26** [Dónde, Diseño] Ni el recorrido ni la ficha DEBEN ofrecer subir, cambiar ni quitar fotos, y
  ningún archivo de sus rutas DEBE importar una Server Action de escritura de evidencia.

### E2E, datos y dependencias

- **R27** [E2E] Un recorrido E2E DEBE, con el Administrador: abrir el recorrido de un pedido con fotos
  de fabricación y de envasado y ver las de fabricación bajo la última anotación de su paso y las de
  envasado en la tarjeta «Envasado»; después, abrir la ficha del producto terminado de ese pedido,
  ver en Lotes el total de fotos y abrir el diálogo con los grupos «Fabricación» y «Envasado».
- **R28** [E2E, Quién] Otro caso E2E DEBE comprobar que el Operador abre la misma ficha, ve Lotes y
  no ve la columna «Evidencia» ni ninguna foto.
- **R29** [E2E, Quién] Un test DEBE comprobar el rechazo entre empresas: con un actor de la empresa
  A, pedir las fotos de un pedido de la empresa B responde `order_not_found` sin firmar nada, y su
  conteo no aporta ninguna foto.
- **R30** [Identificadores, Quién] La feature NO DEBE crear tablas, columnas, valores de enum,
  migraciones ni permisos; NO DEBE escribir en ninguna tabla ni en el bucket; NO DEBE añadir
  dependencias a `package.json`. Los identificadores nuevos de código DEBEN estar en inglés.

### Cobertura de las decisiones cerradas

| Decisión (tema) | Requisitos |
|---|---|
| ¿Dónde se ven las fotos? [Dónde] | R12, R15, R16, R26 |
| ¿Quién las ve? [Quién] | R1, R2, R3, R4, R5, R6, R28, R29, R30 |
| ¿Cómo entran las fotos de envasado? [Envasado] | R14, R15 |
| Fórmula editada después [Fórmula editada] | R7, R8 |
| ¿Cómo se leen? [Lectura] | R10, R11, R20, R24 |
| Pedido dado de baja o cancelado [Cancelado] | R9 |
| Estados de la vista [Estados] | R22, R23, R25 |
| ¿Hace falta E2E? [E2E] | R27, R28, R29 |
| Identificadores [Identificadores] | R30 |
| Pase `/design` [Diseño] | R26; el resto de la UI (R12–R25) se implementa contra los tableros que cita `design.md` |
| Paso repetido en el recorrido [Repetido] | R12, R13 |
| Recorrido, envasado [Tarjeta Envasado] | R14 |
| Ficha, pestaña Lotes [Lotes] | R4, R16, R17, R18, R19 |
| «Fijada al terminar» [Fijada] | R9, R21 |
| Estados de las fotos [Estados de las fotos] | R11, R20, R22, R23, R24 |

## Preguntas abiertas

P1 (falta el pase `/design`) se cerró el 2026-10-14: tableros aprobados por el humano y copiados a
`docs/diseno/canvas/` (ver `## Decisiones cerradas`). Las dos de abajo son nuevas (2026-10-14). No
bloquean: los requisitos ya llevan la propuesta y se cambian si el humano dice otra cosa.

- **P1 — ¿Qué es el «nombre» de un paso de envasado?** La decisión cerrada dice «Paso N · <nombre>
  (el nombre solo si se conoce)» y el tablero pinta «Envasar en bidón 20 L». Pero un paso de
  envasado no tiene nombre en el modelo: es un documento de bloques (párrafos y listas) con
  `requiresEvidence` (`lib/modules/recetas/domain/recipe-input.ts:179`). **Propuesta:** con el
  modelo de hoy el nombre nunca se conoce, así que la fila se rotula solo «Paso N». No se deriva un
  nombre del primer párrafo, porque eso sería inventar un dato (y el paso puede haber cambiado
  después de tomar la foto, ver [Fórmula editada]). Si el humano quiere el nombre, hay que decir de
  dónde sale.
- **P2 — ¿Qué pinta Lotes si falla el conteo de fotos?** Ni la decisión ni el tablero cubren ese
  caso. **Propuesta (R4):** Lotes se pinta igual que hoy, sin la columna «Evidencia». Pintar «—»
  diría «este pedido no tiene fotos», que sería falso. Es el mismo criterio que QC-225 aprobó para
  los enlaces de /pedidos (su R29).

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-14 | ¿Dónde se ven las fotos fuera de la ejecución? | En el recorrido de ejecución del dashboard (QC-167) y en la ficha de producto terminado (QC-225), en cada lote con pedido de origen. No hay página de detalle del pedido (QC-35) ni entrada nueva en /pedidos. |
| 2026-10-14 | ¿Quién las ve? | Solo el Administrador. Recorrido: `dashboard.consultar` (heredado de QC-167). Ficha: la ficha sigue con `inventario.consultar` (QC-225), pero las fotos solo se leen y se muestran con `pedidos.consultar`; sin ese permiso no se devuelven ni se firman. Sin permiso nuevo. Se valida en el service. |
| 2026-10-14 | ¿Cómo entran las fotos de envasado en el recorrido? | Bloque «Envasado» aparte, agrupado por paso. El empaque no anota cambios de paso (QC-82, QC-214 P4) y no se toca. |
| 2026-10-14 | Si la fórmula se edita después de terminar el pedido (se reordena o se apaga la evidencia de un paso), ¿qué se muestra? | Todas las fotos guardadas, rotuladas por su número de paso («Paso 3»), aunque hoy ese paso sea otro o ya no pida foto. Nunca se esconde evidencia. Cierra P5/P7 de QC-214 para estas pantallas. |
| 2026-10-14 | ¿Cómo se leen las fotos? | URL firmada de lectura de 15 min sobre el bucket privado de QC-214 (heredado de QC-106/QC-214). Se reutiliza la pieza `components/shared/step-evidence` en modo solo lectura (R24 de QC-214), con su visor ampliado. |
| 2026-10-14 | ¿Pedido dado de baja o cancelado? | Sus fotos se muestran igual: la evidencia no se borra al cancelar (QC-214 R38) y el recorrido de un pedido dado de baja se abre marcado (QC-167 D12). |
| 2026-10-14 | Estados de la vista | Vacío, cargando y error como en QC-35/QC-102/QC-174. Un pedido o paso sin fotos no muestra hueco. |
| 2026-10-14 | ¿Hace falta E2E? | Sí, porque toca permisos (`docs/checkpoints-proyecto.md`): el Administrador ve las fotos en el recorrido y en la ficha; el Operador abre la ficha y no ve fotos. Más el test de rechazo entre empresas. |
| 2026-10-14 | Identificadores | En inglés (heredado de QC-82, QC-214). |
| 2026-10-14 | Pase `/design` (P1) | Aprobado. Tableros: `docs/diseno/canvas/RecorridoEvidencia.dc.html` (+`Tablet`, +`Movil`) y `docs/diseno/canvas/ProductoTerminadoEvidencia.dc.html` (+`Tablet`, +`Movil`). Canvas vivo: https://claude.ai/artifact/9idfocrGmuPeDeGWbRJaUZ. |
| 2026-10-14 | Recorrido, fabricación: ¿junto a qué anotación van las fotos de un paso repetido? | Bajo la ÚLTIMA anotación con ese número de paso. Las fotos de un paso sin ninguna anotación con su número van en un bloque «Otros pasos con fotos» al final, rotuladas «Paso N». |
| 2026-10-14 | Recorrido, envasado | Tarjeta «Envasado» después de las anotaciones, una fila por paso «Paso N · <nombre>» (el nombre solo si se conoce). Sin fotos de envasado, la tarjeta no aparece. |
| 2026-10-14 | Ficha, pestaña Lotes | Columna «Evidencia» al final, solo para quien tiene `pedidos.consultar`: botón con cámara y conteo total (fabricación + envasado, «6 fotos»); «—» en lotes sin fotos o sin pedido. Abre un diálogo «Evidencia · Lote <n> · Pedido <n>» con grupos Fabricación y Envasado (un grupo vacío no se pinta); en teléfono ocupa la pantalla. Sin el permiso, la columna no se pinta. La tabla en teléfono sigue con desplazamiento horizontal (QC-225). |
| 2026-10-14 | Texto «Fijada al terminar» de `StepEvidence` | No se muestra en consulta. Un pedido cancelado o dado de baja se reconoce por el badge de estado que ya tiene la pantalla. |
| 2026-10-14 | Estados de las fotos | Cargando: miniaturas esqueleto. Error de lectura: aviso en línea «No se pudieron cargar las fotos.» con «Reintentar». URL firmada vencida: la miniatura muestra «Vista vencida · Recargar». Sin fotos: no se pinta nada. El visor ampliado es el de `EvidenciaPaso` (sin animación nueva ni librería nueva). |
| 2026-10-14 | Spec (F1.4) | Aprobado por el humano junto con las dos propuestas de F1.2. |
| 2026-10-14 | ¿Qué es el «nombre» de un paso de envasado? (P1 de F1.2) | Con el modelo de hoy un paso no tiene nombre: la fila se rotula solo «Paso N». No se deriva un nombre del primer párrafo. |
| 2026-10-14 | ¿Qué pinta Lotes si falla el conteo de fotos? (P2 de F1.2) | Lotes se pinta igual que hoy, sin la columna «Evidencia» (R4); nunca «—», que diría que no hay fotos. Mismo criterio que QC-225 R29. |
