// La edición de empresa en dos pasos: datos y, solo si se guardaron, el país. Las acciones están
// simuladas: es el borde del módulo.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMPANY_EDIT_FIELD_PREFIX,
  CompanyEditSheet,
  companyFieldErrorTestId,
  companyFieldTestId,
} from '@/app/(private)/maestro/empresas/components';
import { listCountryOptions } from '@/components/shared/country-options';
import type { CompanyDetail } from '@/lib/modules/identity';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const {
  routerMock,
  toastMock,
  getCompanyActionMock,
  updateCompanyActionMock,
  setCompanyCountryActionMock,
} = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  getCompanyActionMock: vi.fn<(id: string) => Promise<unknown>>(),
  updateCompanyActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
  setCompanyCountryActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  getCompanyAction: getCompanyActionMock,
  updateCompanyAction: updateCompanyActionMock,
  setCompanyCountryAction: setCompanyCountryActionMock,
  createCompanyAction: vi.fn(),
  listCompaniesAction: vi.fn(),
  getCompanyDeletionImpactAction: vi.fn(),
  listCompanyEventsAction: vi.fn(),
  deleteCompanyAction: vi.fn(),
  reactivateCompanyAction: vi.fn(),
}));

const VALLE: CompanyDetail = {
  id: '1c7d8e9f-2031-4b4c-9d5e-6f7a8b9c0d1e',
  name: 'Químicos del Valle S.A.S.',
  taxId: '900.481.227-3',
  contactEmail: 'contacto@quimicosvalle.co',
  contactPhone: '602 488 1200',
  country: 'CO',
  createdAt: new Date('2026-09-14T12:00:00.000Z'),
  status: 'active',
  deletedAt: null,
};

const LA_CEJA: CompanyDetail = {
  ...VALLE,
  id: '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f',
  name: 'Detergentes La Ceja',
  taxId: null,
  contactEmail: null,
  contactPhone: null,
  country: null,
  status: 'deleted',
  deletedAt: new Date('2026-10-05T12:00:00.000Z'),
};

const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

const onOpenChange = vi.fn<(open: boolean) => void>();

function campo(field: Parameters<typeof companyFieldTestId>[1]): HTMLInputElement {
  return screen.getByTestId(companyFieldTestId(COMPANY_EDIT_FIELD_PREFIX, field)) as HTMLInputElement;
}

async function abrirDesdeLista(detail: CompanyDetail = VALLE) {
  getCompanyActionMock.mockResolvedValue({ status: 'success', data: detail });
  render(<CompanyEditSheet companyId={detail.id} open onOpenChange={onOpenChange} />);
  await screen.findByTestId('company-edit-form');
  return setupUser();
}

async function elegirPais(user: ReturnType<typeof setupUser>, code: string) {
  await user.click(screen.getByTestId('company-edit-country'));
  await screen.findByRole('listbox');
  await user.click(await esperarInteractiva(screen.getByTestId(`company-edit-country-option-${code}`)));
}

async function guardar(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByTestId('company-edit-submit'));
  await waitFor(() => expect(updateCompanyActionMock).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
  updateCompanyActionMock.mockResolvedValue({ status: 'success' });
  setCompanyCountryActionMock.mockResolvedValue({ status: 'success' });
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('apertura', () => {
  it('R20: desde la lista pide la ficha y abre «Editar empresa» con los valores actuales', async () => {
    let resolver: (value: unknown) => void = () => {};
    getCompanyActionMock.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    render(<CompanyEditSheet companyId={VALLE.id} open onOpenChange={onOpenChange} />);
    expect(screen.getByTestId('company-edit-loading')).toBeInTheDocument();
    expect(getCompanyActionMock).toHaveBeenCalledWith(VALLE.id);
    resolver({ status: 'success', data: VALLE });

    await screen.findByTestId('company-edit-form');
    const panel = screen.getByTestId('company-edit-sheet');
    expect(within(panel).getByRole('heading', { name: 'Editar empresa' })).toBeInTheDocument();
    expect(campo('name')).toHaveValue(VALLE.name);
    expect(campo('taxId')).toHaveValue(VALLE.taxId);
    expect(campo('contactEmail')).toHaveValue(VALLE.contactEmail);
    expect(campo('contactPhone')).toHaveValue(VALLE.contactPhone);
    expect(screen.getByTestId('company-edit-country')).toHaveTextContent('Colombia (+57)');
  });

  it('R20: una empresa de baja tambien se edita, con «Sin país» si no tiene', async () => {
    await abrirDesdeLista(LA_CEJA);
    expect(campo('name')).toHaveValue(LA_CEJA.name);
    expect(campo('taxId')).toHaveValue('');
    expect(screen.getByTestId('company-edit-country')).toHaveTextContent('Sin país');
  });

  it('R20: con la ficha ya leida no la vuelve a pedir', async () => {
    render(<CompanyEditSheet companyId={VALLE.id} detail={VALLE} open onOpenChange={onOpenChange} />);
    expect(await screen.findByTestId('company-edit-form')).toBeInTheDocument();
    expect(getCompanyActionMock).not.toHaveBeenCalled();
  });

  it('R20: Pais ofrece «Sin país» y cualquier pais', async () => {
    const user = await abrirDesdeLista();
    await user.click(screen.getByTestId('company-edit-country'));
    const lista = await screen.findByRole('listbox');
    const opciones = within(lista).getAllByRole('option');
    expect(opciones[0]).toHaveTextContent('Sin país');
    expect(opciones).toHaveLength(listCountryOptions().length + 1);
  });

  it('R20: si no se puede leer la ficha pinta el error en el panel', async () => {
    getCompanyActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-ed1',
    });
    render(<CompanyEditSheet companyId={VALLE.id} open onOpenChange={onOpenChange} />);
    expect(await screen.findByTestId('company-edit-error')).toHaveTextContent('req-ed1');
    expect(screen.queryByTestId('company-edit-form')).toBeNull();
  });
});

