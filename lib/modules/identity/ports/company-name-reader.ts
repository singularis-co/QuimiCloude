export interface CompanyNameReader {
  /** Una empresa inexistente y una dada de baja responden igual: `null`. */
  findNameOf(companyId: string): Promise<string | null>;
}
