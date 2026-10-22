// Alta y edición de un Administrador. Las Server Actions están simuladas: son el borde del módulo;
// lo que se afirma es el `FormData` que reciben y lo que la pantalla hace con su respuesta.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ADMINISTRATOR_FIELD_PREFIX,
  AdministratorCreateAction,
  AdministratorSheet,
  type ActiveCompany,
} from '@/app/(private)/maestro/administradores/components';
import {
  ADMINISTRATOR_FIELD_NAMES,
  administratorFieldErrorTestId,
  administratorFieldTestId,
  administratorUsernameSuggestionTestIds,
} from '@/components/shared/administrator-fields';
import type { ErrorState } from '@/lib/modules/errores';
import { DOCUMENT_TYPE_CODES, type AdministratorDetail } from '@/lib/modules/identity';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const {
  routerMock,
  createAdministratorActionMock,
  updateAdministratorActionMock,
  getAdministratorActionMock,
  toastMock,
} = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  createAdministratorActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
  updateAdministratorActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
  getAdministratorActionMock: vi.fn<(id: string) => Promise<unknown>>(),
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/lib/modules/identity/adapters/driving/administrator-actions', () => ({
  listAdministratorsAction: vi.fn(),
  getAdministratorAction: getAdministratorActionMock,
  createAdministratorAction: createAdministratorActionMock,
  updateAdministratorAction: updateAdministratorActionMock,
  deleteAdministratorAction: vi.fn(),
  resendAdministratorLinkAction: vi.fn(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  listCompaniesAction: vi.fn(),
}));

const VALLE: ActiveCompany = { id: '1c7d8e9f-2031-4b4c-9d5e-6f7a8b9c0d1e', name: 'Químicos del Valle S.A.S.' };
const ANDINOS: ActiveCompany = { id: '3e9f0a1b-4253-4d6e-9f70-8b9c0d1e2f30', name: 'Laboratorios Andinos' };
const COMPANIES = [VALLE, ANDINOS] as const;

const DETALLE: AdministratorDetail = {
  id: 'a1b2c3d4-0001-4a00-8000-000000000001',
  firstNames: 'Diana',
  lastNames: 'Mejía',
  birthDate: new Date('1990-05-14T00:00:00.000Z'),
  email: 'dmejia@quimicosvalle.co',
  phone: '3001234567',
  documentTypeCode: DOCUMENT_TYPE_CODES[0],
  documentNumber: '1020304050',
  username: 'dmejia',
  company: VALLE,
  accountStatus: 'active',
  accountStatusChangedAt: new Date('2026-09-02T12:00:00.000Z'),
  createdAt: new Date('2026-09-02T12:00:00.000Z'),
  updatedAt: new Date('2026-09-02T12:00:00.000Z'),
  isLastAdministrator: false,
};

function campo(field: Parameters<typeof administratorFieldTestId>[1]): HTMLInputElement {
  return screen.getByTestId(
    administratorFieldTestId(ADMINISTRATOR_FIELD_PREFIX, field),
  ) as HTMLInputElement;
}

function formulario(): HTMLFormElement {
  return screen.getByTestId('administrator-form') as HTMLFormElement;
}

async function abrirAlta() {
  const user = setupUser();
  render(<AdministratorCreateAction canModify companies={COMPANIES} />);
  await user.click(screen.getByTestId('administrator-create-open'));
  await screen.findByTestId('administrator-sheet');
  return user;
}

async function elegirEmpresa(user: ReturnType<typeof setupUser>, company: ActiveCompany) {
  await user.click(screen.getByTestId('administrator-company'));
  const lista = await esperarInteractiva(await screen.findByRole('listbox'));
  await user.click(within(lista).getByRole('option', { name: company.name }));
}

function escribir() {
  fireEvent.change(campo('firstNames'), { target: { value: 'Paula' } });
  fireEvent.change(campo('lastNames'), { target: { value: 'Gil' } });
  fireEvent.change(campo('email'), { target: { value: 'gerencia@aseocaribe.co' } });
  fireEvent.change(campo('phone'), { target: { value: '3009998877' } });
  fireEvent.change(campo('documentNumber'), { target: { value: '1020304050' } });
  fireEvent.change(campo('username'), { target: { value: 'pgil' } });
}

async function enviar(user: ReturnType<typeof setupUser>, mock: typeof createAdministratorActionMock) {
  await user.click(screen.getByTestId('administrator-submit'));
  await waitFor(() => expect(mock).toHaveBeenCalled());
}

