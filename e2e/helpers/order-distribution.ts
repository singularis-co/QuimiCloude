// Gestos de la UI de pedidos que comparten los E2E del reparto: elegir un envase en «Reparto en
// envases» y abrir una accion del menu de 3 puntos de una fila.
import { expect, type Locator, type Page } from '@playwright/test';

import { clickAndConfirm } from './confirm-dialog';
import { openRowActionsMenuItem } from './row-actions-menu';

export const DISTRIBUTION_FIELD_TESTID = 'order-distribution-field';
export const DISTRIBUTION_LINE_TESTID = 'order-distribution-line';
export const DISTRIBUTION_LINE_PACKAGES_TESTID = 'order-distribution-line-packages';
export const DISTRIBUTION_ADD_PACKAGES_TESTID = 'order-distribution-add-packages';
export const DISTRIBUTION_ADD_TESTID = 'order-distribution-add';
export const DISTRIBUTION_AVAILABLE_TESTID = 'order-distribution-available';
export const PACKAGING_SELECT_TESTID = 'packaging-select';
export const PACKAGING_OPTION_TESTID = 'packaging-option';
export const PACKAGING_OPTION_AVAILABLE_TESTID = 'packaging-option-available';
export const ORDER_ROW_ACTIONS_TESTID = 'order-row-actions';
export const ORDER_FORM_SUBMIT_TESTID = 'order-form-submit';
export const ORDER_LEFTOVER_DIALOG_TESTID = 'order-leftover-dialog';
export const ORDER_LEFTOVER_CONFIRM_TESTID = 'order-leftover-confirm';

export type PackagingChoice = { readonly productId: string; readonly name: string };

/** La opcion del selector de envases para ese producto, ya buscada por su nombre. */
export async function searchPackagingOption(
  page: Page,
  field: Locator,
  packaging: PackagingChoice,
): Promise<Locator> {
  const picker = field.getByTestId(PACKAGING_SELECT_TESTID);
  await picker.click();
  await picker.fill(packaging.name);
  const option = page.locator(
    `[data-testid="${PACKAGING_OPTION_TESTID}"][data-product-id="${packaging.productId}"]`,
  );
  await expect(option).toHaveCount(1, { timeout: 60_000 });
  return option;
}

/** La linea del reparto de ese envase. */
export function packagingLine(field: Locator, productId: string): Locator {
  return field.locator(
    `[data-testid="${DISTRIBUTION_LINE_TESTID}"][data-packaging-product-id="${productId}"]`,
  );
}

/** Elige el envase en el selector del reparto, escribe los envases y anade la linea. */
export async function addPackagingLine(
  page: Page,
  scope: Locator,
  packaging: PackagingChoice,
  packages: string,
): Promise<void> {
  const field = scope.getByTestId(DISTRIBUTION_FIELD_TESTID);
  const option = await searchPackagingOption(page, field, packaging);
  await option.click();

  await field.getByTestId(DISTRIBUTION_ADD_PACKAGES_TESTID).fill(packages);
  const add = field.getByTestId(DISTRIBUTION_ADD_TESTID);
  await expect(add).toBeEnabled({ timeout: 60_000 });
  await add.click();

  await expect(
    packagingLine(field, packaging.productId).getByTestId(DISTRIBUTION_LINE_PACKAGES_TESTID),
  ).toHaveValue(packages);
}

export async function openOrderRowMenu(
  page: Page,
  trigger: Locator,
  actionTestId: string,
): Promise<Locator> {
  return openRowActionsMenuItem(page, trigger, actionTestId);
}

/** El disparador del menu de 3 puntos dentro de una fila ya localizada. */
export function rowMenuTrigger(row: Locator): Locator {
  return row.getByTestId(ORDER_ROW_ACTIONS_TESTID);
}

/**
 * El disparador del menu de 3 puntos del pedido, por su identificador, dentro de su fila: la
 * tarjeta de la lista repite el disparador con el mismo `data-order-id`.
 */
export function orderMenuTrigger(page: Page, orderId: string): Locator {
  return page
    .getByTestId(`data-table-row-${orderId}`)
    .locator(`[data-testid="${ORDER_ROW_ACTIONS_TESTID}"][data-order-id="${orderId}"]`);
}

/**
 * Guarda un pedido cuyo reparto deja cantidad sin envasar: espera el disponible cotizado -antes,
 * Guardar no pregunta-, pulsa Guardar y confirma «Guardar con sobrante».
 */
export async function submitOrderWithLeftover(page: Page, form: Locator): Promise<void> {
  await expect(form.getByTestId(DISTRIBUTION_AVAILABLE_TESTID)).toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 60_000 },
  );
  await clickAndConfirm(page, form.getByTestId(ORDER_FORM_SUBMIT_TESTID), ORDER_LEFTOVER_CONFIRM_TESTID);
}
