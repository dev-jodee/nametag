'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface NotificationsState {
  timeZone: string;
  telegramRemindersEnabled: boolean;
  telegramReminderHour: number;
}

interface TelegramConnectionState {
  telegramUsername: string | null;
  telegramFirstName: string | null;
  isActive: boolean;
  connectedAt: string | Date;
}

interface NotificationsSettingsProps {
  initialNotifications: NotificationsState;
  initialTelegramConnection: TelegramConnectionState | null;
}

export default function NotificationsSettings({
  initialNotifications,
  initialTelegramConnection,
}: NotificationsSettingsProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialNotifications);
  const [telegramConnection, setTelegramConnection] = useState(initialTelegramConnection);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const browserTimeZone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, []);

  const connectionLabel = telegramConnection
    ? telegramConnection.telegramUsername
      ? `@${telegramConnection.telegramUsername}`
      : telegramConnection.telegramFirstName || 'Connected'
    : 'Not connected';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/user/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to save notification settings');
        return;
      }

      toast.success('Notification settings saved');
      router.refresh();
    } catch {
      toast.error('Unable to save notification settings');
    } finally {
      setIsSaving(false);
    }
  };

  const createConnectLink = async () => {
    setIsConnecting(true);

    try {
      const response = await fetch('/api/telegram/link-token', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create Telegram link');
        return;
      }

      setConnectUrl(data.connectUrl);
      window.open(data.connectUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Unable to create Telegram link');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectTelegram = async () => {
    setIsDisconnecting(true);

    try {
      const response = await fetch('/api/user/notifications', { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to disconnect Telegram');
        return;
      }

      setTelegramConnection(null);
      setFormData((current) => ({ ...current, telegramRemindersEnabled: false }));
      toast.success('Telegram disconnected');
      router.refresh();
    } catch {
      toast.error('Unable to disconnect Telegram');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Telegram</h3>
          <p className="text-sm text-muted">
            Buttons on reminder messages record whether you contacted, planned, or skipped the person.
          </p>
        </div>

        <div className="border border-border rounded-lg p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{connectionLabel}</p>
              <p className="text-sm text-muted">
                {telegramConnection ? 'Telegram is linked to this account.' : 'Connect your Telegram bot chat before enabling reminders.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={createConnectLink}
                disabled={isConnecting}
                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {telegramConnection ? 'Reconnect' : isConnecting ? 'Connecting...' : 'Connect Telegram'}
              </button>
              {telegramConnection && (
                <button
                  type="button"
                  onClick={disconnectTelegram}
                  disabled={isDisconnecting}
                  className="px-4 py-2 border border-border text-muted rounded-lg font-medium hover:bg-surface-elevated transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>

          {connectUrl && (
            <div className="bg-surface-elevated border border-border rounded-lg p-3 text-sm">
              <p className="text-muted mb-2">Telegram did not open automatically? Use this link:</p>
              <a href={connectUrl} target="_blank" rel="noreferrer" className="text-primary break-all hover:underline">
                {connectUrl}
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Daily reminders</h3>
          <p className="text-sm text-muted">
            Nametag checks reminders from the scheduled cron job and sends Telegram messages at the hour you choose.
          </p>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={formData.telegramRemindersEnabled}
            onChange={(event) => setFormData({ ...formData, telegramRemindersEnabled: event.target.checked })}
            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>
            <span className="block font-medium text-foreground">Enable Telegram contact reminders</span>
            <span className="block text-sm text-muted">You must connect Telegram before reminders can be delivered.</span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="telegramReminderHour" className="block text-sm font-medium text-muted mb-1">
              Send hour
            </label>
            <select
              id="telegramReminderHour"
              value={formData.telegramReminderHour}
              onChange={(event) => setFormData({ ...formData, telegramReminderHour: Number(event.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="timeZone" className="block text-sm font-medium text-muted mb-1">
              Time zone
            </label>
            <input
              id="timeZone"
              value={formData.timeZone}
              onChange={(event) => setFormData({ ...formData, timeZone: event.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setFormData({ ...formData, timeZone: browserTimeZone })}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Use {browserTimeZone}
            </button>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
