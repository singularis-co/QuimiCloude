export const CUSTOMER_CONTACTS_EMPTY_MESSAGE =
  'Aquí verás las conversaciones de WhatsApp con tus clientes.';
export const CUSTOMER_CONTACTS_TITLE_TESTID = 'customer-contacts-title';
export const CUSTOMER_CONTACTS_EMPTY_TESTID = 'customer-contacts-empty';

export const CHAT_MEDIA_LABELS = {
  audio: '[Audio]',
  video: '[Video]',
  document: '[Documento]',
} as const;

export const MISSING_VALUE_TEXT = {
  marker: (key: string) => `[falta ${key}]`,
  prefix: 'Falta el valor de',
  lastSeparator: ' y ',
  separator: ', ',
} as const;

export const CHAT_TIME_TEXT = {
  today: 'Hoy',
  yesterday: 'Ayer',
  weekdays: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
} as const;

export const CHAT_WINDOW_TEXT = {
  closed: 'Ventana cerrada',
  openWithHours: (hours: number, minutes: number) => `Ventana abierta · se cierra en ${hours} h ${minutes} min`,
  openMinutes: (minutes: number) => `Ventana abierta · se cierra en ${minutes} min`,
} as const;

export const CHAT_HEADER_TEXT = {
  back: 'Volver a conversaciones',
  orderLabel: 'Pedido',
  orderDetailsToggle: 'Ver detalles del pedido',
} as const;

export const CHAT_ORDER_DETAIL_TEXT = {
  number: 'Número',
  status: 'Estado',
  product: 'Producto',
  total: 'Total',
  lines: 'Productos',
  ordered: 'Pedido',
  delivered: 'Entregado',
  pending: 'Faltante',
} as const;

export const CHAT_MESSAGE_TEXT = {
  system: 'Sistema',
  failed: (reason: string) => `No se pudo enviar: ${reason}`,
  failedWithoutReason: 'No se pudo enviar',
  retry: 'Reintentar',
  unsupported: 'Mensaje no soportado',
  reaction: (emoji: string) => `Reacción del cliente: ${emoji}`,
} as const;

export const CHAT_DELIVERY_LABELS = {
  sending: 'Enviando',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
} as const;

export const CHAT_IMAGE_TEXT = {
  imagePlaceholder: '[Imagen]',
  stickerPlaceholder: '[Sticker]',
  unavailable: 'Imagen no disponible',
  imageAlt: 'Imagen enviada por el cliente',
  stickerAlt: 'Sticker',
  open: 'Abrir imagen',
  close: 'Cerrar imagen',
  viewerTitle: (customerName: string) => `Imagen de ${customerName}`,
} as const;

export const CHAT_LOCATION_TEXT = {
  title: 'Ubicación',
  openMap: 'Abrir en el mapa',
} as const;

export const CHAT_HISTORY_TEXT = {
  loadingOlder: 'Cargando mensajes anteriores…',
} as const;

export const CHAT_PANEL_TEXT = {
  emptyTitle: 'Aún no hay mensajes con este cliente',
  emptyDescription: 'Para iniciar la conversación, WhatsApp exige una plantilla aprobada. Elige una abajo y se rellena el mensaje.',
  retry: 'Reintentar',
} as const;

export const CHAT_COMPOSER_TEXT = {
  messageLabel: 'Mensaje',
  placeholder: 'Escribe un mensaje',
  templatePlaceholder: 'Elige una plantilla para empezar',
  send: 'Enviar',
  sendTemplate: 'Enviar plantilla',
  keyboardHint: 'Enter envía · Shift+Enter hace un salto de línea',
  windowClosed: 'Pasaron más de 24 h desde el último mensaje del cliente: solo puedes enviar una plantilla aprobada.',
} as const;

export const CHAT_TEMPLATE_CHIPS_TEXT = {
  groupLabel: 'Plantillas aprobadas',
} as const;

export const SEND_TEMPLATE_DIALOG_TEXT = {
  title: 'Enviar plantilla',
  description: 'Solo plantillas aprobadas por WhatsApp.',
  template: 'Plantilla',
  order: 'Pedido',
  orderHint: 'Las variables se rellenan solas.',
  preview: 'Vista previa',
  cancel: 'Cancelar',
  send: 'Enviar plantilla',
  close: 'Cerrar',
} as const;

export const CHAT_COMPOSER_TESTID = 'chat-composer';
export const CHAT_COMPOSER_ERROR_TESTID = 'chat-composer-error';
export const CHAT_COMPOSER_MISSING_TESTID = 'chat-composer-missing';
export const CHAT_TEMPLATE_CHIPS_TESTID = 'chat-template-chips';
export const SEND_TEMPLATE_DIALOG_TESTID = 'send-template-dialog';
export const SEND_TEMPLATE_SELECT_TESTID = 'send-template-select';
export const SEND_TEMPLATE_ORDER_SELECT_TESTID = 'send-template-order-select';
export const SEND_TEMPLATE_ERROR_TESTID = 'send-template-error';
export const SEND_TEMPLATE_MISSING_TESTID = 'send-template-missing';

export const CHAT_MESSAGE_TESTID = 'chat-message';
export const CHAT_MESSAGE_LIST_TESTID = 'chat-message-list';
export const CHAT_DAY_SEPARATOR_TESTID = 'chat-day-separator';
export const CHAT_OLDER_SENTINEL_TESTID = 'chat-older-sentinel';
export const CHAT_IMAGE_VIEWER_TESTID = 'chat-image-viewer';
export const CHAT_HEADER_TESTID = 'chat-header';
export const CHAT_WINDOW_BADGE_TESTID = 'chat-window-badge';
export const CHAT_ORDER_SELECT_TESTID = 'chat-order-select';
export const CHAT_ORDER_ERROR_TESTID = 'chat-order-error';
export const CHAT_ORDER_DETAIL_TESTID = 'chat-order-detail';
export const CHAT_PANEL_TESTID = 'chat-panel';
export const CHAT_EMPTY_TESTID = 'chat-empty';
export const CHAT_LOADING_TESTID = 'chat-loading';
export const CHAT_LOAD_ERROR_TESTID = 'chat-load-error';
export const CHAT_CONTEXT_ERROR_TESTID = 'chat-context-error';
export const CHAT_OLDER_ERROR_TESTID = 'chat-older-error';
export const CHAT_RETRY_ERROR_TESTID = 'chat-retry-error';
