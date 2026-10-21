'use client';

import { useActionState, useEffect, useId, useMemo } from 'react';
import type { CountryCode } from 'libphonenumber-js';

import { ErrorAlert } from '@/components/shared/error-alert';
import { FormSheet } from '@/components/shared/form-sheet';
import { TextField } from '@/components/shared/text-field';
import { errorMessage, type ErrorCode, type ErrorState } from '@/lib/modules/errores';
import {
  createCustomerSchema,
  CUSTOMER_FIRST_NAMES_MAX_LENGTH,
  CUSTOMER_LAST_NAMES_MAX_LENGTH,
  CUSTOMER_CITY_MAX_LENGTH,
  CUSTOMER_PHONE_MAX_LENGTH,
  CUSTOMER_EMAIL_MAX_LENGTH,
  CUSTOMER_ADDRESS_MAX_LENGTH,
  type CustomerView,
} from '@/lib/modules/clientes';
import {
  createCustomerAction,
  updateCustomerAction,
} from '@/lib/modules/clientes/adapters/driving/customer-actions';

import {
  CUSTOMER_PHONE_COUNTRY_FIELD,
  CUSTOMER_PHONE_NUMBER_FIELD,
  CustomerPhoneField,
  phoneNumberInvalidMessage,
  type CustomerPhoneFieldErrors,
} from './customer-phone-field';

/**
 * Formulario de alta y edicion de cliente.
 *
 * `<form action>` no controlado + `useActionState`, con `{ status: 'idle' }` construido aqui
 * porque un archivo `'use server'` solo puede exportar funciones async.
 *
 * La validacion previa usa el MISMO esquema que valida el servidor (`createCustomerSchema`, del
 * barrel publico de `clientes`), asi que los largos y la obligatoriedad no se reescriben aqui.
 * El servidor revalida igual: el cliente nunca es la frontera.
 *
 * Los rechazos del telefono se pintan bajo su campo; el resto de lo que devuelve la operacion va
 * a la region general del formulario.
 *
 * `bind` y no un argumento de mas: `updateCustomerAction` tiene la firma
 * `(id, prevState, formData)`, que no es la que `useActionState` espera.
 */

export const CUSTOMER_FIRST_NAMES_FIELD = 'firstNames';
export const CUSTOMER_LAST_NAMES_FIELD = 'lastNames';
export const CUSTOMER_CITY_FIELD = 'city';
export const CUSTOMER_EMAIL_FIELD = 'email';
export const CUSTOMER_ADDRESS_FIELD = 'address';

/** Fuente unica de los campos de negocio que viajan en el formulario. */
export const CUSTOMER_BUSINESS_FIELDS = [
  CUSTOMER_FIRST_NAMES_FIELD,
  CUSTOMER_LAST_NAMES_FIELD,
  CUSTOMER_CITY_FIELD,
  CUSTOMER_PHONE_COUNTRY_FIELD,
  CUSTOMER_PHONE_NUMBER_FIELD,
  CUSTOMER_EMAIL_FIELD,
  CUSTOMER_ADDRESS_FIELD,
] as const;

const TEXT_FIELDS_BEFORE_PHONE = [
  CUSTOMER_FIRST_NAMES_FIELD,
  CUSTOMER_LAST_NAMES_FIELD,
  CUSTOMER_CITY_FIELD,
] as const;
const TEXT_FIELDS_AFTER_PHONE = [CUSTOMER_EMAIL_FIELD, CUSTOMER_ADDRESS_FIELD] as const;

type CustomerTextFieldName =
  | (typeof TEXT_FIELDS_BEFORE_PHONE)[number]
  | (typeof TEXT_FIELDS_AFTER_PHONE)[number];

/** Los tres obligatorios: nombres, apellidos y ciudad. Telefono, correo y direccion no lo son. */
export const CUSTOMER_REQUIRED_FIELDS = [
  CUSTOMER_FIRST_NAMES_FIELD,
  CUSTOMER_LAST_NAMES_FIELD,
  CUSTOMER_CITY_FIELD,
] as const;

export type CustomerFieldName = (typeof CUSTOMER_BUSINESS_FIELDS)[number];

