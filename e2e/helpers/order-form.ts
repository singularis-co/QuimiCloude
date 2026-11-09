// Gestos del panel del pedido (tabla de recetas y sub-panel de una receta), del detalle y de las
// acciones de una receta del menu de la fila. Los comparten los E2E de pedidos.
import { expect, type Locator, type Page } from '@playwright/test';

import { addPackagingLine, orderMenuTrigger, type PackagingChoice } from './order-distribution';
import { openRowActionsMenuItem } from './row-actions-menu';

export const ORDER_CREATE_OPEN_TESTID = 'order-create-open';
export const ORDER_FORM_TESTID = 'order-form';
export const ORDER_FORM_SUBMIT_TESTID = 'order-form-submit';
export const ORDER_FORM_ADD_LINE_TESTID = 'order-form-add-line';
export const ORDER_FORM_LINES_ERROR_TESTID = 'order-form-lines-error';
export const ORDER_FORM_LINES_ERROR_ITEM_TESTID = 'order-form-lines-error-item';
export const ORDER_FORM_REVIEW_LINE_TESTID = 'order-form-review-line';
export const ORDER_FORM_SAVE_BLOCKED_TESTID = 'order-form-save-blocked';
export const ORDER_LINES_ROW_TESTID = 'order-lines-row';
export const ORDER_LINES_CARD_TESTID = 'order-lines-card';
export const ORDER_LINES_EDIT_TESTID = 'order-lines-edit';
export const ORDER_LINES_READ_ONLY_TESTID = 'order-lines-read-only';
export const ORDER_LINES_TOTAL_TESTID = 'order-lines-total';
export const ORDER_LINES_COST_TESTID = 'order-lines-cost';
export const ORDER_LINE_SHEET_TESTID = 'order-line-sheet';
export const ORDER_LINE_SHEET_APPLY_TESTID = 'order-line-sheet-apply';
export const ORDER_LINE_SHEET_DISCARD_TESTID = 'order-line-sheet-discard';
export const ORDER_LEFTOVER_CONFIRM_TESTID = 'order-leftover-confirm';
export const RECIPE_PICKER_TESTID = 'recipe-picker';
export const PRESENTATION_UNIT_SELECT_TESTID = 'presentation-unit-select';
export const PRESENTATION_UNIT_OPTION_TESTID = 'presentation-unit-option';
export const ORDER_DETAIL_SHEET_TESTID = 'order-detail-sheet';
export const ORDER_DETAIL_SUMMARY_TESTID = 'order-detail-summary';
export const ORDER_DETAIL_LINE_TESTID = 'order-detail-line';
export const ORDER_NUMBER_DETAIL_TESTID = 'order-number-detail';
export const ORDER_ACTION_EDIT_TESTID = 'order-action-edit';
export const ORDER_ACTION_DETAIL_TESTID = 'order-action-detail';
export const ORDER_ACTION_CANCEL_LINE_TESTID = 'order-action-cancel-line';
export const ORDER_LINE_PICKER_DIALOG_TESTID = 'order-line-picker-dialog';
export const ORDER_LINE_PICKER_OPTION_TESTID = 'order-line-picker-option';
export const CANCEL_ORDER_LINE_DIALOG_TESTID = 'cancel-order-line-dialog';
export const CANCEL_ORDER_LINE_REASON_TESTID = 'cancel-order-line-reason';
export const CANCEL_ORDER_LINE_CONFIRM_TESTID = 'cancel-order-line-confirm';

const TIMEOUT = 60_000;

/** Lo que se escribe en el sub-panel. Lo que falta se deja como viene. */
export type OrderLineInput = {
  readonly recipe?: { readonly id: string; readonly name: string };
  readonly quantity?: string;
  readonly unitId?: string;
  readonly packaging?: { readonly choice: PackagingChoice; readonly packages: string };
  /** `''` deja la receta sin precio. */
  readonly salePrice?: string;
};

/** El panel del pedido, alta o edicion. */
export function orderForm(page: Page): Locator {
  return page.getByTestId(ORDER_FORM_TESTID);
}

/** El sub-panel de una receta abierto. */
export function orderLineSheet(page: Page): Locator {
  return page.getByTestId(ORDER_LINE_SHEET_TESTID);
}