async function abrirEdicion() {
  getAdministratorActionMock.mockResolvedValue({ status: 'success', data: DETALLE });
  const user = setupUser();
  render(
    <AdministratorSheet mode="edit" administratorId={DETALLE.id} open onOpenChange={vi.fn()} />,
  );
  await screen.findByTestId('administrator-form');
  return user;
}

function rechazo(code: Exclude<ErrorState['code'], 'unexpected'>, message: string): ErrorState {
  return { status: 'error', code, message };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('el panel «Nuevo administrador»', () => {
  it('R37: empieza por «Empresa», sigue con los campos de persona, el rol fijo, el aviso y el boton', async () => {
    await abrirAlta();
    const panel = screen.getByTestId('administrator-sheet');
    expect(within(panel).getByRole('heading', { name: 'Nuevo administrador' })).toBeInTheDocument();
    const etiquetas = Array.from(formulario().querySelectorAll('label, span.text-sm.font-medium')).map(
      (nodo) => nodo.textContent?.replace('*', '').trim() ?? '',
    );
    expect(etiquetas[0]).toBe('Empresa');
    expect(etiquetas).toEqual(
      expect.arrayContaining(['Nombres', 'Apellidos', 'Correo', 'Teléfono', 'Número de documento', 'Nombre de usuario']),
    );
    expect(within(panel).getByText('Solo empresas activas.')).toBeInTheDocument();
    expect(within(panel).getByTestId('administrator-role')).toHaveTextContent('Administrador');
    expect(within(panel).queryByRole('combobox', { name: 'Rol' })).toBeNull();
    expect(within(panel).getByTestId('administrator-mail-notice')).toHaveTextContent(
      'Le llegará un correo con un enlace para fijar su contraseña.',
    );
    expect(screen.getByTestId('administrator-submit')).toHaveTextContent('Crear administrador');
  });

  it('R37: «Empresa» ofrece solo las empresas activas que recibe', async () => {
    const user = await abrirAlta();
    await user.click(screen.getByTestId('administrator-company'));
    const lista = await esperarInteractiva(await screen.findByRole('listbox'));
    expect(within(lista).getAllByRole('option').map((opcion) => opcion.textContent)).toEqual([
      'Elige una empresa',
      VALLE.name,
      ANDINOS.name,
    ]);
  });

  it('R37: el FormData lleva la empresa y los ocho datos de persona sin prefijo', async () => {
    createAdministratorActionMock.mockResolvedValue({
      status: 'success',
      administratorId: 'a',
      mail: 'sent',
    });
    const user = await abrirAlta();
    await elegirEmpresa(user, ANDINOS);
    escribir();
    await enviar(user, createAdministratorActionMock);
    const formData = createAdministratorActionMock.mock.calls[0]![1];
    expect([...new Set(formData.keys())].sort()).toEqual(
      ['companyId', ...ADMINISTRATOR_FIELD_NAMES].sort(),
    );
    expect(formData.get('companyId')).toBe(ANDINOS.id);
    expect(formData.get('username')).toBe('pgil');
    expect(formData.get('documentTypeCode')).toBe(DOCUMENT_TYPE_CODES[0]);
  });

  it('R37: con exito y el correo enviado cierra, avisa y refresca', async () => {
    createAdministratorActionMock.mockResolvedValue({
      status: 'success',
      administratorId: 'a',
      mail: 'sent',
    });
    const user = await abrirAlta();
    await elegirEmpresa(user, VALLE);
    escribir();
    await enviar(user, createAdministratorActionMock);
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Administrador creado. Enviamos el enlace.'),
    );
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('administrator-sheet')).toBeNull());
  });

  it('R37: con exito pero sin correo cierra, refresca y avisa con el texto del fallo', async () => {
    createAdministratorActionMock.mockResolvedValue({
      status: 'success',
      administratorId: 'a',
      mail: 'failed',
    });
    const user = await abrirAlta();
    await elegirEmpresa(user, VALLE);
    escribir();
    await enviar(user, createAdministratorActionMock);
    await waitFor(() =>
      expect(toastMock.warning).toHaveBeenCalledWith(
        'Administrador creado, pero no pudimos enviar el correo.',
      ),
    );
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('administrator-sheet')).toBeNull());
  });

  it('R6: sin empresas.modificar no hay disparador ni panel', () => {
    render(<AdministratorCreateAction canModify={false} companies={COMPANIES} />);
    expect(screen.queryByTestId('administrator-create-open')).toBeNull();
    expect(screen.queryByText('Nuevo administrador')).toBeNull();
  });
});

