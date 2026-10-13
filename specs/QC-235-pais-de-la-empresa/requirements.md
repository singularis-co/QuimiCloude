# QC-235 — País de la empresa

> **Alcance.** La empresa gana un país opcional (ISO 3166-1 alfa-2), valor por defecto para los
> teléfonos de sus clientes. Entra: columna `companies.country` (nullable), acción de servidor para
> fijarlo o vaciarlo (autorizada en el service con `empresas.modificar`), componente compartido
> `CountrySelect` (países de `getCountries()`, nombres de `Intl.DisplayNames('es')`, prefijo,
> búsqueda por nombre o prefijo, valor vacío, sin lógica de empresa) y la dependencia
> `libphonenumber-js` con su fila en `docs/dependencias.md`.
>
> **Lo que NO entra.** La pantalla de empresas y su ruta `/maestro/empresas` (QC-166). El E2E
> (diferido a QC-166). Que el Administrador edite su país. Otros datos de la empresa. Alta, baja o
> renombrado de empresas (QC-162). El teléfono del cliente (QC-236).
>
> Sembrado por `/afinar-feature` el 2026-10-13. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

«La lista de países» es, en todo este archivo, la que devuelve `getCountries()` de
`libphonenumber-js` en la versión instalada. «Prefijo» es el código de llamada internacional que
esa librería da para el país (`57` para `CO`), escrito con `+` delante al mostrarlo.

### El país de la empresa (servidor)

- **R1.** El sistema DEBE guardar para cada empresa un país opcional en la columna `country` de
  `companies`: un código ISO 3166-1 alfa-2 o vacío (`null`). Toda empresa que ya exista DEBE quedar
  sin país al aplicar el cambio de esquema.
- **R2.** CUANDO un actor con el permiso `empresas.modificar` pide fijar el país de una empresa
  activa con un código que está en la lista de países, el sistema DEBE guardar ese código en la
  empresa y no DEBE cambiar ningún otro dato de la empresa salvo su marca de última actualización.
- **R3.** CUANDO un actor con el permiso `empresas.modificar` pide fijar el país de una empresa
  activa con el valor vacío, el sistema DEBE dejar la empresa sin país (`null`).
- **R4.** SI el actor no existe, no trae conjunto de permisos o su conjunto no contiene
  exactamente `empresas.modificar` (también si solo trae `empresas.consultar`), ENTONCES el sistema
  DEBE rechazar la petición con el código `unauthorized`, antes de validar la entrada y sin leer ni
  escribir ninguna empresa.
- **R5.** SI el actor tiene `empresas.modificar` pero no pertenece a ninguna empresa (el Maestro),
  ENTONCES el sistema DEBE autorizarlo igual: la empresa del actor no interviene en esta operación.
- **R6.** SI el país pedido no es vacío y no está tal cual en la lista de países (minúsculas como
  `co`, espacios alrededor, tres letras como `COL`, o un código inexistente como `ZZ`), ENTONCES el
  sistema DEBE rechazar la petición con el código `invalid_input` sin modificar ninguna empresa.
- **R7.** SI falta el campo del país, o el identificador de la empresa falta o no es un UUID,
  ENTONCES el sistema DEBE rechazar la petición con el código `invalid_input` sin modificar
  ninguna empresa.
- **R8.** SI la empresa pedida no existe o está dada de baja, ENTONCES el sistema DEBE rechazar la
  petición con el código `company_not_found` sin modificar ninguna empresa.
- **R9.** CUANDO la acción de servidor recibe la petición, el sistema DEBE tomar la identidad y los
  permisos del actor de la sesión, nunca de la entrada; DEBE responder `{ status: 'success' }` o el
  estado de error con su `code`; y no DEBE revalidar ninguna ruta, porque la pantalla
  (`/maestro/empresas`) aún no existe.
- **R10.** SI se escribe directamente en la base un país que no son exactamente dos letras
  mayúsculas de la A a la Z, ENTONCES la base DEBE rechazar la escritura.
- **R11.** El cambio de esquema DEBE tener su reversión, que deja `companies` exactamente como
  estaba antes (sin la columna ni su restricción).

### La dependencia

- **R12.** El sistema DEBE declarar `libphonenumber-js` en `package.json` solo con su fila en
  `docs/dependencias.md` en estado `aprobada`, con los cuatro checks y la fecha de aprobación del
  humano; la guardia de dependencias aprobadas DEBE quedar en verde.

### `CountrySelect` (componente compartido)

- **R13.** `CountrySelect` DEBE ofrecer una opción por cada país de la lista de países, con su
  nombre en español (`Intl.DisplayNames('es', { type: 'region' })`) y su prefijo, ordenadas por
  nombre con `localeCompare` en español. Los países que comparten prefijo (`+1`, `+7`) DEBEN
  aparecer como opciones separadas.
- **R14.** MIENTRAS el buscador está vacío, `CountrySelect` DEBE ofrecer «Sin país» como primera
  opción, delante de todos los países.
