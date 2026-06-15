import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import styles from './LoginScreen.module.css';

export function LoginScreen() {
  const login = useAuthStore(s => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result === 'invalid') setError('Invalid username or password.');
  }

  return (
    <div className={styles.page}>
      {/* Texture overlay */}
      <div className={styles.texture} />

      {/* Gradient orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoText}>
            course<span className={styles.logoAccent}>neo</span>
          </div>
        </div>

        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.subheading}>Sign in to continue learning</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="login-username" className={styles.label}>Username</label>
            <input
              id="login-username"
              type="text"
              className={styles.input}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              placeholder="Enter your username"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="login-password" className={styles.label}>Password</label>
            <input
              id="login-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 4.5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || !username.trim() || !password}
          >
            {loading ? (
              <><span className={styles.spinner} />Signing in…</>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className={styles.hint}>
          Default: <code>admin</code> / <code>admin</code>
        </p>
      </div>
    </div>
  );
}
