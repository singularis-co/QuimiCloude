'use client';

import { PlusIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { ResponsibleAvatars } from '@/components/shared/responsible-avatars';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { useEntitySheet } from '@/hooks/use-entity-sheet';
import type { OrderResponsible } from '@/lib/modules/asignaciones';
import type { OrderSummary } from '@/lib/modules/pedidos';
import type { MassVolumeBridge, UnitView } from '@/lib/modules/unidades';
// Solo el tipo: la arista pedidos -> inventario ya existe en el contrato del modulo.
import type { OrderCoverage } from '@/lib/modules/inventario';

import { CancelOrderDialog } from './cancel-order-dialog';
import { DeleteOrderDialog } from './delete-order-dialog';
import { OrderCustomerDialog } from './order-customer-dialog';
import { OrderDeliveriesSheet } from './order-deliveries-sheet';
import { OrderDeliverySheet } from './order-delivery-sheet';
import { OrderDistributionDialog, type OrderDistributionDraft } from './order-distribution-dialog';
import { OrderForm } from './order-form';
import {
  EMPTY_RESPONSIBLES_CATALOG,
  type OrderResponsiblesCatalog,
} from './order-responsibles';
import { OrderResponsiblesSheet } from './order-responsibles-sheet';
import type { OrderRowAction } from './order-row-actions';
import type { RecipePickerPage } from './recipe-picker';

/**
 * Panel lateral de alta y edicion de pedido.
 *
 * **Panel lateral, y no dialogo modal centrado ni pagina aparte**. Como no navega a ninguna URL, la lista de detras conserva **pagina, tamano, orden
 * y filtros** al cerrarse sin que haya que guardarlos en ningun sitio: el estado de lista vive en
 * la cadena de consulta.
 *
 * **El contenido se monta solo cuando el panel esta abierto** (lo hace el portal del primitivo):
 * el formulario se crea de cero en cada apertura, asi que la edicion siempre precarga los valores
 * actuales del pedido y un intento fallido anterior no deja restos.
 *
 * **La limpieza por apertura NO se deja al antojo del desmontaje** (2026-09-09): `OrderForm`
 * lleva una `key` que cambia en CADA apertura, de modo que aunque el cierre y la reapertura
 * ocurran dentro de la ventana de desmontaje del portal -su animacion de salida no habia acabado
 * cuando se vuelve a abrir- el formulario es una instancia nueva. Sin esto, el alta siguiente
 * podia heredar la receta y la cantidad del pedido anterior y se guardaba «crema 1» con el rótulo
 * del pedido viejo.
 *
 * **El panel lo pinta `OrderForm`, no este archivo.** Desde que el panel entero es un `<form>`
 * (`SheetContent isForm`), la cabecera, el cuerpo y el pie con el boton de guardar son partes del
 * mismo formulario, y quien tiene la `action` es `OrderForm`. Aqui quedan el disparador, el
 * estado de apertura y el cierre.
 *
 * **El cierre y el aviso viven aqui**: con exito se cierra, se avisa por toast -la region la monta el layout
 * privado y **no se monta otra**- y se llama a `router.refresh()`, que vuelve a ejecutar el Server
 * Component de la lista con la MISMA URL. **No hay `revalidatePath`**: exigiria abrir
 * `lib/modules/pedidos/adapters/driving/`, que esta pantalla no puede tocar; las propias actions
 * dejan a la pantalla decidir que revalida, y lo decide aqui.
 *
 * **Dos modos de apertura, un solo panel.** Sin `open`, el panel trae su propio disparador y su
 * propio estado -es el alta, y es lo que la seccion pone en la cabecera de la lista y en el slot
 * del estado vacio-. Con `open`/`onOpenChange`, el panel es CONTROLADO y no monta disparador: es
 * el enganche de la edicion desde el menu de la fila.
 */

export const ORDER_CREATE_OPEN_TESTID = 'order-create-open';
export const ORDER_SHEET_TESTID = 'order-sheet';

const TOUCH_TARGET = 'min-h-11 min-w-11';

const CREATE_LABEL = 'Nuevo pedido';
const CREATE_SUCCESS = 'Pedido creado.';
const UPDATE_SUCCESS = 'Pedido actualizado.';

export type OrderSheetProps = {
  /** Pedido que se edita. Ausente en el alta. */
  readonly order?: OrderSummary;
  /** Primera pagina del catalogo de recetas, por props. */
  readonly recipes: RecipePickerPage;
  /** Catalogo de unidades, por props: resuelve la unidad de los ingredientes. */
  readonly units: readonly UnitView[];
  readonly bridge: MassVolumeBridge | null;
  /** Apertura controlada desde fuera. Ausente = el panel trae su propio disparador de alta. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /**
   * La cobertura que la fila ya trajo. `undefined` cuando el lote fallo o el pedido es de alta
   * (no tiene id todavia): la hoja se degrada al marcador de ausencia, mismo criterio que
   * `responsibles`.
   */
  readonly coverage?: OrderCoverage;
};

export function OrderSheet({
  order,
  recipes,
  units,
  bridge,
  open,
  onOpenChange,
  coverage,
}: OrderSheetProps) {
  /** Instancia del formulario: cambia en cada apertura para que arranque SIEMPRE vacio (2026-09-09). */
  const [openKey, setOpenKey] = useState(0);
  const isEdit = order !== undefined;

  // La `key` avanza solo al abrir: si dependiera de `isOpen`, `handleSaved` cambiaria de identidad
  // y el efecto de exito del formulario se dispararia dos veces.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setOpenKey((key) => key + 1);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const { isOpen, isControlled, changeOpen, handleSaved } = useEntitySheet({
    open,
    onOpenChange: handleOpenChange,
    successMessage: isEdit ? UPDATE_SUCCESS : CREATE_SUCCESS,
  });

  return (
    <Sheet open={isOpen} onOpenChange={changeOpen}>
      {isControlled ? null : (
        <SheetTrigger
          render={
            <Button
              variant="default"
              className={TOUCH_TARGET}
              data-testid={ORDER_CREATE_OPEN_TESTID}
            />
          }
        >
          <PlusIcon aria-hidden="true" />
          {CREATE_LABEL}
        </SheetTrigger>
      )}
      <OrderForm
        key={openKey}
        order={order}
        recipes={recipes}
        units={units}
        bridge={bridge}
        onSaved={handleSaved}
        coverage={coverage}
      />
    </Sheet>
  );
}

