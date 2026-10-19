# QC-299 — pasos-de-acondicionamiento · requirements.md

> Zona: fullstack · Complejidad: high · depends_on: [] · Rama: `feature/QC-299-pasos-de-acondicionamiento`
>
> **Alcance.** La fórmula puede tener sus propios **pasos de acondicionamiento**, opcionales y
> separados de los pasos del operador y de los de envasado. Misma estrategia que los pasos de
> envasado del empacador (QC-211). Lo que entra:
>
> - **Tercera sección «Acondicionamiento (opcional)»** en el formulario de alta y edición de la
>   fórmula, con el mismo editor y formato de filas que Pasos y Envasado (QC-211 D14).
> - **Dos switches por paso**, apagados por defecto: «Requiere evidencia» (QC-214) y
>   «Asignación requerida» (nuevo, solo en acondicionamiento).
> - **Paso a paso del acondicionador** en `/asignacion/acondicionamiento/<id>`, después de pulsar
>   «Acondicionar» (QC-218). El último paso lleva a «Terminar», que sigue exigiendo los datos de
>   lote como hoy (QC-219).
> - **Asignación requerida:** en ese paso el acondicionador elige uno o varios responsables entre
>   el equipo del pedido y él mismo. No avanza sin al menos uno.
> - **El avance se guarda:** al recargar, el acondicionador vuelve al paso en que iba.
> - **El recorrido de ejecución (QC-283) registra** qué usuarios fueron responsables de qué paso.
>
> **Lo que NO entra.**
>
> - Importación desde PDF: los PDF no traen pasos de acondicionamiento; se cargan a mano.
> - Responsables por paso en el detalle del pedido: solo en el recorrido.
> - Asignación por paso en los pasos del operador o de envasado.
> - Guardar el avance de los pasos del operador o de envasado: siguen como hoy.
> - Fases en los ingredientes (QC-173).
> - Rediseño de la pantalla del operario (QC-291): va después de esta ficha.
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

1. **Pase `/design` pendiente** (regla dura, `docs/perfil-agentes.md`): la sección nueva del
   formulario con los dos switches, el selector de responsables en el paso a paso y los
   responsables en el recorrido. Sin tableros aprobados no se escribe el spec.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
| --- | --- | --- |
| 2026-10-16 | ¿Son obligatorios? | No. Una fórmula puede no tener pasos de acondicionamiento; las existentes no se migran. Heredado de QC-211 D1 y D13. |
| 2026-10-16 | ¿Formato y topes? | Los mismos que los pasos del operador (QC-62), guardados aparte de los del operador y de los de envasado. Heredado de QC-211 D2. |
| 2026-10-16 | ¿Dónde se editan y quién? | En alta y edición, sección propia «Acondicionamiento (opcional)», mismo editor y formato de filas que Pasos y Envasado, con los dos switches en la barra de la fila. Solo el Administrador. Heredado de QC-211 D3 y D14. |
| 2026-10-16 | ¿Versiones? | Heredan los pasos de acondicionamiento de la original, solo lectura. Heredado de QC-211 D4. |
| 2026-10-16 | ¿Cuándo los ve el acondicionador? | Después de pulsar «Acondicionar» (QC-218); el último paso lleva a «Terminar». Sin pasos, la pantalla se ve como hoy. Heredado de QC-211 D6 y D8. |
| 2026-10-16 | ¿Regla de avance? | Checks + espera de 5 s (QC-64, QC-125), más evidencia y responsables cuando el paso los exige. Heredado de QC-211 D7. |
| 2026-10-16 | ¿Quién los ve? | Solo el acondicionador. El operador y el empacador no los ven; el acondicionador no ve los pasos del operador ni los de envasado. Lee con su permiso de acondicionamiento (QC-216), sin `recetas.consultar`. Autorización en el caso de uso. Heredado de QC-211 D9 y D10. |
| 2026-10-16 | ¿Copia en el pedido? | No: lectura en vivo de la fórmula. Heredado de QC-211 D11. |
| 2026-10-16 | ¿Opciones por paso? | Dos switches, apagados por defecto: «Requiere evidencia» (QC-214) y «Asignación requerida» (nuevo). |
| 2026-10-16 | Asignación requerida: ¿entre quiénes? | Entre el equipo elegido al pulsar «Acondicionar» (QC-218) y el propio acondicionador. Uno o varios; al menos uno para avanzar. |
| 2026-10-16 | ¿Se puede cambiar el responsable de un paso ya pasado? | Sí, mientras el pedido sigue en acondicionamiento. Al «Terminar» queda fijo. Cada cambio entra en el recorrido como un registro nuevo; el anterior no se edita ni se borra (heredado de QC-82). |
| 2026-10-16 | ¿Qué pasa al recargar? | Retoma donde iba: el avance por los pasos de acondicionamiento se guarda en el servidor. Responsables y fotos ya puestos se conservan. |
| 2026-10-19 | ¿Cuántos responsables por paso? | Uno o más, del equipo del pedido, incluido el propio acondicionador. Ninguno no deja avanzar un paso con «Asignación requerida». |
| 2026-10-19 | ¿Cómo se ven los switches en la fórmula? | Solo icono (cámara = evidencia, persona = asignación), con el nombre completo para lector de pantalla, y un icono «!» con tooltip que explica los dos. |
| 2026-10-16 | ¿Dónde se ven los responsables? | Solo en el recorrido de ejecución (QC-283). El detalle del pedido no cambia. |
| 2026-10-16 | ¿Importación desde PDF? | No entra: los PDF no especifican pasos de acondicionamiento. Se aparta de QC-211 D5. |
| 2026-10-16 | ¿Datos de lote? | Pasos primero; «Terminar» al final sigue exigiendo los datos de lote como hoy (QC-219). |
| 2026-10-16 | ¿Orden frente a QC-291? | QC-299 es prioridad; QC-291 va después. |
| 2026-10-16 | ¿E2E? | Sí: el Administrador crea la fórmula con pasos de acondicionamiento (uno con asignación requerida); el acondicionador comienza, asigna, recarga y retoma, termina; el recorrido muestra el responsable; operador y empacador no los ven. |
| 2026-10-16 | Heredados | Identificadores en inglés (QC-4); aislamiento por empresa; sin dependencias nuevas salvo aprobación (regla 7). |
