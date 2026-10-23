import { readFileSync } from 'node:fs';
import path from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONDITIONING_ACTIONS_TEXTS,
  CONDITIONING_BATCH_DATA_DIVERGENT_TESTID,
  CONDITIONING_BATCH_DATA_LOCKED_TESTID,
  CONDITIONING_STEPS_DONE_TESTID,
  CONDITIONING_STEPS_PANEL_TESTID,
  CONDITIONING_FINISH_BUTTON_TESTID,
  CONDITIONING_BATCH_DATA_SECTION_TESTID,
  CONDITIONING_ORDER_BACK_LINK_TESTID,
  CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID,
  CONDITIONING_ORDER_CANDIDATES_ERROR_TESTID,
  CONDITIONING_ORDER_CONDITIONER_TESTID,
  CONDITIONING_ORDER_DISTRIBUTION_TESTID,
  CONDITIONING_ORDER_NUMBER_TESTID,
  CONDITIONING_ORDER_QUANTITY_TESTID,
  CONDITIONING_ORDER_RECIPE_TESTID,
  CONDITIONING_ORDER_SCREEN_TESTID,
  CONDITIONING_ORDER_STATUS_TESTID,
  CONDITIONING_START_BUTTON_TESTID,
  CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID,
  CONDITIONING_TEAM_LIST_GROUP_TESTID,
  CONDITIONING_TEAM_LIST_TESTID,
  ConditioningOrderScreen,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components';
