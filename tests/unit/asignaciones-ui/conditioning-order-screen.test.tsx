import { readFileSync } from 'node:fs';
import path from 'node:path';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONDITIONING_ACTIONS_REASON_TESTID,
  CONDITIONING_ACTIONS_TEXTS,
  CONDITIONING_BATCH_DATA_DIVERGENT_TESTID,
  CONDITIONING_BATCH_DATA_SECTION_TESTID,
  CONDITIONING_FINISH_BUTTON_TESTID,
  CONDITIONING_ORDER_BACK_LINK_TESTID,
  CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID,
  CONDITIONING_ORDER_CANDIDATES_ERROR_TESTID,
  CONDITIONING_ORDER_CONDITIONER_TESTID,
  CONDITIONING_ORDER_DISTRIBUTION_TESTID,
  CONDITIONING_ORDER_MAIN_TESTID,
  CONDITIONING_ORDER_NOT_STARTED_TESTID,
  CONDITIONING_ORDER_NUMBER_TESTID,
  CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS,
  CONDITIONING_ORDER_QUANTITY_TESTID,
  CONDITIONING_ORDER_RECIPE_TESTID,
  CONDITIONING_ORDER_SCREEN_TESTID,
  CONDITIONING_ORDER_SECTIONS_TESTID,
  CONDITIONING_ORDER_STATUS_TESTID,
  CONDITIONING_ORDER_TEAM_SECTION_TESTIDS,
  CONDITIONING_START_BUTTON_TESTID,
  CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID,
  CONDITIONING_TEAM_LIST_GROUP_TESTID,
  CONDITIONING_TEAM_LIST_ME_TESTID,
  CONDITIONING_TEAM_LIST_MEMBER_TESTID,
  CONDITIONING_TEAM_LIST_ROW_TESTID,
  CONDITIONING_TEAM_LIST_TESTID,
  ConditioningOrderScreen,
  FINISH_CONDITIONING_DIALOG_TESTID,
  START_CONDITIONING_DIALOG_TESTID,
  type ConditioningOrderScreenProps,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components';
import {
  OPERATOR_SIDE_PANELS_FABS_TESTID,
  ORDER_DISTRIBUTION_FULL_LINE_TESTID,
  ORDER_DISTRIBUTION_FULL_SEPARATOR,
  buildConditioningOrdersColumns,
} from '@/app/(private)/asignacion/components';
import { MISSING_IMAGE_SRC } from '@/components/shared/entity-image';
import type {
  ConditioningBatchLineView,
  ConditioningOrderDetail,
  ConditioningTeamCandidates,
} from '@/lib/modules/asignaciones';
import { ORDER_STATUS_LABELS } from '@/lib/shared/ui/order-status';

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions', () => ({
  startConditioningAction: vi.fn(),
  finishConditioningAction: vi.fn(),
  saveConditioningBatchDataAction: vi.fn(),
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
};

const QUEUED: ConditioningOrderDetail = {
  ...ROW,
  status: 'POR_ACONDICIONAR',
  conditionedByName: null,
  conditionedById: null,
};

const CANDIDATES: ConditioningTeamCandidates = {
  people: [{ id: 'user-3', displayName: 'Carla Gómez' }],
  workGroups: [],
};

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

function zona(slot: 'operator-header' | 'operator-footer'): HTMLElement {
  const nodo = screen.getByTestId(CONDITIONING_ORDER_SCREEN_TESTID).querySelector(`[data-slot="${slot}"]`);
  if (!(nodo instanceof HTMLElement)) throw new Error(`falta ${slot}`);
  return nodo;
}
const cabecera = () => zona('operator-header');
const pie = () => zona('operator-footer');
const principal = () => screen.getByTestId(CONDITIONING_ORDER_MAIN_TESTID);
const envases = () => screen.getByTestId(CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS.card);

/** El reparto de la sección Envases, una linea por envase, sin el texto alternativo de su miniatura. */
function lineasDelReparto(): string[] {
  return within(within(envases()).getByTestId(CONDITIONING_ORDER_DISTRIBUTION_TESTID))
    .getAllByTestId(ORDER_DISTRIBUTION_FULL_LINE_TESTID)
    .map((linea) => linea.textContent ?? '');
}

