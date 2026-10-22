import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PACKING_FINISH_BADGE_TESTID,
  PACKING_FINISH_COUNT_TESTID,
  PACKING_FINISH_DIALOG_TEXTS as T,
  PACKING_FINISH_GATE_TESTID,
  PACKING_FINISH_HELP_TESTID,
  PACKING_FINISH_LINE_ERROR_TESTID,
  PACKING_FINISH_LINE_TESTID,
  PACKING_FINISH_OTHER_ERROR_TESTID,
  PACKING_FINISH_OTHER_FOLD_TESTID,
  PACKING_FINISH_OTHER_TESTID,
  PACKING_FINISH_REASON_ERROR_TESTID,
  PACKING_FINISH_REASON_FOLD_TESTID,
  PACKING_FINISH_REASON_OPTION_TESTID,
  PACKING_FINISH_REASON_TESTID,
  PACKING_FINISH_SURPLUS_TESTID,
  PACKING_FINISH_TOTAL_TESTID,
  PackingFinishDialog,
  type PackingFinishDialogProps,
} from '@/app/(private)/asignacion/empaque/[id]/components';
import {
  ENTITY_IMAGE_ZOOM_TESTID,
  ENTITY_IMAGE_ZOOM_TRIGGER_TESTID,
  MISSING_IMAGE_SRC,
} from '@/components/shared/entity-image';
import { STEP_EVIDENCE_TEXTS } from '@/components/shared/step-evidence';
import type { PackingOrderDetail } from '@/lib/modules/asignaciones';
import { packingSurplusByLine } from '@/lib/modules/pedidos';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

type Finish = NonNullable<PackingOrderDetail['finish']>;
type User = ReturnType<typeof setupUser>;

const LITRO = { id: 'unit-l', baseUnitId: null, factor: null } as const;

/** El pedido de los tableros: 72 L, Galón 3,78 L × 14 (6 libres) y Botella 1 L × 15 (2 libres). */
const FINISH: Finish = {
  orderQuantity: '72',
  orderUnit: LITRO,
  orderUnitLabel: 'L',
  lines: [
    {
      lineId: 'linea-galon',
      label: 'Galón 3,78 L',
      plan: 14,
      content: '3.78',
      unit: LITRO,
      packaging: { productId: 'envase-galon', name: 'Galón 3,78 L', freePackages: 6 },
    },
    {
      lineId: 'linea-botella',
      label: 'Botella 1 L',
      plan: 15,
      content: '1',
      unit: LITRO,
      packaging: { productId: 'envase-botella', name: 'Botella 1 L', freePackages: 2 },
    },
  ],
};

const TEST_IDS = { dialog: 'dialogo', dismiss: 'dialogo-cancelar', confirm: 'dialogo-terminar' } as const;

function pintar(overrides: Partial<PackingFinishDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <PackingFinishDialog
      open
      onOpenChange={onOpenChange}
      finish={FINISH}
      numberText="2026-0000004"
      recipeName="Limpiador multiusos limón"
      quantityText="72 L"
      hasEvidenceSteps={false}
      onConfirm={onConfirm}
      testIds={TEST_IDS}
      {...overrides}
    />,
  );
  return { onConfirm, onOpenChange, user: setupUser() };
}

function linea(lineId: string): HTMLElement {
  const fila = screen
    .getAllByTestId(PACKING_FINISH_LINE_TESTID)
    .find((nodo) => nodo.getAttribute('data-line-id') === lineId);
  expect(fila).toBeDefined();
  return fila!;
}

const galon = () => linea('linea-galon');
const botella = () => linea('linea-botella');

async function contar(user: User, fila: HTMLElement, valor: string) {
  const campo = within(fila).getByTestId(PACKING_FINISH_COUNT_TESTID);
  await user.clear(campo);
  if (valor !== '') await user.type(campo, valor);
}

/** Abre el selector y devuelve las etiquetas ofrecidas; lo deja abierto. */
async function opcionesDeMotivo(user: User, fila: HTMLElement): Promise<string[]> {
  await user.click(within(fila).getByTestId(PACKING_FINISH_REASON_TESTID));
  const opciones = await screen.findAllByTestId(PACKING_FINISH_REASON_OPTION_TESTID);
  return opciones.map((opcion) => opcion.textContent ?? '');
}

async function elegirMotivo(user: User, fila: HTMLElement, etiqueta: string) {
  await user.click(within(fila).getByTestId(PACKING_FINISH_REASON_TESTID));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: etiqueta })));
  await waitFor(() => expect(screen.queryByRole('option', { name: etiqueta })).toBeNull());
}

function terminar(): HTMLElement {
  return screen.getByTestId(TEST_IDS.confirm);
}

