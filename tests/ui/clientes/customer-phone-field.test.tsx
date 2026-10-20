// El campo Teléfono del formulario de cliente: país + número.
//
// Se monta dentro de `CustomerSheet` con el esquema real del contrato; solo las Server Actions son
// el doble. Los textos con formato salen de las funciones del dominio, no se escriben a mano.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { getExampleNumber, type CountryCode } from 'libphonenumber-js';
import mobileExamples from 'libphonenumber-js/mobile/examples';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CUSTOMER_CREATE_OPEN_TESTID,
  CUSTOMER_ERROR_TESTIDS,
  CUSTOMER_FIELD_TESTIDS,
  CUSTOMER_FORM_ERROR_TESTID,
  CUSTOMER_FORM_SUBMIT_TESTID,
  CUSTOMER_FORM_TESTID,
  CUSTOMER_PHONE_ISSUE_TESTID,
  CustomerSheet,
} from '@/app/(private)/clientes/components';
import {
  CustomerDuplicatePhoneError,
  CustomerPhoneCountryRequiredError,
  CustomerPhoneInvalidError,
  formatPhoneNational,
  type CustomerView,
} from '@/lib/modules/clientes';
import type {
  CreateCustomerFormState,
  CustomerMutationFormState,
} from '@/lib/modules/clientes/adapters/driving/customer-actions';
import { setupUser } from '../../helpers/user-event';
import { resetViewport, setViewportWidth } from '../../helpers/viewport';

const { createCustomerActionMock, updateCustomerActionMock } = vi.hoisted(() => ({
  createCustomerActionMock:
    vi.fn<(prev: CreateCustomerFormState, data: FormData) => Promise<CreateCustomerFormState>>(),
  updateCustomerActionMock:
    vi.fn<
      (
        id: string,
        prev: CustomerMutationFormState,
        data: FormData,
      ) => Promise<CustomerMutationFormState>
    >(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/modules/clientes/adapters/driving/customer-actions', () => ({
  createCustomerAction: createCustomerActionMock,
  updateCustomerAction: updateCustomerActionMock,
  deleteCustomerAction: vi.fn(),
  getCustomerAction: vi.fn(),
  listCustomersAction: vi.fn(),
}));

const DESKTOP = 1024;
const PHONE = 390;

const COUNTRY_REQUIRED = new CustomerPhoneCountryRequiredError();
const PHONE_INVALID = new CustomerPhoneInvalidError();
const DUPLICATE = new CustomerDuplicatePhoneError();

const E164 = '573001234567';
const NATIONAL = formatPhoneNational(E164, 'CO');
const INVALID_FOR_CO = 'Este número no es válido para Colombia (+57).';

const BASE: CustomerView = {
  id: crypto.randomUUID(),
  firstNames: 'Ana María',
  lastNames: 'Pérez Gómez',
  city: 'Bogotá',
  phone: null,
  phoneCountry: null,
  phoneE164: null,
  phoneIssue: null,
  email: null,
  address: null,
  createdBy: null,
  updatedBy: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const VALID: CustomerView = {
  ...BASE,
  phone: '+57 300 1234567',
  phoneCountry: 'CO',
  phoneE164: E164,
};

const MIGRATED_INVALID: CustomerView = {
  ...BASE,
  phone: 'ext 204 oficina',
  phoneCountry: 'CO',
  phoneIssue: 'invalid_format',
};

const MIGRATED_DUPLICATE: CustomerView = {
  ...BASE,
  phone: '300 123 4567',
  phoneCountry: 'CO',
  phoneIssue: 'duplicate',
};

const PENDING_LEGACY: CustomerView = {
  ...BASE,
  phone: '300-123-4567 casa',
};

const exampleNational = (country: CountryCode) =>
  getExampleNumber(country, mobileExamples)!.formatNational();

const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(DESKTOP);
  createCustomerActionMock.mockResolvedValue({ status: 'success', id: crypto.randomUUID() });
  updateCustomerActionMock.mockResolvedValue({ status: 'success' });
});

afterEach(() => {
  cleanup();
  resetViewport();
});

const countryTrigger = () => screen.getByTestId(CUSTOMER_FIELD_TESTIDS.phoneCountry);
const numberInput = () =>
  screen.getByTestId(CUSTOMER_FIELD_TESTIDS.phoneNumber) as HTMLInputElement;
const hiddenCountry = () =>
  screen
    .getByTestId(CUSTOMER_FORM_TESTID)
    .querySelector<HTMLInputElement>('input[type="hidden"][name="phoneCountry"]');

