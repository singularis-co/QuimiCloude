# QC-236 — Teléfono de cliente con código de país · requirements

> Fuente: la ficha de Jira QC-236 (alcance, D1–D6 y criterios de aceptación), las decisiones del
> humano del 2026-10-19 (D7–D10), la enmienda posterior a la implementación (D14–D21, humano y
> leader, 2026-10-19), la enmienda de la vuelta 2 de revisión (D22 y D23, leader y humano,
> 2026-10-19) y el tablero aprobado `docs/diseno/canvas/TelefonoCliente.dc.html`.
> El cómo técnico vive en `design.md`; el desglose, en `tasks.md`.

## Alcance

El teléfono del cliente deja de ser texto libre y pasa a ser un número internacional válido, que se
puede comparar con el identificador que manda WhatsApp (`wa_id`). Sin eso, la recepción de WhatsApp
no puede saber a qué cliente pertenece cada mensaje.

- **Formulario de cliente** (alta y edición): el teléfono se compone de **país** (`CountrySelect`,
  de QC-235) y **número**. Sigue siendo opcional.
  - Al **crear**, el país viene marcado con el de la empresa, si lo tiene. Si no, queda **vacío** y
    hay que elegirlo antes de escribir el número.
  - Al **editar**, muestra el país guardado del cliente.
- **Validación** con `libphonenumber-js`: el número tiene que ser válido para el país elegido. Si hay
  número, el país es obligatorio.
- **Datos:** `customers.phone_country` (ISO alfa-2, el mismo formato que `companies.country`) y
  `customers.phone_e164` (solo dígitos y con el prefijo del país, p. ej. `573001234567`, igual que el
  `wa_id`). `phone` se mantiene en formato legible.
- **Sin duplicados por empresa:** índice único parcial
  `(company_id, phone_e164) WHERE deleted_at IS NULL AND phone_e164 IS NOT NULL`. Error de dominio
  «Este teléfono ya está registrado en otro cliente».
- **Comparar con WhatsApp:** la función de dominio `phoneMatchesWaId(phoneE164, waId)` admite las
  variantes de México (`521`↔`52`), Argentina (`549`↔`54`) y Brasil (noveno dígito). La consume la
  recepción de WhatsApp; en esta ficha solo se crea y se prueba.
- **Migración de los datos existentes:** usa el país de la empresa, si lo tiene; si no, `CO`.
  - Los teléfonos que no se pueden interpretar quedan con `phone_e164` nulo y el aviso «Teléfono sin
    formato válido».
  - Si hay duplicados, el número se le asigna al cliente más reciente; los demás quedan nulos con el
    aviso «Teléfono duplicado: revisar».
  - `phone` no se modifica.
- **Lista de clientes:** muestra el número en formato internacional (`+57 300 123 4567`).

## Lo que NO entra

- Nada de WhatsApp: ni recepción, ni chat, ni vincular contactos. QC-238, QC-239 y QC-240 consumen
  `phoneMatchesWaId` y `phone_e164`, y este spec no fija nada de ellas.
- Varios teléfonos por cliente.
- Verificar que el número tenga WhatsApp.
- El teléfono de proveedores, usuarios y empresas: siguen como texto libre.

## Lo que cambia de un spec anterior

D3 y la validación con `libphonenumber-js` dejan sin efecto, **solo en lo que toca al teléfono**,
estas partes de `specs/QC-154-crud-de-clientes/requirements.md`:

- **R17** («no exigir ningún formato al teléfono»).
- **R19** y la **decisión 2** («Nada es único»): ahora el teléfono no se puede repetir dentro de la
  empresa.

Al correo y a los demás campos esas reglas les siguen aplicando igual.

## Decisiones cerradas (no reabrir)

