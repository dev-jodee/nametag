import { NextResponse } from 'next/server';
import { verifyTelegramWebhookSecret, type TelegramUpdate } from '@/lib/telegram';
import { processTelegramUpdate } from '@/lib/telegram-updates';
import { securityLogger } from '@/lib/logger';
import { getClientIp, handleApiError, parseRequestBody, withLogging } from '@/lib/api-utils';

export const POST = withLogging(async function POST(request: Request) {
  try {
    if (!verifyTelegramWebhookSecret(request)) {
      securityLogger.authFailure(getClientIp(request), 'Invalid Telegram webhook secret', {
        endpoint: 'telegram-webhook',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update = await parseRequestBody<TelegramUpdate>(request);
    await processTelegramUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'telegram-webhook');
  }
});
