import { z } from 'zod';

import type { UrlTabItem } from '@/components/shared/url-tabs';
import { maestroCompanyRoute } from '@/lib/shared/routes';

export const TAB_PARAM = 'tab';

export const COMPANY_DETAIL_TABS = ['datos', 'modulos', 'historial'] as const;
export type CompanyDetailTab = (typeof COMPANY_DETAIL_TABS)[number];

export const DEFAULT_COMPANY_DETAIL_TAB: CompanyDetailTab = 'datos';

export const COMPANY_DETAIL_TAB_LABELS: Readonly<Record<CompanyDetailTab, string>> = {
  datos: 'Datos',
  modulos: 'Módulos',
  historial: 'Historial',
};

export const COMPANY_DETAIL_TABS_LABEL = 'Secciones de la empresa';
export const COMPANY_DETAIL_TABS_TESTID = 'company-detail-tabs';

export function companyDetailTabTestId(tab: CompanyDetailTab): string {
  return `company-detail-tab-${tab}`;
}

export function companyDetailPanelTestId(tab: CompanyDetailTab): string {
  return `company-detail-panel-${tab}`;
}

export type CompanyDetailSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export type CompanyDetailParams = {
  readonly tab: CompanyDetailTab;
};

function firstValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

function isCompanyDetailTab(value: string | undefined): value is CompanyDetailTab {
  return COMPANY_DETAIL_TABS.some((tab) => tab === value);
}

export function parseCompanyDetailParams(raw: CompanyDetailSearchParams): CompanyDetailParams {
  const tab = firstValue(raw[TAB_PARAM]);
  return { tab: isCompanyDetailTab(tab) ? tab : DEFAULT_COMPANY_DETAIL_TAB };
}

const companyIdSchema = z.string().uuid();

// La misma regla que aplica el servidor: lo que no la cumple ni se le pregunta.
export function isCompanyId(raw: string): boolean {
  return companyIdSchema.safeParse(raw).success;
}

export function companyDetailTabItems(companyId: string): readonly UrlTabItem[] {
  return COMPANY_DETAIL_TABS.map((tab) => ({
    value: tab,
    href: maestroCompanyRoute(companyId, tab),
    label: COMPANY_DETAIL_TAB_LABELS[tab],
    testId: companyDetailTabTestId(tab),
  }));
}
