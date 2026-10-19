export interface CompanyMembershipReader {
  /** `true` solo si el usuario existe, no está dado de baja y es de esa empresa. */
  isUserInCompany(userId: string, companyId: string): Promise<boolean>;
}
