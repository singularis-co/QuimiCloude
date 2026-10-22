// Avatares de módulos de la lista de empresas: icono, nombre accesible, tooltip y «+N».
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  COMPANY_ADDON_AVATARS_LIMIT,
  CompanyAddonAvatars,
} from '@/app/(private)/maestro/empresas/components/company-addon-avatars';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ADDONS, type Addon } from '@/lib/modules/identity';
import { NAV_ICONS } from '@/lib/shared/navigation/nav-icons';
import { ADDON_DETAILS } from '@/lib/shared/ui/addon-details';
import { ADDON_NAMES } from '@/lib/shared/ui/addon-names';

import { setupUser } from '../../helpers/user-event';

function montar(addons: readonly Addon[], limit?: number): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <CompanyAddonAvatars addons={addons} limit={limit} />
    </TooltipProvider>,
  );
}

function tooltipsAbiertos(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="tooltip-content"]'));
}

afterEach(cleanup);

describe('CompanyAddonAvatars', () => {
  it('el límite visible es 5', () => {
    expect(COMPANY_ADDON_AVATARS_LIMIT).toBe(5);
  });

  it('pinta un avatar por añadido, con role img, aria-label con su nombre y su icono', () => {
    montar(ADDONS);
    const avatares = screen.getAllByTestId('company-addon-avatar');
    expect(avatares).toHaveLength(ADDONS.length);
    for (const [i, addon] of ADDONS.entries()) {
      const avatar = avatares[i];
      expect(avatar).toHaveAttribute('role', 'img');
      expect(avatar).toHaveAttribute('aria-label', ADDON_NAMES[addon]);
      expect(avatar?.querySelector('svg')).not.toBeNull();
    }
    expect(screen.queryByTestId('company-addon-overflow')).toBeNull();
  });

  it('los añadidos con item en el menú lateral usan el mismo icono que el menú', () => {
    expect(ADDON_DETAILS.dashboard.icon).toBe(NAV_ICONS['layout-dashboard']);
    expect(ADDON_DETAILS.proveedores.icon).toBe(NAV_ICONS.truck);
    expect(ADDON_DETAILS.integraciones.icon).toBe(NAV_ICONS.puzzle);
  });

  it('al pasar el puntero por un avatar se abre su tooltip con el nombre del módulo', async () => {
    const user = setupUser();
    montar(['proveedores']);
    await user.hover(screen.getByRole('img', { name: 'Proveedores' }));
    await waitFor(() =>
      expect(tooltipsAbiertos().some((popup) => popup.textContent === 'Proveedores')).toBe(true),
    );
  });

  it('pasado el límite muestra «+N» con los nombres restantes en su etiqueta y su tooltip', async () => {
    const user = setupUser();
    montar(ADDONS, 2);
    expect(screen.getAllByTestId('company-addon-avatar')).toHaveLength(2);
    const resto = ADDONS.slice(2).map((addon) => ADDON_NAMES[addon]);
    const overflow = screen.getByTestId('company-addon-overflow');
    expect(overflow).toHaveTextContent(`+${resto.length}`);
    expect(overflow).toHaveAttribute('role', 'img');
    expect(overflow).toHaveAttribute('aria-label', `${resto.length} módulos más: ${resto.join(', ')}`);

    await user.hover(overflow);
    await waitFor(() => {
      const popup = tooltipsAbiertos().find((p) => p.querySelector('ul') !== null);
      expect(popup).toBeDefined();
      expect(within(popup as HTMLElement).getAllByRole('listitem').map((li) => li.textContent)).toEqual(resto);
    });
  });

  it('sin añadidos pinta «—» con etiqueta «Sin módulos»', () => {
    montar([]);
    const vacio = screen.getByTestId('company-addons');
    expect(vacio.textContent).toBe('—');
    expect(vacio).toHaveAttribute('aria-label', 'Sin módulos');
    expect(screen.queryByTestId('company-addon-avatar')).toBeNull();
  });
});