describe('QC-291: cabecera', () => {
  it('R2: fase y número, receta como único h1, chip «Cantidad» y estado; sin reparto ni «Lo acondiciona» en la cabecera', () => {
    render(<ConditioningOrderScreen order={ROW} />);

    const numero = screen.getByTestId(CONDITIONING_ORDER_NUMBER_TESTID);
    expect(numero).toHaveTextContent('2026-0000040');
    expect(numero.closest('[data-slot="operator-phase"]')).toHaveTextContent('Acondicionamiento · 2026-0000040');
    const receta = screen.getByTestId(CONDITIONING_ORDER_RECIPE_TESTID);
    expect(receta.tagName).toBe('H1');
    expect(screen.getAllByRole('heading', { level: 1 })).toEqual([receta]);
    expect(receta).toHaveTextContent('Jarabe simple');

    const chip = screen.getByTestId(CONDITIONING_ORDER_QUANTITY_TESTID);
    expect(chip.textContent).toBe('Cantidad 20.5 kg');
    expect(cabecera().contains(chip)).toBe(true);
    const estado = screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID);
    expect(cabecera().contains(estado)).toBe(true);
    expect(estado).toHaveTextContent('En acondicionamiento');

    expect(within(cabecera()).queryByTestId(CONDITIONING_ORDER_DISTRIBUTION_TESTID)).toBeNull();
    expect(within(cabecera()).queryByTestId(CONDITIONING_ORDER_CONDITIONER_TESTID)).toBeNull();
    expect(cabecera()).not.toHaveTextContent('Lo acondiciona');
  });

  it('R2: sin unidad el chip dice solo «Cantidad <cifra>»', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, unitId: null, unitLabel: null }} />);

    expect(screen.getByTestId(CONDITIONING_ORDER_QUANTITY_TESTID).textContent).toBe('Cantidad 20.5');
  });

  it.each([
    ['POR_ACONDICIONAR', 'Volver a «Por acondicionar»', '/asignacion?vista=por_acondicionar'],
    ['TERMINADO', 'Volver a «Acondicionados»', '/asignacion?vista=acondicionados'],
    ['ENTREGADO', 'Volver a «Entregados»', '/asignacion?vista=acondicionados_entregados'],
  ] as const)('R3: en %s la cabecera lleva el enlace de vuelta habilitado «%s»', (status, etiqueta, href) => {
    render(<ConditioningOrderScreen order={{ ...QUEUED, status }} canStart={status === 'POR_ACONDICIONAR'} candidates={CANDIDATES} />);

    const back = screen.getByTestId(CONDITIONING_ORDER_BACK_LINK_TESTID);
    expect(back.tagName).toBe('A');
    expect(back).toHaveTextContent(etiqueta);
    expect(back).toHaveAttribute('href', href);
    expect(back).not.toHaveAttribute('aria-disabled');
    expect(back.className).toContain('min-h-11');
    expect(cabecera().contains(back)).toBe(true);
    expect(cabecera().querySelector('[data-slot="operator-running"]')).toBeNull();
  });

  it('R4: comenzado por el actor, no hay vuelta (ni deshabilitada) y la línea de estado dice exactamente «Acondicionando»', () => {
    render(<ConditioningOrderScreen order={ROW} canFinish />);

    expect(screen.queryByTestId(CONDITIONING_ORDER_BACK_LINK_TESTID)).toBeNull();
    const linea = within(cabecera()).getByRole('status');
    expect(linea.textContent).toBe('Acondicionando');
  });

  it('R5: en curso a nombre de otra persona, la vuelta está habilitada y no hay línea «Acondicionando»', () => {
    render(<ConditioningOrderScreen order={ROW} />);

    const back = screen.getByTestId(CONDITIONING_ORDER_BACK_LINK_TESTID);
    expect(back.tagName).toBe('A');
    expect(back).toHaveAttribute('href', '/asignacion?vista=por_acondicionar');
    expect(within(cabecera()).queryByText('Acondicionando')).toBeNull();
  });
});

