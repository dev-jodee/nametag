import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  importantDateFindMany: vi.fn(),
  personFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  getTranslationsForLocale: vi.fn(),
  formatFullName: vi.fn((person: { name: string }, _nameOrder?: unknown) => person.name),
  getDateDisplayTitle: vi.fn((importantDate: { title: string }, _t?: unknown) => importantDate.title || 'Birthday'),
  getIntervalMs: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    importantDate: {
      findMany: mocks.importantDateFindMany,
    },
    person: {
      findMany: mocks.personFindMany,
    },
    event: {
      findMany: mocks.eventFindMany,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('../../lib/i18n-utils', () => ({
  getTranslationsForLocale: (locale: string, namespace?: string) => mocks.getTranslationsForLocale(locale, namespace),
}));

vi.mock('../../lib/nameUtils', () => ({
  formatFullName: (person: { name: string }, nameOrder?: unknown) => mocks.formatFullName(person, nameOrder),
}));

vi.mock('../../lib/important-date-types', () => ({
  getDateDisplayTitle: (importantDate: { title: string }, t?: unknown) => mocks.getDateDisplayTitle(importantDate, t),
}));

vi.mock('../../lib/upcoming-events', () => ({
  getIntervalMs: (interval: number, unit: string) => mocks.getIntervalMs(interval, unit),
}));

import { GET } from '../../app/api/calendar/route';

describe('GET /api/calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.userFindUnique.mockResolvedValue({
      nameOrder: 'WESTERN',
      language: 'en',
    });
    mocks.getTranslationsForLocale.mockImplementation(async (_locale: string, namespace?: string) => {
      return (key: string) => {
        if (namespace === 'dashboard' && key === 'timeToCatchUp') return 'Time to catch up';
        if (namespace === 'people' && key === 'lastContact') return 'Last contact';
        return key;
      };
    });
    mocks.getIntervalMs.mockReturnValue(7 * 24 * 60 * 60 * 1000);
    mocks.importantDateFindMany.mockResolvedValue([]);
    mocks.personFindMany.mockResolvedValue([]);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it('returns calendar events for the requested month', async () => {
    mocks.importantDateFindMany.mockResolvedValue([
      {
        id: 'date-1',
        type: 'birthday',
        title: '',
        date: new Date('2026-03-15T12:00:00.000Z'),
        reminderType: 'YEARLY',
        person: {
          id: 'person-1',
          name: 'Alice',
          surname: null,
          nickname: null,
          photo: 'alice.jpg',
        },
      },
      {
        id: 'date-2',
        type: 'birthday',
        title: '',
        date: new Date('2026-04-10T12:00:00.000Z'),
        reminderType: 'YEARLY',
        person: {
          id: 'person-2',
          name: 'Bob',
          surname: null,
          nickname: null,
          photo: null,
        },
      },
    ]);
    mocks.personFindMany
      .mockResolvedValueOnce([
        {
          id: 'person-3',
          name: 'Cara',
          surname: null,
          nickname: null,
          photo: null,
          lastContact: new Date('2026-03-10T12:00:00.000Z'),
          contactReminderInterval: 1,
          contactReminderIntervalUnit: 'WEEKS',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'person-4',
          name: 'Dan',
          surname: null,
          nickname: null,
          photo: null,
          lastContact: new Date('2026-03-05T12:00:00.000Z'),
        },
      ]);
    mocks.eventFindMany.mockResolvedValue([
      {
        id: 'event-1',
        title: 'Coffee meetup',
        date: new Date('2026-03-12T18:00:00.000Z'),
        people: [
          {
            id: 'person-5',
            name: 'Erin',
            surname: null,
            nickname: null,
            photo: null,
          },
        ],
      },
    ]);

    const response = await GET(new Request('http://localhost/api/calendar?year=2026&month=3'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.year).toBe(2026);
    expect(body.month).toBe(3);
    expect(body.events).toEqual([
      expect.objectContaining({
        id: 'last-contact-person-4',
        type: 'last_contact',
        day: 5,
      }),
      expect.objectContaining({
        id: 'planned-event-1',
        type: 'planned_event',
        day: 12,
        href: '/events/event-1/edit',
        label: 'Erin',
        title: 'Coffee meetup',
      }),
      expect.objectContaining({
        id: 'important-date-1',
        type: 'birthday',
        day: 15,
      }),
      expect.objectContaining({
        id: 'contact-person-3',
        type: 'contact_reminder',
        day: 17,
      }),
    ]);
  });

  it('skips ONCE reminders outside their original year', async () => {
    mocks.importantDateFindMany.mockResolvedValue([
      {
        id: 'date-1',
        type: null,
        title: 'Graduation',
        date: new Date('2025-03-20T12:00:00.000Z'),
        reminderType: 'ONCE',
        person: {
          id: 'person-1',
          name: 'Alice',
          surname: null,
          nickname: null,
          photo: null,
        },
      },
    ]);
    mocks.personFindMany.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/calendar?year=2026&month=3'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toEqual([]);
  });

  it('rejects invalid month parameters', async () => {
    const response = await GET(new Request('http://localhost/api/calendar?year=2026&month=13'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid year or month');
  });

  it('uses the event title when a planned event has no active linked people', async () => {
    mocks.eventFindMany.mockResolvedValue([
      {
        id: 'event-2',
        title: 'Solo planning',
        date: new Date('2026-03-20T18:00:00.000Z'),
        people: [],
      },
    ]);

    const response = await GET(new Request('http://localhost/api/calendar?year=2026&month=3'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toContainEqual(expect.objectContaining({
      id: 'planned-event-2',
      type: 'planned_event',
      href: '/events/event-2/edit',
      label: 'Solo planning',
      title: 'Solo planning',
      day: 20,
    }));
  });
});
