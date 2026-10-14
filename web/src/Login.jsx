import React, { useState } from 'react';
import { api } from './api.js';
import { Gold, Eyebrow } from './ui.jsx';

/**
 * Sign-in for the admin console. Only the owner can sign in, with a password.
 * The password is set (or reset) with a 6-digit code that is always emailed to the owner.
 */
export default function Login({ onDone, notice = '', go }) {
  const [step, setStep] = useState('email'); // email | password | setup | blocked
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show, setShow] = useState(false);
  const [setupSent, setSetupSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const run = (fn) => async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await fn(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const reset = () => { setStep('email'); setCode(''); setPassword(''); setPassword2(''); setSetupSent(false); setNote(''); setError(''); };
  const devNote = (r) => (r.devCode ? ` Development code: ${r.devCode}` : '');

  const request = run(async () => {
    const r = await api('/api/auth/request', { body: { email } });
    if (r.step === 'password') { setStep(r.hasPassword ? 'password' : 'setup'); setNote(r.hasPassword ? '' : 'You have not set a password yet.'); }
    else { setNote(r.message); setStep('blocked'); }
  });
  const signIn = run(async () => { await api('/api/auth/password', { body: { email, password } }); await onDone(); });
  const sendSetupCode = run(async () => {
    const r = await api('/api/auth/setup/request', { body: { email } });
    setSetupSent(true);
    setNote(r.message + devNote(r));
  });
  const savePassword = run(async () => {
    if (password !== password2) throw new Error('The two passwords are not the same.');
    await api('/api/auth/setup/verify', { body: { email, code, password } });
    await onDone();
  });

  const pw = (id, value, set, label, auto) => (
    <label className="field">
      <span>{label}</span>
      <span className="pw-wrap">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={auto} required value={value} onChange={(e) => set(e.target.value)} />
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
      </span>
    </label>
  );

  let card;
  if (step === 'email') {
    card = (
      <form className="login-form" onSubmit={request}>
        {notice ? <p className="login-notice" role="status"><Gold name="clock" size="sm" />{notice}</p> : null}
        <Eyebrow icon="key">Admin sign-in</Eyebrow>
        <h2>Enter your email address</h2>
        <p className="muted">The admin console is only for the owner of this portfolio.</p>
        <label className="field">
          <span>Email address</span>
          <input id="login-email" type="email" inputMode="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="btn btn-solid btn-wide" type="submit" disabled={busy}>{busy ? 'Please wait' : 'Continue'}</button>
      </form>
    );
  } else if (step === 'blocked') {
    card = (
      <div className="login-form">
        <Eyebrow icon="lock">Owner only</Eyebrow>
        <h2>This sign-in is private</h2>
        <p className="login-notice" role="status"><Gold name="lock" size="sm" />{note}</p>
        <button className="btn btn-solid btn-wide" type="button" onClick={reset}>Try a different email address</button>
        <button className="link-btn" type="button" onClick={() => go('/')}>Back to the portfolio</button>
      </div>
    );
  } else if (step === 'password') {
    card = (
      <form className="login-form" onSubmit={signIn}>
        <Eyebrow icon="lock">Welcome back</Eyebrow>
        <h2>Enter your password</h2>
        <p className="muted">Signing in as <b>{email}</b>.</p>
        {pw('login-password', password, setPassword, 'Password', 'current-password')}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="btn btn-solid btn-wide" type="submit" disabled={busy || !password}>{busy ? 'Signing you in' : 'Sign in'}</button>
        <div className="login-links">
          <button className="link-btn" type="button" onClick={() => { setStep('setup'); setPassword(''); setError(''); setNote(''); }}>Forgot your password?</button>
          <button className="link-btn" type="button" onClick={reset}>Use a different email address</button>
        </div>
      </form>
    );
  } else {
    card = !setupSent ? (
      <form className="login-form" onSubmit={sendSetupCode}>
        <Eyebrow icon="lock">Set your password</Eyebrow>
        <h2>Set a new password</h2>
        {note ? <p className="muted">{note}</p> : null}
        <p className="muted">For safety, we will first email a 6-digit code to the owner's address.</p>
        <p className="muted">Signing in as <b>{email}</b>.</p>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="btn btn-solid btn-wide" type="submit" disabled={busy}>{busy ? 'Sending the code' : 'Email me a code'}</button>
        <button className="link-btn" type="button" onClick={reset}>Use a different email address</button>
      </form>
    ) : (
      <form className="login-form" onSubmit={savePassword}>
        <Eyebrow icon="lock">Set your password</Eyebrow>
        <h2>Choose your password</h2>
        <p className="muted">{note}</p>
        <label className="field">
          <span>6-digit code from the email</span>
          <input id="login-code" className={`code-input${code ? ' has-value' : ''}`} type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus required
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Paste the code here" />
          <small className="field-help">If you cannot find the email, look in your Spam folder.</small>
        </label>
        {pw('new-password', password, setPassword, 'New password (at least 10 characters)', 'new-password')}
        {pw('new-password2', password2, setPassword2, 'Type the new password again', 'new-password')}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="btn btn-solid btn-wide" type="submit" disabled={busy || code.length !== 6 || !password || !password2}>{busy ? 'Saving' : 'Save password and sign in'}</button>
        <button className="link-btn" type="button" onClick={reset}>Use a different email address</button>
      </form>
    );
  }

  return (
    <main className="login">
      <section className="login-side">
        <a className="brand brand-light" href="/" onClick={(e) => { e.preventDefault(); go('/'); }}>Moinak <i>Ghosh</i></a>
        <div>
          <p className="eyebrow eyebrow-light">Portfolio · Admin console</p>
          <h1 className="login-title"><span className="word" style={{ '--i': 0 }}>Keep&nbsp;</span><span className="word" style={{ '--i': 1 }}>the&nbsp;</span><span className="word" style={{ '--i': 2 }}>story&nbsp;</span><span className="word accent" style={{ '--i': 3 }}>current.</span></h1>
          <p className="login-lead">Update your profile, agent work, experience, skills, certifications and recommendations. Every change appears on the portfolio straight away.</p>
        </div>
        <p className="login-foot"><Gold name="lock" size="sm" /> Only the owner can sign in.</p>
      </section>
      <section className="login-main">
        <div className="login-card">{card}</div>
      </section>
    </main>
  );
}
