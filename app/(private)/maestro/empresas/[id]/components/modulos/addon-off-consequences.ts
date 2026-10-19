import type { Addon, CompanyAddonsView } from '@/lib/modules/identity';

const HIDDEN_REVIEWS = 'Las revisiones sin confirmar quedan ocultas hasta que lo vuelvas a prender.';
const PDF_STOPS = 'Lectura de PDF con IA deja de funcionar aunque siga prendida, porque la necesita.';

const OFF_CONSEQUENCES: Readonly<Record<Addon, readonly string[]>> = {
  dashboard: [],
  proveedores: [],
  lectura_pdf: ['Las lecturas de PDF en cola terminan como fallidas.', HIDDEN_REVIEWS],
  importacion_excel: [HIDDEN_REVIEWS],
  integraciones: [],
};

// Al apagar Integraciones junto con la lectura, la lectura se apaga igual: la frase sería falsa.
function pdfStopsWhenAlone(addons: readonly Addon[], view: CompanyAddonsView): readonly string[] {
  const alone = addons.length === 1 && addons[0] === 'integraciones';
  const pdfOn = view.addons.some((state) => state.addon === 'lectura_pdf' && state.enabled);
  return alone && pdfOn ? [PDF_STOPS] : [];
}

export function offConsequences(addons: readonly Addon[], view: CompanyAddonsView): readonly string[] {
  const lines = view.addons
    .filter((state) => addons.includes(state.addon))
    .flatMap((state) => OFF_CONSEQUENCES[state.addon]);
  return [...new Set([...lines, ...pdfStopsWhenAlone(addons, view)])];
}
