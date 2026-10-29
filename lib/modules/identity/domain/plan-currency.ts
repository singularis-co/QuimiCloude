/**
 * Monedas en las que puede ir el precio de un plan de la plataforma. El `CHECK` de la tabla
 * `plans` repite esta lista porque una migración no puede importar TypeScript; un test estático
 * los compara. No es la moneda del costo de una empresa, que sigue sin guardarse.
 */
export const PLAN_CURRENCIES = ['CRC', 'USD'] as const;
export type PlanCurrency = (typeof PLAN_CURRENCIES)[number];
