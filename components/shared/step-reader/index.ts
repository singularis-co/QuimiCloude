/**
 * Barrel de `components/shared/step-reader` (`design.md > 5`, `docs/architecture.md >
 * Componentes`). **La UNICA superficie publica** del asistente de lectura.
 *
 * Expone el componente, su tipo de props y la barra `StepProgress`. `StepDocumentView` es una
 * pieza interna y ningun consumidor debe alcanzarla por ruta profunda. **Sin `'use client'` aqui**: la
 * frontera cliente/servidor la declara cada componente, no el barrel.
 */

export { StepProgress, StepReader } from './step-reader';
export type { StepReaderProps } from './step-reader';
