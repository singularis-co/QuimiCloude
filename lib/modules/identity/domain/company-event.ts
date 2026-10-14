export const COMPANY_EVENT_KINDS = [
  'company.created',
  'company.updated',
  'company.deleted',
  'company.reactivated',
] as const;
export type CompanyEventKind = (typeof COMPANY_EVENT_KINDS)[number];

// Debe ser la misma expresion que el CHECK de `company_events.kind`: la base vigila la forma y
// esta lista cerrada vigila los tipos conocidos.
export const EVENT_KIND_FORMAT = /^[a-z][a-z_]*\.[a-z][a-z_]*$/;

export const COMPANY_FIELDS = ['name', 'taxId', 'contactEmail', 'contactPhone', 'country'] as const;
export type CompanyField = (typeof COMPANY_FIELDS)[number];

export type CompanyEditable = { readonly [K in CompanyField]?: string | null };

/** Los campos que cambiaron, en el orden de `COMPANY_FIELDS`. Nunca sus valores. */
export function changedCompanyFields(
  before: CompanyEditable,
  after: CompanyEditable,
): CompanyField[] {
  return COMPANY_FIELDS.filter((field) => before[field] !== after[field]);
}
