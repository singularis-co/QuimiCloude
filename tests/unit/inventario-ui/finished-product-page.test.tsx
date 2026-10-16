import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FinishedProductDetailPage from '@/app/(private)/inventario/producto-terminado/[id]/page';
import {
  TYPE_PARAM,
  parseProductListParams,
  productListHref,
} from '@/app/(private)/inventario/components';
import { PRODUCT_TYPES } from '@/lib/modules/inventario';
import type { FinishedProductResult } from '@/lib/modules/inventario/adapters/driving/finished-product-actions';
import { INVENTORY_ROUTE } from '@/lib/shared/routes';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import {
  FINISHED_PRODUCT_ERROR_STATES,
  FINISHED_PRODUCT_ID,
  finishedProductDetail,
} from '../../fixtures/finished-product-detail';

const { requirePagePermissionMock, getFinishedProductActionMock, listMock, routerMock } = vi.hoisted(
  () => ({
    requirePagePermissionMock: vi.fn<(permission: string) => Promise<void>>(),
    getFinishedProductActionMock: vi.fn<(id: string) => Promise<FinishedProductResult>>(),
    listMock: vi.fn(),
    routerMock: {
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    },
  }),
);

vi.mock('@/lib/modules/identity/adapters/driving/require-page-permission', () => ({
  requirePagePermission: requirePagePermissionMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/finished-product-actions', () => ({
  getFinishedProductAction: getFinishedProductActionMock,
  listFinishedProductBatchesAction: listMock,
  listFinishedProductMovementsAction: listMock,
  listFinishedProductDeliveriesAction: listMock,
  listFinishedProductCostsAction: listMock,
  listFinishedProductDistributionAction: listMock,
  listProducedProductsAction: listMock,
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

type Query = Record<string, string | undefined>;

async function renderPage(query: Query = {}) {
  const tree = await FinishedProductDetailPage({
    params: Promise.resolve({ id: FINISHED_PRODUCT_ID }),
    searchParams: Promise.resolve(query),
  });
  return render(tree);
}

const FINISHED_LIST_HREF = productListHref(
  parseProductListParams({ [TYPE_PARAM]: PRODUCT_TYPES.FINISHED_PRODUCT }),
);

beforeEach(() => {
  vi.clearAllMocks();
  requirePagePermissionMock.mockResolvedValue(undefined);
  getFinishedProductActionMock.mockResolvedValue({ status: 'success', data: finishedProductDetail() });
});

afterEach(cleanup);

describe('pagina de la ficha de producto terminado', () => {
  it('R1 — exige inventario.consultar antes de leer el producto', async () => {
    await renderPage();

    expect(requirePagePermissionMock).toHaveBeenCalledWith('inventario.consultar');
    expect(requirePagePermissionMock.mock.invocationCallOrder[0]).toBeLessThan(
      getFinishedProductActionMock.mock.invocationCallOrder[0],
    );
    expect(getFinishedProductActionMock).toHaveBeenCalledWith(FINISHED_PRODUCT_ID);
  });

  it('R6 — product_not_found pinta «no encontrado» con vuelta a la pestaña de terminados y sin tabs', async () => {
    getFinishedProductActionMock.mockResolvedValue(FINISHED_PRODUCT_ERROR_STATES.productNotFound);

    await renderPage({ tab: 'lotes' });

    const estado = screen.getByTestId('finished-product-not-found');
    const vuelta = within(estado).getByTestId('finished-product-back');
    expect(vuelta.tagName).toBe('A');
    expect(vuelta).toHaveAttribute('href', FINISHED_LIST_HREF);

    const url = new URL(vuelta.getAttribute('href') as string, 'http://local');
    expect(url.pathname).toBe(INVENTORY_ROUTE);
    expect(url.searchParams.get(TYPE_PARAM)).toBe(PRODUCT_TYPES.FINISHED_PRODUCT);

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByTestId('finished-product-name')).toBeNull();
    expect(screen.queryByTestId('finished-product-error')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('R6 — cualquier otro error pinta ErrorState con el mensaje del catalogo y sin datos', async () => {
    const error = FINISHED_PRODUCT_ERROR_STATES.unauthorized;
    getFinishedProductActionMock.mockResolvedValue(error);

    await renderPage({ tab: 'general' });

    expect(screen.getByTestId('finished-product-error')).toBeInTheDocument();
    expect(screen.getByTestId('finished-product-error-message')).toHaveTextContent(error.message);
    expect(screen.queryByTestId('finished-product-not-found')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByTestId('finished-product-general')).toBeNull();
    expect(screen.queryByText(finishedProductDetail().name)).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('R8, R26 — el exito pinta el nombre del producto y las ocho pestañas', async () => {
    await renderPage();

    expect(screen.getByTestId('finished-product-name')).toHaveTextContent(finishedProductDetail().name);
    expect(within(screen.getByRole('tablist')).getAllByRole('tab')).toHaveLength(8);
  });

  it('R10 — General muestra nombre, imagen, presentacion con su contenido, unidad base y alerta', async () => {
    await renderPage();

    const general = screen.getByTestId('finished-product-general');
    expect(within(general).getByTestId('finished-product-general-name')).toHaveTextContent(
      'Limpiador multiusos',
    );
    const imagen = within(general).getByTestId('finished-product-general-image');
    expect(imagen).toHaveAttribute('data-missing', 'true');
    expect(imagen).toHaveAttribute('alt', 'Limpiador multiusos');
    expect(within(general).getByTestId('finished-product-general-presentation')).toHaveTextContent(
      'Botella 1 L · 1 L',
    );
    expect(within(general).getByTestId('finished-product-general-unit')).toHaveTextContent('L');
    expect(within(general).getByTestId('finished-product-general-alert')).toHaveTextContent('5 L');
    expect(listMock).not.toHaveBeenCalled();
  });

  it('R10 — sin presentacion, sin unidad y sin alerta pinta la marca de ausencia; con imagen, la imagen', async () => {
    getFinishedProductActionMock.mockResolvedValue({
      status: 'success',
      data: finishedProductDetail({
        imagePath: '/imagenes/limpiador.png',
        presentation: null,
        unit: null,
        qtyAlert: null,
      }),
    });

    await renderPage({ tab: 'general' });

    expect(screen.getByTestId('finished-product-general-image')).toHaveAttribute(
      'src',
      '/imagenes/limpiador.png',
    );
    expect(screen.getByTestId('finished-product-general-presentation')).toHaveTextContent(EMPTY_MARK);
    expect(screen.getByTestId('finished-product-general-unit')).toHaveTextContent(EMPTY_MARK);
    expect(screen.getByTestId('finished-product-general-alert')).toHaveTextContent(EMPTY_MARK);
  });

  it('R11, R12 — Stock muestra el total en unidad base, los envases por contenido y la entrada sin envase', async () => {
    await renderPage({ tab: 'stock' });

    expect(screen.getByTestId('finished-product-stock-total')).toHaveTextContent('21.75 L');

    const envases = within(screen.getByTestId('finished-product-stock-packages')).getAllByRole(
      'listitem',
    );
    expect(envases.map((entrada) => entrada.textContent)).toEqual([
      '10 envases de 1 L + 0.5 L',
      '2 envases de 4 L + 1 L',
    ]);
    expect(screen.getByTestId('finished-product-stock-unpackaged')).toHaveTextContent('2.25 L');
    expect(screen.queryByTestId('finished-product-general')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('R12 — sin lotes sin envase no hay entrada «sin envase»; sin envases, la marca de ausencia', async () => {
    getFinishedProductActionMock.mockResolvedValue({
      status: 'success',
      data: finishedProductDetail({
        stock: { total: '0.0000', byPackageContent: [], withoutPackage: null },
      }),
    });

    await renderPage({ tab: 'stock' });

    expect(screen.getByTestId('finished-product-stock-total')).toHaveTextContent('0 L');
    expect(screen.queryByTestId('finished-product-stock-packages')).toBeNull();
    expect(screen.getByTestId('finished-product-stock-packages-empty')).toHaveTextContent(EMPTY_MARK);
    expect(screen.queryByTestId('finished-product-stock-unpackaged')).toBeNull();
  });
});
