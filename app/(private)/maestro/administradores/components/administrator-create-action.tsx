'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { ADMINISTRATOR_CREATE_TEXTS } from './administrator-labels';
import { AdministratorSheet } from './administrator-sheet';
import type { ActiveCompany } from './load-active-companies';

export const ADMINISTRATOR_CREATE_OPEN_TESTID = 'administrator-create-open';

export type AdministratorCreateActionProps = {
  readonly canModify: boolean;
  readonly companies: readonly ActiveCompany[];
};

export function AdministratorCreateAction({ canModify, companies }: AdministratorCreateActionProps) {
  const [open, setOpen] = useState(false);

  if (!canModify) return null;

  return (
    <>
      <Button
        type="button"
        touch
        data-testid={ADMINISTRATOR_CREATE_OPEN_TESTID}
        onClick={() => setOpen(true)}
      >
        <PlusIcon aria-hidden="true" />
        {ADMINISTRATOR_CREATE_TEXTS.open}
      </Button>
      {/* Montado solo mientras está abierto: cada apertura empieza en blanco. */}
      {open ? (
        <AdministratorSheet mode="create" companies={companies} open onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
