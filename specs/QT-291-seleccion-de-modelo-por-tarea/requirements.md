# QT-291 — Selección de modelo IA por tarea

> **Zona** fullstack · **Complejidad** high · **depends_on** QC-275 (hecha) · **Rama** `feature/QT-291-seleccion-de-modelo-por-tarea`
>
> **Alcance.** En Integraciones › Proveedor IA (`/integraciones/proveedor-ia`) la empresa elige
> **un** modelo de su proveedor conectado, que se usa para las dos lecturas de PDF (fórmula y
> catálogo). La lista sale de un catálogo global de modelos que mantiene la plataforma y nace
> sembrado por migración; solo entran modelos que leen PDF **e** imágenes. La pantalla muestra solo
> los modelos del proveedor conectado. Si no elige, usa el modelo por defecto del catálogo. La
> lectura usa el modelo elegido, y «Probar conexión» lo verifica.
>
> **Lo que NO entra.** Pantalla para que la plataforma agregue o quite modelos del catálogo
> (QT-292). Un modelo distinto por tarea. Mostrar modelos de proveedores no conectados. Consultar
> el listado de modelos a la API de cada proveedor. Respaldo encadenado de proveedores (QC-276) o
> de modelo (QC-175). Medir o limitar consumo.
>
> Sembrado por `/afinar-feature` el 2026-10-22. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- Lista inicial de modelos que siembra el catálogo, por proveedor, y cuál es el predeterminado: la
  propone `spec_author` en el `design.md` (con su fuente y fecha, como QC-275) y la aprueba el
  humano en F1.4. Hoy `ai_providers` tiene dos modelos por proveedor (`recipe_model`,
  `catalog_model`) que no siempre coinciden (Gemini); el spec propone cómo queda un solo
  predeterminado.
- ¿Hace falta E2E? No es flujo crítico de `docs/checkpoints-proyecto.md`; lo decide el spec con motivo.
- Pase `/design`: tableros `docs/diseno/canvas/ProveedorIAModelos.dc.html`,
  `ProveedorIAModelosTablet.dc.html` y `ProveedorIAModelosMovil.dc.html`, pendientes de aprobación
  del humano (`docs/perfil-agentes.md > Pase de diseño para componentes nuevos`).

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-22 | ¿De qué proveedores se listan modelos? | Solo del proveedor conectado de la empresa. (Revisa la decisión anterior del mismo día, «los cuatro», al ver el tablero.) |
| 2026-10-22 | ¿De dónde sale la lista? | De un catálogo global que mantenemos nosotros. No se consulta la API del proveedor para listar. |
| 2026-10-22 | ¿Qué modelos entran en el catálogo? | Solo los que leen PDF e imágenes, sin agrupar. Verificado en código: fórmula manda el PDF (`MODE_BY_STRATEGY.formula = 'pdf'`) y catálogo manda páginas PNG, también para el recorte (`MODE_BY_STRATEGY.catalogo = 'images'`, `crop-catalog-images.ts`). |
| 2026-10-22 | ¿Granularidad? | Un solo modelo para las dos tareas (fórmula y catálogo). Sin elección, el predeterminado del catálogo. (Revisa «un modelo por tarea».) |
| 2026-10-22 | ¿Cómo entra un modelo nuevo? | Desde una pantalla de plataforma, en ficha aparte (QT-292). En esta ficha el catálogo nace sembrado por migración. |
| 2026-10-22 | ¿Qué pasa al cambiar de proveedor? | Se borra la elección: vuelve el predeterminado del nuevo proveedor. |
| 2026-10-22 | ¿Y si el modelo elegido desaparece del proveedor? | La lectura falla y la conexión queda en Error con su aviso hasta que elija otro (patrón QC-275). Sin vuelta automática al predeterminado. |
| 2026-10-22 | ¿«Probar conexión» verifica el modelo elegido? | Sí: prueba el modelo en uso (elegido o predeterminado). |
| 2026-10-22 | ¿Quién elige el modelo? | `integraciones.modificar` (heredado de QC-275 D2). |
| — | Identificadores de DB | En inglés (heredado de QC-4). |
