import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { WhatsappVariableKeyTakenError } from '../../../domain/errors';

import {
  companyScopeColumns,
  whatsappTemplateCompanyScope,
  whatsappTemplateVariableCompanyScope,
  whatsappVariableKeyCompanyScope,
} from './company-scope';

import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type { WhatsappVariableKeyInput, WhatsappVariableKeyRecord } from '../../../domain/whatsapp-variable-key';
import type {
  WhatsappVariableKeyDeleteResult,
  WhatsappVariableKeyUpdateResult,
  WhatsappVariableKeyWithUsage,
} from '../../../ports/whatsapp-variable-key-repository';

/** Exactamente los campos de `WhatsappVariableKeyRecord`. */
const VARIABLE_KEY_SELECT = {
  id: true,
  companyId: true,
  key: true,
  label: true,
  value: true,
  createdAt: true,
} satisfies Prisma.WhatsappVariableKeySelect;

type VariableKeyRow = Prisma.WhatsappVariableKeyGetPayload<{ select: typeof VARIABLE_KEY_SELECT }>;

function toRecord(row: VariableKeyRow): WhatsappVariableKeyRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    key: row.key,
    label: row.label,
    value: row.value,
    createdAt: row.createdAt,
  };
}

const KEY_INDEX = 'whatsapp_variable_keys_company_key_key';

/** El `P2002` del cliente tipado trae el índice o sus columnas en `meta.target`, según el motor. */
function isKeyTaken(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  const targets = typeof target === 'string' ? [target] : Array.isArray(target) ? target.map(String) : [];
  if (targets.some((item) => item.includes(KEY_INDEX))) return true;
  return targets.includes('key') && (targets.includes('company_id') || targets.includes('companyId'));
}

/** `P2003`: la FK de las relaciones impide borrar una variable en uso. */
function isReferenced(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

/** Plantillas vivas distintas que usan cada variable; `null` cuenta todas las de la empresa. */
async function liveUsage(
  tx: Prisma.TransactionClient,
  variableKeyIds: readonly string[] | null,
  scope: IntegracionesScope,
): Promise<ReadonlyMap<string, number>> {
  const relations = await tx.whatsappTemplateVariable.findMany({
    where: {
      variableKeyId: variableKeyIds === null ? { not: null } : { in: [...variableKeyIds] },
      ...whatsappTemplateVariableCompanyScope(scope),
    },
    select: { variableKeyId: true, templateId: true },
  });
  const templateIds = [...new Set(relations.map((relation) => relation.templateId))];
  const live = await tx.whatsappTemplate.findMany({
    where: { id: { in: templateIds }, deletedAt: null, ...whatsappTemplateCompanyScope(scope) },
    select: { id: true },
  });
  const liveIds = new Set(live.map((template) => template.id));
  const templatesByKey = new Map<string, Set<string>>();
  for (const { variableKeyId, templateId } of relations) {
    if (variableKeyId === null || !liveIds.has(templateId)) continue;
    templatesByKey.set(variableKeyId, (templatesByKey.get(variableKeyId) ?? new Set()).add(templateId));
  }
  return new Map([...templatesByKey].map(([id, templates]) => [id, templates.size]));
}

/** Bloquea la variable hasta el final de la transacción: una relación nueva a ella espera. */
async function lockedKey(tx: Prisma.TransactionClient, id: string, scope: IntegracionesScope): Promise<string | null> {
  const columns = companyScopeColumns(scope);
  const rows = await tx.$queryRaw<{ key: string }[]>`
    SELECT "key" FROM "whatsapp_variable_keys"
    WHERE "id" = ${id}::uuid AND "company_id" = ${columns.companyId}::uuid
    FOR UPDATE
  `;
  return rows[0]?.key ?? null;
}

export async function listAllWhatsappVariableKeys(
  scope: IntegracionesScope,
): Promise<readonly WhatsappVariableKeyRecord[]> {
  const rows = await prisma.whatsappVariableKey.findMany({
    where: whatsappVariableKeyCompanyScope(scope),
    orderBy: [{ key: 'asc' }],
    select: VARIABLE_KEY_SELECT,
  });
  return rows.map(toRecord);
}

export async function listWhatsappVariableKeysWithUsage(
  scope: IntegracionesScope,
): Promise<readonly WhatsappVariableKeyWithUsage[]> {
  const rows = await prisma.whatsappVariableKey.findMany({
    where: whatsappVariableKeyCompanyScope(scope),
    orderBy: [{ key: 'asc' }],
    select: VARIABLE_KEY_SELECT,
  });
  const usage = await liveUsage(prisma, null, scope);
  return rows.map((row) => ({ ...toRecord(row), usedBy: usage.get(row.id) ?? 0 }));
}

export async function findWhatsappVariableKeysByKeys(
  keys: readonly string[],
  scope: IntegracionesScope,
): Promise<readonly WhatsappVariableKeyRecord[]> {
  if (keys.length === 0) return [];
  const rows = await prisma.whatsappVariableKey.findMany({
    where: { key: { in: [...keys] }, ...whatsappVariableKeyCompanyScope(scope) },
    orderBy: [{ key: 'asc' }],
    select: VARIABLE_KEY_SELECT,
  });
  return rows.map(toRecord);
}

export async function createWhatsappVariableKey(
  input: WhatsappVariableKeyInput,
  scope: IntegracionesScope,
): Promise<WhatsappVariableKeyRecord> {
  try {
    const row = await prisma.whatsappVariableKey.create({
      data: { ...companyScopeColumns(scope), key: input.key, label: input.label, value: input.value },
      select: VARIABLE_KEY_SELECT,
    });
    return toRecord(row);
  } catch (error) {
    if (isKeyTaken(error)) throw new WhatsappVariableKeyTakenError('alta de variable: otra con la misma clave');
    throw error;
  }
}

export async function updateWhatsappVariableKey(
  id: string,
  input: WhatsappVariableKeyInput,
  scope: IntegracionesScope,
): Promise<WhatsappVariableKeyUpdateResult> {
  try {
    return await prisma.$transaction(async (tx): Promise<WhatsappVariableKeyUpdateResult> => {
      const currentKey = await lockedKey(tx, id, scope);
      if (currentKey === null) return { kind: 'not_found' };
      if (currentKey !== input.key && ((await liveUsage(tx, [id], scope)).get(id) ?? 0) > 0) return { kind: 'in_use' };
      const row = await tx.whatsappVariableKey.update({
        where: { ...whatsappVariableKeyCompanyScope(scope), id },
        data: { key: input.key, label: input.label, value: input.value },
        select: VARIABLE_KEY_SELECT,
      });
      return { kind: 'updated', record: toRecord(row) };
    });
  } catch (error) {
    if (isKeyTaken(error)) throw new WhatsappVariableKeyTakenError('cambio de variable: otra con la misma clave');
    throw error;
  }
}

export async function deleteWhatsappVariableKey(
  id: string,
  scope: IntegracionesScope,
): Promise<WhatsappVariableKeyDeleteResult> {
  try {
    return await prisma.$transaction(async (tx): Promise<WhatsappVariableKeyDeleteResult> => {
      if ((await lockedKey(tx, id, scope)) === null) return 'not_found';
      if (((await liveUsage(tx, [id], scope)).get(id) ?? 0) > 0) return 'in_use';
      await tx.whatsappVariableKey.deleteMany({ where: { id, ...whatsappVariableKeyCompanyScope(scope) } });
      return 'deleted';
    });
  } catch (error) {
    if (isReferenced(error)) return 'in_use';
    throw error;
  }
}
