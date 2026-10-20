'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { CompanyCreateSheet } from './company-create-sheet';
import { COMPANY_CREATE_TEXTS } from './company-labels';

export const COMPANY_CREATE_OPEN_TESTID = 'company-create-open';

export type CompanyCreateActionProps = {
  readonly canModify: boolean;
};

export function CompanyCreateAction({ canModify }: CompanyCreateActionProps) {
  const [open, setOpen] = useState(false);

  if (!canModify) return null;

  return (
    <>
      <Button
        type="button"
        touch
        data-testid={COMPANY_CREATE_OPEN_TESTID}
        onClick={() => setOpen(true)}
      >
        <PlusIcon aria-hidden="true" />
        {COMPANY_CREATE_TEXTS.open}
      </Button>
      {/* Montado solo mientras está abierto: cada apertura empieza en blanco. */}
      {open ? <CompanyCreateSheet open onOpenChange={setOpen} /> : null}
    </>
  );
}
