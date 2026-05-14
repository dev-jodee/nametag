import { prisma } from '@/lib/prisma';
import { createModuleLogger } from '@/lib/logger';
import {
  deleteTelegramWebhook,
  getTelegramUpdates,
  isTelegramConfigured,
} from '@/lib/telegram';
import { processTelegramUpdate } from '@/lib/telegram-updates';

const log = createModuleLogger('telegram-poll');
const BOT_STATE_ID = 'default';

export interface TelegramPollResult {
  fetched: number;
  processed: number;
  failed: number;
  nextOffset: number | null;
}

export async function pollTelegramUpdates(): Promise<TelegramPollResult> {
  if (!isTelegramConfigured()) {
    throw new Error('Telegram integration is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME.');
  }

  await deleteTelegramWebhook();

  const state = await prisma.telegramBotState.upsert({
    where: { id: BOT_STATE_ID },
    update: {},
    create: { id: BOT_STATE_ID },
  });

  const updates = await getTelegramUpdates({
    offset: state.lastUpdateId === null ? undefined : state.lastUpdateId,
    timeout: 0,
    limit: 100,
  });

  let nextOffset = state.lastUpdateId ?? undefined;
  let processed = 0;
  let failed = 0;

  for (const update of updates) {
    try {
      await processTelegramUpdate(update);
      processed++;
    } catch (error) {
      failed++;
      log.error({
        updateId: update.update_id,
        err: error instanceof Error ? error : new Error(String(error)),
      }, 'Failed to process Telegram update');
    } finally {
      nextOffset = update.update_id + 1;
    }
  }

  if (nextOffset !== undefined && nextOffset !== state.lastUpdateId) {
    await prisma.telegramBotState.update({
      where: { id: BOT_STATE_ID },
      data: { lastUpdateId: nextOffset },
    });
  }

  return {
    fetched: updates.length,
    processed,
    failed,
    nextOffset: nextOffset ?? null,
  };
}
