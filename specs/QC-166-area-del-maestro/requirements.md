# QC-166 — area-del-maestro · requirements.md

> **Zona:** frontend · **Complejidad:** sin evaluar · **depends_on:** QC-162, QC-165, QC-235 · **Rama:** `feature/QC-166-area-del-maestro`
>
> **Alcance.** Área propia del Maestro, separada del ERP, con su barra lateral («Plataforma»).
> EMPRESAS: lista, alta con su Administrador inicial, edición con País, baja con impacto y
> reactivación. Detalle de empresa con pestañas Datos, Módulos (la llena QC-278) e Historial.
> ADMINISTRADORES: lista de todas las empresas, alta eligiendo empresa, edición y baja. El Maestro
> aterriza aquí al iniciar sesión.
>
> **Lo que NO entra.** El servidor de Administradores (QC-165). El contenido de la pestaña Módulos
> (QC-278). Planes y cobro (QC-182 y
> siguientes).
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

Vocabulario de este archivo:

- «Área del Maestro»: las pantallas `/maestro/empresas`, `/maestro/empresas/[id]` y
  `/maestro/administradores`.
- «El Maestro»: una sesión con los permisos exactos del rol Maestro (`empresas.consultar` y
  `empresas.modificar`, sin empresa).
- «Empresa activa» / «de baja»: las de QC-162 (estado `active` / `deleted`).
- «Refrescar»: volver a pedir al servidor los datos de la pantalla, sin que la persona recargue.
- Los textos entre comillas latinas son los del tablero aprobado; los que no están en el tablero
  se marcan con su pregunta abierta.

### Acceso y navegación

- **R1.** CUANDO una sesión sin `empresas.consultar` pida cualquier pantalla del área del
  Maestro, el sistema DEBE responder el 404 de la zona privada, sin ningún dato de empresas ni de
  Administradores. SI no hay sesión, ENTONCES DEBE llevar al login.
- **R2.** MIENTRAS la sesión tenga `empresas.consultar`, la barra lateral DEBE mostrar la sección
  «Plataforma» con los enlaces «Empresas» (a `/maestro/empresas`) y «Administradores» (a
  `/maestro/administradores`), en ese orden. SI la sesión no tiene ese permiso, ENTONCES el HTML
  servido NO DEBE contener esa sección ni sus enlaces.
- **R3.** CUANDO se arma la barra lateral con los permisos del Maestro, el resultado DEBE ser
  exactamente la sección «Plataforma» con sus dos enlaces: ningún enlace ni sección del ERP.
- **R4.** CUANDO el Maestro inicie sesión sin un destino de vuelta válido, pulse el logo de la
  barra lateral o pida `/inicio`, el sistema DEBE llevarlo a `/maestro/empresas`.
- **R5.** El destino de aterrizaje de cualquier sesión sin `empresas.consultar` NO DEBE cambiar
  respecto del que tenía antes de esta ficha.
- **R6.** MIENTRAS la sesión tenga `empresas.consultar` pero no `empresas.modificar`, el área del
  Maestro DEBE mostrar listas, detalle e historial y NO DEBE mostrar ningún disparador de
  escritura («Nueva empresa», «Editar», «Dar de baja», «Reactivar», «Nuevo administrador»).
- **R7.** SI el servidor rechaza una operación del área con `unauthorized`, ENTONCES la pantalla
  DEBE mostrar el mensaje del catálogo de errores en el panel o diálogo abierto, sin cerrarlo.

### Lista de empresas

- **R8.** CUANDO el Maestro abra `/maestro/empresas`, el sistema DEBE mostrar una cabecera con la
  miga «Plataforma» y el título «Empresas», y una tabla con las columnas Nombre, Identificación
  fiscal, País, Usuarios, Creada y Estado. El país DEBE pintarse como «Nombre (+prefijo)» o
  «Sin país»; una identificación fiscal vacía, con la marca de vacío; el estado, como «Activa» o
  «De baja».
- **R9.** MIENTRAS la lista no tenga filtro de estado, el sistema DEBE mostrar solo empresas
  activas. El filtro «Estado» DEBE ofrecer «Activa» y «De baja»; con los dos elegidos DEBE
  mostrar todas.
- **R10.** CUANDO el Maestro escriba en la búsqueda, el sistema DEBE mostrar solo las empresas
  cuyo nombre o identificación fiscal la contienen (regla de QC-162 R31).
