import { useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/Auth/LoginPage';
import AppLayout from './components/Layout/AppLayout';
import CalendarPage from './components/Calendar/CalendarPage';
import ListViewPage from './components/ListView/ListViewPage';
import RecurringPage from './components/Recurring/RecurringPage';
import type { AuthUser } from './types';
import {
  getStoredAuthUser,
  hasStoredAuthToken,
  isLocalApiTarget,
  loginWithPassword,
  logoutSession,
  restoreAuthSession,
  setAuthFailureHandler,
} from './services/api';

const LOCAL_USER: AuthUser = {
  id: 1,
  name: 'Cyclist',
};

function App() {
  const localMode = isLocalApiTarget();
  const Router = localMode ? BrowserRouter : HashRouter;
  const [user, setUser] = useState<AuthUser | null>(() => (localMode ? LOCAL_USER : getStoredAuthUser()));
  const [isBootstrapping, setIsBootstrapping] = useState(() => !localMode && !hasStoredAuthToken());
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      setAuthError('Your session expired. Sign in again.');
      setIsBootstrapping(false);
    });

    return () => setAuthFailureHandler(null);
  }, []);

  useEffect(() => {
    if (localMode) {
      setIsBootstrapping(false);
      return;
    }

    if (hasStoredAuthToken() && getStoredAuthUser()) {
      setUser(getStoredAuthUser());
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;

    async function bootstrapAuth() {
      const session = await restoreAuthSession();

      if (cancelled) {
        return;
      }

      setUser(session?.user ?? null);
      setIsBootstrapping(false);
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [localMode]);

  async function handleLogin(password: string) {
    setAuthError(null);

    try {
      const session = await loginWithPassword(password);
      setUser(session.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to sign in');
    }
  }

  async function handleLogout() {
    await logoutSession();
    setUser(null);
    setAuthError(null);
  }

  const isAuthenticated = localMode || Boolean(user && hasStoredAuthToken());

  if (isBootstrapping) {
    return <LoginPage isLoading />;
  }

  if (!isAuthenticated) {
    return <LoginPage error={authError} onLogin={handleLogin} />;
  }

  return (
    <Router>
      <AppLayout user={user} isLocalMode={localMode} onLogout={localMode ? undefined : handleLogout}>
        <Routes>
          <Route path="/" element={<CalendarPage />} />
          <Route path="/list" element={<ListViewPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
