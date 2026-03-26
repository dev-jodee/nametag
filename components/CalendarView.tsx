'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/app/api/calendar/route';

const EVENT_COLORS: Record<CalendarEvent['type'], string> = {
  birthday: 'bg-pink-500',
  anniversary: 'bg-purple-500',
  nameday: 'bg-blue-500',
  memorial: 'bg-gray-500',
  custom_date: 'bg-primary',
  contact_reminder: 'bg-warning',
  last_contact: 'bg-secondary',
  planned_event: 'bg-tertiary',
};

const EVENT_TEXT_COLORS: Record<CalendarEvent['type'], string> = {
  birthday: 'text-white',
  anniversary: 'text-white',
  nameday: 'text-white',
  memorial: 'text-white',
  custom_date: 'text-black',
  contact_reminder: 'text-black',
  last_contact: 'text-black',
  planned_event: 'text-black',
};

interface CalendarViewProps {
  initialYear?: number;
  initialMonth?: number;
}

export default function CalendarView({ initialYear, initialMonth }: CalendarViewProps) {
  const router = useRouter();
  const t = useTranslations('calendar');

  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?year=${y}&month=${m}`);
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
  }, [t]);

  useEffect(() => {
    fetchEvents(year, month);
  }, [year, month, fetchEvents]);

  const goToPrevMonth = () => {
    if (month === 1) {
      setYear((y: number) => y - 1);
      setMonth(12);
    } else {
      setMonth((m: number) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setYear((y: number) => y + 1);
      setMonth(1);
    } else {
      setMonth((m: number) => m + 1);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Events grouped by day
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const event of events) {
    if (!eventsByDay[event.day]) eventsByDay[event.day] = [];
    eventsByDay[event.day].push(event);
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const MONTH_NAMES = [
    t('months.january'), t('months.february'), t('months.march'),
    t('months.april'), t('months.may'), t('months.june'),
    t('months.july'), t('months.august'), t('months.september'),
    t('months.october'), t('months.november'), t('months.december'),
  ];

  const DAY_NAMES = [
    t('days.sun'), t('days.mon'), t('days.tue'),
    t('days.wed'), t('days.thu'), t('days.fri'), t('days.sat'),
  ];

  return (
    <div className="bg-surface shadow-lg rounded-lg border-2 border-primary/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface-elevated">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-md hover:bg-primary/10 text-foreground transition-colors"
            aria-label={t('prevMonth')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-primary min-w-[200px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-md hover:bg-primary/10 text-foreground transition-colors"
            aria-label={t('nextMonth')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
        >
          {t('today')}
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map(day => (
          <div key={day} className="p-2 text-center text-xs font-semibold text-muted uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <svg className="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {t('loading')}
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] p-1 border-b border-r border-border bg-surface/50" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dayEvents = eventsByDay[day] ?? [];
            const isToday = day === todayDay;

            return (
              <div
                key={day}
                className={`min-h-[100px] p-1 border-b border-r border-border ${
                  isToday ? 'bg-primary/5' : 'bg-surface hover:bg-surface-elevated'
                } transition-colors`}
              >
                <div className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-primary text-black font-bold'
                    : 'text-foreground'
                }`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(event => (
                    <button
                      key={event.id}
                      onClick={() => router.push(event.href)}
                      className={`w-full text-left text-xs px-1.5 py-0.5 rounded ${
                        EVENT_COLORS[event.type]
                      } ${EVENT_TEXT_COLORS[event.type]} truncate hover:opacity-90 transition-opacity`}
                      title={`${event.label} – ${event.title}`}
                    >
                      {event.label}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted px-1">
                      +{dayEvents.length - 3} {t('more')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-4 border-t border-border bg-surface-elevated">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-3 h-3 rounded-sm bg-pink-500 inline-block" />
          {t('legend.birthday')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" />
          {t('legend.anniversary')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
          {t('legend.nameday')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-3 h-3 rounded-sm bg-gray-500 inline-block" />
          {t('legend.memorial')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
          {t('legend.customDate')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-3 h-3 rounded-sm bg-warning inline-block" />
          {t('legend.contactReminder')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-3 h-3 rounded-sm bg-secondary inline-block" />
          {t('legend.lastContact')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-3 h-3 rounded-sm bg-tertiary inline-block" />
          {t('legend.plannedEvent')}
        </div>
      </div>
    </div>
  );
}
