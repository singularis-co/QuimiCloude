import { requirePermission, type Actor } from './actor';
import { ActionNotAllowedError, ProductNotFoundError, ValidationError } from './errors';
import { validateProductImage } from './product-image';
import { updateProductSchema } from './product-input';

import type { InventoryScope } from './inventory-scope';
import type { ProductImageStorage, ProductImageUpload } from '../ports/product-image-storage';
import type { ProductRepository } from '../ports/product-repository';

export type UpdateProductDeps = {
  readonly products: ProductRepository;
  /** Donde vive la imagen. Sin el, una edicion que toca la imagen falla. */
  readonly images?: ProductImageStorage;
  /** Ver el comentario identico en `create-product.ts` sobre el origen de este reloj. */
  readonly now?: () => Date;
};

/** Un borrado de la imagen anterior que fallo despues de guardar la edicion. */
export type ProductImageWarning = {
  readonly operation: 'remove';
  readonly path: string;
  readonly message: string;
};

export type UpdateProductResult = {
  readonly warnings: readonly ProductImageWarning[];
};

/**
 * La edicion ya esta guardada cuando se borra el archivo anterior: si el borrado falla no se
 * deshace, se devuelve como advertencia con la ruta para que quien llama la registre.
 */
async function removeImageSafely(
  images: ProductImageStorage,
  path: string,
): Promise<ProductImageWarning | null> {
  try {
    await images.remove(path);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { operation: 'remove', path, message };
  }
}

/**
 * Edicion de producto. Reemplazo completo de lo que queda editable, y se guarda TAL
 * CUAL, sin derivarlo ni recalcularlo. La existencia no se lee ni se escribe aqui: es
 * del lote. La autoria ya no se registra aqui: se mudo al lote (`ProductBatch`) el
 * 2026-09-09, asi que el actor solo sirve para el permiso y para la EMPRESA en cuyo
 * nombre se edita.
 *
 * QC-49 (R16): el ambito viaja al puerto y entra en el `where` del `UPDATE`, no en un `if`
 * posterior sobre una fila ya leida. Un `id` de otra empresa devuelve `false` -el mismo camino
 * que «no existe» y que «ya borrado»- y se traduce a `ProductNotFoundError`, nunca a un error
 * de autorizacion; y no se modifica ninguna fila, ni de la empresa de quien pide ni de la otra.
 *
 * La imagen tiene tres estados: ausente no la toca, `null` la quita y `{ bytes }` la reemplaza.
 * La nueva se sube antes de guardar y la anterior se borra despues.
 */
export function createUpdateProduct(
  deps: UpdateProductDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<UpdateProductResult> {
  const now = deps.now ?? (() => new Date());

  return async function updateProduct(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<UpdateProductResult> {
    requirePermission(actor, 'inventario.modificar');

    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { image, ...campos } = parsed.data;
    const scope: InventoryScope = { companyId: actor.companyId };

    if (image === undefined) {
      await guardar(deps, id, campos, now(), scope);
      return { warnings: [] };
    }

    let nueva: ProductImageUpload | null = null;
    if (image !== null) {
      const validation = validateProductImage(image.bytes);
      if (!validation.ok) throw new ValidationError(`image: ${validation.reason}`);
      nueva = { bytes: image.bytes, contentType: validation.contentType, extension: validation.extension };
    }

    const images = deps.images;
    if (images === undefined) {
      throw new Error('edicion de la imagen de producto sin almacenamiento: falta el cableado');
    }

    // La ruta anterior solo se puede saber leyendo la fila: sin ella no hay que borrar.
    const existente = await deps.products.findAliveById(id, scope);
    if (existente === null) throw new ProductNotFoundError();

    const imagePath = nueva === null ? null : await images.upload(nueva);
    await guardar(deps, id, { ...campos, imagePath }, now(), scope);

    const warnings: ProductImageWarning[] = [];
    if (existente.imagePath !== null) {
      const warning = await removeImageSafely(images, existente.imagePath);
      if (warning !== null) warnings.push(warning);
    }
    return { warnings };
  };
}

async function guardar(
  deps: UpdateProductDeps,
  id: string,
  data: Parameters<ProductRepository['updateAlive']>[1],
  instante: Date,
  scope: InventoryScope,
): Promise<void> {
  const updated = await deps.products.updateAlive(id, data, instante, scope);
  if (updated === 'type_locked') throw new ActionNotAllowedError();
  if (!updated) throw new ProductNotFoundError();
}
