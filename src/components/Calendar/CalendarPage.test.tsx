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
  slotMinTime?: string;
  slotMaxTime?: string;
  scrollTime?: string;
  eventDragMinDistance?: number;
  eventLongPressDelay?: number;
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
  default: ({
    initialView,
    events = [],
    slotMinTime,
    slotMaxTime,
    scrollTime,
    eventDragMinDistance,
    eventLongPressDelay,
    dateClick,
    datesSet,
    dayCellContent,
    eventClick,
  }: MockCalendarProps) => {
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
      <div
        data-testid="mock-calendar"
        data-slot-min-time={slotMinTime}
        data-slot-max-time={slotMaxTime}
        data-scroll-time={scrollTime}
        data-event-drag-min-distance={eventDragMinDistance}
        data-event-long-press-delay={eventLongPressDelay}
      >
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
  createFavorite: vi.fn(),
  fetchAllPlans: vi.fn(),
  submitAthleteNote: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  rescheduleCoachEntry: vi.fn(),
}));

const createFavoriteMock = vi.mocked(api.createFavorite);
const fetchAllPlansMock = vi.mocked(api.fetchAllPlans);
const submitAthleteNoteMock = vi.mocked(api.submitAthleteNote);

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

const overnightPlan = [
  '---',
  'week_start: 2026-05-18',
  'season: base',
  'training_block: "Base Phase 2"',
  'week_number: 1.5',
  '---',
  '',
  '# Week of 2026-05-18',
  '',
  '## 2026-05-18 (Monday)',
  '',
  '### 01:00 — Workout: Overnight Spin',
  '',
  'This should be visible in the weekly time grid.',
  '',
  '```yaml',
  'type: ride',
  'duration_minutes: 45',
  '```',
  '',
  '## 2026-05-24 (Sunday)',
  '',
  '### 22:00 — Workout: Night Shift Easy Spin',
  '',
  'Late placeholder for an overnight ride.',
  '',
  '```yaml',
  'type: ride',
  'duration_minutes: 45',
  '```',
].join('\n');

const checkinPlan = [
  '---',
  'week_start: 2026-05-11',
  'season: base',
  'training_block: "Base Phase 2"',
  'week_number: 1.4',
  '---',
  '',
  '# Week of 2026-05-11',
  '',
  '## 2026-05-17 (Sunday)',
  '',
  '### 14:00 — Checkin: Illness Recovery + Readiness for Next Week',
  '',
  'Recovery prompt.',
  '',
  '### All Day — Life: Graduation Party',
  '<!-- event_id: life-grad-party-2026-05-17 -->',
  '<!-- all_day: true -->',
  '',
  'Busy day.',
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

  it('adds a workout entry to favorites from the detail modal', async () => {
    createFavoriteMock.mockResolvedValue({
      id: 'ftp-builder',
      category: 'uncategorized',
      title: 'Easy Endurance Ride — Back to It',
      notes: 'First day of your free week.',
      workout_details: {
        type: 'ride',
        duration_minutes: 60,
        intensity: 'easy',
        tss_planned: 42,
        structure: [
          'warmup: 10min Z1',
          'main: 40min Z2, steady rhythmic pedaling, 85-95rpm',
          'cooldown: 10min Z1',
        ],
        notes: 'Outdoor preferred.',
      },
      created_at: '2026-05-03T10:00:00',
      updated_at: '2026-05-03T10:00:00',
    });

    render(<CalendarPage />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Easy Endurance Ride — Back to It',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    expect(await screen.findByText('Saved to favorites.')).toBeInTheDocument();
    expect(createFavoriteMock).toHaveBeenCalledWith({
      title: 'Easy Endurance Ride — Back to It',
      notes: 'First day of your free week.',
      workout_details: {
        type: 'ride',
        duration_minutes: 60,
        intensity: 'easy',
        tss_planned: 42,
        structure: [
          'warmup: 10min Z1',
          'main: 40min Z2, steady rhythmic pedaling, 85-95rpm',
          'cooldown: 10min Z1',
        ],
        notes: 'Outdoor preferred.',
      },
    });
  });

  it('fetches plans on initial load', async () => {
    render(<CalendarPage />);

    await screen.findByRole('button', { name: 'Easy Endurance Ride — Back to It' });

    expect(fetchAllPlansMock).toHaveBeenCalledTimes(1);
  });

  it('expands the weekly time grid for overnight and late planned rides', async () => {
    fetchAllPlansMock.mockResolvedValue({
      plans: [
        {
          filename: 'week-2026-05-18.md',
          content: overnightPlan,
        },
      ],
    });

    render(<CalendarPage />);

    const calendar = await screen.findByTestId('mock-calendar');
    expect(calendar).toHaveAttribute('data-slot-min-time', '00:00:00');
    expect(calendar).toHaveAttribute('data-slot-max-time', '24:00:00');
    expect(calendar).toHaveAttribute('data-scroll-time', '00:00:00');
    expect(screen.getByRole('button', { name: 'Overnight Spin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Night Shift Easy Spin' })).toBeInTheDocument();
  });

  it('submits athlete notes with the selected checkin entry identity', async () => {
    fetchAllPlansMock.mockResolvedValue({
      plans: [
        {
          filename: 'week-2026-05-11.md',
          content: checkinPlan,
        },
      ],
    });
    submitAthleteNoteMock.mockResolvedValue({
      success: true,
      message: 'Note submitted',
      note_content: 'Athlete note\nSymptoms improving.',
    });

    render(<CalendarPage />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Illness Recovery + Readiness for Next Week',
    }));
    fireEvent.change(screen.getByLabelText(/Your Notes/i), {
      target: { value: 'Symptoms improving.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Note submitted!')).toBeInTheDocument();
    expect(submitAthleteNoteMock).toHaveBeenCalledWith(
      '2026-05-17',
      'Symptoms improving.',
      undefined,
      expect.objectContaining({
        date: '2026-05-17',
        time: '14:00',
        category: 'Checkin',
        title: 'Illness Recovery + Readiness for Next Week',
      }),
    );
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

  it('enables immediate event dragging in mobile day view', async () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 500;

    try {
      render(<CalendarPage />);

      const calendar = await screen.findByTestId('mock-calendar');
      expect(calendar).not.toHaveAttribute('data-event-long-press-delay');
      expect(calendar).not.toHaveAttribute('data-event-drag-min-distance');

      fireEvent.click(screen.getByRole('button', { name: 'Switch to day view' }));

      expect(await screen.findByTestId('mock-calendar')).toHaveAttribute('data-event-long-press-delay', '0');
      expect(screen.getByTestId('mock-calendar')).toHaveAttribute('data-event-drag-min-distance', '3');
    } finally {
      window.innerWidth = originalWidth;
    }
  });
});
