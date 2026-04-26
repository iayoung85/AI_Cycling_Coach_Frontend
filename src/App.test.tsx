import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const apiMocks = vi.hoisted(() => ({
  getStoredAuthUser: vi.fn(),
  hasStoredAuthToken: vi.fn(),
  isLocalApiTarget: vi.fn(),
  loginWithPassword: vi.fn(),
  logoutSession: vi.fn(),
  restoreAuthSession: vi.fn(),
  setAuthFailureHandler: vi.fn(),
}));

vi.mock('./services/api', () => apiMocks);
vi.mock('./components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('./components/Calendar/CalendarPage', () => ({ default: () => <div>Calendar Page</div> }));
vi.mock('./components/ListView/ListViewPage', () => ({ default: () => <div>List Page</div> }));
vi.mock('./components/Recurring/RecurringPage', () => ({ default: () => <div>Recurring Page</div> }));

describe('App auth flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMocks.getStoredAuthUser.mockReturnValue(null);
    apiMocks.hasStoredAuthToken.mockReturnValue(false);
    apiMocks.restoreAuthSession.mockResolvedValue(null);
  });

  it('renders the app directly when the API target is localhost', async () => {
    apiMocks.isLocalApiTarget.mockReturnValue(true);

    render(<App />);

    expect(await screen.findByText('Calendar Page')).toBeInTheDocument();
  });

  it('shows the login screen for remote unauthenticated sessions', async () => {
    apiMocks.isLocalApiTarget.mockReturnValue(false);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Private training workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs in and shows the app after a successful remote login', async () => {
    apiMocks.isLocalApiTarget.mockReturnValue(false);
    apiMocks.loginWithPassword.mockImplementation(async () => {
      apiMocks.hasStoredAuthToken.mockReturnValue(true);
      apiMocks.getStoredAuthUser.mockReturnValue({ id: 1, name: 'Cyclist' });
      return {
        access_token: 'token-123',
        user: { id: 1, name: 'Cyclist' },
      };
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(apiMocks.loginWithPassword).toHaveBeenCalledWith('secret-pass');
    expect(await screen.findByText('Calendar Page')).toBeInTheDocument();
  });
});