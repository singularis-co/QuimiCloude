export {
  IntegracionesError,
  SecretUnreadableError,
  ValidationError,
  UnauthorizedError,
  WhatsappConnectionNotFoundError,
  WhatsappConnectionExistsError,
  WhatsappPhoneNumberTakenError,
  ActionNotAllowedError,
  WhatsappContactNotFoundError,
  WhatsappContactNumberInvalidError,
  LinkedCustomerNotFoundError,
  WhatsappTemplateNotFoundError,
  WhatsappTemplateNameTakenError,
  WhatsappTemplateRateLimitedError,
  WhatsappTemplateRejectedError,
  WhatsappMetaRejectedError,
  WhatsappMetaUnreachableError,
  WhatsappVariableKeyNotFoundError,
  WhatsappVariableKeyTakenError,
  WhatsappVariableKeyInUseError,
  WhatsappTemplateNotMappedError,
  WhatsappTemplateNotMappableError,
  WhatsappTemplateValuesMissingError,
  WhatsappOrderNotFoundError,
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
export {
  createRefreshWhatsappContactLinks,
  type RefreshWhatsappContactLinks,
  type RefreshWhatsappContactLinksDeps,
} from './domain/refresh-whatsapp-contact-links';
export { resolveContactLink, type ContactLink } from './domain/whatsapp-contact-link';
export { createLinkWhatsappContact } from './domain/link-whatsapp-contact';
export { createUnlinkWhatsappContact } from './domain/unlink-whatsapp-contact';
export { createSetWhatsappContactBlocked } from './domain/set-whatsapp-contact-blocked';
export type {
  AiProviderCode,
  AiProviderConnectionStatus,
  AiProviderConnectionView,
  AiProviderEntry,
  AiModelOption,
} from './domain/ai-provider';
export type {
  AiProviderFailure,
  AiProviderFailureKind,
  AiProviderProbeResult,
} from './domain/ai-provider-failure';
export { isAccountFailure, marksConnection } from './domain/ai-provider-failure';
export type { AiProviderConnectionOverview } from './domain/get-ai-provider-connection';
export type { AiProviderTestResult } from './domain/test-ai-provider-key';
export type { TestSavedAiProviderResult } from './domain/test-saved-ai-provider';
export type { SaveAiProviderConnectionResult } from './domain/save-ai-provider-connection';
export type { SelectAiModelResult } from './domain/select-ai-model';
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
export { createSelectAiModel } from './domain/select-ai-model';
export { createDisconnectAiProvider } from './domain/disconnect-ai-provider';
export { createGetAiProviderReadiness } from './domain/get-ai-provider-readiness';
export {
  createGetAiProviderStatus,
  createResolveAiProviderForReading,
} from './domain/resolve-ai-provider-for-reading';
export { createReportAiProviderOutcome } from './domain/report-ai-provider-outcome';
export type {
  TemplateSyncSummary,
  WhatsappTemplateCategory,
  WhatsappTemplateList,
  WhatsappTemplateStatus,
  WhatsappTemplateVariableView,
  WhatsappTemplateView,
} from './domain/whatsapp-template';
export { CREATABLE_TEMPLATE_CATEGORIES } from './domain/whatsapp-template';
export { WHATSAPP_TEMPLATE_LANGUAGES } from './domain/whatsapp-template-languages';
export type {
  WhatsappTemplateButton,
  WhatsappTemplateContent,
  WhatsappTemplateDraft,
  WhatsappTemplateIssue,
} from './domain/whatsapp-template-draft';
export { TEMPLATE_LIMITS } from './domain/whatsapp-template-draft';
export type { WhatsappTemplateKeyedDraft } from './domain/whatsapp-template-keyed-draft';
export { validateKeyedTemplateDraft } from './domain/whatsapp-template-keyed-draft';
export type { WhatsappDictionaryEntryView } from './domain/whatsapp-variable-key';
export {
  WHATSAPP_CONSTANT_KEY_PATTERN,
  WHATSAPP_VARIABLE_KEY_LIMITS,
  WHATSAPP_VARIABLE_KEY_PATTERN,
  validateWhatsappVariableKeyInput,
} from './domain/whatsapp-variable-key';
export {
  createCreateWhatsappVariableKey,
  createDeleteWhatsappVariableKey,
  createListWhatsappDictionary,
  createUpdateWhatsappVariableKey,
} from './domain/manage-whatsapp-variable-keys';
export {
  createRelateWhatsappTemplateVariables,
  createSetWhatsappTemplateEnabled,
} from './domain/relate-whatsapp-template-variables';
export { createGetWhatsappTemplate, createListWhatsappTemplates } from './domain/list-whatsapp-templates';
export { createCreateWhatsappTemplate } from './domain/create-whatsapp-template';
export { createDeleteWhatsappTemplate } from './domain/delete-whatsapp-template';
export { createResyncWhatsappTemplates, createSyncWhatsappTemplates } from './domain/sync-whatsapp-templates';
export { createSyncAllWhatsappTemplates } from './domain/sync-all-whatsapp-templates';
export type { WhatsappOutboundMessageView } from './domain/whatsapp-outbound-message';
export { createSendWhatsappMessage } from './domain/send-whatsapp-message';
export { createRetryWhatsappMessage } from './domain/retry-whatsapp-message';
export type {
  WhatsappMessageDirection,
  WhatsappMessageStatus,
  WhatsappMessageType,
} from './domain/whatsapp-message';
export type {
  WhatsappChat,
  WhatsappChatAttachment,
  WhatsappChatMessage,
  WhatsappConversationItem,
  WhatsappConversationList,
  WhatsappSendableTemplate,
} from './domain/whatsapp-conversation';
export { createListWhatsappConversations } from './domain/list-whatsapp-conversations';
export { createGetWhatsappChat } from './domain/get-whatsapp-chat';
export { createMarkWhatsappChatRead } from './domain/mark-whatsapp-chat-read';
export { createListSendableWhatsappTemplates } from './domain/list-sendable-whatsapp-templates';
export type { WhatsappChatContext, WhatsappCustomerOrder } from './domain/whatsapp-chat-context';
export { createGetWhatsappChatContext } from './domain/get-whatsapp-chat-context';
export { createGetWhatsappMedia, type WhatsappMediaResult } from './domain/get-whatsapp-media';
export {
  GREETING_NAME_PLACEHOLDER,
  WHATSAPP_AGENT_DEFAULTS,
  WHATSAPP_ASSISTANT_NAME_MAX_LENGTH,
  renderGreeting,
  type SaveWhatsappAgentSettingsInput,
  type WhatsappAgentSettings,
} from './domain/whatsapp-agent-settings';
export { createGetWhatsappAgentSettings } from './domain/get-whatsapp-agent-settings';
export { createSaveWhatsappAgentSettings } from './domain/save-whatsapp-agent-settings';
export {
  CONVERSATION_MODES,
  CONVERSATION_MODE_REASONS,
  REASONS_BY_TARGET,
  isDueForAgentReturn,
  planModeChange,
  type AgentReturnCandidate,
  type ConversationMode,
  type ConversationModeInput,
  type ConversationModeReason,
  type ConversationModeView,
} from './domain/whatsapp-conversation-mode';
export { createHandOffWhatsappConversation } from './domain/hand-off-whatsapp-conversation';
export { createReturnWhatsappConversationToAgent } from './domain/return-whatsapp-conversation-to-agent';
export { createGetWhatsappConversationMode } from './domain/get-whatsapp-conversation-mode';