describe('QC-291: pie', () => {
  it('R8: sin comenzar y con candidatos, un único botón «Comenzar el acondicionamiento», centrado, que abre el diálogo de hoy', () => {
    render(<ConditioningOrderScreen order={QUEUED} canStart candidates={CANDIDATES} />);

    const botones = within(pie()).getAllByRole('button');
    expect(botones).toHaveLength(1);
    const [comenzar] = botones;
    expect(comenzar).toHaveTextContent('Comenzar el acondicionamiento');
    expect(comenzar).toHaveAttribute('data-testid', CONDITIONING_START_BUTTON_TESTID);
    expect(comenzar).toBeEnabled();
    expect(comenzar?.parentElement?.className).toContain('mx-auto');
    expect(screen.queryByTestId(CONDITIONING_ACTIONS_REASON_TESTID)).toBeNull();

    fireEvent.click(comenzar!);
    expect(screen.getByTestId(START_CONDITIONING_DIALOG_TESTID)).toBeInTheDocument();
  });

  it('R10: comenzado por el actor, un único botón «Terminar el acondicionamiento», que abre el diálogo de hoy', () => {
    render(<ConditioningOrderScreen order={ROW} canFinish />);

    const botones = within(pie()).getAllByRole('button');
    expect(botones).toHaveLength(1);
    const [terminar] = botones;
    expect(terminar).toHaveTextContent('Terminar el acondicionamiento');
    expect(terminar).toHaveAttribute('data-testid', CONDITIONING_FINISH_BUTTON_TESTID);
    expect(terminar).toBeEnabled();
    expect(terminar?.parentElement?.className).toContain('mx-auto');

    fireEvent.click(terminar!);
    expect(screen.getByTestId(FINISH_CONDITIONING_DIALOG_TESTID)).toBeInTheDocument();
  });

  it('R10: con datos de lote pendientes, «Terminar» va deshabilitado con el motivo visible y asociado por aria-describedby', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...ROW, conditionedById: 'user-1', batchData: { lines: [], missingCount: 1, form: { kind: 'empty' } } }}
        canFinish
        finishBlocked
      />,
    );

    const terminar = within(pie()).getByRole('button', { name: CONDITIONING_ACTIONS_TEXTS.finish });
    expect(terminar).toBeDisabled();
    const motivo = within(pie()).getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID);
    expect(motivo).toBeVisible();
    expect(terminar).toHaveAttribute('aria-describedby', motivo.id);
  });

  it('R11: el botón del pie usa el tamaño xl de hoy (52 px)', () => {
    render(<ConditioningOrderScreen order={ROW} canFinish />);

    expect(screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID).className).toContain('h-13');
  });

  const SIN_ACCION: ReadonlyArray<readonly [string, ConditioningOrderScreenProps, string]> = [
    [
      'en curso a nombre de otra persona',
      { order: ROW },
      'Lo acondiciona Berta Ruiz.',
    ],
    ['en TERMINADO', { order: { ...ROW, status: 'TERMINADO' as const } }, 'Este pedido ya está acondicionado.'],
    ['en ENTREGADO', { order: { ...ROW, status: 'ENTREGADO' as const } }, 'Este pedido ya está entregado.'],
    [
      'en POR_ACONDICIONAR sin candidatos',
      {
        order: QUEUED,
        canStart: true,
        candidates: null,
        candidatesError: { status: 'error', code: 'unauthorized', message: 'No tienes permiso.' },
      },
      'No se pudo cargar el equipo para comenzar.',
    ],
  ];

  it.each(SIN_ACCION)('R33: %s el pie no lleva ningún botón y solo la línea del motivo', (_caso, props, motivo) => {
    const { container } = render(<ConditioningOrderScreen {...props} />);

    expect(within(pie()).queryAllByRole('button')).toHaveLength(0);
    const linea = within(pie()).getByTestId(CONDITIONING_ACTIONS_REASON_TESTID);
    expect(linea).toHaveAttribute('role', 'status');
    expect(linea.textContent).toBe(motivo);
    expect(pie().textContent).toBe(motivo);
    expect(screen.queryByTestId(CONDITIONING_START_BUTTON_TESTID)).toBeNull();
    expect(screen.queryByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeNull();
    expect(container.querySelectorAll('form')).toHaveLength(0);
  });

  it('R33: sin candidatos el error del catálogo se sigue pintando en role="alert"', () => {
    render(
      <ConditioningOrderScreen
        order={QUEUED}
        canStart
        candidates={null}
        candidatesError={{ status: 'error', code: 'unauthorized', message: 'No tienes permiso.' }}
      />,
    );

    const alerta = screen.getByTestId(CONDITIONING_ORDER_CANDIDATES_ERROR_TESTID);
    expect(alerta).toHaveAttribute('role', 'alert');
    expect(alerta).toHaveTextContent('No tienes permiso.');
    expect(principal().contains(alerta)).toBe(true);
  });
});

