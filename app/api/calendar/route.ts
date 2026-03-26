import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { formatFullName } from '@/lib/nameUtils';
import { parseAsLocalDate } from '@/lib/date-format';
import { getDateDisplayTitle } from '@/lib/important-date-types';
import { getIntervalMs } from '@/lib/upcoming-events';
import { getTranslationsForLocale } from '@/lib/i18n-utils';
import { normalizeLocale } from '@/lib/locale';

export interface CalendarEvent {
  id: string;
  href: string;
  label: string;
  personPhoto?: string | null;
  type: 'birthday' | 'anniversary' | 'nameday' | 'memorial' | 'custom_date' | 'contact_reminder' | 'last_contact' | 'planned_event';
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
    const userLocale = user?.language ? normalizeLocale(user.language) : 'en';
    const tDates = await getTranslationsForLocale(userLocale, 'people.form.importantDates');
    const tDashboard = await getTranslationsForLocale(userLocale, 'dashboard');
    const tPeople = await getTranslationsForLocale(userLocale, 'people');

    // Fetch all data in parallel
    const [importantDates, peopleWithContactReminders, peopleWithLastContact, plannedEvents] = await Promise.all([
      prisma.importantDate.findMany({
        where: {
          person: { userId, deletedAt: null },
          deletedAt: null,
        },
        select: {
          id: true,
          type: true,
          title: true,
          date: true,
          reminderType: true,
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
      prisma.event.findMany({
        where: {
          userId,
          date: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
        select: {
          id: true,
          title: true,
          date: true,
          people: {
            where: { deletedAt: null },
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
    ]);

    const events: CalendarEvent[] = [];

    // --- Important dates ---
    for (const importantDate of importantDates) {
      const originalDate = parseAsLocalDate(importantDate.date);
      const eventMonth = originalDate.getMonth() + 1; // 1-indexed

      if (eventMonth !== month) continue;

      const isYearUnknown = originalDate.getFullYear() <= 1604;

      // ONCE reminders only appear in their original year (unless year is unknown)
      if (
        importantDate.reminderType === 'ONCE' &&
        !isYearUnknown &&
        originalDate.getFullYear() !== year
      ) {
        continue;
      }

      // Project the date to the requested year
      const eventDay = originalDate.getDate();

      const type = importantDate.type as CalendarEvent['type'] | null;

      events.push({
        id: `important-${importantDate.id}`,
        href: `/people/${importantDate.person.id}`,
        label: formatFullName(importantDate.person, nameOrder),
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
          href: `/people/${person.id}`,
          label: formatFullName(person, nameOrder),
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
        href: `/people/${person.id}`,
        label: formatFullName(person, nameOrder),
        personPhoto: person.photo,
        type: 'last_contact',
        title: tPeople('lastContact') || 'Last contact',
        day: contactDate.getDate(),
      });
    }

    // --- Planned events ---
    for (const plannedEvent of plannedEvents) {
      const eventDate = new Date(plannedEvent.date);
      const participantNames = plannedEvent.people.map((person) => formatFullName(person, nameOrder));
      const label = participantNames.length > 0
        ? participantNames.join(', ')
        : plannedEvent.title;

      events.push({
        id: `planned-${plannedEvent.id}`,
        href: `/events/${plannedEvent.id}/edit`,
        label,
        personPhoto: plannedEvent.people[0]?.photo ?? null,
        type: 'planned_event',
        title: plannedEvent.title,
        day: eventDate.getDate(),
      });
    }

    // Sort by day
    events.sort((a, b) => a.day - b.day);

    return apiResponse.ok({ events, year, month });
  } catch (error) {
    return handleApiError(error, 'calendar');
  }
});
