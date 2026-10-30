# QT-303 — agente-ia-whatsapp-base · requirements.md

> Zona: `backend` · Complejidad: `medium` · depends_on: — · Rama: `feature/QT-303-agente-ia-whatsapp-base`
>
> **Alcance.** La base del agente de IA para WhatsApp, sin IA y sin envío:
> - el añadido `agente_ia_whatsapp`, que requiere `integraciones`, con permisos propios
>   (consultar y modificar la configuración);
> - la configuración del agente por empresa (una por empresa) con sus valores por defecto, y los
>   casos de uso para leerla y guardarla;
> - el modo de cada conversación, `AGENTE` o `HUMANO`, con motivo y fecha del último cambio; los
>   casos de uso para pasarla a humano y devolverla al agente a mano, y la regla pura que dice
>   cuándo vuelve sola al agente tras las horas de inactividad.
>
> **Lo que NO entra.**
> - Tool calling y el agente principal: QT-304 y QT-305.
> - El enrutador (palabras de pedir asesor, clasificador, umbral aplicado): QT-306.
> - El orquestador: encolar, filtros, límites aplicados, envío, mensaje de cortesía, aviso a
>   usuarios, disparo periódico de la vuelta automática y paso a `HUMANO` cuando un usuario escribe
>   a mano: QT-307.
> - Toda pantalla (configuración, botón de paso a humano, indicador de modo, texto de los mensajes
>   del agente en el chat): QT-308.
> - Responder 24/7, no mostrar precios y usar solo datos existentes son reglas del agente que
>   responde (QT-305/QT-307); aquí no hay respuesta alguna.
>
> «Conversación» en este archivo es un contacto de WhatsApp de la empresa: el repo no tiene otra
> entidad de conversación (`db/schema.prisma > WhatsappContact`).

## Decisiones cerradas (no reabrir)

Decisiones del humano del 2026-10-29 (plan del agente, `progress/features/QT-303.md > Decisiones`)
que tocan a esta ficha.

| # | Decisión | Cubierta por |
|---|---|---|
| D1 | Nuevo añadido `agente_ia_whatsapp` que requiere `integraciones`, con permisos propios (consultar y modificar la configuración). | R1–R7 |
| D2 | Configuración por empresa: activo, umbral de confianza (0.6), respuestas por día (500), respuestas por contacto por hora (20), horas de inactividad para volver al agente (12), mensaje de paso a humano. | R8–R18 |
| D3 | El agente se presenta como asistente virtual al iniciar e indica cómo pedir un asesor (aquí: el texto de presentación vive en la configuración). | R8, R14 |
| D4 | Modo por conversación `AGENTE`/`HUMANO`, con motivo y fecha del último cambio. | R19–R21, R31 |
| D5 | La conversación vuelve al agente a mano (botón) o sola tras las horas de inactividad configuradas. | R24–R25, R29–R30 |

## Requisitos (EARS)

> Los requisitos marcados **[Pn]** dependen de la propuesta por defecto de la pregunta abierta
> Pn; si el humano la responde de otra forma, cambian o salen.
> «Rechaza» significa: lanza el error del módulo y no lee ni escribe datos de negocio.

### Añadido y permisos

- **R1.** El sistema DEBE incluir `agente_ia_whatsapp` en el catálogo de añadidos del código, y
  las migraciones DEBEN sembrarlo en la tabla de añadidos.
- **R2.** SI una empresa tiene `agente_ia_whatsapp` prendido y `integraciones` no está activo,
  ENTONCES el sistema DEBE tratar `agente_ia_whatsapp` como no activo.
- **R3.** El sistema DEBE incluir en el catálogo de permisos `agente_ia.consultar` (ver la
  configuración del agente) y `agente_ia.modificar` (cambiar la configuración del agente), y las
  migraciones DEBEN sembrar los dos en la tabla de permisos.
- **R4.** MIENTRAS `agente_ia_whatsapp` no esté activo en la empresa del usuario, el sistema DEBE
  quitar `agente_ia.consultar` y `agente_ia.modificar` de sus permisos efectivos.
- **R5.** El sistema DEBE dar `agente_ia.consultar` y `agente_ia.modificar` al rol Administrador,
  en el sembrado del código y en la base, y a ningún otro rol. **[P3]**
- **R6.** CUANDO se aplica la migración, el sistema NO DEBE prender `agente_ia_whatsapp` en
  ninguna empresa existente. **[P4]**
- **R7.** El sistema DEBE tener nombre visible, descripción e icono para `agente_ia_whatsapp` en
  los catálogos de nombres y detalles de añadidos. **[P5]**

### Configuración del agente por empresa

