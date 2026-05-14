import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getClientIp, handleApiError, withLogging } from '@/lib/api-utils';
import { securityLogger } from '@/lib/logger';
import { pollTelegramUpdates } from '@/lib/telegram-poll';

export const GET = withLogging(async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', {
        endpoint: 'poll-telegram',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await pollTelegramUpdates();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleApiError(error, 'cron-poll-telegram');
  }
});
