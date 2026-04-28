import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db as firestore } from './firebase';
import { DARK, LIGHT, makeStyles } from './tokens';
import { INIT_DB } from './utils';
import { USI_LOGO_B64 } from './logoData';
import Login from './components/Login';
import Vessels from './modules/Vessels';
import Trucks from './modules/Trucks';
import Routes from './modules/Routes';
import Calculator from './modules/Calculator';
import MasterDataModule from './modules/MasterDataModule';

// ── Theme context ─────────────────────────────────────────────
export const ThemeCtx = createContext({ T: DARK, s: makeStyles(DARK), isDark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

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
  const [isDark,      setIsDark]      = useState(true);

  const T = isDark ? DARK : LIGHT;
  const s = makeStyles(T);

  // Persist theme preference
  useEffect(() => {
    const saved = localStorage.getItem('freightops_theme');
    if (saved === 'light') setIsDark(false);
  }, []);
  const toggleTheme = () => {
    setIsDark(v => {
      localStorage.setItem('freightops_theme', !v ? 'dark' : 'light');
      return !v;
    });
  };

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
        setDoc(DATA_DOC, INIT_DB, { merge: true });
        setDB(INIT_DB);
      } else {
        setDB(mergeDefaults(snap.data(), INIT_DB));
      }
      unsub = onSnapshot(DATA_DOC, s2 => {
        if (s2.exists()) setDB(mergeDefaults(s2.data(), INIT_DB));
      }, err => console.error('Firestore snapshot error:', err));
    }).catch(err => {
      console.error('Firestore getDoc error:', err);
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

  const themeCtx = { T, s, isDark, toggle: toggleTheme };

  if (user === undefined) return <Splash T={T} label='AUTHENTICATING' />;
  if (!user)              return <ThemeCtx.Provider value={themeCtx}><Login T={T} /></ThemeCtx.Provider>;
  if (!db)                return <Splash T={T} label='LOADING DATA' />;

  const tabs = [
    { k: 'vessels',    icon: '⛴', label: 'VESSELS' },
    { k: 'trucks',     icon: '🚛', label: 'TRUCKS' },
    { k: 'routes',     icon: '📍', label: 'ROUTES' },
    { k: 'calculator', icon: '∑',  label: 'CALCULATOR' },
    { k: 'masterdata', icon: '📊',  label: 'MASTER DATA' },
  ];

  const mobile = isMobile();

  return (
    <ThemeCtx.Provider value={themeCtx}>
      <div style={{ display: 'flex', height: '100vh', background: T.bg,
        color: T.text, fontFamily: T.font, overflow: 'hidden', position: 'relative',
        transition: 'background 0.2s, color 0.2s' }}>

        {/* Mobile overlay */}
        {mobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
        )}

        {/* Sidebar */}
        <nav style={{
          width: sidebarOpen ? 210 : (mobile ? 0 : 52),
          borderRight: `1px solid ${T.border}`,
          padding: '0',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          background: T.navBg,
          ...(mobile ? {
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease', width: 220,
            boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
          } : {
            transition: 'width 0.2s ease', overflow: 'hidden',
          }),
        }}>

          {/* Logo area */}
          <div style={{
            padding: sidebarOpen ? '20px 16px 16px' : '16px 0 16px',
            display: 'flex', alignItems: 'center',
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            borderBottom: `1px solid ${T.border}30`,
          }}>
            {sidebarOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {/* USI Logo */}
                <img src={USI_LOGO_B64} alt='USI'
                  style={{ width: 44, height: 34, objectFit: 'contain', flexShrink: 0,
                    filter: isDark ? 'none' : 'brightness(1.1)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: T.amber, fontWeight: 700,
                    letterSpacing: 1.5, fontFamily: T.font, whiteSpace: 'nowrap' }}>
                    FREIGHT OPS
                  </div>
                  <div style={{ fontSize: 8, color: T.textDim, letterSpacing: 1,
                    fontFamily: T.font, whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis' }}>
                    USI PETROTRANS
                  </div>
                </div>
              </div>
            ) : !mobile ? (
              <img src={USI_LOGO_B64} alt='USI'
                style={{ width: 32, height: 24, objectFit: 'contain' }} />
            ) : null}

            {!mobile && (
              <button onClick={() => setSidebarOpen(v => !v)}
                title={sidebarOpen ? 'Collapse' : 'Expand'}
                style={{ background: 'none', border: 'none', color: T.textDim,
                  cursor: 'pointer', fontSize: 14, padding: '2px 4px',
                  flexShrink: 0, lineHeight: 1 }}>
                {sidebarOpen ? '◂' : '▸'}
              </button>
            )}
          </div>

          {/* Nav items */}
          <div style={{ paddingTop: 8, flex: 1, overflowY: 'auto' }}>
            {tabs.map(({ k, icon, label }) => (
              <button key={k} onClick={() => navigateTo(k)}
                title={!sidebarOpen ? label : undefined}
                style={{
                  width: '100%', background: tab === k ? `${T.amber}18` : 'transparent',
                  border: 'none',
                  borderLeft: tab === k ? `3px solid ${T.amber}` : '3px solid transparent',
                  color: tab === k ? T.amber : T.textDim,
                  padding: sidebarOpen ? '11px 20px' : '13px 0',
                  textAlign: sidebarOpen ? 'left' : 'center',
                  cursor: 'pointer', fontFamily: T.font, fontSize: 10, letterSpacing: 1.5,
                  display: 'flex', alignItems: 'center',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  gap: 10, transition: 'all .15s',
                }}>
                <span style={{ fontSize: sidebarOpen ? 13 : 17 }}>{icon}</span>
                {sidebarOpen && label}
              </button>
            ))}
          </div>

          {/* Bottom: theme toggle + user */}
          <div style={{ borderTop: `1px solid ${T.border}30`, padding: sidebarOpen ? '12px 16px' : '12px 0' }}>
            {/* Theme toggle */}
            <button onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                width: sidebarOpen ? '100%' : 'auto',
                display: 'flex', alignItems: 'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                gap: 8, background: 'none', border: 'none',
                color: T.textDim, cursor: 'pointer', fontFamily: T.font,
                fontSize: 10, letterSpacing: 1, padding: sidebarOpen ? '6px 4px' : '8px',
                marginBottom: 8,
              }}>
              <span style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</span>
              {sidebarOpen && (isDark ? 'LIGHT MODE' : 'DARK MODE')}
            </button>

            {sidebarOpen ? (
              <>
                <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 6,
                  fontFamily: T.font, letterSpacing: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </div>
                <button onClick={() => signOut(auth)}
                  style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                    color: T.textDim, cursor: 'pointer', fontFamily: T.font, fontSize: 9,
                    letterSpacing: 1, padding: '5px 10px', width: '100%' }}>
                  Sign Out
                </button>
              </>
            ) : !mobile ? (
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => signOut(auth)} title='Sign Out'
                  style={{ background: 'none', border: 'none', color: T.textDim,
                    cursor: 'pointer', fontSize: 14, padding: '4px' }}>⏻</button>
              </div>
            ) : null}
          </div>
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column',
          background: T.bg, transition: 'background 0.2s' }}>

          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: mobile ? '12px 16px' : '12px 24px',
            borderBottom: `1px solid ${T.border}`,
            background: T.card, flexShrink: 0,
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {mobile && (
                <button onClick={() => setSidebarOpen(true)}
                  style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                    color: T.amber, cursor: 'pointer', padding: '6px 10px',
                    fontSize: 16, lineHeight: 1 }}>☰</button>
              )}
              <div style={{ fontSize: 11, color: T.amber, fontWeight: 700,
                letterSpacing: 2, fontFamily: T.font }}>
                {tabs.find(t => t.k === tab)?.icon} {tabs.find(t => t.k === tab)?.label}
              </div>
            </div>
            {/* PT names */}
            <div style={{ fontSize: 9, color: T.textDim, fontFamily: T.font,
              letterSpacing: 1, textAlign: 'right', lineHeight: 1.6 }}>
              <div>PT USI PETROTRANS SAMUDRA</div>
              <div>PT USI PETROTRANS ENERGI</div>
            </div>
          </div>

          {/* Module content */}
          <div style={{ flex: 1, overflow: 'auto', padding: mobile ? '16px' : '28px 32px' }}>
            {tab === 'vessels'    && <Vessels    db={db} updateDB={updateDB} />}
            {tab === 'trucks'     && <Trucks     db={db} updateDB={updateDB} />}
            {tab === 'routes'     && <Routes     db={db} updateDB={updateDB} />}
            {tab === 'calculator' && <Calculator db={db} updateDB={updateDB} />}
            {tab === 'masterdata' && <MasterDataModule db={db} updateDB={updateDB} />}
          </div>
        </main>
      </div>
    </ThemeCtx.Provider>
  );
}

function Splash({ T, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      background: T?.bg || '#0a0f14', gap: 24 }}>
      <img src={USI_LOGO_B64} alt='USI' style={{ width: 80, opacity: 0.8 }} />
      <div style={{ color: T?.amber || '#f59e0b',
        fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 3 }}>
        {label}…
      </div>
    </div>
  );
}
