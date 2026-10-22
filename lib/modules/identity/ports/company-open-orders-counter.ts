export interface CompanyOpenOrdersCounter {
  countOpenOrders(companyId: string): Promise<number>;
}