/** `data-testid` del panel, que lo pinta este archivo, no `customer-sheet.tsx`. */
export const CUSTOMER_SHEET_TESTID = 'customer-sheet';

export const CUSTOMER_FORM_TESTID = 'customer-form';
export const CUSTOMER_FORM_ERROR_TESTID = 'customer-form-error';
export const CUSTOMER_FORM_ERROR_CODE_TESTID = 'customer-form-error-code';
export const CUSTOMER_FORM_SUBMIT_TESTID = 'customer-form-submit';
export const CUSTOMER_FORM_CANCEL_TESTID = 'customer-form-cancel';

export const CUSTOMER_FIELD_TESTIDS: Readonly<Record<CustomerFieldName, string>> = {
  firstNames: 'customer-field-first-names',
  lastNames: 'customer-field-last-names',
  city: 'customer-field-city',
  phoneCountry: 'customer-field-phone-country',
  phoneNumber: 'customer-field-phone-number',
  email: 'customer-field-email',
  address: 'customer-field-address',
};

export const CUSTOMER_ERROR_TESTIDS: Readonly<Record<CustomerFieldName, string>> = {
  firstNames: 'customer-error-first-names',
  lastNames: 'customer-error-last-names',
  city: 'customer-error-city',
  phoneCountry: 'customer-error-phone-country',
  phoneNumber: 'customer-error-phone-number',
  email: 'customer-error-email',
  address: 'customer-error-address',
};

export const CUSTOMER_PHONE_ISSUE_TESTID = 'customer-phone-issue';

const FIELD_LABELS: Readonly<Record<CustomerTextFieldName, string>> = {
  firstNames: 'Nombres',
  lastNames: 'Apellidos',
  city: 'Ciudad',
  email: 'Correo',
  address: 'Dirección',
};

/**
 * Solo `email` lleva un `inputMode` especifico: no usa `type="email"` ni `pattern`, porque el
 * navegador bloquearia un envio que el servidor aceptaria.
 */
const FIELD_INPUT_MODE: Readonly<Partial<Record<CustomerTextFieldName, 'email'>>> = {
  email: 'email',
};

/** El `maxLength` de cada campo sale del esquema publicado, nunca de un numero suelto. */
const FIELD_MAX_LENGTH: Readonly<Record<CustomerTextFieldName, number>> = {
  firstNames: CUSTOMER_FIRST_NAMES_MAX_LENGTH,
  lastNames: CUSTOMER_LAST_NAMES_MAX_LENGTH,
  city: CUSTOMER_CITY_MAX_LENGTH,
  email: CUSTOMER_EMAIL_MAX_LENGTH,
  address: CUSTOMER_ADDRESS_MAX_LENGTH,
};

/**
 * Copy del error de campo de la validacion previa. La regla que describe sigue siendo la del
 * esquema; aqui solo se traduce su incumplimiento.
 */
const FIELD_MESSAGES: Readonly<Record<CustomerTextFieldName, string>> = {
  firstNames: `Escribe los nombres (máximo ${CUSTOMER_FIRST_NAMES_MAX_LENGTH} caracteres).`,
  lastNames: `Escribe los apellidos (máximo ${CUSTOMER_LAST_NAMES_MAX_LENGTH} caracteres).`,
  city: `Escribe la ciudad (máximo ${CUSTOMER_CITY_MAX_LENGTH} caracteres).`,
  email: `El correo es demasiado largo (máximo ${CUSTOMER_EMAIL_MAX_LENGTH} caracteres).`,
  address: `La dirección es demasiado larga (máximo ${CUSTOMER_ADDRESS_MAX_LENGTH} caracteres).`,
};

const PHONE_TOO_LONG_MESSAGE = `El teléfono es demasiado largo (máximo ${CUSTOMER_PHONE_MAX_LENGTH} caracteres).`;

const INVALID_INPUT_CODE = 'invalid_input' satisfies ErrorCode;
const PHONE_COUNTRY_REQUIRED_CODE = 'customer_phone_country_required' satisfies ErrorCode;
const PHONE_INVALID_CODE = 'customer_phone_invalid' satisfies ErrorCode;
const FORM_ERROR_MESSAGE = 'Revisa los campos marcados.';

