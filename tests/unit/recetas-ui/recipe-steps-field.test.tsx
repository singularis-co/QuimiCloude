import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { RecipeStepsField } from '@/app/(private)/produccion/formulas/components';
import type { RecipeStepFormValue } from '@/app/(private)/produccion/formulas/components/recipe-form-state';
import { isStepDocumentEmpty } from '@/app/(private)/produccion/formulas/components/recipe-steps-field';
import type { ConditioningStepInput, RecipeStepDocument } from '@/lib/modules/recetas';

import { setupUser } from '../../helpers/user-event';

const ROW_HEIGHT = 60;

// ProseMirror pide geometria que jsdom no calcula; mismos stubs que recipe-form.test.tsx.
beforeAll(() => {
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = () => {
      const rects: DOMRect[] = [];
      return Object.assign(rects, {
        item: (index: number) => rects[index] ?? null,
      }) as unknown as DOMRectList;
    };
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  }
  if (typeof document.elementFromPoint !== 'function') {
    (document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () =>
      null;
  }
});

afterEach(() => {
  cleanup();
});

/** dnd-kit decide arriba/abajo por rectangulos; jsdom los da vacios. Cada fila mide su posicion. */
function installRowRectStub(): () => void {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const row = this.closest('li[data-testid$="-row"]');
    if (row !== null) {
      const rows = row.parentElement === null ? [row] : Array.from(row.parentElement.children);
      const top = Math.max(0, rows.indexOf(row)) * ROW_HEIGHT;
      const rect = { x: 0, y: top, top, left: 0, right: 320, bottom: top + ROW_HEIGHT, width: 320, height: ROW_HEIGHT };
      return { ...rect, toJSON: () => rect } as DOMRect;
    }
    return original.call(this);
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
}

function doc(text: string): RecipeStepDocument {
  return { blocks: [{ kind: 'paragraph', spans: [{ text }] }] };
}

function step(key: string, text: string): RecipeStepFormValue {
  return { key, document: doc(text) };
}

function textOf(testId: string): string {
  return screen.getByTestId(testId).textContent ?? '';
}

function SingleHarness({ initial = [step('a', 'Mezclar')] }: { readonly initial?: RecipeStepFormValue[] }) {
  const [steps, setSteps] = useState<readonly RecipeStepFormValue[]>(initial);
  return <RecipeStepsField steps={steps} onChange={setSteps} errors={{ 0: 'Paso vacio' }} />;
}

function DoubleHarness() {
  const [operator, setOperator] = useState<readonly RecipeStepFormValue[]>([
    step('op-1', 'Pesar'),
    step('op-2', 'Mezclar'),
  ]);
  const [packing, setPacking] = useState<readonly RecipeStepFormValue[]>([
    step('pk-1', 'Etiquetar'),
    step('pk-2', 'Sellar'),
  ]);
  return (
    <>
      <RecipeStepsField steps={operator} onChange={setOperator} />
      <RecipeStepsField
        steps={packing}
        onChange={setPacking}
        title="Pasos de envasado"
        optionalHelp={{ text: 'Ayuda de envasado', label: 'Qué son los pasos de envasado' }}
        testIdPrefix="recipe-packing-step"
        errors={{ 1: 'Paso de envasado vacio' }}
      />
    </>
  );
}