/**
 * Las recetas de la tabla del panel, en su orden, en la forma que se ve: filas en escritorio y
 * tablet, tarjetas en el telefono. Las dos van en el DOM.
 */
export function panelLines(form: Locator): Locator {
  return form.locator(
    `[data-testid="${ORDER_LINES_ROW_TESTID}"]:visible, [data-testid="${ORDER_LINES_CARD_TESTID}"]:visible`,
  );
}

/** La receta de la tabla del panel por su nombre. */
export function panelLine(form: Locator, recipeName: string): Locator {
  return panelLines(form).filter({ hasText: recipeName });
}

/** «Nuevo pedido» desde el listado ya cargado. En WebKit un clic antes de hidratar se pierde. */
export async function openCreateOrderPanel(page: Page): Promise<Locator> {
  const form = orderForm(page);
  await expect(async () => {
    if ((await form.count()) === 0) await page.getByTestId(ORDER_CREATE_OPEN_TESTID).first().click();
    await expect(form).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: TIMEOUT });
  return form;
}

/** «Editar» en el menu de la fila del pedido. */
export async function openEditOrderPanel(page: Page, orderId: string): Promise<Locator> {
  const item = await openRowActionsMenuItem(page, orderMenuTrigger(page, orderId), ORDER_ACTION_EDIT_TESTID);
  await item.click();
  const form = orderForm(page);
  await expect(form).toBeVisible({ timeout: TIMEOUT });
  return form;
}

/** «Añadir receta» en el panel. */
export async function openAddOrderLine(page: Page, form: Locator): Promise<Locator> {
  await form.getByTestId(ORDER_FORM_ADD_LINE_TESTID).click();
  const sheet = orderLineSheet(page);
  await expect(sheet).toBeVisible({ timeout: TIMEOUT });
  return sheet;
}

/** «Editar» de una receta de la tabla del panel. */
export async function openEditOrderLine(page: Page, form: Locator, recipeName: string): Promise<Locator> {
  await panelLine(form, recipeName).getByTestId(ORDER_LINES_EDIT_TESTID).click();
  const sheet = orderLineSheet(page);
  await expect(sheet).toBeVisible({ timeout: TIMEOUT });
  return sheet;
}

/** Elige la receta en el selector del sub-panel, buscada por su nombre. */
export async function chooseRecipe(
  page: Page,
  sheet: Locator,
  recipe: { readonly id: string; readonly name: string },
): Promise<void> {
  const picker = sheet.getByTestId(RECIPE_PICKER_TESTID);
  await picker.click();
  await picker.fill(recipe.name);
  const option = page.getByTestId(`${RECIPE_PICKER_TESTID}-option`).filter({ hasText: recipe.name });
  await expect(option).toHaveCount(1, { timeout: TIMEOUT });
  await option.click();
  await expect(sheet.getByTestId(`${RECIPE_PICKER_TESTID}-value`)).toHaveValue(recipe.id);
}

/** Elige la unidad de la receta en el sub-panel. */
export async function chooseLineUnit(page: Page, sheet: Locator, unitId: string): Promise<void> {
  await sheet.getByTestId(PRESENTATION_UNIT_SELECT_TESTID).click();
  await page.locator(`[data-testid="${PRESENTATION_UNIT_OPTION_TESTID}"][data-value="${unitId}"]`).click();
}

/** Escribe en el sub-panel los campos dados, en el orden del formulario. */
export async function fillOrderLine(page: Page, sheet: Locator, input: OrderLineInput): Promise<void> {
  if (input.recipe !== undefined) await chooseRecipe(page, sheet, input.recipe);
  if (input.quantity !== undefined) await sheet.getByTestId('order-field-quantity').fill(input.quantity);
  if (input.unitId !== undefined) await chooseLineUnit(page, sheet, input.unitId);
  if (input.packaging !== undefined) {
    await addPackagingLine(page, sheet, input.packaging.choice, input.packaging.packages);
  }
  if (input.salePrice !== undefined) await sheet.getByTestId('order-field-salePrice').fill(input.salePrice);
}

/**
 * «Aplicar» en el sub-panel y espera a que se cierre. Con reparto, espera antes el disponible
 * cotizado: hasta entonces «Aplicar» puede estar deshabilitado. `leftover: true` confirma
 * «Aplicar con sobrante».
 */
