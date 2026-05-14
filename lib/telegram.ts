import { env, getAppUrl } from './env';
import { createModuleLogger } from './logger';

const log = createModuleLogger('telegram');
const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  date?: number;
  text?: string;
  from?: TelegramUser;
  chat: TelegramChat;
}

export interface TelegramCallbackQuery {
  id: string;
  data?: string;
  from: TelegramUser;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface SendTelegramMessageParams {
  chatId: string;
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}

interface EditTelegramMessageParams extends SendTelegramMessageParams {
  messageId: string;
}

interface GetTelegramUpdatesParams {
  offset?: number | null;
  timeout?: number;
  limit?: number;
}

function ensureTelegramConfigured() {
  if (!isTelegramConfigured()) {
    throw new Error('Telegram integration is not configured');
  }
}

export function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN
      && process.env.TELEGRAM_BOT_USERNAME
  );
}

export function isTelegramWebhookConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN
      && process.env.TELEGRAM_BOT_USERNAME
      && process.env.TELEGRAM_WEBHOOK_SECRET
  );
}

async function telegramRequest<T>(
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  ensureTelegramConfigured();

  const response = await fetch(
    `${TELEGRAM_API_BASE_URL}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  );

  const data = await response.json() as TelegramApiResponse<T>;

  if (!response.ok || !data.ok || data.result === undefined) {
    const description = data.description || `${response.status} ${response.statusText}`;
    log.error({ method, description }, 'Telegram API request failed');
    throw new Error(`Telegram API ${method} failed: ${description}`);
  }

  return data.result;
}

export function buildTelegramConnectUrl(token: string): string {
  ensureTelegramConfigured();
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${token}`;
}

export function verifyTelegramWebhookSecret(request: Request): boolean {
  if (!isTelegramWebhookConfigured()) {
    return false;
  }

  return request.headers.get('x-telegram-bot-api-secret-token') === env.TELEGRAM_WEBHOOK_SECRET;
}

export async function deleteTelegramWebhook(): Promise<void> {
  await telegramRequest<true>('deleteWebhook', {
    drop_pending_updates: false,
  });
}

export async function getTelegramUpdates({
  offset,
  timeout = 0,
  limit = 100,
}: GetTelegramUpdatesParams = {}): Promise<TelegramUpdate[]> {
  const payload: Record<string, unknown> = {
    timeout,
    limit,
    allowed_updates: ['message', 'callback_query'],
  };

  if (offset !== undefined && offset !== null) {
    payload.offset = offset;
  }

  return telegramRequest<TelegramUpdate[]>('getUpdates', payload);
}

export async function sendTelegramMessage({
  chatId,
  text,
  replyMarkup,
}: SendTelegramMessageParams): Promise<{ messageId: string }> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const result = await telegramRequest<TelegramMessage>('sendMessage', payload);

  return {
    messageId: String(result.message_id),
  };
}

export async function editTelegramMessage({
  chatId,
  messageId,
  text,
  replyMarkup,
}: EditTelegramMessageParams): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: Number(messageId),
    text,
    disable_web_page_preview: true,
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  };

  await telegramRequest<TelegramMessage | true>('editMessageText', payload);
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  };

  if (text) {
    payload.text = text;
  }

  await telegramRequest<true>('answerCallbackQuery', payload);
}

export function buildTelegramDigestKeyboard(
  entries: Array<{ name: string; callbackToken: string }>
): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: entries.map((entry) => [
      { text: `Contacted ${entry.name}`, callback_data: `contacted:${entry.callbackToken}` },
    ]),
  };
}