describe('RecipeStepsField reutilizable (QC-211)', () => {
  it('R7: sin props nuevas conserva titulo y los data-testid de hoy, sin botón «Añadir paso» ni «(opcional)»', () => {
    render(<SingleHarness />);

    const field = screen.getByTestId('recipe-steps-field');
    expect(within(field).getByRole('heading', { name: 'Pasos' })).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-step-add')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Añadir paso' })).toBeNull();
    expect(screen.queryByTestId('recipe-steps-optional')).toBeNull();
    expect(screen.queryByTestId('recipe-steps-help')).toBeNull();
    expect(screen.getByTestId('recipe-step-add-0')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-steps-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('recipe-step-row')).toHaveLength(1);
    expect(screen.getByTestId('recipe-step-handle-0')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-step-text-0')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-step-remove-0')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-step-field-error-0')).toHaveTextContent('Paso vacio');
    expect(screen.getByTestId('recipe-step-field-error-0')).toHaveAttribute('id', 'recipe-step-error-0');
  });

  it('R7: con testIdPrefix de envasado salen titulo, «(opcional)» y data-testid propios', () => {
    render(<DoubleHarness />);

    const field = screen.getByTestId('recipe-packing-steps-field');
    expect(within(field).getByRole('heading', { name: /^Pasos de envasado/ })).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-packing-step-add')).toBeNull();
    expect(screen.getByTestId('recipe-packing-steps-optional')).toHaveTextContent('(opcional)');
    expect(screen.getByTestId('recipe-packing-step-add-1')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-packing-steps-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('recipe-packing-step-row')).toHaveLength(2);
    expect(screen.getByTestId('recipe-packing-step-handle-1')).toBeInTheDocument();
    expect(textOf('recipe-packing-step-text-0')).toContain('Etiquetar');
    expect(screen.getByTestId('recipe-packing-step-remove-1')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-packing-step-field-error-1')).toHaveTextContent(
      'Paso de envasado vacio',
    );
    expect(screen.queryByTestId('recipe-step-field-error-1')).toBeNull();
    // Los id de error no colisionan entre instancias.
    expect(document.querySelectorAll('#recipe-step-error-1')).toHaveLength(0);
    expect(document.querySelectorAll('#recipe-packing-step-error-1')).toHaveLength(1);
  });

  it('R7: dos instancias en el mismo arbol no comparten pasos al añadir ni al quitar', async () => {
    const user = setupUser();
    render(<DoubleHarness />);

    await user.click(screen.getByTestId('recipe-packing-step-add-1'));
    expect(screen.getAllByTestId('recipe-packing-step-row')).toHaveLength(3);
    expect(screen.getAllByTestId('recipe-step-row')).toHaveLength(2);

    await user.click(screen.getByTestId('recipe-step-remove-0'));
    expect(screen.getAllByTestId('recipe-step-row')).toHaveLength(1);
    expect(screen.getAllByTestId('recipe-packing-step-row')).toHaveLength(3);
    expect(textOf('recipe-packing-step-text-0')).toContain('Etiquetar');
  });

  it('R7: arrastrar con teclado en la lista de envasado no mueve la de pasos del operador', async () => {
    const uninstall = installRowRectStub();
    try {
      const user = setupUser();
      render(<DoubleHarness />);

      screen.getByTestId('recipe-packing-step-handle-0').focus();
      await user.keyboard(' ');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      expect(textOf('recipe-packing-step-text-0')).toContain('Sellar');
      expect(textOf('recipe-packing-step-text-1')).toContain('Etiquetar');
      expect(textOf('recipe-step-text-0')).toContain('Pesar');
      expect(textOf('recipe-step-text-1')).toContain('Mezclar');
    } finally {
      uninstall();
    }
  });
});

function stepWithEvidence(key: string, text: string): RecipeStepFormValue {
  return { key, document: { ...doc(text), requiresEvidence: true } };
}

let lastSteps: readonly RecipeStepFormValue[] = [];

function EvidenceHarness({
  initial,
  locked = false,
}: {
  readonly initial: RecipeStepFormValue[];
  readonly locked?: boolean;
}) {
  const [steps, setSteps] = useState<readonly RecipeStepFormValue[]>(initial);
  return (
    <RecipeStepsField
      steps={steps}
      onChange={(next) => {
        lastSteps = next;
        setSteps(next);
      }}
      showEvidenceSwitch
      locked={locked}
    />
  );
}

function evidenceSwitch(position: number): HTMLElement {
  return screen.getByRole('switch', { name: `Requiere evidencia en el paso ${position} de Pasos` });
}

