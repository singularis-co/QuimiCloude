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
> - Ver, agregar, quitar teléfonos y marcar el principal en el formulario de cliente: QC-302. Aquí
>   el formulario sigue editando solo el principal.
> - Responder a un contacto sin cliente: QC-240.
> - Purga de contactos: eliminada.
> - Borrar un cliente: QC-245 (D5).
>
> Sembrado por `/afinar-feature` el 2026-10-20. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- **Para `design.md`, no para el humano:** cómo conviven `customers.phone`, `phone_country`,
  `phone_e164` y `phone_issue` (QC-236) con la tabla nueva: espejo del principal o mover las
  columnas. Condición: la lista, el formulario, los migrados con `phone_issue` (D12, D22 de QC-236)
  y `phoneMatchesWaId` siguen funcionando igual. Con al menos una alternativa descartada.
- **Para `design.md`:** cómo se marca un vínculo elegido a mano para que el recálculo no lo pise.
- **Para `design.md`:** si QC-302 necesitará Server Actions de agregar, quitar o cambiar el
  principal, decidir si se entregan aquí o se anotan para esa ficha.

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
| heredado | Borrado lógico, `created_at`/`updated_at`/`deleted_at`, identificadores en inglés | QC-4. |
| heredado | `phone_e164` solo dígitos; `phoneMatchesWaId` con variantes MX/AR/BR | QC-236 (D4). |
| heredado | Recepción en una transacción, sin cola | QC-238 (D1). |
