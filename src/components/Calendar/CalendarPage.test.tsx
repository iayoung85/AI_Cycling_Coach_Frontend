import { fireEvent, render, screen } from '@testing-library/react';
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
  events?: MockCalendarEvent[];
  eventClick?: (arg: {
    event: {
      extendedProps: MockCalendarEvent['extendedProps'];
      allDay: boolean;
      start: Date | null;
    };
  }) => void;
};

vi.mock('@fullcalendar/react', () => ({
  default: ({ events = [], eventClick }: MockCalendarProps) => (
    <div data-testid="mock-calendar">
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
  ),
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
    fetchAllPlansMock.mockResolvedValue([
      {
        filename: 'week-2026-05-04.md',
        content: workoutPlan,
      },
    ]);
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
});