import {
  ORDER_DISTRIBUTION_FULL_LINE_TESTID,
  ORDER_DISTRIBUTION_FULL_SEPARATOR,
  buildConditioningOrdersColumns,
} from '@/app/(private)/asignacion/components';
import { MISSING_IMAGE_SRC } from '@/components/shared/entity-image';
import { RESPONSIBLE_AVATAR_TESTID, RESPONSIBLE_OVERFLOW_TESTID } from '@/components/shared/responsible-avatars';
import type {
  ConditioningBatchLineView,
  ConditioningOrderDetail,
  ConditioningStepsView,
  ConditioningTeamCandidates,
} from '@/lib/modules/asignaciones';
import { STEP_READER_SIDE_COLUMN_RESERVE } from '@/app/(private)/asignacion/components/operator-screen-frame';
import { ORDER_STATUS_LABELS } from '@/lib/shared/ui/order-status';

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions', () => ({
  startConditioningAction: vi.fn(),
  finishConditioningAction: vi.fn(),
  saveConditioningBatchDataAction: vi.fn(),
  recordConditioningStepAction: vi.fn(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/step-evidence-actions', () => ({
  registerEvidenceAction: vi.fn(),
  removeEvidenceAction: vi.fn(),
  requestEvidenceUploadAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const SCREEN_DIR = path.join(process.cwd(), 'app', '(private)', 'asignacion', 'acondicionamiento', '[id]');

const ROW: ConditioningOrderDetail = {
  id: 'order-a',
  numberText: '2026-0000040',
  recipeName: 'Jarabe simple',
  quantity: '20.5000',
  unitId: 'unit-kg',
  unitLabel: 'kg',
  presentationLines: [
    { lineId: 'linea-1', packedPackages: null, presentationId: 'pres-1', presentationName: 'Frasco', packagingName: '500 g', packages: 12, presentationContent: null, presentationUnitLabel: null },
    { lineId: 'linea-2', packedPackages: null, presentationId: 'pres-2', presentationName: 'Bolsa', packagingName: '1 kg', packages: 4, presentationContent: null, presentationUnitLabel: null },
  ],
  status: 'EN_ACONDICIONAMIENTO',
  conditionedByName: 'Berta Ruiz',
  conditionedById: 'user-2',
  team: [],
  batchData: null,
  conditioningSteps: null,
};

const CANDIDATES: ConditioningTeamCandidates = {
  people: [{ id: 'user-3', displayName: 'Carla Gómez' }],
  workGroups: [],
};

/** El reparto del subtitulo, una linea por envase, sin el texto alternativo de su miniatura. */
function lineasDelReparto(): string[] {
  return within(screen.getByTestId(CONDITIONING_ORDER_DISTRIBUTION_TESTID))
    .getAllByTestId(ORDER_DISTRIBUTION_FULL_LINE_TESTID)
    .map((linea) => linea.textContent ?? '');
}

describe('el detalle muestra los datos del pedido', () => {
  it('el reparto va en su propio bloque, bajo la cantidad, con la miniatura de cada envase', () => {
    const URL_FRASCO = 'https://cdn.example/frasco.png';
    render(
      <ConditioningOrderScreen
        order={{
          ...ROW,
          presentationLines: [
            { ...ROW.presentationLines[0]!, packagingImageUrl: URL_FRASCO },
            { ...ROW.presentationLines[1]!, packagingImageUrl: null },
          ],
        }}
      />,
    );

    expect(screen.getByTestId(CONDITIONING_ORDER_QUANTITY_TESTID)).not.toHaveTextContent('·');
    const imagenes = within(screen.getByTestId(CONDITIONING_ORDER_DISTRIBUTION_TESTID)).getAllByRole('img');
    expect(imagenes).toHaveLength(2);
    const [conImagen, sinImagen] = imagenes;
    expect(conImagen).toHaveAttribute('src', URL_FRASCO);
    expect(conImagen).toHaveAttribute('alt', '500 g');
    expect(conImagen).not.toHaveAttribute('data-missing');
    expect(sinImagen).toHaveAttribute('src', MISSING_IMAGE_SRC);
    expect(sinImagen).toHaveAttribute('alt', '1 kg');
    expect(sinImagen).toHaveAttribute('data-missing', 'true');
  });

  it('R15 R32: número, receta (único h1), cantidad con unidad, reparto entero, estado y quién acondiciona', () => {
    render(<ConditioningOrderScreen order={ROW} />);

    const numero = screen.getByTestId(CONDITIONING_ORDER_NUMBER_TESTID);
    expect(numero).toHaveTextContent('2026-0000040');
    const receta = screen.getByTestId(CONDITIONING_ORDER_RECIPE_TESTID);
    expect(receta.tagName).toBe('H1');
    expect(screen.getAllByRole('heading', { level: 1 })).toEqual([receta]);
    expect(receta).toHaveTextContent('Jarabe simple');
    const cabecera = numero.closest('[data-slot="operator-header"]');
    expect(cabecera).not.toBeNull();
    for (const testId of [
      CONDITIONING_ORDER_DISTRIBUTION_TESTID,
      CONDITIONING_ORDER_STATUS_TESTID,
      CONDITIONING_ORDER_CONDITIONER_TESTID,
    ]) {
      expect(cabecera?.contains(screen.getByTestId(testId))).toBe(true);
    }
    expect(screen.getByTestId(CONDITIONING_ORDER_QUANTITY_TESTID)).toHaveTextContent('20.5 kg');
    expect(lineasDelReparto()).toEqual(['12 × 500 g', '4 × 1 kg']);
    const estado = screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID);
    expect(estado).toHaveTextContent('En acondicionamiento');
    expect(estado).toHaveAttribute('data-status', 'EN_ACONDICIONAMIENTO');
    expect(screen.getByTestId(CONDITIONING_ORDER_CONDITIONER_TESTID)).toHaveTextContent(
      'Lo acondiciona Berta Ruiz.',
    );
  });

  it('R15: los valores son los mismos que pinta su fila en «Por acondicionar»', () => {
    const celdas = buildConditioningOrdersColumns().map((column) => {
      const { container } = render(<>{column.cell(ROW)}</>);
      const text = container.textContent;
      cleanup();
      return text;
    });
    const [numero, receta, envases, estado, quien] = celdas;

    render(<ConditioningOrderScreen order={ROW} />);

    expect(screen.getByTestId(CONDITIONING_ORDER_NUMBER_TESTID).textContent).toBe(numero);
    expect(screen.getByTestId(CONDITIONING_ORDER_RECIPE_TESTID).textContent).toBe(receta);
    expect(lineasDelReparto().join(ORDER_DISTRIBUTION_FULL_SEPARATOR)).toBe(envases);
    expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID).textContent).toBe(estado);
    expect(screen.getByTestId(CONDITIONING_ORDER_CONDITIONER_TESTID)).toHaveTextContent(quien ?? '');
  });

  it('R15: sin receta dice «Esta fórmula está dada de baja.» y sin reparto «Sin presentación»', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, recipeName: null, presentationLines: [] }} />);

    expect(screen.getByTestId(CONDITIONING_ORDER_RECIPE_TESTID)).toHaveTextContent(
      'Esta fórmula está dada de baja.',
    );
    expect(screen.getByTestId(CONDITIONING_ORDER_DISTRIBUTION_TESTID)).toHaveTextContent('Sin presentación');
  });

  it('R16: en POR_ACONDICIONAR no hay nadie que acondicione y no se pinta la frase', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...ROW, status: 'POR_ACONDICIONAR', conditionedByName: null, conditionedById: null }}
      />,
    );

    expect(screen.queryByTestId(CONDITIONING_ORDER_CONDITIONER_TESTID)).toBeNull();
    expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveTextContent('Por acondicionar');
  });
});