async function openCreate(user: ReturnType<typeof setupUser>, companyCountry: CountryCode | null) {
  render(<CustomerSheet companyCountry={companyCountry} />);
  await user.click(screen.getByTestId(CUSTOMER_CREATE_OPEN_TESTID));
  await screen.findByTestId(CUSTOMER_FORM_TESTID);
}

async function openEdit(customer: CustomerView, companyCountry: CountryCode | null = 'CO') {
  render(
    <CustomerSheet customer={customer} open onOpenChange={() => {}} companyCountry={companyCountry} />,
  );
  await screen.findByTestId(CUSTOMER_FORM_TESTID);
}

async function fillRequired(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByTestId(CUSTOMER_FIELD_TESTIDS.firstNames), 'Luis');
  await user.type(screen.getByTestId(CUSTOMER_FIELD_TESTIDS.lastNames), 'Rodríguez');
  await user.type(screen.getByTestId(CUSTOMER_FIELD_TESTIDS.city), 'Cali');
}

function sentCreate(): FormData {
  return createCustomerActionMock.mock.calls[0]![1];
}

function sentUpdate(): FormData {
  return updateCustomerActionMock.mock.calls[0]![2];
}

describe('CustomerPhoneField · estructura', () => {
  it('R1 — un grupo «Teléfono» con el selector «País del teléfono» y el número «Número de teléfono», opcional', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    const group = screen.getByRole('group', { name: 'Teléfono' });
    expect(within(group).getByTestId(CUSTOMER_FIELD_TESTIDS.phoneCountry)).toHaveAccessibleName(
      'País del teléfono',
    );
    const number = within(group).getByRole('textbox', { name: 'Número de teléfono' });
    expect(number).toBe(numberInput());
    expect(number).toHaveAttribute('type', 'tel');
    expect(number).toHaveAttribute('inputmode', 'tel');
    expect(number).toHaveAttribute('autocomplete', 'tel-national');
    expect(number).not.toBeRequired();
    expect(number).toHaveAttribute('aria-required', 'false');
  });
});

describe('CustomerPhoneField · valor inicial', () => {
  it('R2 — en el alta con país de empresa, ese país viene marcado', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    expect(countryTrigger()).toHaveTextContent('Colombia');
    expect(hiddenCountry()).toHaveValue('CO');
    expect(numberInput()).toHaveValue('');
  });

  it('R3 — en el alta sin país de empresa, el selector queda en «Sin país»', async () => {
    const user = setupUser();
    await openCreate(user, null);

    expect(countryTrigger()).toHaveTextContent('Sin país');
    expect(hiddenCountry()).toHaveValue('');
  });

  it('R4 — la edición de un cliente con phone_e164 muestra su país y el número en formato nacional', async () => {
    await openEdit(VALID, 'EC');

    expect(countryTrigger()).toHaveTextContent('Colombia');
    expect(hiddenCountry()).toHaveValue('CO');
    expect(numberInput()).toHaveValue(NATIONAL);
  });

  it('R35 — la edición de un cliente sin phone_country abre con el país de la empresa marcado y el número vacío', async () => {
    await openEdit(BASE, 'EC');

    expect(countryTrigger()).toHaveTextContent('Ecuador');
    expect(hiddenCountry()).toHaveValue('EC');
    expect(numberInput()).toHaveValue('');
  });

  it('R4 — en la edición, un phone_country propio distinto al de la empresa se conserva', async () => {
    await openEdit({ ...BASE, phoneCountry: 'CO' }, 'EC');

    expect(countryTrigger()).toHaveTextContent('Colombia');
    expect(hiddenCountry()).toHaveValue('CO');
  });

  it('R31 — un migrado con aviso conserva su país aunque la empresa tenga otro', async () => {
    await openEdit(MIGRATED_INVALID, 'EC');

    expect(countryTrigger()).toHaveTextContent('Colombia');
    expect(hiddenCountry()).toHaveValue('CO');
    expect(numberInput()).toHaveValue('');
  });

  it('R35 — la edición de un cliente sin phone_country, en una empresa sin país, abre en «Sin país»', async () => {
    await openEdit(BASE, null);

    expect(countryTrigger()).toHaveTextContent('Sin país');
    expect(hiddenCountry()).toHaveValue('');
  });

  it('R5 — con país de empresa, la lista abre con el grupo «País de la empresa» arriba', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    await user.click(countryTrigger());
    const listbox = await screen.findByRole('listbox');
    const [pinned] = within(listbox).getAllByRole('group');
    expect(pinned).toHaveAccessibleName('País de la empresa');
    expect(within(pinned!).getByRole('option')).toHaveTextContent('Colombia');
  });
});