export async function applyOrderLine(
  page: Page,
  sheet: Locator,
  options: { readonly leftover?: boolean } = {},
): Promise<void> {
  const available = sheet.getByTestId('order-distribution-available');
  if ((await available.count()) > 0) {
    await expect(available).toHaveAttribute('data-state', 'ready', { timeout: TIMEOUT });
  }
  const apply = sheet.getByTestId(ORDER_LINE_SHEET_APPLY_TESTID);
  await expect(apply).toBeEnabled({ timeout: TIMEOUT });
  await apply.click();
  if (options.leftover === true) await page.getByTestId(ORDER_LEFTOVER_CONFIRM_TESTID).click();
  await expect(orderLineSheet(page)).toHaveCount(0, { timeout: TIMEOUT });
}

/** Añadir receta, rellenar y aplicar. Vuelve con la receta ya en la tabla del panel. */
export async function addOrderLine(
  page: Page,
  form: Locator,
  input: OrderLineInput,
  options: { readonly leftover?: boolean } = {},
): Promise<void> {
  const before = await panelLines(form).count();
  const sheet = await openAddOrderLine(page, form);
  await fillOrderLine(page, sheet, input);
  await applyOrderLine(page, sheet, options);
  await expect(panelLines(form)).toHaveCount(before + 1, { timeout: TIMEOUT });
}

/** «Guardar pedido» y espera a que el panel se cierre. */
export async function saveOrder(page: Page, form: Locator): Promise<void> {
  const submit = form.getByTestId(ORDER_FORM_SUBMIT_TESTID);
  await expect(submit).toBeEnabled({ timeout: TIMEOUT });
  await submit.click();
  await expect(orderForm(page)).toHaveCount(0, { timeout: TIMEOUT });
}

/** La fila del pedido en el listado. */
export function orderRow(page: Page, orderId: string): Locator {
  return page.getByTestId(`data-table-row-${orderId}`);
}

/** El detalle del pedido, abierto desde su numero en la fila. */
export async function openOrderDetail(page: Page, orderId: string): Promise<Locator> {
  const sheet = page.locator(`[data-testid="${ORDER_DETAIL_SHEET_TESTID}"][data-order-id="${orderId}"]`);
  await expect(async () => {
    if ((await sheet.count()) === 0) await orderRow(page, orderId).getByTestId(ORDER_NUMBER_DETAIL_TESTID).click();
    await expect(sheet).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: TIMEOUT });
  return sheet;
}

/** Cierra el panel o dialogo abierto con Escape y espera a que se vaya. */
export async function closeWithEscape(page: Page, opened: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(opened).toHaveCount(0, { timeout: TIMEOUT });
}

/**
 * Una accion de una receta desde el menu de la fila: abre el menu, elige la accion y, en el
 * selector, la receta por su id.
 */
export async function openOrderLineAction(
  page: Page,
  orderId: string,
  actionTestId: string,
  lineId: string,
): Promise<void> {
  const item = await openRowActionsMenuItem(page, orderMenuTrigger(page, orderId), actionTestId);
  await item.click();
  await pickOrderLine(page, lineId);
}

/** Elige una receta en el selector abierto. */
export async function pickOrderLine(page: Page, lineId: string): Promise<void> {
  const option = page
    .getByTestId(ORDER_LINE_PICKER_DIALOG_TESTID)
    .locator(`[data-testid="${ORDER_LINE_PICKER_OPTION_TESTID}"][data-line-id="${lineId}"]`);
  await expect(option).toBeVisible({ timeout: TIMEOUT });
  await expect(option).not.toHaveAttribute('aria-disabled', 'true');
  await option.click();
}

/** «Cancelar receta…» de una receta, con su motivo, y espera a que el dialogo se cierre. */
export async function cancelOrderLine(page: Page, orderId: string, lineId: string, reason: string): Promise<void> {
  await openOrderLineAction(page, orderId, ORDER_ACTION_CANCEL_LINE_TESTID, lineId);
  const dialog = page.getByTestId(CANCEL_ORDER_LINE_DIALOG_TESTID);
  await expect(dialog).toBeVisible({ timeout: TIMEOUT });
  await dialog.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID).fill(reason);
  await dialog.getByTestId(CANCEL_ORDER_LINE_CONFIRM_TESTID).click();
  await expect(dialog).toHaveCount(0, { timeout: TIMEOUT });
}