describe('las acciones del pie', () => {
  function inicio(): HTMLElement {
    return screen.getByTestId(CONDITIONING_START_BUTTON_TESTID);
  }
  function terminar(): HTMLElement {
    return screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID);
  }
  function pie(): HTMLElement {
    const footer = screen
      .getByTestId(CONDITIONING_ORDER_SCREEN_TESTID)
      .querySelector('[data-slot="operator-footer"]');
    if (!(footer instanceof HTMLElement)) throw new Error('falta el pie');
    return footer;
  }

  it('R34 R2 R3: el pie fijo pinta siempre «Acondicionar» y «Terminar», de 52 px', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, status: 'TERMINADO' }} />);

    expect(screen.getByTestId(CONDITIONING_ORDER_SCREEN_TESTID)).toHaveAttribute('data-operator-screen');
    expect(within(pie()).getAllByRole('button').map((boton) => boton.textContent)).toEqual([
      CONDITIONING_ACTIONS_TEXTS.start,
      CONDITIONING_ACTIONS_TEXTS.finish,
    ]);
    expect(inicio().className).toContain('h-13');
    expect(terminar().className).toContain('h-13');
  });

  it('R1 R34: en POR_ACONDICIONAR con candidatos solo «Acondicionar» está habilitado', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...ROW, status: 'POR_ACONDICIONAR', conditionedByName: null, conditionedById: null }}
        canStart
        candidates={CANDIDATES}
      />,
    );

    expect(inicio()).toBeEnabled();
    expect(terminar()).toBeDisabled();
  });

  it('R2 R34: en EN_ACONDICIONAMIENTO de quien lo acondiciona solo «Terminar» está habilitado', () => {
    render(<ConditioningOrderScreen order={ROW} canFinish />);

    expect(terminar()).toBeEnabled();
    expect(inicio()).toBeDisabled();
  });

  it('R3 R34: en EN_ACONDICIONAMIENTO con otra persona los dos están deshabilitados y dice quién lo acondiciona', () => {
    const { container } = render(<ConditioningOrderScreen order={ROW} />);

    expect(inicio()).toBeDisabled();
    expect(terminar()).toBeDisabled();
    expect(container.querySelectorAll('form')).toHaveLength(0);
    expect(screen.getByTestId(CONDITIONING_ORDER_CONDITIONER_TESTID)).toHaveTextContent(
      'Lo acondiciona Berta Ruiz.',
    );
  });

  it('R3 R34: en TERMINADO los dos están deshabilitados', () => {
    const { container } = render(<ConditioningOrderScreen order={{ ...ROW, status: 'TERMINADO' }} />);

    expect(inicio()).toBeDisabled();
    expect(terminar()).toBeDisabled();
    expect(container.querySelectorAll('form')).toHaveLength(0);
  });

  it('R1: sin candidatos «Acondicionar» queda deshabilitado y pinta el error del catálogo en role="alert"', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...ROW, status: 'POR_ACONDICIONAR', conditionedByName: null, conditionedById: null }}
        canStart
        candidates={null}
        candidatesError={{ status: 'error', code: 'unauthorized', message: 'No tienes permiso.' }}
      />,
    );

    expect(inicio()).toBeDisabled();
    expect(terminar()).toBeDisabled();
    const alerta = screen.getByTestId(CONDITIONING_ORDER_CANDIDATES_ERROR_TESTID);
    expect(alerta).toHaveAttribute('role', 'alert');
    expect(alerta).toHaveTextContent('No tienes permiso.');
  });
});