| # | Decisión | Por qué | Cubierta por |
| --- | --- | --- | --- |
| D1 | `libphonenumber-js`, aprobada por el humano el 2026-10-09 | Valida números reales por país. La instaló QC-235. | R9, R11, R24 |
| D2 | País por defecto = el de la empresa, o vacío | El país correcto es el de los clientes de la empresa. Vacío obliga a elegir y no da nada por supuesto. | R2, R3 |
| D3 | Duplicados impedidos al guardar (decisión del humano) | Un mensaje de WhatsApp debe resolverse a un solo cliente. | R12, R13, R14 |
| D4 | `phone_e164` solo con dígitos | Mismo formato que el `wa_id`: se busca por igualdad, con índice. | R11, R16 |
| D5 | ISO alfa-2 en cliente y empresa | Un solo formato, compatible con `CountrySelect` y `libphonenumber-js`. | R15 |
| D6 | Se conserva el `phone` original | La migración no destruye nada y se puede revisar a mano. | R23, R27 |
| D7 | El campo Teléfono lleva su propio pase `/design` (`TelefonoCliente.dc.html`); no se aplica la excepción (humano, 2026-10-19) | Es un cambio visual del formulario de cliente. | R1, R33 |
| D8 | El país de la empresa aparece primero en la lista del selector de país del teléfono, con el rótulo «País de la empresa», y además viene marcado al crear. Se resuelve con una prop nueva de `CountrySelect` para fijar un país arriba (humano, 2026-10-19) | Resuelve el «Por confirmar» pendiente en `CountrySelect.dc.html`. | R5 |
| D9 | Los clientes migrados sin número válido o con número duplicado muestran el texto antiguo y una etiqueta, en la lista y en la edición. El texto de la etiqueta en cada sitio lo fija D13 (humano, 2026-10-19; ajustada por D13) | Lo migrado se puede revisar a mano sin perder el dato. | R30, R31 |
| D10 | El número se formatea al salir del campo, no mientras se escribe. Si se pega un número con `+`, el país se elige solo (humano, 2026-10-19) | Formatear mientras se escribe mueve el cursor. | R6, R7 |
| D11 | En los duplicados de la migración, «el más reciente» es el de `created_at` más tardío y, si empatan, el de `id` mayor (humano, 2026-10-19; era P1) | Un criterio estable y determinista. | R26 |
| D12 | Al editar un cliente migrado (con `phone_issue`), si se guarda con el número vacío se conserva el teléfono antiguo: no se tocan `phone`, `phone_country` ni `phone_issue`. El antiguo solo se reemplaza cuando se escribe un número válido (humano, 2026-10-19; era P2) | Editar otro dato del cliente no puede borrar sin querer su teléfono antiguo. | R32, R34 |
| D13 | En la lista, la etiqueta corta («Sin formato válido» / «Duplicado: revisar»), como en el tablero. En el formulario, la larga («Teléfono sin formato válido» / «Teléfono duplicado: revisar») (humano, 2026-10-19; era P3) | En la columna cabe la forma corta; en el formulario la etiqueta va sola bajo el campo. | R30, R31 |
| D14 | El formato del número es el que da `libphonenumber-js`, sin formato propio. En Colombia: `+57 300 1234567` en la lista y `300 1234567` en el campo. Corrige el ejemplo `+57 300 123 4567` del Alcance y del tablero (humano y leader, 2026-10-19, tras la implementación) | La librería ya sabe formatear cada país; un formato propio sería código nuevo que mantener. | R6, R11, R29 |
| D15 | La migración se llama `20261019130000_customers_phone_e164`, no `20261019120000_…` (humano y leader, 2026-10-19) | `20261019120000_whatsapp_connections_drop_meta_app_id` ya está en `dev` con ese sello. | R23 |
| D16 | En el build, el relleno corre después de `prisma migrate deploy` **y** de `prisma generate` (humano y leader, 2026-10-19) | El cliente Prisma en caché no conoce las columnas nuevas hasta que se regenera. | R28 |
| D17 | El relleno va empresa por empresa y solo sobre las empresas activas, sin `listCompaniesWithPending` ni `FOR UPDATE`. Los clientes de empresas desactivadas no se convierten y quedan como deuda (humano y leader, 2026-10-19) | `guard-ambito-empresa-clientes` prohíbe una consulta de `customers` que cruce empresas y el SQL crudo con `company_id` fuera de `company-scope.ts`. | R24 |
| D18 | La tarjeta de la lista en teléfono queda fuera de esta ficha, como deuda: la lista usa la misma tabla en todos los anchos (humano y leader, 2026-10-19) | `CustomerTable` no tiene tarjeta y hacerla es un cambio visual de la lista con código nuevo. | R29 |
| D19 | Al editar un cliente sin `phone_country`, el país viene marcado con el de la empresa, igual que en el alta (humano y leader, 2026-10-19) | El mismo criterio que D2: el país correcto es el de los clientes de la empresa. | R35 |
| D20 | `CountrySelect` gana la prop opcional `errorId` (humano y leader, 2026-10-19) | El error del país va bajo toda la fila del teléfono, fuera de la columna del selector, y debe quedar enlazado al disparador. Sin la prop, los usos de hoy no cambian. | R8 |
| D21 | La edición que conserva el teléfono antiguo (R34) usa dos `UPDATE` dentro de una transacción, con la condición repetida en el `where`, y no `SELECT … FOR UPDATE` (leader, 2026-10-19) | La misma guardia que en D17: `guard-ambito-empresa-clientes` prohíbe el SQL crudo con `company_id` fuera de `company-scope.ts`. | R10, R34 |
| D22 | Una fila pendiente de relleno (con `phone`, sin `phone_e164` y sin `phone_issue`) cuenta como teléfono antiguo. Guardarla con el número vacío conserva `phone`. La lista la muestra en gris, mono y sin etiqueta (variante `{ kind: 'legacy' }` de `describeCustomerPhone`). En la edición, el número abre vacío (leader, 2026-10-19, por D6 y D12) | Igual que con un migrado (D12): editar otro dato del cliente no puede borrar sin querer un teléfono que el relleno aún no ha convertido. | R10, R36 |
| D23 | La ayuda de la edición de una fila pendiente de relleno es «Antes: <phone>. Escribe un número para reemplazarlo; si lo dejas vacío, se conserva.» (humano, 2026-10-19) | El tablero no dibuja ese estado; el texto sigue el de los migrados (R31), sin etiqueta porque no hay aviso. | R36 |

