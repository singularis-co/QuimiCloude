import {
  createFindSupplyHomonyms,
  PRODUCT_TYPES,
  UnauthorizedError,
  type Actor,
  type SupplyHomonym,
} from '@/lib/modules/inventario';
import type { ProductRepository } from '@/lib/modules/inventario/ports/product-repository';

const ACTOR: Actor = { id: 'admin-1', companyId: 'company-a', permissions: ['inventario.modificar'] };

const GLICERINA: SupplyHomonym = {
  id: 'producto-1',
  name: 'Glicerina',
  type: PRODUCT_TYPES.PRODUCT,
  unitId: 'unidad-l',
  stock: '3.0000',
};

function montar() {
  const products = {
    findAliveSupplyHomonyms: vi.fn<ProductRepository['findAliveSupplyHomonyms']>(async () => [GLICERINA]),
  };
  return { products, findSupplyHomonyms: createFindSupplyHomonyms({ products }) };
}

describe('QC-203 — consulta de homónimos para el aviso del alta', () => {
  it('R11 sin inventario.modificar responde unauthorized sin consultar', async () => {
    const { products, findSupplyHomonyms } = montar();
    const soloConsulta: Actor = { ...ACTOR, permissions: ['inventario.consultar'] };

    for (const actor of [soloConsulta, null, undefined]) {
      const error = await findSupplyHomonyms('Glicerina', actor).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect((error as UnauthorizedError).code).toBe('unauthorized');
    }
    // Ni con una entrada que zod rechazaria: el permiso va primero.
    await expect(findSupplyHomonyms(42, null)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(products.findAliveSupplyHomonyms).not.toHaveBeenCalled();
  });

  it('R12 pasa al puerto la empresa del actor y nunca la de la entrada', async () => {
    const { products, findSupplyHomonyms } = montar();

    const resultado = await findSupplyHomonyms('  Glicerina  ', ACTOR);

    expect(resultado).toEqual([GLICERINA]);
    expect(products.findAliveSupplyHomonyms).toHaveBeenCalledTimes(1);
    expect(products.findAliveSupplyHomonyms).toHaveBeenCalledWith('Glicerina', { companyId: 'company-a' });

    // Un objeto con empresa no es un nombre: se rechaza sin llegar al puerto.
    await expect(findSupplyHomonyms({ name: 'Glicerina', companyId: 'company-b' }, ACTOR)).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(products.findAliveSupplyHomonyms).toHaveBeenCalledTimes(1);
  });

  it('nombre vacío devuelve [] sin consultar', async () => {
    const { products, findSupplyHomonyms } = montar();

    expect(await findSupplyHomonyms('', ACTOR)).toEqual([]);
    expect(await findSupplyHomonyms('   ', ACTOR)).toEqual([]);
    expect(products.findAliveSupplyHomonyms).not.toHaveBeenCalled();
  });
});
