'use server';

/**
 * Server Actions del proveedor IA de la empresa. No deciden nada: resuelven el actor, extraen el
 * `FormData` y traducen el resultado o el error. Ningun estado lleva la key ni su valor cifrado:
 * la vista se copia campo a campo, asi que un campo de mas en lo que devuelve el caso de uso no
 * llega a la pantalla.
 *
 * Se importa por su ruta exacta: un `'use server'` reexportado desde el barrel lo volveria
 * inimportable desde un componente de cliente.
 */

import { revalidatePath } from 'next/cache';

import { identity, integraciones, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  IntegracionesError,
  type Actor,
  type AiModelOption,
  type AiProviderConnectionView,
  type AiProviderEntry,
  type AiProviderReadiness,
  type AiProviderTestResult,
} from '@/lib/modules/integraciones';
import { runInRequestScope } from '@/lib/shared/request-scope';
import { AI_PROVIDER_INTEGRATION_ROUTE } from '@/lib/shared/routes';

export type AiProviderConnectionQueryResult =
  | {
      status: 'success';
      providers: AiProviderEntry[];
      connection: AiProviderConnectionView | null;
    }
  | ErrorState;

export type TestAiProviderKeyFormState =
  | { status: 'idle' }
  | { status: 'tested'; ok: true; elapsedMs: number }
  | { status: 'tested'; ok: false; message: string }
  | ErrorState;

export type TestSavedAiProviderFormState =
  | { status: 'idle' }
  | { status: 'tested'; ok: true; elapsedMs: number }
  | { status: 'tested'; ok: false; message: string }
  | { status: 'not_connected' }
  | ErrorState;

export type SaveAiProviderConnectionFormState =
  | { status: 'idle' }
  | { status: 'saved' }
  | { status: 'test_failed'; message: string }
  | ErrorState;

export type SelectAiModelFormState =
  | { status: 'idle' }
  | { status: 'saved' }
  | { status: 'not_connected' }
  | ErrorState;

export type DisconnectAiProviderFormState =
  | { status: 'idle' }
  | { status: 'disconnected' }
  | ErrorState;

const NOT_READY: AiProviderReadiness = { configured: false, canConfigure: false };

const toErrorState = createErrorStateTranslator(IntegracionesError, observabilidad.readRequestIdHeader);

async function currentActor(): Promise<Actor | null> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    permissions: sessionUser.permissions,
  };
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function buildKeyCandidate(formData: FormData): unknown {
  return {
    provider: readFormString(formData, 'provider'),
    apiKey: readFormString(formData, 'apiKey'),
  };
}

function toModelOptionState(option: AiModelOption): AiModelOption {
  return { modelId: option.modelId, isDefault: option.isDefault };
}

function toProviderState(entry: AiProviderEntry): AiProviderEntry {
  return {
    code: entry.code,
    name: entry.name,
    models: entry.models.map(toModelOptionState),
    defaultModel: entry.defaultModel,
  };
}

function toConnectionState(view: AiProviderConnectionView): AiProviderConnectionView {
  return {
    provider: view.provider,
    providerName: view.providerName,
    modelInUse: view.modelInUse,
    modelIsDefault: view.modelIsDefault,
    modelUnavailable: view.modelUnavailable,
    modelOptions: view.modelOptions.map(toModelOptionState),
    status: view.status,
    lastError: view.lastError,
    lastErrorAt: view.lastErrorAt,
    lastCheckedAt: view.lastCheckedAt,
    keyUpdatedAt: view.keyUpdatedAt,
  };
}

function toTestedState(
  result: AiProviderTestResult,
): { status: 'tested'; ok: true; elapsedMs: number } | { status: 'tested'; ok: false; message: string } {
  return result.ok
    ? { status: 'tested', ok: true, elapsedMs: result.elapsedMs }
    : { status: 'tested', ok: false, message: result.message };
}

function refreshScreen(): void {
  revalidatePath(AI_PROVIDER_INTEGRATION_ROUTE);
}