describe('guardado en dos pasos', () => {
  it('R21: guarda primero los cuatro datos y despues el pais; con exito cierra, avisa y refresca', async () => {
    const user = await abrirDesdeLista();
    fireEvent.change(campo('name'), { target: { value: 'Químicos del Valle' } });
    await elegirPais(user, 'EC');
    await guardar(user);
    await waitFor(() => expect(setCompanyCountryActionMock).toHaveBeenCalledTimes(1));

    const datos = updateCompanyActionMock.mock.calls[0]![1];
    expect(datos.get('companyId')).toBe(VALLE.id);
    expect(datos.get('name')).toBe('Químicos del Valle');
    expect(datos.get('taxId')).toBe(VALLE.taxId);
    expect(datos.get('contactEmail')).toBe(VALLE.contactEmail);
    expect(datos.get('contactPhone')).toBe(VALLE.contactPhone);
    const pais = setCompanyCountryActionMock.mock.calls[0]![1];
    expect(pais.get('companyId')).toBe(VALLE.id);
    expect(pais.get('country')).toBe('EC');
    expect(updateCompanyActionMock.mock.invocationCallOrder[0]).toBeLessThan(
      setCompanyCountryActionMock.mock.invocationCallOrder[0]!,
    );

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Empresa actualizada.'));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('R21: el pais se manda aunque no cambie, y «Sin país» viaja vacio', async () => {
    const user = await abrirDesdeLista();
    await guardar(user);
    await waitFor(() => expect(setCompanyCountryActionMock).toHaveBeenCalledTimes(1));
    expect(setCompanyCountryActionMock.mock.calls[0]![1].get('country')).toBe('CO');

    cleanup();
    vi.clearAllMocks();
    updateCompanyActionMock.mockResolvedValue({ status: 'success' });
    setCompanyCountryActionMock.mockResolvedValue({ status: 'success' });
    const otra = await abrirDesdeLista();
    await elegirPais(otra, 'none');
    await guardar(otra);
    await waitFor(() => expect(setCompanyCountryActionMock).toHaveBeenCalledTimes(1));
    expect(setCompanyCountryActionMock.mock.calls[0]![1].get('country')).toBe('');
  });

  it('R19: si los datos se rechazan no se manda el pais y el error va junto a su campo', async () => {
    updateCompanyActionMock.mockResolvedValue({
      status: 'error',
      code: 'company_duplicate_name',
      message: 'Ya existe una empresa activa con ese nombre.',
    });
    const user = await abrirDesdeLista();
    fireEvent.change(campo('name'), { target: { value: 'Aseo Caribe' } });
    await guardar(user);
    expect(
      await screen.findByTestId(companyFieldErrorTestId(COMPANY_EDIT_FIELD_PREFIX, 'name')),
    ).toHaveTextContent('Ya existe una empresa activa con ese nombre.');
    expect(setCompanyCountryActionMock).not.toHaveBeenCalled();
    expect(campo('name')).toHaveValue('Aseo Caribe');
    expect(screen.getByTestId('company-edit-sheet')).toBeInTheDocument();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('R19: un rechazo sin campo de los datos va a la region de error del panel', async () => {
    updateCompanyActionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: 'El actor no tiene permiso para realizar esta operacion.',
    });
    const user = await abrirDesdeLista();
    await guardar(user);
    expect(await screen.findByTestId('company-edit-error')).toHaveTextContent(
      'El actor no tiene permiso para realizar esta operacion.',
    );
    expect(setCompanyCountryActionMock).not.toHaveBeenCalled();
  });

  it('R22: si los datos se guardan y el pais se rechaza, el error va junto a Pais y la lista se refresca', async () => {
    setCompanyCountryActionMock.mockResolvedValue({
      status: 'error',
      code: 'invalid_input',
      message: 'Los datos no son validos.',
    });
    const user = await abrirDesdeLista();
    fireEvent.change(campo('contactPhone'), { target: { value: '602 000 0000' } });
    await elegirPais(user, 'EC');
    await guardar(user);
    await waitFor(() => expect(setCompanyCountryActionMock).toHaveBeenCalledTimes(1));

    const panel = screen.getByTestId('company-edit-sheet');
    expect(await within(panel).findByText('Los datos no son validos.')).toBeInTheDocument();
    expect(screen.getByTestId('company-edit-country')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('company-edit-error')).toBeNull();
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(campo('contactPhone')).toHaveValue('602 000 0000');
    expect(screen.getByTestId('company-edit-country')).toHaveTextContent('Ecuador (+593)');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('R22: un fallo inesperado del pais va junto a Pais con su referencia', async () => {
    setCompanyCountryActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-pais',
    });
    const user = await abrirDesdeLista();
    await guardar(user);
    expect(await screen.findByTestId('company-edit-country-error')).toHaveTextContent('req-pais');
    expect(screen.getByTestId('company-edit-country')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
  });
});
