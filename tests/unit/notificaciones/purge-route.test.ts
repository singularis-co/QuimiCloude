// La tarea diaria que borra los avisos vencidos, invocada directo con un `Request`, sin levantar
// Next. La composición se dobla entera: el handler no puede tocar la base por su cuenta.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyCronSecret, listCompanyIds, purgeExpiredNotifications } = vi.hoisted(() => ({
  verifyCronSecret: vi.fn(),
  listCompanyIds: vi.fn(),
  purgeExpiredNotifications: vi.fn(),
}));

vi.mock('@/lib/composition', () => ({
  notificaciones: { verifyCronSecret, listCompanyIds, purgeExpiredNotifications },
}));

const { GET } = await import('@/lib/modules/notificaciones/adapters/driving/purge-route');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://app.invalida/api/cron/purgar-notificaciones', { headers });
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('notificaciones — la tarea diaria de borrado', () => {
  it('R17: sin el secreto responde 401 y no lee empresas ni borra', async () => {
    verifyCronSecret.mockReturnValue('unauthorized');

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(verifyCronSecret).toHaveBeenCalledWith(null);
    expect(listCompanyIds).not.toHaveBeenCalled();
    expect(purgeExpiredNotifications).not.toHaveBeenCalled();
  });

  it('R17: con un secreto que no casa responde 401', async () => {
    verifyCronSecret.mockReturnValue('unauthorized');

    const response = await GET(request({ authorization: 'Bearer mal' }));

    expect(response.status).toBe(401);
    expect(verifyCronSecret).toHaveBeenCalledWith('Bearer mal');
    expect(purgeExpiredNotifications).not.toHaveBeenCalled();
  });

  it('R17: sin CRON_SECRET configurado responde 500 y no borra', async () => {
    verifyCronSecret.mockReturnValue('misconfigured');

    const response = await GET(request({ authorization: 'Bearer cualquiera' }));

    expect(response.status).toBe(500);
    expect(listCompanyIds).not.toHaveBeenCalled();
    expect(purgeExpiredNotifications).not.toHaveBeenCalled();
  });

  it('R17: con el secreto hace una llamada a borrar por empresa, de una en una', async () => {
    verifyCronSecret.mockReturnValue('ok');
    listCompanyIds.mockResolvedValue([A, B, C]);
    let running = 0;
    let maxRunning = 0;
    purgeExpiredNotifications.mockImplementation(async (companyId: string) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      running -= 1;
      return { deleted: companyId === B ? 2 : 1 };
    });

    const response = await GET(request({ authorization: 'Bearer bueno' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 4 });
    expect(purgeExpiredNotifications.mock.calls).toEqual([[A], [B], [C]]);
    expect(maxRunning).toBe(1);
  });

  it('R17: si falla una empresa sigue con las demás y responde 500', async () => {
    verifyCronSecret.mockReturnValue('ok');
    listCompanyIds.mockResolvedValue([A, B, C]);
    purgeExpiredNotifications.mockImplementation(async (companyId: string) => {
      if (companyId === B) throw new Error('sin conexión');
      return { deleted: 1 };
    });

    const response = await GET(request({ authorization: 'Bearer bueno' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ deleted: 2, failedCount: 1 });
    expect(purgeExpiredNotifications).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith('notification_purge_failed', { companyId: B, error: 'Error' });
  });

  it('R17: sin empresas no borra nada y responde 200', async () => {
    verifyCronSecret.mockReturnValue('ok');
    listCompanyIds.mockResolvedValue([]);

    const response = await GET(request({ authorization: 'Bearer bueno' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 0 });
  });

  it('R17: la tarea está declarada en vercel.json una vez al día', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: readonly { path: string; schedule: string }[];
    };
    const tasks = (config.crons ?? []).filter((c) => c.path === '/api/cron/purgar-notificaciones');

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it('R17: la ruta reexporta el handler y declara runtime nodejs con un literal', () => {
    const source = readFileSync(
      join(process.cwd(), 'app', 'api', 'cron', 'purgar-notificaciones', 'route.ts'),
      'utf8',
    );

    expect(source).toContain("export { GET } from '@/lib/modules/notificaciones/adapters/driving/purge-route';");
    expect(source).toMatch(/^export const runtime = 'nodejs';$/m);
  });
});