## Requisitos (EARS)

### Formulario de cliente

- **R1.** El sistema DEBE presentar el teléfono del formulario de cliente, en alta y en edición, como
  un único campo «Teléfono» formado por dos controles: el país (un `CountrySelect`) y el número. Los
  dos deben ir agrupados bajo ese rótulo y el campo debe ser opcional.
- **R2.** CUANDO se abre el formulario de alta y la empresa del usuario tiene país, el sistema DEBE
  mostrar ese país ya marcado en el selector del teléfono.
- **R3.** SI la empresa del usuario no tiene país, ENTONCES el sistema DEBE abrir el formulario de
  alta con el selector del teléfono en «Sin país».
- **R4.** CUANDO se abre el formulario de edición de un cliente con `phone_e164`, el sistema DEBE
  mostrar marcado su `phone_country` y el número en el formato nacional de ese país.
- **R5.** MIENTRAS la empresa tiene país y el buscador del selector está vacío, el sistema DEBE
  mostrar ese país en un primer grupo con el rótulo «País de la empresa». Debajo, separado, va el
  grupo «Todos», con «Sin país» primero y el país de la empresa repetido en su sitio alfabético.
  - En cuanto el buscador tiene texto, desaparecen los rótulos y queda una sola lista filtrada.
  - Si la empresa no tiene país, no hay grupo de arriba.
- **R6.** CUANDO el campo del número pierde el foco y el número es válido para el país elegido, el
  sistema DEBE reescribirlo en el formato nacional que da `libphonenumber-js` para ese país (D14;
  p. ej. `3001234567` → `300 1234567`). Mientras se escribe, NO DEBE reformatearlo.
- **R7.** CUANDO se escribe o se pega un número que empieza por `+` y su prefijo identifica un país,
  el sistema DEBE marcar ese país en el selector al pegarlo o al salir del campo.
  - Si el prefijo no identifica un único país, DEBE dejar el selector como estaba.