describe('CustomerPhoneField · placeholder', () => {
  it('R33 — el número lleva de placeholder el ejemplo del país elegido en formato nacional', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    expect(numberInput()).toHaveAttribute('placeholder', exampleNational('CO'));

    await user.click(numberInput());
    await user.paste('+593 99 123 4567');
    await waitFor(() => expect(hiddenCountry()).toHaveValue('EC'));
    expect(numberInput()).toHaveAttribute('placeholder', exampleNational('EC'));
  });

  it('R33 — sin país elegido el número no lleva placeholder', async () => {
    const user = setupUser();
    await openCreate(user, null);

    expect(numberInput()).not.toHaveAttribute('placeholder');
  });
});

describe('CustomerPhoneField · formato y país al escribir', () => {
  it('R6 — mientras se escribe no se reformatea; al salir del campo queda en formato nacional', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    await user.type(numberInput(), '3001234567');
    expect(numberInput()).toHaveValue('3001234567');

    await user.tab();
    expect(numberInput()).toHaveValue(NATIONAL);
  });

  it('R7 — pegar un número con +593 marca Ecuador en el selector', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    await user.click(numberInput());
    await user.paste('+593 99 123 4567');

    await waitFor(() => expect(hiddenCountry()).toHaveValue('EC'));
    expect(countryTrigger()).toHaveTextContent('Ecuador');
  });

  it('R7 — escribir un número con + y salir del campo marca su país y lo deja en formato nacional', async () => {
    const user = setupUser();
    await openCreate(user, null);

    await user.type(numberInput(), `+${E164}`);
    await user.tab();

    expect(hiddenCountry()).toHaveValue('CO');
    expect(numberInput()).toHaveValue(NATIONAL);
  });

  it('R7 — un prefijo que no identifica un único país deja el selector como estaba', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    await user.click(numberInput());
    await user.paste('+1');

    expect(hiddenCountry()).toHaveValue('CO');
  });
});

