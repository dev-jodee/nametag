import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { buildTelegramConnectUrl, isTelegramConfigured } from '@/lib/telegram';
import { generateToken, hashToken } from '@/lib/token-hash';

const LINK_TOKEN_EXPIRY_MINUTES = 15;

export const POST = withAuth(async (_request, session) => {
  try {
    if (!isTelegramConfigured()) {
      return apiResponse.error('Telegram integration is not configured', 503);
    }

    const rawToken = generateToken(24);
    const token = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + LINK_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await prisma.telegramLinkToken.create({
      data: {
        token,
        userId: session.user.id,
        expiresAt,
      },
    });

    return apiResponse.ok({
      connectUrl: buildTelegramConnectUrl(rawToken),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, 'telegram-link-token-create');
  }
});
