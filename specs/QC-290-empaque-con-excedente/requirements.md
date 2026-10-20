# QC-290 — empaque-con-excedente · requirements.md

> **Zona:** fullstack · **Complejidad:** high · **depends_on:** — · **Rama:** `feature/QC-290-empaque-con-excedente`
>
> **Alcance:** Terminar el empaque con más envases reales de los que pide el pedido, con motivo
> obligatorio por línea que difiere. Lo envasado real entra al inventario; lo que supera al pedido
> queda como excedente libre en stock (entregable sin pedido, QC-288, o a otro pedido). El pedido
> sigue esperando solo lo pedido. El error «Supera la cantidad del pedido» pasa a aviso informativo.
>
> **Lo que NO entra:**
> - El tope del reparto antes de Comenzar (`order_distribution_exceeds_quantity`, Q3 de QC-170): sigue igual.
> - El bloqueo por stock libre del envase (D2 de QC-281): sigue igual.
> - Permisos nuevos y dependencias nuevas.
> - QC-304 (cancelada): duplicaba esta ficha; sus decisiones se traen aquí.
>
> Sembrado por `/afinar-feature` el 2026-10-20. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- **P2:** texto y tono del aviso informativo. Necesita pase `/design` aprobado
  (`docs/perfil-agentes.md > Pase de diseño para componentes nuevos`) y el humano fija el texto.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-20 | ¿Se puede envasar más que el pedido? | Sí, con motivo obligatorio por línea que difiere. Reemplaza D1/R8/R15 de QC-281; Q3 de QC-170 sigue para el reparto antes de Comenzar. |
| 2026-10-20 | ¿Tope del excedente? | No. Solo el stock libre del envase (D2 de QC-281). |
| 2026-10-20 | ¿Qué motivos? | Los de «más» de QC-281 D7: Conteo físico, Error de carga, Otro con texto obligatorio (≤ 200, D21). |
| 2026-10-20 | ¿Qué entra al inventario? | Lo envasado real: lote = envases reales × contenido (R20 de QC-281). |
| 2026-10-20 | ¿El pedido cuenta el excedente? | No: espera solo lo pedido; el excedente queda libre en stock (tarjeta QC-290; cierra lo que `specs/QC-288-entrega-sin-pedido/design.md > §12` dejó a esta ficha). |
| 2026-10-20 | ¿De qué presentación es el excedente? | Por línea, frente a su plan: plan 5×1 L + 1×5 L, real 7×1 L + 1×5 L → 2 envases de 1 L libres. |
| 2026-10-20 | Caso mixto sin superar el total | Si lo envasado no supera la cantidad del pedido, no hay excedente: todo es del pedido (9×1 L + 0×5 L → todo al pedido). |
| 2026-10-20 | Coste | Entre todo lo envasado, mismo coste unitario (hereda D9/D20 de QC-281). |
| 2026-10-20 | Qué ve el Empacador | Aviso informativo en vez del error (texto en P2). |
| 2026-10-20 | Permiso | Hereda D10 de QC-281: solo el Empacador que comenzó, sin permiso nuevo. |
| 2026-10-20 | ¿E2E? | Sí (inventario, `docs/checkpoints-proyecto.md > Flujos criticos`). Se amplía `e2e/envases-reales-empaque.spec.ts`. |
| 2026-10-20 | ¿Dependencias? | Ninguna nueva. |
| 2026-10-20 | (P1) Caso mixto que supera el total: plan 5×1 L + 1×5 L, real 12×1 L + 0×5 L = 12 L | Lo libre nunca supera lo que excede el pedido (12 − 10 = 2 L), y sale de las líneas que pasaron su plan: 2 envases de 1 L libres. El pedido espera, por línea, envases reales − libres de esa línea (aquí 10×1 L + 0×5 L). Afecta al tope de entrega por presentación de QC-223 D3: el spec lo cubre. |
| 2026-10-20 | QC-304 | Duplicado de esta ficha: cancelada, decisiones absorbidas aquí. |