/** Catalogo de proveedores y conexion de la empresa. Consulta: sin argumentos. */
export async function getAiProviderConnectionAction(): Promise<AiProviderConnectionQueryResult> {
  const actor = await currentActor();

  try {
    const overview = await integraciones.getAiProviderConnection(actor);
    return {
      status: 'success',
      providers: overview.providers.map(toProviderState),
      connection: overview.connection === null ? null : toConnectionState(overview.connection),
    };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Prueba la key escrita sin guardar nada: no hay pantalla que revalidar. */
export async function testAiProviderKeyAction(
  prevState: TestAiProviderKeyFormState,
  formData: FormData,
): Promise<TestAiProviderKeyFormState> {
  void prevState;

  const actor = await currentActor();

  try {
    return toTestedState(await integraciones.testAiProviderKey(buildKeyCandidate(formData), actor));
  } catch (error) {
    return toErrorState(error);
  }
}

/** Una prueba de la conexion guardada escribe su estado, buena o fallida: se revalida igual. */
export async function testSavedAiProviderAction(
  prevState: TestSavedAiProviderFormState,
  formData: FormData,
): Promise<TestSavedAiProviderFormState> {
  void prevState;
  void formData;

  const actor = await currentActor();

  try {
    const result = await integraciones.testSavedAiProvider(actor);
    if (result.status === 'not_connected') return { status: 'not_connected' };
    refreshScreen();
    return toTestedState(result);
  } catch (error) {
    return toErrorState(error);
  }
}

export async function saveAiProviderConnectionAction(
  prevState: SaveAiProviderConnectionFormState,
  formData: FormData,
): Promise<SaveAiProviderConnectionFormState> {
  void prevState;

  const actor = await currentActor();

  try {
    const result = await integraciones.saveAiProviderConnection(buildKeyCandidate(formData), actor);
    if (result.status === 'test_failed') {
      return { status: 'test_failed', message: result.message };
    }
    refreshScreen();
    return { status: 'saved' };
  } catch (error) {
    return toErrorState(error);
  }
}

/**
 * Una consulta fallida no escribió nada, así que no hay pantalla que revalidar; su mensaje es el
 * de la prueba, no el del catálogo de errores.
 */
export async function selectAiModelAction(
  prevState: SelectAiModelFormState,
  formData: FormData,
): Promise<SelectAiModelFormState> {
  void prevState;

  const actor = await currentActor();

  try {
    const result = await integraciones.selectAiModel({ modelId: readFormString(formData, 'modelId') }, actor);
    if (result.status === 'not_connected') return { status: 'not_connected' };
    if (result.status === 'rejected') {
      return { status: 'error', code: 'ai_provider_error', message: result.message };
    }
    refreshScreen();
    return { status: 'saved' };
  } catch (error) {
    const state = await toErrorState(error);
    if (state.code === 'integration_secret_unreadable') {
      // La conexión no pasa a Error al elegir (R34): sin este registro nadie fuera de la pantalla
      // se enteraría. Solo la empresa: ni la key ni su valor cifrado. Se decide por el estado ya
      // traducido: mirar la clase del error es cosa del traductor único (guardia R23).
      console.error('ai_provider_select_secret_unreadable', { companyId: actor?.companyId ?? null });
    }
    return state;
  }
}

export async function disconnectAiProviderAction(
  prevState: DisconnectAiProviderFormState,
  formData: FormData,
): Promise<DisconnectAiProviderFormState> {
  void prevState;
  void formData;

  const actor = await currentActor();

  try {
    await integraciones.disconnectAiProvider(actor);
    refreshScreen();
    return { status: 'disconnected' };
  } catch (error) {
    return toErrorState(error);
  }
}

/**
 * La consultan las pantallas que suben PDF. Ante cualquier error responde «sin configurar» en vez
 * de romper la pagina: la emision de enlaces vuelve a comprobar la conexion en el servidor.
 */
export async function getAiProviderReadinessAction(): Promise<AiProviderReadiness> {
  try {
    const actor = await currentActor();
    const readiness = await integraciones.getAiProviderReadiness(actor);
    return { configured: readiness.configured, canConfigure: readiness.canConfigure };
  } catch {
    return NOT_READY;
  }
}
