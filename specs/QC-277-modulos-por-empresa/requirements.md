# QC-277 — modulos-por-empresa · requirements.md

> Zona: `fullstack` · Complejidad: `high` · `depends_on`: QC-162 (Finalizado) · Rama:
> `feature/QC-277-modulos-por-empresa`
>
> **Sembrado por el leader (2026-10-14)** desde la descripción del issue QC-277 y el mapa
> `progress/modulos-por-empresa.md`. La ficha llegó sin `/afinar-feature`: el alcance y las
> decisiones se cerraron con el humano el 2026-10-13 y no se reabren. `spec_author` completa los
> requisitos EARS y la columna «Cubierta por».

## Alcance

Motor de módulos por empresa: el Maestro prende y apaga **añadidos enteros** en una empresa, uno
a uno o todos a la vez. El núcleo no se apaga nunca.

Entra:

- **Catálogo de módulos:** núcleo fijo y añadidos apagables.
- **Añadidos activos de cada empresa.**
- **Recorte de permisos:** el permiso efectivo es rol ∩ módulos activos. Se resuelve en la sesión
  en cada petición, así que el cambio tiene efecto inmediato. Absorbe QC-188 (cancelada).
- **Operación del Maestro** para prender y apagar, con el permiso `empresas.modificar`.
- **Cierre de todos los puntos cruzados y huecos:**
  - los botones que cuelgan del permiso de otro módulo;
  - el logo y el aterrizaje, hoy fijos a `/asignacion`;
  - el webhook de documentos y los crons, que corren fuera de la sesión.
- **Enmienda de** `docs/architecture.md:43` y revisión de `docs/architecture.md:557`.

No entra:

- La pantalla de interruptores en el área del Maestro: QC-278, que depende de QC-166.
- Las plantillas o planes: QC-182, que pasa a ser «conjunto de módulos + precio».
- Suscripción, cobro y bloqueo: QC-187 y QC-183 a QC-192.
- El proveedor de IA por empresa: QC-275.

Fuente de hechos del código (con citas): `progress/modulos-por-empresa.md`.

## Decisiones cerradas (no reabrir)

Decisiones del humano tomadas el 2026-10-13 y escritas en la descripción del issue QC-277 y en
`progress/modulos-por-empresa.md`. Este spec no las abre.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| D1 | Módulos **enteros**, no permisos sueltos. «Integraciones» es un solo interruptor: Proveedor IA, Inventarios y WhatsApp; arrastra la lectura de PDF, Contactos y las notificaciones | humano, 2026-10-13 (QC-277) | — | |
| D2 | **Núcleo, no se apaga nunca:** usuarios y grupos, unidades, presentaciones, inventario (lotes, reservas, terminado, herramientas y máquinas), fórmulas, pedidos, asignación y ejecución, empaque, acondicionamiento, terminados, entregas y clientes | humano, 2026-10-13 (QC-277) | — | |
| D3 | **Añadidos:** dashboard y recorrido; proveedores; lectura de PDF con IA; importación desde Excel; integraciones. En el futuro: evidencia por paso (QC-214), notificaciones (QC-137) y proveedores de lo que falta (QC-139) | humano, 2026-10-13 (QC-277) | — | |
| D4 | La lectura de PDF con IA depende de Integraciones > Proveedor IA (QC-275 pasa la key a cada empresa y bloquea la lectura sin proveedor) | humano, 2026-10-13 (`progress/modulos-por-empresa.md`) | — | |
| D5 | **Un añadido apagado desaparece del todo:** sin menú ni botón, y 404 si se entra por URL | humano, 2026-10-13 (QC-277) | — | |
| D6 | **Al apagar, se descarta lo pendiente:** los trabajos en cola no se procesan y las revisiones sin confirmar dejan de verse. Lo ya confirmado se conserva | humano, 2026-10-13 (QC-277) | — | |
| D7 | **Una empresa nueva nace solo con el núcleo** | humano, 2026-10-13 (QC-277) | QC-162 (alta de empresa) | |
| D8 | El permiso efectivo es rol ∩ módulos activos, resuelto en la sesión en cada petición: efecto inmediato | humano, 2026-10-13 (QC-277) | `docs/architecture.md:43`, `:557` | |
| D9 | El Maestro prende y apaga uno a uno o todos a la vez, con `empresas.modificar` | humano, 2026-10-13 (QC-277) | — | |
| D10 | Todos los huecos se cierran: puntos cruzados con permiso de otro módulo, logo y aterrizaje fijos, webhook y crons fuera de sesión | humano, 2026-10-13 (QC-277) | — | |
| D11 | **Validación en el servidor y en el menú.** Lleva E2E | humano, 2026-10-13 (QC-277) | — | |

## Requisitos (EARS)

_Pendiente: los escribe `spec_author`. Cada fila de la tabla anterior acaba cubierta por al menos
un `R<n>`._

## Preguntas abiertas

- **P1. Cron de caducidad de pedidos.** El mapa lo propone como núcleo (protege las reservas) y
  pedidos es núcleo según D2, pero el humano no lo confirmó de forma explícita. Le toca al humano.
