# QC-278 — pantalla-modulos-por-empresa · requirements.md

> **Zona:** frontend · **Complejidad:** sin evaluar · **depends_on:** QC-166, QC-277 · **Rama:** `feature/QC-278-pantalla-modulos-por-empresa`
>
> **Alcance.** Pestaña Módulos del detalle de empresa del Maestro: los 5 añadidos con su
> interruptor y su estado, «Prender todos» y «Apagar todos», y el Núcleo como fichas fijas.
> Consume las tres acciones de QC-277.
>
> **Lo que NO entra.** El detalle de empresa y sus otras pestañas (QC-166). Las reglas de
> encendido y apagado (QC-277). Planes (QC-182, QC-186) y cobro (QC-187 y siguientes).
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

1. **Descripción de cada añadido.** Se proponen: Dashboard y recorrido «Indicadores del día y
   recorrido de cada pedido.»; Proveedores «Directorio de proveedores y su catálogo.»; Lectura de
   PDF con IA «Lee fórmulas y catálogos desde un PDF.»; Importación desde Excel «Carga inventario
   y catálogos desde una hoja de cálculo.»; Integraciones «Proveedor IA, Inventarios y
   WhatsApp.». El humano las confirma en la revisión del spec.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-16 | ¿Diseño? | Pase `/design` aprobado: `docs/diseno/canvas/MaestroEmpresa*` (pestaña Módulos) y `ModalesMaestro`. |
| 2026-10-16 | ¿Dónde va? | Pestaña Módulos de `/maestro/empresas/[id]` (`?tab=modulos`), montada por **QC-166**. |
| 2026-10-16 | ¿Confirmación? | Apagar uno o «Apagar todos» pide confirmación y nombra lo que se descarta (heredado de **QC-277 D6**). Prender y «Prender todos» son inmediatos. |
| 2026-10-16 | ¿Estados de un añadido? | Prendido, Apagado y «Sin efecto» (prendido sin su dependencia: `enabled` sin `active`). |
| 2026-10-16 | ¿Núcleo? | Fichas con candado, sin interruptor, con los nombres de **QC-277 D2**. |
| 2026-10-16 | ¿Empresa de baja? | Se ve, pero interruptores y botones quedan deshabilitados con aviso (heredado de **QC-277 R27/R31**). |
| 2026-10-16 | ¿Error al guardar? | `ErrorAlert` del catálogo junto a la fila; el interruptor vuelve a su posición. |
| 2026-10-16 | ¿Releer tras guardar? | No: las acciones devuelven la vista nueva (heredado de **QC-277**). |
| 2026-10-16 | ¿Permisos? | `empresas.consultar` para ver y `empresas.modificar` para cambiar (heredado de **QC-277 D9**). |
| 2026-10-16 | ¿E2E? | Sí: prender y apagar un añadido y verlo desaparecer del menú del usuario de esa empresa (flujo de permisos, **QC-277 D11**). |