export type OrderRowSheetActionsProps = {
  /** El pedido de la acción elegida. Se conserva al cerrar para que el panel anime su salida. */
  readonly order: OrderSummary;
  readonly action: OrderRowAction;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly recipes: RecipePickerPage;
  readonly units: readonly UnitView[];
  readonly bridge: MassVolumeBridge | null;
  /** Los responsables de este pedido, ya traídos por el lote de la sección. */
  readonly responsibles?: readonly OrderResponsible[];
  /** Catálogos y `canWrite`, compuestos una vez en el servidor. */
  readonly responsiblesCatalog?: OrderResponsiblesCatalog;
  /** La cobertura de este pedido, ya traída por el lote de la sección. */
  readonly coverage?: OrderCoverage;
  /** Si el actor puede anular entregas; lo resuelve el servidor. */
  readonly canVoidDelivery?: boolean;
};

/**
 * Monta el panel o el diálogo de la acción elegida en el menú de una fila. Uno por tabla: así
 * nunca hay dos abiertos y la tarjeta y la fila abren lo mismo.
 *
 * «Editar» abre el formulario y «Responsables», su propia hoja de solo lectura con la gestión de
 * responsables.
 * Cerrado, lo montado sigue en el árbol para animar la salida; cada apertura lo remonta para que
 * arranque sin el estado de la anterior.
 */
export function OrderRowSheetActions({
  order,
  action,
  open,
  onOpenChange,
  recipes,
  units,
  bridge,
  responsibles = [],
  responsiblesCatalog = EMPTY_RESPONSIBLES_CATALOG,
  coverage,
  canVoidDelivery = false,
}: OrderRowSheetActionsProps) {
  const [opening, setOpening] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpening((count) => count + 1);
  }
  // Atado a la instancia de `order`: cuando llega el refresco trae otra y lo guardado se descarta.
  const [savedDistribution, setSavedDistribution] = useState<{
    readonly order: OrderSummary;
    readonly draft: OrderDistributionDraft;
  } | null>(null);
  const pendingDistribution =
    savedDistribution?.order === order ? savedDistribution.draft : undefined;

  switch (action) {
    case 'edit':
      return (
        <OrderSheet
          key={opening}
          order={order}
          recipes={recipes}
          units={units}
          bridge={bridge}
          open={open}
          onOpenChange={onOpenChange}
          coverage={coverage}
        />
      );
    case 'responsibles':
      return (
        <OrderResponsiblesSheet
          key={opening}
          order={order}
          open={open}
          onOpenChange={onOpenChange}
          responsibles={responsibles}
          responsiblesCatalog={responsiblesCatalog}
        />
      );
    case 'cancel':
      return <CancelOrderDialog key={opening} order={order} open={open} onOpenChange={onOpenChange} />;
    case 'delete':
      return <DeleteOrderDialog key={opening} order={order} open={open} onOpenChange={onOpenChange} />;
    case 'distribution':
      return (
        <OrderDistributionDialog
          key={opening}
          order={order}
          units={units}
          open={open}
          onOpenChange={onOpenChange}
          saved={pendingDistribution}
          onSaved={(draft) => setSavedDistribution({ order, draft })}
        />
      );
    case 'customer':
      return <OrderCustomerDialog key={opening} order={order} open={open} onOpenChange={onOpenChange} />;
    case 'deliver':
      return (
        <OrderDeliverySheet
          key={opening}
          order={order}
          open={open}
          onOpenChange={onOpenChange}
        />
      );
    case 'deliveries':
      return (
        <OrderDeliveriesSheet
          key={opening}
          order={order}
          open={open}
          onOpenChange={onOpenChange}
          canVoid={canVoidDelivery}
        />
      );
  }
}

export type OrderRowResponsiblesProps = {
  readonly order: OrderSummary;
  /** Los responsables de ESTA fila, del lote que la seccion pidio una sola vez. */
  readonly responsibles: readonly OrderResponsible[];
  readonly responsiblesCatalog?: OrderResponsiblesCatalog;
};

/**
 * La celda de la columna de responsables: los avatares y, al pulsar el `+N`, la misma hoja que la
 * entrada «Responsables» del menu, que no depende de `:hover` ni del tooltip en tactil.
 *
 * Vive aqui y no en `ResponsibleAvatars`, que es presentacion pura y no conoce paneles. La hoja se
 * monta solo mientras esta abierta: con la celda cerrada no hay ninguna en el arbol de la fila.
 */
export function OrderRowResponsibles({
  order,
  responsibles,
  responsiblesCatalog = EMPTY_RESPONSIBLES_CATALOG,
}: OrderRowResponsiblesProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ResponsibleAvatars responsibles={responsibles} onShowAll={() => setOpen(true)} />
      {open ? (
        <OrderResponsiblesSheet
          order={order}
          open
          onOpenChange={setOpen}
          responsibles={responsibles}
          responsiblesCatalog={responsiblesCatalog}
        />
      ) : null}
    </>
  );
}
