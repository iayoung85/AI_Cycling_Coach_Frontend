import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    fetchAllPlansMock.mockResolvedValue([
      {
        filename: 'week-2026-05-04.md',
        content: workoutPlan,
      },
    ]);
  });

  it('force refreshes plans from GitHub when requested', async () => {
    render(<ListViewPage />);

    await screen.findByText('Easy Endurance Ride');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh from GitHub' }));

    await waitFor(() => {
      expect(fetchAllPlansMock).toHaveBeenNthCalledWith(1, { forceRefresh: undefined });
      expect(fetchAllPlansMock).toHaveBeenNthCalledWith(2, { forceRefresh: true });
    });
  });
});