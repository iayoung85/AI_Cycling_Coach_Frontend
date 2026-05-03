import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFavorite, fetchFavorites } from '../../services/api';
import EventModal from './EventModal';

vi.mock('../../services/api', () => ({
  createFavorite: vi.fn(),
  fetchFavorites: vi.fn(),
}));

const createFavoriteMock = vi.mocked(createFavorite);
const fetchFavoritesMock = vi.mocked(fetchFavorites);

describe('EventModal favorites', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchFavoritesMock.mockResolvedValue({
      favorites: [
        {
          id: 'ftp-builder',
          category: 'FTP',
          title: 'FTP Builder',
          notes: 'Steady effort block.',
          workout_details: {
            type: 'ride',
            duration_minutes: 75,
            intensity: 'threshold',
            tss_planned: 82,
            structure: ['15min warmup', '3 x 10min FTP', '10min cooldown'],
            notes: 'Fuel early.',
          },
          created_at: '2026-05-03T10:00:00',
          updated_at: '2026-05-03T10:00:00',
        },
      ],
      categories: ['FTP', 'uncategorized'],
    });
    createFavoriteMock.mockResolvedValue({
      id: 'saved-favorite',
      category: 'uncategorized',
      title: 'Saved Favorite',
      notes: 'Stored from edit modal.',
      workout_details: {
        type: 'ride',
        duration_minutes: 75,
        intensity: 'threshold',
      },
      created_at: '2026-05-03T10:00:00',
      updated_at: '2026-05-03T10:00:00',
    });
  });

  it('preloads workout fields from a selected favorite and preserves structure on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EventModal
        mode="create"
        date="2026-05-04"
        initialTime="07:00"
        initialData={{
          category: 'Workout',
          time: '07:00',
          title: '',
          notes: '',
          allDay: false,
          startDate: '2026-05-04',
          endDate: '2026-05-04',
        }}
        onSave={onSave}
        onClose={() => {}}
      />
    );

    fireEvent.change(await screen.findByLabelText('Start From Favorite'), {
      target: { value: 'ftp-builder' },
    });

    expect(screen.getByLabelText('Title')).toHaveValue('FTP Builder');
    expect(screen.getByLabelText('Notes')).toHaveValue('Steady effort block.');
    expect(screen.getByLabelText('Structure')).toHaveValue('15min warmup\n3 x 10min FTP\n10min cooldown');

    fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        category: 'Workout',
        title: 'FTP Builder',
        notes: 'Steady effort block.',
        all_day: false,
        start_date: '2026-05-04',
        end_date: '2026-05-04',
        time: '07:00',
        workout_details: {
          type: 'ride',
          duration_minutes: 75,
          intensity: 'threshold',
          tss_planned: 82,
          structure: ['15min warmup', '3 x 10min FTP', '10min cooldown'],
          notes: 'Fuel early.',
        },
      });
    });
  });

  it('adds an edited user-created workout to favorites from edit mode', async () => {
    render(
      <EventModal
        mode="edit"
        date="2026-05-02"
        initialTime="09:30"
        initialData={{
          category: 'Workout',
          time: '09:30',
          title: 'Mobility and light calesthenics',
          notes: 'weekend days are often pretty quiet in the spring and fall.',
          allDay: false,
          startDate: '2026-05-02',
          endDate: '2026-05-02',
          workoutDetails: {
            type: 'Strength and Mobility',
            duration_minutes: 40,
            intensity: 'moderate',
            tss_planned: 50,
            structure: ['Warmup', 'Main set'],
          },
        }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    await waitFor(() => {
      expect(createFavoriteMock).toHaveBeenCalledWith({
        title: 'Mobility and light calesthenics',
        notes: 'weekend days are often pretty quiet in the spring and fall.',
        workout_details: {
          type: 'Strength and Mobility',
          duration_minutes: 40,
          intensity: 'moderate',
          tss_planned: 50,
          structure: ['Warmup', 'Main set'],
          notes: undefined,
        },
      });
    });

    expect(await screen.findByText('Saved to favorites.')).toBeInTheDocument();
  });
});