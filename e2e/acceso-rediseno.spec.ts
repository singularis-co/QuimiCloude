/**
 * E2E del rediseño de las pantallas de acceso: `/login` y `/establecer-contrasena/<token>`.
 *
 * Solo estilo computado, medidas y estado del DOM: con moléculas girando sin parar, una captura
 * comparada sería intermitente por construcción. jsdom no compila la hoja de Tailwind ni resuelve
 * la cascada, así que las medidas, la animación y los tokens del tema solo existen aquí.
 *
 * La página de establecer contraseña no valida el enlace al pintarse: cualquier token sirve para
 * medirla. El rechazo por contraseñas que no coinciden lo decide el caso de uso antes de tocar la
 * base, así que tampoco necesita datos. Solo el estado de éxito («Ir a iniciar sesión») exige un
 * enlace de verdad, y lo saca del buzón de archivos como `establecer-contrasena.spec.ts`.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { identity } from '@/lib/composition';
import {
  CREDENTIAL_RULES,
  DOCUMENT_TYPE_CC,
  evaluateCredentialRules,
  normalizeCompanyName,
} from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';
import { THEME_COOKIE, THEME_DARK_CLASS } from '@/lib/shared/ui/theme-state';

const LOGIN_PATH = '/login';
const SET_CREDENTIAL_PATH = `/establecer-contrasena/${randomUUID()}`;

const MIN_TARGET_PX = 44;
const MIN_FONT_PX = 16;
const MIN_SIDE_GAP_PX = 16;
const MIN_CYCLE_S = 40;
const MAX_CYCLE_S = 90;

const WIDTHS = [390, 820, 1440] as const;
const VIEWPORT_HEIGHT = 900;

type Screen = {
  readonly name: string;
  readonly path: string;
  readonly ready: string;
  readonly maxCardWidth: number;
  readonly fields: readonly string[];
  readonly targets: readonly string[];
};

const SCREENS: readonly Screen[] = [
  {
    name: 'login',
    path: LOGIN_PATH,
    ready: 'login-form',
    maxCardWidth: 400,
    fields: ['login-username', 'login-password'],
    targets: ['login-submit', 'login-password-toggle', 'login-forgot-password'],
  },
  {
    name: 'establecer contraseña',
    path: SET_CREDENTIAL_PATH,
    ready: 'set-credential-form',
    maxCardWidth: 440,
    fields: ['set-credential-credential', 'set-credential-confirmation'],
    targets: [
      'set-credential-submit',
      'set-credential-credential-toggle',
      'set-credential-confirmation-toggle',
    ],
  },
];

// El primer `goto` compila la ruta en `next dev`.
test.setTimeout(180_000);

async function open(page: Page, screen: Screen, width: number): Promise<void> {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto(screen.path);
  await expect(page.getByTestId(screen.ready)).toBeVisible({ timeout: 120_000 });
}

async function seedTheme(context: BrowserContext, baseURL: string, value: 'light' | 'dark') {
  await context.addCookies([
    { name: THEME_COOKIE, value, domain: new URL(baseURL).hostname, path: '/' },
  ]);
}

async function px(locator: Locator, property: 'height' | 'fontSize'): Promise<number> {
  return locator.evaluate(
    (element, name) => Number.parseFloat(window.getComputedStyle(element)[name]),
    property,
  );
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, 'el elemento no tiene caja').not.toBeNull();
  return found as NonNullable<typeof found>;
}

function card(page: Page): Locator {
  return page.locator('[data-access="card"]');
}

for (const screen of SCREENS) {
  test.describe(`pantalla de ${screen.name}`, () => {
    test(`R3 — cada molécula gira en bucle infinito con un ciclo de ${MIN_CYCLE_S} a ${MAX_CYCLE_S} s`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await open(page, screen, 1440);

      const molecules = page.locator('[data-access="molecule"]');
      expect(await molecules.count()).toBeGreaterThan(0);

      const spins = await molecules.evaluateAll((elements) =>
        elements.map((element) => {
          const style = window.getComputedStyle(element);
          return {
            name: style.animationName,
            duration: style.animationDuration,
            iterations: style.animationIterationCount,
            running: element.getAnimations().some((animation) => animation.playState === 'running'),
          };
        }),
      );
      for (const spin of spins) {
        expect(spin.name).not.toBe('none');
        expect(spin.iterations).toBe('infinite');
        expect(spin.running).toBe(true);
        const seconds = Number.parseFloat(spin.duration);
        expect(spin.duration.endsWith('s') && !spin.duration.endsWith('ms')).toBe(true);
        expect(seconds).toBeGreaterThanOrEqual(MIN_CYCLE_S);
        expect(seconds).toBeLessThanOrEqual(MAX_CYCLE_S);
      }
    });

    test('R4 — con movimiento reducido las moléculas quedan visibles y quietas y los bloques sin desplazamiento', async ({
      page,
    }) => {
      // Antes de navegar, para que la media query ya esté resuelta en el primer cálculo de estilos.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, screen, 1440);

      const molecules = page.locator('[data-access="molecule"]');
      expect(await molecules.count()).toBeGreaterThan(0);
      for (const molecule of await molecules.all()) {
        await expect(molecule).toBeVisible();
        const still = await molecule.evaluate((element) => ({
          name: window.getComputedStyle(element).animationName,
          opacity: Number.parseFloat(window.getComputedStyle(element).opacity),
          running: element.getAnimations().length,
        }));
        expect(still).toEqual({ name: 'none', opacity: expect.any(Number), running: 0 });
        expect(still.opacity).toBeGreaterThan(0);
      }

      const blocks = await card(page).evaluate((element) =>
        Array.from(element.children)
          .filter((child) => window.getComputedStyle(child).display !== 'none')
          .map((child) => {
            const style = window.getComputedStyle(child);
            return { name: style.animationName, transform: style.transform, opacity: style.opacity };
          }),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toEqual({ name: 'none', transform: 'none', opacity: '1' });
      }
    });

    test('R6 — la tarjeta toma los tokens del tema claro y del oscuro, sin forzar el oscuro', async ({
      browser,
      baseURL,
    }) => {
      const painted: Record<'light' | 'dark', { background: string; color: string }> = {
        light: { background: '', color: '' },
        dark: { background: '', color: '' },
      };

      for (const theme of ['light', 'dark'] as const) {
        // El sistema dice lo contrario que la preferencia guardada: si la tarjeta siguiera al
        // sistema o forzara un modo, uno de los dos recorridos lo delataría.
        const context = await browser.newContext({
          colorScheme: theme === 'light' ? 'dark' : 'light',
        });
        try {
          await seedTheme(context, baseURL as string, theme);
          const page = await context.newPage();
          await open(page, screen, 1440);

          await expect
            .poll(() =>
              page.evaluate(
                (darkClass) => document.documentElement.classList.contains(darkClass),
                THEME_DARK_CLASS,
              ),
            )
            .toBe(theme === 'dark');

          const resolved = await card(page).evaluate((element, darkClass) => {
            const probe = document.createElement('div');
            probe.style.backgroundColor = 'var(--card)';
            probe.style.color = 'var(--card-foreground)';
            document.body.appendChild(probe);
            const own = window.getComputedStyle(element);
            const expected = window.getComputedStyle(probe);
            const result = {
              background: own.backgroundColor,
              color: own.color,
              expectedBackground: expected.backgroundColor,
              expectedColor: expected.color,
              forcedDark: element.closest(`.${darkClass}`) !== null && !document.documentElement.classList.contains(darkClass),
              cardToken: own.getPropertyValue('--card').trim(),
              appToken: window.getComputedStyle(document.documentElement).getPropertyValue('--card').trim(),
            };
            probe.remove();
            return result;
          }, THEME_DARK_CLASS);

          expect(resolved.background).toBe(resolved.expectedBackground);
          expect(resolved.color).toBe(resolved.expectedColor);
          expect(resolved.cardToken).toBe(resolved.appToken);
          expect(resolved.forcedDark).toBe(false);
          painted[theme] = { background: resolved.background, color: resolved.color };
        } finally {
          await context.close();
        }
      }

      expect(painted.light.background).not.toBe(painted.dark.background);
      expect(painted.light.color).not.toBe(painted.dark.color);
    });

    for (const width of WIDTHS) {
      test(`R7 — a ${width} px la tarjeta respeta los bordes y se centra en su ancho máximo`, async ({
        page,
      }) => {
        await open(page, screen, width);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        const cardBox = await box(card(page));
        const left = cardBox.x;
        const right = clientWidth - (cardBox.x + cardBox.width);

        if (width === 390) {
          expect(left).toBeGreaterThanOrEqual(MIN_SIDE_GAP_PX);
          expect(right).toBeGreaterThanOrEqual(MIN_SIDE_GAP_PX);
        } else {
          expect(Math.round(cardBox.width)).toBe(screen.maxCardWidth);
          expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
        }
      });

      test(`R8 — a ${width} px los campos miden 44 px y 16 px de letra y los controles 44 × 44 px`, async ({
        page,
      }) => {
        await open(page, screen, width);

        for (const testId of screen.fields) {
          const field = page.getByTestId(testId);
          await expect(field).toBeVisible();
          expect(await px(field, 'height'), testId).toBeGreaterThanOrEqual(MIN_TARGET_PX);
          expect(await px(field, 'fontSize'), testId).toBeGreaterThanOrEqual(MIN_FONT_PX);
        }

        for (const testId of screen.targets) {
          const target = page.getByTestId(testId);
          await expect(target).toBeVisible();
          const targetBox = await box(target);
          expect(targetBox.width, testId).toBeGreaterThanOrEqual(MIN_TARGET_PX);
          expect(targetBox.height, testId).toBeGreaterThanOrEqual(MIN_TARGET_PX);
        }
      });
    }
  });
}

test.describe('ojo del login', () => {
  test('R10 — alterna el tipo del campo y aria-pressed sin enviar el formulario', async ({ page }) => {
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') posts.push(request.url());
    });

    await open(page, SCREENS[0] as Screen, 1440);

    const password = page.getByTestId('login-password');
    const toggle = page.getByTestId('login-password-toggle');
    await password.fill('secreto-de-prueba');

    await expect(password).toHaveAttribute('type', 'password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveAttribute('aria-controls', (await password.getAttribute('id')) as string);
    await expect(toggle).toHaveAccessibleName('Mostrar la contraseña');

    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAccessibleName('Ocultar la contraseña');

    await toggle.click();
    await expect(password).toHaveAttribute('type', 'password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await expect(password).toHaveValue('secreto-de-prueba');
    expect(new URL(page.url()).pathname).toBe(LOGIN_PATH);
    expect(posts).toEqual([]);
  });
});

test.describe('requisitos tras un rechazo del servidor', () => {
  test('R20 — la lista de requisitos coincide con el valor visible de «Contraseña nueva» tras la respuesta', async ({
    page,
  }) => {
    await open(page, SCREENS[1] as Screen, 1440);

    const credential = page.getByTestId('set-credential-credential');
    await credential.fill('Abcdefg1#');
    await page.getByTestId('set-credential-confirmation').fill('Otra-distinta-9');
    await page.getByTestId('set-credential-submit').click();

    await expect(page.getByTestId('set-credential-confirmation-error')).toBeVisible({
      timeout: 120_000,
    });

    const visible = await credential.inputValue();
    const { unmet } = evaluateCredentialRules(visible);
    const expected = CREDENTIAL_RULES.map((rule) => ({
      rule,
      state: rule === 'breached' ? 'unknown' : unmet.includes(rule) ? 'unmet' : 'met',
    }));

    const list = page.locator(`#${await credential.getAttribute('id')}-requirements li`);
    const shown = await list.evaluateAll((items) =>
      items.map((item) => ({
        rule: item.getAttribute('data-rule'),
        state: item.getAttribute('data-state'),
      })),
    );
    expect(shown).toEqual(expected);
  });
});

/**
 * El estado de éxito necesita un enlace válido: alta sin contraseña por el caso de uso cableado y
 * el enlace del buzón de archivos, igual que `establecer-contrasena.spec.ts`. Datos propios con
 * `RUN_ID`, borrados en `afterAll` en el orden de las FK `RESTRICT`.
 */
