import { cleanup, render, screen, within } from '@testing-library/react';

import {
  ADMINISTRATOR_FIELD_LABELS,
  ADMINISTRATOR_FIELD_NAMES,
  AdministratorFields,
  administratorFieldErrorTestId,
  administratorFieldName,
  administratorFieldTestId,
  administratorUsernameSuggestionTestIds,
  type AdministratorFieldName,
} from '@/components/shared/administrator-fields';
import { DOCUMENT_TYPE_CODES } from '@/lib/modules/identity';

import { setupUser } from '../../helpers/user-event';

const PREFIJO = 'adm';

/** Los doce nombres del alta de empresa: los cuatro de la empresa más estos ocho. */
const NOMBRES_CON_PREFIJO_ADMIN = [
  'adminFirstNames',
  'adminLastNames',
  'adminBirthDate',
  'adminEmail',
  'adminPhone',
  'adminDocumentTypeCode',
  'adminDocumentNumber',
  'adminUsername',
];

const VALORES: Record<AdministratorFieldName, string> = {
  firstNames: 'Paula',
  lastNames: 'Gil',
  birthDate: '1990-04-12',
  email: 'gerencia@aseocaribe.co',
  phone: '3001234567',
  documentTypeCode: DOCUMENT_TYPE_CODES[0],
  documentNumber: '1020304050',
  username: 'pgil',
};

const CAMPOS_DE_TEXTO: readonly AdministratorFieldName[] = [
  'firstNames',
  'lastNames',
  'email',
  'phone',
  'documentNumber',
  'username',
];

function montar(props: Partial<Parameters<typeof AdministratorFields>[0]> = {}) {
  render(
    <form data-testid="form">
      <AdministratorFields testIdPrefix={PREFIJO} {...props} />
    </form>,
  );
  return screen.getByTestId('form') as HTMLFormElement;
}

function nombresDelFormulario(form: HTMLFormElement): readonly string[] {
  return [...new FormData(form).keys()];
}

afterEach(() => {
  cleanup();
});

