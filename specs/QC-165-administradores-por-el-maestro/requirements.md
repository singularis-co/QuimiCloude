# QC-165 — administradores-por-el-maestro · requirements.md

> **Zona** backend · **Complejidad** — · **depends_on** QC-161 · **Rama** feature/QC-165-administradores-por-el-maestro
>
> **Alcance.** El Maestro da de **alta**, **edita** y da de **baja** usuarios con rol **Administrador**
> en **cualquier** empresa, eligiendo la empresa al crearlos, y consulta quién es Administrador en cada
> una. Solo Administradores: no crea ni toca Operadores ni Empacadores.
>
> **Lo que NO entra.** Las pantallas del área del Maestro (**QC-166**). La gestión de empresas
> (**QC-162**). El rol Maestro y sus permisos (**QC-161**).
>
> Sembrado por `/afinar-feature` el 2026-09-24. El bloque de Alcance y la tabla de «Decisiones cerradas»
> los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los reescribe: su
> trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

Vocabulario de este archivo:

- «Administrador»: usuario con el rol Administrador. «Vivo»: sin marca de baja, en cualquier estado
  de cuenta (`pending`, `active`, `inactive` o `blocked`).
- «Empresa viva»: empresa sin marca de baja (QC-162).
- «Administrador gestionable»: Administrador vivo de una empresa viva. Es el único objetivo de la
  ficha, la edición y la baja de esta ficha (ver P3).
- «Último Administrador»: el único Administrador vivo de su empresa, sea cual sea su estado de
  cuenta y el de los demás. Un Administrador recién creado, todavía en `pending`, ya cuenta: es lo
  que hace cierto «primero hay que crear otro».
- «Actor»: quien llama, tomado de la sesión. Alta, edición y baja exigen `empresas.modificar`; la
  lista y la ficha, `empresas.consultar`.
- «Los ocho datos»: nombres, apellidos, fecha de nacimiento, correo, teléfono, tipo de documento,
  número de documento y nombre de usuario, con las validaciones del alta de usuarios (QC-4/QC-66).

### Acceso

- **R1.** SI el actor no existe, no trae conjunto de permisos o su conjunto no contiene el permiso
  que la operación exige, ENTONCES el sistema DEBE rechazar la petición con el código
  `unauthorized`, antes de validar la entrada y sin leer ni escribir ningún usuario, empresa o
  enlace y sin enviar ningún correo. `empresas.consultar` no autoriza ninguna escritura y
  `empresas.modificar` no autoriza la lista ni la ficha. Los permisos de gestión de usuarios de
  empresa (`usuarios.consultar`, `usuarios.modificar`) no autorizan ninguna operación de esta ficha.
- **R2.** SI el actor tiene el permiso exigido y no pertenece a ninguna empresa (el Maestro),
  ENTONCES el sistema DEBE autorizarlo; la empresa del actor, tenga o no, no interviene en ninguna
  operación de esta ficha.
- **R3.** CUANDO una acción de servidor de esta ficha recibe una petición, el sistema DEBE tomar la
  identidad y los permisos del actor solo de la sesión, nunca de la entrada; DEBE responder un
  estado de éxito (con sus datos, si la operación devuelve alguno) o el estado de error con su
  `code` estable; y no DEBE revalidar ninguna ruta, porque la pantalla es de QC-166.

### Lista

- **R4.** CUANDO el actor pide la lista de Administradores, el sistema DEBE devolver una página de
  los Administradores gestionables de **todas** las empresas vivas, con el mismo contrato de
  consulta de los demás listados (página, tamaño de página, un orden, filtros y búsqueda): tamaño
  por defecto 10 y tope 25 (pedir más se acota, no se rechaza), y un total que describe el conjunto
  ya filtrado. SI la consulta no tiene la forma del contrato, ENTONCES DEBE responder
  `invalid_input`.
- **R5.** Cada fila de la lista DEBE llevar: identificador, nombres, apellidos, nombre de usuario,
  correo, empresa (identificador y nombre), estado de cuenta, fecha de alta y si es el último
  Administrador de su empresa. NO DEBE llevar ninguna credencial ni huella suya, ningún contador de
  intentos o bloqueo de acceso ni la marca de baja.
- **R6.** DONDE la consulta trae el filtro por empresa con uno o varios identificadores, el sistema
  DEBE devolver solo los Administradores de esas empresas. Un valor que no es un identificador
  válido se descarta sin romper la consulta; si no queda ninguno, el filtro se omite.
- **R7.** DONDE la consulta trae un texto de búsqueda, el sistema DEBE devolver solo los
  Administradores cuyos nombres, apellidos, correo o nombre de usuario lo contienen, sin distinguir
  mayúsculas de minúsculas.
- **R8.** El sistema DEBE permitir ordenar la lista por apellidos, nombres, nombre de usuario,
  correo, estado de cuenta, fecha de alta y nombre de la empresa, en las dos direcciones; sin orden
  pedido, DEBE devolver primero los más recientes. Todo orden DEBE desempatar por identificador, de
  modo que una fila no salga en dos páginas ni en ninguna. Un campo de orden o de filtro no declarado
  DEBE omitirse sin romper la consulta y registrarse por su nombre, nunca por su valor.