describe('CustomerPhoneField · errores', () => {
  it('R8 — número sin país: no se guarda y «Elige el país del teléfono.» queda enlazado al selector', async () => {
    const user = setupUser();
    await openCreate(user, null);
    await fillRequired(user);

    await user.type(numberInput(), '3001234567');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    const error = await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneCountry);
    expect(error).toHaveTextContent(COUNTRY_REQUIRED.message);
    expect(countryTrigger()).toHaveAttribute('aria-invalid', 'true');
    expect(countryTrigger()).toHaveAttribute('aria-describedby', error.id);
    expect(createCustomerActionMock).not.toHaveBeenCalled();
  });

  it('R8 — el código customer_phone_country_required del servidor se pinta bajo el selector', async () => {
    const user = setupUser();
    createCustomerActionMock.mockResolvedValue({
      status: 'error',
      code: COUNTRY_REQUIRED.code,
      message: COUNTRY_REQUIRED.message,
    });
    await openCreate(user, 'CO');
    await fillRequired(user);
    await user.type(numberInput(), '3001234567');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    expect(await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneCountry)).toHaveTextContent(
      COUNTRY_REQUIRED.message,
    );
    expect(screen.queryByTestId(CUSTOMER_FORM_ERROR_TESTID)).toBeNull();
  });

  it('R9 — un número no válido para Colombia da el error al salir del campo, enlazado al número', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    await user.type(numberInput(), '300 12');
    await user.tab();

    const error = await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber);
    expect(error).toHaveTextContent(INVALID_FOR_CO);
    expect(numberInput()).toHaveAttribute('aria-invalid', 'true');
    expect(numberInput()).toHaveAttribute('aria-describedby', error.id);
    expect(numberInput()).toHaveValue('300 12');
  });

  it('R9 — el error del número va bajo toda la fila, con su icono y la animación de entrada', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');

    await user.type(numberInput(), '300 12');
    await user.tab();

    const error = await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber);
    const group = screen.getByRole('group', { name: 'Teléfono' });
    expect(group).not.toContainElement(error);
    expect(group.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(error.parentElement).toBe(group.parentElement);
    expect(error).toHaveAttribute('role', 'alert');
    expect(error.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    const message = error.firstElementChild!;
    expect(message).toHaveClass('motion-safe:animate-in');
    expect(message).toHaveClass('motion-safe:slide-in-from-top-1');
    expect(screen.getAllByText(INVALID_FOR_CO)).toHaveLength(1);
  });

  it('R8 — el error del país también va bajo toda la fila, con su icono y la animación de entrada', async () => {
    const user = setupUser();
    await openCreate(user, null);
    await fillRequired(user);

    await user.type(numberInput(), '3001234567');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    const error = await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneCountry);
    const group = screen.getByRole('group', { name: 'Teléfono' });
    expect(group).not.toContainElement(error);
    expect(error.parentElement).toBe(group.parentElement);
    expect(error.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(error.firstElementChild).toHaveClass('motion-safe:animate-in');
  });

  it('R9 — al guardar un número no válido no se llama a la operación y se pinta el error con el país', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');
    await fillRequired(user);

    await user.type(numberInput(), '300 12');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    expect(await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber)).toHaveTextContent(
      INVALID_FOR_CO,
    );
    expect(createCustomerActionMock).not.toHaveBeenCalled();
  });

  it('R9 — el código customer_phone_invalid del servidor se pinta bajo el número con el país elegido', async () => {
    const user = setupUser();
    createCustomerActionMock.mockResolvedValue({
      status: 'error',
      code: PHONE_INVALID.code,
      message: PHONE_INVALID.message,
    });
    await openCreate(user, 'CO');
    await fillRequired(user);
    await user.type(numberInput(), '3001234567');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    expect(await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber)).toHaveTextContent(
      INVALID_FOR_CO,
    );
  });

  it('R12 — customer_duplicate_phone del servidor se pinta bajo el número, no en la región general', async () => {
    const user = setupUser();
    createCustomerActionMock.mockResolvedValue({
      status: 'error',
      code: DUPLICATE.code,
      message: DUPLICATE.message,
    });
    await openCreate(user, 'CO');
    await fillRequired(user);
    await user.type(numberInput(), '3001234567');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    const error = await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber);
    expect(error).toHaveTextContent('Este teléfono ya está registrado en otro cliente.');
    expect(numberInput()).toHaveAttribute('aria-describedby', error.id);
    expect(screen.queryByTestId(CUSTOMER_FORM_ERROR_TESTID)).toBeNull();
    expect(numberInput()).toHaveValue(NATIONAL);
  });

  it('R12 — el duplicado sigue a la vista si se sale del número sin cambiarlo', async () => {
    const user = setupUser();
    createCustomerActionMock.mockResolvedValue({
      status: 'error',
      code: DUPLICATE.code,
      message: DUPLICATE.message,
    });
    await openCreate(user, 'CO');
    await fillRequired(user);
    await user.type(numberInput(), '3001234567');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));
    await screen.findByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber);

    await user.click(numberInput());
    await user.tab();

    expect(screen.getByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber)).toHaveTextContent(
      DUPLICATE.message,
    );
  });
});

describe('CustomerPhoneField · lo que se envía', () => {
  it('R10 — con el número vacío y un país marcado se guarda sin error y el número viaja vacío', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');
    await fillRequired(user);
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(createCustomerActionMock).toHaveBeenCalledTimes(1));
    expect(sentCreate().get('phoneNumber')).toBe('');
    expect(sentCreate().get('phoneCountry')).toBe('CO');
    expect(sentCreate().has('phone')).toBe(false);
  });

  it('R11 — un número válido viaja como phoneCountry y phoneNumber', async () => {
    const user = setupUser();
    await openCreate(user, 'CO');
    await fillRequired(user);
    await user.type(numberInput(), '3001234567');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(createCustomerActionMock).toHaveBeenCalledTimes(1));
    expect(sentCreate().get('phoneCountry')).toBe('CO');
    expect(sentCreate().get('phoneNumber')).toBe(NATIONAL);
  });
});

