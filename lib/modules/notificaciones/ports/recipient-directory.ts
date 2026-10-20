export interface RecipientDirectory {
  belongsToCompany(userId: string, companyId: string): Promise<boolean>;
}