- **R8.** CUANDO se consulta la configuración de una empresa que nunca la guardó, el sistema DEBE
  devolver: activo `false`, umbral de confianza `0.6`, 500 respuestas por día, 20 respuestas por
  contacto por hora, 12 horas de inactividad, y los textos por defecto del mensaje de paso a
  humano y del mensaje de presentación. **[P6]**
- **R9.** SI quien consulta la configuración no tiene `agente_ia.consultar` o no tiene empresa,
  ENTONCES el sistema DEBE rechazar la consulta.
- **R10.** SI quien guarda la configuración no tiene `agente_ia.modificar` o no tiene empresa,
  ENTONCES el sistema DEBE rechazar el guardado.
- **R11.** SI el umbral de confianza no es un número entre 0 y 1, ambos incluidos, o tiene más de
  dos decimales, ENTONCES el sistema DEBE rechazar el guardado. **[P7]**
- **R12.** SI las respuestas por día o las respuestas por contacto por hora no son un entero mayor
  o igual que 1, ENTONCES el sistema DEBE rechazar el guardado. **[P7]**
- **R13.** SI las horas de inactividad no son un entero mayor o igual que 1, ENTONCES el sistema
  DEBE rechazar el guardado. **[P7]**
- **R14.** SI el mensaje de paso a humano o el mensaje de presentación está vacío o solo tiene
  espacios, o supera la longitud máxima de un texto de WhatsApp (4096 caracteres), ENTONCES el
  sistema DEBE rechazar el guardado.
- **R15.** SI a la entrada del guardado le falta un campo o trae el campo `activo` con un valor que
  no es booleano, ENTONCES el sistema DEBE rechazar el guardado.
- **R16.** CUANDO se guarda una configuración válida, el sistema DEBE reemplazar todos los campos
  de la configuración de la empresa del usuario, guardar los mensajes sin los espacios de los
  extremos y registrar quién y cuándo la cambió por última vez; la consulta siguiente DEBE
  devolver los valores guardados.
- **R17.** El sistema DEBE guardar como máximo una configuración por empresa, también con dos
  guardados concurrentes de la misma empresa.
- **R18.** El sistema DEBE tomar la empresa de la configuración del usuario que actúa y nunca de la
  entrada: una empresa no puede leer ni escribir la configuración de otra.

### Modo de la conversación

- **R19.** El sistema DEBE guardar para cada conversación un modo, `AGENTE` o `HUMANO`; una
  conversación cuyo modo nunca cambió DEBE estar en `AGENTE`, también las que ya existen al aplicar
  la migración. **[P8]**
- **R20.** CUANDO cambia el modo de una conversación, el sistema DEBE guardar el motivo, la fecha
  del cambio y el usuario que lo hizo, o ningún usuario si el cambio lo hizo el sistema.
- **R21.** SI se pide un cambio de modo con un motivo que no es de los admitidos para el modo de
  destino, ENTONCES el sistema DEBE rechazarlo. Motivos de paso a `HUMANO`: a mano por un usuario,
  el cliente lo pide, falta el dato, confianza baja, error de IA, tope de uso, un usuario respondió
  a mano. Motivos de vuelta a `AGENTE`: a mano por un usuario, inactividad. **[P9]**
- **R22.** CUANDO un usuario pasa a humano una conversación en `AGENTE`, el sistema DEBE dejarla en
  `HUMANO` con el motivo «a mano por un usuario», la fecha actual y ese usuario.
- **R23.** SI un usuario pasa a humano una conversación que ya está en `HUMANO`, ENTONCES el sistema
  NO DEBE cambiar su modo, motivo, fecha ni usuario, y NO DEBE fallar.
- **R24.** CUANDO un usuario devuelve al agente una conversación en `HUMANO`, el sistema DEBE
  dejarla en `AGENTE` con el motivo «a mano por un usuario», la fecha actual y ese usuario.
- **R25.** SI un usuario devuelve al agente una conversación que ya está en `AGENTE`, ENTONCES el
  sistema NO DEBE cambiar su modo, motivo, fecha ni usuario, y NO DEBE fallar.
- **R26.** SI quien pasa a humano o devuelve al agente no tiene `whatsapp.enviar`, no tiene
  `agente_ia_whatsapp` activo o no tiene empresa, ENTONCES el sistema DEBE rechazar el cambio.
  **[P2]**
- **R27.** SI la conversación pedida no existe, es de otra empresa o su identificador no tiene
  forma de uuid, ENTONCES el sistema DEBE responder «contacto no encontrado» sin distinguir los
  casos y sin escribir nada.