describe('CustomerPhoneField · clientes migrados', () => {
  it('R31 — sin formato válido: número vacío, su país marcado, la etiqueta larga y el texto de ayuda', async () => {
    await openEdit(MIGRATED_INVALID);

    expect(numberInput()).toHaveValue('');
    expect(hiddenCountry()).toHaveValue('CO');
    const issue = screen.getByTestId(CUSTOMER_PHONE_ISSUE_TESTID);
    expect(issue).toHaveTextContent('Teléfono sin formato válido');
    expect(issue).toHaveTextContent(
      'Antes: ext 204 oficina. Escribe un número válido para reemplazarlo; si lo dejas vacío, se conserva.',
    );
    expect(screen.getByRole('group', { name: 'Teléfono' })).toHaveAccessibleDescription(
      /si lo dejas vacío, se conserva\.$/,
    );
  });

  it('R31 — duplicado: la etiqueta larga y el texto de ayuda del duplicado', async () => {
    await openEdit(MIGRATED_DUPLICATE);

    const issue = screen.getByTestId(CUSTOMER_PHONE_ISSUE_TESTID);
    expect(issue).toHaveTextContent('Teléfono duplicado: revisar');
    expect(issue).toHaveTextContent(
      'Antes: 300 123 4567, que ya tiene otro cliente. Escribe otro número para reemplazarlo; si lo dejas vacío, se conserva.',
    );
  });

  it('R36, R35 — un cliente pendiente de relleno abre con el número vacío, sin etiqueta y con la ayuda de que se conserva', async () => {
    await openEdit(PENDING_LEGACY, 'CO');

    expect(numberInput()).toHaveValue('');
    expect(hiddenCountry()).toHaveValue('CO');
    expect(screen.queryByTestId(CUSTOMER_PHONE_ISSUE_TESTID)).toBeNull();
    const group = screen.getByRole('group', { name: 'Teléfono' });
    expect(group).toHaveAccessibleDescription(
      'Antes: 300-123-4567 casa. Escribe un número para reemplazarlo; si lo dejas vacío, se conserva.',
    );
    expect(within(group.parentElement!).getByText('300-123-4567 casa')).toHaveClass('font-mono');
  });

  it('R36 — guardar un cliente pendiente de relleno con el número vacío manda phoneNumber vacío sin errores', async () => {
    const user = setupUser();
    await openEdit(PENDING_LEGACY, 'CO');

    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateCustomerActionMock).toHaveBeenCalledTimes(1));
    expect(sentUpdate().get('phoneNumber')).toBe('');
    expect(screen.queryByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber)).toBeNull();
  });

  it('R31 — un cliente sin aviso no muestra etiqueta', async () => {
    await openEdit(VALID);
    expect(screen.queryByTestId(CUSTOMER_PHONE_ISSUE_TESTID)).toBeNull();
  });

  it('R34 — guardar un migrado con el número vacío manda phoneNumber vacío y no pinta ningún error', async () => {
    const user = setupUser();
    await openEdit(MIGRATED_INVALID);

    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateCustomerActionMock).toHaveBeenCalledTimes(1));
    expect(sentUpdate().get('phoneNumber')).toBe('');
    expect(screen.queryByTestId(CUSTOMER_ERROR_TESTIDS.phoneNumber)).toBeNull();
    expect(screen.queryByTestId(CUSTOMER_ERROR_TESTIDS.phoneCountry)).toBeNull();
    expect(screen.queryByTestId(CUSTOMER_FORM_ERROR_TESTID)).toBeNull();
  });

  it('R32 — guardar un migrado con un número válido lo manda para reemplazar el antiguo', async () => {
    const user = setupUser();
    await openEdit(MIGRATED_DUPLICATE);

    await user.type(numberInput(), '3001234567');
    await user.click(screen.getByTestId(CUSTOMER_FORM_SUBMIT_TESTID));

    await waitFor(() => expect(updateCustomerActionMock).toHaveBeenCalledTimes(1));
    expect(sentUpdate().get('phoneCountry')).toBe('CO');
    expect(sentUpdate().get('phoneNumber')).toBe(NATIONAL);
  });
});

describe('CustomerPhoneField · teléfono', () => {
  it('R33 — a 390 px el país es compacto (CO +57, nombre en aria-label), el país y el número miden 48 px y el número lleva letra de 16 px', async () => {
    setViewportWidth(PHONE);
    const user = setupUser();
    await openCreate(user, 'CO');

    await waitFor(() => expect(countryTrigger()).toHaveTextContent('CO +57'));
    expect(countryTrigger()).toHaveAccessibleName(/^País del teléfono: Colombia$/);
    expect(numberInput().className).toContain('max-lg:min-h-12');
    expect(numberInput().className).toContain('text-base');
    expect(numberInput().className).toContain('min-h-11');
    expect(countryTrigger()).toHaveClass('max-lg:h-12');

    await user.click(countryTrigger());
    expect(await screen.findByRole('dialog', { name: 'País del teléfono' })).toBeInTheDocument();
  });
});