function pie(): string {
  return screen.getByTestId(PACKING_FINISH_GATE_TESTID).textContent ?? '';
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('diálogo «¿Terminar el empaque?» — estado igual', () => {
  it('R1: una fila por línea con nombre, «Plan: N envases» y «Envases reales» prellenado con el plan', () => {
    pintar();

    const dialogo = screen.getByRole('dialog', { name: T.title });
    expect(dialogo).toHaveAttribute('data-testid', TEST_IDS.dialog);
    expect(screen.getAllByTestId(PACKING_FINISH_LINE_TESTID)).toHaveLength(2);
    expect(within(galon()).getByText('Galón 3,78 L')).toBeInTheDocument();
    expect(galon()).toHaveTextContent('Plan: 14 envases');
    expect(within(galon()).getByRole('textbox', { name: 'Envases reales de Galón 3,78 L' })).toHaveValue('14');
    expect(within(botella()).getByRole('textbox', { name: 'Envases reales de Botella 1 L' })).toHaveValue('15');
    expect(galon()).toHaveAttribute('role', 'group');
    expect(galon()).toHaveAccessibleName('Galón 3,78 L');
  });

  it('R1: la cabecera dice número, receta y cantidad; los botones ±1 tienen nombre y talla táctil', () => {
    pintar();

    const dialogo = screen.getByTestId(TEST_IDS.dialog);
    expect(dialogo).toHaveTextContent('2026-0000004 · Limpiador multiusos limón · Cantidad 72 L');
    const menos = within(galon()).getByRole('button', { name: 'Quitar un envase de Galón 3,78 L' });
    const mas = within(galon()).getByRole('button', { name: 'Añadir un envase de Galón 3,78 L' });
    for (const boton of [menos, mas]) expect(boton.className).toContain('min-h-11');
    expect(within(dialogo).getByRole('button', { name: T.close })).toBeInTheDocument();
  });

  it('R3: todo igual al plan → sin insignia, sin motivo y Terminar activo', () => {
    pintar();

    expect(screen.queryByTestId(PACKING_FINISH_BADGE_TESTID)).toBeNull();
    expect(screen.queryByTestId(PACKING_FINISH_REASON_TESTID)).toBeNull();
    expect(screen.queryByText(T.reasonLabel)).toBeNull();
    expect(terminar()).toBeEnabled();
    expect(pie()).toBe('');
  });

  it('R7: el pie «Envasado: total de cantidad» se ve siempre, también sin diferencias', () => {
    pintar();

    // 14 × 3,78 + 15 × 1 = 67,92 L
    expect(screen.getByTestId(PACKING_FINISH_TOTAL_TESTID)).toHaveTextContent('Envasado: 67.92 L de 72 L');
  });

  it('R33: sin pasos con foto la descripción es la del tablero tal cual', () => {
    pintar();

    expect(screen.getByTestId(TEST_IDS.dialog)).toHaveAccessibleDescription(
      'Cuenta los envases que salieron de verdad. Ya vienen con el plan: cambia solo los que no coinciden. Terminar el empaque no se puede deshacer.',
    );
  });

  it('R33: con pasos con foto la descripción acaba en el aviso de evidencias', () => {
    pintar({ hasEvidenceSteps: true });

    expect(screen.getByTestId(TEST_IDS.dialog)).toHaveAccessibleDescription(
      `Cuenta los envases que salieron de verdad. Ya vienen con el plan: cambia solo los que no coinciden. ${STEP_EVIDENCE_TEXTS.finishWarning}`,
    );
    expect(STEP_EVIDENCE_TEXTS.finishWarning).toBe(
      'Al terminar, las fotos de evidencia quedan fijas. No se puede deshacer.',
    );
  });

  it('R1, R16: Terminar sin cambios envía el plan de cada línea sin motivo', async () => {
    const { onConfirm, onOpenChange, user } = pintar();

    await user.click(terminar());

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).toHaveBeenCalledWith([
      { lineId: 'linea-galon', packedPackages: 14, reason: null, reasonOther: null },
      { lineId: 'linea-botella', packedPackages: 15, reason: null, reasonOther: null },
    ]);
  });
});

