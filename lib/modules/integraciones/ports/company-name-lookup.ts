/** El nombre de una empresa, o `null` si no existe o está dada de baja. */
export type CompanyNameLookup = (companyId: string) => Promise<string | null>;