test.describe('estado de éxito de establecer contraseña', () => {
  const RUN_ID = randomUUID().replace(/-/g, '');
  const USERNAME = `qc260_e2e_${RUN_ID}`;
  const ROLE_NAME = `qc260_e2e_rol_${RUN_ID}`;
  const COMPANY_NAME = `qc260_e2e_empresa_${RUN_ID}`;
  const OUTBOX_DIR = join(tmpdir(), 'qc260-e2e-outbox', RUN_ID);
  const NEW_CREDENTIAL = `Qc260-Enlace-${RUN_ID.slice(0, 8)}`;

  let roleId: string | null = null;
  let companyId: string | null = null;
  let userId: string | null = null;

  test.beforeAll(async () => {
    await rm(OUTBOX_DIR, { recursive: true, force: true });
    await mkdir(OUTBOX_DIR, { recursive: true });
    process.env.MAIL_TRANSPORT = 'outbox';
    process.env.MAIL_OUTBOX_DIR = OUTBOX_DIR;

    roleId = (
      await prisma.role.create({
        data: { name: ROLE_NAME, description: 'Rol efímero del E2E de acceso. Se borra en afterAll.' },
        select: { id: true },
      })
    ).id;
    companyId = (
      await prisma.company.create({
        data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
        select: { id: true },
      })
    ).id;
  });

  test.afterAll(async () => {
    try {
      if (userId) await prisma.credentialSetupToken.deleteMany({ where: { userId } });
    } catch {
      // se intenta borrar el usuario igualmente
    }
    try {
      await prisma.user.deleteMany({ where: { username: USERNAME } });
    } catch {
      // se intenta borrar el rol igualmente
    }
    try {
      await prisma.role.deleteMany({ where: { name: ROLE_NAME } });
    } catch {
      // se intenta borrar la empresa igualmente
    }
    try {
      await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
    } catch {
      // se limpia el buzón igualmente
    }
    await rm(OUTBOX_DIR, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  test('R8 — «Ir a iniciar sesión» mide al menos 44 × 44 px a 390, 820 y 1440 px', async ({
    page,
    baseURL,
  }) => {
    process.env.APP_BASE_URL = baseURL as string;

    const alta = await identity.createUser(
      { id: randomUUID(), companyId: companyId as string, permissions: ['usuarios.modificar'] },
      {
        firstNames: 'Persona',
        lastNames: 'Acceso Rediseno',
        birthDate: '1990-01-01',
        email: `${USERNAME}@example.test`,
        phone: '+573000000000',
        documentTypeCode: DOCUMENT_TYPE_CC,
        documentNumber: `qc260${RUN_ID}`,
        username: USERNAME,
        roleId: roleId as string,
      },
    );
    userId = alta.id;

    const files = await readdir(OUTBOX_DIR);
    expect(files).toHaveLength(1);
    const { url } = JSON.parse(await readFile(join(OUTBOX_DIR, files[0] as string), 'utf8')) as {
      url: string;
    };

    await page.setViewportSize({ width: 1440, height: VIEWPORT_HEIGHT });
    await page.goto(url);
    await expect(page.getByTestId('set-credential-form')).toBeVisible({ timeout: 120_000 });
    await page.getByTestId('set-credential-credential').fill(NEW_CREDENTIAL);
    await page.getByTestId('set-credential-confirmation').fill(NEW_CREDENTIAL);
    await page.getByTestId('set-credential-submit').click();

    const link = page.getByTestId('set-credential-login-link');
    await expect(link).toBeVisible({ timeout: 120_000 });

    // Cambiar el tamaño no remonta el árbol: el éxito sigue pintado en las tres anchuras.
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await expect(link).toBeVisible();
      const linkBox = await box(link);
      expect(linkBox.width, `${width} px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(linkBox.height, `${width} px`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    }
  });
});