describe('el equipo guardado', () => {
  const TEAM: ConditioningOrderDetail['team'] = [
    { userId: 'user-3', displayName: 'Carla Gómez', origin: { kind: 'direct' } },
    {
      userId: 'user-4',
      displayName: 'Dario Pérez',
      origin: { kind: 'workGroup', workGroupId: 'group-1', workGroupName: 'Turno mañana' },
    },
    { userId: 'user-5', displayName: 'Elena Sanz', origin: { kind: 'direct' } },
    {
      userId: 'user-6',
      displayName: 'Fermín Ruiz',
      origin: { kind: 'workGroup', workGroupId: 'group-1', workGroupName: 'Turno mañana' },
    },
  ];

  function nombres(grupo: HTMLElement): (string | null)[] {
    return within(grupo)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
  }

  it.each(['EN_ACONDICIONAMIENTO', 'TERMINADO'] as const)(
    'R25: en %s pinta «Equipo» con las sueltas juntas y cada grupo con su nombre al comenzar',
    (status) => {
      render(<ConditioningOrderScreen order={{ ...ROW, status, team: TEAM }} />);

      const equipo = screen.getByTestId(CONDITIONING_TEAM_LIST_TESTID);
      expect(within(equipo).getByRole('heading', { name: 'Equipo' })).toBeInTheDocument();
      const [sueltas, grupo, ...resto] = within(equipo).getAllByTestId(CONDITIONING_TEAM_LIST_GROUP_TESTID);
      if (sueltas === undefined || grupo === undefined) throw new Error('faltan grupos');
      expect(resto).toHaveLength(0);
      expect(sueltas).toHaveAttribute('data-kind', 'direct');
      expect(nombres(sueltas)).toEqual(['Carla Gómez', 'Elena Sanz']);
      expect(within(grupo).getByTestId(CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID)).toHaveTextContent(
        'Turno mañana',
      );
      expect(nombres(grupo)).toEqual(['Dario Pérez', 'Fermín Ruiz']);
      // El único botón es el «+N» de los avatares: la lista no ofrece acciones.
      expect(within(equipo).getAllByRole('button')).toEqual([within(equipo).getByTestId(RESPONSIBLE_OVERFLOW_TESTID)]);
    },
  );

  it('R33: «Equipo» es una tarjeta con los avatares del equipo en su cabecera', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, team: TEAM.slice(0, 2) }} />);

    const equipo = screen.getByTestId(CONDITIONING_TEAM_LIST_TESTID);
    expect(equipo.closest('[data-slot="card"]')).not.toBeNull();
    expect(
      within(equipo)
        .getAllByTestId(RESPONSIBLE_AVATAR_TESTID)
        .map((avatar) => avatar.getAttribute('aria-label')),
    ).toEqual(['Carla Gómez', 'Dario Pérez']);
  });

  it('R25: pinta el nombre que trae el equipo, también el de una persona dada de baja', () => {
    render(
      <ConditioningOrderScreen
        order={{
          ...ROW,
          team: [{ userId: 'user-9', displayName: 'Persona de baja', origin: { kind: 'direct' } }],
        }}
      />,
    );

    expect(screen.getByTestId(CONDITIONING_TEAM_LIST_TESTID)).toHaveTextContent('Persona de baja');
  });

  it('R25: sin equipo no pinta la sección', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...ROW, status: 'POR_ACONDICIONAR', conditionedByName: null, conditionedById: null }}
      />,
    );

    expect(screen.queryByTestId(CONDITIONING_TEAM_LIST_TESTID)).toBeNull();
  });
});

