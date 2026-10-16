# QC-288 — entrega-sin-pedido · requirements.md

> **Zona:** fullstack · **Complejidad:** high · **depends_on:** — · **Rama:** `feature/QC-288-entrega-sin-pedido`
>
> **Alcance.** Desde la ficha de un producto terminado (QC-225), el Administrador entrega envases de
> sus lotes a uno o varios clientes sin pedido de por medio. El tope es el excedente: lo disponible
> menos lo que esperan los pedidos TERMINADO de esa receta y presentación. La salida queda en el
> libro de movimientos como entrega, no como ajuste. Se ve en la tab Entregas de la ficha y desde
> ahí se anula, como en QC-224.
>
> **Lo que NO entra.**
> - Cerrar un pedido entregado a medias y liberar lo que le falta.
> - Cambiar la entrega desde pedido (QC-223 / QC-224 / QC-282).
> - Entregar varios productos terminados en una misma entrega.
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

Ninguna.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-16 | ¿Desde dónde se lanza? | Acción «Entregar» en la ficha de producto terminado (QC-225). Una entrega es de ese producto terminado (una receta y una presentación), con sus lotes. |
| 2026-10-16 | ¿Varios clientes? | Sí: bloques por cliente, mismo patrón que QC-282 (sin clientes repetidos, cada cliente lleva al menos un envase). |
| 2026-10-16 | ¿Tope frente a pedidos pendientes? | Solo el excedente: envases disponibles del producto menos los envases que les faltan a los pedidos TERMINADO de la misma receta y presentación. Ej.: 20 en stock y 8 esperados, se entregan como mucho 12. Por lote, sigue el tope de envases disponibles (QC-223 D3/D5). |
| 2026-10-16 | ¿Anular? | Sí, como QC-224: `entregas.anular`, motivo obligatorio, registro compensatorio que devuelve los envases al lote; por cliente y presentación (QC-282). |
| 2026-10-16 | ¿Dónde se ve y desde dónde se anula? | Tab Entregas de la ficha de producto terminado (QC-225), mezclada con las de pedido y marcada «Sin pedido» en la columna Pedido; «Anular» en esa fila. En el historial del lote, el asiento sale como «Entrega sin pedido». |
| 2026-10-16 | ¿Datos extra? | Nota opcional de texto libre (p. ej. «Venta mostrador, factura 0012»), visible en la tab Entregas. |
| 2026-10-16 | ¿Permiso? | `entregas.modificar` para entregar y `entregas.anular` para anular, sin permiso nuevo (hereda QC-223 D6, QC-224 D4). |
| 2026-10-16 | ¿Cliente? | Obligatorio por bloque; solo clientes vivos de la empresa (hereda QC-156, QC-223 D4). |
| 2026-10-16 | ¿Lote y conversión? | Lote entregable de ese producto terminado con al menos un envase entero; envases convertidos con el contenido guardado en el lote (hereda QC-223 D5, D13). |
| 2026-10-16 | ¿Borrador e idempotencia? | Borrador en `localStorage` (QC-223 D8); clave de entrega generada en el cliente (`deliveryKey`, QC-223). |
| 2026-10-16 | ¿Se modifica o borra una entrega? | No: solo de inserción; la anulación es un registro nuevo (hereda QC-223 R32, QC-224 D8). Identificadores en inglés, borrado lógico (hereda la 4). |
| 2026-10-16 | ¿E2E? | Obligatorio: mueve inventario (hereda QC-213 D10). Sin dependencias nuevas. |
