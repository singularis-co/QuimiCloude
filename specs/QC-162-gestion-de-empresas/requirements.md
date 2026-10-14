# QC-162 — gestion-de-empresas · requirements.md

> Zona: backend · Complejidad: high · depends_on: QC-161 (done) · Rama: feature/QC-162-gestion-de-empresas
>
> **Alcance.** En el servidor, el Maestro consulta, da de alta, edita, da de baja y reactiva
> empresas (`empresas.consultar` / `empresas.modificar`).
> - El alta crea la empresa junto con su primer Administrador, que recibe el enlace para fijar
>   su contraseña.
> - Cada cambio queda en un historial.
> - En producción, el seed crea solo al Maestro.
>
> **Lo que NO entra.**
> - La pantalla: QC-166.
> - Gestionar más Administradores después del alta (editar, dar de baja, agregar otros): QC-165.
> - El país, que lo guarda QC-235.
> - Los módulos de la empresa: QC-277.
> - La moneda por empresa: QC-182.
>
> Sembrado por `/afinar-feature` el 2026-10-13. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

Vocabulario de este archivo:

- «Empresa viva»: empresa sin marca de baja. «De baja»: con marca de baja (borrado lógico).
- «Forma normalizada» de un texto: la de `normalizeCompanyName` (recorta, sin mayúsculas, sin
  acentos y sin nada que no sea letra o dígito). «QuimiCloud» y «QUIMI-CLOUD» coinciden.
- «Usuario vivo»: usuario sin marca de baja, en cualquier estado de cuenta.
- «Pedido en curso»: pedido sin borrar cuyo estado no es `ENTREGADO` ni `CANCELADO` (ver
  Preguntas abiertas, P3).
- «Actor»: quien llama, tomado de la sesión. Las operaciones de escritura exigen
  `empresas.modificar`; las de lectura (lista, ficha, impacto de la baja, historial),
  `empresas.consultar`.

### Acceso

- **R1.** SI el actor no existe, no trae conjunto de permisos o su conjunto no contiene
  exactamente el permiso que la operación exige, ENTONCES el sistema DEBE rechazar la petición con
  el código `unauthorized`, antes de validar la entrada y sin leer ni escribir ninguna empresa,
  usuario, enlace ni evento. `empresas.consultar` no autoriza ninguna escritura y
  `empresas.modificar` no autoriza ninguna lectura por sí solo.
- **R2.** SI el actor tiene el permiso exigido pero no pertenece a ninguna empresa (el Maestro),
  ENTONCES el sistema DEBE autorizarlo igual: la empresa del actor no interviene en ninguna
  operación de esta ficha.
- **R3.** CUANDO una acción de servidor de esta ficha recibe una petición, el sistema DEBE tomar
  la identidad y los permisos del actor solo de la sesión, nunca de la entrada; DEBE responder un
  estado de éxito (con sus datos, si la operación devuelve alguno) o el estado de error con su
  `code`; y no DEBE revalidar ninguna ruta, porque la pantalla es de QC-166.

### Datos de la empresa

- **R4.** El sistema DEBE guardar para cada empresa: nombre (obligatorio, de 1 a 80 caracteres
  tras recortar), identificación fiscal (opcional, hasta 40 caracteres, formato libre), correo de
  contacto (opcional, hasta 160 caracteres) y teléfono de contacto (opcional, hasta 40
  caracteres, formato libre). Los textos se guardan recortados.
- **R5.** CUANDO un dato opcional llega vacío (o solo con espacios), el sistema DEBE guardarlo
  como sin valor. SI falta alguno de los cuatro campos, viene alguna clave no prevista (el país,
  la empresa del actor, una marca de baja) o un texto supera su tope, ENTONCES el sistema DEBE
  rechazar la petición con `invalid_input` sin escribir nada.
- **R6.** El sistema DEBE validar el correo de contacto igual que el correo de un usuario: se
  recorta, se limita a 160 caracteres y se guarda tal como se escribió, sin pasarlo a minúsculas.
  No se comprueba su formato, igual que hoy en el usuario.
