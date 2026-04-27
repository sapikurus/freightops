import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db as firestore } from './firebase';
import { T } from './tokens';
import { INIT_DB } from './utils';
import Login from './components/Login';
import Vessels from './modules/Vessels';
import Trucks from './modules/Trucks';
import Routes from './modules/Routes';
import Calculator from './modules/Calculator';

const DATA_DOC = doc(firestore, 'app', 'data');

function mergeDefaults(existing, defaults) {
  const result = { ...defaults };
  for (const key of Object.keys(existing)) {
    if (existing[key] !== null && typeof existing[key] === 'object' && !Array.isArray(existing[key]) &&
        defaults[key] !== null && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      result[key] = mergeDefaults(existing[key], defaults[key]);
    } else {
      result[key] = existing[key];
    }
  }
  return result;
}

function isMobile() { return typeof window !== 'undefined' && window.innerWidth < 768; }

export default function App() {
  const [user,        setUser]        = useState(undefined);
  const [db,          setDB]          = useState(null);
  const [tab,         setTab]         = useState('vessels');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());

  useEffect(() => {
    const onResize = () => { if (window.innerWidth < 768) setSidebarOpen(false); else setSidebarOpen(true); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsub = null;

    getDoc(DATA_DOC).then(snap => {
      if (!snap.exists()) {
        // Brand new account — seed and set immediately
        setDoc(DATA_DOC, INIT_DB, { merge: true });
        setDB(INIT_DB);
      } else {
        // Existing data — set DB immediately from getDoc result
        setDB(mergeDefaults(snap.data(), INIT_DB));
      }

      // Attach live listener for real-time updates — never writes
      unsub = onSnapshot(DATA_DOC, s => {
        if (s.exists()) setDB(mergeDefaults(s.data(), INIT_DB));
      }, err => {
        console.error('Firestore snapshot error:', err);
      });
    }).catch(err => {
      console.error('Firestore getDoc error:', err);
      // Fallback — set empty DB so app renders instead of hanging
      setDB(INIT_DB);
    });

    return () => { if (unsub) unsub(); };
  }, [user]);

  const updateDB = useCallback(async (updater) => {
    setDB(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setDoc(DATA_DOC, next, { merge: true });
      return next;
    });
  }, []);

  const navigateTo = (k) => {
    setTab(k);
    if (isMobile()) setSidebarOpen(false);
  };

  if (user === undefined) return <Splash label='AUTHENTICATING' />;
  if (!user)              return <Login />;
  if (!db)                return <Splash label='LOADING DATA' />;

  const tabs = [
    { k: 'vessels',    icon: '⛴', label: 'VESSELS' },
    { k: 'trucks',     icon: '🚛', label: 'TRUCKS' },
    { k: 'routes',     icon: '📍', label: 'ROUTES' },
    { k: 'calculator', icon: '∑',  label: 'CALCULATOR' },
  ];

  const mobile = isMobile();

  return (
    <div style={{ display: 'flex', height: '100vh', background: T.bg,
      color: T.text, fontFamily: T.font, overflow: 'hidden', position: 'relative' }}>

      {/* Mobile overlay */}
      {mobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <nav style={{
        width: sidebarOpen ? 200 : (mobile ? 0 : 52),
        borderRight: `1px solid ${T.border}`,
        padding: sidebarOpen ? '20px 0' : '20px 0',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        background: '#0d131a',
        ...(mobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease', width: 200,
          boxShadow: sidebarOpen ? '4px 0 20px rgba(0,0,0,0.5)' : 'none',
        } : {
          transition: 'width 0.2s ease', overflow: 'hidden',
        }),
      }}>
        {/* Logo */}
        <div style={{ padding: '0 14px 20px', display: 'flex', alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center', gap: 8 }}>
          {sidebarOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, background: T.amber, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#000', fontWeight: 700 }}>⚓</div>
              <div>
                <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, letterSpacing: 1.5 }}>FREIGHT OPS</div>
                <div style={{ fontSize: 8, color: T.textDim, letterSpacing: 1 }}>USI PETROTRANS</div>
              </div>
            </div>
          )}
          {!sidebarOpen && !mobile && (
            <div style={{ width: 30, height: 30, background: T.amber, borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#000', fontWeight: 700 }}>⚓</div>
          )}
          {!mobile && (
            <button onClick={() => setSidebarOpen(v => !v)}
              style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 14, padding: 4, flexShrink: 0 }}>
              {sidebarOpen ? '◂' : '▸'}
            </button>
          )}
        </div>

        {/* Nav items */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, flex: 1 }}>
          {tabs.map(({ k, icon, label }) => (
            <button key={k} onClick={() => navigateTo(k)}
              title={!sidebarOpen ? label : undefined}
              style={{
                width: '100%', background: tab === k ? T.amberGlow : 'transparent',
                border: 'none', borderLeft: tab === k ? `2px solid ${T.amber}` : '2px solid transparent',
                color: tab === k ? T.amber : T.textDim,
                padding: sidebarOpen ? '10px 20px' : '12px 0',
                textAlign: sidebarOpen ? 'left' : 'center',
                cursor: 'pointer', fontFamily: T.font, fontSize: 10, letterSpacing: 1.5,
                display: 'flex', alignItems: 'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center', gap: 8,
              }}>
              <span style={{ fontSize: sidebarOpen ? 12 : 16 }}>{icon}</span>
              {sidebarOpen && label}
            </button>
          ))}
        </div>

        {/* User */}
        {sidebarOpen ? (
          <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 8, letterSpacing: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
            <button onClick={() => signOut(auth)}
              style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                color: T.textDim, cursor: 'pointer', fontFamily: T.font, fontSize: 9,
                letterSpacing: 1, padding: '4px 10px', width: '100%' }}>
              Sign Out
            </button>
          </div>
        ) : !mobile ? (
          <div style={{ padding: '16px 0', borderTop: `1px solid ${T.border}`, textAlign: 'center' }}>
            <button onClick={() => signOut(auth)} title='Sign Out'
              style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 14 }}>⏻</button>
          </div>
        ) : null}
      </nav>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', padding: mobile ? '16px' : '32px', display: 'flex', flexDirection: 'column' }}>
        {mobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                color: T.amber, cursor: 'pointer', padding: '6px 10px', fontSize: 16, lineHeight: 1 }}>☰</button>
            <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, letterSpacing: 1.5 }}>
              {tabs.find(t => t.k === tab)?.label}
            </div>
          </div>
        )}
        <div style={{ flex: 1 }}>
          {tab === 'vessels'    && <Vessels    db={db} updateDB={updateDB} />}
          {tab === 'trucks'     && <Trucks     db={db} updateDB={updateDB} />}
          {tab === 'routes'     && <Routes     db={db} updateDB={updateDB} />}
          {tab === 'calculator' && <Calculator db={db} updateDB={updateDB} />}
        </div>
      </main>
    </div>
  );
}

function Splash({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: T.bg, color: T.amber,
      fontFamily: T.font, fontSize: 11, letterSpacing: 3 }}>
      {label}…
    </div>
  );
}
