'use client';

import { DownloadIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { getInventoryImportTemplateAction } from '@/lib/modules/inventario/adapters/driving/inventory-import-actions';

import { base64Bytes, downloadFile } from './download-file';
import { TEMPLATE_BUTTON_LABEL, TEMPLATE_BUTTON_TESTID } from './import-texts';

/** La plantilla se arma en el servidor: su segunda hoja lleva los valores actuales de la empresa. */
export function ImportTemplateButton({ label = TEMPLATE_BUTTON_LABEL }: { readonly label?: string }) {
  const [pending, startTransition] = useTransition();

  function download(): void {
    startTransition(async () => {
      const result = await getInventoryImportTemplateAction();
      if (result.status !== 'success') {
        toast.error(result.message);
        return;
      }
      const { fileName, mimeType, base64 } = result.data;
      downloadFile({ fileName, mimeType, content: base64Bytes(base64) });
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      touch
      disabled={pending}
      aria-busy={pending}
      data-testid={TEMPLATE_BUTTON_TESTID}
      onClick={download}
    >
      <DownloadIcon aria-hidden />
      {label}
    </Button>
  );
}