describe('enlace de vuelta según el estado', () => {
  it.each(['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO'] as const)(
    'R16: en %s la vuelta es «Volver a «Por acondicionar»», con 44 px',
    (status) => {
      render(<ConditioningOrderScreen order={{ ...ROW, status }} />);

      const back = screen.getByTestId(CONDITIONING_ORDER_BACK_LINK_TESTID);
      expect(back).toHaveTextContent('Volver a «Por acondicionar»');
      expect(back).toHaveAttribute('href', '/asignacion?vista=por_acondicionar');
      expect(back.className).toContain('min-h-11');
      expect(back.className).toContain('min-w-11');
    },
  );

  it('comenzado por quien lo mira («Terminar» suyo), la vuelta se ve deshabilitada y sin href', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, status: 'EN_ACONDICIONAMIENTO' }} canFinish />);

    const back = screen.getByTestId(CONDITIONING_ORDER_BACK_LINK_TESTID);
    expect(back.tagName).not.toBe('A');
    expect(back).not.toHaveAttribute('href');
    expect(back).toHaveAttribute('aria-disabled', 'true');
    expect(back).toHaveTextContent('Volver a «Por acondicionar»');
  });

  it('antes de comenzar la vuelta es un enlace habilitado', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, status: 'POR_ACONDICIONAR' }} canStart />);

    const back = screen.getByTestId(CONDITIONING_ORDER_BACK_LINK_TESTID);
    expect(back.tagName).toBe('A');
    expect(back).not.toHaveAttribute('aria-disabled');
  });

  it('R8 R32: en TERMINADO la vuelta es «Volver a «Acondicionados»», un botón con flecha en la cabecera', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, status: 'TERMINADO' }} />);

    const back = screen.getByTestId(CONDITIONING_ORDER_BACK_LINK_TESTID);
    expect(back).toHaveTextContent('Volver a «Acondicionados»');
    expect(back.closest('[data-slot="operator-header"]')).not.toBeNull();
    expect(back.querySelector('svg')).not.toBeNull();
    expect(back).toHaveAttribute('href', '/asignacion?vista=acondicionados');
  });

  it('R1 R2: ni la página ni la pantalla son Server Actions ni llaman a una; las acciones viven en los modales', () => {
    const fuentes = [
      readFileSync(path.join(SCREEN_DIR, 'page.tsx'), 'utf8'),
      readFileSync(path.join(SCREEN_DIR, 'components', 'conditioning-order-screen.tsx'), 'utf8'),
    ];

    for (const fuente of fuentes) {
      expect(fuente).not.toContain("'use server'");
      expect(fuente).not.toMatch(/adapters\/driving\/(?!require-page-permission)/);
      expect(fuente).not.toMatch(/\w+Action\(/);
      expect(fuente).not.toContain('<form');
    }
  });
});