- **R8.** SI se intenta guardar con número y sin país, ENTONCES el sistema DEBE rechazar el guardado
  sin escribir nada.
  - Debe mostrar «Elige el país del teléfono.» enlazado al selector de país.
  - El servidor debe responder con el código `customer_phone_country_required`.
- **R9.** SI el número no es válido para el país elegido según `libphonenumber-js` (validación de
  dígitos, no solo de longitud), ENTONCES el sistema DEBE marcarlo así:
  - Al salir del campo y al guardar, debe mostrar «Este número no es válido para <País> (+<prefijo>).»
    enlazado al número.
  - El servidor debe rechazar el guardado con el código `customer_phone_invalid`, sin escribir nada.
- **R10.** SI el número está vacío o solo tiene espacios, ENTONCES el sistema DEBE guardar el cliente
  sin teléfono: `phone`, `phone_country`, `phone_e164` y `phone_issue` nulos, sea cual sea el país
  marcado. Hay dos excepciones, las dos en la edición, en las que el teléfono antiguo se conserva:
  - un cliente migrado con `phone_issue` (R34);
  - un cliente pendiente de relleno, con `phone` y sin `phone_e164` ni `phone_issue` (R36, D22).

### Guardado y datos

- **R11.** CUANDO se guarda un número válido para su país, el sistema DEBE guardar:
  - en `phone_country`, el código ISO alfa-2 del país;
  - en `phone_e164`, solo dígitos con el prefijo del país;
  - en `phone`, el número en el formato internacional que da `libphonenumber-js` (D14);
  - `phone_issue` nulo.
  - Ejemplo: Colombia + `300 123 4567` guarda `CO`, `573001234567` y `+57 300 1234567`.
- **R12.** SI otro cliente vivo de la misma empresa ya tiene el mismo `phone_e164`, ENTONCES el
  sistema DEBE rechazar el alta o la edición sin escribir nada.
  - El código es `customer_duplicate_phone` y el mensaje, «Este teléfono ya está registrado en otro
    cliente.».
  - El formulario debe mostrarlo enlazado al número.
- **R13.** El sistema DEBE aceptar un `phone_e164` que ya tenga un cliente de otra empresa o un
  cliente dado de baja de la misma empresa.
  - Editar un cliente conservando su propio número no cuenta como duplicado.
- **R14.** El sistema DEBE garantizar R12 en la base: dos guardados simultáneos del mismo número en la
  misma empresa no pueden dejar dos clientes vivos con él.
- **R15.** El sistema DEBE aceptar en `phone_country` solo códigos de la lista de países de
  `libphonenumber-js`, el mismo formato que `companies.country`.
  - La base debe rechazar cualquier valor que no sean dos letras mayúsculas.
  - El servidor debe rechazar un código que no esté en la lista con `invalid_input`.
- **R16.** La base DEBE rechazar un `phone_e164` que no sea solo de dígitos (sin `+`, sin espacios),
  de 7 a 15 dígitos y sin empezar por `0`. También debe rechazar un `phone_e164` sin
  `phone_country`.
- **R17.** El sistema DEBE validar el teléfono **después** de comprobar el permiso
  `clientes.modificar`. La empresa que cuenta para R12 y R13 es siempre la del actor, nunca la de la
  entrada.

### Comparar con WhatsApp

- **R18.** CUANDO `phoneE164` y `waId` son la misma cadena de dígitos, `phoneMatchesWaId` DEBE
  devolver `true`.
- **R19.** `phoneMatchesWaId` DEBE devolver `true` para la variante de México en los dos sentidos:
  `52` + 10 dígitos frente a `521` + los mismos 10 dígitos.
- **R20.** `phoneMatchesWaId` DEBE devolver `true` para la variante de Argentina en los dos sentidos:
  `54` + 10 dígitos frente a `549` + los mismos 10 dígitos.
- **R21.** `phoneMatchesWaId` DEBE devolver `true` para la variante de Brasil en los dos sentidos:
  `55` + área de 2 dígitos + 8 dígitos frente a `55` + la misma área + `9` + los mismos 8 dígitos.
