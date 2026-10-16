# QC-137 — sistema-de-notificaciones-por-rol · requirements.md

> Zona: fullstack · Complejidad: high · depends_on: [] · Rama: `feature/QC-137-sistema-de-notificaciones-por-rol`
>
> **Alcance.** Los usuarios de una empresa reciben en pantalla avisos de lo que les toca, por su
> rol o a su nombre. Lo que entra:
>
> - **Motor de avisos.** Los módulos emiten eventos por un puerto propio; el módulo de
>   notificaciones se suscribe en composition y crea los avisos. Un catálogo de eventos en código
>   fija, por evento, su texto, a quién va (rol o usuario concreto) y a qué pantalla lleva.
> - **Canales intercambiables (factory).** Entregar un aviso pasa por un puerto `canal` único.
>   Una factory resuelve los canales de cada evento a partir del catálogo. QC-137 implementa
>   **solo el canal en la aplicación**. Agregar email, teléfono, WhatsApp o Telegram después es
>   escribir un adaptador nuevo y registrarlo en la factory, sin tocar el motor, el catálogo ni
>   los módulos que emiten. Un test con un canal ficticio lo demuestra.
> - **Bandeja persistida** por empresa: cada aviso se guarda, cada usuario lo marca como leído por
>   su cuenta (aunque el aviso vaya a un rol entero) y se borra a los 90 días.
> - **Campana** en la cabecera con los últimos avisos y el **conteo de no leídos**, y **página
>   `/notificaciones`** con el historial completo. El ítem «Notificaciones» vuelve al menú con el
>   **mismo conteo** que la campana: los dos salen de la misma fuente y nunca muestran números
>   distintos. Ese conteo sustituye el número fijo de `private-nav.ts`.
> - **Tono de notificación** cuando llega un aviso nuevo con la pantalla abierta. No suena al
>   cargar la página por los avisos que ya estaban.
> - **Clic en un aviso** abre la pantalla de su origen y lo marca como leído.
> - **Llegada a la pantalla abierta** sin recargar. El mecanismo lo elige el `design.md` (ver
>   Preguntas abiertas).
> - **Primer evento real:** fin de una tanda de PDFs o fallo de un archivo (encargo de QC-107 D6),
>   dirigido a quien subió la tanda.
> - **Agregar un evento nuevo** requiere solo una entrada en el catálogo y un `emit` en el módulo
>   de origen. Queda documentado en el módulo, con un test que lo demuestra.
>
> **Lo que NO entra.**
>
> - Stock bajo la alerta → QC-292.
> - Pedido asignado / pedido listo → QC-293.
> - Pedido bloqueado → QC-294.
> - Canal email → QC-295.
> - Canal teléfono → QC-296.
> - Canal WhatsApp a usuarios internos → QC-297.
> - Canal Telegram → QC-298.
> - Avisos al **cliente final** por WhatsApp → QC-247 (otro destinatario, ver Preguntas abiertas).
> - Configurar por pantalla qué rol recibe cada evento: el mapa es fijo en código.
> - Preferencias por usuario (silenciar eventos).
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

1. **Mecanismo de tiempo real.** Lo elige el `design.md`, comparando al menos consulta periódica
   y Supabase Realtime por Broadcast con canal privado y token firmado por nosotros (Postgres
   Changes con la anon key está descartado: no puede acotar por empresa, ver QC-107). Base de
   carga: **3-4 empresas cliente hoy**. El `design.md` debe decir **qué cambia al escalar** (más
   empresas, más usuarios conectados) y en qué umbral conviene cambiar de mecanismo. Si elige
   Supabase Realtime: `@supabase/supabase-js` es dependencia nueva (regla 7, hoy no instalada a
   propósito, `docs/dependencias.md`) y exige enmienda a `docs/architecture.md` por
   `/afinar-regla` **antes** de implementar. El humano decide en F1.4.
2. **Relación con QC-247.** QC-247 avisa al cliente final por WhatsApp con su propio puerto de
   eventos. Queda abierto si QC-247 se monta sobre esta factory (el cliente como un destinatario
   más) o sigue aparte. Lo resuelve quien acote QC-247; QC-137 no lo bloquea.
3. **Para las fichas de canal, no para esta:** qué es «teléfono» (SMS, llamada o los dos), de
   dónde salen el correo, el teléfono o el chat de Telegram de cada usuario, y si cada usuario
   elige por qué canal recibe cada evento.
