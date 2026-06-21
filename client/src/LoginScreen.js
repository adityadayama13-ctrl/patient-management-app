import { useState } from 'react';
import './LoginScreen.css';

function loadProfile() {
  try { return JSON.parse(localStorage.getItem('clinicProfile')) || {}; } catch { return {}; }
}

export default function LoginScreen({ onLogin }) {
  const profile = loadProfile();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed.'); return; }
      sessionStorage.setItem('clinicUser', JSON.stringify(data));
      onLogin(data);
    } catch {
      setError('Cannot connect to server. Make sure the app is running.');
    } finally { setLoading(false); }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-header">
          {profile.logo && profile.logoType === 'logo'
            ? <img src={profile.logo} alt="logo" className="login-logo" />
            : <div className="login-logo-placeholder">🏥</div>}
          <div className="login-clinic-name">{profile.name || 'Clinic'}</div>
          {profile.doctorName && <div className="login-clinic-sub">{profile.doctorName}</div>}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <h2 className="login-title">Sign in</h2>

          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label>Username</label>
            <input
              type="text" autoComplete="username" autoFocus
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username" required
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input
              type="password" autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password" required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-footer">
          Clinic Management System
        </div>
      </div>
    </div>
  );
}