- **R22.** `phoneMatchesWaId` DEBE devolver `false` en estos casos:
  - números distintos;
  - una entrada vacía o con algo que no sea un dígito;
  - las variantes de R19–R21 aplicadas a un país que no es el suyo (p. ej. `57` frente a `571`).

### Migración de los datos existentes

- **R23.** La migración de esquema (`20261019130000_customers_phone_e164`, D15) DEBE añadir `phone_country`, `phone_e164` y `phone_issue`, las tres
  nulas, sus restricciones y el índice único parcial de R14.
  - NO DEBE modificar `phone` ni ninguna otra columna o fila.
  - Su `down.sql` DEBE revertirla exactamente, y aplicar UP, DOWN y UP otra vez debe funcionar.
- **R24.** CUANDO corre el relleno de teléfonos, el sistema DEBE recorrer las empresas activas una
  por una e interpretar cada cliente vivo de esa empresa que tenga `phone` y no esté procesado
  todavía (`phone_e164` y `phone_issue` nulos):
  - lo interpreta con `libphonenumber-js`, con el país de su empresa o, si la empresa no tiene, con
    `CO`;
  - si el número es válido, guarda `phone_country` y `phone_e164` como en R11.
  - Los clientes de una empresa desactivada NO DEBEN modificarse: quedan sin convertir, como deuda
    (D17).
- **R25.** SI el `phone` de un cliente no se puede interpretar como un número válido, ENTONCES el
  relleno DEBE dejar:
  - `phone_e164` nulo;
  - `phone_country` con el país usado;
  - `phone_issue = 'invalid_format'`.
- **R26.** SI varios clientes vivos de una misma empresa dan el mismo `phone_e164`, ENTONCES el
  relleno DEBE asignárselo solo al más reciente: el de `created_at` más tardío y, si empatan, el de
  `id` mayor (D11). Los demás quedan
  con `phone_e164` nulo, `phone_country` con el país usado y `phone_issue = 'duplicate'`.
  - Si el número ya lo tiene un cliente vivo guardado después de la migración, todos los migrados con
    ese número quedan como `duplicate`.
- **R27.** El relleno NO DEBE modificar `phone` ni ninguna columna que no sea `phone_country`,
  `phone_e164` o `phone_issue`.
  - Volver a correrlo sobre datos ya procesados NO DEBE cambiar ninguna fila.
  - Con cero clientes, debe terminar sin error.
- **R28.** CUANDO el build aplica las migraciones (local, preview y production, según
  `scripts/build.mjs`), el sistema DEBE correr el relleno después de `prisma migrate deploy` y de
  `prisma generate`, antes de cualquier otro paso que use la base (D16).
  - Si el relleno falla, el build debe fallar.

### Lista de clientes

- **R29.** El sistema DEBE mostrar en la columna «Teléfono» de la lista, en todos los anchos (la
  misma tabla también a ≤ 640 px; la tarjeta queda fuera, D18), el `phone_e164` del cliente en el
  formato internacional que da `libphonenumber-js` (D14; p. ej. `+57 300 1234567`).
- **R30.** SI un cliente tiene `phone_issue`, ENTONCES la lista DEBE mostrar su `phone` antiguo en
  gris, seguido de una `StatusBadge` en tono `waiting` con la etiqueta corta (D13):
  - «Sin formato válido» si es `invalid_format`;
  - «Duplicado: revisar» si es `duplicate`.
- **R31.** CUANDO se abre la edición de un cliente con `phone_issue`, el sistema DEBE mostrar:
  - el número vacío y el país marcado con su `phone_country`;
  - bajo el campo, la etiqueta larga (D13), «Teléfono sin formato válido» o «Teléfono duplicado:
    revisar», seguida del texto de ayuda:
    - en el caso inválido: «Antes: <phone>. Escribe un número válido para reemplazarlo; si lo dejas
      vacío, se conserva.»;
    - en el duplicado: «Antes: <phone>, que ya tiene otro cliente. Escribe otro número para
      reemplazarlo; si lo dejas vacío, se conserva.».
- **R32.** CUANDO se guarda la edición de un cliente con `phone_issue` y un número válido, el sistema
  DEBE aplicar R11 y R12, reemplazar el `phone` antiguo y dejar `phone_issue` nulo.