describe('RecipeStepsField — «Requiere evidencia» (QC-214)', () => {
  it('R1: sin showEvidenceSwitch no hay interruptor ni resumen', () => {
    render(<SingleHarness />);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByTestId('recipe-step-evidence-summary')).toBeNull();
  });

  it('R2: un paso guardado sin el dato y un paso recién añadido salen apagados', async () => {
    const user = setupUser();
    render(<EvidenceHarness initial={[step('a', 'Pesar')]} />);

    expect(evidenceSwitch(1)).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByTestId('recipe-step-add-0'));
    expect(evidenceSwitch(2)).toHaveAttribute('aria-checked', 'false');
    expect(lastSteps[1]?.document.requiresEvidence).toBeUndefined();
  });

  it('R1: encender un paso no toca los demás, y apagarlo quita la marca del documento', async () => {
    const user = setupUser();
    render(<EvidenceHarness initial={[step('a', 'Pesar'), step('b', 'Mezclar')]} />);

    await user.click(evidenceSwitch(2));
    expect(evidenceSwitch(2)).toHaveAttribute('aria-checked', 'true');
    expect(evidenceSwitch(1)).toHaveAttribute('aria-checked', 'false');
    expect(lastSteps.map((s) => s.document.requiresEvidence)).toEqual([undefined, true]);
    expect(textOf('recipe-step-text-1')).toContain('Mezclar');

    await user.click(evidenceSwitch(2));
    expect('requiresEvidence' in (lastSteps[1]?.document ?? {})).toBe(false);
  });

  it('R5: el paso encendido se marca con su línea de ayuda y el resumen cuenta por lista', async () => {
    const user = setupUser();
    render(
      <EvidenceHarness
        initial={[step('a', 'Pesar'), step('b', 'Mezclar'), step('c', 'Envasar')]}
      />,
    );
    const summary = screen.getByTestId('recipe-step-evidence-summary');
    expect(summary).toHaveTextContent('Ningún paso pide evidencia');

    await user.click(evidenceSwitch(1));
    expect(summary).toHaveTextContent('1 paso pide evidencia');
    expect(screen.getByTestId('recipe-step-text-0-evidence-help')).toHaveTextContent(
      'Al ejecutar, este paso pide de 1 a 3 fotos antes de avanzar.',
    );
    expect(screen.queryByTestId('recipe-step-text-1-evidence-help')).toBeNull();

    await user.click(evidenceSwitch(3));
    expect(summary).toHaveTextContent('2 pasos piden evidencia');
  });

  it('R2, R5: un paso guardado con la marca abre encendido y cuenta en el resumen', () => {
    render(<EvidenceHarness initial={[stepWithEvidence('a', 'Pesar'), step('b', 'Mezclar')]} />);
    expect(evidenceSwitch(1)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('recipe-step-evidence-summary')).toHaveTextContent(
      '1 paso pide evidencia',
    );
  });

  it('R8: bloqueado, mover y quitar se deshabilitan con su motivo; el interruptor y añadir al final siguen activos', async () => {
    const user = setupUser();
    render(<EvidenceHarness initial={[step('a', 'Pesar'), step('b', 'Mezclar')]} locked />);

    expect(screen.getByTestId('recipe-step-handle-0')).toBeDisabled();
    expect(screen.getByTestId('recipe-step-handle-0')).toHaveAccessibleName(
      'No se puede mover el paso 1: hay pedidos en curso con fotos',
    );
    expect(screen.getByTestId('recipe-step-remove-1')).toBeDisabled();
    expect(screen.getByTestId('recipe-step-remove-1')).toHaveAccessibleName(
      'No se puede quitar el paso 2: hay pedidos en curso con fotos',
    );

    await user.click(evidenceSwitch(1));
    expect(evidenceSwitch(1)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('recipe-step-add-0')).toBeDisabled();
    await user.click(screen.getByTestId('recipe-step-add-1'));
    expect(screen.getAllByTestId('recipe-step-row')).toHaveLength(3);
    expect(lastSteps.map((s) => s.key).slice(0, 2)).toEqual(['a', 'b']);
  });
});

