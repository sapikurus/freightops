import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { T } from '../tokens';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [err,   setErr]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      setErr('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: T.bg, fontFamily: T.font }}>
      <div style={{ width: 340, padding: 40, background: '#111820',
        border: `1px solid #1e2a38`, borderRadius: 8 }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, color: T.amber, fontWeight: 700, letterSpacing: 3 }}>⚓ FREIGHT OPS</div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 6, letterSpacing: 2 }}>
            PT USI PETROTRANS — OPERATIONAL SYSTEM
          </div>
        </div>
        <form onSubmit={handleLogin}>
          <label style={{ display: 'block', fontSize: 9, color: T.textDim,
            letterSpacing: 1.5, marginBottom: 6 }}>EMAIL</label>
          <input type='email' value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', background: '#0d141c', border: '1px solid #1e2a38',
              borderRadius: 4, color: '#e2e8f0', fontFamily: T.font, fontSize: 12,
              padding: '10px 12px', marginBottom: 16, boxSizing: 'border-box', outline: 'none' }} />
          <label style={{ display: 'block', fontSize: 9, color: T.textDim,
            letterSpacing: 1.5, marginBottom: 6 }}>PASSWORD</label>
          <input type='password' value={pass} onChange={e => setPass(e.target.value)}
            style={{ width: '100%', background: '#0d141c', border: '1px solid #1e2a38',
              borderRadius: 4, color: '#e2e8f0', fontFamily: T.font, fontSize: 12,
              padding: '10px 12px', marginBottom: 24, boxSizing: 'border-box', outline: 'none' }} />
          {err && <div style={{ color: '#f87171', fontSize: 11, marginBottom: 16 }}>{err}</div>}
          <button type='submit' disabled={loading}
            style={{ width: '100%', background: T.amber, border: 'none', borderRadius: 4,
              color: '#000', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: T.font,
              fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: '12px 0',
              opacity: loading ? 0.6 : 1 }}>
            {loading ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
}
