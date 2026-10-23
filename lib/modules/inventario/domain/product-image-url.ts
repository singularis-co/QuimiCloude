import type { ProductView } from './product-view';

import type { ProductImageStorage } from '../ports/product-image-storage';

/** Sin almacenamiento cableado el producto sale tal cual: no se inventa ninguna URL. */
export function withImageUrl(
  product: ProductView,
  images: Pick<ProductImageStorage, 'publicUrl'> | undefined,
): ProductView {
  if (images === undefined) return product;
  return { ...product, imageUrl: product.imagePath === null ? null : images.publicUrl(product.imagePath) };
}
