'use client';

import { TruckIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { DirectDeliverySheet } from './direct-delivery-sheet';

export const DIRECT_DELIVERY_OPEN_TESTID = 'direct-delivery-open';

const OPEN_LABEL = 'Entregar';

export type DirectDeliveryButtonProps = {
  readonly productId: string;
  readonly label?: string;
};

/** Abre el sheet de entrega sin pedido del producto. El sheet solo se monta mientras esta abierto. */
export function DirectDeliveryButton({ productId, label = OPEN_LABEL }: DirectDeliveryButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" touch onClick={() => setOpen(true)} data-testid={DIRECT_DELIVERY_OPEN_TESTID}>
        <TruckIcon aria-hidden="true" />
        {label}
      </Button>
      {open ? <DirectDeliverySheet productId={productId} open onOpenChange={setOpen} /> : null}
    </>
  );
}
