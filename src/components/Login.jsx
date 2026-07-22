import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { DARK } from '../tokens';
import { USI_LOGO_B64 } from '../logoData';
import { useTheme } from '../App';

export default function Login({ T: TProp }) {
  // Prefer the live theme context; fall back to the prop, then DARK.
  const ctx = useTheme();
  const T = ctx?.T || TProp || DARK;
  const toggle = ctx?.toggle;
  const isDark = ctx?.isDark ?? true;

  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch {
      setErr('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: '100%',
    background: T.inputBg,
    border: `1px solid ${T.border}`,
    borderRadius: 4,
    color: T.text,
    fontFamily: T.font,
    fontSize: 12,
    padding: '10px 12px',
    marginBottom: 16,
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: T.bg, fontFamily: T.font, padding: 16,
      position: 'relative', transition: 'background 0.2s' }}>

      {toggle && (
        <button onClick={toggle}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{ position: 'absolute', top: 20, right: 20,
            background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
            color: T.textDim, cursor: 'pointer', fontSize: 15, padding: '6px 10px' }}>
          {isDark ? '☀' : '☾'}
        </button>
      )}

      <div style={{ width: '100%', maxWidth: 360, padding: '36px 32px',
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.10)',
        transition: 'background 0.2s' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={USI_LOGO_B64} alt='USI'
            style={{ width: 80, height: 62, objectFit: 'contain', marginBottom: 12 }} />
          <div style={{ fontSize: 16, color: T.amber, fontWeight: 700,
            letterSpacing: 3, fontFamily: T.font }}>FREIGHT OPS</div>
          <div style={{ fontSize: 9, color: T.textDim, marginTop: 4,
            letterSpacing: 2, fontFamily: T.font }}>
            PT USI PETROTRANS — OPERATIONAL SYSTEM
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <label style={{ display: 'block', fontSize: 9, color: T.textDim,
            letterSpacing: 1.5, marginBottom: 6, fontFamily: T.font }}>EMAIL</label>
          <input type='email' value={email} onChange={e => setEmail(e.target.value)}
            autoComplete='email' style={inp} />

          <label style={{ display: 'block', fontSize: 9, color: T.textDim,
            letterSpacing: 1.5, marginBottom: 6, fontFamily: T.font }}>PASSWORD</label>
          <input type='password' value={pass} onChange={e => setPass(e.target.value)}
            autoComplete='current-password' style={{ ...inp, marginBottom: 24 }} />

          {err && (
            <div style={{ color: T.red, fontSize: 11, marginBottom: 16,
              background: T.redGlow, border: `1px solid ${T.red}44`,
              borderRadius: 4, padding: '8px 12px' }}>
              {err}
            </div>
          )}

          <button type='submit' disabled={loading}
            style={{ width: '100%', background: T.amber, border: 'none',
              borderRadius: 4, color: T.btnText,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: T.font, fontSize: 11, fontWeight: 700,
              letterSpacing: 2, padding: '12px 0', opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s' }}>
            {loading ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
}