- **R11.** La lista DEBE ordenarse por Nombre o por Creada a petición, paginar con el contrato
  común de listados, y conservar página, tamaño, orden, filtro y búsqueda en la dirección: al
  recargar o volver atrás, la lista DEBE verse igual.
- **R12.** La empresa «QuimiCloud» DEBE listarse como cualquier otra empresa, sin ocultarla ni
  distinguirla.
- **R13.** El nombre de cada fila DEBE ser un enlace a `/maestro/empresas/[id]` de esa empresa.
- **R14.** El menú de acciones de una empresa activa DEBE ofrecer «Abrir», «Editar», «Módulos» y
  «Dar de baja»; el de una empresa de baja, «Abrir», «Editar» y «Reactivar». «Abrir» DEBE llevar
  al detalle y «Módulos» al detalle con la pestaña Módulos.
- **R15.** MIENTRAS la lista carga, el sistema DEBE mostrar el esqueleto de tabla. SI la consulta
  falla, ENTONCES DEBE mostrar el recuadro de error con su referencia y «Reintentar», que vuelve a
  pedir la lista. SI el filtro es solo «De baja» y no hay filas, ENTONCES DEBE mostrar «No hay
  empresas de baja», «Cuando des de baja una empresa, aparecerá aquí para reactivarla.» y
  «Quitar el filtro». SI la búsqueda no trae filas, ENTONCES DEBE mostrar el vacío con el enlace
  para limpiar la búsqueda.
- **R16.** MIENTRAS el contenedor de la lista mida 760 px o menos, cada empresa DEBE pintarse
  como tarjeta con nombre, estado, identificación, país, usuarios y fecha, y un botón «Acciones»
  de al menos 44 px que abre el menú centrado.

### Alta de empresa

- **R17.** CUANDO el Maestro pulse «Nueva empresa», el sistema DEBE abrir el panel «Nueva
  empresa» con la sección «Empresa» (Nombre, Identificación fiscal, Correo de contacto, Teléfono
  de contacto) y la sección «Administrador inicial» (Nombres, Apellidos, Fecha de nacimiento,
  Correo, Teléfono, Tipo de documento, Número de documento, Nombre de usuario), el aviso «Le
  llegará un correo con un enlace para fijar su contraseña.» y los botones «Cancelar» y «Crear
  empresa». El panel NO DEBE pedir país ni rol.
- **R18.** CUANDO el alta termina con éxito y el correo salió, el sistema DEBE cerrar el panel,
  avisar «Empresa creada. Enviamos el enlace al Administrador.» y refrescar la lista. SI el alta
  termina con éxito pero el correo no salió, ENTONCES DEBE cerrar el panel, refrescar la lista y
  avisar con el texto de la pregunta abierta 1.
- **R19.** SI el servidor rechaza el alta o la edición de una empresa, ENTONCES el sistema DEBE
  mantener abierto el panel con lo escrito y pintar el error junto al campo que señala su código
  (`company_duplicate_name` → Nombre; `company_duplicate_tax_id` → Identificación fiscal;
  `duplicate_username` → Nombre de usuario; `duplicate_email` → Correo; `duplicate_document` →
  Número de documento), y cualquier otro en la región de error del panel; un error inesperado,
  con su referencia.

### Edición de empresa

- **R20.** CUANDO el Maestro elija «Editar» sobre una empresa activa o de baja, el sistema DEBE
  abrir el panel «Editar empresa» con Nombre, Identificación fiscal, Correo de contacto, Teléfono
  de contacto y País, cargados con sus valores actuales. País DEBE ofrecer cualquier país y «Sin
  país».
- **R21.** CUANDO el Maestro guarde la edición, el sistema DEBE guardar primero los cuatro datos y,
  solo si eso tuvo éxito, el país. CUANDO las dos cosas terminan con éxito, DEBE cerrar el panel,
  avisar «Empresa actualizada.» y refrescar, de modo que la columna País del listado muestre el
  país nuevo.
- **R22.** SI los datos se guardaron pero el país se rechaza, ENTONCES el sistema DEBE mantener el
  panel abierto con lo escrito y el error junto a País, y refrescar la lista para que muestre los
  datos que sí se guardaron.

### Baja y reactivación de empresa

