// Pulsar un control que pide confirmacion y confirmar. Terminar el empaque confirma sin tocar el
// conteo, que viene con el plan.
import { expect, type Locator, type Page } from '@playwright/test';

export const ORDER_EXECUTION_START_BUTTON_TESTID = 'order-execution-start-button';
export const ORDER_EXECUTION_START_CONFIRM_TESTID = 'order-execution-start-confirm';
export const ORDER_EXECUTION_FINISH_CONFIRM_TESTID = 'order-execution-finish-confirm';
export const PACKING_ORDER_START_CONFIRM_TESTID = 'packing-order-start-confirm';
export const PACKING_ORDER_FINISH_CONFIRM_TESTID = 'packing-order-finish-confirm';

/**
 * Pulsa el disparador y confirma en el dialogo. El dialogo se monta en un portal fuera del
 * disparador, asi que el boton se busca en la pagina. En WebKit un clic antes de hidratar se
 * pierde sin error: se repite hasta que el dialogo aparece.
 */
export async function clickAndConfirm(
  page: Page,
  trigger: Locator,
  confirmTestId: string,
): Promise<void> {
  const confirm = page.getByTestId(confirmTestId);
  await expect(async () => {
    if ((await confirm.count()) === 0) await trigger.click();
    await expect(confirm).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await confirm.click();
}

/**
 * «Entrar» desde la lista y, ya en la pantalla de ejecucion, «Comenzar» y confirmar, como lo haria
 * el Operador. Entrar es un enlace y no comienza nada; vuelve cuando el pie de «Comenzar» ya se fue,
 * es decir, con el pedido `EN_CURSO` en base.
 */
export async function enterAndStartAssignedOrder(page: Page, enter: Locator): Promise<void> {
  await enter.click();
  const start = page.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID);
  await expect(start).toBeVisible({ timeout: 60_000 });
  await clickAndConfirm(page, start, ORDER_EXECUTION_START_CONFIRM_TESTID);
  await expect(start).toHaveCount(0, { timeout: 60_000 });
}
