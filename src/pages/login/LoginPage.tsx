import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';

export function LoginPage() {
  const { login, token } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true });
  }, [navigate, token]);

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: '72px auto' }}>
        <div className="cardHeader">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Buddy Admin</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Sign in to continue
            </div>
          </div>
        </div>
        <div className="cardBody">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setIsSubmitting(true);
              try {
                await login(username.trim(), password);
                navigate('/dashboard', { replace: true });
              } catch (err) {
                const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message?: unknown }).message) : 'Login failed';
                setError(msg);
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  Username
                </div>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  Password
                </div>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error ? <div className="error">{error}</div> : null}
              <button className="button buttonPrimary" type="submit" disabled={isSubmitting || !username.trim() || !password}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
              {/* <div className="muted" style={{ fontSize: 12 }}>
                Uses the existing admin user seeded by the backend.
              </div> */}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
