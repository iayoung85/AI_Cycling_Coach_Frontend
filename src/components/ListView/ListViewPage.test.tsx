import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../../services/api';
import ListViewPage from './ListViewPage';

vi.mock('../../services/api', () => ({
  fetchAllPlans: vi.fn(),
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
  '### 09:00 — Workout: Easy Endurance Ride',
  '',
  'Steady aerobic ride.',
].join('\n');

describe('ListViewPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchAllPlansMock.mockResolvedValue({
      plans: [
        {
          filename: 'week-2026-05-04.md',
          content: workoutPlan,
        },
      ],
    });
  });

  it('fetches plans on initial load', async () => {
    render(<ListViewPage />);

    await screen.findByText('Easy Endurance Ride');

    expect(fetchAllPlansMock).toHaveBeenCalledTimes(1);
  });

  it('opens the shared entry detail modal from the list view', async () => {
    render(<ListViewPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Easy Endurance Ride/i }));

    expect(await screen.findByText('Workout: Easy Endurance Ride')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});