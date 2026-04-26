import { useState } from 'react';
import type { FormEvent } from 'react';
import './LoginPage.css';

interface Props {
  error?: string | null;
  isLoading?: boolean;
  onLogin?: (password: string) => Promise<void>;
}

export default function LoginPage({ error, isLoading = false, onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onLogin || !password.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onLogin(password);
    } finally {
      setIsSubmitting(false);
    }
  }

  const disabled = isLoading || isSubmitting;

  return (
    <div className="login-page">
      <section className="login-panel">
        <p className="login-kicker">Cycling API</p>
        <h1>Private training workspace</h1>
        <p className="login-copy">
          Remote access now requires a signed session. Localhost still works directly for the offline-first setup.
        </p>

        <div className="login-notes">
          <div>
            <span>Access</span>
            <strong>Short-lived bearer token</strong>
          </div>
          <div>
            <span>Refresh</span>
            <strong>httpOnly cookie</strong>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            disabled={disabled}
            placeholder="Enter your server password"
          />

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" className="btn-primary" disabled={disabled || !password.trim()}>
            {isLoading ? 'Checking session...' : isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}