describe('RecipeStepsField — el «+» de cada fila solo con todos los pasos rellenos', () => {
  it('isStepDocumentEmpty recorre párrafos e ítems de checklist y solo cuenta texto tras trim', () => {
    expect(isStepDocumentEmpty({ blocks: [] })).toBe(true);
    expect(isStepDocumentEmpty({ blocks: [{ kind: 'paragraph', spans: [] }] })).toBe(true);
    expect(isStepDocumentEmpty(doc('   '))).toBe(true);
    expect(
      isStepDocumentEmpty({
        blocks: [
          { kind: 'paragraph', spans: [] },
          { kind: 'checklist', items: [{ spans: [{ text: ' ' }] }, { spans: [{ text: 'Pesar' }] }] },
        ],
      }),
    ).toBe(false);
    expect(isStepDocumentEmpty(doc('Mezclar'))).toBe(false);
  });

  it('con un paso vacío, el «+» se deshabilita en todas las filas; con todos con texto, vuelve a estar activo', async () => {
    const user = setupUser();
    render(<SingleHarness initial={[step('a', 'Pesar')]} />);
    expect(screen.getByTestId('recipe-step-add-0')).toBeEnabled();

    await user.click(screen.getByTestId('recipe-step-add-0'));
    expect(screen.getAllByTestId('recipe-step-row')).toHaveLength(2);
    expect(screen.getByTestId('recipe-step-add-0')).toBeDisabled();
    expect(screen.getByTestId('recipe-step-add-1')).toBeDisabled();
  });

  it('el «+» inserta el paso nuevo justo después de su fila', async () => {
    const user = setupUser();
    render(<EvidenceHarness initial={[step('a', 'Pesar'), step('b', 'Mezclar')]} />);

    await user.click(screen.getByTestId('recipe-step-add-0'));
    expect(lastSteps.map((s) => s.key)[0]).toBe('a');
    expect(lastSteps.map((s) => s.key)[2]).toBe('b');
    expect(isStepDocumentEmpty(lastSteps[1]?.document ?? doc('x'))).toBe(true);
  });

  it('cuando el paso vacío recibe texto, el «+» vuelve a estar activo', () => {
    const noop = () => undefined;
    const { rerender } = render(
      <RecipeStepsField
        steps={[step('a', 'Pesar'), { key: 'b', document: { blocks: [{ kind: 'paragraph', spans: [] }] } }]}
        onChange={noop}
      />,
    );
    expect(screen.getByTestId('recipe-step-add-0')).toBeDisabled();

    rerender(<RecipeStepsField steps={[step('a', 'Pesar'), step('b', 'Mezclar')]} onChange={noop} />);
    expect(screen.getByTestId('recipe-step-add-0')).toBeEnabled();
    expect(screen.getByTestId('recipe-step-add-1')).toBeEnabled();
  });

  it('`locked` no cambia la regla: con un paso vacío el «+» sigue deshabilitado', () => {
    render(
      <RecipeStepsField
        steps={[{ key: 'a', document: { blocks: [{ kind: 'paragraph', spans: [] }] } }]}
        onChange={() => undefined}
        locked
      />,
    );
    expect(screen.getByTestId('recipe-step-add-0')).toBeDisabled();
  });

  it('un paso con solo espacios cuenta como vacío', () => {
    render(<SingleHarness initial={[step('a', 'Pesar'), step('b', '   ')]} />);
    expect(screen.getByTestId('recipe-step-add-1')).toBeDisabled();
  });

  it('la regla aplica igual a los pasos de envasado', () => {
    function PackingHarness() {
      const [steps, setSteps] = useState<readonly RecipeStepFormValue[]>([
        { key: 'pk', document: { blocks: [{ kind: 'paragraph', spans: [] }] } },
      ]);
      return (
        <RecipeStepsField steps={steps} onChange={setSteps} testIdPrefix="recipe-packing-step" />
      );
    }
    render(<PackingHarness />);
    expect(screen.getByTestId('recipe-packing-step-add-0')).toBeDisabled();
  });
});

describe('RecipeStepsField — fila en blanco de arranque, como la de ingredientes', () => {
  function GhostHarness({ prefix }: { readonly prefix?: string }) {
    const [steps, setSteps] = useState<readonly RecipeStepFormValue[]>([]);
    return (
      <RecipeStepsField
        steps={steps}
        onChange={(next) => {
          lastSteps = next;
          setSteps(next);
        }}
        testIdPrefix={prefix}
        showEvidenceSwitch
      />
    );
  }

  it('sin pasos pinta UNA fila en blanco con su «x» y su «+», sin entrar en `steps`', () => {
    lastSteps = [];
    render(<GhostHarness />);

    expect(screen.getAllByTestId('recipe-step-row')).toHaveLength(1);
    expect(screen.getByTestId('recipe-step-text-0')).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Quitar paso 1' })).toBeInTheDocument();
    // Vacía, no se ofrece otra: primero se rellena la que hay.
    expect(screen.getByRole('button', { name: 'Añadir un paso después del 1' })).toBeDisabled();
    expect(lastSteps).toEqual([]);
  });

  it('la «x» de la fila en blanco no deja la sección sin filas', async () => {
    const user = setupUser();
    render(<GhostHarness prefix="recipe-packing-step" />);

    await user.click(screen.getByTestId('recipe-packing-step-remove-0'));
    expect(screen.getAllByTestId('recipe-packing-step-row')).toHaveLength(1);
  });

  it('encender la evidencia en la fila en blanco la convierte en paso de verdad', async () => {
    const user = setupUser();
    lastSteps = [];
    render(<GhostHarness />);

    await user.click(evidenceSwitch(1));
    expect(lastSteps).toHaveLength(1);
    expect(lastSteps[0]?.document.requiresEvidence).toBe(true);
    expect(evidenceSwitch(1)).toHaveAttribute('aria-checked', 'true');
  });

  it('quitar el último paso vuelve a la fila en blanco, con el editor vacío', async () => {
    const user = setupUser();
    render(<EvidenceHarness initial={[step('a', 'Pesar')]} />);

    await user.click(screen.getByTestId('recipe-step-remove-0'));
    expect(lastSteps).toEqual([]);
    expect(screen.getAllByTestId('recipe-step-row')).toHaveLength(1);
    expect(screen.getByTestId('recipe-step-text-0')).toHaveTextContent('');
  });
});