- **R28.** CUANDO un usuario con `whatsapp.consultar` y `agente_ia_whatsapp` activo consulta el modo
  de una conversación de su empresa, el sistema DEBE devolver el modo, el motivo y la fecha del
  último cambio (motivo y fecha vacíos si nunca cambió); sin ese permiso o sin el añadido activo,
  DEBE rechazar la consulta. **[P2]**

### Vuelta automática al agente (regla pura)

- **R29.** CUANDO se evalúa la vuelta automática de una conversación en `HUMANO`, el sistema DEBE
  responder que vuelve al agente si y solo si desde el momento de referencia han pasado al menos las
  horas de inactividad configuradas; el momento de referencia es el más reciente entre la fecha del
  último cambio de modo y la del último mensaje de la conversación, entrante o saliente.
- **R30.** CUANDO se evalúa la vuelta automática de una conversación en `AGENTE`, o de una en
  `HUMANO` sin fecha de cambio ni de último mensaje, el sistema DEBE responder que no vuelve.

### Base de datos

- **R31.** SI se escribe en la base una conversación en `HUMANO` sin motivo o sin fecha de cambio,
  o con motivo sin fecha o fecha sin motivo, ENTONCES la base DEBE rechazarla.
- **R32.** El sistema DEBE tener la seguridad a nivel de fila activada y forzada en la tabla de
  configuración del agente.
- **R33.** DONDE el humano confirme el origen `AGENT` (P1), el sistema DEBE admitir `AGENT` como
  origen de un mensaje, además de `USER` y `SYSTEM`, sin cambiar el origen de ningún mensaje
  existente. **[P1]**

## Preguntas abiertas

- **P1. Origen de los mensajes del agente.** ¿`SYSTEM` (ya existe en `WhatsappMessageOrigin`) o un
  valor nuevo `AGENT`? **Propuesta por defecto: `AGENT`, añadido en esta ficha (solo el valor; nadie
  lo escribe hasta QT-307).** Motivo: el tope de 500 respuestas por día y por contacto por hora
  (QT-307) y la evaluación (QT-309) cuentan respuestas del agente; con `SYSTEM` se mezclarían con
  los envíos del sistema de QC-241 y los avisos de QC-247. Si el humano elige `SYSTEM`, R33 sale.
  Lo cierra el humano en F1.4.
- **P2. Permiso para pasar a humano y devolver al agente.** La ficha solo nombra permisos para la
  configuración. **Propuesta: `whatsapp.enviar` + añadido `agente_ia_whatsapp` activo** (lo usa quien
  atiende el chat, el mismo que puede escribir a mano); para consultar el modo, `whatsapp.consultar`
  + añadido activo. Alternativa: `agente_ia.modificar`.
- **P3. Roles que reciben `agente_ia.*`.** **Propuesta: solo el Administrador**, como
  `integraciones.modificar` y `whatsapp.*`.
- **P4. Empresas existentes.** **Propuesta: el añadido nace apagado en todas**; se prende por
  empresa (excepción o plan).
- **P5. Textos del añadido en la plataforma.** **Propuesta:** nombre «Agente de IA para WhatsApp»,
  descripción «Responde por WhatsApp con la IA de la empresa y pasa a una persona cuando hace
  falta.», icono `BotIcon` de `lucide-react` (ya instalado).
- **P6. Textos por defecto de los mensajes.** No están en la ficha. **Propuesta:**
  - paso a humano: «Te comunico con una persona del equipo. Te responderá en cuanto pueda.»
  - presentación: «Hola, soy el asistente virtual. Si prefieres hablar con una persona, escribe
    "asesor".»

  La palabra «asesor» tiene que estar en la lista de palabras de pedir asesor de QT-306.
- **P7. Rangos de la configuración.** La ficha da los valores por defecto, no los límites.
  **Propuesta:** umbral en [0, 1] con hasta dos decimales; límites y horas enteros ≥ 1, sin tope
  superior. Apagar el agente es `activo = false`, no un límite en 0.
- **P8. Modo inicial.** **Propuesta: `AGENTE`** para conversaciones nuevas y existentes. Con
  `activo = false` no responde nadie automáticamente, así que no cambia nada hasta que la empresa
  prende el agente; al prenderlo, cubre todas las conversaciones.
- **P9. Lista de motivos.** **Propuesta:** la de R21, tomada del contexto común de la ficha
  (pasa a humano si el cliente lo pide, si falta el dato, si la confianza es baja, si hay error de
  IA o tope de uso; QT-307: si un usuario escribe a mano). Reclamo, sentimiento negativo y medios
  no texto (QT-306) caben en «confianza baja»/«falta el dato» o se añaden en QT-306 con su
  migración. Confirmar si QT-306 necesita motivos propios ya ahora.