- **R7.** SI la identificación fiscal no es vacía pero su forma normalizada queda vacía (p. ej.
  «---»), ENTONCES el sistema DEBE rechazar la petición con `invalid_input`.
- **R8.** SI el nombre pedido coincide, en forma normalizada, con el de otra empresa viva,
  ENTONCES el sistema DEBE rechazar el alta, la edición de una empresa viva o la reactivación con
  el código `company_duplicate_name`, sin escribir nada.
- **R9.** SI la identificación fiscal pedida coincide, en forma normalizada, con la de otra
  empresa viva, ENTONCES el sistema DEBE rechazar el alta, la edición de una empresa viva o la
  reactivación con el código `company_duplicate_tax_id`, sin escribir nada. Varias empresas sin
  identificación no chocan entre sí.
- **R10.** SI se escribe directamente en la base una segunda empresa viva con la misma
  identificación normalizada que otra viva, o una identificación sin su forma normalizada (o al
  revés), ENTONCES la base DEBE rechazar la escritura. La misma identificación en una empresa viva
  y en otra de baja DEBE admitirse.

### Alta (empresa y primer Administrador)

- **R11.** CUANDO un actor con `empresas.modificar` pide el alta con datos válidos de la empresa y
  de su primer Administrador, el sistema DEBE crear, en una sola operación atómica: la empresa
  (viva y sin país) y su Administrador (rol Administrador, de esa empresa, en estado `pending`,
  sin ninguna contraseña con la que se pueda entrar y obligado a fijarla). DEBE devolver el
  identificador de la empresa y el del Administrador.
- **R12.** El sistema DEBE pedir para el Administrador los mismos campos, con las mismas
  validaciones, que el alta de usuario (nombres, apellidos, fecha de nacimiento, correo, teléfono,
  tipo y número de documento y nombre de usuario). SI la entrada del Administrador trae rol,
  contraseña, empresa o cualquier otra clave no prevista, ENTONCES el sistema DEBE rechazar la
  petición con `invalid_input`.
- **R13.** SI el nombre de usuario del Administrador ya lo tiene otro usuario vivo de cualquier
  empresa o el Maestro, ENTONCES el sistema DEBE rechazar el alta con `duplicate_username`. SI el
  tipo de documento no existe, ENTONCES DEBE rechazarla con `invalid_input`.
- **R14.** SI cualquier paso del alta falla antes de terminar (choque de nombre, de
  identificación o de usuario, o un error de la base), ENTONCES el sistema NO DEBE dejar ni la
  empresa, ni el Administrador, ni su evento de historial: una empresa nunca existe sin su
  Administrador.
- **R15.** CUANDO el alta termina, el sistema DEBE emitir al Administrador el enlace para fijar su
  contraseña, con las reglas del enlace de QC-79 (huella y no secreto en la base, siete días de
  vigencia, un solo enlace vivo), enviarlo a su correo y devolver si el correo salió (`sent`) o no
  (`failed`). Un fallo del correo NO DEBE deshacer el alta.

### Edición

- **R16.** CUANDO un actor con `empresas.modificar` pide editar una empresa con los cuatro datos
  válidos, el sistema DEBE guardar exactamente esos cuatro y no DEBE cambiar su país, sus
  usuarios, su fecha de alta ni su marca de baja.
- **R17.** DONDE la empresa está de baja, el sistema DEBE permitir editarla igual (para
  renombrarla antes de reactivarla), sin comprobar el choque de nombre ni de identificación,
  que se comprueba al reactivar (ver Preguntas abiertas, P2).
- **R18.** SI la edición no cambia ningún dato, ENTONCES el sistema DEBE responder éxito sin
  escribir la empresa ni ningún evento.
- **R19.** SI la empresa pedida no existe, ENTONCES el sistema DEBE rechazar la edición con
  `company_not_found` sin escribir nada.