- **R23.** CUANDO el Maestro elija «Dar de baja», el sistema DEBE abrir el diálogo «Dar de baja a
  <nombre>», mostrar «Calculando el impacto…» mientras pide el impacto y, al tenerlo, «Usuarios
  activos» y «Pedidos abiertos» con sus cifras, el aviso «Sus usuarios no podrán entrar y se
  cerrarán las sesiones que tengan abiertas. Podrás reactivarla después.» y el campo «Escribe
  <nombre> para confirmar».
- **R24.** MIENTRAS el impacto no se haya cargado o el campo de confirmación esté vacío, el botón
  «Dar de baja» DEBE estar deshabilitado. SI la consulta del impacto falla, ENTONCES el diálogo
  DEBE mostrar el error con su referencia y mantener el botón deshabilitado.
- **R25.** CUANDO la baja termina con éxito, el sistema DEBE cerrar el diálogo, avisar «Empresa
  dada de baja.» y refrescar. SI el servidor responde `company_name_mismatch`, ENTONCES DEBE
  mantener el diálogo abierto con «El nombre escrito no coincide con el de la empresa.» junto al
  campo.
- **R26.** CUANDO el Maestro elija «Reactivar», el sistema DEBE abrir el diálogo «¿Reactivar
  <nombre>?» con «La empresa vuelve a estar activa con los datos y módulos que tenía.». CUANDO la
  reactivación termina con éxito, DEBE cerrarlo, avisar «Empresa reactivada.» y refrescar. SI el
  servidor la rechaza, ENTONCES DEBE mostrar el mensaje del catálogo como aviso de peligro dentro
  del diálogo, sin cerrarlo.

### Detalle de empresa

- **R27.** CUANDO el Maestro abra `/maestro/empresas/[id]` de una empresa que existe, viva o de
  baja, el sistema DEBE mostrar la miga «Empresas» (enlace a la lista), el nombre como título, su
  estado y las pestañas «Datos», «Módulos» e «Historial» como enlaces a `?tab=datos`,
  `?tab=modulos` y `?tab=historial`. SI `tab` falta o no es uno de los tres, ENTONCES DEBE mostrar
  la pestaña por defecto de la pregunta abierta 3. SI la empresa no existe o el identificador no
  es válido, ENTONCES DEBE responder el 404 de la zona privada.
- **R28.** MIENTRAS la empresa del detalle esté activa, la cabecera DEBE ofrecer «Editar» y «Dar
  de baja»; MIENTRAS esté de baja, la que fija la pregunta abierta 5. Las dos DEBEN abrir los
  mismos panel y diálogos de R20–R26 y, al terminar con éxito, refrescar el detalle.
- **R29.** CUANDO la pestaña vigente es «Datos», el sistema DEBE mostrar, en solo lectura,
  Nombre, Identificación fiscal, Correo de contacto, Teléfono de contacto, País, Creada y Dada de
  baja, con la marca de vacío en lo que no tiene valor.
- **R30.** CUANDO la pestaña vigente es «Módulos», el sistema DEBE dejar el panel de la pestaña
  listo para que lo llene QC-278 y NO DEBE pedir al servidor los añadidos de la empresa.
- **R31.** CUANDO la pestaña vigente es «Historial», el sistema DEBE mostrar los eventos de la
  empresa del más reciente al más antiguo, cada uno con su texto, el nombre y apellidos de quien lo
  hizo y su instante, paginados con «Página N de M · T en total». El número de página DEBE vivir en
  la dirección.
- **R32.** El texto de cada evento DEBE ser: alta, «Dio de alta la empresa»; edición, «Editó
  <campos>» con los nombres de los campos cambiados (Nombre, Identificación fiscal, Correo de
  contacto, Teléfono de contacto, País) unidos por comas y «y»; añadido prendido, «Prendió
  <añadido>»; añadido apagado, «Apagó <añadido>»; baja y reactivación, los de la pregunta abierta
  4. El historial NO DEBE mostrar ningún valor de los campos.
- **R33.** SI un evento trae un tipo que la pantalla no conoce, o un campo o añadido que no
  conoce, ENTONCES el sistema DEBE pintarlo igual con el texto genérico de la pregunta abierta 4,
  sin fallar.
- **R34.** MIENTRAS el historial carga, el sistema DEBE mostrar un esqueleto; el detalle NO lleva
  esqueleto: lee la empresa antes de pintar, para que R27 responda un 404 real (decisión cerrada
  del 2026-10-16). SI la consulta del detalle o del historial falla, ENTONCES DEBE mostrar el
  recuadro de error con su referencia y «Reintentar».

