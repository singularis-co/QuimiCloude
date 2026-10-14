import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AI_PROVIDER_REQUIRED_NOTICE_ASK_TESTID,
  AI_PROVIDER_REQUIRED_NOTICE_LINK_TESTID,
  AI_PROVIDER_REQUIRED_NOTICE_TESTID,
  AiProviderRequiredNotice,
} from '@/components/shared/ai-provider-required-notice';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { AI_PROVIDER_INTEGRATION_ROUTE } from '@/lib/shared/routes';

const TEXTO_BLOQUEO =
  'Para leer PDF, conecta el proveedor IA de tu empresa. La lectura usa tu propia API key.';
const PEDIRLO = 'Pídele a un administrador que lo configure';

afterEach(cleanup);

describe('AiProviderRequiredNotice', () => {
  it('R37: con canConfigure pinta el texto de bloqueo y el enlace «Ir a Proveedor IA» a la pantalla de configuracion', () => {
    render(<AiProviderRequiredNotice canConfigure />);

    const aviso = screen.getByTestId(AI_PROVIDER_REQUIRED_NOTICE_TESTID);
    expect(aviso).toHaveAttribute('role', 'status');
    expect(aviso).toHaveAttribute('data-tone', 'info');
    expect(aviso).toHaveTextContent(TEXTO_BLOQUEO);
    expect(aviso.querySelector('strong')).toHaveTextContent(
      'Para leer PDF, conecta el proveedor IA de tu empresa.',
    );

    const enlace = screen.getByRole('link', { name: 'Ir a Proveedor IA' });
    expect(enlace).toBe(screen.getByTestId(AI_PROVIDER_REQUIRED_NOTICE_LINK_TESTID));
    expect(enlace).toHaveAttribute('href', AI_PROVIDER_INTEGRATION_ROUTE);
    expect(aviso).toContainElement(enlace);
    // Objetivo tactil de 44 px: la clase del sistema, no un alto suelto.
    for (const clase of touchTarget.split(/\s+/).filter(Boolean)) expect(enlace).toHaveClass(clase);

    expect(screen.queryByTestId(AI_PROVIDER_REQUIRED_NOTICE_ASK_TESTID)).toBeNull();
    expect(aviso).not.toHaveTextContent(PEDIRLO);
  });

  it('R37: sin canConfigure pinta el mismo texto y «Pídele a un administrador que lo configure», sin ningun enlace', () => {
    render(<AiProviderRequiredNotice canConfigure={false} />);

    const aviso = screen.getByTestId(AI_PROVIDER_REQUIRED_NOTICE_TESTID);
    expect(aviso).toHaveTextContent(TEXTO_BLOQUEO);
    expect(screen.getByTestId(AI_PROVIDER_REQUIRED_NOTICE_ASK_TESTID)).toHaveTextContent(PEDIRLO);

    expect(screen.queryByRole('link')).toBeNull();
    expect(aviso.querySelector('a')).toBeNull();
    expect(screen.queryByTestId(AI_PROVIDER_REQUIRED_NOTICE_LINK_TESTID)).toBeNull();
    expect(aviso).not.toHaveTextContent('Ir a Proveedor IA');
  });

  it('R37: los textos llegan por labels sin tocar la estructura', () => {
    render(
      <AiProviderRequiredNotice
        canConfigure
        labels={{ lead: 'Lead.', detail: 'Detalle.', link: 'Configurar', ask: 'Pedir' }}
      />,
    );

    expect(screen.getByTestId(AI_PROVIDER_REQUIRED_NOTICE_TESTID)).toHaveTextContent('Lead. Detalle.');
    expect(screen.getByRole('link', { name: 'Configurar' })).toHaveAttribute(
      'href',
      AI_PROVIDER_INTEGRATION_ROUTE,
    );
  });
});