type FieldErrors = Partial<Record<CustomerFieldName, string>>;

/** Lo escrito en el formulario, para devolverlo tras un fallo. */
type FieldValues = Partial<Record<CustomerFieldName, string>>;

type CustomerFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      status: 'error';
      /** El error TAL CUAL, para que el render estreche por `code` sin perder el `reference`. */
      serverError: ErrorState;
      fieldErrors: FieldErrors;
      values: FieldValues;
    };

const INITIAL_STATE: CustomerFormState = { status: 'idle' };

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function isTextField(field: string): field is CustomerTextFieldName {
  return field in FIELD_MESSAGES;
}

/** Los rechazos de la validacion previa en el pais o el numero, con su mensaje. */
function phonePrevalidationError(
  field: string,
  issue: { readonly code: string; readonly params?: Record<string, unknown> },
  values: FieldValues,
): FieldErrors {
  if (field === CUSTOMER_PHONE_NUMBER_FIELD) {
    if (issue.code !== 'custom') return { phoneNumber: PHONE_TOO_LONG_MESSAGE };
    const message = phoneNumberInvalidMessage(values.phoneCountry);
    return message === null ? {} : { phoneNumber: message };
  }
  if (field === CUSTOMER_PHONE_COUNTRY_FIELD && issue.params?.reason === 'country_required') {
    return { phoneCountry: errorMessage(PHONE_COUNTRY_REQUIRED_CODE) };
  }
  return {};
}

/** Los rechazos del servidor que se pintan bajo el telefono y no en la region general. */
function phoneServerError(error: ErrorState, values: FieldValues): FieldErrors {
  switch (error.code) {
    case PHONE_COUNTRY_REQUIRED_CODE:
      return { phoneCountry: error.message };
    case PHONE_INVALID_CODE:
      return { phoneNumber: phoneNumberInvalidMessage(values.phoneCountry) ?? error.message };
    default:
      return {};
  }
}

function readValues(formData: FormData): FieldValues {
  const values: FieldValues = {};
  for (const field of CUSTOMER_BUSINESS_FIELDS) values[field] = readString(formData, field);
  return values;
}

/**
 * Invoca la operacion que toca y normaliza su resultado: si fallo, el `ErrorState`; si no,
 * exito. El alta devuelve tambien el id creado, que aqui no hace falta.
 */
async function submit(
  customerId: string | undefined,
  formData: FormData,
): Promise<{ status: 'success' } | ErrorState> {
  if (customerId === undefined) {
    const result = await createCustomerAction({ status: 'idle' }, formData);
    return result.status === 'error' ? result : { status: 'success' };
  }

  const update = updateCustomerAction.bind(null, customerId);
  const result = await update({ status: 'idle' }, formData);
  return result.status === 'error' ? result : { status: 'success' };
}

export type CustomerFormProps = {
  /** Cliente que se edita. Ausente en el alta. */
  readonly customer?: CustomerView;
  /** Lo llama el panel cuando la operacion termina bien: cerrar, avisar y refrescar. */
  readonly onSaved: () => void;
  /** País de la empresa: marca el teléfono en el alta y va arriba en la lista de países. */
  readonly companyCountry?: CountryCode | null;
};