### Administradores

- **R35.** CUANDO el Maestro abra `/maestro/administradores`, el sistema DEBE mostrar una sola
  lista con los Administradores de todas las empresas, con las columnas Nombre, Usuario, Correo,
  Empresa (enlace al detalle de esa empresa) y Estado, un filtro único «Empresa», paginación, y
  ese estado de lista en la dirección.
- **R36.** El menú de acciones de cada Administrador, tanto el desplegable ⋯ de la tabla como el
  menú centrado de la tarjeta en teléfono, DEBE ofrecer «Editar» y «Dar de baja». MIENTRAS el
  Administrador esté en estado «Pendiente», ese menú DEBE ofrecer además «Reenviar enlace», entre
  los dos; en cualquier otro estado NO DEBE ofrecerlo.
- **R37.** CUANDO el Maestro pulse «Nuevo administrador», el sistema DEBE abrir el panel «Nuevo
  administrador» que empieza por «Empresa» (solo empresas activas), sigue con los mismos campos de
  persona del Administrador inicial (R17), muestra el rol «Administrador» como dato fijo que no se
  elige, el aviso del correo y «Crear administrador». CUANDO el alta termina con éxito, DEBE
  cerrarlo, avisar «Administrador creado. Enviamos el enlace.» y refrescar.
- **R38.** CUANDO el Maestro elija «Editar» un Administrador, el sistema DEBE abrir el panel con
  sus datos de persona cargados y su empresa mostrada como dato fijo, sin poder cambiarla. CUANDO
  guarda con éxito, DEBE cerrarlo, avisar «Administrador actualizado.» y refrescar.
- **R39.** CUANDO el Maestro elija «Dar de baja» un Administrador, el sistema DEBE abrir el diálogo
  «Dar de baja a <nombre>» con «<nombre> deja de poder entrar a <empresa>.». CUANDO la baja
  termina con éxito, DEBE cerrarlo, avisar «Administrador dado de baja.» y refrescar.
- **R40.** SI el Administrador es el último de su empresa, ENTONCES el diálogo de baja DEBE
  mostrar el aviso «Es el último Administrador de <empresa>» con «Crea otro Administrador para
  esta empresa antes de darlo de baja.» y el botón «Dar de baja» DEBE estar deshabilitado. SI aun
  así el servidor rechaza la baja por ser el último, ENTONCES DEBE mostrar su mensaje sin cerrar.
- **R41.** SI el servidor rechaza el alta o la edición de un Administrador, ENTONCES el sistema
  DEBE comportarse como R19 con los campos de persona.
- **R42.** MIENTRAS la lista de Administradores carga, el sistema DEBE mostrar el esqueleto; SI
  falla, ENTONCES el recuadro de error con «Reintentar»; SI no hay filas, ENTONCES el vacío del
  catálogo. MIENTRAS el contenedor mida 760 px o menos, cada Administrador DEBE pintarse como
  tarjeta con nombre, estado, usuario, correo y empresa, y un botón «Acciones» de al menos 44 px.

#### Reenviar el enlace de contraseña

- **R46.** CUANDO el Maestro elija «Reenviar enlace» sobre un Administrador, el sistema DEBE abrir
  el diálogo «¿Reenviar el enlace a <nombre>?» con «Le llegará a <correo> un correo nuevo para
  fijar su contraseña. El enlace anterior deja de servir.», «Volver» y «Reenviar enlace», sin
  pedir ningún dato.
- **R47.** CUANDO el reenvío termina con éxito y el correo salió, el sistema DEBE cerrar el diálogo
  y avisar «Enviamos el enlace a <nombre>.». SI el reenvío termina pero el correo no salió,
  ENTONCES DEBE cerrar el diálogo y avisar con el texto de fallo de la pregunta abierta 8. En los
  dos casos la lista NO DEBE cambiar.
- **R48.** SI el servidor rechaza el reenvío (p. ej. `user_not_pending`, porque la persona fijó su
  contraseña mientras la lista estaba abierta, o `user_not_found`), ENTONCES el sistema DEBE
  mantener el diálogo abierto y mostrar dentro el mensaje del catálogo de errores (con su
  referencia si es inesperado), sin avisar éxito.
