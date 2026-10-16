// El alta de empresa con su Administrador inicial. La Server Action está simulada: es el borde del
// módulo; lo que se afirma es el `FormData` que recibe y lo que la pantalla hace con su respuesta.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMPANY_CREATE_ADMIN_PREFIX,
  COMPANY_CREATE_FIELD_PREFIX,
  CompanyCreateAction,
  companyFieldErrorTestId,
  companyFieldTestId,
} from '@/app/(private)/maestro/empresas/components';
import {
  administratorFieldErrorTestId,
  administratorFieldTestId,
} from '@/components/shared/administrator-fields';
import type { ErrorState } from '@/lib/modules/errores';
import { DOCUMENT_TYPE_CODES } from '@/lib/modules/identity';

import { setupUser } from '../../helpers/user-event';

const { routerMock, createCompanyActionMock, toastMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  createCompanyActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  createCompanyAction: createCompanyActionMock,
  listCompaniesAction: vi.fn(),
  getCompanyAction: vi.fn(),
  getCompanyDeletionImpactAction: vi.fn(),
  listCompanyEventsAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  setCompanyCountryAction: vi.fn(),
  deleteCompanyAction: vi.fn(),
  reactivateCompanyAction: vi.fn(),
}));

const DOCE_NOMBRES = [
  'name',
  'taxId',
  'contactEmail',
  'contactPhone',
  'adminFirstNames',
  'adminLastNames',
  'adminBirthDate',
  'adminEmail',
  'adminPhone',
  'adminDocumentTypeCode',
  'adminDocumentNumber',
  'adminUsername',
];

function campoEmpresa(field: Parameters<typeof companyFieldTestId>[1]): HTMLInputElement {
  return screen.getByTestId(companyFieldTestId(COMPANY_CREATE_FIELD_PREFIX, field)) as HTMLInputElement;
}

function campoAdmin(field: Parameters<typeof administratorFieldTestId>[1]): HTMLInputElement {
  return screen.getByTestId(
    administratorFieldTestId(COMPANY_CREATE_ADMIN_PREFIX, field),
  ) as HTMLInputElement;
}

async function abrir() {
  const user = setupUser();
  render(<CompanyCreateAction canModify />);
  await user.click(screen.getByTestId('company-create-open'));
  await screen.findByTestId('company-create-sheet');
  return user;
}

function escribir() {
  fireEvent.change(campoEmpresa('name'), { target: { value: 'Aseo Caribe' } });
  fireEvent.change(campoEmpresa('taxId'), { target: { value: '900.123.456-7' } });
  fireEvent.change(campoAdmin('firstNames'), { target: { value: 'Paula' } });
  fireEvent.change(campoAdmin('lastNames'), { target: { value: 'Gil' } });
  fireEvent.change(campoAdmin('email'), { target: { value: 'gerencia@aseocaribe.co' } });
  fireEvent.change(campoAdmin('documentNumber'), { target: { value: '1020304050' } });
  fireEvent.change(campoAdmin('username'), { target: { value: 'pgil' } });
}

async function enviar(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByTestId('company-create-submit'));
  await waitFor(() => expect(createCompanyActionMock).toHaveBeenCalled());
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

describe('el panel «Nueva empresa»', () => {
  it('R17: abre con las secciones Empresa y Administrador inicial, el aviso y los botones', async () => {
    await abrir();
    const panel = screen.getByTestId('company-create-sheet');
    expect(within(panel).getByRole('heading', { name: 'Nueva empresa' })).toBeInTheDocument();
    const empresa = within(panel).getByRole('region', { name: 'Empresa' });
    const admin = within(panel).getByRole('region', { name: 'Administrador inicial' });
    for (const etiqueta of ['Nombre', 'Identificación fiscal', 'Correo de contacto', 'Teléfono de contacto']) {
      expect(within(empresa).getByLabelText(new RegExp(`^${etiqueta}\\*?$`))).toBeInTheDocument();
    }
    for (const etiqueta of ['Nombres', 'Apellidos', 'Correo', 'Teléfono', 'Número de documento', 'Nombre de usuario']) {
      expect(within(admin).getByLabelText(new RegExp(`^${etiqueta}`))).toBeInTheDocument();
    }
    expect(within(admin).getByText('Fecha de nacimiento')).toBeInTheDocument();
    expect(within(admin).getByText('Tipo de documento')).toBeInTheDocument();
    expect(within(panel).getByTestId('company-create-mail-notice')).toHaveTextContent(
      'Le llegará un correo con un enlace para fijar su contraseña.',
    );
    expect(screen.getByTestId('company-create-cancel')).toHaveTextContent('Cancelar');
    expect(screen.getByTestId('company-create-submit')).toHaveTextContent('Crear empresa');
  });

  it('R17: el panel no pide pais ni rol', async () => {
    await abrir();
    const panel = screen.getByTestId('company-create-sheet');
    expect(within(panel).queryByText(/País/)).toBeNull();
    expect(within(panel).queryByText(/Rol/)).toBeNull();
    expect(panel.querySelector('[name="country"]')).toBeNull();
  });

  it('R17: el FormData lleva exactamente los doce nombres de la accion', async () => {
    createCompanyActionMock.mockResolvedValue({
      status: 'success',
      companyId: 'c',
      administratorId: 'a',
      mail: 'sent',
    });
    const user = await abrir();
    escribir();
    await enviar(user);
    const formData = createCompanyActionMock.mock.calls[0]![1];
    expect([...new Set(formData.keys())].sort()).toEqual([...DOCE_NOMBRES].sort());
    expect(formData.get('name')).toBe('Aseo Caribe');
    expect(formData.get('adminUsername')).toBe('pgil');
  });

  it('R17: sin tocar el tipo de documento, el FormData lleva el de partida', async () => {
    createCompanyActionMock.mockResolvedValue({
      status: 'success',
      companyId: 'c',
      administratorId: 'a',
      mail: 'sent',
    });
    const user = await abrir();
    escribir();
    await enviar(user);
    const formData = createCompanyActionMock.mock.calls[0]![1];
    expect(formData.get('adminDocumentTypeCode')).toBe(DOCUMENT_TYPE_CODES[0]);
  });

  it('R6: sin empresas.modificar no hay disparador ni panel', () => {
    render(<CompanyCreateAction canModify={false} />);
    expect(screen.queryByTestId('company-create-open')).toBeNull();
    expect(screen.queryByText('Nueva empresa')).toBeNull();
  });
});