### Baja

- **R20.** CUANDO un actor con `empresas.consultar` pide el impacto de la baja de una empresa
  viva, el sistema DEBE devolver cuántos usuarios vivos tiene y cuántos pedidos en curso tiene,
  contando solo los de esa empresa. SI la empresa no existe o está de baja, ENTONCES DEBE
  responder `company_not_found`.
- **R21.** CUANDO un actor con `empresas.modificar` pide la baja de una empresa viva con una
  confirmación que, en forma normalizada, coincide con el nombre de la empresa, el sistema DEBE
  marcarla de baja con el instante de la operación y no DEBE cambiar ni borrar sus datos, sus
  usuarios ni sus pedidos.
- **R22.** SI la confirmación no coincide con el nombre de la empresa, ENTONCES el sistema DEBE
  rechazar la baja con `company_name_mismatch` sin escribir nada. SI falta la confirmación,
  ENTONCES DEBE rechazarla con `invalid_input`.
- **R23.** SI la empresa pedida no existe o ya está de baja, ENTONCES el sistema DEBE rechazar la
  baja con `company_not_found` sin escribir nada.
- **R24.** MIENTRAS una empresa está de baja, el sistema DEBE negar el inicio de sesión a sus
  usuarios y cortar en su siguiente petición la sesión que tuvieran abierta.
- **R25.** MIENTRAS una empresa está de baja, su nombre y su identificación fiscal NO DEBEN
  impedir que otra empresa viva los use.

### Reactivación

- **R26.** CUANDO un actor con `empresas.modificar` pide reactivar una empresa de baja cuyo nombre
  y cuya identificación no tiene ninguna empresa viva, el sistema DEBE quitarle la marca de baja y
  dejar sus datos y sus usuarios exactamente como estaban, sin cambiar el estado de cuenta de
  nadie.
- **R27.** SI otra empresa viva tiene ya el nombre o la identificación de la empresa a reactivar,
  ENTONCES el sistema DEBE rechazar la reactivación con `company_duplicate_name` o
  `company_duplicate_tax_id`, sin escribir nada.
- **R28.** SI la empresa pedida no existe, ENTONCES el sistema DEBE rechazar la reactivación con
  `company_not_found`; SI está viva, ENTONCES DEBE rechazarla con `company_not_deleted`. En los
  dos casos sin escribir nada.

### Lista y ficha

- **R29.** CUANDO un actor con `empresas.consultar` pide la lista de empresas, el sistema DEBE
  devolver una página en la que cada fila trae: identificador, nombre, identificación fiscal,
  país, número de usuarios vivos, fecha de alta y estado (`active` o `deleted`).
- **R30.** MIENTRAS la petición no filtra por estado, la lista DEBE traer solo empresas vivas.
  CUANDO filtra por estado, DEBE traer las de los estados pedidos (`active`, `deleted` o los dos).
- **R31.** CUANDO la petición trae un texto de búsqueda, la lista DEBE traer solo las empresas
  cuyo nombre o cuya identificación fiscal, en forma normalizada, contienen la forma normalizada
  del texto.
- **R32.** La lista DEBE seguir el contrato común de listados (QC-57): 10 filas por defecto y 25
  como tope, orden por defecto por nombre ascendente con desempate estable, orden pedido solo por
  nombre o fecha de alta, y todo campo de orden o filtro no declarado se ignora sin fallar.
- **R33.** CUANDO un actor con `empresas.consultar` pide la ficha de una empresa, viva o de baja,
  el sistema DEBE devolver sus datos (nombre, identificación fiscal, correo y teléfono de
  contacto, país), su fecha de alta, su estado y su fecha de baja si la tiene. SI no existe,
  ENTONCES DEBE responder `company_not_found`.

### Historial

