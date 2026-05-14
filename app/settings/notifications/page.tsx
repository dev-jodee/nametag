import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import NotificationsSettings from '@/components/NotificationsSettings';

export default async function NotificationsSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

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
    redirect('/login');
  }

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">
        Notifications
      </h2>
      <p className="text-muted mb-6">
        Send daily contact reminders to Telegram and track what you do from the message buttons.
      </p>
      <NotificationsSettings
        initialNotifications={{
          timeZone: user.timeZone,
          telegramRemindersEnabled: user.telegramRemindersEnabled,
          telegramReminderHour: user.telegramReminderHour,
        }}
        initialTelegramConnection={user.telegramConnection}
      />
    </div>
  );
}