describe('RecipeStepsField — «+» y «x» en el grupo de «Requiere evidencia»', () => {
  it('los dos botones son iconos táctiles en el mismo grupo que el interruptor, alineados con él', () => {
    render(<EvidenceHarness initial={[step('a', 'Pesar')]} />);

    const tools = screen.getByTestId('recipe-step-text-0-row-tools');
    expect(tools).toContainElement(evidenceSwitch(1));
    const remove = screen.getByTestId('recipe-step-remove-0');
    const add = screen.getByTestId('recipe-step-add-0');
    expect(tools).toContainElement(remove);
    expect(tools).toContainElement(add);
    expect(tools.className).toContain('items-center');
    expect(tools.className).toContain('md:ml-auto');
    for (const button of [remove, add]) {
      expect(button.className).toContain('size-9');
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('min-w-11');
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.textContent).toBe('');
    }
    expect(remove).toHaveAccessibleName('Quitar paso 1');
    expect(add).toHaveAccessibleName('Añadir un paso después del 1');
  });

  it('sin interruptor de evidencia, «+» y «x» siguen en su grupo de la fila', () => {
    render(<SingleHarness />);
    const tools = screen.getByTestId('recipe-step-text-0-row-tools');
    expect(tools).toContainElement(screen.getByTestId('recipe-step-remove-0'));
    expect(tools).toContainElement(screen.getByTestId('recipe-step-add-0'));
    expect(within(tools).queryByRole('switch')).toBeNull();
  });
});

function rows(prefix = 'recipe-step'): HTMLElement[] {
  return screen.getAllByTestId(`${prefix}-row`);
}

function expectNoDragMarks(prefix = 'recipe-step'): void {
  for (const row of rows(prefix)) {
    expect(row).not.toHaveAttribute('data-dragging');
    expect(row).not.toHaveAttribute('data-drop-target');
  }
}