- **R9.** La lista NO DEBE incluir usuarios de otro rol (Operador, Empacador ni ningún otro), al
  Maestro, Administradores dados de baja ni Administradores de empresas dadas de baja.

### Ficha

- **R10.** CUANDO el actor pide la ficha de un Administrador gestionable, el sistema DEBE devolver
  su identificador, los ocho datos, su empresa (identificador y nombre), su estado de cuenta y el
  instante de su último cambio, sus fechas de alta y de última modificación, y si es el último
  Administrador de su empresa. NO DEBE devolver ninguna credencial ni huella suya, ningún contador
  de intentos o bloqueo de acceso ni la marca de baja.
- **R11.** SI el identificador pedido no corresponde a un Administrador gestionable (no existe, no
  es un identificador válido, está de baja, es de otro rol, es el Maestro o su empresa está de
  baja), ENTONCES el sistema DEBE responder `user_not_found`, la misma respuesta en todos esos casos.

### Alta

- **R12.** CUANDO el actor pide el alta de un Administrador con una empresa y los ocho datos, el
  sistema DEBE crear el usuario en esa empresa validando los ocho datos igual que el alta de
  usuarios (QC-4/QC-66): textos obligatorios, recortados y con sus mismos topes, fecha de
  nacimiento `AAAA-MM-DD` válida y tipo de documento del catálogo cerrado.
- **R13.** SI la entrada del alta trae cualquier clave no prevista —un rol, sea el que sea; una
  contraseña; un estado de cuenta—, le falta un campo, un texto supera su tope o la empresa no es un
  identificador válido, ENTONCES el sistema DEBE rechazarla con `invalid_input` sin escribir nada,
  sin emitir ningún enlace y sin enviar ningún correo.
- **R14.** CUANDO el alta se completa, el usuario creado DEBE tener el rol Administrador, nacer en
  `pending`, sin ninguna credencial con la que se pueda entrar, con el cambio de credencial
  obligatorio y sin autor del cambio de estado (lo cambió el sistema, no una persona).
- **R15.** SI la empresa pedida no existe o está de baja, ENTONCES el sistema DEBE rechazar el alta
  con `company_not_found`, sin escribir nada, sin emitir ningún enlace y sin enviar ningún correo.
- **R16.** SI el correo o el documento (tipo y número) coinciden con los de otro usuario vivo de la
  misma empresa, o el nombre de usuario con el de cualquier usuario vivo del sistema, ENTONCES el
  sistema DEBE rechazar el alta con `duplicate_email`, `duplicate_document` o `duplicate_username`
  respectivamente, sin escribir nada y sin enviar ningún correo. El mismo correo o el mismo
  documento en una empresa distinta DEBEN admitirse (QC-47).
- **R17.** CUANDO el alta se completa, el sistema DEBE emitir el enlace para fijar la contraseña
  (QC-79), enviarlo al correo del Administrador creado y devolver su identificador y el resultado del
  correo, `sent` o `failed`. Un fallo del correo NO DEBE deshacer el alta ni hacerla fallar. Ni el
  resultado ni ningún error DEBEN llevar el secreto del enlace.

### Edición

- **R18.** CUANDO el actor pide editar un Administrador gestionable con los ocho datos, el sistema
  DEBE reemplazar los ocho, con las mismas validaciones del alta (R12), y no DEBE cambiar ningún otro
  dato: ni la empresa, ni el rol, ni el estado de cuenta, ni la credencial, ni los contadores de
  acceso.
- **R19.** SI la entrada de la edición trae la empresa, un rol, una contraseña, un estado de cuenta o
  cualquier otra clave no prevista, o no cumple las validaciones de R12, ENTONCES el sistema DEBE
  rechazarla con `invalid_input` sin escribir nada. La empresa de un Administrador no se puede
  cambiar por ninguna operación de esta ficha.
- **R20.** SI el objetivo de la edición no es un Administrador gestionable (los mismos casos de
  R11), ENTONCES el sistema DEBE responder `user_not_found` sin escribir nada.
- **R21.** SI la edición haría coincidir el correo o el documento con otro usuario vivo de la
  empresa del Administrador, o el nombre de usuario con cualquier usuario vivo del sistema, ENTONCES
  el sistema DEBE rechazarla con el código de duplicado de R16 sin escribir nada.

### Baja

- **R22.** CUANDO el actor pide dar de baja a un Administrador gestionable que no es el último de su
  empresa, el sistema DEBE marcarlo de baja conservando su fila (baja lógica, QC-4), DEBE dejar libres
  su correo, su nombre de usuario y su documento para usuarios nuevos, y sus sesiones abiertas DEBEN
  dejar de valer desde la siguiente petición.
- **R23.** SI el objetivo de la baja es el último Administrador de su empresa, ENTONCES el sistema
  DEBE rechazarla con el código `company_last_administrator`, propio y distinto de
  `last_administrator`, sin escribir nada. El estado de cuenta de los demás Administradores no
  interviene: con otro Administrador vivo en `pending`, la baja se admite.