- **R49.** MIENTRAS el reenvío está en curso, el botón de confirmar DEBE mostrar su estado
  pendiente y no DEBE poder pulsarse otra vez.

### E2E (paga los diferidos de QC-161, QC-162, QC-165 y QC-235)

- **R43.** El repositorio DEBE tener un E2E de Playwright que, con el Maestro sembrado, compruebe:
  que su login aterriza en `/maestro/empresas` con solo «Plataforma» en el menú; que una pantalla
  del ERP le responde el 404 de la zona privada; que un usuario de empresa recibe el 404 en
  `/maestro/empresas` y no ve «Plataforma»; y que el Maestro cierra sesión como cualquiera.
- **R44.** El repositorio DEBE tener un E2E de Playwright en el que el Maestro, por la pantalla:
  da de alta una empresa con su Administrador inicial y la ve en la lista; la edita cambiando el
  país y ve el país nuevo en la columna País del listado; intenta darla de baja con un nombre que
  no coincide y ve el error; la da de baja con el nombre correcto, deja de verla sin filtro y la ve
  con «De baja»; la reactiva; y ve en su Historial el alta, la edición que nombra «País» y la baja.
  El mismo E2E DEBE comprobar que un usuario con sesión abierta en la empresa dada de baja pierde
  su sesión en su siguiente petición.
- **R45.** El repositorio DEBE tener un E2E de Playwright en el que el Maestro, por la pantalla:
  da de alta un Administrador eligiendo empresa, lo edita, le reenvía el enlace y ve el aviso
  (de éxito o de fallo del correo, según el transporte del entorno), comprueba que el último
  Administrador de una empresa no se puede dar de baja, y da de baja a un Administrador que no es
  el último.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| ¿Diseño? | R8, R16, R17, R20, R23, R26, R27, R31, R35, R37, R39, R40, R42 |
| ¿Rutas y navegación? | R2, R3, R13, R14, R27, R35 |
| ¿Dónde aterriza el Maestro? | R4, R5 |
| ¿Editar una empresa de baja? | R14, R20 |
| ¿Qué dice la baja de empresa? | R23, R24, R25 |
| ¿Se lista QuimiCloud? | R12 |
| ¿Historial? | R31, R32, R33 |
| ¿Último Administrador? | R40, R45 |
| ¿Mover un Administrador de empresa? | R38 |
| ¿Reenviar el enlace a un Administrador? | R36, R46, R47, R48, R49, R45 |
| ¿Permisos? | R1, R6, R7 |
| ¿E2E? | R43, R44, R45 |
| ¿Estados? | R15, R34, R42 |

## Preguntas abiertas

Cada una lleva la opción por defecto con la que está escrito el spec. Si el humano no dice otra
cosa al aprobar, se implementa esa.

1. **Texto del toast si falla el correo al Administrador inicial.** Se propone «Empresa creada,
   pero no pudimos enviar el correo al Administrador.»; el humano lo confirma en la revisión del
   spec. (R18)
2. **Formato de las fechas.** El tablero pinta «14/09/2026» y, en el Historial, «15/10/2026
   16:40». El repo pinta fechas en UTC como `YYYY-MM-DD` (`DateCell`) para que servidor y
   navegador no difieran, y no hay huso horario de empresa en ningún sitio. **Por defecto:** el
   formato del tablero (`dd/mm/aaaa` y `dd/mm/aaaa HH:mm`), calculado en UTC. Si se quiere la hora
   local de la persona, hace falta decidir el huso.
3. **Pestaña por defecto del detalle.** El tablero abre en «Módulos», que en esta ficha queda vacía
   hasta QC-278. **Por defecto:** «Datos». QC-278 puede cambiarlo al montar su pestaña. (R27)
4. **Textos del Historial que el tablero no trae.** **Por defecto:** baja, «Dio de baja la
   empresa»; reactivación, «Reactivó la empresa»; tipo, campo o añadido desconocido, «Registró un
   cambio» (y el nombre técnico del campo o añadido si se conoce el tipo pero no el nombre). (R32,
   R33)
5. **Cabecera del detalle de una empresa de baja.** La decisión cerrada da «Editar» en el menú de
   la lista; el tablero del detalle solo muestra «Reactivar». **Por defecto:** «Editar» y
   «Reactivar», para que el detalle ofrezca lo mismo que el menú. (R28)
