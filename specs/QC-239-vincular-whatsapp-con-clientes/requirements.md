# QC-239 — vincular-whatsapp-con-clientes · requirements.md

> **Zona:** backend · **Complejidad:** high · **depends_on:** QC-236, QC-238 · **Rama:** `feature/QC-239-vincular-whatsapp-con-clientes`
>
> **Alcance.** Cada conversación de WhatsApp queda vinculada a un cliente cuando su número es de un
> solo cliente de la empresa. Si no, la conversación sigue visible sin cliente y se puede vincular a
> mano. Un cliente puede tener varios teléfonos (uno principal) y un mismo número puede ser de varios
> clientes. Un número se puede bloquear: sus mensajes entrantes se descartan.
>
> - **Teléfonos de cliente (n:m):** tabla de teléfonos de la empresa y tabla puente cliente↔teléfono
>   con `main` (como máximo un principal por cliente). Los teléfonos que ya tienen los clientes
>   (QC-236) se migran como principales. Se retira el índice único `(company_id, phone_e164)` de
>   QC-236 y su error «Este teléfono ya está registrado en otro cliente».
> - **Al recibir** (en la transacción de QC-238): si el número es de **exactamente un** cliente activo
>   (`phoneMatchesWaId`, QC-236), el contacto queda con ese `customerId`. Con cero o varios, queda sin
>   cliente, visible.
> - **Al cambiar los teléfonos de un cliente** (alta, edición del principal en el formulario,
>   vincular, desvincular): se recalcula. Un contacto sin cliente cuyo número pasa a ser de un solo
>   cliente se vincula. Si se quita un número de un cliente, sus contactos con ese número se
>   desvinculan. Un vínculo elegido a mano no lo pisa el recálculo mientras el cliente conserve ese
>   número.
> - **Vincular** (caso de uso + Server Action): une un contacto con un cliente de la empresa y agrega
>   el número a los teléfonos del cliente (principal si no tenía; si no, secundario).
>   **Desvincular:** quita el vínculo. **Bloquear / desbloquear** un contacto.
> - **Bloqueo:** la recepción responde `200` y no guarda los mensajes ni actualiza el contacto. Los
>   statuses de salientes se siguen procesando.
> - Las tres acciones exigen `clientes.modificar`, validado en el service.
>
> **Lo que NO entra.**
> - Listar conversaciones (con el número como nombre) y el filtro de bloqueados: QC-245.
> - Botones de vincular, desvincular y bloquear en el chat: QC-246.
> - Ver, agregar, quitar teléfonos y marcar el principal: los casos de uso y las acciones en QC-303;
>   en el formulario de cliente, QC-302. Aquí el formulario sigue editando solo el principal.
> - Responder a un contacto sin cliente: QC-240.
> - Purga de contactos: eliminada.
> - Borrar un cliente: QC-245 (D5).
>
> Sembrado por `/afinar-feature` el 2026-10-20. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

Vocabulario de estos requisitos:

- **Número de un contacto:** su `wa_id`. **Coincide** con un teléfono cuando `phoneMatchesWaId`
  (QC-236) da verdadero, con sus variantes de México, Argentina y Brasil.
- **Dueño** de un número: un cliente **vivo** (sin baja) de la misma empresa que tiene un teléfono
  **vivo** que coincide con él.
- **Vínculo manual:** el que eligió un usuario al vincular. **Automático:** el que puso el sistema.
- **Regla de vínculo** de un contacto, en este orden:
  1. si tiene vínculo manual y su cliente sigue siendo dueño del número, se queda como está;
  2. si no, y el número tiene **exactamente un** dueño, queda vinculado a él, como automático;
  3. si no, queda sin cliente.

### Teléfonos de cliente

- **R1.** El sistema DEBE guardar los teléfonos como números de solo dígitos (formato de
  `phone_e164`), uno por número y empresa, y la relación entre cliente y teléfono en una tabla
  puente con la marca `main`. Las dos tablas llevan la columna de empresa.
- **R2.** El sistema DEBE admitir que un cliente tenga varios teléfonos y que un mismo número sea
  teléfono de varios clientes vivos de la misma empresa.
- **R3.** SI una escritura deja a un cliente con más de un teléfono principal vivo, o con el mismo
  número vinculado dos veces, ENTONCES la base DEBE rechazarla.
