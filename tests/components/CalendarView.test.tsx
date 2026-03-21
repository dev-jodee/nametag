import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarView from '../../components/CalendarView';
import enMessages from '../../locales/en.json';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('loads month events and routes to the selected person', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            id: 'event-1',
            personId: 'person-1',
            personName: 'Alice',
            type: 'birthday',
            title: 'Birthday',
            day: 15,
          },
        ],
      }),
    } as Response);

    const user = userEvent.setup();
    render(
      <Wrapper>
        <CalendarView initialYear={2026} initialMonth={3} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/calendar?year=2026&month=3');
    });

    const eventButton = await screen.findByRole('button', { name: 'Alice' });
    await user.click(eventButton);

    expect(mocks.push).toHaveBeenCalledWith('/people/person-1');
  });

  it('fetches a new month when navigating forward', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    } as Response);

    const user = userEvent.setup();
    render(
      <Wrapper>
        <CalendarView initialYear={2026} initialMonth={3} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/calendar?year=2026&month=3');
    });

    await user.click(screen.getByRole('button', { name: /next month/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/calendar?year=2026&month=4');
    });
  });
});
