import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import './AppLayout.css';

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
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