- **R4.** CUANDO se quita un teléfono de un cliente, el sistema DEBE marcar el vínculo con borrado
  lógico (`deleted_at`). No DEBE borrar ninguna fila de teléfonos ni de vínculos.
- **R5.** CUANDO se aplica la migración, el sistema DEBE crear, por cada cliente vivo con
  `phone_e164`, su número y su vínculo como principal. Los clientes sin `phone_e164` (sin teléfono,
  con `phone_issue` o pendientes de relleno) DEBEN quedar sin vínculos.
- **R6.** CUANDO se revierte la migración, el sistema DEBE dejar el esquema como estaba antes de
  ella. SI para entonces dos o más clientes vivos de una empresa comparten `phone_e164`, ENTONCES
  DEBE conservar el número en el más reciente y dejar a los demás con `phone_issue = 'duplicate'`
  y sin `phone_e164`, con el mismo criterio de desempate que el relleno de QC-236 (D11).
- **R7.** CUANDO se da de alta o se edita un cliente con un número que ya tiene otro cliente vivo
  de la empresa, el sistema DEBE guardarlo. El error «Este teléfono ya está registrado en otro
  cliente» (`customer_duplicate_phone`) deja de existir.
- **R8.** MIENTRAS un cliente vivo tenga `phone_e164`, el sistema DEBE mantener exactamente un
  vínculo principal vivo con ese mismo número. MIENTRAS no lo tenga, el cliente NO DEBE tener
  ningún vínculo principal vivo.
- **R9.** CUANDO el alta guarda un cliente con número, el sistema DEBE crear su vínculo principal en
  la misma transacción.
- **R10.** CUANDO la edición cambia el número de un cliente por otro, el sistema DEBE dejar el
  número anterior como teléfono secundario del cliente y el número nuevo como principal, en la
  misma transacción. Si el número nuevo ya era un secundario del cliente, se convierte en
  principal. Los contactos del número anterior DEBEN conservar su vínculo con el cliente.
- **R11.** CUANDO la edición deja el número vacío, el sistema DEBE quitar el vínculo principal solo
  si el cliente tenía `phone_e164`. SI tenía un teléfono antiguo (con `phone_issue` o pendiente de
  relleno), ENTONCES NO DEBE cambiar ningún vínculo y conserva el teléfono antiguo como hasta ahora
  (QC-236, D12 y D22).
- **R12.** CUANDO la edición guarda el mismo número que ya tenía el cliente, el sistema NO DEBE
  cambiar sus vínculos.
- **R13.** CUANDO el relleno de teléfonos antiguos (QC-236) convierte el teléfono de un cliente, el
  sistema DEBE crear su vínculo principal en la misma transacción. NO DEBE marcarlo como
  `duplicate` porque otro cliente tenga el mismo número.
- **R49.** CUANDO corre el relleno, el sistema DEBE reconvertir a cada cliente vivo con
  `phone_issue = 'duplicate'`: si su teléfono antiguo es un número válido para su país, queda en
  `phone_e164`, sin aviso, y como su vínculo principal (R8), en la misma transacción. SI ya no es
  válido, ENTONCES queda con `phone_issue = 'invalid_format'`. Tras una pasada, ningún cliente vivo
  conserva `phone_issue = 'duplicate'`, y la siguiente pasada no cambia nada.
- **R14.** El sistema DEBE mostrar en la lista y en el formulario de clientes el mismo teléfono, con
  el mismo formato y las mismas etiquetas de aviso que antes de esta feature: el principal o, si no
  hay principal, el teléfono antiguo con su aviso.

### Al recibir un mensaje

- **R15.** CUANDO llega un mensaje entrante de un contacto no bloqueado, el sistema DEBE aplicarle
  la regla de vínculo en la misma transacción en que guarda el contacto y el mensaje, con los
  dueños de la empresa de la conexión.
- **R16.** SI el número de un contacto tiene cero o varios dueños y el contacto no tiene vínculo
  manual vigente, ENTONCES el sistema DEBE dejarlo sin cliente, y guardar igualmente el contacto y
  sus mensajes.
- **R17.** El sistema DEBE contar como dueño solo a un cliente vivo de la misma empresa con un
  teléfono vivo. Un cliente dado de baja, un vínculo quitado o un cliente de otra empresa no son
  dueños.