describe('«Datos de lote» en el detalle', () => {
  const LINE: ConditioningBatchLineView = {
    batchId: 'batch-1',
    presentationId: 'pres-1',
    presentationName: 'Frasco',
    packagingName: '500 g',
    packages: 12,
    provisionalLot: '0000042',
    lot: null,
    expiryDate: null,
    productionDate: null,
  };
  const SECOND: ConditioningBatchLineView = {
    ...LINE,
    batchId: 'batch-2',
    presentationId: 'pres-2',
    presentationName: 'Bolsa',
    packagingName: '1 kg',
    packages: 4,
  };
  const MINE = { ...ROW, conditionedById: 'user-1', conditionedByName: 'Ana Ruiz' };

  it.each(['EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'] as const)(
    'R13 R14 R33: en %s, con batchData, pinta la tarjeta con un solo juego de campos y un botón',
    (status) => {
      render(
        <ConditioningOrderScreen
          order={{ ...MINE, status, batchData: { lines: [LINE, SECOND], missingCount: 2, form: { kind: 'empty' } } }}
        />,
      );

      const seccion = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID);
      expect(seccion.closest('[data-slot="card"]')).not.toBeNull();
      expect(within(seccion).getByRole('heading', { name: 'Datos de lote' })).toBeInTheDocument();
      expect(within(seccion).getAllByLabelText('Lote')).toHaveLength(1);
      expect(within(seccion).getAllByLabelText('Vencimiento')).toHaveLength(1);
      expect(within(seccion).getAllByLabelText('Día de producción')).toHaveLength(1);
      expect(seccion.querySelectorAll('fieldset')).toHaveLength(0);
      expect(within(seccion).getAllByRole('button')).toHaveLength(1);
      expect(within(seccion).getByRole('button', { name: 'Guardar datos de lote' })).toBeInTheDocument();
      expect(within(seccion).queryByTestId(CONDITIONING_BATCH_DATA_DIVERGENT_TESTID)).toBeNull();
    },
  );

  it.each(['EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'] as const)(
    'R15: en %s, con lotes distintos, el aviso lista cada línea como en el reparto con su lote',
    (status) => {
      render(
        <ConditioningOrderScreen
          order={{
            ...MINE,
            status,
            batchData: {
              lines: [LINE, SECOND],
              missingCount: 1,
              form: {
                kind: 'divergent',
                lines: [
                  { presentationId: 'pres-1', lot: 'CR-1' },
                  { presentationId: 'pres-2', lot: null },
                ],
              },
            },
          }}
        />,
      );

      const aviso = screen.getByTestId(CONDITIONING_BATCH_DATA_DIVERGENT_TESTID);
      expect(within(aviso).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        '12 × 500 g: CR-1',
        '4 × 1 kg: sin lote',
      ]);
    },
  );

  it('R3: en POR_ACONDICIONAR (batchData null) no hay sección ni ningún campo', () => {
    const { container } = render(
      <ConditioningOrderScreen
        order={{ ...ROW, status: 'POR_ACONDICIONAR', conditionedByName: null, conditionedById: null, batchData: null }}
      />,
    );

    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID)).toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('R3: si lo acondiciona otra persona (batchData null) no hay sección ni aviso', () => {
    const { container } = render(<ConditioningOrderScreen order={{ ...ROW, batchData: null }} />);

    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID)).toBeNull();
    expect(screen.queryByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('R4 R34: con una línea sin datos dice «Faltan los datos de lote de 1 línea.» y «Terminar» va deshabilitado', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...MINE, batchData: { lines: [LINE], missingCount: 1, form: { kind: 'empty' } } }}
        canFinish
        finishBlocked
      />,
    );

    const aviso = screen.getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID);
    expect(aviso).toHaveTextContent('Faltan los datos de lote de 1 línea.');
    const terminar = screen.getByRole('button', { name: CONDITIONING_ACTIONS_TEXTS.finish });
    expect(terminar).toBeDisabled();
    expect(terminar).toHaveAttribute('aria-describedby', aviso.id);
  });

  it('R4: con k > 1 líneas sin datos dice «Faltan los datos de lote de k líneas.»', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...MINE, batchData: { lines: [LINE, SECOND], missingCount: 2, form: { kind: 'empty' } } }}
        canFinish
        finishBlocked
      />,
    );

    expect(screen.getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toHaveTextContent(
      'Faltan los datos de lote de 2 líneas.',
    );
    expect(screen.getByRole('button', { name: CONDITIONING_ACTIONS_TEXTS.finish })).toBeDisabled();
  });

  it('R4: con todas las líneas con datos no hay aviso y «Terminar» está habilitado', () => {
    const conDatos = { ...LINE, provisionalLot: null, lot: 'L-1', expiryDate: '2027-01-01', productionDate: '2026-10-01' };
    render(
      <ConditioningOrderScreen
        order={{
          ...MINE,
          batchData: {
            lines: [conDatos],
            missingCount: 0,
            form: { kind: 'shared', lot: 'L-1', expiryDate: '2027-01-01', productionDate: '2026-10-01' },
          },
        }}
        canFinish
      />,
    );

    expect(screen.queryByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toBeNull();
    const terminar = screen.getByRole('button', { name: CONDITIONING_ACTIONS_TEXTS.finish });
    expect(terminar).toBeEnabled();
    expect(terminar).not.toHaveAttribute('aria-describedby');
  });

  it('R21, QC-301 R4: en ENTREGADO no habilita «Acondicionar» ni «Terminar» y la vuelta es «Volver a «Acondicionados»»', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...MINE, status: 'ENTREGADO', batchData: { lines: [LINE], missingCount: 1, form: { kind: 'empty' } } }}
      />,
    );

    expect(screen.getByRole('button', { name: CONDITIONING_ACTIONS_TEXTS.start })).toBeDisabled();
    expect(screen.getByRole('button', { name: CONDITIONING_ACTIONS_TEXTS.finish })).toBeDisabled();
    expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveTextContent('Entregado');
    const back = screen.getByTestId(CONDITIONING_ORDER_BACK_LINK_TESTID);
    expect(back).toHaveTextContent('Volver a «Acondicionados»');
    expect(back).toHaveAttribute('href', '/asignacion?vista=acondicionados');
    expect(back.className).toContain('min-h-11');
  });
});

