import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { AuthUser } from '../../types';
import './AppLayout.css';

interface Props {
  children: ReactNode;
  user: AuthUser | null;
  isLocalMode: boolean;
  onLogout?: () => void;
}

export default function AppLayout({ children, user, isLocalMode, onLogout }: Props) {
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🚴</span>
          <h1>CycleCoach</h1>
        </div>
        <ul className="nav-links">
          <li>
            <NavLink to="/" end>
              📅 Calendar
            </NavLink>
          </li>
          <li>
            <NavLink to="/list">
              📋 List
            </NavLink>
          </li>
          <li>
            <NavLink to="/recurring">
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
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
