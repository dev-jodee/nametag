import { prisma } from '@/lib/prisma';
import { updateNotificationsSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { isTelegramConfigured } from '@/lib/telegram';

export const GET = withAuth(async (_request, session) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        timeZone: true,
        telegramRemindersEnabled: true,
        telegramReminderHour: true,
        telegramConnection: {
          select: {
            telegramUsername: true,
            telegramFirstName: true,
            isActive: true,
            connectedAt: true,
          },
        },
      },
    });

    if (!user) {
      return apiResponse.notFound('User not found');
    }

    return apiResponse.ok({
      telegramConfigured: isTelegramConfigured(),
      notifications: {
        timeZone: user.timeZone,
        telegramRemindersEnabled: user.telegramRemindersEnabled,
        telegramReminderHour: user.telegramReminderHour,
      },
      telegramConnection: user.telegramConnection,
    });
  } catch (error) {
    return handleApiError(error, 'user-notifications-get');
  }
});

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateNotificationsSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: validation.data,
      select: {
        timeZone: true,
        telegramRemindersEnabled: true,
        telegramReminderHour: true,
      },
    });

    return apiResponse.ok({ notifications: user });
  } catch (error) {
    return handleApiError(error, 'user-notifications-update');
  }
});

export const DELETE = withAuth(async (_request, session) => {
  try {
    await prisma.$transaction([
      prisma.telegramConnection.deleteMany({
        where: { userId: session.user.id },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { telegramRemindersEnabled: false },
      }),
    ]);

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'user-notifications-disconnect-telegram');
  }
});
