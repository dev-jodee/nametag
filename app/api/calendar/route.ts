import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { formatFullName } from '@/lib/nameUtils';
import { parseAsLocalDate } from '@/lib/date-format';
import { getDateDisplayTitle } from '@/lib/important-date-types';
import { getIntervalMs } from '@/lib/upcoming-events';
import { getTranslationsForLocale } from '@/lib/i18n-utils';
import { getUserLocale } from '@/lib/locale';

export interface CalendarEvent {
  id: string;
  personId: string;
  personName: string;
  personPhoto?: string | null;
  type: 'birthday' | 'anniversary' | 'nameday' | 'memorial' | 'custom_date' | 'contact_reminder' | 'last_contact';
  title: string;
  day: number;
  isYearUnknown?: boolean;
}

// GET /api/calendar?year=2026&month=3
export const GET = withAuth(async (request, session) => {
  try {
    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');
    const monthParam = url.searchParams.get('month');

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1; // 1-indexed

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return apiResponse.error('Invalid year or month');
    }

    const userId = session.user.id;

    // Fetch user preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nameOrder: true, language: true },
    });
    const nameOrder = user?.nameOrder;

    const userLocale = await getUserLocale(userId);
    const tDates = await getTranslationsForLocale(userLocale, 'people.form.importantDates');
    const tDashboard = await getTranslationsForLocale(userLocale, 'dashboard');
    const tPeople = await getTranslationsForLocale(userLocale, 'people');

    // Fetch all data in parallel
    const [importantDates, peopleWithContactReminders, peopleWithLastContact] = await Promise.all([
      prisma.importantDate.findMany({
        where: {
          person: { userId, deletedAt: null },
          deletedAt: null,
        },
        include: {
          person: {
            select: {
              id: true,
              name: true,
              surname: true,
              nickname: true,
              photo: true,
            },
          },
        },
      }),
      prisma.person.findMany({
        where: { userId, contactReminderEnabled: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          surname: true,
          nickname: true,
          photo: true,
          lastContact: true,
          contactReminderInterval: true,
          contactReminderIntervalUnit: true,
        },
      }),
      prisma.person.findMany({
        where: {
          userId,
          deletedAt: null,
          lastContact: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
        select: {
          id: true,
          name: true,
          surname: true,
          nickname: true,
          photo: true,
          lastContact: true,
        },
      }),
    ]);

    const events: CalendarEvent[] = [];

    // --- Important dates ---
    for (const importantDate of importantDates) {
      const originalDate = parseAsLocalDate(importantDate.date);
      const eventMonth = originalDate.getMonth() + 1; // 1-indexed

      if (eventMonth !== month) continue;

      // Project the date to the requested year
      const eventDay = originalDate.getDate();
      const isYearUnknown = originalDate.getFullYear() <= 1604;

      const type = importantDate.type as CalendarEvent['type'] | null;

      events.push({
        id: `important-${importantDate.id}`,
        personId: importantDate.person.id,
        personName: formatFullName(importantDate.person, nameOrder),
        personPhoto: importantDate.person.photo,
        type: type ?? 'custom_date',
        title: getDateDisplayTitle(importantDate, tDates),
        day: eventDay,
        isYearUnknown,
      });
    }

    // --- Contact reminders ---
    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0); // last day of month
    monthEnd.setHours(23, 59, 59, 999);

    for (const person of peopleWithContactReminders) {
      if (!person.lastContact) continue;

      const interval = person.contactReminderInterval || 1;
      const unit = person.contactReminderIntervalUnit || 'MONTHS';
      const intervalMs = getIntervalMs(interval, unit);

      const referenceDate = new Date(person.lastContact);
      referenceDate.setHours(0, 0, 0, 0);
      const reminderDueDate = new Date(referenceDate.getTime() + intervalMs);
      reminderDueDate.setHours(0, 0, 0, 0);

      if (reminderDueDate >= monthStart && reminderDueDate <= monthEnd) {
        events.push({
          id: `contact-${person.id}`,
          personId: person.id,
          personName: formatFullName(person, nameOrder),
          personPhoto: person.photo,
          type: 'contact_reminder',
          title: tDashboard('timeToCatchUp') || 'Time to catch up',
          day: reminderDueDate.getDate(),
        });
      }
    }

    // --- Last contact dates ---
    for (const person of peopleWithLastContact) {
      if (!person.lastContact) continue;
      const contactDate = new Date(person.lastContact);

      events.push({
        id: `last-contact-${person.id}`,
        personId: person.id,
        personName: formatFullName(person, nameOrder),
        personPhoto: person.photo,
        type: 'last_contact',
        title: tPeople('lastContact') || 'Last contact',
        day: contactDate.getDate(),
      });
    }

    // Sort by day
    events.sort((a, b) => a.day - b.day);

    return apiResponse.ok({ events, year, month });
  } catch (error) {
    return handleApiError(error, 'calendar');
  }
});