describe('RecipeStepsField — tarjeta del paso y estados de arrastre (rediseño)', () => {
  it('R16: la tarjeta tiene dos columnas, asa con el número debajo y el editor entero a la derecha', () => {
    render(<EvidenceHarness initial={[step('a', 'Pesar'), step('b', 'Mezclar')]} />);

    const [first] = rows();
    expect(first?.className).toContain('grid-cols-[44px_minmax(0,1fr)]');
    expect(first?.children).toHaveLength(2);
    const [left, right] = Array.from(first?.children ?? []);
    const handle = screen.getByTestId('recipe-step-handle-0');
    const number = screen.getByTestId('recipe-step-number-0');
    expect(left).toContainElement(handle);
    expect(left).toContainElement(number);
    expect(handle.compareDocumentPosition(number) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(number).toHaveTextContent('1');
    expect(number).toHaveAttribute('aria-hidden', 'true');
    expect(number.className).toContain('font-mono');
    expect(screen.getByTestId('recipe-step-number-1')).toHaveTextContent('2');
    expect(right).toContainElement(screen.getByTestId('recipe-step-text-0-editor'));
    expect(right).toContainElement(screen.getByTestId('recipe-step-remove-0'));
    expect(right).toContainElement(screen.getByTestId('recipe-step-add-0'));
  });

  it('R16: quitar y añadir con icono y nombre de hoy en la barra; bajo 768 px la barra se parte en dos líneas', () => {
    render(<EvidenceHarness initial={[step('a', 'Pesar')]} />);

    const bar = screen.getByTestId('recipe-step-text-0-bar');
    const tools = screen.getByTestId('recipe-step-text-0-row-tools');
    expect(bar).toContainElement(screen.getByTestId('recipe-step-text-0-toolbar'));
    expect(bar).toContainElement(tools);
    expect(bar.className).toContain('flex-wrap');
    expect(tools.className).toContain('w-full');
    expect(tools.className).toContain('md:w-auto');
    expect(within(tools).getByRole('button', { name: 'Quitar paso 1' })).toBeInTheDocument();
    expect(within(tools).getByRole('button', { name: 'Añadir un paso después del 1' })).toBeInTheDocument();
    expect(within(tools).getByRole('switch', { name: 'Requiere evidencia en el paso 1 de Pasos' })).toBeInTheDocument();
  });

  it('R17: no hay «Añadir paso» al final de ninguna lista; el «+» de cada paso conserva su regla', async () => {
    const user = setupUser();
    render(<DoubleHarness />);

    expect(screen.queryByTestId('recipe-step-add')).toBeNull();
    expect(screen.queryByTestId('recipe-packing-step-add')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Añadir paso/ })).toBeNull();
    expect(screen.getByTestId('recipe-step-add-1')).toBeEnabled();

    await user.click(screen.getByTestId('recipe-step-add-1'));
    expect(screen.getByTestId('recipe-step-add-0')).toBeDisabled();
    expect(screen.getByTestId('recipe-step-add-2')).toBeDisabled();
    expect(screen.getByTestId('recipe-packing-step-add-1')).toBeEnabled();
  });

  it('R18, R19: con teclado, Espacio toma el paso, lo marca y marca las demás como destino; al soltar no queda ninguna marca y el orden cambia', async () => {
    const uninstall = installRowRectStub();
    try {
      const user = setupUser();
      render(<SingleHarness initial={[step('a', 'Pesar'), step('b', 'Mezclar'), step('c', 'Envasar')]} />);
      expectNoDragMarks();

      screen.getByTestId('recipe-step-handle-0').focus();
      await user.keyboard(' ');
      const [lifted, second, third] = rows();
      expect(lifted).toHaveAttribute('data-dragging', 'true');
      expect(lifted).not.toHaveAttribute('data-drop-target');
      expect(lifted?.className).toContain('shadow-lg');
      expect(lifted?.className).toContain('border-primary');
      expect(lifted?.className).toContain('scale-[1.01]');
      expect(lifted?.className).toContain('motion-reduce:scale-100');
      for (const row of [second, third]) {
        expect(row).toHaveAttribute('data-drop-target', 'true');
        expect(row).not.toHaveAttribute('data-dragging');
        expect(row?.className).toContain('border-dashed');
      }
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(document.body.textContent).toContain('El paso se movería a la posición 2 de 3.');
      });
      await user.keyboard(' ');
      expectNoDragMarks();
      expect(textOf('recipe-step-text-0')).toContain('Mezclar');
      expect(textOf('recipe-step-text-1')).toContain('Pesar');
    } finally {
      uninstall();
    }
  });

  it('R18: al cancelar con Escape no queda ninguna marca y el orden no cambia', async () => {
    const uninstall = installRowRectStub();
    try {
      const user = setupUser();
      render(<SingleHarness initial={[step('a', 'Pesar'), step('b', 'Mezclar')]} />);

      screen.getByTestId('recipe-step-handle-0').focus();
      await user.keyboard(' ');
      expect(rows()[0]).toHaveAttribute('data-dragging', 'true');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Escape}');

      expectNoDragMarks();
      expect(textOf('recipe-step-text-0')).toContain('Pesar');
      expect(textOf('recipe-step-text-1')).toContain('Mezclar');
    } finally {
      uninstall();
    }
  });

  it('R18: el arrastre de una lista no marca las tarjetas de la otra', async () => {
    const uninstall = installRowRectStub();
    try {
      const user = setupUser();
      render(<DoubleHarness />);

      screen.getByTestId('recipe-packing-step-handle-0').focus();
      await user.keyboard(' ');
      expect(rows('recipe-packing-step')[1]).toHaveAttribute('data-drop-target', 'true');
      expectNoDragMarks('recipe-step');
      await user.keyboard('{Escape}');
      expectNoDragMarks('recipe-packing-step');
    } finally {
      uninstall();
    }
  });

  it('R19: con `locked`, asa y quitar deshabilitados con su nombre de hoy, sin marcas de arrastre ni cambio de orden', async () => {
    const uninstall = installRowRectStub();
    try {
      const user = setupUser();
      render(<EvidenceHarness initial={[step('a', 'Pesar'), step('b', 'Mezclar')]} locked />);

      const handle = screen.getByTestId('recipe-step-handle-0');
      expect(handle).toBeDisabled();
      expect(handle).toHaveAccessibleName('No se puede mover el paso 1: hay pedidos en curso con fotos');
      expect(screen.getByTestId('recipe-step-remove-0')).toHaveAccessibleName(
        'No se puede quitar el paso 1: hay pedidos en curso con fotos',
      );

      handle.focus();
      await user.keyboard(' ');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      expectNoDragMarks();
      expect(textOf('recipe-step-text-0')).toContain('Pesar');
      expect(textOf('recipe-step-text-1')).toContain('Mezclar');
    } finally {
      uninstall();
    }
  });

  it('R19: el asa conserva su nombre con la posición, `touch-none` y la talla táctil', () => {
    render(<SingleHarness initial={[step('a', 'Pesar'), step('b', 'Mezclar')]} />);

    const handle = screen.getByTestId('recipe-step-handle-1');
    expect(handle).toHaveAccessibleName('Arrastrar el paso en la posición 2 de 2');
    expect(handle.className).toContain('touch-none');
    expect(handle.className).toContain('min-h-11');
    expect(handle.className).toContain('min-w-11');
  });
});

