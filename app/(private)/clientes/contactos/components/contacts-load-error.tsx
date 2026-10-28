'use client';

import { useRouter } from 'next/navigation';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import type { ErrorState } from '@/lib/modules/errores';
import { cn } from '@/lib/utils';

import { CHAT_PANEL_TEXT, CONTACTS_LOAD_ERROR_RETRY_TESTID, CONTACTS_LOAD_ERROR_TESTID } from './contact-texts';

export type ContactsLoadErrorProps = {
  readonly error: ErrorState;
  readonly className?: string;
};

// La carga inicial la hace el servidor: reintentar es volver a pedir la página.
export function ContactsLoadError({ error, className }: ContactsLoadErrorProps) {
  const router = useRouter();

  return (
    <ErrorAlert
      error={error}
      testId={CONTACTS_LOAD_ERROR_TESTID}
      className={cn('flex max-w-md flex-col gap-3 rounded-lg border border-destructive/40 bg-card p-4 text-sm', className)}
      after={
        <Button
          type="button"
          variant="outline"
          touch
          data-testid={CONTACTS_LOAD_ERROR_RETRY_TESTID}
          className="self-start"
          onClick={() => router.refresh()}
        >
          {CHAT_PANEL_TEXT.retry}
        </Button>
      }
    />
  );
}