- **R18.** SI un contacto tiene vínculo automático con un cliente y el número pasa a tener varios
  dueños, ENTONCES el siguiente mensaje entrante DEBE dejarlo sin cliente. SI tiene vínculo manual
  y su cliente sigue siendo dueño, ENTONCES DEBE conservarlo aunque haya otros dueños.
- **R19.** El sistema DEBE reconocer como el mismo número las variantes de México (`521`/`52`),
  Argentina (`549`/`54`) y Brasil (con o sin el noveno dígito), tanto al recibir como al
  recalcular.
- **R20.** SI falla cualquier paso de la recepción, incluida la búsqueda de dueños, ENTONCES el
  sistema NO DEBE guardar nada de ese lote y DEBE responder un error, como en QC-238.

### Al cambiar los teléfonos de un cliente

- **R21.** CUANDO cambian los teléfonos de un cliente (alta con número, edición que cambia o vacía el
  número, vincular, desvincular), el sistema DEBE aplicar la regla de vínculo a todos los contactos
  de la empresa cuyo número coincide con algún número añadido o quitado, en la misma transacción
  que el cambio.
- **R22.** CUANDO un contacto sin cliente pasa a tener un único dueño por un cambio de teléfonos, el
  sistema DEBE vincularlo a ese dueño como automático.
- **R23.** CUANDO se quita un número de un cliente, el sistema DEBE desvincular de ese cliente a los
  contactos con ese número, sea manual o automático su vínculo, y aplicarles la regla de vínculo
  con los dueños que queden.
- **R24.** CUANDO otro cliente añade un número de un contacto con vínculo automático, el sistema
  DEBE dejar ese contacto sin cliente. SI el vínculo es manual, ENTONCES DEBE conservarlo.
- **R25.** SI un cambio de teléfonos no añade ni quita ningún número, ENTONCES el sistema NO DEBE
  modificar ningún contacto.

### Vincular

- **R26.** CUANDO un usuario vincula un contacto con un cliente vivo de su empresa, el sistema DEBE
  dejar el contacto con ese cliente, como vínculo manual, y guardar qué usuario lo eligió.
- **R27.** CUANDO se vincula y el cliente no tiene ningún teléfono que coincida con el número del
  contacto, el sistema DEBE añadir ese número a los teléfonos del cliente: como principal si no
  tenía principal, y como secundario si ya lo tenía.
- **R28.** CUANDO el número añadido al vincular queda como principal, el cliente DEBE pasar a
  mostrar ese teléfono, con su país, igual que si lo hubiera escrito en el formulario.
- **R29.** SI el cliente ya tiene un teléfono que coincide con el número del contacto, ENTONCES
  vincular NO DEBE añadir otro teléfono ni cambiar cuál es el principal.
- **R30.** SI el número del contacto no es un teléfono válido en ninguna de sus variantes (R19),
  ENTONCES el sistema DEBE rechazar el vínculo con un error y no cambiar nada.
- **R31.** SI el cliente no existe, está dado de baja o es de otra empresa, ENTONCES el sistema DEBE
  responder `customer_not_found` y no cambiar nada.
- **R32.** SI el contacto no existe o es de otra empresa, ENTONCES el sistema DEBE responder
  `whatsapp_contact_not_found` y no cambiar nada. Los dos casos se responden igual.
- **R33.** El vínculo, el número añadido al cliente y el recálculo (R21) DEBEN confirmarse o
  deshacerse juntos.

### Desvincular

- **R34.** CUANDO un usuario desvincula un contacto con cliente, el sistema DEBE quitar de ese
  cliente los teléfonos que coinciden con el número del contacto (R4), quitar el vínculo y aplicar
  el recálculo (R21), todo en una transacción.
- **R35.** CUANDO el teléfono quitado al desvincular era el principal, el cliente DEBE quedar sin
  principal y sin teléfono mostrado. NO DEBE convertir otro teléfono en principal.
- **R36.** SI el contacto no tiene cliente, ENTONCES desvincular NO DEBE cambiar nada y DEBE
  responder éxito.

### Bloquear y desbloquear

- **R37.** CUANDO un usuario bloquea un contacto, el sistema DEBE marcarlo como bloqueado con la
  fecha y el usuario. Bloquear un contacto ya bloqueado NO DEBE cambiar la marca.
