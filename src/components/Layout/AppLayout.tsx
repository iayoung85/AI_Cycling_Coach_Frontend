import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { AuthUser } from '../../types';
import './AppLayout.css';

interface Props {
  children: ReactNode;
  user: AuthUser | null;
  isLocalMode: boolean;
  onLogout?: () => void;
}

export default function AppLayout({ children, user, isLocalMode, onLogout }: Props) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`app-layout${isSidebarOpen ? ' sidebar-open' : ''}`}>
      <nav className="sidebar" id="primary-sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand">
          <span className="brand-icon">🚴</span>
          <h1>CycleCoach</h1>
        </div>
        <ul className="nav-links">
          <li>
            <NavLink to="/" end onClick={() => setIsSidebarOpen(false)}>
              📅 Calendar
            </NavLink>
          </li>
          <li>
            <NavLink to="/list" onClick={() => setIsSidebarOpen(false)}>
              📋 List
            </NavLink>
          </li>
          <li>
            <NavLink to="/recurring" onClick={() => setIsSidebarOpen(false)}>
              🔁 Recurring
            </NavLink>
          </li>
        </ul>
        <div className="sidebar-session">
          <p className="sidebar-user">{user?.name ?? 'Cyclist'}</p>
          <p className="sidebar-mode">{isLocalMode ? 'Direct localhost mode' : 'Authenticated remote mode'}</p>
          {onLogout ? (
            <button type="button" className="btn-ghost sidebar-logout" onClick={onLogout}>
              Log out
            </button>
          ) : null}
        </div>
        <div className="sidebar-footer">
          <p>AI Cycling Coach</p>
          <p className="version">v2.0.0</p>
        </div>
      </nav>

      {isSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="app-shell">
        <header className="mobile-header">
          <button
            type="button"
            className="btn-ghost sidebar-toggle"
            aria-controls="primary-sidebar"
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen(open => !open)}
          >
            <span className="sidebar-toggle-icon" aria-hidden="true">=</span>
            <span>Menu</span>
          </button>

          <div className="mobile-header-brand">
            <span className="brand-icon">🚴</span>
            <span>CycleCoach</span>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