- **R15.** MIENTRAS la lista está cerrada, el disparador DEBE mostrar el valor como
  «Nombre (+prefijo)» (`Colombia (+57)`), o «Sin país» en tono atenuado si el valor es `null`; DEBE
  estar nombrado por la etiqueta del campo y anunciar que abre una lista y si está abierta.
- **R16.** CUANDO el usuario escribe en el buscador un texto que no son solo dígitos (con o sin un
  `+` delante), `CountrySelect` DEBE mostrar solo los países cuyo nombre contiene ese texto sin
  distinguir tildes ni mayúsculas (`peru` encuentra Perú), y no DEBE mostrar «Sin país».
- **R17.** CUANDO el usuario escribe en el buscador solo dígitos, con o sin un `+` delante,
  `CountrySelect` DEBE mostrar solo los países cuyo prefijo empieza por esos dígitos (`57` y `+57`
  encuentran Colombia; `1` encuentra, por separado, Canadá, Estados Unidos y los demás de `+1`).
- **R18.** SI ningún país coincide con el texto buscado, ENTONCES `CountrySelect` DEBE mostrar
  «Ningún país coincide con «<texto>».».
- **R19.** CUANDO el usuario elige una opción (clic, toque o Enter sobre la resaltada),
  `CountrySelect` DEBE notificar el código ISO del país, o `null` si eligió «Sin país», cerrar la
  lista y vaciar el buscador.
- **R20.** MIENTRAS la lista está abierta, las flechas arriba y abajo DEBEN mover el resaltado entre
  las opciones visibles; CUANDO el usuario pulsa Escape o cierra la lista sin elegir,
  `CountrySelect` DEBE cerrarla sin notificar ningún cambio.
- **R21.** CUANDO la lista se abre con un país elegido, la opción de ese país DEBE aparecer marcada
  como elegida y desplazada dentro del área visible de la lista.
- **R22.** DONDE la ventana mide más de 640 px de ancho (escritorio y tablet), `CountrySelect` DEBE
  abrir la lista en una capa anclada bajo el campo, con el buscador arriba y opciones de al menos
  44 px de alto.
- **R23.** DONDE la ventana mide 640 px de ancho o menos (teléfono), `CountrySelect` DEBE abrir la
  lista en una hoja inferior con la etiqueta del campo como título, un botón «Cerrar», un buscador
  de 48 px de alto que recibe el foco al abrir y opciones de al menos 48 px de alto.
- **R24.** MIENTRAS `CountrySelect` está deshabilitado, no DEBE abrir la lista ni notificar
  cambios.
- **R25.** DONDE `CountrySelect` recibe un mensaje de error, DEBE marcar el disparador como
  inválido y mostrar el mensaje bajo el campo, enlazado al disparador como su descripción.
- **R26.** `CountrySelect` DEBE funcionar montado solo, con su valor, su notificación de cambio y su
  etiqueta, sin datos ni lógica de empresa y sin ninguna llamada al servidor, para que QC-166 y
  QC-236 lo reutilicen sin cambios.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| ¿Quién edita el país? | R2, R4, R5 |
| ¿Formato? | R1, R6, R10 |
| ¿Lista de países propia o compartida? | R13, R26 |
| ¿Librería? | R6, R12, R13 |
| ¿Pantalla aquí o en el Área del Maestro? | R9, R26 |
| ¿Ruta? | R9 |
| ¿E2E? | R26 (el componente se prueba montado solo; el servidor, con unitarios e integración) |
| Identificadores de DB | R1 |
| ¿Diseño de CountrySelect? | R14–R25 |

## Preguntas abiertas

- Hasta que salga QC-166, ninguna empresa tiene país desde la app. ¿El seed de demostración
  (QC-230) debe fijar `CO` a la empresa demo? No se decidió.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-09 | ¿Quién edita el país? | El Maestro, con `empresas.modificar`. Sin permiso nuevo. |
| 2026-10-09 | ¿Formato? | ISO 3166-1 alfa-2, el mismo que `CountryCode` de `libphonenumber-js`. |
| 2026-10-09 | ¿Lista de países propia o compartida? | Un solo `CountrySelect`, reutilizado en QC-236. |
| 2026-10-09 | ¿Librería? | `libphonenumber-js`, aprobada por el humano; los cuatro checks se hacen antes de instalar. |
| 2026-10-13 | ¿Pantalla aquí o en el Área del Maestro? | En QC-166. QC-235 deja el servidor y el componente listos. |
| 2026-10-13 | ¿Ruta? | `/maestro/empresas`, inaugurada por QC-166. |
| 2026-10-13 | ¿E2E? | Diferido a QC-166. Aquí: unitarios e integración del service, y test del componente. |
| 2026-10-13 | ¿Diseño de CountrySelect? | Tablero `docs/diseno/canvas/CountrySelect.dc.html`, aprobado por el humano. |
| 2026-10-13 | ¿CountrySelect como excepción de guard-buscadores? | Sí, cuarta excepción de R20 de QC-233; lista local, sin servidor. |
| — | Identificadores de DB | En inglés (heredado de QC-4). |