export function CustomerForm({ customer, onSaved, companyCountry = null }: CustomerFormProps) {
  const fieldId = useId();
  const formErrorId = `${fieldId}-form-error`;
  const isEdit = customer !== undefined;

  async function save(
    _previous: CustomerFormState,
    formData: FormData,
  ): Promise<CustomerFormState> {
    const values = readValues(formData);

    const candidate = {
      firstNames: values.firstNames ?? '',
      lastNames: values.lastNames ?? '',
      city: values.city ?? '',
      phoneCountry: values.phoneCountry,
      phoneNumber: values.phoneNumber,
      email: values.email,
      address: values.address,
    };
    const parsed = createCustomerSchema.safeParse(candidate);

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '');
        if (isTextField(field)) {
          fieldErrors[field] ??= FIELD_MESSAGES[field];
          continue;
        }
        const phone = phonePrevalidationError(field, issue, values);
        if (phone.phoneCountry !== undefined) fieldErrors.phoneCountry ??= phone.phoneCountry;
        if (phone.phoneNumber !== undefined) fieldErrors.phoneNumber ??= phone.phoneNumber;
      }

      // Rechazo de la validacion previa: ni se llama a la operacion.
      return {
        status: 'error',
        serverError: { status: 'error', code: INVALID_INPUT_CODE, message: FORM_ERROR_MESSAGE },
        fieldErrors,
        values,
      };
    }

    const result = await submit(customer?.id, formData);

    if (result.status === 'error') {
      const fieldErrors = phoneServerError(result, values);
      return { status: 'error', serverError: result, fieldErrors, values };
    }

    return { status: 'success' };
  }

  const [state, formAction] = useActionState(save, INITIAL_STATE);

  useEffect(() => {
    if (state.status !== 'success') return;
    onSaved();
  }, [state, onSaved]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : {};
  const values = state.status === 'error' ? state.values : undefined;
  const formError =
    state.status === 'error' && Object.keys(fieldErrors).length === 0
      ? state.serverError
      : undefined;

  const valueOf = (field: CustomerTextFieldName): string =>
    values?.[field] ?? (customer?.[field] ?? '');

  const phoneErrors = useMemo<CustomerPhoneFieldErrors | undefined>(
    () =>
      state.status === 'error'
        ? { country: state.fieldErrors.phoneCountry, number: state.fieldErrors.phoneNumber }
        : undefined,
    [state],
  );

  const renderTextField = (field: CustomerTextFieldName) => {
    const required = (CUSTOMER_REQUIRED_FIELDS as readonly string[]).includes(field);
    return (
      <TextField
        key={field}
        id={`${fieldId}-${field}`}
        name={field}
        label={FIELD_LABELS[field]}
        inputMode={FIELD_INPUT_MODE[field]}
        autoComplete="off"
        required={required}
        ariaRequired={required}
        maxLength={FIELD_MAX_LENGTH[field]}
        defaultValue={valueOf(field)}
        remountOnDefault
        error={fieldErrors[field]}
        testId={CUSTOMER_FIELD_TESTIDS[field]}
        errorTestId={CUSTOMER_ERROR_TESTIDS[field]}
      />
    );
  };

  return (
    <FormSheet
      title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
      description={isEdit ? 'Cambia los datos del cliente.' : 'Describe el nuevo cliente.'}
      formAction={formAction}
      cancelTouch="prop"
      testIds={{
        sheet: CUSTOMER_SHEET_TESTID,
        form: CUSTOMER_FORM_TESTID,
        cancel: CUSTOMER_FORM_CANCEL_TESTID,
        submit: CUSTOMER_FORM_SUBMIT_TESTID,
      }}
    >
      {formError === undefined ? null : (
        <ErrorAlert
          error={formError}
          id={formErrorId}
          className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          testId={CUSTOMER_FORM_ERROR_TESTID}
          withDataCode
          renderCatalogued={(catalogued) => (
            <>
              <p>{catalogued.message}</p>
              <p className="text-xs" data-testid={CUSTOMER_FORM_ERROR_CODE_TESTID}>
                {catalogued.code}
              </p>
            </>
          )}
        />
      )}

      {TEXT_FIELDS_BEFORE_PHONE.map(renderTextField)}
      <CustomerPhoneField
        companyCountry={companyCountry}
        customer={customer}
        errors={phoneErrors}
        testIds={{
          country: CUSTOMER_FIELD_TESTIDS.phoneCountry,
          number: CUSTOMER_FIELD_TESTIDS.phoneNumber,
          countryError: CUSTOMER_ERROR_TESTIDS.phoneCountry,
          numberError: CUSTOMER_ERROR_TESTIDS.phoneNumber,
          issue: CUSTOMER_PHONE_ISSUE_TESTID,
        }}
      />
      {TEXT_FIELDS_AFTER_PHONE.map(renderTextField)}
    </FormSheet>
  );
}
