import { parseAsLocalDate } from '@/lib/date-format';

export interface ImportantDateReminderCandidate {
  date: Date;
  reminderType: string | null;
  reminderInterval: number | null;
  reminderIntervalUnit: string | null;
  lastReminderSent: Date | null;
}

export interface ContactReminderCandidate {
  lastContact: Date | null;
  contactReminderInterval: number | null;
  contactReminderIntervalUnit: string | null;
  lastContactReminderSent: Date | null;
}

interface TimeZoneDateParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
}

function getTimeZoneDateParts(
  date: Date,
  timeZone: string,
  includeHour = false
): TimeZoneDateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeHour ? { hour: '2-digit', hourCycle: 'h23' as const } : {}),
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    ...(includeHour ? { hour: getPart('hour') } : {}),
  };
}

export function getCurrentHourInTimeZone(
  timeZone: string,
  now: Date = new Date()
): number {
  return getTimeZoneDateParts(now, timeZone, true).hour ?? 0;
}

export function getTimeZoneDateKey(
  date: Date,
  timeZone: string
): string {
  const parts = getTimeZoneDateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getStartOfTodayInTimeZone(
  timeZone: string,
  now: Date = new Date()
): Date {
  const parts = getTimeZoneDateParts(now, timeZone);
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function wasDateSentTodayInTimeZone(
  sentAt: Date | null | undefined,
  timeZone: string,
  now: Date = new Date()
): boolean {
  if (!sentAt) {
    return false;
  }

  return getTimeZoneDateKey(sentAt, timeZone) === getTimeZoneDateKey(now, timeZone);
}

export function getIntervalMs(interval: number, unit: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (unit) {
    case 'DAYS':
      return interval * msPerDay;
    case 'WEEKS':
      return interval * 7 * msPerDay;
    case 'MONTHS':
      return interval * 30 * msPerDay;
    case 'YEARS':
      return interval * 365 * msPerDay;
    default:
      return 365 * msPerDay;
  }
}

export function shouldSendContactReminder(
  person: ContactReminderCandidate,
  today: Date
): boolean {
  const interval = person.contactReminderInterval || 1;
  const unit = person.contactReminderIntervalUnit || 'MONTHS';
  const intervalMs = getIntervalMs(interval, unit);
  const referenceDate = person.lastContact || person.lastContactReminderSent;

  if (!referenceDate) {
    return false;
  }

  const timeSinceReference = today.getTime() - new Date(referenceDate).getTime();
  if (timeSinceReference < intervalMs) {
    return false;
  }

  if (person.lastContactReminderSent) {
    const lastSent = new Date(person.lastContactReminderSent);
    if (
      lastSent.getFullYear() === today.getFullYear() &&
      lastSent.getMonth() === today.getMonth() &&
      lastSent.getDate() === today.getDate()
    ) {
      return false;
    }
  }

  return true;
}

export function shouldSendImportantDateReminder(
  importantDate: ImportantDateReminderCandidate,
  today: Date
): boolean {
  const eventDate = parseAsLocalDate(importantDate.date);

  if (importantDate.reminderType === 'ONCE') {
    const eventDay = new Date(eventDate);
    eventDay.setHours(0, 0, 0, 0);

    if (eventDay.getTime() !== today.getTime()) {
      return false;
    }

    if (importantDate.lastReminderSent) {
      const lastSent = new Date(importantDate.lastReminderSent);
      lastSent.setHours(0, 0, 0, 0);
      if (lastSent.getTime() === today.getTime()) {
        return false;
      }
    }

    return true;
  }

  if (importantDate.reminderType === 'RECURRING') {
    const interval = importantDate.reminderInterval || 1;
    const intervalUnit = importantDate.reminderIntervalUnit || 'YEARS';
    const eventDateNormalized = new Date(eventDate);
    eventDateNormalized.setHours(0, 0, 0, 0);

    if (today.getTime() < eventDateNormalized.getTime()) {
      return false;
    }

    if (intervalUnit === 'YEARS') {
      const eventDay = eventDateNormalized.getDate();
      const eventMonth = eventDateNormalized.getMonth();
      const todayDay = today.getDate();
      const todayMonth = today.getMonth();

      if (todayDay !== eventDay || todayMonth !== eventMonth) {
        return false;
      }

      if (importantDate.lastReminderSent) {
        const lastSent = new Date(importantDate.lastReminderSent);
        const lastSentYear = lastSent.getFullYear();
        const todayYear = today.getFullYear();
        const yearsSinceLastSent = todayYear - lastSentYear;
        return yearsSinceLastSent >= interval;
      }

      return true;
    }

    const intervalMs = getIntervalMs(interval, intervalUnit);

    if (importantDate.lastReminderSent) {
      const lastSent = new Date(importantDate.lastReminderSent);
      lastSent.setHours(0, 0, 0, 0);

      const timeSinceLastSent = today.getTime() - lastSent.getTime();
      if (timeSinceLastSent < intervalMs) {
        return false;
      }

      const intervalsPassed = Math.floor(timeSinceLastSent / intervalMs);
      const nextReminderDate = new Date(lastSent.getTime() + (intervalsPassed * intervalMs));
      nextReminderDate.setHours(0, 0, 0, 0);

      return nextReminderDate.getTime() === today.getTime();
    }

    if (eventDateNormalized.getFullYear() <= 1604) {
      const currentYear = today.getFullYear();
      eventDateNormalized.setFullYear(currentYear);
      if (eventDateNormalized.getTime() > today.getTime()) {
        eventDateNormalized.setFullYear(currentYear - 1);
      }
    }

    const timeSinceEvent = today.getTime() - eventDateNormalized.getTime();
    const intervalsPassed = Math.floor(timeSinceEvent / intervalMs);
    const nextReminderDate = new Date(eventDateNormalized.getTime() + (intervalsPassed * intervalMs));
    nextReminderDate.setHours(0, 0, 0, 0);

    return nextReminderDate.getTime() === today.getTime();
  }

  return false;
}

export function formatInterval(interval: number, unit: string): string {
  const unitLower = unit.toLowerCase();
  if (interval === 1) {
    return `${interval} ${unitLower.slice(0, -1)}`;
  }
  return `${interval} ${unitLower}`;
}

export function formatReminderDate(
  date: Date,
  dateFormat: string | null,
  locale: string = 'en'
): string {
  const value = new Date(date);
  const localeCode = locale === 'en' ? 'en-US' : locale;
  const month = value.toLocaleDateString(localeCode, { month: 'long' });
  const day = value.getDate();
  const year = value.getFullYear();

  switch (dateFormat) {
    case 'DMY':
      return `${day} ${month} ${year}`;
    case 'YMD':
      return `${year}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'MDY':
    default:
      return `${month} ${day}, ${year}`;
  }
}