- **R34.** CUANDO un alta, una edición con cambios, una baja o una reactivación terminan, el
  sistema DEBE registrar en el historial de esa empresa un evento con su tipo (`company.created`,
  `company.updated`, `company.deleted` o `company.reactivated`), su autor (el actor) y su instante,
  en la misma operación atómica que el cambio: si el evento no se escribe, el cambio tampoco, y al
  revés.
- **R35.** El evento de una edición DEBE nombrar los campos que cambiaron, y NO DEBE guardar sus
  valores.
- **R36.** CUANDO el país de una empresa cambia por la acción de QC-235, el sistema DEBE registrar
  un evento `company.updated` que nombra el campo `country`, en la misma operación atómica. SI el
  país pedido es el que ya tenía, ENTONCES no DEBE registrar ningún evento (ver Preguntas
  abiertas, P4).
- **R37.** CUANDO un actor con `empresas.consultar` pide el historial de una empresa, viva o de
  baja, el sistema DEBE devolver sus eventos del más reciente al más antiguo, paginados con el
  defecto de 10 y el tope de 25, cada uno con tipo, identificador y nombre del autor, instante y
  campos cambiados. SI la empresa no existe, ENTONCES DEBE responder `company_not_found`.
- **R38.** El sistema NO DEBE ofrecer ninguna operación que modifique o borre un evento del
  historial.
- **R39.** El historial DEBE admitir tipos de evento nuevos con la forma `<ámbito>.<acción>` (por
  ejemplo, los de módulos de QC-277) sin cambiar el esquema de la base. SI se escribe
  directamente en la base un tipo que no tiene esa forma, ENTONCES la base DEBE rechazar la
  escritura.

### Seed

- **R40.** DONDE el seed corre en producción (`VERCEL_ENV` es `production`), el sistema DEBE crear
  lo que falte de roles, permisos y Maestro, y NO DEBE crear la empresa inicial ni el
  Administrador inicial, ni leer las credenciales del Administrador inicial.
- **R41.** DONDE el seed corre fuera de producción (local, CI, E2E y preview), el sistema DEBE
  sembrar como hasta hoy: la empresa «QuimiCloud», el Administrador inicial y el Maestro.
- **R42.** El seed, en producción, NO DEBE borrar ni modificar ninguna empresa ni ningún usuario
  que ya exista (ver Preguntas abiertas, P5).

### Esquema

- **R43.** Cada cambio de esquema de esta ficha DEBE tener su reversión, que deja la base
  exactamente como estaba antes.
- **R44.** La tabla del historial DEBE tener RLS activado y forzado.

### Nombre sin forma comparable

- **R45.** SI el nombre de la empresa no es vacío pero su forma normalizada queda vacía (p. ej.
  «!!!»), ENTONCES el sistema DEBE rechazar el alta o la edición con `invalid_input`, sin escribir
  nada, igual que R7 con la identificación fiscal.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| ¿Datos de la empresa? | R4, R5, R6, R16, R45 |
| ¿Identificación fiscal? | R4, R7, R9, R10, R25 |
| ¿Alta? | R11, R12, R13, R14, R15 |
| ¿Baja con gente trabajando? | R20, R21, R22, R23, R24 |
| ¿Reactivar? | R17, R26, R27, R28 |
| ¿Lista? | R29, R30, R31, R32, R33 |
| ¿Historial? | R34, R35, R36, R37, R38, R39 |
| ¿Seed? | R40, R41, R42 |
| ¿Permisos? (QC-161) | R1 |
| ¿Acceso del Maestro? (QC-235) | R2, R3 |
| ¿Borrado? (QC-4) | R8, R21, R25 |
| ¿E2E? (QC-161 D8) | R3 (sin pantalla aquí; todo se prueba con unitarios e integración) |

## Preguntas abiertas

Cada una lleva la opción por defecto con la que está escrito el spec. Si el humano no dice otra
cosa al aprobar, se implementa esa.

