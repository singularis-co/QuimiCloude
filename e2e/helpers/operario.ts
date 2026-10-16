/**
 * Helpers compartidos por los E2E de las pantallas del operario (`operario-rediseno.spec.ts` y
 * `pantalla-operario-rediseno.spec.ts`): medidas, esperas de animación, apertura de pantalla y
 * limpieza de la empresa efímera del fixture.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { prisma } from '@/lib/shared/db/prisma';

export const PHONE = { width: 390, height: 844 } as const;
export const DESKTOP = { width: 1440, height: 900 } as const;
export const MIN_TARGET_PX = 44;
export const MIN_FOOTER_BUTTON_PX = 52;
export const EDGE_TOLERANCE_PX = 1;

export const OPERATOR_HEADER = '[data-slot="operator-header"]';
export const OPERATOR_FOOTER = '[data-slot="operator-footer"]';

/** En el orden que imponen las FK RESTRICT; cada paso corre aunque falle el anterior. */
export async function deleteCompanyData(companyIds: readonly string[]): Promise<unknown> {
  if (companyIds.length === 0) return undefined;
  const ids = [...companyIds];
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.orderConditioningTeamMember.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.orderAssignment.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.orderExecutionEntry.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.orderPresentationLine.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.order.deleteMany({ where: { companyId: { in: ids } } }),
    // `recipe_lines.product_id` RESTRINGE el borrado del producto: las líneas caen antes (también
    // caerían con la receta, por CASCADE), y los productos después de la receta.
    () => prisma.recipeLine.deleteMany({ where: { recipe: { companyId: { in: ids } } } }),
    () => prisma.recipe.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.product.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.user.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.company.deleteMany({ where: { id: { in: ids } } }),
  ];
  let primerFallo: unknown;
  for (const paso of pasos) {
    try {
      await paso();
    } catch (error) {
      primerFallo ??= error;
    }
  }
  return primerFallo;
}

export async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, 'el elemento no tiene caja').not.toBeNull();
  return found as NonNullable<typeof found>;
}

export async function expectTarget(locator: Locator, label: string, minHeight = MIN_TARGET_PX): Promise<void> {
  await expect(locator, label).toBeVisible();
  const found = await box(locator);
  expect(found.width, `${label}: ancho`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(found.height, `${label}: alto`).toBeGreaterThanOrEqual(minHeight);
}

/**
 * Espera a que terminen las animaciones de entrada: medido a media animación, el diálogo aún escala.
 * Solo `CSSAnimation`: el anillo del botón con espera es una transición de 5 s.
 */
export async function waitForAnimationsToSettle(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter((anim) => anim instanceof CSSAnimation && anim.playState === 'running').length,
      ),
    )
    .toBe(0);
}

/**
 * Espera a que termine la entrada de pantalla (`screen-enter` en `app/globals.css`): mientras corre,
 * un ancestro del marco lleva `transform`, que pasa a ser el bloque contenedor del pie `fixed`, y el
 * pie se mide desplazado unos píxeles respecto al viewport. Se filtra por nombre porque otras
 * animaciones de la pantalla (el pulso del estado) son infinitas y nunca terminan.
 */
export async function waitForScreenEnterToSettle(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (anim) =>
                anim instanceof CSSAnimation && anim.animationName === 'screen-enter' && anim.playState !== 'finished',
            ).length,
      ),
    )
    .toBe(0);
}

/** En WebKit un clic antes de hidratar se pierde sin error: se repite hasta que aparece lo esperado. */
export async function clickUntilVisible(trigger: Locator, target: Locator): Promise<void> {
  await expect(async () => {
    if (!(await target.isVisible())) await trigger.click();
    await expect(target).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

export async function openScreen(page: Page, url: string, screenTestId: string): Promise<Locator> {
  const response = await page.goto(url);
  expect(response?.status(), `${url} debe responder 200`).toBe(200);
  const screen = page.getByTestId(screenTestId);
  await expect(screen).toBeVisible({ timeout: 60_000 });
  return screen;
}

/** Las columnas de la rejilla más cercana que contiene al ancla. */
export async function gridTracks(anchor: Locator): Promise<string[]> {
  return anchor.evaluate((el) => {
    let node: HTMLElement | null = el.parentElement;
    while (node !== null && window.getComputedStyle(node).display !== 'grid') node = node.parentElement;
    if (node === null) return [];
    return window.getComputedStyle(node).gridTemplateColumns.split(' ').filter((track) => track !== '');
  });
}

export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** Dos cajas se cortan si se solapan más de la tolerancia en los dos ejes. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > EDGE_TOLERANCE_PX && overlapY > EDGE_TOLERANCE_PX;
}
