/**
 * R37 (G13): los diálogos de confirmación y los paneles de alta, relación y variable no nombran a
 * Meta ni a la empresa en sus textos fijos.
 *
 * Recorre, de forma recursiva, los `*_TEXTS` exportados de esas piezas; las funciones de texto se
 * evalúan con argumentos de ejemplo. Quedan fuera a propósito, porque R37 no habla de ellas y el
 * tablero sí nombra a Meta: la barra de sincronización («Sincronización con Meta»), el listado
 * («Estado en Meta», avisos del panel de plantillas), la intro de la pestaña Variables y la
 * descripción de la constante «Nombre de la empresa» (`design.md > 5`), que solo se ven en la pestaña.
 * De `WHATSAPP_VARIABLES_TEXTS` (pestaña Variables) entran solo los textos de su diálogo de eliminar.
 */
import { describe, expect, it } from 'vitest';

import { WA_BUBBLE_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/wa-bubble';
import { WHATSAPP_DELETE_TEMPLATE_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-delete-dialog';
import { WHATSAPP_TEMPLATE_FORM_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-form-sheet';
import { WHATSAPP_SYNC_BAR_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-sync-bar';
import { WHATSAPP_RELATE_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-relate-sheet';
import { WHATSAPP_VARIABLE_MENU_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-variable-menu';
import { WHATSAPP_VARIABLE_FORM_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variable-form-sheet';
import { VARIABLE_RULES_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variable-rules';
import { WHATSAPP_VARIABLES_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variables-panel';

/** La palabra «Meta» (no «metadatos») y el nombre de la empresa. */
const FORBIDDEN = [/\bMeta\b/, /QuimiCloude/i] as const;

/** Argumentos de ejemplo para evaluar las funciones de texto, sea cual sea su aridad. */
const SAMPLE_ARGS = ['ejemplo', 2, 3] as const;

function collectTexts(value: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof value === 'string') {
    out.push({ path, text: value });
  } else if (typeof value === 'function') {
    collectTexts((value as (...args: unknown[]) => unknown)(...SAMPLE_ARGS), `${path}()`, out);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectTexts(item, `${path}[${index}]`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectTexts(item, `${path}.${key}`, out);
  }
}

const deleteVariableDialogTexts = Object.fromEntries(
  Object.entries(WHATSAPP_VARIABLES_TEXTS).filter(([key]) => key.startsWith('delete')),
);

const IN_SCOPE: Record<string, unknown> = {
  WHATSAPP_TEMPLATE_FORM_TEXTS,
  WA_BUBBLE_TEXTS,
  WHATSAPP_VARIABLE_MENU_TEXTS,
  WHATSAPP_RELATE_TEXTS,
  WHATSAPP_VARIABLE_FORM_TEXTS,
  VARIABLE_RULES_TEXTS,
  WHATSAPP_DELETE_TEMPLATE_TEXTS,
  'WHATSAPP_VARIABLES_TEXTS (diálogo de eliminar)': deleteVariableDialogTexts,
};

describe('textos de los diálogos y paneles de WhatsApp', () => {
  it.each(Object.entries(IN_SCOPE))('R37: %s no nombra a Meta ni a la empresa', (name, texts) => {
    const collected: Array<{ path: string; text: string }> = [];
    collectTexts(texts, name, collected);
    expect(collected.length, 'el recorrido encuentra textos').toBeGreaterThan(0);

    const offending = collected.filter(({ text }) => FORBIDDEN.some((pattern) => pattern.test(text)));
    expect(offending).toEqual([]);
  });

  it('R37: el detector sí encuentra «Meta» donde el tablero la pide (barra de sincronización, fuera de R37)', () => {
    const collected: Array<{ path: string; text: string }> = [];
    collectTexts(WHATSAPP_SYNC_BAR_TEXTS, 'WHATSAPP_SYNC_BAR_TEXTS', collected);
    expect(collected.some(({ text }) => FORBIDDEN.some((pattern) => pattern.test(text)))).toBe(true);
    expect(FORBIDDEN.some((pattern) => pattern.test('metadatos'))).toBe(false);
  });

  it('R37: el diálogo de eliminar variable entra en el recorrido', () => {
    expect(Object.keys(deleteVariableDialogTexts)).toEqual(
      expect.arrayContaining(['deleteTitle', 'deleteDescription', 'deleteBlocked', 'deleteDismiss']),
    );
  });
});