- **R24.** CUANDO llegan a la vez las bajas de los dos únicos Administradores vivos de una empresa, el
  sistema DEBE completar como máximo una; la otra DEBE responder `company_last_administrator`, y la
  empresa DEBE conservar al menos un Administrador vivo.
- **R25.** SI el objetivo de la baja no es un Administrador gestionable (los mismos casos de R11),
  ENTONCES el sistema DEBE responder `user_not_found` sin escribir nada.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| Solo Administradores, de cualquier empresa | R4, R9, R11, R13, R14, R20, R25 |
| Alta, edición, baja y lista | R4, R10, R12, R18, R22 |
| `empresas.modificar` / `empresas.consultar`, sin permiso nuevo, en el service | R1, R2, R3 |
| Mismos campos y validaciones | R12, R18, R19 |
| Unicidad dentro de la empresa | R16, R21 |
| Nace sin contraseña y recibe el enlace | R14, R17 |
| Baja lógica | R22 |
| E2E en QC-166; unitarios e integración incluidos permiso y rol distinto | R1 y R13, con su test unitario y de integración (`tasks.md`) |
| No se da de baja al último Administrador | R5, R10, R23, R24 |
| La empresa de un Administrador no se cambia | R19 |

## Preguntas abiertas

Las dos preguntas sembradas el 2026-09-24 quedan **resueltas** por las filas del 2026-10-16 de la
tabla de decisiones: «¿El último Administrador de una empresa?» (R5, R10, R23, R24) y «¿Cambiar de
empresa a un Administrador?» (R19). Se retiran de aquí.

Quedan tres, ninguna bloquea el spec. Cada una lleva la posición que toma este spec si no hay
respuesta:

- **P1. Reenvío del enlace por el Maestro.** QC-162 dejó a esta ficha el reenvío del enlace al
  Administrador cuyo correo de alta falló (`specs/QC-162-gestion-de-empresas/requirements.md`,
  línea de cierre de Preguntas abiertas, y su `design.md > 11`, riesgo 1): el reenvío de QC-79 exige
  un actor con empresa y el Maestro no la tiene. **No está en el Alcance ni en las Decisiones
  cerradas de esta ficha.** **Por defecto:** no entra; la alternativa que queda es dar de baja al
  Administrador y crearlo otra vez, lo que solo es posible si la empresa tiene otro (R23). Si el
  humano lo quiere aquí, son un requisito y una task más (reutiliza `issueCredentialSetupLink` con
  la empresa del Administrador).
- **P2. Historial de la empresa.** QC-162 guarda quién y cuándo creó, editó, dio de baja o reactivó
  cada empresa. **Por defecto:** el alta, la edición y la baja de un Administrador **no** dejan
  evento en ese historial; el usuario ya guarda sus fechas de alta y de cambio.
- **P3. Administradores de empresas dadas de baja.** **Por defecto:** quedan fuera de la lista, la
  ficha, la edición y la baja (R9, R11), igual que el alta en una empresa de baja (R15). Al
  reactivar la empresa (QC-162) vuelven a aparecer con sus datos.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-09-24 | ¿Qué usuarios gestiona el Maestro? | **Solo los de rol Administrador**, de **cualquier** empresa. No crea ni toca Operadores ni Empacadores. |
| 2026-09-24 | ¿Qué puede hacer con ellos? | **Alta** (eligiendo la empresa), **edición**, **baja** y consultar la **lista** por empresa. |
| 2026-09-24 | ¿Qué permiso lo autoriza? | **`empresas.modificar`** para escribir y **`empresas.consultar`** para la lista (**QC-161**). **Sin permiso nuevo**: el catálogo no se toca. Validado en el service (**QC-86**). |
| 2026-09-24 | ¿Qué datos lleva el Administrador? | **Los mismos campos y validaciones** del alta actual (**QC-4/QC-66**). |
| 2026-09-24 | ¿Unicidad? | **Dentro de la empresa** elegida: correo, usuario y documento (**QC-47**). |
| 2026-09-24 | ¿Contraseña? | **Nace sin ella** y recibe el enlace para fijarla (**QC-79**). |
| 2026-09-24 | ¿Baja? | **Lógica**, como la del resto de usuarios (**QC-4**). |
| 2026-09-24 | ¿E2E? | **Se difiere a QC-166**, que tiene las pantallas (precedente **QC-94 → QC-67**). Unitarios e integración **sí**, incluido el rechazo por permiso y el de crear un rol distinto de Administrador. |
| 2026-10-16 | ¿El último Administrador de una empresa? | **No se puede dar de baja**: primero hay que crear otro. El servidor lo rechaza con un error propio y la lista/detalle indica cuál es el último (para el diálogo de **QC-166**). |
| 2026-10-16 | ¿Cambiar de empresa a un Administrador? | **No.** La empresa queda fija desde el alta; para moverlo se da de baja en una y se crea en la otra. |