describe('QC-291: contenido principal', () => {
  it('R17: sin comenzar, el contenido muestra «Revisa antes de comenzar» con lo que pasa al comenzar y sin lista de pasos', () => {
    render(<ConditioningOrderScreen order={QUEUED} canStart candidates={CANDIDATES} />);

    const tarjeta = within(principal()).getByTestId(CONDITIONING_ORDER_NOT_STARTED_TESTID);
    expect(within(tarjeta).getByRole('heading', { level: 3, name: 'Revisa antes de comenzar' })).toBeInTheDocument();
    expect(tarjeta).toHaveTextContent(
      'Al comenzar, el equipo queda registrado y el pedido pasa a «En acondicionamiento».',
    );
    expect(within(tarjeta).queryAllByRole('listitem')).toHaveLength(0);
    expect(tarjeta.className).toContain('border-dashed');
  });

  it('R17: comenzado por el actor no hay tarjeta «Revisa antes de comenzar»', () => {
    render(<ConditioningOrderScreen order={ROW} canFinish />);

    expect(screen.queryByTestId(CONDITIONING_ORDER_NOT_STARTED_TESTID)).toBeNull();
  });

  it('R26: «Lo acondiciona <nombre>.» va en el contenido principal, fuera de la cabecera', () => {
    render(<ConditioningOrderScreen order={ROW} canFinish />);

    const frase = screen.getByTestId(CONDITIONING_ORDER_CONDITIONER_TESTID);
    expect(frase).toHaveTextContent('Lo acondiciona Berta Ruiz.');
    expect(principal().contains(frase)).toBe(true);
    expect(cabecera().contains(frase)).toBe(false);
  });

  it('R26: sin quien lo acondicione no se pinta la frase', () => {
    render(<ConditioningOrderScreen order={QUEUED} />);

    expect(screen.queryByTestId(CONDITIONING_ORDER_CONDITIONER_TESTID)).toBeNull();
  });

  it('R10: «Datos de lote» va en el contenido principal, no en la columna', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...ROW, batchData: { lines: [], missingCount: 0, form: { kind: 'empty' } } }}
        canFinish
      />,
    );

    const seccion = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID);
    expect(principal().contains(seccion)).toBe(true);
    expect(screen.getByTestId(CONDITIONING_ORDER_SECTIONS_TESTID).contains(seccion)).toBe(false);
  });
});

