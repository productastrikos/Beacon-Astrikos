import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Loader2, KeyRound, ChevronDown, ChevronUp } from 'lucide-react';
import { authenticate } from '../../services/authService';
import { DEMO_USERS } from '../../data/demo/people';
import { startSession, useSession } from '../../state/session';
import { setScope } from '../../state/uiStore';
import { ROLES } from '../../types';
import { Banner } from '../../components/ui/Layout';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  if (session) return <Navigate to={location.state?.from || '/command-centre'} replace />;

  const validate = () => {
    const e = {};
    if (!identifier.trim()) e.identifier = 'Enter your username or email.';
    if (!password) e.password = 'Enter your password.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await authenticate(identifier, password);
      if (!res.ok) { setFormError(res.error); return; }
      startSession(res.user, remember);
      setScope(res.user.homeScope);
      navigate(location.state?.from || '/command-centre', { replace: true });
    } catch {
      setFormError('Sign-in is unavailable. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const fill = (u) => {
    setIdentifier(u.username);
    setPassword(u.password);
    setErrors({});
    setFormError('');
  };

  return (
    <div className="bx-login">
      <div className="bx-login-bg" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/beacon-login-india.svg)` }} />
      <section className="bx-login-left" aria-label="About Astrikos Beacon">
        <div className="bx-login-brand">
          <img src={`${process.env.PUBLIC_URL}/astrikos-logo.png`} alt="Astrikos" className="bx-login-logo" />
          <div>
            <div className="bx-brand-title" style={{ fontSize: 15 }}>ASTRIKOS BEACON</div>
            <div className="bx-brand-sub">INTERNAL OPERATIONS</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--app-accent)', fontWeight: 700, marginBottom: 10 }}>EARLY WARNING &amp; DISASTER RESPONSE</div>
          <h1 style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.2, marginBottom: 12 }}>Internal Command Centre</h1>
          <p style={{ maxWidth: 520, color: 'var(--app-text-muted)', fontSize: 14, lineHeight: 1.6 }}>
            Centralizes multi-hazard intelligence, alert monitoring, incident coordination and response workflows
            for control-room operators, administrators and analysts across Arunachal Pradesh and PAN India.
          </p>
          
        </div>
        <div style={{ fontSize: 11, color: 'var(--app-text-faint)' }}>
          Authorized personnel only
        </div>
      </section>

      <section className="bx-login-right" aria-label="Sign in">
        <div className="bx-login-card">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700 }}>ASTRIKOS BEACON</div>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Sign in</h2>
            <p className="bx-muted" style={{ fontSize: 12 }}>Internal Early Warning &amp; Disaster Response Command Centre</p>
          </div>

          <form onSubmit={submit} noValidate className="bx-stack" style={{ gap: 10 }}>
            {formError && <Banner kind="danger">{formError}</Banner>}
            <div className="bx-field">
              <label className="bx-label" htmlFor="login-id">Username or email</label>
              <input id="login-id" className={`bx-input ${errors.identifier ? 'is-invalid' : ''}`} autoComplete="username" autoFocus
                value={identifier} onChange={(e) => setIdentifier(e.target.value)} aria-invalid={!!errors.identifier} aria-describedby={errors.identifier ? 'login-id-err' : undefined} />
              {errors.identifier && <span id="login-id-err" className="bx-error" role="alert">{errors.identifier}</span>}
            </div>
            <div className="bx-field">
              <label className="bx-label" htmlFor="login-pw">Password</label>
              <div style={{ position: 'relative' }}>
                <input id="login-pw" className={`bx-input ${errors.password ? 'is-invalid' : ''}`} type={show ? 'text' : 'password'} autoComplete="current-password"
                  style={{ paddingRight: 34 }} value={password} onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password} aria-describedby={errors.password ? 'login-pw-err' : undefined} />
                <button type="button" className="bx-icon-btn" style={{ position: 'absolute', right: 1, top: 1, width: 28, height: 28 }}
                  onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <span id="login-pw-err" className="bx-error" role="alert">{errors.password}</span>}
            </div>
            <label className="bx-row" style={{ gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me on this device
            </label>
            <button type="submit" className="bx-btn bx-btn-primary" disabled={busy} style={{ padding: '8px 12px' }}>
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <LogIn size={15} aria-hidden="true" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: 14, borderTop: '1px solid var(--app-border-soft)', paddingTop: 10 }}>
            <button type="button" className="bx-link-btn bx-row" onClick={() => setShowDemo((s) => !s)} aria-expanded={showDemo}>
              <KeyRound size={13} aria-hidden="true" /> Select your role
              {showDemo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showDemo && (
              <div style={{ marginTop: 8 }}>
                <table className="bx-table" style={{ marginTop: 8, fontSize: 11.5 }}>
                  <thead><tr><th>Role</th><th /></tr></thead>
                  <tbody>
                    {DEMO_USERS.map((u) => (
                      <tr key={u.id}>
                        <td>{ROLES[u.role]}</td>
                        <td><button type="button" className="bx-btn bx-btn-sm" onClick={() => fill(u)}>Use</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
