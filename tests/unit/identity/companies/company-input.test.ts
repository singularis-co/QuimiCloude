// Esquemas de entrada de la gestion de empresas: topes, recorte, vacio como «sin valor», claves
// no previstas y la forma normalizada de la identificacion fiscal.
import { describe, expect, it } from 'vitest';

import {
  COMPANY_CONTACT_EMAIL_MAX_LENGTH,
  COMPANY_CONTACT_PHONE_MAX_LENGTH,
  COMPANY_NAME_MAX_LENGTH,
  COMPANY_TAX_ID_MAX_LENGTH,
  companyAdministratorSchema,
  companyDataSchema,
  companyIdSchema,
  createCompanySchema,
  deleteCompanySchema,
  listCompanyEventsSchema,
  normalizeTaxId,
  toCompanyWrite,
  updateCompanySchema,
} from '@/lib/modules/identity/domain/company-input';
import { USER_EMAIL_MAX_LENGTH } from '@/lib/modules/identity/domain/user-input';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

const DATOS = {
  name: 'QuimiCloud',
  taxId: '900.123.456-7',
  contactEmail: 'contacto@quimi.co',
  contactPhone: '+57 300 000 0000',
};

const ADMINISTRADOR = {
  firstNames: 'Ana',
  lastNames: 'Perez',
  birthDate: '1990-05-01',
  email: 'ana@quimi.co',
  phone: '3000000000',
  documentTypeCode: 'CC',
  documentNumber: '123456',
  username: 'ana.perez',
};

describe('companyDataSchema', () => {
  it('R4: guarda los textos recortados', () => {
    const datos = companyDataSchema.parse({
      name: '  QuimiCloud  ',
      taxId: ' 900 ',
      contactEmail: ' a@b.co ',
      contactPhone: ' 300 ',
    });
    expect(datos).toEqual({ name: 'QuimiCloud', taxId: '900', contactEmail: 'a@b.co', contactPhone: '300' });
  });

  const TOPES = [
    { campo: 'name', tope: COMPANY_NAME_MAX_LENGTH, esperado: 80 },
    { campo: 'taxId', tope: COMPANY_TAX_ID_MAX_LENGTH, esperado: 40 },
    { campo: 'contactEmail', tope: COMPANY_CONTACT_EMAIL_MAX_LENGTH, esperado: 160 },
    { campo: 'contactPhone', tope: COMPANY_CONTACT_PHONE_MAX_LENGTH, esperado: 40 },
  ] as const;

  for (const { campo, tope, esperado } of TOPES) {
    it(`R4: ${campo} admite ${esperado} caracteres y rechaza ${esperado + 1}`, () => {
      expect(tope).toBe(esperado);
      expect(companyDataSchema.safeParse({ ...DATOS, [campo]: 'a'.repeat(tope) }).success).toBe(true);
      expect(companyDataSchema.safeParse({ ...DATOS, [campo]: 'a'.repeat(tope + 1) }).success).toBe(false);
    });
  }

  it('R4: el tope se mide despues de recortar', () => {
    const nombre = `  ${'a'.repeat(COMPANY_NAME_MAX_LENGTH)}  `;
    expect(companyDataSchema.safeParse({ ...DATOS, name: nombre }).success).toBe(true);
  });

  it('R4: el nombre vacio o solo con espacios no pasa', () => {
    expect(companyDataSchema.safeParse({ ...DATOS, name: '' }).success).toBe(false);
    expect(companyDataSchema.safeParse({ ...DATOS, name: '   ' }).success).toBe(false);
  });

  for (const campo of ['taxId', 'contactEmail', 'contactPhone'] as const) {
    it(`R5: ${campo} vacio o con espacios se guarda sin valor`, () => {
      expect(companyDataSchema.parse({ ...DATOS, [campo]: '' })[campo]).toBeNull();
      expect(companyDataSchema.parse({ ...DATOS, [campo]: '   ' })[campo]).toBeNull();
    });
  }

  for (const campo of ['name', 'taxId', 'contactEmail', 'contactPhone'] as const) {
    it(`R5: falta ${campo} → no pasa`, () => {
      const resto: Record<string, unknown> = { ...DATOS };
      delete resto[campo];
      expect(companyDataSchema.safeParse(resto).success).toBe(false);
      expect(companyDataSchema.safeParse({ ...DATOS, [campo]: null }).success).toBe(false);
    });
  }

  for (const clave of ['country', 'companyId', 'deletedAt', 'nameNormalized', 'taxIdNormalized']) {
    it(`R5: la clave no prevista ${clave} → no pasa`, () => {
      expect(companyDataSchema.safeParse({ ...DATOS, [clave]: 'x' }).success).toBe(false);
    });
  }

  it('R6: el correo de contacto se guarda como se escribio, sin formato ni minusculas', () => {
    expect(COMPANY_CONTACT_EMAIL_MAX_LENGTH).toBe(USER_EMAIL_MAX_LENGTH);
    expect(companyDataSchema.parse({ ...DATOS, contactEmail: 'Contacto@QUIMI.co' }).contactEmail).toBe(
      'Contacto@QUIMI.co',
    );
    expect(companyDataSchema.parse({ ...DATOS, contactEmail: 'no es un correo' }).contactEmail).toBe(
      'no es un correo',
    );
  });
});