6. **Toast si falla el correo del Administrador nuevo.** QC-165 ya devuelve `mail: 'sent' |
   'failed'` en el alta (su `design.md > 6`); falta el texto. **Por defecto:** «Administrador
   creado, pero no pudimos enviar el correo.» (R37)
7. ~~Contrato de QC-165.~~ **Cerrada (2026-10-16):** su `design.md` (§ 1, § 3.5, § 3.6, § 6, § 8)
   fija lista, ficha, alta, edición, baja y reenvío (`resendAdministratorLinkAction`), con
   `isLastAdministrator`, `company_last_administrator` y `user_not_pending`. Este spec está
   alineado (`design.md > 5`).
8. **Texto si falla el correo al reenviar el enlace.** El tablero ya trae el diálogo y el aviso de
   éxito; el de fallo lo deja «Por confirmar». **Por defecto:** «No pudimos enviar el correo a
   <nombre>.»; texto pendiente del botón: «Reenviando…». (R47, R49)
9. ~~A quién se ofrece «Reenviar enlace».~~ **Cerrada (2026-10-16):** solo a los Administradores en
   «Pendiente»; QC-165 responde `user_not_pending` a cualquier otro (R36, R48).

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-16 | ¿Diseño? | Pase `/design` aprobado: `docs/diseno/canvas/MaestroEmpresas*`, `MaestroEmpresa*`, `MaestroEmpresaHistorial`, `MaestroAdministradores*`, `ModalesMaestro`, `Sidebar` (prop `area="maestro"`). |
| 2026-10-16 | ¿Rutas y navegación? | `/maestro/empresas` (heredada de **QC-235**), `/maestro/empresas/[id]` con pestañas que son enlaces (`?tab=datos\|modulos\|historial`) y `/maestro/administradores`. Barra lateral propia con Empresas y Administradores; sin módulos del ERP. |
| 2026-10-16 | ¿Dónde aterriza el Maestro? | En `/maestro/empresas` (heredado de **QC-161**). |
| 2026-10-16 | ¿Editar una empresa de baja? | Sí (heredado de **QC-162**): el menú de una empresa de baja ofrece Abrir, Editar y Reactivar. |
| 2026-10-16 | ¿Qué dice la baja de empresa? | Muestra usuarios activos y pedidos abiertos, pide escribir el nombre, y avisa que sus usuarios no podrán entrar y se cerrarán sus sesiones (heredado de **QC-162 R20–R24**). |
| 2026-10-16 | ¿Se lista QuimiCloud? | Sí, como cualquier empresa (heredado de **QC-162 P5**). |
| 2026-10-16 | ¿Historial? | Pestaña del detalle con `listCompanyEventsAction`: nombra los campos que cambiaron, no sus valores (heredado de **QC-162 R34–R39**). Quién lo hizo: nombre del usuario Maestro. |
| 2026-10-16 | ¿Último Administrador? | No se puede dar de baja: primero hay que crear otro. El diálogo lo dice y no deja confirmar (decidido para **QC-165**). |
| 2026-10-16 | ¿Mover un Administrador de empresa? | No. En Editar la empresa se muestra fija (decidido para **QC-165**). |
| 2026-10-16 | ¿Reenviar el enlace a un Administrador? | **Sí** (humano, 2026-10-16; enmienda el «Lo que NO entra» sembrado). Acción «Reenviar enlace» en el menú de la fila de Administradores, con el servidor de **QC-165**. |
| 2026-10-16 | ¿Esqueleto del detalle de empresa? | **No.** El detalle lee la empresa antes de pintar, para que una empresa inexistente responda un 404 real (enmienda R34). El Historial sí lleva esqueleto. |
| 2026-10-16 | ¿Marca de obligatorio en teléfono y número de documento del Administrador? | **Sí.** Llevan «*» como los demás obligatorios, porque el servidor los exige (QC-165). |
| 2026-10-16 | ¿Permisos? | `empresas.consultar` para ver y `empresas.modificar` para escribir, validado en el service (heredado de **QC-161**). |
| 2026-10-16 | ¿E2E? | Sí. Paga el diferido de **QC-161, QC-162, QC-165 y QC-235**, más el caso «el Maestro cambia el país y lo ve en el listado». |
| 2026-10-16 | ¿Estados? | Cargando con esqueleto, vacío (filtro «De baja») y error con «Reintentar», con los componentes del catálogo. |
