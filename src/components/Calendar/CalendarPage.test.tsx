import { fireEvent, render, screen } from '@testing-library/react';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../../services/api';
import CalendarPage from './CalendarPage';

type MockCalendarEvent = {
  id: string;
  title: string;
  start?: string;
  allDay?: boolean;
  extendedProps: {
    entry: unknown;
    endDate?: string;
  };
};

type MockCalendarProps = {
  initialView?: string;
  events?: MockCalendarEvent[];
  dateClick?: (arg: {
    date: Date;
    allDay: boolean;
    jsEvent: { target: EventTarget | null };
    view: { type: string };
  }) => void;
  datesSet?: (arg: {
    start: Date;
    view: { type: string };
  }) => void;
  dayCellContent?: (arg: {
    date: Date;
    dayNumberText: string;
    view: { type: string };
  }) => ReactNode;
  eventClick?: (arg: {
    event: {
      extendedProps: MockCalendarEvent['extendedProps'];
      allDay: boolean;
      start: Date | null;
    };
  }) => void;
};

function attachSummaryDateClick(
  node: ReactNode,
  dateClick: MockCalendarProps['dateClick'] | undefined,
  anchorDate: Date,
): ReactNode {
  if (!isValidElement(node)) {
    return node;
  }

  const element = node as ReactElement<{
    children?: ReactNode;
    className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  }>;

  const nextChildren = element.props.children == null
    ? element.props.children
    : Children.map(element.props.children, child => attachSummaryDateClick(child, dateClick, anchorDate));

  if (element.props.className === 'month-summary-badge') {
    return cloneElement(element, {
      onClick: (event) => {
        element.props.onClick?.(event);
        dateClick?.({
          date: anchorDate,
          allDay: true,
          jsEvent: { target: event.currentTarget },
          view: { type: 'dayGridMonth' },
        });
      },
    });
  }

  if (nextChildren !== element.props.children) {
    return cloneElement(element, { children: nextChildren });
  }

  return element;
}

vi.mock('@fullcalendar/react', () => ({
  default: ({ initialView, events = [], dateClick, datesSet, dayCellContent, eventClick }: MockCalendarProps) => {
    const anchorDate = events[0]?.start ? new Date(events[0].start) : new Date('2026-05-04T09:00:00');
    const monthCell = initialView === 'dayGridMonth' && dayCellContent
      ? attachSummaryDateClick(
          dayCellContent({
            date: anchorDate,
            dayNumberText: String(anchorDate.getDate()),
            view: { type: 'dayGridMonth' },
          }),
          dateClick,
          anchorDate,
        )
      : null;

    return (
      <div data-testid="mock-calendar">
        {monthCell && <div data-testid="mock-month-cell">{monthCell}</div>}
        {datesSet && (
          <button
            type="button"
            onClick={() => datesSet({ start: anchorDate, view: { type: 'timeGridDay' } })}
          >
            Switch to day view
          </button>
        )}
        {events.map(event => (
          <button
            key={event.id}
            type="button"
            onClick={() =>
              eventClick?.({
                event: {
                  extendedProps: event.extendedProps,
                  allDay: Boolean(event.allDay),
                  start: event.start ? new Date(event.start) : null,
                },
              })
            }
          >
            {event.title}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }));
vi.mock('@fullcalendar/interaction', () => ({ default: {} }));
vi.mock('../../services/api', () => ({
  fetchAllPlans: vi.fn(),
  submitAthleteNote: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  rescheduleCoachEntry: vi.fn(),
}));

const fetchAllPlansMock = vi.mocked(api.fetchAllPlans);

const workoutPlan = [
  '---',
  'week_start: 2026-05-04',
  'season: base',
  'training_block: "Base Phase 2"',
  'week_number: 1.3',
  '---',
  '',
  '# Week of 2026-05-04',
  '',
  'Smooth build week. Keep the volume steady and avoid turning Tuesday into a race.',
  '',
  '---',
  '',
  '## 2026-05-04 (Monday)',
  '',
  '### 09:00 — Workout: Easy Endurance Ride — Back to It',
  '',
  'First day of your free week.',
  '',
  '```yaml',
  'type: ride',
  'duration_minutes: 60',
  'intensity: easy',
  'tss_planned: 42',
  'structure:',
  '  - warmup: "10min Z1"',
  '  - main: "40min Z2, steady rhythmic pedaling, 85-95rpm"',
  '  - cooldown: "10min Z1"',
  'notes: "Outdoor preferred."',
  '```',
].join('\n');

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.innerWidth = 1024;
    fetchAllPlansMock.mockResolvedValue({
      plans: [
        {
          filename: 'week-2026-05-04.md',
          content: workoutPlan,
        },
      ],
    });
  });

  it('shows the current week summary above the weekly calendar', async () => {
    render(<CalendarPage />);

    expect(await screen.findByText('Week Summary')).toBeInTheDocument();
    expect(
      screen.getByText('Smooth build week. Keep the volume steady and avoid turning Tuesday into a race.')
    ).toBeInTheDocument();
  });

  it('opens the workout modal for canonical structured workout yaml without crashing', async () => {
    render(<CalendarPage />);

    const eventButton = await screen.findByRole('button', {
      name: 'Easy Endurance Ride — Back to It',
    });
    fireEvent.click(eventButton);

    expect(await screen.findByText('Workout: Easy Endurance Ride — Back to It')).toBeInTheDocument();
    expect(screen.getByText('warmup: 10min Z1')).toBeInTheDocument();
    expect(screen.getByText('main: 40min Z2, steady rhythmic pedaling, 85-95rpm')).toBeInTheDocument();
  });

  it('fetches plans on initial load', async () => {
    render(<CalendarPage />);

    await screen.findByRole('button', { name: 'Easy Endurance Ride — Back to It' });

    expect(fetchAllPlansMock).toHaveBeenCalledTimes(1);
  });

  it('opens a week summary modal from the monday badge in month view without opening add event first', async () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 500;

    try {
      render(<CalendarPage />);

      const summaryButton = await screen.findByRole('button', {
        name: 'View summary for week of 2026-05-04',
      });
      fireEvent.click(summaryButton);

      expect(await screen.findByRole('dialog', { name: 'Week of 2026-05-04' })).toBeInTheDocument();
      expect(screen.queryByText('Add Event')).not.toBeInTheDocument();
      expect(
        screen.getAllByText('Smooth build week. Keep the volume steady and avoid turning Tuesday into a race.')
      ).not.toHaveLength(0);
    } finally {
      window.innerWidth = originalWidth;
    }
  });

  it('shows a weekly summary button in mobile day view', async () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 500;

    try {
      render(<CalendarPage />);

      fireEvent.click(await screen.findByRole('button', { name: 'Switch to day view' }));

      const weeklySummaryButton = await screen.findByRole('button', { name: 'Weekly Summary' });
      fireEvent.click(weeklySummaryButton);

      expect(await screen.findByRole('dialog', { name: 'Week of 2026-05-04' })).toBeInTheDocument();
      expect(screen.queryByText('Add Event')).not.toBeInTheDocument();
    } finally {
      window.innerWidth = originalWidth;
    }
  });
});
