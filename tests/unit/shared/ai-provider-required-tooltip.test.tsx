import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AI_PROVIDER_REQUIRED_TOOLTIP_LINK_TESTID,
  AI_PROVIDER_REQUIRED_TOOLTIP_TESTID,
  AI_PROVIDER_REQUIRED_TOOLTIP_TRIGGER_TESTID,
  AiProviderRequiredTooltip,
} from '@/components/shared/ai-provider-required-tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AI_PROVIDER_INTEGRATION_ROUTE } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';

const MENSAJE = 'Para leer PDF, conecta el proveedor IA de tu empresa';

afterEach(cleanup);

function renderConBoton() {
  return render(
    <TooltipProvider>
      <AiProviderRequiredTooltip>
        <button type="button" disabled>
          Subir PDFs
        </button>
      </AiProviderRequiredTooltip>
    </TooltipProvider>,
  );
}

describe('AiProviderRequiredTooltip', () => {
  it('cerrado no pinta el globo y deja el boton deshabilitado dentro de un envoltorio enfocable', () => {
    renderConBoton();

    const envoltorio = screen.getByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_TRIGGER_TESTID);
    expect(envoltorio).toHaveAttribute('tabindex', '0');
    expect(envoltorio).toContainElement(screen.getByRole('button', { name: 'Subir PDFs' }));
    expect(screen.getByRole('button', { name: 'Subir PDFs' })).toBeDisabled();
    expect(screen.queryByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_TESTID)).toBeNull();
  });

  it('al pasar el puntero por el envoltorio muestra el texto y el enlace «Inscribir proveedor»', async () => {
    renderConBoton();
    const user = setupUser();

    await user.hover(screen.getByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_TRIGGER_TESTID));

    const globo = await screen.findByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_TESTID);
    expect(globo).toHaveTextContent(MENSAJE);
    const enlace = screen.getByRole('link', { name: 'Inscribir proveedor' });
    expect(enlace).toBe(screen.getByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_LINK_TESTID));
    expect(enlace).toHaveAttribute('href', AI_PROVIDER_INTEGRATION_ROUTE);
    expect(globo).toContainElement(enlace);
  });

  it('al enfocar el envoltorio con el teclado abre el globo y el envoltorio queda descrito por el', async () => {
    renderConBoton();
    const user = setupUser();

    await user.tab();

    const envoltorio = screen.getByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_TRIGGER_TESTID);
    expect(envoltorio).toHaveFocus();
    const globo = await screen.findByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_TESTID);
    expect(globo).toHaveTextContent(MENSAJE);
    expect(envoltorio).toHaveAccessibleDescription(MENSAJE);
  });

  it('acepta textos propios', async () => {
    render(
      <TooltipProvider>
        <AiProviderRequiredTooltip labels={{ message: 'Mensaje propio', link: 'Enlace propio' }}>
          <button type="button" disabled>
            Subir
          </button>
        </AiProviderRequiredTooltip>
      </TooltipProvider>,
    );
    const user = setupUser();

    await user.hover(screen.getByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_TRIGGER_TESTID));

    expect(await screen.findByTestId(AI_PROVIDER_REQUIRED_TOOLTIP_TESTID)).toHaveTextContent(
      'Mensaje propio',
    );
    expect(screen.getByRole('link', { name: 'Enlace propio' })).toHaveAttribute(
      'href',
      AI_PROVIDER_INTEGRATION_ROUTE,
    );
  });
});
