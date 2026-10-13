/**
 * E2E de la PIEL de la pantalla de login (QC-30, T9; nivel 3 de `design.md > 8`).
 *
 * Que aporta sobre lo que ya cubren los tests unitarios (`tests/unit/login-skin.test.tsx`):
 * un navegador de verdad, en los dos motores configurados (`playwright.config.ts` — chromium y
 * webkit, que es el de iOS). El nivel 1 lee `app/globals.css` como texto y el nivel 2 renderiza
 * el marcado en jsdom; ninguno de los dos puede afirmar el ALTO COMPUTADO de un campo, porque
 * jsdom no compila la hoja de Tailwind ni resuelve la cascada. Un `toHaveStyle('44px')` alli
 * seria teatro: el numero solo existe cuando un motor real ha aplicado las reglas.
 *
 * EL CORAZON DE LA FICHA. Los 44 px de R16 dependen de que el bloque de QC-30 este declarado
 * FUERA de toda `@layer`: en Tailwind v4 las utilidades viven en cascade layers y una regla sin
 * capa les gana. Si ese bloque hubiera caido dentro de `@layer base`, perderia contra el `h-8`
 * que traen `components/ui/input.tsx` y `components/ui/button.tsx`, y aqui saldrian 32 px. Este
 * archivo es lo unico del arnes que lo detecta de verdad.
 *
 * DATOS: NINGUNO. Este spec no crea ni borra una sola fila, no importa Prisma y no autentica:
 * navega a `/login` sin sesion y mide. `e2e/login.spec.ts` es el que ejercita el flujo critico
 * con fixtures de base de datos, y esta ficha lo deja intacto (R26, segunda mitad): colgar
 * aserciones de pixeles de aquel archivo anadiria riesgo a lo unico que no debe romperse.
 *
 * SIN SCREENSHOTS COMPARADOS. Con moleculas animadas de forma continua, una comparacion de imagen
 * seria intermitente por construccion. Todo se afirma con estilo computado, medidas y visibilidad
 * (ENMIENDA QC-260: el fondo, el movimiento y el tema del acceso los cubre
 * `e2e/acceso-rediseno.spec.ts`).
 */
import { expect, test, type Locator } from '@playwright/test';

/** Ruta publica del login (QC-10). No hay constante para ella en `lib/shared/routes.ts`. */
const LOGIN_PATH = '/login';

/** Medidas exigidas por `design-input-login.md > 3`, citadas por R16 y R23. */
const MIN_TOUCH_TARGET_PX = 44;
const MAX_CARD_WIDTH_PX = 400;
const MIN_INPUT_FONT_SIZE_PX = 16;

/** Viewports deterministas: no se confia en el default de cada `devices[...]`. */
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
/** Angosto de telefono (iPhone-ish), por debajo del `sm:` de 640 px y del `md:` de 768 px. */
const PHONE_VIEWPORT = { width: 390, height: 844 };

/** Alto computado en pixeles, tal como lo resolvio el motor tras aplicar la cascada. */
async function computedHeightPx(locator: Locator): Promise<number> {
  return locator.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).height),
  );
}

/** Tamano de letra computado en pixeles. */
async function computedFontSizePx(locator: Locator): Promise<number> {
  return locator.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
}

// Timeout amplio: el primer `goto` hace que `next dev` compile la ruta bajo demanda en el
// puerto propio del E2E. Un timeout corto aqui produce rojos que no son del codigo.
test.setTimeout(120_000);

test.describe('piel de la pantalla de login en navegador real', () => {
  test('presenta campos y boton con al menos 44 px de alto computado', async ({ page }) => {
    // R16, R23 — destinos tactiles. Si el bloque de QC-30 estuviera dentro de `@layer base`,
    // el `h-8` del primitivo ganaria y estas tres medidas serian 32 px.
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(LOGIN_PATH);

    const username = page.getByTestId('login-username');
    const password = page.getByTestId('login-password');
    const submit = page.getByTestId('login-submit');

    // Se espera a que el control este visible antes de medir: hasta que la hoja de estilos no
    // esta aplicada, el alto computado no significa nada.
    await expect(username).toBeVisible({ timeout: 60_000 });
    await expect(password).toBeVisible();
    await expect(submit).toBeVisible();

    expect(await computedHeightPx(username)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(await computedHeightPx(password)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(await computedHeightPx(submit)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    // El ancho tambien: 44 x 44 px es un area, no solo una altura.
    const submitBox = await submit.boundingBox();
    expect(submitBox, 'el boton de envio no tiene caja').not.toBeNull();
    expect(submitBox?.width ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  test('no deja crecer la tarjeta mas alla de 400 px en escritorio', async ({ page }) => {
    // R16, R22 — ancho maximo de la tarjeta con sitio de sobra en la ventana.
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(LOGIN_PATH);

    const card = page.locator('[data-slot="card"]');
    await expect(card).toBeVisible({ timeout: 60_000 });

    const cardBox = await card.boundingBox();
    expect(cardBox, 'la tarjeta del login no tiene caja').not.toBeNull();
    expect(cardBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(MAX_CARD_WIDTH_PX);
  });

  test('en viewport de telefono no provoca scroll horizontal y conserva 16 px de letra', async ({
    page,
  }) => {
    // R22, R23 — la ventana angosta es donde una tarjeta de ancho fijo desbordaria, y donde un
    // `font-size` por debajo de 16 px haria que iOS hiciera zoom al enfocar el campo.
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(LOGIN_PATH);

    const card = page.locator('[data-slot="card"]');
    await expect(card).toBeVisible({ timeout: 60_000 });

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // La tarjeta tampoco se sale del viewport por si sola.
    const cardBox = await card.boundingBox();
    expect(cardBox, 'la tarjeta del login no tiene caja').not.toBeNull();
    expect(cardBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(PHONE_VIEWPORT.width);

    // El primitivo trae `text-base` y solo baja a `text-sm` desde `md:`, o sea nunca en un
    // telefono; el bloque de QC-30 no toca el tamano de letra. Esto lo comprueba en el motor
    // real en vez de darlo por supuesto leyendo las clases.
    const username = page.getByTestId('login-username');
    expect(await computedFontSizePx(username)).toBeGreaterThanOrEqual(MIN_INPUT_FONT_SIZE_PX);

    // Y el destino tactil sigue siendo el mismo en angosto.
    expect(await computedHeightPx(username)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  // ENMIENDA QC-260: los casos de QC-226 R17-R22 (tres moleculas con `login-molecule-float`,
  // `data-login`, la entrada `login-card-enter` / `login-card-fade` de la tarjeta y los tokens
  // oscuros forzados) se retiran. El rediseño de acceso los sustituye y los cubre
  // `e2e/acceso-rediseno.spec.ts`: giro de las moleculas (R3), movimiento reducido (R4), tokens del
  // tema activo (R6) y medidas a 390, 820 y 1440 px (R7, R8).
});