describe('rechazos del alta', () => {
  it.each([
    ['duplicate_username', 'Ya existe un usuario con ese nombre de usuario.', 'username'],
    ['duplicate_email', 'Ya existe un usuario con ese correo en la empresa.', 'email'],
    ['duplicate_document', 'Ya existe un usuario con ese documento en la empresa.', 'documentNumber'],
  ] as const)(
    'R41: %s se pinta junto a su campo, con el panel abierto y lo escrito conservado',
    async (code, message, field) => {
      createAdministratorActionMock.mockResolvedValue(rechazo(code, message));
      const user = await abrirAlta();
      await elegirEmpresa(user, ANDINOS);
      escribir();
      await enviar(user, createAdministratorActionMock);
      expect(
        await screen.findByTestId(administratorFieldErrorTestId(ADMINISTRATOR_FIELD_PREFIX, field)),
      ).toHaveTextContent(message);
      expect(screen.queryByTestId('administrator-sheet-error')).toBeNull();
      expect(screen.getByTestId('administrator-sheet')).toBeInTheDocument();
      expect(campo('firstNames')).toHaveValue('Paula');
      expect(campo('username')).toHaveValue('pgil');
      expect(screen.getByTestId('administrator-company')).toHaveTextContent(ANDINOS.name);
      expect(new FormData(formulario()).get('documentTypeCode')).toBe(DOCUMENT_TYPE_CODES[0]);
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(routerMock.refresh).not.toHaveBeenCalled();
    },
  );

  it('el alta propone el nombre de usuario a partir de nombres y apellidos', async () => {
    const user = await abrirAlta();

    await user.type(campo('firstNames'), 'Paula Andrea');
    await user.type(campo('lastNames'), 'Gil');

    expect(campo('username')).toHaveValue('paulaag');
  });

  it('duplicate_username en el alta recomienda el siguiente nombre de usuario y el boton lo aplica', async () => {
    createAdministratorActionMock.mockResolvedValue(rechazo('duplicate_username', 'Ya existe.'));
    const user = await abrirAlta();
    await elegirEmpresa(user, ANDINOS);
    escribir();
    await enviar(user, createAdministratorActionMock);

    const ids = administratorUsernameSuggestionTestIds(ADMINISTRATOR_FIELD_PREFIX);
    await user.click(within(await screen.findByTestId(ids.suggestion)).getByTestId(ids.apply));

    expect(campo('username')).toHaveValue('pgil1');
    expect(screen.queryByTestId(ids.suggestion)).toBeNull();
  });

  it('R41: company_not_found va a la region de error del panel', async () => {
    createAdministratorActionMock.mockResolvedValue(
      rechazo('company_not_found', 'La empresa no existe.'),
    );
    const user = await abrirAlta();
    await elegirEmpresa(user, VALLE);
    escribir();
    await enviar(user, createAdministratorActionMock);
    const region = await screen.findByTestId('administrator-sheet-error');
    expect(region).toHaveTextContent('La empresa no existe.');
    expect(region).toHaveAttribute('data-code', 'company_not_found');
    expect(campo('lastNames')).toHaveValue('Gil');
  });

  it('R41: un error inesperado se pinta con su referencia', async () => {
    createAdministratorActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-9f8e',
    });
    const user = await abrirAlta();
    escribir();
    await enviar(user, createAdministratorActionMock);
    expect(await screen.findByTestId('administrator-sheet-error')).toHaveTextContent('req-9f8e');
    expect(screen.getByTestId('administrator-sheet')).toBeInTheDocument();
  });

  it('R7: unauthorized muestra el mensaje del catalogo en el panel, sin cerrarlo', async () => {
    createAdministratorActionMock.mockResolvedValue(
      rechazo('unauthorized', 'El actor no tiene permiso para realizar esta operacion.'),
    );
    const user = await abrirAlta();
    escribir();
    await enviar(user, createAdministratorActionMock);
    const region = await screen.findByTestId('administrator-sheet-error');
    expect(region).toHaveTextContent('El actor no tiene permiso para realizar esta operacion.');
    expect(region).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('administrator-sheet')).toBeInTheDocument();
  });
});