describe('QC-252: la etiqueta de estado sale del mapa compartido', () => {
  it.each([
    ['POR_ACONDICIONAR', 'Por acondicionar'],
    ['EN_ACONDICIONAMIENTO', 'En acondicionamiento'],
    ['TERMINADO', 'Terminado'],
    ['ENTREGADO', 'Entregado'],
  ] as const)('R11 R32: %s se lee «%s», el texto de antes, en un StatusBadge', (status, texto) => {
    render(<ConditioningOrderScreen order={{ ...ROW, status }} />);

    const estado = screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID);
    expect(estado.textContent).toBe(texto);
    expect(estado).toHaveAttribute('data-tone');
    expect(estado.querySelector('[data-slot="status-dot"]')).not.toBeNull();
    expect(estado).toHaveAttribute('data-status', status);
  });

  it('R12: un estado imposible aquí (PENDIENTE) se pinta con su etiqueta del mapa, no con el código', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, status: 'PENDIENTE' }} />);

    const estado = screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID);
    expect(estado.textContent).toBe(ORDER_STATUS_LABELS.PENDIENTE);
    expect(estado.textContent).toBe('Pendiente');
  });
});

describe('QC-299: pasos de acondicionamiento en la pantalla', () => {
  const MINE: ConditioningOrderDetail = {
    ...ROW,
    conditionedById: 'user-1',
    conditionedByName: 'Ana Ruiz',
    team: [{ userId: 'user-3', displayName: 'Carla Gómez', origin: { kind: 'direct' } }],
    batchData: { lines: [], missingCount: 0, form: { kind: 'empty' } },
  };

  const STEPS: ConditioningStepsView = {
    steps: [
      { blocks: [{ kind: 'paragraph', spans: [{ text: 'Sellar las garrafas' }] }] },
      { blocks: [{ kind: 'paragraph', spans: [{ text: 'Contar las cajas' }] }] },
    ],
    completedCount: 0,
    responsibles: [],
    candidates: [
      { userId: 'user-1', displayName: 'Ana Ruiz', isSelf: true },
      { userId: 'user-3', displayName: 'Carla Gómez', isSelf: false },
    ],
    evidence: [],
  };

  it('QC-299 R19: sin pasos la pantalla es la de hoy: sin paso a paso, con «Terminar» en el pie y «Datos de lote» abierta', () => {
    render(<ConditioningOrderScreen order={MINE} canFinish />);

    expect(screen.queryByTestId(CONDITIONING_STEPS_PANEL_TESTID)).toBeNull();
    expect(screen.queryByTestId('step-reader')).toBeNull();
    expect(screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeEnabled();
    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_LOCKED_TESTID)).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar datos de lote' })).toBeEnabled();
    const grid = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID).closest('.grid');
    expect(grid?.className).toContain('@min-[1101px]:grid-cols-2');
  });

  it('QC-299 R19: el mismo marcado con `conditioningSteps: null` en cualquier estado', () => {
    for (const status of ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'] as const) {
      const { container } = render(<ConditioningOrderScreen order={{ ...MINE, status }} canFinish />);
      expect(container.querySelector('[data-testid="conditioning-order-steps"]')).toBeNull();
      expect(container.querySelector('[data-slot="operator-footer"]')).not.toBeNull();
      cleanup();
    }
  });

  it('QC-299 R18: con pasos, el paso a paso va a la izquierda y «Equipo» y «Datos de lote» a la derecha', () => {
    render(<ConditioningOrderScreen order={{ ...MINE, conditioningSteps: STEPS }} canFinish />);

    const panel = screen.getByTestId(CONDITIONING_STEPS_PANEL_TESTID);
    const grid = panel.parentElement as HTMLElement;
    expect(grid.className).toContain('@min-[1101px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]');
    expect(grid.firstElementChild).toBe(panel);
    const lateral = grid.lastElementChild as HTMLElement;
    expect(within(lateral).getByRole('heading', { name: 'Equipo' })).toBeInTheDocument();
    expect(within(lateral).getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID)).toBeInTheDocument();
    expect(lateral.className.split(/\s+/)).toContain(STEP_READER_SIDE_COLUMN_RESERVE);
  });

  it('QC-299 R25: con pasos pendientes «Datos de lote» va bloqueada y «Terminar» no se ofrece', () => {
    render(<ConditioningOrderScreen order={{ ...MINE, conditioningSteps: { ...STEPS, completedCount: 1 } }} canFinish />);

    expect(screen.getByTestId(CONDITIONING_BATCH_DATA_LOCKED_TESTID)).toHaveTextContent('Al completar los pasos');
    expect(screen.getByLabelText('Lote')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar datos de lote' })).toBeDisabled();
    expect(screen.queryByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeNull();
    expect(screen.queryByTestId(CONDITIONING_START_BUTTON_TESTID)).toBeNull();
    expect(document.querySelector('[data-slot="operator-footer"]')).toBeNull();
  });

  it('QC-299 R25: con todos los pasos completos «Datos de lote» se abre y «Terminar» vuelve al pie', () => {
    render(<ConditioningOrderScreen order={{ ...MINE, conditioningSteps: { ...STEPS, completedCount: 2 } }} canFinish />);

    expect(screen.getByTestId(CONDITIONING_STEPS_DONE_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_LOCKED_TESTID)).toBeNull();
    expect(screen.getByLabelText('Lote')).toBeEnabled();
    expect(screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeEnabled();
  });

  it('QC-299 R25: «Terminar» sigue deshabilitado por los datos de lote que faltan, como hoy', () => {
    render(
      <ConditioningOrderScreen
        order={{
          ...MINE,
          batchData: { lines: [], missingCount: 1, form: { kind: 'empty' } },
          conditioningSteps: { ...STEPS, completedCount: 2 },
        }}
        canFinish
        finishBlocked
      />,
    );

    expect(screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeDisabled();
    expect(screen.getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toHaveTextContent(
      'Faltan los datos de lote de 1 línea.',
    );
  });
});
