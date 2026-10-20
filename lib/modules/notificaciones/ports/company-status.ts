/** Si la empresa existe y no está dada de baja. */
export interface CompanyStatus {
  isActive(companyId: string): Promise<boolean>;
}