4. **BLOQUEANTE del spec (spec_author, 2026-10-16): falta el pase `/design`.** La ficha trae UI
   visible nueva y `docs/perfil-agentes.md > Pase de diseño para componentes nuevos` exige que
   el tablero aprobado esté en `docs/diseno/canvas/` antes de escribir el spec. Hoy no hay
   ninguno (buscado `notificaci`, `campana`, `bell` en `docs/diseno/`: nada; la cabecera de
   `app/(private)/layout.tsx` solo tiene `ThemeToggle` y `LogoutButton`). Faltan tableros
   para:
   - la **campana** de la cabecera: botón con conteo, panel con los últimos avisos, leído y no
     leído, vacío, carga y error, conteo grande (p. ej. «99+»);
   - la **página `/notificaciones`**: historial, vacío, carga, error y paginación si la hay;
   - el **aviso de «sonido no disponible»** (puede bastar un `Notice` o un toast ya
     catalogado; que el tablero lo diga);
   - el **conteo del ítem «Notificaciones»** del menú (hoy `Badge` con número fijo).

   Cada uno en escritorio, tablet y teléfono (`docs/diseno/README.md > Flujo /design`).
   Cuando estén aprobados y copiados en esta rama, se relanza `spec_author`. Búsqueda de
   duplicados hecha: board (QC-247/QC-248 son WhatsApp al cliente final, ya en «Lo que NO
   entra» y pregunta 2), `specs/` (solo menciones de relleno retirado en QC-13 y del encargo de
   QC-107) y código (`private-nav.ts` `badge` fijo, sin fuente de avisos): nada que choque.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
| --- | --- | --- |
| 2026-10-16 | ¿Qué eventos avisan? | PDFs (QC-107), stock bajo la alerta, pedido asignado/listo y pedido bloqueado. **Se parte:** QC-137 monta el motor y entrega solo el de PDFs; los otros tres son fichas chicas que solo agregan catálogo + `emit` (patrón de QC-247). |
| 2026-10-16 | ¿A quién va cada aviso? | Por rol **y** por usuario concreto, siempre dentro de su empresa (`companyId`). Nunca cruza de empresa. |
| 2026-10-16 | ¿Quién recibe cada evento? | Fijo en código, en el catálogo. Sin pantalla de configuración. |
| 2026-10-16 | ¿Se guarda? | Sí, con estado de leído. Retención de 90 días. |
| 2026-10-16 | Aviso dirigido a un rol: ¿cómo se marca leído? | Cada usuario el suyo. |
| 2026-10-16 | ¿Dónde se ve? | Campana en la cabecera + página `/notificaciones` con historial. |
| 2026-10-16 | ¿Conteo? | Campana y menú muestran el mismo conteo de no leídos, de una sola fuente. |
| 2026-10-16 | ¿Sonido? | Sí: tono al llegar un aviso nuevo con la pantalla abierta. |
| 2026-10-16 | ¿Qué sonido? | Uno propio, generado en el navegador (sin archivo de audio de terceros ni licencia que revisar). |
| 2026-10-16 | ¿Se puede silenciar? | No. |
| 2026-10-16 | ¿Varias pestañas? | Suena **una sola vez por navegador**, no una vez por pestaña (como Slack, Gmail o WhatsApp Web). El conteo sí se actualiza en todas. |
| 2026-10-16 | ¿Y si el navegador no permite audio? | No suena, sin error. Se muestra un aviso sencillo de que el sonido no está disponible. El conteo se actualiza igual. |
| 2026-10-16 | ¿Clic en el aviso? | Lleva a la pantalla de origen. |
| 2026-10-16 | ¿Correo? | No en esta ficha. Solo el canal en la aplicación. |
| 2026-10-16 | ¿Cómo se agregan canales? | Puerto `canal` + factory que resuelve los canales por evento. Futuro: aplicación, email, teléfono, WhatsApp y Telegram. Un fallo de un canal no impide los demás ni la bandeja. |
| 2026-10-16 | ¿E2E? | Sí: un usuario de otra empresa o de otro rol nunca ve el aviso. |
| 2026-10-16 | Desacople | Los módulos emiten por puerto propio y no importan `notificaciones`; suscripción en composition. Heredado de QC-247 D1 y del patrón `StockIncreaseListener`. |
| 2026-10-16 | ¿Un fallo al notificar rompe la operación? | Nunca. Heredado de QC-247 D4. |
| 2026-10-16 | ¿Se activa por empresa? | Sí, es módulo activable. Heredado de QC-277 D3. |
| 2026-10-16 | Identificadores de la DB | En inglés. Heredado de QC-4. |
| 2026-10-16 | Autorización | Validada en el service; cada usuario lee y marca solo sus avisos. Heredado de `docs/architecture.md > Acceso a datos y autorizacion`. |
