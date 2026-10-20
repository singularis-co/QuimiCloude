// Montaje comun de los casos de uso de plantillas: una conexion guardada con sus secretos, los
// dobles de Graph y del repositorio de plantillas, y dobles que fallan si los llaman.

import { vi } from 'vitest'

import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'
import type { SecretCipher } from '@/lib/modules/integraciones/ports/secret-cipher'
import type { WhatsappConnectionRepository } from '@/lib/modules/integraciones/ports/whatsapp-connection-repository'
import type { WhatsappGraphClient } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'
import type { WhatsappTemplateRepository } from '@/lib/modules/integraciones/ports/whatsapp-template-repository'

import {
  NOW,
  makeCipher,
  makeGraph,
  makeRepository,
  makeTemplateRepository,
  storedConnection,
} from '../whatsapp-doubles'

export type TemplateSetupOptions = {
  connection?: Partial<WhatsappConnectionRecord> | null
  templates?: WhatsappTemplateRecord[]
}

export function setupTemplates(options: TemplateSetupOptions = {}) {
  const cipher = makeCipher()
  const repo = makeRepository(options.connection === null ? [] : [storedConnection(cipher.seed, options.connection)])
  const graph = makeGraph()
  const templates = makeTemplateRepository(options.templates ?? [])
  const deps = {
    connections: repo.connections,
    cipher: cipher.cipher,
    graph: graph.graph,
    templates: templates.templates,
    now: () => NOW,
  }
  return { cipher, repo, graph, templates, deps }
}

/** Dobles que fallan si los llaman: una operacion sin permiso tiene que lanzar sin tocar nada. */
export function explodingTemplateDeps() {
  const explota = (nombre: string) =>
    vi.fn(() => {
      throw new Error(`${nombre} no debe llamarse sin autorizacion`)
    })
  const connections = {
    findLive: explota('connections.findLive'),
    findLiveById: explota('connections.findLiveById'),
    create: explota('connections.create'),
    update: explota('connections.update'),
    recordWebhookHandshake: explota('connections.recordWebhookHandshake'),
  }
  const graph = {
    fetchPhoneNumber: explota('graph.fetchPhoneNumber'),
    createTemplate: explota('graph.createTemplate'),
    listTemplatesPage: explota('graph.listTemplatesPage'),
    deleteTemplate: explota('graph.deleteTemplate'),
  }
  const cipher = { encrypt: explota('cipher.encrypt'), decrypt: explota('cipher.decrypt') }
  const templates = {
    listLive: explota('templates.listLive'),
    findLiveById: explota('templates.findLiveById'),
    findLiveByNameAndLanguage: explota('templates.findLiveByNameAndLanguage'),
    insertCreated: explota('templates.insertCreated'),
    markDeleted: explota('templates.markDeleted'),
    listForSync: explota('templates.listForSync'),
    applySync: explota('templates.applySync'),
    applyWebhookUpdates: explota('templates.applyWebhookUpdates'),
  }
  const now = explota('now')
  return {
    deps: {
      connections: connections as unknown as WhatsappConnectionRepository,
      graph: graph as unknown as WhatsappGraphClient,
      cipher: cipher as unknown as SecretCipher,
      templates: templates as unknown as WhatsappTemplateRepository,
      now: now as unknown as () => Date,
    },
    espias: [...Object.values(connections), ...Object.values(graph), ...Object.values(cipher), ...Object.values(templates), now],
  }
}

/** Un borrador valido con una variable en el body y un boton de respuesta rapida. */
export function validDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'pedido_listo',
    language: 'es',
    category: 'UTILITY',
    header: null,
    body: { text: 'Hola {{1}}, tu pedido esta listo.', examples: ['Ana'] },
    footer: null,
    buttons: [{ type: 'QUICK_REPLY', text: 'Gracias' }],
    ...overrides,
  }
}