- **R38.** CUANDO un usuario desbloquea un contacto, el sistema DEBE quitar la marca. Los mensajes
  que llegaron durante el bloqueo NO DEBEN aparecer.
- **R39.** MIENTRAS un contacto está bloqueado, CUANDO llega un mensaje entrante suyo, el sistema
  DEBE responder `200`, NO DEBE guardar el mensaje y NO DEBE modificar el contacto (nombre de
  perfil, fechas ni vínculo).
- **R40.** MIENTRAS un contacto está bloqueado, el sistema DEBE seguir aplicando los statuses de los
  mensajes salientes hacia él y registrando la recepción del webhook en la conexión
  (`last_webhook_at`).
- **R41.** CUANDO un mismo lote trae mensajes de un contacto bloqueado y de otro que no lo está, el
  sistema DEBE guardar solo los del que no está bloqueado.
- **R42.** El sistema DEBE conservar el contacto y todos sus mensajes al desvincular, bloquear o
  desbloquear. No existe purga de contactos ni de mensajes.

### Autorización, ámbito y datos

- **R43.** Vincular, desvincular, bloquear y desbloquear DEBEN exigir el permiso
  `clientes.modificar`, validado en el caso de uso antes de leer la entrada o tocar datos. Sin él,
  el sistema DEBE responder `unauthorized` y no cambiar nada.
- **R44.** SI el añadido `integraciones` no está activo en la empresa del actor, ENTONCES las cuatro
  acciones DEBEN rechazarse con la misma respuesta que sin permiso.
- **R45.** Toda lectura y escritura de esta feature DEBE limitarse a la empresa del actor, o a la de
  la conexión al recibir. Un identificador de otra empresa DEBE tratarse como inexistente.
- **R46.** El sistema DEBE ofrecer las cuatro acciones como Server Actions que devuelven éxito o el
  error traducido del catálogo, sin pantalla propia.
- **R47.** El sistema DEBE impedir en la base que un contacto apunte a un cliente de otra empresa, o
  que un vínculo de teléfono una a un cliente y un número de empresas distintas.
- **R48.** Las tablas nuevas DEBEN tener RLS activada y forzada, `created_at`/`updated_at`, e
  identificadores en inglés. La migración DEBE tener su `down.sql`, que la revierte (R6).

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| Los números desconocidos se guardan y se ven | R16 |
| Un número puede ser de varios clientes (n:m) | R2, R7 |
| Varios teléfonos por cliente, como máximo un principal | R2, R3, R8 |
| Número de varios clientes: sin cliente hasta elegir a mano; con un dueño, solo | R15, R16, R18, R22, R24, R26 |
| Vincular agrega el número; quitar el número desvincula; hay desvincular | R27–R29, R23, R34–R36 |
| Purga eliminada | R42 |
| Bloqueados: se descartan con `200`; desbloquear no recupera | R37–R41 |
| Vincula, desvincula y bloquea quien tenga `clientes.modificar` | R43 |
| Los varios teléfonos solo en backend; el formulario edita el principal | R10–R12, R14 |
| Se responde a desconocidos (QC-240) | R16 (el contacto sin cliente es un contacto completo) |
| Heredado: borrado lógico, fechas, inglés | R4, R48 |
| Heredado: `phone_e164` solo dígitos; variantes MX/AR/BR | R1, R19 |
| Heredado: recepción en una transacción | R15, R20 |
| Cambiar el principal en el formulario: el anterior pasa a secundario | R10 |
| Desvincular quita el número del cliente | R34, R35 |
| Los migrados con `duplicate` se reconvierten | R49 |
| Las acciones de teléfonos van en QC-303 | R10–R12 (aquí solo el principal del formulario) |
| Vincular a un cliente con solo teléfono antiguo con aviso: el de WhatsApp pasa a principal | R27, R28 |

## Preguntas abiertas

- **Para `design.md`, no para el humano:** cómo conviven `customers.phone`, `phone_country`,
  `phone_e164` y `phone_issue` (QC-236) con la tabla nueva: espejo del principal o mover las
  columnas. Condición: la lista, el formulario, los migrados con `phone_issue` (D12, D22 de QC-236)
  y `phoneMatchesWaId` siguen funcionando igual. Con al menos una alternativa descartada.
  → **Resuelta en `design.md` § 3**: las columnas se quedan y son espejo del principal (R8, R14).
