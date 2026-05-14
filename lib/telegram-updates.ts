import { prisma } from '@/lib/prisma';
import { formatGraphName } from '@/lib/nameUtils';
import { hashToken } from '@/lib/token-hash';
import {
  answerTelegramCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
  type TelegramUpdate,
} from '@/lib/telegram';
import { createModuleLogger, securityLogger } from '@/lib/logger';

const log = createModuleLogger('telegram-updates');

export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.message?.text?.startsWith('/start ')) {
    await handleStart(update);
  } else if (update.callback_query) {
    await handleCallback(update);
  }
}

async function handleStart(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const from = message?.from;
  const chat = message?.chat;
  const rawToken = message?.text?.split(/\s+/)[1];

  if (!message || !from || !chat || !rawToken) {
    return;
  }

  const token = await prisma.telegramLinkToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!token || token.usedAt || token.expiresAt <= new Date()) {
    await sendTelegramMessage({
      chatId: String(chat.id),
      text: 'This Nametag link expired. Create a new Telegram link from notification settings.',
    });
    return;
  }

  const existingChat = await prisma.telegramConnection.findUnique({
    where: { telegramChatId: String(chat.id) },
    select: { userId: true },
  });

  if (existingChat && existingChat.userId !== token.userId) {
    await sendTelegramMessage({
      chatId: String(chat.id),
      text: 'This Telegram chat is already connected to another Nametag account.',
    });
    return;
  }

  await prisma.$transaction([
    prisma.telegramConnection.upsert({
      where: { userId: token.userId },
      update: {
        telegramUserId: String(from.id),
        telegramChatId: String(chat.id),
        telegramUsername: from.username ?? null,
        telegramFirstName: from.first_name ?? null,
        isActive: true,
        lastInteractionAt: new Date(),
      },
      create: {
        userId: token.userId,
        telegramUserId: String(from.id),
        telegramChatId: String(chat.id),
        telegramUsername: from.username ?? null,
        telegramFirstName: from.first_name ?? null,
      },
    }),
    prisma.telegramLinkToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await sendTelegramMessage({
    chatId: String(chat.id),
    text: 'Telegram is connected to Nametag. Daily contact reminders will appear here after you enable them in notification settings.',
  });
}

async function handleCallback(update: TelegramUpdate): Promise<void> {
  const callback = update.callback_query;
  if (!callback?.data) {
    return;
  }

  const [action, callbackToken] = callback.data.split(':');

  if (!isSupportedAction(action) || !callbackToken) {
    await answerTelegramCallbackQuery(callback.id, 'Unknown action');
    return;
  }

  const delivery = await prisma.telegramReminderDelivery.findUnique({
    where: { callbackToken },
    include: {
      telegramConnection: true,
      user: {
        select: {
          nameOrder: true,
          nameDisplayFormat: true,
        },
      },
    },
  });

  if (!delivery) {
    await answerTelegramCallbackQuery(callback.id, 'Reminder not found');
    return;
  }

  if (delivery.telegramConnection.telegramUserId !== String(callback.from.id)) {
    securityLogger.suspiciousActivity('telegram', 'Telegram callback user mismatch', {
      deliveryId: delivery.id,
      telegramUserId: String(callback.from.id),
    });
    await answerTelegramCallbackQuery(callback.id, 'This reminder belongs to another Telegram account');
    return;
  }

  if (delivery.actionTaken) {
    await answerTelegramCallbackQuery(callback.id, 'Already recorded');
    return;
  }

  let personName = 'this person';

  if (delivery.reminderType === 'CONTACT') {
    const person = await prisma.person.findFirst({
      where: {
        id: delivery.entityId,
        userId: delivery.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        surname: true,
        middleName: true,
        secondLastName: true,
        nickname: true,
      },
    });

    if (!person) {
      await answerTelegramCallbackQuery(callback.id, 'Person not found');
      return;
    }

    personName = formatGraphName(person, delivery.user.nameOrder, delivery.user.nameDisplayFormat);

    if (action === 'contacted') {
      await prisma.person.update({
        where: { id: person.id },
        data: {
          lastContact: new Date(),
          lastContactReminderSent: new Date(),
        },
      });
    }
  }

  await prisma.$transaction([
    prisma.telegramReminderDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'actioned',
        actionTaken: action,
        actionTakenAt: new Date(),
      },
    }),
    prisma.telegramConnection.update({
      where: { id: delivery.telegramConnectionId },
      data: { lastInteractionAt: new Date() },
    }),
  ]);

  const responseText = getActionResponse(action, personName);

  await answerTelegramCallbackQuery(callback.id, responseText).catch((error: unknown) => {
    log.warn({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to answer Telegram callback query');
  });

  const chatId = callback.message?.chat.id;
  const messageId = callback.message?.message_id;

  if (chatId && messageId) {
    await editTelegramMessage({
      chatId: String(chatId),
      messageId: String(messageId),
      text: `${callback.message?.text ?? 'Nametag reminder'}\n\n${responseText}`,
    }).catch((error: unknown) => {
      log.warn({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to edit Telegram reminder message');
    });
  }
}

function isSupportedAction(action: string): action is 'contacted' {
  return action === 'contacted';
}

function getActionResponse(_action: 'contacted', personName: string): string {
  return `Recorded contact with ${personName}.`;
}
