export type NewConditioningTeamMember = {
  readonly orderId: string;
  /** La linea del pedido que acondiciona este equipo. */
  readonly orderLineId: string;
  readonly userId: string;
  readonly companyId: string;
  readonly workGroupId: string | null;
  readonly workGroupName: string | null;
  readonly position: number;
};

export type ConditioningTeamMemberRow = {
  readonly userId: string;
  readonly workGroupId: string | null;
  readonly workGroupName: string | null;
};

export type ConditioningTeamMemberOfOrderRow = ConditioningTeamMemberRow & {
  readonly orderId: string;
  readonly orderLineId: string;
};

/** Solo insercion y lectura: el equipo guardado no se edita ni se borra. */
export interface ConditioningTeamRepository {
  /** Una sola sentencia. Lanza si la PK choca: el caso de uso nunca manda duplicados. */
  insertAll(rows: readonly NewConditioningTeamMember[]): Promise<number>;
  /** El equipo de esa linea del pedido, ordenado por `position`, que es el orden de composicion. */
  listByLineInCompany(
    companyId: string,
    orderId: string,
    orderLineId: string,
  ): Promise<readonly ConditioningTeamMemberRow[]>;
  /** Ordenadas por pedido y luego por `position`. Con `orderIds` vacio no consulta. */
  listByOrdersInCompany(
    companyId: string,
    orderIds: readonly string[],
  ): Promise<readonly ConditioningTeamMemberOfOrderRow[]>;
}