describe('diálogo — diferencia y motivo', () => {
  it('R3, R10: con menos envases, insignia «−1», motivos de menos y ayuda de liberar', async () => {
    const { user } = pintar();

    await user.click(within(galon()).getByRole('button', { name: 'Quitar un envase de Galón 3,78 L' }));

    const insignia = within(galon()).getByTestId(PACKING_FINISH_BADGE_TESTID);
    expect(insignia.textContent).toBe('−1');
    expect(insignia).toHaveAttribute('data-tone', 'waiting');
    expect(insignia).toHaveAccessibleName('1 menos que el plan');
    expect(await opcionesDeMotivo(user, galon())).toEqual([
      'Merma',
      'Rotura',
      'Conteo físico',
      'Error de carga',
      'Otro',
    ]);
    expect(within(galon()).queryByText(T.increaseHint)).toBeNull();
    expect(within(galon()).getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveTextContent('Se libera 1 envase apartado.');
  });

  it('R10: con varios de menos, la ayuda va en plural', async () => {
    const { user } = pintar();

    await contar(user, botella(), '12');

    expect(within(botella()).getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveTextContent('Se liberan 3 envases apartados.');
  });

  it('R3, R10: con más envases, «+1», solo Conteo físico/Error de carga/Otro, su ayuda y la de salir del libre', async () => {
    const { user } = pintar();

    await user.click(within(botella()).getByRole('button', { name: 'Añadir un envase de Botella 1 L' }));

    expect(within(botella()).getByTestId(PACKING_FINISH_BADGE_TESTID).textContent).toBe('+1');
    expect(await opcionesDeMotivo(user, botella())).toEqual(['Conteo físico', 'Error de carga', 'Otro']);
    expect(within(botella()).getByText(T.increaseHint)).toBeInTheDocument();
    expect(T.increaseHint).toBe('Para envases de más solo valen Conteo físico, Error de carga u Otro.');
    expect(within(botella()).getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveTextContent(
      'Sale 1 envase vacío del stock libre (quedan 2).',
    );
  });

  it('R10: con dos de más la ayuda de salir va en plural', async () => {
    const { user } = pintar();

    await contar(user, botella(), '17');

    expect(within(botella()).getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveTextContent(
      'Salen 2 envases vacíos del stock libre (quedan 2).',
    );
  });

  it('R3: volver al plan quita insignia y motivo', async () => {
    const { user } = pintar();

    await contar(user, galon(), '13');
    expect(within(galon()).getByTestId(PACKING_FINISH_REASON_TESTID)).toBeInTheDocument();

    await contar(user, galon(), '14');
    expect(within(galon()).queryByTestId(PACKING_FINISH_BADGE_TESTID)).toBeNull();
    expect(within(galon()).queryByRole('combobox')).toBeNull();
    await waitFor(() => expect(within(galon()).queryByTestId(PACKING_FINISH_REASON_TESTID)).toBeNull());
  });

  it('R4: al pasar de menos a más, un motivo que no vale para más se vacía', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, botella(), '14');
    await elegirMotivo(user, botella(), 'Rotura');
    expect(within(botella()).getByTestId(PACKING_FINISH_REASON_TESTID)).toHaveTextContent('Rotura');

    await contar(user, botella(), '16');
    expect(within(botella()).getByTestId(PACKING_FINISH_REASON_TESTID)).toHaveTextContent(T.reasonPlaceholder);

    await contar(user, botella(), '14');
    expect(within(botella()).getByTestId(PACKING_FINISH_REASON_TESTID)).toHaveTextContent(T.reasonPlaceholder);

    await user.click(terminar());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(within(botella()).getByTestId(PACKING_FINISH_REASON_ERROR_TESTID)).toHaveTextContent('Elige un motivo.');
  });

  it('R4: un motivo que vale en los dos sentidos se conserva al cambiar de sentido', async () => {
    const { user } = pintar();

    await contar(user, botella(), '14');
    await elegirMotivo(user, botella(), 'Conteo físico');
    await contar(user, botella(), '16');

    expect(within(botella()).getByTestId(PACKING_FINISH_REASON_TESTID)).toHaveTextContent('Conteo físico');
  });

  it('R3, R16: con diferencia y motivo, Terminar envía real y motivo', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, galon(), '13');
    await elegirMotivo(user, galon(), 'Rotura');
    await user.click(terminar());

    expect(onConfirm).toHaveBeenCalledWith([
      { lineId: 'linea-galon', packedPackages: 13, reason: 'rotura', reasonOther: null },
      { lineId: 'linea-botella', packedPackages: 15, reason: null, reasonOther: null },
    ]);
  });
});

describe('diálogo — «Otro»', () => {
  it('R5, R13: «Otro» abre «Describe el motivo» con tope de 200 caracteres y envía el texto recortado', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, botella(), '14');
    expect(within(botella()).queryByTestId(PACKING_FINISH_OTHER_TESTID)).toBeNull();
    await elegirMotivo(user, botella(), 'Otro');

    const texto = within(botella()).getByRole('textbox', { name: /Describe el motivo/ });
    expect(texto).toHaveAttribute('maxlength', '200');
    expect(texto).toHaveAttribute('aria-required', 'true');
    await user.type(texto, '  Se cayó una caja al pasarla a la estiba.  ');
    await user.click(terminar());

    expect(onConfirm).toHaveBeenCalledWith([
      { lineId: 'linea-galon', packedPackages: 14, reason: null, reasonOther: null },
      {
        lineId: 'linea-botella',
        packedPackages: 14,
        reason: 'otro',
        reasonOther: 'Se cayó una caja al pasarla a la estiba.',
      },
    ]);
  });

  it('R13: el campo no admite más de 200 caracteres', async () => {
    const { user } = pintar();

    await contar(user, botella(), '14');
    await elegirMotivo(user, botella(), 'Otro');
    const texto = within(botella()).getByTestId(PACKING_FINISH_OTHER_TESTID);
    await user.type(texto, 'x'.repeat(205));

    expect((texto as HTMLTextAreaElement).value).toHaveLength(200);
  });

  it('R6: «Otro» con solo espacios no envía y pide «Escribe el motivo.»', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, botella(), '14');
    await elegirMotivo(user, botella(), 'Otro');
    await user.type(within(botella()).getByTestId(PACKING_FINISH_OTHER_TESTID), '   ');
    await user.click(terminar());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(within(botella()).getByTestId(PACKING_FINISH_OTHER_ERROR_TESTID)).toHaveTextContent('Escribe el motivo.');
    expect(pie()).toBe('Falta el motivo en las líneas que no coinciden con el plan.');
  });
});

describe('diálogo — sin motivo', () => {
  it('R6: Terminar con una línea distinta y sin motivo no envía; marca la línea y el pie', async () => {
    const { user, onConfirm, onOpenChange } = pintar();

    await contar(user, galon(), '13');
    expect(within(galon()).queryByTestId(PACKING_FINISH_REASON_ERROR_TESTID)).toBeNull();
    expect(terminar()).toBeEnabled();

    await user.click(terminar());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(within(galon()).getByTestId(PACKING_FINISH_REASON_ERROR_TESTID)).toHaveTextContent('Elige un motivo.');
    expect(within(galon()).getByTestId(PACKING_FINISH_REASON_TESTID)).toHaveAttribute('aria-invalid', 'true');
    expect(pie()).toBe('Falta el motivo en las líneas que no coinciden con el plan.');
  });
});