describe('RecipeStepsField — sección opcional con ayuda', () => {
  it('con optionalHelp, el título lleva «(opcional)» y el icono abre la ayuda en un tooltip', async () => {
    const user = setupUser();
    render(<DoubleHarness />);

    const trigger = screen.getByRole('button', { name: 'Qué son los pasos de envasado' });
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(screen.queryByTestId('recipe-packing-steps-help-text')).toBeNull();

    await user.hover(trigger);
    expect(await screen.findByTestId('recipe-packing-steps-help-text')).toHaveTextContent(
      'Ayuda de envasado',
    );
  });
});

const CONDITIONING_HELP =
  'Opcional. Pasos que sigue el acondicionador uno a uno al acondicionar el pedido. «Asignación requerida» le pide elegir quién del equipo hizo el paso.';

function stepWithMarks(
  key: string,
  text: string,
  marks: { readonly evidence?: boolean; readonly assignment?: boolean },
): RecipeStepFormValue {
  const document: ConditioningStepInput = { ...doc(text) };
  if (marks.evidence === true) document.requiresEvidence = true;
  if (marks.assignment === true) document.requiresAssignment = true;
  return { key, document };
}

function ConditioningHarness({ initial }: { readonly initial: RecipeStepFormValue[] }) {
  const [steps, setSteps] = useState<readonly RecipeStepFormValue[]>(initial);
  return (
    <RecipeStepsField
      steps={steps}
      onChange={(next) => {
        lastSteps = next;
        setSteps(next);
      }}
      title="Acondicionamiento"
      optionalDescription={CONDITIONING_HELP}
      testIdPrefix="recipe-conditioning-step"
      showEvidenceSwitch
      showAssignmentSwitch
    />
  );
}

function conditioningSwitch(kind: 'evidence' | 'assignment', position: number): HTMLElement {
  const name =
    kind === 'evidence'
      ? `Requiere evidencia en el paso ${position} de Acondicionamiento`
      : `Asignación requerida en el paso ${position} de Acondicionamiento`;
  return screen.getByRole('switch', { name });
}

function assignmentOf(step: RecipeStepFormValue | undefined): boolean | undefined {
  const document: ConditioningStepInput | undefined = step?.document;
  return document?.requiresAssignment;
}

