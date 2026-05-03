import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFavorite,
  deleteFavorite,
  fetchFavorites,
  scheduleFavorite,
  updateFavorite,
} from '../../services/api';
import FavoritesPage from './FavoritesPage';

vi.mock('../../services/api', () => ({
  createFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
  fetchFavorites: vi.fn(),
  scheduleFavorite: vi.fn(),
  updateFavorite: vi.fn(),
}));

const fetchFavoritesMock = vi.mocked(fetchFavorites);
const updateFavoriteMock = vi.mocked(updateFavorite);
const scheduleFavoriteMock = vi.mocked(scheduleFavorite);
const createFavoriteMock = vi.mocked(createFavorite);
const deleteFavoriteMock = vi.mocked(deleteFavorite);

const baseFavorite = {
  id: 'favorite-1',
  category: 'uncategorized' as const,
  title: 'Threshold Builder',
  notes: 'Repeatable FTP work.',
  workout_details: {
    type: 'ride',
    duration_minutes: 75,
    intensity: 'threshold',
    structure: ['15min warmup', '3 x 10min FTP'],
  },
  created_at: '2026-05-03T10:00:00',
  updated_at: '2026-05-03T10:00:00',
};

describe('FavoritesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchFavoritesMock.mockResolvedValue({
      favorites: [baseFavorite],
      categories: ['off-bike', 'FTP', 'endurance', 'HIIT', 'VO2-max', 'uncategorized', 'misc'],
    });
    createFavoriteMock.mockResolvedValue(baseFavorite);
    deleteFavoriteMock.mockResolvedValue(undefined);
  });

  it('recategorizes a favorite by dropping it into another folder', async () => {
    updateFavoriteMock.mockResolvedValue({ ...baseFavorite, category: 'FTP' });

    render(<FavoritesPage />);

    const card = (await screen.findByText('Threshold Builder')).closest('article');
    const ftpFolder = screen.getByText('FTP').closest('section');

    if (!card || !ftpFolder) {
      throw new Error('Expected draggable card and FTP folder');
    }

    fireEvent.dragStart(card);
    fireEvent.dragOver(ftpFolder);
    fireEvent.drop(ftpFolder);

    await waitFor(() => {
      expect(updateFavoriteMock).toHaveBeenCalledWith('favorite-1', { category: 'FTP' });
    });
  });

  it('schedules a favorite workout from the library', async () => {
    scheduleFavoriteMock.mockResolvedValue({
      event_id: 'event-1',
      time: '06:45',
      category: 'Workout',
      title: 'Threshold Builder',
      notes: 'Repeatable FTP work.',
      date: '2026-05-08',
      all_day: false,
      start_date: '2026-05-08',
      end_date: '2026-05-08',
      dates: ['2026-05-08'],
      workout_details: baseFavorite.workout_details,
    });

    render(<FavoritesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Schedule' }));
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-05-08' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '06:45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Workout' }));

    await waitFor(() => {
      expect(scheduleFavoriteMock).toHaveBeenCalledWith('favorite-1', {
        date: '2026-05-08',
        time: '06:45',
        all_day: false,
      });
    });

    expect(await screen.findByText('Scheduled for 2026-05-08 at 06:45.')).toBeInTheDocument();
  });
});