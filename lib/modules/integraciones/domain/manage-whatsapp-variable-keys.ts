import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import {
  ValidationError,
  WhatsappVariableKeyInUseError,
  WhatsappVariableKeyNotFoundError,
} from './errors';
import { scopeOf } from './integraciones-scope';
import {
  validateWhatsappVariableKeyInput,
  type WhatsappDictionaryEntryView,
  type WhatsappVariableKeyInput,
  type WhatsappVariableKeyRecord,
} from './whatsapp-variable-key';

import type { WhatsappVariableKeyRepository } from '../ports/whatsapp-variable-key-repository';

export type ManageWhatsappVariableKeysDeps = {
  readonly variableKeys: WhatsappVariableKeyRepository;
};

const variableKeyIdSchema = z.string().uuid();

/** Campo a campo: la vista no lleva la empresa ni la fecha de alta. */
function toDictionaryEntryView(record: WhatsappVariableKeyRecord, usedBy: number): WhatsappDictionaryEntryView {
  return { id: record.id, key: record.key, label: record.label, value: record.value, usedBy };
}

// Una clave con punto es de constante y no pasa el validador de la propia: no hace falta catálogo.
function validInputOf(input: unknown): WhatsappVariableKeyInput {
  const validated = validateWhatsappVariableKeyInput(input);
  if (!validated.ok) {
    const codes = validated.issues.map((issue) => `${issue.field}:${issue.code}`).join(', ');
    throw new ValidationError(`variable propia: ${codes}`);
  }
  return validated.value;
}

/** Solo las variables propias: las constantes las define el front. */
export function createListWhatsappDictionary(
  deps: ManageWhatsappVariableKeysDeps,
): (actor: Actor | null | undefined) => Promise<readonly WhatsappDictionaryEntryView[]> {
  return async function listWhatsappDictionary(actor) {
    requirePermission(actor);
    const entries = await deps.variableKeys.listWithUsage(scopeOf(actor));
    return entries.map((entry) => toDictionaryEntryView(entry, entry.usedBy));
  };
}

export function createCreateWhatsappVariableKey(
  deps: ManageWhatsappVariableKeysDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappDictionaryEntryView> {
  return async function createWhatsappVariableKey(input, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    const value = validInputOf(input);
    const record = await deps.variableKeys.create(value, scope);
    return toDictionaryEntryView(record, 0);
  };
}

/** Etiqueta y valor se guardan aunque esté en uso; el puerto solo frena un cambio de clave en uso. */
export function createUpdateWhatsappVariableKey(
  deps: ManageWhatsappVariableKeysDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<WhatsappDictionaryEntryView> {
  return async function updateWhatsappVariableKey(id, input, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    if (!variableKeyIdSchema.safeParse(id).success) throw new WhatsappVariableKeyNotFoundError();
    const value = validInputOf(input);

    const result = await deps.variableKeys.update(id, value, scope);
    if (result.kind === 'not_found') throw new WhatsappVariableKeyNotFoundError();
    if (result.kind === 'in_use') throw new WhatsappVariableKeyInUseError();

    // El puerto de escritura no cuenta el uso: se lee como lo lista el diccionario.
    const withUsage = await deps.variableKeys.listWithUsage(scope);
    const usedBy = withUsage.find((entry) => entry.id === result.record.id)?.usedBy ?? 0;
    return toDictionaryEntryView(result.record, usedBy);
  };
}

export function createDeleteWhatsappVariableKey(
  deps: ManageWhatsappVariableKeysDeps,
): (id: string, actor: Actor | null | undefined) => Promise<{ readonly id: string }> {
  return async function deleteWhatsappVariableKey(id, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    if (!variableKeyIdSchema.safeParse(id).success) throw new WhatsappVariableKeyNotFoundError();

    const result = await deps.variableKeys.delete(id, scope);
    if (result === 'not_found') throw new WhatsappVariableKeyNotFoundError();
    if (result === 'in_use') throw new WhatsappVariableKeyInUseError();
    return { id };
  };
}
