import { getCountries, getCountryCallingCode } from 'libphonenumber-js';
import { describe, expect, it } from 'vitest';

import {
  countryOptionLabel,
  filterCountryOptions,
  isCallingCodeQuery,
  listCountryOptions,
} from '@/components/shared/country-options';

const opciones = listCountryOptions();

function codigos(query: string): string[] {
  return filterCountryOptions(opciones, query).map((option) => option.code);
}

describe('country-options', () => {
  it('R13 — una opción por cada código de getCountries(), con nombre en español y prefijo', () => {
    const esperados = [...getCountries()].sort();
    expect(opciones.map((option) => option.code).sort()).toEqual(esperados);

    const nombres = new Intl.DisplayNames('es', { type: 'region' });
    for (const option of opciones) {
      expect(option.name).toBe(nombres.of(option.code) ?? option.code);
      expect(option.callingCode).toBe(getCountryCallingCode(option.code));
    }
    const colombia = opciones.find((option) => option.code === 'CO');
    expect(colombia && countryOptionLabel(colombia)).toBe('Colombia (+57)');
  });

  it('R13 — ordenadas por nombre con localeCompare en español', () => {
    const nombres = opciones.map((option) => option.name);
    const ordenados = [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
    expect(nombres).toEqual(ordenados);
  });

  it('R13 — los países con prefijo +1 son opciones separadas (CA, US)', () => {
    const conMasUno = opciones.filter((option) => option.callingCode === '1');
    const codes = conMasUno.map((option) => option.code);
    expect(codes).toContain('CA');
    expect(codes).toContain('US');
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('R13 — la lista se calcula una vez por módulo', () => {
    expect(listCountryOptions()).toBe(opciones);
  });

  it('R16 — busca por nombre sin tildes ni mayúsculas: peru → Perú, MEXICO → México', () => {
    const peru = filterCountryOptions(opciones, 'peru');
    expect(peru.map((option) => option.name)).toContain('Perú');
    expect(peru.every((option) => option.name.toLowerCase().includes('per'))).toBe(true);

    const mexico = filterCountryOptions(opciones, 'MEXICO');
    expect(mexico.map((option) => option.name)).toEqual(['México']);
  });

  it('R16 — un texto que no son solo dígitos no se trata como prefijo', () => {
    expect(isCallingCodeQuery('peru')).toBe(false);
    expect(isCallingCodeQuery('+5a')).toBe(false);
    expect(isCallingCodeQuery('++57')).toBe(false);
  });

  it('R17 — 57 y +57 encuentran Colombia por prefijo', () => {
    expect(isCallingCodeQuery('57')).toBe(true);
    expect(isCallingCodeQuery(' +57 ')).toBe(true);
    expect(codigos('57')).toContain('CO');
    expect(codigos('+57')).toEqual(codigos('57'));
    for (const option of filterCountryOptions(opciones, '57')) {
      expect(option.callingCode.startsWith('57')).toBe(true);
    }
  });

  it('R17 — 1 encuentra, por separado, Canadá y Estados Unidos', () => {
    const resultado = codigos('1');
    expect(resultado).toContain('CA');
    expect(resultado).toContain('US');
    for (const option of filterCountryOptions(opciones, '1')) {
      expect(option.callingCode.startsWith('1')).toBe(true);
    }
  });

  it('R18 — un texto sin coincidencias devuelve la lista vacía', () => {
    expect(filterCountryOptions(opciones, 'zzzzqx')).toEqual([]);
    expect(filterCountryOptions(opciones, '+0')).toEqual([]);
  });

  it('R18 — el texto vacío o solo espacios devuelve todas las opciones', () => {
    expect(filterCountryOptions(opciones, '')).toEqual(opciones);
    expect(filterCountryOptions(opciones, '   ')).toEqual(opciones);
  });
});
