import type { CustomerPhoneIssue } from './customer-phone';

export type Customer = {
  readonly id: string;
  readonly firstNames: string;
  readonly lastNames: string;
  readonly city: string;
  readonly phone: string | null;
  readonly phoneCountry: string | null;
  readonly phoneE164: string | null;
  readonly phoneIssue: CustomerPhoneIssue | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly companyId: string;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};
