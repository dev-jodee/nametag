'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/app/api/calendar/route';

const EVENT_DOT_COLORS: Record<CalendarEvent['type'], string> = {
  birthday: 'bg-pink-500',
  anniversary: 'bg-purple-500',
  nameday: 'bg-blue-500',
  memorial: 'bg-gray-500',
  custom_date: 'bg-primary',
  contact_reminder: 'bg-warning',
  last_contact: 'bg-secondary',
};

export default function MiniCalendar() {
  const router = useRouter();
  const t = useTranslations('calendar');

  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      } else {
        toast.error(t('loadError'));
      }
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [year, month, t]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const event of events) {
    if (!eventsByDay[event.day]) eventsByDay[event.day] = [];
    eventsByDay[event.day].push(event);
  }

  const todayDay = now.getDate();

  const MONTH_NAMES = [
    t('months.january'), t('months.february'), t('months.march'),
    t('months.april'), t('months.may'), t('months.june'),
    t('months.july'), t('months.august'), t('months.september'),
    t('months.october'), t('months.november'), t('months.december'),
  ];

  const DAY_NAMES_SHORT = [
    t('days.sun'), t('days.mon'), t('days.tue'),
    t('days.wed'), t('days.thu'), t('days.fri'), t('days.sat'),
  ];

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : [];

  return (
    <div className="bg-surface shadow-lg rounded-lg p-6 mb-8 border-2 border-primary/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-4 relative">
        <h2 className="text-xl font-bold text-primary">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <Link
          href="/calendar"
          className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
        >
          {t('viewFull')} →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {t('loading')}
        </div>
      ) : (
        <div className="relative">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES_SHORT.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayEvents = eventsByDay[day] ?? [];
              const isToday = day === todayDay;
              const isSelected = day === selectedDay;
              const hasEvents = dayEvents.length > 0;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`relative flex flex-col items-center py-1 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary/20 ring-1 ring-primary'
                      : isToday
                      ? 'bg-primary/10'
                      : hasEvents
                      ? 'hover:bg-surface-elevated'
                      : 'hover:bg-surface-elevated cursor-default'
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    isToday ? 'text-primary font-bold' : 'text-foreground'
                  }`}>
                    {day}
                  </span>
                  {hasEvents && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((event, idx) => (
                        <span
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT_COLORS[event.type]}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day events */}
          {selectedDay && selectedEvents.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <p className="text-sm font-semibold text-muted">
                {MONTH_NAMES[month - 1]} {selectedDay}
              </p>
              {selectedEvents.map(event => (
                <button
                  key={event.id}
                  onClick={() => router.push(`/people/${event.personId}`)}
                  className="w-full flex items-center gap-2 text-left p-2 rounded-md hover:bg-surface-elevated transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_DOT_COLORS[event.type]}`} />
                  <span className="text-sm font-medium text-foreground truncate">{event.personName}</span>
                  <span className="text-xs text-muted truncate ml-auto">{event.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border relative">
        <Link
          href="/calendar"
          className="inline-flex items-center text-sm text-primary hover:text-primary-dark font-medium transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {t('openCalendar')}
        </Link>
      </div>
    </div>
  );
}