describe('AdministratorFields', () => {
  it('R17: pinta los ocho campos del Administrador en el orden del tablero, sin rol, empresa ni contraseña', () => {
    montar();

    const etiquetas = ADMINISTRATOR_FIELD_NAMES.map((campo) => ADMINISTRATOR_FIELD_LABELS[campo]);
    expect(etiquetas).toEqual([
      'Nombres',
      'Apellidos',
      'Fecha de nacimiento',
      'Correo',
      'Teléfono',
      'Tipo de documento',
      'Número de documento',
      'Nombre de usuario',
    ]);
    for (const etiqueta of etiquetas) {
      expect(screen.getAllByText(etiqueta).length, etiqueta).toBeGreaterThan(0);
    }

    expect(screen.queryByText('Rol')).toBeNull();
    expect(screen.queryByText('Empresa')).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('R17: con el prefijo `admin`, los nombres de campo son los del alta de empresa', () => {
    const form = montar({ namePrefix: 'admin' });

    expect(ADMINISTRATOR_FIELD_NAMES.map((campo) => administratorFieldName(campo, 'admin'))).toEqual(
      NOMBRES_CON_PREFIJO_ADMIN,
    );
    expect([...nombresDelFormulario(form)].sort()).toEqual([...NOMBRES_CON_PREFIJO_ADMIN].sort());
  });

  it('R17: sin prefijo, los nombres de campo son los de la persona tal cual', () => {
    const form = montar();

    expect([...nombresDelFormulario(form)].sort()).toEqual([...ADMINISTRATOR_FIELD_NAMES].sort());
    expect(administratorFieldName('firstNames')).toBe('firstNames');
    expect(administratorFieldName('firstNames', '')).toBe('firstNames');
  });

  it('R17: los valores de partida viajan tal cual en el FormData; el tipo de documento arranca en el primero del catálogo', () => {
    const conValores = montar({ namePrefix: 'admin', defaultValues: VALORES });
    const datos = new FormData(conValores);

    for (const campo of ADMINISTRATOR_FIELD_NAMES) {
      expect(datos.get(administratorFieldName(campo, 'admin')), campo).toBe(VALORES[campo]);
    }

    cleanup();
    const vacio = new FormData(montar());
    expect(vacio.get('documentTypeCode')).toBe(DOCUMENT_TYPE_CODES[0]);
    expect(vacio.get('birthDate')).toBe('');
  });

  it('R17: marca como obligatorios Nombres, Apellidos, Fecha de nacimiento, Correo, Teléfono, Número de documento y Nombre de usuario', () => {
    montar();

    const obligatorios = [
      'firstNames',
      'lastNames',
      'email',
      'phone',
      'documentNumber',
      'username',
    ] as const;
    for (const campo of obligatorios) {
      const control = screen.getByTestId(administratorFieldTestId(PREFIJO, campo));
      expect(control, campo).toHaveAttribute('aria-required', 'true');
      expect(control, campo).not.toHaveAttribute('required');
      const etiqueta = screen.getByText(ADMINISTRATOR_FIELD_LABELS[campo]);
      expect(etiqueta.querySelector('[aria-hidden="true"]')?.textContent, campo).toBe('*');
    }
    const fecha = screen.getByText(ADMINISTRATOR_FIELD_LABELS.birthDate);
    expect(fecha.querySelector('[aria-hidden="true"]')?.textContent).toBe('*');
  });

  it('R19: cada error se pinta junto a su campo y queda enlazado con aria-describedby', () => {
    const errores = Object.fromEntries(
      ADMINISTRATOR_FIELD_NAMES.map((campo) => [campo, `Error de ${campo}`]),
    ) as Record<AdministratorFieldName, string>;
    montar({ errors: errores });

    for (const campo of ADMINISTRATOR_FIELD_NAMES) {
      const error = screen.getByTestId(administratorFieldErrorTestId(PREFIJO, campo));
      expect(error, campo).toHaveTextContent(`Error de ${campo}`);

      const control = screen.getByTestId(administratorFieldTestId(PREFIJO, campo));
      expect(control, campo).toHaveAttribute('aria-invalid', 'true');
      expect(control.getAttribute('aria-describedby')?.split(' '), campo).toContain(error.id);
    }
  });

  it('R19: sin errores no hay ningún mensaje ni control inválido', () => {
    montar();

    for (const campo of ADMINISTRATOR_FIELD_NAMES) {
      expect(screen.queryByTestId(administratorFieldErrorTestId(PREFIJO, campo))).toBeNull();
      expect(screen.getByTestId(administratorFieldTestId(PREFIJO, campo))).not.toHaveAttribute(
        'aria-invalid',
      );
    }
  });

  it('R17: los campos de texto miden 44 px de alto y usan letra de 16 px; los selectores, 44 px', () => {
    montar();

    for (const campo of CAMPOS_DE_TEXTO) {
      const input = screen.getByTestId(administratorFieldTestId(PREFIJO, campo));
      expect(input.className, campo).toContain('min-h-11');
      expect(input.className, campo).toContain('text-base');
      expect(input.className, campo).toContain('md:text-base');
    }
    for (const campo of ['birthDate', 'documentTypeCode'] as const) {
      expect(screen.getByTestId(administratorFieldTestId(PREFIJO, campo)).className, campo).toContain(
        'min-h-11',
      );
    }
  });

  it('R17: cada campo de texto tiene su etiqueta accesible', () => {
    montar();

    for (const campo of CAMPOS_DE_TEXTO) {
      const input = screen.getByTestId(administratorFieldTestId(PREFIJO, campo)) as HTMLInputElement;
      expect(input.labels?.[0]?.textContent, campo).toContain(ADMINISTRATOR_FIELD_LABELS[campo]);
    }
  });
});

describe('AdministratorFields: nombre de usuario propuesto en el alta', () => {
  const campo = (field: AdministratorFieldName) =>
    screen.getByTestId(administratorFieldTestId(PREFIJO, field));

  it('con `usernameAutofill` lo propone a partir de nombres y apellidos mientras se escribe', async () => {
    const user = setupUser();
    montar({ usernameAutofill: true });

    await user.type(campo('firstNames'), 'José Carlos');
    expect(campo('username')).toHaveValue('josec');

    await user.type(campo('lastNames'), 'Pérez Núñez');
    expect(campo('username')).toHaveValue('josecpn');
  });

  it('deja de proponerlo para siempre en cuanto se edita a mano, aunque se vacíe', async () => {
    const user = setupUser();
    montar({ usernameAutofill: true });

    await user.type(campo('firstNames'), 'Ana');
    await user.type(campo('username'), 'x');
    expect(campo('username')).toHaveValue('anax');

    await user.type(campo('lastNames'), 'Lopez');
    expect(campo('username')).toHaveValue('anax');

    await user.clear(campo('username'));
    await user.type(campo('firstNames'), ' Maria');
    expect(campo('username')).toHaveValue('');
  });

  it('sin `usernameAutofill` (edición) no lo toca', async () => {
    const user = setupUser();
    montar({ defaultValues: VALORES });

    await user.type(campo('firstNames'), ' Jose');
    expect(campo('username')).toHaveValue(VALORES.username);
  });

  it('con `usernameAutofill` arranca con los valores de partida y viajan con su nombre de campo', () => {
    const form = montar({ usernameAutofill: true, namePrefix: 'admin', defaultValues: VALORES });
    const datos = new FormData(form);

    expect(datos.get('adminFirstNames')).toBe(VALORES.firstNames);
    expect(datos.get('adminLastNames')).toBe(VALORES.lastNames);
    expect(datos.get('adminUsername')).toBe(VALORES.username);
  });

  it('la recomendación se aplica como edición manual y desaparece al aplicarse', async () => {
    const user = setupUser();
    const ids = administratorUsernameSuggestionTestIds(PREFIJO);
    const sugerido = `${VALORES.username}1`;
    montar({ usernameAutofill: true, defaultValues: VALORES, usernameSuggestion: sugerido });

    const aplicar = within(screen.getByTestId(ids.suggestion)).getByTestId(ids.apply);
    expect(aplicar).toHaveAttribute('type', 'button');
    expect(aplicar).toHaveAccessibleName(new RegExp(sugerido));
    expect(aplicar.className).toContain('min-h-11');

    await user.click(aplicar);

    expect(campo('username')).toHaveValue(sugerido);
    expect(screen.queryByTestId(ids.suggestion)).toBeNull();

    await user.type(campo('firstNames'), ' Jose');
    expect(campo('username')).toHaveValue(sugerido);
  });

  it('sin `usernameSuggestion` no hay recomendación', () => {
    montar({ usernameAutofill: true });

    expect(
      screen.queryByTestId(administratorUsernameSuggestionTestIds(PREFIJO).suggestion),
    ).toBeNull();
  });
});