describe('RecipeStepsField — sección «Acondicionamiento» (QC-299)', () => {
  it('R8: la sección se marca «(opcional)» y muestra su ayuda como texto, sin icono «!»', () => {
    render(<ConditioningHarness initial={[]} />);

    const field = screen.getByTestId('recipe-conditioning-steps-field');
    expect(within(field).getByRole('heading', { name: /^Acondicionamiento/ })).toBeInTheDocument();
    expect(screen.getByTestId('recipe-conditioning-steps-optional')).toHaveTextContent('(opcional)');
    expect(screen.getByTestId('recipe-conditioning-steps-description')).toHaveTextContent(
      CONDITIONING_HELP,
    );
    expect(screen.queryByTestId('recipe-conditioning-steps-help')).toBeNull();
    expect(within(field).getAllByTestId('recipe-conditioning-step-row')).toHaveLength(1);
  });

  it('R9: cada fila ofrece «Requiere evidencia» y «Asignación requerida», apagados en una fila nueva', async () => {
    const user = setupUser();
    render(<ConditioningHarness initial={[step('a', 'Sellar')]} />);

    expect(conditioningSwitch('evidence', 1)).toHaveAttribute('aria-checked', 'false');
    expect(conditioningSwitch('assignment', 1)).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByTestId('recipe-conditioning-step-add-0'));
    expect(conditioningSwitch('evidence', 2)).toHaveAttribute('aria-checked', 'false');
    expect(conditioningSwitch('assignment', 2)).toHaveAttribute('aria-checked', 'false');
    expect(assignmentOf(lastSteps[1])).toBeUndefined();
    expect(lastSteps[1]?.document.requiresEvidence).toBeUndefined();
  });

  it('R9: «Pasos» y «Envasado» siguen ofreciendo solo «Requiere evidencia»', () => {
    render(
      <>
        <RecipeStepsField steps={[step('a', 'Pesar')]} onChange={() => undefined} showEvidenceSwitch />
        <RecipeStepsField
          steps={[step('b', 'Etiquetar')]}
          onChange={() => undefined}
          title="Pasos de envasado"
          sectionName="Envasado"
          testIdPrefix="recipe-packing-step"
          showEvidenceSwitch
        />
      </>,
    );

    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(screen.queryByRole('switch', { name: /Asignación requerida/ })).toBeNull();
    expect(
      screen.getByRole('switch', { name: 'Requiere evidencia en el paso 1 de Pasos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Requiere evidencia en el paso 1 de Envasado' }),
    ).toBeInTheDocument();
  });

  it('R10: el nombre accesible de cada switch lleva el número de paso y la sección', () => {
    render(<ConditioningHarness initial={[step('a', 'Sellar'), step('b', 'Etiquetar')]} />);

    expect(conditioningSwitch('evidence', 2)).toBeInTheDocument();
    expect(conditioningSwitch('assignment', 2)).toBeInTheDocument();
    for (const control of screen.getAllByRole('switch')) expect(control.textContent).toBe('');
  });

  it('R9, R10: las dos marcas son independientes, escribir no las apaga y apagarlas quita la clave', async () => {
    const user = setupUser();
    render(<ConditioningHarness initial={[step('a', 'Sellar'), step('b', 'Etiquetar')]} />);

    await user.click(conditioningSwitch('assignment', 2));
    expect(assignmentOf(lastSteps[1])).toBe(true);
    expect(lastSteps[1]?.document.requiresEvidence).toBeUndefined();
    expect(assignmentOf(lastSteps[0])).toBeUndefined();
    expect(screen.getByTestId('recipe-conditioning-step-text-1-assignment-help')).toHaveTextContent(
      'Al ejecutar, hay que elegir uno o más responsables del equipo antes de avanzar.',
    );

    await user.click(conditioningSwitch('evidence', 2));
    expect(lastSteps[1]?.document.requiresEvidence).toBe(true);
    expect(assignmentOf(lastSteps[1])).toBe(true);

    await user.click(conditioningSwitch('assignment', 2));
    expect('requiresAssignment' in (lastSteps[1]?.document ?? {})).toBe(false);
    expect(lastSteps[1]?.document.requiresEvidence).toBe(true);
  });

  it('R11: la cabecera resume pasos, evidencias y responsables, omitiendo las cifras en cero', async () => {
    const user = setupUser();
    render(
      <ConditioningHarness
        initial={[
          step('a', 'Revisar'),
          stepWithMarks('b', 'Etiquetar', { evidence: true, assignment: true }),
          stepWithMarks('c', 'Armar cajas', { assignment: true }),
          step('d', 'Contar'),
        ]}
      />,
    );
    const summary = screen.getByTestId('recipe-conditioning-step-evidence-summary');
    expect(summary.textContent).toBe('4 pasos · 1 pide evidencia · 2 piden responsables');

    await user.click(conditioningSwitch('assignment', 2));
    await user.click(conditioningSwitch('assignment', 3));
    expect(summary.textContent).toBe('4 pasos · 1 pide evidencia');

    await user.click(conditioningSwitch('evidence', 2));
    expect(summary.textContent).toBe('4 pasos');

    await user.click(conditioningSwitch('assignment', 1));
    expect(summary.textContent).toBe('4 pasos · 1 pide responsables');
  });

  it('R11: con la fila en blanco de arranque el resumen cuenta un paso', () => {
    render(<ConditioningHarness initial={[]} />);
    expect(screen.getByTestId('recipe-conditioning-step-evidence-summary').textContent).toBe('1 paso');
  });

  it('R12: el error de un paso de acondicionamiento se pinta junto a ese paso, con su id propio', () => {
    render(
      <RecipeStepsField
        steps={[step('a', 'Sellar'), step('b', '')]}
        onChange={() => undefined}
        errors={{ 1: 'Un paso no puede quedar vacio.' }}
        testIdPrefix="recipe-conditioning-step"
        showEvidenceSwitch
        showAssignmentSwitch
      />,
    );
    expect(screen.getByTestId('recipe-conditioning-step-field-error-1')).toHaveTextContent(
      'Un paso no puede quedar vacio.',
    );
    expect(screen.getByTestId('recipe-conditioning-step-field-error-1')).toHaveAttribute(
      'id',
      'recipe-conditioning-step-error-1',
    );
    expect(screen.queryByTestId('recipe-conditioning-step-field-error-0')).toBeNull();
  });
});