- **P1. Campos de «contacto».** Propuesta de `spec_author`: correo y teléfono, los dos opcionales,
  sin persona de contacto. El correo se valida como el de un usuario (hoy solo largo, sin
  formato); el teléfono es texto libre de hasta 40 caracteres, como el del usuario (la validación
  de teléfonos con país es de QC-236).
  **Por defecto:** así (R4, R6).
- **P2. Reactivar cuando otra empresa viva tomó el nombre.** La decisión dice «hay que
  renombrarla antes». Se lee como «renombrar la empresa de baja», y para eso la edición se admite
  también sobre empresas de baja, sin comprobar choques, que se comprueban al reactivar.
  **Por defecto:** así (R17, R27). La alternativa es renombrar la otra empresa, que no necesita
  editar empresas de baja.
- **P3. Qué es un «pedido en curso».** No hay definición en el código. **Por defecto:** todo
  pedido sin borrar cuyo estado no es `ENTREGADO` ni `CANCELADO`; `TERMINADO` y `BLOQUEADO`
  cuentan como en curso porque todavía no se entregaron (R20).
- **P4. El cambio de país en el historial.** La decisión dice «cada cambio». El país lo fija la
  acción de QC-235, que hoy no deja rastro. **Por defecto:** se registra como `company.updated`
  con el campo `country` (R36). Esto toca código de QC-235 ya cerrado.
- **P5. La empresa «QuimiCloud» y su Administrador inicial que ya están en producción.** El seed
  deja de crearlos, pero no los borra (R42). **Por defecto:** se quedan; si sobran, el Maestro los
  da de baja con esta ficha.
- **P6. País en el alta.** La decisión deja el país en QC-235. **Por defecto:** el alta y la
  edición no lo aceptan (R5) y QC-166 lo fija con la acción de QC-235 después del alta.
- El último Administrador y el cambio de empresa de un Administrador siguen abiertos en QC-165.
  El reenvío del enlace al primer Administrador también es de QC-165: el reenvío que existe hoy
  (QC-79) exige un actor con empresa.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-13 | ¿Datos de la empresa? | Nombre, identificación fiscal y contacto. El país ya existe (QC-235). |
| 2026-10-13 | ¿Identificación fiscal? | Opcional. Si viene, es única entre empresas vivas, con formato libre. |
| 2026-10-13 | ¿Alta? | Crea la empresa y su primer Administrador en el mismo paso; el Administrador recibe el enlace de contraseña (QC-79). Una empresa nunca nace sin Administrador. |
| 2026-10-13 | ¿Baja con gente trabajando? | Se permite. El Maestro confirma escribiendo el nombre de la empresa y ve antes cuántos usuarios y pedidos en curso tiene. La baja expulsa a todos en la siguiente petición (ya existe). |
| 2026-10-13 | ¿Reactivar? | Sí, con todos sus datos y usuarios, si el nombre sigue libre. Si otra empresa viva lo tomó, hay que renombrarla antes. |
| 2026-10-13 | ¿Lista? | Muestra las activas, con un filtro para ver las de baja. Tiene búsqueda y paginación. Columnas: nombre, identificación, país, nº de usuarios, fecha de alta y estado. |
| 2026-10-13 | ¿Historial? | Guarda quién y cuándo creó, editó, dio de baja o reactivó cada empresa. QC-277 lo reutiliza para los módulos. |
| 2026-10-13 | ¿Seed? | En producción, solo el Maestro. En local y preview siguen «QuimiCloud» y la demo. |
| heredada QC-161 | ¿Permisos? | Ya existen: `empresas.modificar` cubre alta, edición, baja y reactivación. Autorización por permiso, nunca por rol. |
| heredada QC-235 | ¿Acceso del Maestro? | Por la vía de plataforma ya existente (`PlatformActor`), sin contexto de empresa. |
| heredada QC-4 / arquitectura | ¿Borrado? | Lógico; el nombre es único entre empresas vivas, sin distinguir mayúsculas ni acentos. |
| heredada QC-161 D8 | ¿E2E? | En QC-166, la primera con pantalla. Aquí, integración y unitarios. |
