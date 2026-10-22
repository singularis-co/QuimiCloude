// El texto de cada evento del historial de empresa: nombra lo que cambió, nunca sus valores.
import { describe, expect, it } from 'vitest';

import {
  companyEventText,
  formatCompanyEventInstant,
  type CompanyEventTextInput,
} from '@/app/(private)/maestro/empresas/[id]/components';
import { ADDONS, type CompanyField } from '@/lib/modules/identity';
import { ADDON_NAMES } from '@/lib/shared/ui/addon-names';

function evento(
  kind: string,
  extra: { fields?: readonly string[]; addon?: string | null } = {},
): CompanyEventTextInput {
  return {
    kind,
    fields: (extra.fields ?? []) as readonly CompanyField[],
    addon: extra.addon ?? null,
  };
}

describe('companyEventText', () => {
  it('R32: alta, «Dio de alta la empresa»', () => {
    expect(companyEventText(evento('company.created'))).toBe('Dio de alta la empresa');
  });

  it('R32: baja y reactivacion con los textos de la pregunta abierta 4', () => {
    expect(companyEventText(evento('company.deleted'))).toBe('Dio de baja la empresa');
    expect(companyEventText(evento('company.reactivated'))).toBe('Reactivó la empresa');
  });

  it('R32: edicion de un campo, «Editó <campo>»', () => {
    expect(companyEventText(evento('company.updated', { fields: ['name'] }))).toBe('Editó Nombre');
  });

  it('R32: edicion de dos campos, unidos con «y» en el orden en que llegan', () => {
    expect(
      companyEventText(evento('company.updated', { fields: ['country', 'contactPhone'] })),
    ).toBe('Editó País y Teléfono de contacto');
  });

  it('R32: edicion de los cinco campos, con comas y «y» antes del ultimo', () => {
    expect(
      companyEventText(
        evento('company.updated', {
          fields: ['name', 'taxId', 'contactEmail', 'contactPhone', 'country'],
        }),
      ),
    ).toBe(
      'Editó Nombre, Identificación fiscal, Correo de contacto, Teléfono de contacto y País',
    );
  });

  it.each(ADDONS)('R32: añadido %s prendido y apagado, con su nombre de ADDON_NAMES', (addon) => {
    expect(companyEventText(evento('addon.enabled', { addon }))).toBe(`Prendió ${ADDON_NAMES[addon]}`);
    expect(companyEventText(evento('addon.disabled', { addon }))).toBe(`Apagó ${ADDON_NAMES[addon]}`);
  });

  it('R32: los nombres de los añadidos son los del tablero', () => {
    expect(companyEventText(evento('addon.disabled', { addon: 'importacion_excel' }))).toBe(
      'Apagó Importación desde Excel',
    );
    expect(companyEventText(evento('addon.enabled', { addon: 'lectura_pdf' }))).toBe(
      'Prendió Lectura de PDF con IA',
    );
  });

  it.each(['user.created', 'company.merged', '', 'cualquier cosa'])(
    'R33: un tipo desconocido («%s») se pinta con el texto generico, sin lanzar',
    (kind) => {
      expect(() => companyEventText(evento(kind))).not.toThrow();
      expect(companyEventText(evento(kind))).toBe('Registró un cambio');
    },
  );

  it('R33: una edicion con un campo desconocido da el texto generico con su nombre tecnico', () => {
    expect(companyEventText(evento('company.updated', { fields: ['billingCode'] }))).toBe(
      'Registró un cambio (billingCode)',
    );
    expect(companyEventText(evento('company.updated', { fields: ['name', 'billingCode'] }))).toBe(
      'Registró un cambio (Nombre y billingCode)',
    );
  });

  it('R33: una edicion sin campos da el texto generico', () => {
    expect(companyEventText(evento('company.updated', { fields: [] }))).toBe('Registró un cambio');
  });

  it('R33: un añadido desconocido da el texto generico con su nombre tecnico', () => {
    expect(companyEventText(evento('addon.enabled', { addon: 'facturacion' }))).toBe(
      'Registró un cambio (facturacion)',
    );
    expect(companyEventText(evento('addon.disabled', { addon: 'toString' }))).toBe(
      'Registró un cambio (toString)',
    );
  });

  it('R33: un evento de añadido sin añadido da el texto generico', () => {
    expect(companyEventText(evento('addon.enabled', { addon: null }))).toBe('Registró un cambio');
  });
});

describe('formatCompanyEventInstant', () => {
  it('R31: pinta el instante como dd/mm/aaaa HH:mm en UTC', () => {
    expect(formatCompanyEventInstant(new Date('2026-10-15T16:40:59.000Z'))).toBe('15/10/2026 16:40');
    expect(formatCompanyEventInstant(new Date('2026-01-02T03:04:00.000Z'))).toBe('02/01/2026 03:04');
  });
});