describe('el panel «Editar administrador»', () => {
  it('R38: carga la ficha y muestra sus datos, con la empresa fija y sin poder cambiarla', async () => {
    await abrirEdicion();
    expect(getAdministratorActionMock).toHaveBeenCalledWith(DETALLE.id);
    const panel = screen.getByTestId('administrator-sheet');
    expect(within(panel).getByRole('heading', { name: 'Editar administrador' })).toBeInTheDocument();
    expect(within(panel).getByTestId('administrator-company-fixed')).toHaveTextContent(VALLE.name);
    expect(screen.queryByTestId('administrator-company')).toBeNull();
    expect(formulario().querySelector('[name="companyId"]')).toBeNull();
    expect(campo('firstNames')).toHaveValue('Diana');
    expect(campo('email')).toHaveValue('dmejia@quimicosvalle.co');
    expect(campo('phone')).toHaveValue('3001234567');
    expect(campo('documentNumber')).toHaveValue('1020304050');
    expect(campo('username')).toHaveValue('dmejia');
    expect(new FormData(formulario()).get('birthDate')).toBe('1990-05-14');
    expect(screen.getByTestId('administrator-submit')).toHaveTextContent('Guardar');
  });

  it('R38: el FormData lleva el id y los ocho datos, y nunca la empresa', async () => {
    updateAdministratorActionMock.mockResolvedValue({ status: 'success' });
    const user = await abrirEdicion();
    fireEvent.change(campo('phone'), { target: { value: '3110000000' } });
    await enviar(user, updateAdministratorActionMock);
    const formData = updateAdministratorActionMock.mock.calls[0]![1];
    expect([...new Set(formData.keys())].sort()).toEqual(['id', ...ADMINISTRATOR_FIELD_NAMES].sort());
    expect(formData.get('id')).toBe(DETALLE.id);
    expect(formData.get('phone')).toBe('3110000000');
  });

  it('R38: al guardar con exito cierra, avisa «Administrador actualizado.» y refresca', async () => {
    updateAdministratorActionMock.mockResolvedValue({ status: 'success' });
    const onOpenChange = vi.fn();
    getAdministratorActionMock.mockResolvedValue({ status: 'success', data: DETALLE });
    const user = setupUser();
    render(
      <AdministratorSheet mode="edit" administratorId={DETALLE.id} open onOpenChange={onOpenChange} />,
    );
    await screen.findByTestId('administrator-form');
    await enviar(user, updateAdministratorActionMock);
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Administrador actualizado.'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('la edicion no propone el nombre de usuario ni lo recomienda tras duplicate_username', async () => {
    updateAdministratorActionMock.mockResolvedValue(rechazo('duplicate_username', 'Ya existe.'));
    const user = await abrirEdicion();

    await user.type(campo('firstNames'), ' Jose');
    expect(campo('username')).toHaveValue('dmejia');

    await enviar(user, updateAdministratorActionMock);
    await screen.findByTestId(administratorFieldErrorTestId(ADMINISTRATOR_FIELD_PREFIX, 'username'));
    expect(
      screen.queryByTestId(
        administratorUsernameSuggestionTestIds(ADMINISTRATOR_FIELD_PREFIX).suggestion,
      ),
    ).toBeNull();
  });

  it('R41: un duplicado en la edicion va junto a su campo con lo escrito conservado', async () => {
    updateAdministratorActionMock.mockResolvedValue(
      rechazo('duplicate_email', 'Ya existe un usuario con ese correo en la empresa.'),
    );
    const user = await abrirEdicion();
    fireEvent.change(campo('email'), { target: { value: 'otra@quimicosvalle.co' } });
    await enviar(user, updateAdministratorActionMock);
    expect(
      await screen.findByTestId(administratorFieldErrorTestId(ADMINISTRATOR_FIELD_PREFIX, 'email')),
    ).toHaveTextContent('Ya existe un usuario con ese correo en la empresa.');
    expect(campo('email')).toHaveValue('otra@quimicosvalle.co');
    expect(screen.getByTestId('administrator-company-fixed')).toHaveTextContent(VALLE.name);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('R38: si la ficha no carga, el panel muestra la region de error', async () => {
    getAdministratorActionMock.mockResolvedValue(rechazo('user_not_found', 'El usuario no existe.'));
    render(
      <AdministratorSheet mode="edit" administratorId={DETALLE.id} open onOpenChange={vi.fn()} />,
    );
    expect(screen.getByTestId('administrator-sheet-loading')).toBeInTheDocument();
    const region = await screen.findByTestId('administrator-sheet-error');
    expect(region).toHaveTextContent('El usuario no existe.');
    expect(screen.queryByTestId('administrator-form')).toBeNull();
  });
});
