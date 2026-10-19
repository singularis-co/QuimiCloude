// La lista de añadidos de la pestaña Módulos: estado por fila, interruptores, diálogo de apagar,
// toasts y errores. Las acciones de QC-277 y `sonner` están simulados.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Addon, CompanyAddonState, CompanyAddonsView } from '@/lib/modules/identity';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { setCompanyAddonActionMock, setAllCompanyAddonsActionMock, getCompanyAddonsActionMock, toastMock } =
  vi.hoisted(() => ({
    setCompanyAddonActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
    setAllCompanyAddonsActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
    getCompanyAddonsActionMock: vi.fn<(id: string) => Promise<unknown>>(),
    toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  }));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  getCompanyAction: vi.fn(),
  getCompanyAddonsAction: getCompanyAddonsActionMock,
  listCompanyEventsAction: vi.fn(),
  listCompaniesAction: vi.fn(),
  getCompanyDeletionImpactAction: vi.fn(),
  createCompanyAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  setCompanyCountryAction: vi.fn(),
  deleteCompanyAction: vi.fn(),
  reactivateCompanyAction: vi.fn(),
  setCompanyAddonAction: setCompanyAddonActionMock,
  setAllCompanyAddonsAction: setAllCompanyAddonsActionMock,
}));

import {
  ADDON_SWITCH_LIST_TESTIDS as IDS,
  AddonSwitchList,
} from '@/app/(private)/maestro/empresas/[id]/components/modulos/addon-switch-list';

const ARCHIVO = join(
  __dirname,
  '..',
  '..',
  '..',
  'app',
  '(private)',
  'maestro',
  'empresas',
  '[id]',
  'components',
  'modulos',
  'addon-switch-list.tsx',
);

const ID = '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f';
const EMPRESA = 'Químicos del Valle S.A.S.';
const ORDEN: readonly Addon[] = ['dashboard', 'proveedores', 'lectura_pdf', 'importacion_excel', 'integraciones'];
const NOMBRES: Readonly<Record<Addon, string>> = {
  dashboard: 'Dashboard y recorrido',
  proveedores: 'Proveedores',
  lectura_pdf: 'Lectura de PDF con IA',
  importacion_excel: 'Importación desde Excel',
  integraciones: 'Integraciones',
};

type Fila = Pick<CompanyAddonState, 'enabled' | 'active'> & { readonly requires?: readonly Addon[] };

function vista(filas: Readonly<Record<Addon, Fila>>, orden: readonly Addon[] = ORDEN): CompanyAddonsView {
  return {
    companyId: ID,
    addons: orden.map((addon) => ({
      addon,
      enabled: filas[addon].enabled,
      active: filas[addon].active,
      requires: filas[addon].requires ?? (addon === 'lectura_pdf' ? ['integraciones'] : []),
    })),
  };
}

const ON = { enabled: true, active: true } as const;
const OFF = { enabled: false, active: false } as const;
const SIN_EFECTO = { enabled: true, active: false } as const;

// Tres prendidos (la lectura sin Integraciones, así que sin efecto) y dos apagados.
const BASE = vista({
  dashboard: ON,
  proveedores: ON,
  lectura_pdf: SIN_EFECTO,
  importacion_excel: OFF,
  integraciones: OFF,
});

const TODO_PRENDIDO = vista({
  dashboard: ON,
  proveedores: ON,
  lectura_pdf: ON,
  importacion_excel: ON,
  integraciones: ON,
});

const TODO_APAGADO = vista({
  dashboard: OFF,
  proveedores: OFF,
  lectura_pdf: OFF,
  importacion_excel: OFF,
  integraciones: OFF,
});

const ERROR_INESPERADO = {
  status: 'error',
  code: 'unexpected',
  message: 'Ocurrio un error inesperado. Intentalo de nuevo.',
  reference: 'req-qc278-1',
} as const;

const EMPRESA_NO_EXISTE = {
  status: 'error',
  code: 'company_not_found',
  message: 'La empresa solicitada no existe.',
} as const;

