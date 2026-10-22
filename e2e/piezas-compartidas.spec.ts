/**
 * E2E de las piezas compartidas: el menú ⋯ de la última fila de una lista, en una ventana baja, se
 * abre hacia arriba y queda entero dentro de la ventana visible. jsdom no tiene layout, así que
 * esto solo se puede afirmar en un navegador.
 *
 * La lista es la de unidades: usa `RowActionsMenu` en cada fila propia de la empresa. Los datos
 * los crea este spec con el prefijo `qc256_e2e_` y el `RUN_ID` del worker, y la URL lleva la
 * búsqueda por ese prefijo, así que la lista solo trae lo de este worker.
 *
 * Los roles los siembra `pnpm run db:seed`; este spec no los crea.
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizeUnitName } from '@/lib/modules/unidades';
import { prisma } from '@/lib/shared/db/prisma';
import { UNITS_ROUTE } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';

const FIXTURE_PREFIX = 'qc256_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '').slice(0, 16);
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const UNIT_ROW_ACTIONS_TESTID = 'unit-row-actions';
/**
 * Las filas tienen que desbordar la ventana baja: si la página no tiene scroll, `scrollIntoView`
 * no puede llevar el último disparador al borde inferior y debajo queda sitio para el menú (con 4
 * unidades quedaban 117 px). 15 caben en una sola página con `pageSize=25` (`MAX_PAGE_SIZE`).
 */
const UNIT_COUNT = 15;

/** Ventana baja: la última fila queda cerca del borde inferior. */
const LOW_VIEWPORT = { width: 1280, height: 420 };

const unitPrefix = `${FIXTURE_PREFIX}u_${RUN_ID}`;
const companyName = `${FIXTURE_PREFIX}empresa_${RUN_ID}`;
const admin = {
  username: `${FIXTURE_PREFIX}admin_${RUN_ID}`,
  password: `Qc256-Admin-${RUN_ID.slice(0, 12)}`,
};

let companyId: string | null = null;

function unitsUrl(): string {
  const query = new URLSearchParams({ pageSize: '25', q: unitPrefix });
  return `${UNITS_ROUTE}?${query.toString()}`;
}

test.beforeAll(async () => {
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  await prisma.unit.deleteMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  await prisma.user.deleteMany({
    where: { username: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  await prisma.company.deleteMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });

  companyId = (
    await prisma.company.create({
      data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
      select: { id: true },
    })
  ).id;

  const role = await prisma.role.findUnique({ where: { name: ROLE_ADMINISTRADOR }, select: { id: true } });
  if (!role) {
    throw new Error(`falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\`.`);
  }

  await createFixtureUser({
    data: {
      firstNames: `Qc256${RUN_ID.slice(0, 8)}`,
      lastNames: 'Piezas',
      birthDate: new Date('1990-01-01'),
      email: `${admin.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: admin.username,
      username: admin.username,
      passwordHash: await createPasswordHash(admin.password),
      roleId: role.id,
      companyId,
    },
    select: { id: true },
  });

  for (let index = 1; index <= UNIT_COUNT; index += 1) {
    const name = `${unitPrefix}_${index}`;
    await prisma.unit.create({
      data: { name, nameNormalized: normalizeUnitName(name), companyId },
      select: { id: true },
    });
  }
});

test.afterAll(async () => {
  try {
    await prisma.unit.deleteMany({ where: { name: { startsWith: unitPrefix } } });
  } finally {
    try {
      await prisma.user.deleteMany({ where: { username: admin.username } });
    } finally {
      try {
        await prisma.company.deleteMany({ where: { name: companyName } });
      } finally {
        await prisma.$disconnect();
      }
    }
  }
});

test.setTimeout(180_000);

test.describe('menú de fila', () => {
  test('R33: en una ventana baja, el menú ⋯ de la última fila se abre hacia arriba y queda entero dentro de la ventana', async ({
    page,
  }) => {
    await loginAndLand(page, admin);
    await page.setViewportSize(LOW_VIEWPORT);
    await page.goto(unitsUrl());

    const triggers = page.getByTestId(UNIT_ROW_ACTIONS_TESTID);
    await expect(triggers).toHaveCount(UNIT_COUNT, { timeout: 60_000 });
    const lastTrigger = triggers.last();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const viewportHeight = viewport?.height ?? 0;

    const menu = page.getByRole('menu');
    let beforeBox: { x: number; y: number; width: number; height: number } | null = null;

    // Lleva el disparador al borde inferior de lo VISIBLE: justo encima de la paginación de la
    // tabla, que es `sticky` abajo. Con `scrollIntoView({ block: 'end' })` a secas el disparador
    // queda tapado por esa barra; `locator.click()` entonces desplaza la página hasta destaparlo
    // (al final, ~117 px sobre el borde) y debajo ya cabe el menú; en WebKit lo desplaza aunque
    // ya esté destapado. Por eso se sube el disparador lo justo para que asome sobre la
    // paginación, se comprueba que el punto de clic es suyo y se pulsa con el ratón en esas
    // coordenadas, que no desplaza la página. Se repite por si el layout aún se asienta.
    await expect(async () => {
      if ((await menu.count()) > 0) await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      const clickable = await lastTrigger.evaluate((element) => {
        element.scrollIntoView({ block: 'end' });
        const pagination = document.querySelector('[data-testid="data-table-pagination"]');
        const overlap =
          pagination === null
            ? 0
            : element.getBoundingClientRect().bottom - pagination.getBoundingClientRect().top;
        if (overlap > 0) window.scrollBy(0, Math.ceil(overlap));
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit !== null && element.contains(hit);
      });
      expect(clickable).toBe(true);
      const box = await lastTrigger.boundingBox();
      expect(box).not.toBeNull();
      if (box === null) return;
      beforeBox = box;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(menu).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });

    const openedSide = await menu.getAttribute('data-side');
    const openedTriggerBox = await lastTrigger.boundingBox();
    test.info().annotations.push({
      type: 'R33',
      description: JSON.stringify({ beforeBox, openedTriggerBox, dataSide: openedSide }),
    });

    await expect(async () => {
      const triggerBox = await lastTrigger.boundingBox();
      const menuBox = await menu.boundingBox();
      expect(beforeBox).not.toBeNull();
      expect(triggerBox).not.toBeNull();
      expect(menuBox).not.toBeNull();
      if (beforeBox === null || triggerBox === null || menuBox === null) return;
      const before: { y: number; height: number } = beforeBox;

      // Abrir el menú no mueve la página: el disparador sigue donde estaba antes del clic (WebKit
      // lo deja a ~1,3 px por redondeo; el salto que esto vigila es de decenas de píxeles).
      expect(Math.abs(triggerBox.y - before.y)).toBeLessThan(4);

      // Precondición: debajo del disparador no había sitio para el menú.
      expect(viewportHeight - (before.y + before.height)).toBeLessThan(menuBox.height);

      expect(menuBox.y).toBeGreaterThanOrEqual(0);
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewportHeight);
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(triggerBox.y + 1);
    }).toPass({ timeout: 10_000 });

    await expect(menu).toHaveAttribute('data-side', 'top');
  });
});