- **Para `design.md`:** cómo se marca un vínculo elegido a mano para que el recálculo no lo pise.
  → **Resuelta en `design.md` § 4**: columna `whatsapp_contacts.customer_linked_by` (R26).
- **Para `design.md`:** si QC-302 necesitará Server Actions de agregar, quitar o cambiar el
  principal, decidir si se entregan aquí o se anotan para esa ficha.
  → **Resuelta en `design.md` § 10**: no se entregan aquí; van en QC-303.

Ninguna pregunta abierta para el humano: las cinco de la primera versión del spec (H1–H5) están
respondidas en la tabla de decisiones.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-20 | ¿Se ocultan los números desconocidos? | No. Se guardan y se ven, con el número como nombre (lo muestra QC-245). Reemplaza D1 de la ficha original. |
| 2026-10-20 | ¿Puede un número ser de varios clientes? | Sí, n:m real. Reemplaza D3 de QC-236 (sin duplicados por empresa). |
| 2026-10-20 | ¿Varios teléfonos por cliente? | Sí, con `main`; como máximo un principal por cliente. |
| 2026-10-20 | Número de varios clientes: ¿de quién es el chat? | De uno solo. Queda sin cliente hasta que se elige a mano. Con un solo dueño se vincula solo. |
| 2026-10-20 | ¿Vincular agrega el número al cliente? | Sí, siempre (principal si no tenía; si no, secundario). El vínculo sigue a los teléfonos: quitar el número desvincula. Hay desvincular. |
| 2026-10-20 | ¿Purga a los 30 días? | Se elimina. Reemplaza D2 de la ficha original. |
| 2026-10-20 | Mensajes de un número bloqueado | Se descartan sin guardar, con `200` a Meta. Se puede desbloquear; lo recibido durante el bloqueo no se recupera. |
| 2026-10-20 | ¿Quién vincula, desvincula y bloquea? | Quien tenga `clientes.modificar`. |
| 2026-10-20 | ¿Dónde se gestionan los varios teléfonos? | Solo backend aquí. El formulario edita el principal; la gestión completa va a QC-302 (frontend). |
| 2026-10-20 | ¿Se responde a desconocidos? | Sí; QC-240 actualizada en el board. |
| 2026-10-20 | Al cambiar el número principal en el formulario, ¿el anterior se quita? | No: pasa a secundario y sus chats siguen vinculados. El número nuevo vincula los contactos que ya tenían mensajes. |
| 2026-10-20 | ¿Desvincular también quita el número de los teléfonos del cliente? | Sí. |
| 2026-10-20 | Clientes migrados con `phone_issue = 'duplicate'` | Se reconvierten: su número válido pasa a principal en la tabla n:m y pierden la etiqueta. |
| 2026-10-20 | Server Actions de teléfonos (listar, agregar, quitar, marcar principal) | No entran aquí: van en QC-303 (`telefonos-de-cliente-backend`), bloqueada por QC-239 y que bloquea a QC-302. |
| 2026-10-20 | Vincular a un cliente que solo tiene un teléfono antiguo con aviso | El de WhatsApp pasa a principal y reemplaza ese texto. |
| 2026-10-20 (humano, en implementación) | Los adaptadores de unidad de trabajo abren `$transaction` sin ámbito y las guardias de ámbito los rechazan | Exención estricta por nombre, con la misma forma que `order-unit-of-work-prisma.ts` (QC-141 D21): `customer-unit-of-work-prisma.ts` en la guardia de `clientes` y `whatsapp-contact-unit-of-work-prisma.ts` en la de `integraciones` (que pasa de una a dos exenciones). Una sola función que solo abre `$transaction`, sin `tx.` dentro ni consultas; con casos de sensibilidad. |
| 2026-10-20 (humano, en implementación) | ¿Cómo nombra `integraciones` el permiso `clientes.modificar` sin romper R26 de QC-153? | `clientes` exporta desde su `index.ts` la constante del permiso y `integraciones/domain/actor.ts` la importa. La lista cerrada de R26 en `scope.test.ts` no se amplía. |
| heredado | Borrado lógico, `created_at`/`updated_at`/`deleted_at`, identificadores en inglés | QC-4. |
| heredado | `phone_e164` solo dígitos; `phoneMatchesWaId` con variantes MX/AR/BR | QC-236 (D4). |
| heredado | Recepción en una transacción, sin cola | QC-238 (D1). |