- **R34.** SI se guarda la edición de un cliente con `phone_issue` y el número está vacío o solo
  tiene espacios, ENTONCES el sistema DEBE conservar sin cambios `phone`, `phone_country`,
  `phone_e164` (nulo) y `phone_issue`, y guardar normalmente los demás datos del cliente (D12).
  - Elegir otro país sin escribir número no cambia nada del teléfono.
- **R35.** CUANDO se abre el formulario de edición de un cliente sin `phone_country`, el sistema DEBE
  mostrar marcado en el selector del teléfono el país de la empresa del usuario, igual que en el
  alta (R2, D19), y el número vacío.
  - Si la empresa no tiene país, el selector queda en «Sin país» (como R3).
  - Un cliente con `phone_country` sigue mostrando el suyo (R4, R31).
- **R36.** SI un cliente vivo tiene `phone` y no tiene `phone_e164` ni `phone_issue` (pendiente de
  relleno, D22), ENTONCES el sistema DEBE tratar su `phone` como teléfono antiguo:
  - en la columna «Teléfono» de la lista, DEBE mostrar su `phone` en gris y en letra monoespaciada,
    sin etiqueta;
  - al abrir su edición, DEBE mostrar el número vacío, el país según R35 y, bajo el campo y sin
    etiqueta, la ayuda «Antes: <phone>. Escribe un número para reemplazarlo; si lo dejas vacío, se
    conserva.» (D23);
  - al guardar su edición con el número vacío o solo con espacios, DEBE conservar sin cambios `phone`,
    `phone_country`, `phone_e164` y `phone_issue` (los tres últimos, nulos) y guardar normalmente los
    demás datos del cliente. Elegir otro país sin escribir número no cambia nada del teléfono.
  - Con un número válido, rige R11 y R12, como en cualquier guardado.

### Plataformas

- **R33.** El sistema DEBE pintar el campo según el ancho de la pantalla, como el tablero
  `TelefonoCliente.dc.html`:
  - **Escritorio (> 640 px):** una fila con el país en 200 px y el número.
  - **Teléfono (≤ 640 px):**
    - el disparador del país compacto, de 112 px, con el código y el prefijo (`CO +57`) y el nombre
      completo en su `aria-label`;
    - la lista sale en la hoja inferior titulada «País del teléfono»;
    - los controles miden 48 px.
  - **En los dos casos:**
    - el selector se llama «País del teléfono» y el número, «Número de teléfono», para lectores de
      pantalla;
    - las zonas táctiles miden al menos 44 × 44 px;
    - la letra del número es de al menos 16 px.

## Criterios de aceptación de la ficha → requisitos

| Criterio | Requisitos |
| --- | --- |
| Empresa con país `CO`: el formulario de alta abre con Colombia marcado | R2, R5 (y en la edición de un cliente sin país, R35) |
| Empresa sin país: abre vacío; escribir un número sin elegir país da error | R3, R8 |
| `+57 300 123 4567` guarda `phone_country=CO` y `phone_e164=573001234567` | R7, R11 |
| Un número no válido para el país se rechaza en el campo | R9 |
| Un teléfono duplicado se rechaza en la misma empresa; en otra empresa o sobre un cliente dado de baja se permite | R12, R13, R14 |
| `phoneMatchesWaId` da verdadero en las variantes de México, Argentina y Brasil, y falso con números distintos | R18–R22 |
| La migración convierte los válidos, deja nulos y marcados los no válidos y los duplicados, y no toca `phone` | R23–R28 |
| `./init.sh` y `gate-completo` en verde | (gate, no es un `R<n>`) |

## Preguntas abiertas

Ninguna. P1, P2 y P3 las cerró el humano el 2026-10-19 al aprobar el spec: ahora son D11, D12 y D13.
Los siete puntos que dejó abiertos la implementación los cerraron el humano y el leader el mismo día:
son D14–D21. Lo que dejó abierto la vuelta 2 de revisión (la fila pendiente de relleno, V2-H1) lo
cerraron el leader y el humano el mismo día: son D22 y D23.
