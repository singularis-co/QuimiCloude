'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Addon } from '@/lib/modules/identity';
import { ADDON_DETAILS } from '@/lib/shared/ui/addon-details';
import { ADDON_NAMES } from '@/lib/shared/ui/addon-names';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { COMPANY_NO_MODULES_LABEL, companyModulesOverflowLabel } from './company-labels';

export const COMPANY_ADDON_AVATARS_LIMIT = 5;

export const COMPANY_ADDON_AVATAR_TESTID = 'company-addon-avatar';
export const COMPANY_ADDON_OVERFLOW_TESTID = 'company-addon-overflow';
export const COMPANY_ADDONS_TESTID = 'company-addons';

export type CompanyAddonAvatarsProps = {
  readonly addons: readonly Addon[];
  readonly limit?: number;
};

// Los iconos salen de ADDON_DETAILS, los mismos de la ficha de módulos; un test comprueba que
// coinciden con los del menú lateral en los añadidos que tienen item allí.
function AddonAvatar({ addon }: { readonly addon: Addon }) {
  const Icon = ADDON_DETAILS[addon].icon;
  const name = ADDON_NAMES[addon];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Avatar
            size="sm"
            role="img"
            className="ring-2 ring-background"
            aria-label={name}
            data-testid={COMPANY_ADDON_AVATAR_TESTID}
            data-addon={addon}
          />
        }
      >
        <AvatarFallback>
          <Icon aria-hidden="true" className="size-3.5" />
        </AvatarFallback>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

export function CompanyAddonAvatars({ addons, limit = COMPANY_ADDON_AVATARS_LIMIT }: CompanyAddonAvatarsProps) {
  if (addons.length === 0) {
    return (
      <span aria-label={COMPANY_NO_MODULES_LABEL} data-testid={COMPANY_ADDONS_TESTID} data-empty="true">
        {EMPTY_MARK}
      </span>
    );
  }

  const shown = addons.slice(0, limit);
  const restNames = addons.slice(limit).map((addon) => ADDON_NAMES[addon]);

  return (
    <div className="flex -space-x-1.5" data-testid={COMPANY_ADDONS_TESTID}>
      {shown.map((addon) => (
        <AddonAvatar key={addon} addon={addon} />
      ))}
      {restNames.length === 0 ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Avatar
                size="sm"
                role="img"
                className="ring-2 ring-background"
                aria-label={companyModulesOverflowLabel(restNames)}
                data-testid={COMPANY_ADDON_OVERFLOW_TESTID}
              />
            }
          >
            <AvatarFallback>+{restNames.length}</AvatarFallback>
          </TooltipTrigger>
          <TooltipContent>
            <ul>
              {restNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
