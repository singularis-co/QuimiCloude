export type PresentationQuantity = {
  readonly label: string;
  readonly quantity: number;
};

/** «10 galones, 5 vasos»: cantidad y nombre de cada presentacion, en el orden recibido. */
export function formatPresentationQuantities(items: readonly PresentationQuantity[]): string {
  return items.map((item) => `${item.quantity} ${item.label}`).join(', ');
}