describe('al terminar', () => {
  it('R18: con exito y el correo enviado cierra, avisa y refresca la lista', async () => {
    createCompanyActionMock.mockResolvedValue({
      status: 'success',
      companyId: 'c',
      administratorId: 'a',
      mail: 'sent',
    });
    const user = await abrir();
    escribir();
    await enviar(user);
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(
        'Empresa creada. Enviamos el enlace al Administrador.',
      ),
    );
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('company-create-sheet')).toBeNull());
  });

  it('R18: con exito pero sin correo cierra, refresca y avisa con el texto del fallo', async () => {
    createCompanyActionMock.mockResolvedValue({
      status: 'success',
      companyId: 'c',
      administratorId: 'a',
      mail: 'failed',
    });
    const user = await abrir();
    escribir();
    await enviar(user);
    await waitFor(() =>
      expect(toastMock.warning).toHaveBeenCalledWith(
        'Empresa creada, pero no pudimos enviar el correo al Administrador.',
      ),
    );
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('company-create-sheet')).toBeNull());
  });
});

describe('rechazos', () => {
  it.each([
    ['company_duplicate_name', 'Ya existe una empresa activa con ese nombre.', 'empresa', 'name'],
    ['company_duplicate_tax_id', 'Ya existe una empresa activa con esa identificación fiscal.', 'empresa', 'taxId'],
    ['duplicate_username', 'Ya existe un usuario con ese nombre de usuario.', 'admin', 'username'],
    ['duplicate_email', 'Ya existe un usuario con ese correo en la empresa.', 'admin', 'email'],
    ['duplicate_document', 'Ya existe un usuario con ese documento en la empresa.', 'admin', 'documentNumber'],
  ] as const)(
    'R19: %s se pinta junto a su campo, con el panel abierto y lo escrito conservado',
    async (code, message, grupo, campo) => {
      createCompanyActionMock.mockResolvedValue(rechazo(code, message));
      const user = await abrir();
      escribir();
      await enviar(user);
      const errorTestId =
        grupo === 'empresa'
          ? companyFieldErrorTestId(COMPANY_CREATE_FIELD_PREFIX, campo as 'name' | 'taxId')
          : administratorFieldErrorTestId(
              COMPANY_CREATE_ADMIN_PREFIX,
              campo as 'username' | 'email' | 'documentNumber',
            );
      expect(await screen.findByTestId(errorTestId)).toHaveTextContent(message);
      expect(screen.queryByTestId('company-create-error')).toBeNull();
      expect(screen.getByTestId('company-create-sheet')).toBeInTheDocument();
      expect(campoEmpresa('name')).toHaveValue('Aseo Caribe');
      expect(campoEmpresa('taxId')).toHaveValue('900.123.456-7');
      expect(campoAdmin('username')).toHaveValue('pgil');
      expect(campoAdmin('email')).toHaveValue('gerencia@aseocaribe.co');
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(routerMock.refresh).not.toHaveBeenCalled();
    },
  );

  it('R19: un codigo sin campo va a la region de error del panel', async () => {
    createCompanyActionMock.mockResolvedValue(rechazo('invalid_input', 'Los datos no son validos.'));
    const user = await abrir();
    escribir();
    await enviar(user);
    const region = await screen.findByTestId('company-create-error');
    expect(region).toHaveTextContent('Los datos no son validos.');
    expect(region).toHaveAttribute('data-code', 'invalid_input');
    expect(campoAdmin('firstNames')).toHaveValue('Paula');
  });

  it('R19: un error inesperado se pinta con su referencia', async () => {
    createCompanyActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-9f8e',
    });
    const user = await abrir();
    escribir();
    await enviar(user);
    expect(await screen.findByTestId('company-create-error')).toHaveTextContent('req-9f8e');
    expect(screen.getByTestId('company-create-sheet')).toBeInTheDocument();
  });

  it('R7: unauthorized muestra el mensaje del catalogo en el panel, sin cerrarlo', async () => {
    createCompanyActionMock.mockResolvedValue(
      rechazo('unauthorized', 'El actor no tiene permiso para realizar esta operacion.'),
    );
    const user = await abrir();
    escribir();
    await enviar(user);
    const region = await screen.findByTestId('company-create-error');
    expect(region).toHaveTextContent('El actor no tiene permiso para realizar esta operacion.');
    expect(region).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('company-create-sheet')).toBeInTheDocument();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