function montar(
  props: Partial<{ initialView: CompanyAddonsView; isDeleted: boolean; canModify: boolean }> = {},
) {
  return render(
    <AddonSwitchList
      initialView={props.initialView ?? BASE}
      companyName={EMPRESA}
      isDeleted={props.isDeleted ?? false}
      canModify={props.canModify ?? true}
    />,
  );
}

function interruptor(addon: Addon): HTMLElement {
  return screen.getByTestId(IDS.toggle(addon));
}

function estado(addon: Addon): string | null {
  return screen.getByTestId(IDS.status(addon)).textContent;
}

function campos(formData: FormData | undefined): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData?.entries() ?? []);
}

function todosLosControles(): HTMLElement[] {
  return [...ORDEN.map(interruptor), screen.getByTestId(IDS.allOn), screen.getByTestId(IDS.allOff)];
}

function diferida<T>() {
  let resolver: (valor: T) => void = () => undefined;
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

async function abrirApagar(addon: Addon) {
  const user = setupUser();
  montar();
  await user.click(interruptor(addon));
  const dialogo = await screen.findByTestId(IDS.dialog);
  return { user, dialogo };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AddonSwitchList', () => {
  it('R5: pinta los cinco añadidos en el orden de la vista con nombre, descripción y estado', () => {
    const invertido = [...ORDEN].reverse();
    montar({
      initialView: vista(
        { dashboard: ON, proveedores: ON, lectura_pdf: SIN_EFECTO, importacion_excel: OFF, integraciones: OFF },
        invertido,
      ),
    });

    const seccion = screen.getByRole('region', { name: 'Añadidos' });
    const filas = within(seccion).getAllByRole('listitem').filter((li) => li.dataset.testid?.startsWith('company-addon-'));
    expect(filas.map((fila) => fila.dataset.testid)).toEqual(invertido.map(IDS.row));

    const proveedores = screen.getByTestId(IDS.row('proveedores'));
    expect(within(proveedores).getByText('Proveedores')).toBeInTheDocument();
    expect(within(proveedores).getByText('Directorio de proveedores y su catálogo.')).toBeInTheDocument();
    expect(within(proveedores).getByTestId(IDS.status('proveedores'))).toHaveTextContent('Prendido');
    expect(within(proveedores).getByRole('switch')).toBeInTheDocument();
    for (const addon of ORDEN) {
      expect(within(screen.getByTestId(IDS.row(addon))).getByText(NOMBRES[addon])).toBeInTheDocument();
    }
  });

  it('R6: Prendido si activo, Sin efecto si prendido sin activo, Apagado si apagado', () => {
    montar();
    expect(estado('dashboard')).toBe('Prendido');
    expect(estado('lectura_pdf')).toBe('Sin efecto');
    expect(estado('importacion_excel')).toBe('Apagado');
    expect(screen.getByTestId(IDS.status('dashboard'))).toHaveAttribute('data-tone', 'success');
    expect(screen.getByTestId(IDS.status('lectura_pdf'))).toHaveAttribute('data-tone', 'waiting');
    expect(screen.getByTestId(IDS.status('importacion_excel'))).toHaveAttribute('data-tone', 'muted');
    expect(interruptor('lectura_pdf')).toHaveAttribute('aria-checked', 'true');
    expect(interruptor('importacion_excel')).toHaveAttribute('aria-checked', 'false');
  });

  it('R7: Lectura de PDF dice Necesita Integraciones y en advertencia si está Sin efecto', () => {
    montar();
    const aviso = screen.getByTestId(IDS.requires('lectura_pdf'));
    expect(aviso).toHaveTextContent('Necesita Integraciones. Préndela para que funcione.');
    expect(aviso).toHaveAttribute('data-tone', 'warning');
    expect(screen.queryByTestId(IDS.requires('proveedores'))).not.toBeInTheDocument();
    cleanup();

    montar({ initialView: TODO_PRENDIDO });
    const activo = screen.getByTestId(IDS.requires('lectura_pdf'));
    expect(activo.textContent).toBe('Necesita Integraciones.');
    expect(activo).toHaveAttribute('data-tone', 'neutral');
  });

  it('R8: la cabecera cuenta los interruptores prendidos de cinco', () => {
    montar();
    expect(screen.getByTestId(IDS.count)).toHaveTextContent(
      '3 de 5 prendidos. Al apagar uno, desaparece para todos los usuarios de la empresa desde su siguiente acción.',
    );
    cleanup();
    montar({ initialView: TODO_APAGADO });
    expect(screen.getByTestId(IDS.count)).toHaveTextContent('0 de 5 prendidos.');
  });

  it('R9: prender un añadido llama a setCompanyAddonAction sin diálogo', async () => {
    setCompanyAddonActionMock.mockResolvedValue({ status: 'success', data: BASE });
    const user = setupUser();
    montar();

    await user.click(interruptor('importacion_excel'));

    await waitFor(() => expect(setCompanyAddonActionMock).toHaveBeenCalledTimes(1));
    expect(campos(setCompanyAddonActionMock.mock.calls[0]?.[1])).toEqual({
      companyId: ID,
      enabled: 'true',
      addon: 'importacion_excel',
    });
    expect(setAllCompanyAddonsActionMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(IDS.dialog)).not.toBeInTheDocument();
  });

  it('R10: apagar un añadido abre la confirmación con su nombre, la empresa y lo que se descarta', async () => {
    setCompanyAddonActionMock.mockResolvedValue({
      status: 'success',
      data: vista({ dashboard: ON, proveedores: ON, lectura_pdf: OFF, importacion_excel: OFF, integraciones: OFF }),
    });
    const { user, dialogo } = await abrirApagar('lectura_pdf');

    expect(setCompanyAddonActionMock).not.toHaveBeenCalled();
    expect(within(dialogo).getByRole('heading', { name: '¿Apagar Lectura de PDF con IA?' })).toBeInTheDocument();
    expect(dialogo).toHaveTextContent(
      `Desaparece del menú y de las pantallas de todos los usuarios de ${EMPRESA} desde su siguiente acción. Lo ya confirmado no se borra.`,
    );
    expect(within(dialogo).getByText(EMPRESA).tagName).toBe('STRONG');
    expect(within(dialogo).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Las lecturas de PDF en cola terminan como fallidas.',
      'Las revisiones sin confirmar quedan ocultas hasta que lo vuelvas a prender.',
    ]);
    expect(screen.getByTestId(IDS.dismiss)).toHaveTextContent('Volver');
    expect(screen.getByTestId(IDS.confirm)).toHaveTextContent('Apagar');

    // El interruptor sigue en su posición guardada hasta confirmar.
    expect(interruptor('lectura_pdf')).toHaveAttribute('aria-checked', 'true');

    await user.click(await esperarInteractiva(screen.getByTestId(IDS.confirm)));
    await waitFor(() => expect(setCompanyAddonActionMock).toHaveBeenCalledTimes(1));
    expect(campos(setCompanyAddonActionMock.mock.calls[0]?.[1])).toEqual({
      companyId: ID,
      enabled: 'false',
      addon: 'lectura_pdf',
    });
    await waitFor(() => expect(interruptor('lectura_pdf')).toHaveAttribute('aria-checked', 'false'));
  });

  it('R10: Volver cierra sin escribir', async () => {
    const { user } = await abrirApagar('proveedores');

    await user.click(await esperarInteractiva(screen.getByTestId(IDS.dismiss)));

    await waitFor(() => expect(screen.queryByTestId(IDS.dialog)).not.toBeInTheDocument());
    expect(setCompanyAddonActionMock).not.toHaveBeenCalled();
    expect(setAllCompanyAddonsActionMock).not.toHaveBeenCalled();
    expect(interruptor('proveedores')).toHaveAttribute('aria-checked', 'true');
  });

  it('R11: Prender todos llama a setAllCompanyAddonsAction con enabled=true sin diálogo', async () => {
    setAllCompanyAddonsActionMock.mockResolvedValue({ status: 'success', data: TODO_PRENDIDO });
    const user = setupUser();
    montar();

    await user.click(screen.getByTestId(IDS.allOn));

    await waitFor(() => expect(setAllCompanyAddonsActionMock).toHaveBeenCalledTimes(1));
    expect(campos(setAllCompanyAddonsActionMock.mock.calls[0]?.[1])).toEqual({ companyId: ID, enabled: 'true' });
    expect(setCompanyAddonActionMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(IDS.dialog)).not.toBeInTheDocument();
  });

  it('R12: Apagar todos confirma con el número, los nombres y las consecuencias sin repetir', async () => {
    setAllCompanyAddonsActionMock.mockResolvedValue({ status: 'success', data: TODO_APAGADO });
    const user = setupUser();
    montar({
      initialView: vista({
        dashboard: ON,
        proveedores: OFF,
        lectura_pdf: ON,
        importacion_excel: ON,
        integraciones: ON,
      }),
    });

    await user.click(screen.getByTestId(IDS.allOff));
    const dialogo = await screen.findByTestId(IDS.dialog);

    expect(setAllCompanyAddonsActionMock).not.toHaveBeenCalled();
    expect(within(dialogo).getByRole('heading', { name: '¿Apagar los 4 módulos prendidos?' })).toBeInTheDocument();
    expect(dialogo).toHaveTextContent(
      `Dashboard y recorrido, Lectura de PDF con IA, Importación desde Excel e Integraciones desaparecen para todos los usuarios de ${EMPRESA} desde su siguiente acción. Lo ya confirmado no se borra.`,
    );
    expect(within(dialogo).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Las lecturas de PDF en cola terminan como fallidas.',
      'Las revisiones sin confirmar quedan ocultas hasta que lo vuelvas a prender.',
    ]);
    expect(screen.getByTestId(IDS.confirm)).toHaveTextContent('Apagar todos');

    await user.click(await esperarInteractiva(screen.getByTestId(IDS.confirm)));
    await waitFor(() => expect(setAllCompanyAddonsActionMock).toHaveBeenCalledTimes(1));
    expect(campos(setAllCompanyAddonsActionMock.mock.calls[0]?.[1])).toEqual({ companyId: ID, enabled: 'false' });
    expect(setCompanyAddonActionMock).not.toHaveBeenCalled();
  });

  it('R12: con un solo añadido prendido, Apagar todos va en singular', async () => {
    setAllCompanyAddonsActionMock.mockResolvedValue({ status: 'success', data: TODO_APAGADO });
    const user = setupUser();
    montar({
      initialView: vista({
        dashboard: OFF,
        proveedores: OFF,
        lectura_pdf: ON,
        importacion_excel: OFF,
        integraciones: OFF,
      }),
    });

    await user.click(screen.getByTestId(IDS.allOff));
    const dialogo = await screen.findByTestId(IDS.dialog);

    expect(within(dialogo).getByRole('heading', { name: '¿Apagar el módulo prendido?' })).toBeInTheDocument();
    expect(dialogo).toHaveTextContent(
      `Lectura de PDF con IA desaparece para todos los usuarios de ${EMPRESA} desde su siguiente acción. Lo ya confirmado no se borra.`,
    );
    expect(within(dialogo).getByText(EMPRESA).tagName).toBe('STRONG');
    expect(within(dialogo).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Las lecturas de PDF en cola terminan como fallidas.',
      'Las revisiones sin confirmar quedan ocultas hasta que lo vuelvas a prender.',
    ]);
    expect(screen.getByTestId(IDS.confirm)).toHaveTextContent('Apagar todos');

    await user.click(await esperarInteractiva(screen.getByTestId(IDS.confirm)));
    await waitFor(() => expect(setAllCompanyAddonsActionMock).toHaveBeenCalledTimes(1));
    expect(campos(setAllCompanyAddonsActionMock.mock.calls[0]?.[1])).toEqual({ companyId: ID, enabled: 'false' });
    expect(setCompanyAddonActionMock).not.toHaveBeenCalled();
  });

  it('R13: Prender todos deshabilitado sin apagados y Apagar todos sin prendidos', () => {
    montar();
    expect(screen.getByTestId(IDS.allOn)).toBeEnabled();
    expect(screen.getByTestId(IDS.allOff)).toBeEnabled();
    cleanup();

    montar({ initialView: TODO_PRENDIDO });
    expect(screen.getByTestId(IDS.allOn)).toBeDisabled();
    expect(screen.getByTestId(IDS.allOff)).toBeEnabled();
    cleanup();

    montar({ initialView: TODO_APAGADO });
    expect(screen.getByTestId(IDS.allOn)).toBeEnabled();
    expect(screen.getByTestId(IDS.allOff)).toBeDisabled();
  });

  it('R14: mientras guarda hay spinner en el interruptor afectado y todo deshabilitado', async () => {
    const respuesta = diferida<unknown>();
    setCompanyAddonActionMock.mockReturnValue(respuesta.promesa);
    const user = setupUser();
    montar();

    await user.click(interruptor('importacion_excel'));

    await waitFor(() => expect(interruptor('importacion_excel').querySelector('svg')).not.toBeNull());
    expect(interruptor('importacion_excel')).toHaveAttribute('aria-busy', 'true');
    expect(interruptor('dashboard').querySelector('svg')).toBeNull();
    for (const control of todosLosControles()) {
      expect(control).toHaveAttribute('data-disabled');
    }
    expect(screen.getByTestId(IDS.allOn)).toBeDisabled();
    expect(screen.getByTestId(IDS.allOff)).toBeDisabled();

    respuesta.resolver({ status: 'success', data: BASE });
    await waitFor(() => expect(interruptor('importacion_excel').querySelector('svg')).toBeNull());
    expect(interruptor('dashboard')).not.toHaveAttribute('data-disabled');
  });

  it('R15: con éxito pinta la vista devuelta sin releer y avisa por toast', async () => {
    const despues = vista({
      dashboard: ON,
      proveedores: ON,
      lectura_pdf: ON,
      importacion_excel: OFF,
      integraciones: ON,
    });
    setCompanyAddonActionMock.mockResolvedValue({ status: 'success', data: despues });
    const user = setupUser();
    montar();

    await user.click(interruptor('integraciones'));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Integraciones prendido.'));
    expect(interruptor('integraciones')).toHaveAttribute('aria-checked', 'true');
    expect(estado('integraciones')).toBe('Prendido');
    expect(estado('lectura_pdf')).toBe('Prendido');
    expect(screen.getByTestId(IDS.count)).toHaveTextContent('4 de 5 prendidos.');
    expect(getCompanyAddonsActionMock).not.toHaveBeenCalled();

    setAllCompanyAddonsActionMock.mockResolvedValue({ status: 'success', data: TODO_PRENDIDO });
    await user.click(screen.getByTestId(IDS.allOn));
    await waitFor(() => expect(toastMock.success).toHaveBeenLastCalledWith('Se prendió 1 módulo.'));
    expect(getCompanyAddonsActionMock).not.toHaveBeenCalled();
  });

  it('R16: si falla uno, el interruptor vuelve y aparece No se guardó el cambio junto a su fila', async () => {
    setCompanyAddonActionMock.mockResolvedValue(ERROR_INESPERADO);
    const user = setupUser();
    montar();

    await user.click(interruptor('importacion_excel'));

    const fila = screen.getByTestId(IDS.row('importacion_excel'));
    const aviso = await within(fila).findByTestId(IDS.error('importacion_excel'));
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent('No se guardó el cambio');
    expect(aviso).toHaveTextContent('Ocurrio un error inesperado. Intentalo de nuevo.');
    expect(aviso).toHaveTextContent('req-qc278-1');
    const apoyo = within(fila).getByText('El interruptor vuelve a su posición anterior.');
    expect(aviso.compareDocumentPosition(apoyo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(interruptor('importacion_excel')).toHaveAttribute('aria-checked', 'false');
    expect(estado('importacion_excel')).toBe('Apagado');
    expect(screen.queryByTestId(IDS.allError)).not.toBeInTheDocument();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('R17: si falla todos, nada cambia y el error va bajo los botones', async () => {
    setAllCompanyAddonsActionMock.mockResolvedValue(EMPRESA_NO_EXISTE);
    const user = setupUser();
    montar();

    await user.click(screen.getByTestId(IDS.allOn));

    const aviso = await screen.findByTestId(IDS.allError);
    expect(aviso).toHaveTextContent('No se guardó el cambio');
    expect(aviso).toHaveTextContent('La empresa solicitada no existe.');
    expect(aviso.compareDocumentPosition(screen.getByTestId(IDS.allOn)) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(ORDEN.map((addon) => interruptor(addon).getAttribute('aria-checked'))).toEqual([
      'true',
      'true',
      'true',
      'false',
      'false',
    ]);
    for (const addon of ORDEN) {
      expect(screen.queryByTestId(IDS.error(addon))).not.toBeInTheDocument();
    }
    expect(screen.queryByText('El interruptor vuelve a su posición anterior.')).not.toBeInTheDocument();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('R18: el siguiente cambio quita el error anterior', async () => {
    setCompanyAddonActionMock.mockResolvedValueOnce(ERROR_INESPERADO);
    const user = setupUser();
    montar();

    await user.click(interruptor('importacion_excel'));
    expect(await screen.findByTestId(IDS.error('importacion_excel'))).toBeInTheDocument();

    const respuesta = diferida<unknown>();
    setCompanyAddonActionMock.mockReturnValueOnce(respuesta.promesa);
    await user.click(interruptor('integraciones'));
    expect(screen.queryByTestId(IDS.error('importacion_excel'))).not.toBeInTheDocument();
    respuesta.resolver({ status: 'success', data: BASE });

    setAllCompanyAddonsActionMock.mockResolvedValueOnce(EMPRESA_NO_EXISTE);
    await waitFor(() => expect(screen.getByTestId(IDS.allOn)).toBeEnabled());
    await user.click(screen.getByTestId(IDS.allOn));
    expect(await screen.findByTestId(IDS.allError)).toBeInTheDocument();

    await user.click(screen.getByTestId(IDS.allOff));
    expect(screen.queryByTestId(IDS.allError)).not.toBeInTheDocument();
  });

  it('R20: empresa de baja: aviso y todos los controles deshabilitados', async () => {
    const user = setupUser();
    montar({ isDeleted: true });

    const aviso = screen.getByTestId(IDS.deletedNotice);
    expect(aviso).toHaveTextContent('Esta empresa está de baja');
    expect(aviso).toHaveTextContent('Reactívala para cambiar sus módulos.');
    expect(aviso).toHaveAttribute('data-tone', 'warning');
    for (const addon of ORDEN) {
      expect(screen.getByTestId(IDS.row(addon))).toBeInTheDocument();
    }
    expect(estado('dashboard')).toBe('Prendido');
    for (const control of todosLosControles()) {
      expect(control).toHaveAttribute('data-disabled');
    }
    expect(screen.getByTestId(IDS.allOn)).toBeDisabled();
    expect(screen.getByTestId(IDS.allOff)).toBeDisabled();

    await user.click(interruptor('importacion_excel'));
    expect(setCompanyAddonActionMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(IDS.dialog)).not.toBeInTheDocument();
  });

  it('R21: sin empresas.modificar todos los controles deshabilitados', async () => {
    const user = setupUser();
    montar({ canModify: false });

    expect(screen.queryByTestId(IDS.deletedNotice)).not.toBeInTheDocument();
    for (const control of todosLosControles()) {
      expect(control).toHaveAttribute('data-disabled');
    }
    expect(screen.getByTestId(IDS.allOn)).toBeDisabled();
    expect(screen.getByTestId(IDS.allOff)).toBeDisabled();

    await user.click(interruptor('proveedores'));
    expect(screen.queryByTestId(IDS.dialog)).not.toBeInTheDocument();
    expect(setCompanyAddonActionMock).not.toHaveBeenCalled();
  });

  it('R22: el estado sale de active de la vista aunque enabled y requires digan otra cosa', () => {
    montar({
      initialView: vista({
        dashboard: OFF,
        // Prendida, con su dependencia apagada, pero el servidor dice que está activa.
        lectura_pdf: { enabled: true, active: true, requires: ['integraciones'] },
        // Prendido, sin dependencias, pero el servidor dice que no está activo.
        proveedores: { enabled: true, active: false },
        importacion_excel: OFF,
        integraciones: OFF,
      }),
    });
    expect(estado('lectura_pdf')).toBe('Prendido');
    expect(estado('proveedores')).toBe('Sin efecto');
  });

  it('R22: el componente no importa effectiveAddons ni ADDON_REQUIRES', () => {
    const fuente = readFileSync(ARCHIVO, 'utf8');
    expect(fuente).not.toMatch(/\beffectiveAddons\b/);
    expect(fuente).not.toMatch(/\bADDON_REQUIRES\b/);
    expect(fuente).not.toMatch(/\bADDONS\b/);
    // Del barrel de identity solo tipos: un valor arrastraría el dominio al cliente.
    const desdeIdentity = [...fuente.matchAll(/import\s+(type\s+)?\{[^}]*\}\s+from\s+'@\/lib\/modules\/identity'/g)];
    expect(desdeIdentity.length).toBeGreaterThan(0);
    for (const importacion of desdeIdentity) expect(importacion[1]).toBe('type ');
  });

  it('R23: cada interruptor es un switch con nombre Prender o Apagar y responde a teclado', async () => {
    setCompanyAddonActionMock.mockResolvedValue({ status: 'success', data: BASE });
    const user = setupUser();
    montar();

    const nombres = screen.getAllByRole('switch').map((sw) => sw.getAttribute('aria-label'));
    expect(nombres).toEqual([
      'Apagar Dashboard y recorrido',
      'Apagar Proveedores',
      'Apagar Lectura de PDF con IA',
      'Prender Importación desde Excel',
      'Prender Integraciones',
    ]);
    expect(screen.getByRole('switch', { name: 'Prender Importación desde Excel' })).toBe(interruptor('importacion_excel'));

    interruptor('importacion_excel').focus();
    await user.keyboard(' ');
    await waitFor(() => expect(setCompanyAddonActionMock).toHaveBeenCalledTimes(1));
    expect(campos(setCompanyAddonActionMock.mock.calls[0]?.[1])).toMatchObject({
      addon: 'importacion_excel',
      enabled: 'true',
    });

    await waitFor(() => expect(interruptor('proveedores')).not.toHaveAttribute('data-disabled'));
    interruptor('proveedores').focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId(IDS.dialog)).toBeInTheDocument();
  });

  it('R24: clases mobile-first: Switch junto al nombre y botones a todo el ancho bajo md', () => {
    montar();
    const fila = screen.getByTestId(IDS.row('proveedores'));
    const rejilla = interruptor('proveedores').parentElement;
    expect(rejilla?.parentElement).toBe(fila);
    expect(rejilla).toHaveClass('grid', 'grid-cols-[36px_minmax(0,1fr)_auto]', 'md:grid-cols-[40px_minmax(0,1fr)_auto_auto]');
    // Bajo md el Switch va en la primera fila, a la derecha del nombre, con 44 px de objetivo.
    expect(interruptor('proveedores')).toHaveClass('col-start-3', 'row-start-1', 'md:col-start-auto', 'min-h-11', 'min-w-11');
    // Y el estado baja a la segunda fila, bajo la descripción.
    expect(screen.getByTestId(IDS.status('proveedores')).parentElement).toHaveClass('col-start-2', 'md:col-start-auto');
    for (const id of [IDS.allOn, IDS.allOff]) {
      expect(screen.getByTestId(id)).toHaveClass('w-full', 'md:w-auto', 'max-md:min-h-11');
    }
    expect(screen.getByTestId(IDS.allOn).parentElement).toHaveClass('flex-col', 'md:flex-row');
  });
});