describe('QC-291: secciones', () => {
  it('R20: la columna pinta solo Envases y Equipo, en ese orden, con el color de su sección; sin Herramientas ni Materiales', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, team: TEAM }} />);

    const columna = screen.getByTestId(CONDITIONING_ORDER_SECTIONS_TESTID);
    expect(columna.tagName).toBe('ASIDE');
    expect(columna).toHaveAttribute('aria-label', 'Envases y equipo');
    const tarjetas = Array.from(columna.querySelectorAll('[data-slot="card"]'));
    expect(tarjetas.map((tarjeta) => tarjeta.getAttribute('data-testid'))).toEqual([
      CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS.card,
      CONDITIONING_ORDER_TEAM_SECTION_TESTIDS.card,
    ]);
    expect(screen.getByTestId(CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS.trigger)).toHaveAttribute('data-tone', 'materials');
    expect(screen.getByTestId(CONDITIONING_ORDER_TEAM_SECTION_TESTIDS.trigger)).toHaveAttribute('data-tone', 'team');
    expect(screen.getByTestId(CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS.trigger)).toHaveTextContent('Envases');
    expect(screen.getByTestId(CONDITIONING_ORDER_TEAM_SECTION_TESTIDS.trigger)).toHaveTextContent('Equipo');
    expect(columna).not.toHaveTextContent('Herramientas');
    expect(columna).not.toHaveTextContent('Materiales');

    const fabs = within(screen.getByTestId(OPERATOR_SIDE_PANELS_FABS_TESTID)).getAllByRole('button');
    expect(fabs.map((fab) => fab.getAttribute('aria-label'))).toEqual(['Ver envases', 'Ver equipo']);
  });

  it('R20: los contadores son las líneas del reparto y las personas del equipo', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, team: TEAM }} />);

    expect(screen.getByTestId(CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS.count)).toHaveTextContent('2');
    expect(screen.getByTestId(CONDITIONING_ORDER_TEAM_SECTION_TESTIDS.count)).toHaveTextContent('4');
  });

  it('R25: Envases muestra el reparto de hoy, una línea por envase con su miniatura', () => {
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

    expect(lineasDelReparto()).toEqual(['12 × 500 g', '4 × 1 kg']);
    const imagenes = within(envases()).getAllByRole('img');
    expect(imagenes).toHaveLength(2);
    const [conImagen, sinImagen] = imagenes;
    expect(conImagen).toHaveAttribute('src', URL_FRASCO);
    expect(conImagen).toHaveAttribute('alt', '500 g');
    expect(sinImagen).toHaveAttribute('src', MISSING_IMAGE_SRC);
    expect(sinImagen).toHaveAttribute('data-missing', 'true');
  });

  it('R25: sin reparto, Envases dice «Sin presentación»', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, presentationLines: [] }} />);

    expect(within(envases()).getByTestId(CONDITIONING_ORDER_DISTRIBUTION_TESTID)).toHaveTextContent('Sin presentación');
    expect(screen.getByTestId(CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS.count)).toHaveTextContent('0');
  });

  it('R25: el panel de envases lleva el mismo reparto', () => {
    render(<ConditioningOrderScreen order={ROW} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver envases' }));
    const panel = screen.getByRole('dialog');
    expect(
      within(panel)
        .getAllByTestId(ORDER_DISTRIBUTION_FULL_LINE_TESTID)
        .map((linea) => linea.textContent),
    ).toEqual(['12 × 500 g', '4 × 1 kg']);
  });

  it.each(['EN_ACONDICIONAMIENTO', 'TERMINADO'] as const)(
    'R23: en %s Equipo agrupa a las personas sueltas bajo «Personas» y a cada grupo con su nombre, sin acciones',
    (status) => {
      render(<ConditioningOrderScreen order={{ ...ROW, status, team: TEAM }} />);

      const equipo = within(screen.getByTestId(CONDITIONING_ORDER_TEAM_SECTION_TESTIDS.card)).getByTestId(
        CONDITIONING_TEAM_LIST_TESTID,
      );
      const [sueltas, grupo, ...resto] = within(equipo).getAllByTestId(CONDITIONING_TEAM_LIST_GROUP_TESTID);
      if (sueltas === undefined || grupo === undefined) throw new Error('faltan grupos');
      expect(resto).toHaveLength(0);
      expect(sueltas).toHaveAttribute('data-kind', 'direct');
      expect(within(sueltas).getByTestId(CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID)).toHaveTextContent('Personas');
      const nombres = (nodo: HTMLElement) =>
        within(nodo)
          .getAllByTestId(CONDITIONING_TEAM_LIST_MEMBER_TESTID)
          .map((miembro) => miembro.textContent);
      expect(nombres(sueltas)).toEqual(['Carla Gómez', 'Elena Sanz']);
      expect(within(grupo).getByTestId(CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID)).toHaveTextContent('Turno mañana');
      expect(nombres(grupo)).toEqual(['Dario Pérez', 'Fermín Ruiz']);
      expect(within(equipo).queryAllByRole('button')).toHaveLength(0);
    },
  );

  it('R23: pinta el nombre que trae el equipo, también el de una persona dada de baja', () => {
    render(
      <ConditioningOrderScreen
        order={{ ...ROW, team: [{ userId: 'user-9', displayName: 'Persona de baja', origin: { kind: 'direct' } }] }}
      />,
    );

    expect(screen.getByTestId(CONDITIONING_TEAM_LIST_TESTID)).toHaveTextContent('Persona de baja');
  });

  it('R23: sin equipo no hay tarjeta Equipo ni botón flotante «Ver equipo»; Envases sigue', () => {
    render(<ConditioningOrderScreen order={QUEUED} canStart candidates={CANDIDATES} />);

    expect(screen.queryByTestId(CONDITIONING_ORDER_TEAM_SECTION_TESTIDS.card)).toBeNull();
    expect(screen.queryByTestId(CONDITIONING_ORDER_TEAM_SECTION_TESTIDS.fab)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver equipo' })).toBeNull();
    expect(screen.queryByTestId(CONDITIONING_TEAM_LIST_TESTID)).toBeNull();
    expect(screen.getByTestId(CONDITIONING_ORDER_PACKAGES_SECTION_TESTIDS.card)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver envases' })).toBeInTheDocument();
  });

  it('R24: con actorId, «Tú» va solo en la fila del actor', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, team: TEAM }} actorId="user-5" />);

    const marcas = screen.getAllByTestId(CONDITIONING_TEAM_LIST_ME_TESTID);
    expect(marcas).toHaveLength(1);
    const fila = marcas[0]!.closest(`[data-testid="${CONDITIONING_TEAM_LIST_ROW_TESTID}"]`);
    expect(fila).not.toBeNull();
    expect(within(fila as HTMLElement).getByTestId(CONDITIONING_TEAM_LIST_MEMBER_TESTID)).toHaveTextContent('Elena Sanz');
    expect(marcas[0]).toHaveTextContent('Tú');
  });

  it('R24: sin actorId, o si el actor no está en el equipo, no hay ninguna marca «Tú»', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, team: TEAM }} actorId="user-99" />);
    expect(screen.queryByTestId(CONDITIONING_TEAM_LIST_ME_TESTID)).toBeNull();
    cleanup();

    render(<ConditioningOrderScreen order={{ ...ROW, team: TEAM }} />);
    expect(screen.queryByTestId(CONDITIONING_TEAM_LIST_ME_TESTID)).toBeNull();
  });
});