describe('createCompanySchema', () => {
  it('R12: acepta la empresa y el Administrador con los campos del alta de usuario', () => {
    expect(createCompanySchema.safeParse({ company: DATOS, administrator: ADMINISTRADOR }).success).toBe(true);
  });

  for (const clave of ['roleId', 'credential', 'companyId', 'password', 'accountStatus']) {
    it(`R12: el Administrador con ${clave} → no pasa`, () => {
      const administrator = { ...ADMINISTRADOR, [clave]: 'x' };
      expect(companyAdministratorSchema.safeParse(administrator).success).toBe(false);
      expect(createCompanySchema.safeParse({ company: DATOS, administrator }).success).toBe(false);
    });
  }

  for (const campo of Object.keys(ADMINISTRADOR)) {
    it(`R12: al Administrador le falta ${campo} → no pasa`, () => {
      const resto: Record<string, unknown> = { ...ADMINISTRADOR };
      delete resto[campo];
      expect(companyAdministratorSchema.safeParse(resto).success).toBe(false);
    });
  }

  it('R12: el Administrador valida como el alta de usuario (fecha y tipo de documento)', () => {
    expect(companyAdministratorSchema.safeParse({ ...ADMINISTRADOR, birthDate: '2026-13-01' }).success).toBe(false);
    expect(companyAdministratorSchema.safeParse({ ...ADMINISTRADOR, documentTypeCode: 'XX' }).success).toBe(false);
    expect(companyAdministratorSchema.safeParse({ ...ADMINISTRADOR, username: '   ' }).success).toBe(false);
  });

  it('R5: el alta con una clave no prevista al nivel superior → no pasa', () => {
    expect(
      createCompanySchema.safeParse({ company: DATOS, administrator: ADMINISTRADOR, country: 'CO' }).success,
    ).toBe(false);
    expect(
      createCompanySchema.safeParse({ company: { ...DATOS, country: 'CO' }, administrator: ADMINISTRADOR }).success,
    ).toBe(false);
  });
});

describe('updateCompanySchema, deleteCompanySchema, companyIdSchema y listCompanyEventsSchema', () => {
  it('R16: la edicion pide el id y los cuatro datos', () => {
    expect(updateCompanySchema.safeParse({ companyId: COMPANY_ID, ...DATOS }).success).toBe(true);
    expect(updateCompanySchema.safeParse(DATOS).success).toBe(false);
    expect(updateCompanySchema.safeParse({ companyId: 'empresa-1', ...DATOS }).success).toBe(false);
  });

  it('R5: la edicion sigue siendo estricta (country, deletedAt)', () => {
    expect(updateCompanySchema.safeParse({ companyId: COMPANY_ID, ...DATOS, country: 'CO' }).success).toBe(false);
    expect(updateCompanySchema.safeParse({ companyId: COMPANY_ID, ...DATOS, deletedAt: null }).success).toBe(false);
  });

  it('R22: la baja exige una confirmacion no vacia', () => {
    expect(deleteCompanySchema.safeParse({ companyId: COMPANY_ID, confirmationName: 'Quimi' }).success).toBe(true);
    expect(deleteCompanySchema.safeParse({ companyId: COMPANY_ID, confirmationName: '  ' }).success).toBe(false);
    expect(deleteCompanySchema.safeParse({ companyId: COMPANY_ID }).success).toBe(false);
  });

  it('R28: el id de empresa es un UUID y nada mas', () => {
    expect(companyIdSchema.safeParse({ companyId: COMPANY_ID }).success).toBe(true);
    expect(companyIdSchema.safeParse({ companyId: 'x' }).success).toBe(false);
    expect(companyIdSchema.safeParse({ companyId: COMPANY_ID, extra: 1 }).success).toBe(false);
  });

  it('R37: el historial admite pagina y tamano opcionales, enteros y positivos', () => {
    expect(listCompanyEventsSchema.safeParse({ companyId: COMPANY_ID }).success).toBe(true);
    expect(listCompanyEventsSchema.safeParse({ companyId: COMPANY_ID, page: 2, pageSize: 25 }).success).toBe(true);
    expect(listCompanyEventsSchema.safeParse({ companyId: COMPANY_ID, page: 0 }).success).toBe(false);
    expect(listCompanyEventsSchema.safeParse({ companyId: COMPANY_ID, pageSize: 1.5 }).success).toBe(false);
  });
});

describe('normalizeTaxId y toCompanyWrite', () => {
  it('R9: «900.123.456-7» y «9001234567» tienen la misma forma normalizada', () => {
    expect(normalizeTaxId('900.123.456-7')).toBe('9001234567');
    expect(normalizeTaxId(' NIT-900 ')).toBe('nit900');
  });

  it('R4: toCompanyWrite anade las dos formas normalizadas', () => {
    expect(toCompanyWrite(companyDataSchema.parse({ ...DATOS, name: 'Quími-Cloud' }))).toEqual({
      name: 'Quími-Cloud',
      nameNormalized: 'quimicloud',
      taxId: '900.123.456-7',
      taxIdNormalized: '9001234567',
      contactEmail: 'contacto@quimi.co',
      contactPhone: '+57 300 000 0000',
    });
  });

  it('R9: sin identificacion, las dos columnas quedan sin valor', () => {
    const escritura = toCompanyWrite(companyDataSchema.parse({ ...DATOS, taxId: '' }));
    expect(escritura.taxId).toBeNull();
    expect(escritura.taxIdNormalized).toBeNull();
  });

  it('R7: una identificacion cuya forma normalizada queda vacia → invalid_input', () => {
    expect(() => toCompanyWrite(companyDataSchema.parse({ ...DATOS, taxId: '---' }))).toThrow(
      expect.objectContaining({ code: 'invalid_input' }),
    );
  });

  it('R45: un nombre cuya forma normalizada queda vacia → invalid_input', () => {
    expect(() => toCompanyWrite(companyDataSchema.parse({ ...DATOS, name: '!!!' }))).toThrow(
      expect.objectContaining({ code: 'invalid_input' }),
    );
  });
});