describe('diálogo — conteo no válido', () => {
  it('R2: vacío → «Escribe un número entero: 0 o más.» y Terminar deshabilitado', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, galon(), '');

    expect(within(galon()).getByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toHaveTextContent(
      'Escribe un número entero: 0 o más.',
    );
    expect(within(galon()).getByTestId(PACKING_FINISH_COUNT_TESTID)).toHaveAttribute('aria-invalid', 'true');
    expect(terminar()).toBeDisabled();
    expect(pie()).toBe('Corrige las líneas marcadas para poder terminar.');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('R2: solo entra un entero: letras, signos y decimales no se escriben', async () => {
    const { user } = pintar();

    await contar(user, galon(), '-1,5a');

    expect(within(galon()).getByTestId(PACKING_FINISH_COUNT_TESTID)).toHaveValue('15');
    expect(within(galon()).getByTestId(PACKING_FINISH_COUNT_TESTID)).toHaveAttribute('inputmode', 'numeric');
  });

  it('R2: «−» no baja de 0', async () => {
    const { user } = pintar();
    await contar(user, galon(), '0');

    await user.click(within(galon()).getByRole('button', { name: 'Quitar un envase de Galón 3,78 L' }));

    expect(within(galon()).getByTestId(PACKING_FINISH_COUNT_TESTID)).toHaveValue('0');
  });
});

describe('diálogo — con excedente sobre el pedido', () => {
  const aviso = () => screen.queryByTestId(PACKING_FINISH_SURPLUS_TESTID);
  const totalEnvasado = () =>
    screen.getByTestId(PACKING_FINISH_TOTAL_TESTID).querySelector('.font-semibold') as HTMLElement;

  it('R19, R24: Galón 16 supera 72 L → sin error de línea, insignia normal, total sin tono de error y Terminar activo', async () => {
    const { user } = pintar();

    await contar(user, galon(), '16');

    expect(within(galon()).queryByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toBeNull();
    expect(screen.queryByText(/Supera la cantidad del pedido/)).toBeNull();
    expect(within(galon()).getByTestId(PACKING_FINISH_COUNT_TESTID)).not.toHaveAttribute('aria-invalid');
    expect(within(galon()).getByTestId(PACKING_FINISH_BADGE_TESTID)).toHaveAttribute('data-tone', 'waiting');
    expect(screen.getByTestId(PACKING_FINISH_TOTAL_TESTID)).toHaveTextContent('Envasado: 75.48 L de 72 L');
    expect(totalEnvasado()).toHaveTextContent('75.48 L');
    expect(totalEnvasado()).not.toHaveClass('text-destructive');
    expect(pie()).toBe('');
    expect(terminar()).toBeEnabled();
  });

  it('R19: con excedente y motivos, Terminar envía el conteo real', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, galon(), '16');
    await elegirMotivo(user, galon(), 'Conteo físico');
    await contar(user, botella(), '17');
    await elegirMotivo(user, botella(), 'Error de carga');
    await user.click(terminar());

    expect(onConfirm).toHaveBeenCalledWith([
      { lineId: 'linea-galon', packedPackages: 16, reason: 'conteo_fisico', reasonOther: null },
      { lineId: 'linea-botella', packedPackages: 17, reason: 'error_de_carga', reasonOther: null },
    ]);
  });

  it('R20: estado del tablero (Galón 16, Botella 17) → un aviso informativo encima del pie con lo que sobra y los libres', async () => {
    const { user } = pintar();

    await contar(user, galon(), '16');
    await contar(user, botella(), '17');

    const notice = screen.getByTestId(PACKING_FINISH_SURPLUS_TESTID);
    expect(screen.getAllByTestId(PACKING_FINISH_SURPLUS_TESTID)).toHaveLength(1);
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('data-tone', 'info');
    expect(within(notice).getByText('Sobran 5.48 L sobre el pedido.')).toBeInTheDocument();
    expect(
      within(notice).getByText('Quedan libres en stock: 1 envase de Galón 3,78 L, 1 envase de Botella 1 L.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId(PACKING_FINISH_TOTAL_TESTID)).toHaveTextContent('Envasado: 77.48 L de 72 L');
    // Encima del pie: antes del total en el orden del documento.
    expect(
      notice.compareDocumentPosition(screen.getByTestId(PACKING_FINISH_TOTAL_TESTID)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(terminar()).toBeEnabled();
  });

  it('R20, R7: con la línea de menor contenido antes en el reparto, el aviso lista de mayor a menor contenido', async () => {
    const botellaPrimero: Finish = { ...FINISH, lines: [...FINISH.lines].reverse() };
    const { user } = pintar({ finish: botellaPrimero });

    await contar(user, galon(), '16');
    await contar(user, botella(), '17');

    expect(screen.getAllByTestId(PACKING_FINISH_LINE_TESTID).map((fila) => fila.getAttribute('data-line-id'))).toEqual([
      'linea-botella',
      'linea-galon',
    ]);
    expect(aviso()).toHaveTextContent(
      'Quedan libres en stock: 1 envase de Galón 3,78 L, 1 envase de Botella 1 L.',
    );
  });

  it('R20, R7: a igual contenido el aviso conserva el orden del reparto', async () => {
    const botella1L = (lineId: string, label: string) => ({
      lineId,
      label,
      plan: 36,
      content: '1',
      unit: LITRO,
      packaging: { productId: `envase-${lineId}`, name: label, freePackages: 6 },
    });
    // Ni alfabético ni por número de libres: la Z va primero en el reparto y deja menos.
    const igualContenido: Finish = {
      ...FINISH,
      lines: [botella1L('linea-z', 'Botella Z 1 L'), botella1L('linea-a', 'Botella A 1 L')],
    };
    const { user } = pintar({ finish: igualContenido });

    // 37 + 39 = 76 L: sobran 4 L; la Z suelta su envase de más y la A los 3 restantes.
    await contar(user, linea('linea-z'), '37');
    await contar(user, linea('linea-a'), '39');

    expect(aviso()).toHaveTextContent('Sobran 4 L sobre el pedido.');
    expect(aviso()).toHaveTextContent(
      'Quedan libres en stock: 1 envase de Botella Z 1 L, 3 envases de Botella A 1 L.',
    );
  });

  it('R20: varios envases libres de una presentación van en plural', async () => {
    const holgado: Finish = {
      ...FINISH,
      lines: FINISH.lines.map((line) => ({
        ...line,
        packaging: line.packaging === null ? null : { ...line.packaging, freePackages: 20 },
      })),
    };
    const { user } = pintar({ finish: holgado });

    // 14 × 3,78 + 22 × 1 = 74,92 L: sobran 2,92 L, caben 2 botellas enteras.
    await contar(user, botella(), '22');

    expect(aviso()).toHaveTextContent('Sobran 2.92 L sobre el pedido.');
    expect(aviso()).toHaveTextContent('Quedan libres en stock: 2 envases de Botella 1 L.');
  });

  it('R20: si lo que sobra no llega a un envase entero, lo dice y no promete libres', async () => {
    const { user } = pintar();

    // 15 × 3,78 + 16 × 1 = 72,70 L: sobran 0,70 L, menos que una botella.
    await contar(user, galon(), '15');
    await contar(user, botella(), '16');

    expect(aviso()).toHaveTextContent('Sobran 0.7 L sobre el pedido.');
    expect(aviso()).toHaveTextContent(
      'Ningún envase queda libre: lo que sobra no llega a un envase entero y sigue en el pedido.',
    );
  });

  it('R20: con una línea con error de conteo no hay aviso aunque el resto supere el pedido', async () => {
    const { user } = pintar();

    await contar(user, galon(), '20');
    expect(aviso()).not.toBeNull();
    await contar(user, botella(), '');

    expect(within(botella()).getByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toBeInTheDocument();
    expect(aviso()).toBeNull();
  });

  it('R21: igual o por debajo de la cantidad no hay aviso ni error', async () => {
    const { user } = pintar();

    expect(aviso()).toBeNull();
    await contar(user, galon(), '15');

    expect(within(galon()).queryByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toBeNull();
    expect(screen.getByTestId(PACKING_FINISH_TOTAL_TESTID)).toHaveTextContent('Envasado: 71.7 L de 72 L');
    expect(aviso()).toBeNull();
  });

  it('R21: al volver por debajo de la cantidad el aviso desaparece', async () => {
    const { user } = pintar();

    await contar(user, galon(), '16');
    expect(aviso()).not.toBeNull();
    await contar(user, galon(), '14');

    expect(aviso()).toBeNull();
  });

  it.each([
    ['Galón 16, Botella 17', '16', '17'],
    ['Galón 18, Botella 15', '18', '15'],
    ['Galón 15, Botella 17', '15', '17'],
  ])('R22: %s → los libres del aviso son los de packingSurplusByLine', async (_caso, galones, botellas) => {
    const { user } = pintar();

    await contar(user, galon(), galones);
    await contar(user, botella(), botellas);

    const surplus = packingSurplusByLine(
      FINISH.orderQuantity,
      FINISH.orderUnit,
      FINISH.lines.map((line) => ({
        lineId: line.lineId,
        presentationId: line.lineId,
        packedPackages: Number(line.lineId === 'linea-galon' ? galones : botellas),
        content: line.content,
        unit: line.unit,
        plan: line.plan,
      })),
    );
    expect(surplus.kind).toBe('ok');
    if (surplus.kind !== 'ok') return;
    const libres = FINISH.lines
      .map((line) => ({ name: line.label, packages: surplus.byLine.get(line.lineId) ?? 0 }))
      .filter((item) => item.packages > 0)
      .map((item) => T.freePackages(item.packages, item.name));
    expect(libres.length).toBeGreaterThan(0);
    expect(aviso()).toHaveTextContent(T.surplusFree(libres));
  });

  it('R23: con excedente el stock del envase sigue bloqueando y sin aviso', async () => {
    const { user, onConfirm } = pintar();

    // 16 × 3,78 + 19 × 1 = 79,48 L; Botella pide 4 vacías y quedan 2.
    await contar(user, galon(), '16');
    await contar(user, botella(), '19');

    expect(within(botella()).getByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toHaveTextContent(
      'No alcanza el stock del envase: hacen falta 4 envases vacíos de Botella 1 L y quedan 2 libres.',
    );
    expect(within(botella()).getByTestId(PACKING_FINISH_BADGE_TESTID)).toHaveAttribute('data-tone', 'danger');
    expect(aviso()).toBeNull();
    expect(pie()).toBe('Corrige las líneas marcadas para poder terminar.');
    expect(terminar()).toBeDisabled();
    await user.click(terminar());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('R23: con excedente siguen los motivos de «más», el motivo obligatorio y la ayuda de envases vacíos', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, galon(), '16');
    expect(within(galon()).getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveTextContent(
      'Salen 2 envases vacíos del stock libre (quedan 6).',
    );
    expect(within(galon()).getByText(T.increaseHint)).toBeInTheDocument();
    await user.click(terminar());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(within(galon()).getByTestId(PACKING_FINISH_REASON_ERROR_TESTID)).toHaveTextContent('Elige un motivo.');
    expect(pie()).toBe('Falta el motivo en las líneas que no coinciden con el plan.');
    expect(aviso()).not.toBeNull();
    expect(await opcionesDeMotivo(user, galon())).toEqual(['Conteo físico', 'Error de carga', 'Otro']);
  });

  it('R23: con excedente un conteo vacío sigue siendo error y deshabilita Terminar', async () => {
    const { user } = pintar();

    await contar(user, galon(), '20');
    await contar(user, botella(), '');

    expect(within(botella()).getByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toHaveTextContent(
      'Escribe un número entero: 0 o más.',
    );
    expect(pie()).toBe('Corrige las líneas marcadas para poder terminar.');
    expect(terminar()).toBeDisabled();
  });

  it('R24: el pie dice siempre «Envasado: total de cantidad», también por encima', async () => {
    const { user } = pintar();

    await contar(user, galon(), '20');

    // 20 × 3,78 + 15 = 90,60 L
    expect(screen.getByTestId(PACKING_FINISH_TOTAL_TESTID)).toHaveTextContent('Envasado: 90.6 L de 72 L');
    expect(totalEnvasado()).not.toHaveClass('text-destructive');
  });
});

describe('diálogo — stock libre del envase', () => {
  it('R9: Botella 19 pide 4 vacías y quedan 2 → error, pie y Terminar deshabilitado', async () => {
    const { user } = pintar();

    await contar(user, galon(), '13');
    await elegirMotivo(user, galon(), 'Rotura');
    await contar(user, botella(), '19');

    expect(within(botella()).getByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toHaveTextContent(
      'No alcanza el stock del envase: hacen falta 4 envases vacíos de Botella 1 L y quedan 2 libres.',
    );
    expect(within(botella()).getByTestId(PACKING_FINISH_BADGE_TESTID)).toHaveAttribute('data-tone', 'danger');
    expect(pie()).toBe('Corrige las líneas marcadas para poder terminar.');
    expect(terminar()).toBeDisabled();
  });

  it('R9: dos líneas con el mismo envase suman su exceso contra el libre', async () => {
    const compartido: Finish = {
      ...FINISH,
      orderQuantity: '100',
      lines: FINISH.lines.map((line) => ({
        ...line,
        packaging: { productId: 'envase-comun', name: 'Envase común', freePackages: 2 },
      })),
    };
    const { user } = pintar({ finish: compartido });

    await contar(user, galon(), '16');
    expect(within(galon()).queryByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toBeNull();
    await contar(user, botella(), '16');

    expect(within(botella()).getByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toHaveTextContent(
      'hacen falta 3 envases vacíos de Botella 1 L y quedan 2 libres.',
    );
  });
});

describe('diálogo — línea en 0', () => {
  it('R2, R10: 0 se acepta; pide motivo y avisa de que no da de alta lote y libera sus apartados', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, botella(), '0');

    expect(within(botella()).queryByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toBeNull();
    expect(within(botella()).getByTestId(PACKING_FINISH_BADGE_TESTID).textContent).toBe('−15');
    expect(within(botella()).getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveTextContent(
      'Esta línea no da de alta lote. Se liberan sus 15 envases apartados.',
    );
    await elegirMotivo(user, botella(), 'Merma');
    await user.click(terminar());

    expect(onConfirm).toHaveBeenCalledWith([
      { lineId: 'linea-galon', packedPackages: 14, reason: null, reasonOther: null },
      { lineId: 'linea-botella', packedPackages: 0, reason: 'merma', reasonOther: null },
    ]);
  });

  it('R32: con todas las líneas en 0 y su motivo, se puede Terminar', async () => {
    const { user, onConfirm } = pintar();

    await contar(user, galon(), '0');
    await elegirMotivo(user, galon(), 'Merma');
    await contar(user, botella(), '0');
    await elegirMotivo(user, botella(), 'Conteo físico');

    expect(screen.getByTestId(PACKING_FINISH_TOTAL_TESTID)).toHaveTextContent('Envasado: 0 L de 72 L');
    expect(terminar()).toBeEnabled();
    await user.click(terminar());

    expect(onConfirm).toHaveBeenCalledWith([
      { lineId: 'linea-galon', packedPackages: 0, reason: 'merma', reasonOther: null },
      { lineId: 'linea-botella', packedPackages: 0, reason: 'conteo_fisico', reasonOther: null },
    ]);
  });
});

describe('diálogo — cancelar', () => {
  it('R11: «Cancelar» cierra sin enviar', async () => {
    const { user, onConfirm, onOpenChange } = pintar();

    await contar(user, galon(), '13');
    await user.click(screen.getByTestId(TEST_IDS.dismiss));

    expect(screen.getByTestId(TEST_IDS.dismiss)).toHaveTextContent('Cancelar');
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('R11: la X «Cerrar» cierra sin enviar', async () => {
    const { user, onConfirm, onOpenChange } = pintar();

    await user.click(screen.getByRole('button', { name: T.close }));

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('diálogo — textos del tablero', () => {
  it('R1–R10, R19, R20: los textos con plantilla dicen lo del tablero', () => {
    expect(T).not.toHaveProperty('exceeds');
    expect(T.surplus('5,48 L')).toBe('Sobran 5,48 L sobre el pedido.');
    expect(T.surplusFree([T.freePackages(1, 'Galón 3,78 L'), T.freePackages(2, 'Botella 1 L')])).toBe(
      'Quedan libres en stock: 1 envase de Galón 3,78 L, 2 envases de Botella 1 L.',
    );
    expect(T.surplusNoneFree).toBe(
      'Ningún envase queda libre: lo que sobra no llega a un envase entero y sigue en el pedido.',
    );
    expect(T.stock(4, 'Botella 1 L', 2)).toBe(
      'No alcanza el stock del envase: hacen falta 4 envases vacíos de Botella 1 L y quedan 2 libres.',
    );
    expect(T.zeroHelp(15)).toBe('Esta línea no da de alta lote. Se liberan sus 15 envases apartados.');
    expect(T.reasons).toEqual({
      merma: 'Merma',
      rotura: 'Rotura',
      conteo_fisico: 'Conteo físico',
      error_de_carga: 'Error de carga',
      otro: 'Otro',
    });
  });
});

describe('diálogo — el bloque de motivo se despliega y se pliega', () => {
  // jsdom no pinta: Base UI solo anima el panel si lee una transición en su estilo calculado y un
  // alto medido, y lo desmonta cuando terminan sus `getAnimations()`. Aquí la transición se declara
  // con una hoja de estilo, el alto se finge y la salida «dura» hasta soltarla, como en el
  // navegador al acabar la animación.
  const PANEL = '[data-slot="collapsible-content"]';
  let hoja: HTMLStyleElement | null = null;
  let soltarSalida: (() => void) | null = null;

  beforeEach(() => {
    hoja = document.createElement('style');
    hoja.textContent = `${PANEL} { transition-duration: 200ms; }`;
    document.head.append(hoja);
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.matches(PANEL) ? 120 : 0;
      },
    });
  });

  afterEach(() => {
    hoja?.remove();
    soltarSalida?.();
    soltarSalida = null;
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
  });

  function salidaPendiente(): void {
    const finished = new Promise<void>((resolve) => {
      soltarSalida = resolve;
    });
    const animacion = { finished, pending: false, playState: 'running' };
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      writable: true,
      value(this: Element) {
        return this.matches(PANEL) ? [animacion] : [];
      },
    });
  }

  async function terminarSalida(): Promise<void> {
    await act(async () => {
      soltarSalida?.();
    });
  }

  const plegable = (fila: HTMLElement) => within(fila).getByTestId(PACKING_FINISH_REASON_FOLD_TESTID);

  it('R3: al diferir del plan el bloque se despliega abierto, accesible y con la transición del tablero', async () => {
    const { user } = pintar();

    expect(within(galon()).queryByTestId(PACKING_FINISH_REASON_FOLD_TESTID)).toBeNull();
    await contar(user, galon(), '13');

    const bloque = plegable(galon());
    expect(bloque).toHaveAttribute('data-open');
    expect(bloque).not.toHaveAttribute('inert');
    expect(bloque).not.toHaveAttribute('aria-hidden');
    expect(bloque.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        'grid',
        'grid-rows-[1fr]',
        'data-starting-style:grid-rows-[0fr]',
        'data-starting-style:translate-y-[10px]',
        'data-starting-style:opacity-0',
        'duration-(--dur-base)',
        'ease-(--ease-enter)',
      ]),
    );
    expect(within(galon()).getByRole('combobox')).toBeInTheDocument();
  });

  it('R3: al volver al plan el bloque se pliega (0fr y 10 px) inerte y oculto, con su contenido, y se desmonta al acabar', async () => {
    const { user } = pintar();

    await user.click(within(galon()).getByRole('button', { name: T.decrease('Galón 3,78 L') }));
    salidaPendiente();
    await user.click(within(galon()).getByRole('button', { name: T.increase('Galón 3,78 L') }));

    const bloque = plegable(galon());
    await waitFor(() => expect(bloque).toHaveAttribute('data-ending-style'));
    expect(bloque.isConnected).toBe(true);
    expect(bloque).toHaveAttribute('data-closed');
    expect(bloque).toHaveAttribute('inert');
    expect(bloque).toHaveAttribute('aria-hidden', 'true');
    expect(bloque.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        'data-ending-style:grid-rows-[0fr]',
        'data-ending-style:translate-y-[10px]',
        'data-ending-style:opacity-0',
        'data-closed:ease-(--ease-exit)',
        'duration-(--dur-base)',
      ]),
    );
    // Se pliega con lo que mostraba, no vacío: la ayuda de liberar sigue dentro mientras se mueve.
    expect(within(bloque).getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveTextContent('Se libera 1 envase apartado.');
    expect(within(galon()).queryByRole('combobox')).toBeNull();

    await terminarSalida();
    await waitFor(() => expect(within(galon()).queryByTestId(PACKING_FINISH_REASON_FOLD_TESTID)).toBeNull());
  });

  it('R3: si vuelve a diferir mientras se pliega, el mismo bloque se abre de nuevo', async () => {
    const { user } = pintar();

    await contar(user, galon(), '13');
    salidaPendiente();
    await contar(user, galon(), '14');
    const bloque = plegable(galon());
    await waitFor(() => expect(bloque).toHaveAttribute('data-closed'));
    expect(bloque.isConnected).toBe(true);
    await contar(user, galon(), '12');

    expect(plegable(galon())).toBe(bloque);
    expect(bloque).toHaveAttribute('data-open');
    expect(bloque).not.toHaveAttribute('inert');
  });

  it('R5: el texto de «Otro» se pliega igual al cambiar a otro motivo', async () => {
    const { user } = pintar();

    await contar(user, botella(), '14');
    await elegirMotivo(user, botella(), 'Otro');
    const otro = within(botella()).getByTestId(PACKING_FINISH_OTHER_FOLD_TESTID);
    expect(otro).toHaveAttribute('data-open');
    expect(within(botella()).getByRole('textbox', { name: /Describe el motivo/ })).toBeInTheDocument();

    salidaPendiente();
    await elegirMotivo(user, botella(), 'Rotura');
    await waitFor(() => expect(otro).toHaveAttribute('data-ending-style'));
    expect(otro.isConnected).toBe(true);
    expect(otro).toHaveAttribute('data-closed');
    expect(otro).toHaveAttribute('inert');
    expect(otro).toHaveAttribute('aria-hidden', 'true');
    expect(within(botella()).queryByRole('textbox', { name: /Describe el motivo/ })).toBeNull();

    await terminarSalida();
    await waitFor(() => expect(within(botella()).queryByTestId(PACKING_FINISH_OTHER_FOLD_TESTID)).toBeNull());
  });

  it('R3: abierto y quieto deja de recortar, para que el anillo de foco no se corte', async () => {
    const { user } = pintar();

    await contar(user, galon(), '13');
    const bloque = plegable(galon());
    const interior = bloque.firstElementChild as HTMLElement;
    expect(interior).toHaveClass('overflow-hidden');

    fireEvent.transitionEnd(bloque);
    expect(interior).not.toHaveClass('overflow-hidden');
  });
});

describe('diálogo «¿Terminar el empaque?» — imagen del envase', () => {
  const GALON_URL = 'https://cdn.example/galon.png';
  const conImagen: Finish = {
    ...FINISH,
    lines: [
      { ...FINISH.lines[0]!, packaging: { ...FINISH.lines[0]!.packaging!, imageUrl: GALON_URL } },
      { ...FINISH.lines[1]!, packaging: { ...FINISH.lines[1]!.packaging!, imageUrl: null } },
      { lineId: 'linea-antigua', label: 'Garrafa 5 L', plan: 1, content: '5', unit: LITRO, packaging: null },
    ],
  };

  it('cada fila lleva la miniatura de su envase y ya no el icono genérico', () => {
    pintar({ finish: conImagen });

    const imagen = within(galon()).getByRole('img');
    expect(imagen).toHaveAttribute('src', GALON_URL);
    expect(imagen).toHaveAttribute('alt', 'Galón 3,78 L');
    expect(imagen).not.toHaveAttribute('data-missing');
    expect(galon().querySelector('[class*="lucide-package"]')).toBeNull();
    expect(galon().className).toContain('grid-cols-[80px_minmax(0,1fr)]');
  });

  it('sin imagen, o en una línea antigua sin envase, muestra el marcador', () => {
    pintar({ finish: conImagen });

    const sinImagen = within(botella()).getByRole('img');
    expect(sinImagen).toHaveAttribute('data-missing', 'true');
    expect(sinImagen).toHaveAttribute('src', MISSING_IMAGE_SRC);
    expect(sinImagen).toHaveAttribute('alt', 'Botella 1 L');

    const antigua = within(linea('linea-antigua')).getByRole('img');
    expect(antigua).toHaveAttribute('data-missing', 'true');
    expect(antigua).toHaveAttribute('alt', 'Garrafa 5 L');
    expect(within(linea('linea-antigua')).getByTestId(ENTITY_IMAGE_ZOOM_TRIGGER_TESTID)).toBeDisabled();
  });

  it('la miniatura se amplía dentro del diálogo y al cerrarla el diálogo sigue abierto', async () => {
    const { user, onOpenChange } = pintar({ finish: conImagen });

    await user.click(within(galon()).getByTestId(ENTITY_IMAGE_ZOOM_TRIGGER_TESTID));
    expect(await screen.findByTestId(ENTITY_IMAGE_ZOOM_TESTID)).toHaveAttribute('src', GALON_URL);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId(ENTITY_IMAGE_ZOOM_TESTID)).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: T.title })).toBeInTheDocument();
  });
});