describe('el detalle muestra los datos del pedido', () => {
  it('R15: los valores son los mismos que pinta su fila en «Por acondicionar»', () => {
    const celdas = buildConditioningOrdersColumns().map((column) => {
      const { container } = render(<>{column.cell(ROW)}</>);
      const text = container.textContent;
      cleanup();
      return text;
    });
    const [numero, receta, envasesDeLaFila, estado, quien] = celdas;

    render(<ConditioningOrderScreen order={ROW} />);

    expect(screen.getByTestId(CONDITIONING_ORDER_NUMBER_TESTID).textContent).toBe(numero);
    expect(screen.getByTestId(CONDITIONING_ORDER_RECIPE_TESTID).textContent).toBe(receta);
    expect(lineasDelReparto().join(ORDER_DISTRIBUTION_FULL_SEPARATOR)).toBe(envasesDeLaFila);
    expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID).textContent).toBe(estado);
    expect(screen.getByTestId(CONDITIONING_ORDER_CONDITIONER_TESTID)).toHaveTextContent(quien ?? '');
  });

  it('R15: sin receta dice «Esta receta está dada de baja.»', () => {
    render(<ConditioningOrderScreen order={{ ...ROW, recipeName: null }} />);

    expect(screen.getByTestId(CONDITIONING_ORDER_RECIPE_TESTID)).toHaveTextContent('Esta receta está dada de baja.');
  });

  it('R32: ni la página ni la pantalla son Server Actions ni llaman a una; las acciones viven en los modales', () => {
    const fuentes = [
      readFileSync(path.join(SCREEN_DIR, 'page.tsx'), 'utf8'),
      readFileSync(path.join(SCREEN_DIR, 'components', 'conditioning-order-screen.tsx'), 'utf8'),
      readFileSync(path.join(SCREEN_DIR, 'components', 'conditioning-actions.tsx'), 'utf8'),
    ];

    for (const fuente of fuentes) {
      expect(fuente).not.toContain("'use server'");
      expect(fuente).not.toMatch(/adapters\/driving\/(?!require-page-permission)/);
      expect(fuente).not.toMatch(/\w+Action\(/);
      expect(fuente).not.toContain('<form');
    }
  });

  it('R32: el modal de comenzar recibe los mismos candidatos y el pedido de hoy', () => {
    render(<ConditioningOrderScreen order={QUEUED} canStart candidates={CANDIDATES} />);

    fireEvent.click(screen.getByTestId(CONDITIONING_START_BUTTON_TESTID));
    const dialogo = screen.getByTestId(START_CONDITIONING_DIALOG_TESTID);
    expect(dialogo).toHaveTextContent('2026-0000040');
    expect(dialogo).toHaveTextContent('Carla Gómez');
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
    'R13 R14: en %s, con batchData, pinta la tarjeta con un solo juego de campos y un botón',
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
    const { container } = render(<ConditioningOrderScreen order={{ ...QUEUED, batchData: null }} />);

    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID)).toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('R3: si lo acondiciona otra persona (batchData null) no hay sección ni aviso', () => {
    const { container } = render(<ConditioningOrderScreen order={{ ...ROW, batchData: null }} />);

    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID)).toBeNull();
    expect(screen.queryByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('R4: con una línea sin datos dice «Faltan los datos de lote de 1 línea.» y «Terminar» va deshabilitado', () => {
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
