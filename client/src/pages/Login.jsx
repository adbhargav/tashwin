import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { useSeo } from '../lib/seo';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.500-4.800 7.200l7.600 5.900c4.400-4.100 7-10.100 7-17.600z" />
    <path fill="#FBBC05" d="M10.500 28.600A14.500 14.500 0 0 1 9.500 24c0-1.600.300-3.200.800-4.600l-7.900-6.200A24 24 0 0 0 0 24c0 3.900.900 7.500 2.600 10.800l7.900-6.200z" />
    <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.200-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z" />
  </svg>
);

export default function Login() {
  useSeo({ title: 'Sign In', noindex: true });
  const auth = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (auth.user) return <Navigate to={location.state?.from || '/account'} replace />;

  const run = async (fn) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (!auth.firebaseEnabled) return auth.devLogin(form.email, form.name);
      if (mode === 'signin') return auth.login(form.email, form.password);
      if (mode === 'signup') return auth.signup(form.name, form.email, form.password);
      await auth.resetPassword(form.email);
      setNotice('Password reset link sent — please check your email.');
    });
  };
  const input = (key, label, type = 'text', extra = {}) => (
    <label className="block mb-4">
      <span className="label">{label}</span>
      <input className="field" type={type} required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} />
    </label>
  );
  const title = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password' }[mode];

  return (
    <div className="min-h-[calc(100vh-60px)] lg:min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12 bg-soft">
      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-8">
        <img src="/logo.png" alt="Tashwin Furniture" className="h-14 mx-auto mb-5" />
        <h1 className="text-2xl text-ink text-center mb-6">{title}</h1>

        {!auth.firebaseEnabled && (
          <p className="bg-[#fbf5d6] text-[#111] rounded-md px-3 py-2 mb-4 text-[13px]">
            Local dev login — Firebase keys are not configured yet, so any email signs in without a password.
          </p>
        )}
        <form onSubmit={submit}>
          {(mode === 'signup' || !auth.firebaseEnabled) && input('name', 'Full name', 'text', { autoComplete: 'name', required: auth.firebaseEnabled })}
          {input('email', 'Email', 'email', { autoComplete: 'email' })}
          {auth.firebaseEnabled && mode !== 'forgot' && input('password', 'Password', 'password', { minLength: 6, autoComplete: mode === 'signup' ? 'new-password' : 'current-password' })}
          {auth.firebaseEnabled && mode === 'signin' && (
            <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="block ml-auto -mt-2 mb-4 text-brand hover:underline">Forgot password?</button>
          )}
          {error && <p role="alert" className="text-red-600 mb-3">{error}</p>}
          {notice && <p role="status" className="text-green-700 mb-3">{notice}</p>}
          <button disabled={busy} className="btn btn-primary w-full">
            {busy ? 'Please wait…' : { signin: 'Sign In', signup: 'Create Account', forgot: 'Send Reset Link' }[mode]}
          </button>
        </form>

        {auth.firebaseEnabled && (
          <>
            {mode !== 'forgot' && (
              <>
                <div className="flex items-center gap-3 my-5"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
                <button onClick={() => run(auth.google)} disabled={busy} className="btn btn-outline w-full"><GoogleIcon />Continue with Google</button>
              </>
            )}
            <p className="text-center mt-6">
              {mode === 'signin' ? 'New to Tashwin? ' : mode === 'signup' ? 'Already have an account? ' : 'Remembered it? '}
              <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }} className="text-brand font-medium hover:underline">
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
