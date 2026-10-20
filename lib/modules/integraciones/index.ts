export {
  IntegracionesError,
  SecretUnreadableError,
  ValidationError,
  UnauthorizedError,
  WhatsappConnectionNotFoundError,
  WhatsappConnectionExistsError,
  WhatsappPhoneNumberTakenError,
  ActionNotAllowedError,
  WhatsappTemplateNotFoundError,
  WhatsappTemplateNameTakenError,
  WhatsappTemplateRateLimitedError,
  WhatsappTemplateRejectedError,
  WhatsappMetaRejectedError,
  WhatsappMetaUnreachableError,
} from './domain/errors';
export type { SecretContext } from './domain/secret-context';
export type { Actor } from './domain/actor';
export type { WhatsappConnectionStatus, WhatsappConnectionView } from './domain/whatsapp-connection';
export { createGetWhatsappConnection } from './domain/get-whatsapp-connection';
export { createCreateWhatsappConnection } from './domain/create-whatsapp-connection';
export { createUpdateWhatsappConnection } from './domain/update-whatsapp-connection';
export { createTestWhatsappConnection } from './domain/test-whatsapp-connection';
export { createSetWhatsappConnectionEnabled } from './domain/set-whatsapp-connection-enabled';
export { createRegenerateWhatsappVerifyToken } from './domain/regenerate-whatsapp-verify-token';
export { createVerifyWhatsappWebhook } from './domain/verify-whatsapp-webhook';
export { createReceiveWhatsappWebhook } from './domain/receive-whatsapp-webhook';
export type {
  AiProviderCode,
  AiProviderConnectionStatus,
  AiProviderConnectionView,
  AiProviderEntry,
  AiReadUse,
} from './domain/ai-provider';
export type {
  AiProviderFailure,
  AiProviderFailureKind,
  AiProviderProbeResult,
} from './domain/ai-provider-failure';
export { isAccountFailure } from './domain/ai-provider-failure';
export type { AiProviderConnectionOverview } from './domain/get-ai-provider-connection';
export type { AiProviderTestResult } from './domain/test-ai-provider-key';
export type { TestSavedAiProviderResult } from './domain/test-saved-ai-provider';
export type { SaveAiProviderConnectionResult } from './domain/save-ai-provider-connection';
export type { AiProviderReadiness } from './domain/get-ai-provider-readiness';
export type {
  AiProviderReadingResolution,
  AiProviderStatus,
} from './domain/resolve-ai-provider-for-reading';
export type { AiProviderReadingOutcome } from './domain/report-ai-provider-outcome';
export { createGetAiProviderConnection } from './domain/get-ai-provider-connection';
export { createTestAiProviderKey } from './domain/test-ai-provider-key';
export { createTestSavedAiProvider } from './domain/test-saved-ai-provider';
export { createSaveAiProviderConnection } from './domain/save-ai-provider-connection';
export { createDisconnectAiProvider } from './domain/disconnect-ai-provider';
export { createGetAiProviderReadiness } from './domain/get-ai-provider-readiness';
export {
  createGetAiProviderStatus,
  createResolveAiProviderForReading,
} from './domain/resolve-ai-provider-for-reading';
export { createReportAiProviderOutcome } from './domain/report-ai-provider-outcome';
