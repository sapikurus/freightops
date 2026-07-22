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
import DeliveryOrder from './modules/DeliveryOrder';

// ── Theme context ─────────────────────────────────────────────
export const ThemeCtx = createContext({
  T: DARK, s: makeStyles(DARK), isDark: true, toggle: () => {},
});
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

// ── Nav structure: grouped by subsidiary ──────────────────────
const NAV_GROUPS = [
  {
    key: 'pts', label: 'PTS — SEA', icon: '⛴',
    sub: 'PT USI Petrotrans Samudra',
    items: [
      { k: 'vessels',       icon: '⛴', label: 'VESSELS' },
      { k: 'sea-routes',    icon: '📍', label: 'ROUTES' },
      { k: 'sea-calc',      icon: '∑',  label: 'CALCULATOR' },
    ],
  },
  {
    key: 'pte', label: 'PTE — LAND', icon: '🚛',
    sub: 'PT USI Petrotrans Energi',
    items: [
      { k: 'trucks',        icon: '🚛', label: 'TRUCKS' },
      { k: 'land-routes',   icon: '📍', label: 'ROUTES' },
      { k: 'land-calc',     icon: '∑',  label: 'CALCULATOR' },
    ],
  },
  {
    key: 'shared', label: 'SHARED', icon: '◎',
    sub: null,
    items: [
      { k: 'delivery',   icon: '📄', label: 'DELIVERY ORDER' },
      { k: 'masterdata', icon: '📊', label: 'MASTER DATA' },
    ],
  },
];

const ALL_TABS = NAV_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g })));

export default function App() {
  const [user,        setUser]        = useState(undefined);
  const [db,          setDB]          = useState(null);
  const [tab,         setTab]         = useState('vessels');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const [isDark,      setIsDark]      = useState(true);
  const [collapsed,   setCollapsed]   = useState({});

  const T = isDark ? DARK : LIGHT;
  const s = makeStyles(T);

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
    const onResize = () => setSidebarOpen(window.innerWidth >= 768);
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

  const mobile     = isMobile();
  const activeTab  = ALL_TABS.find(t => t.k === tab);
  const activeGroup = activeTab?.group;

  return (
    <ThemeCtx.Provider value={themeCtx}>
      <div style={{ display: 'flex', height: '100vh', background: T.bg,
        color: T.text, fontFamily: T.font, overflow: 'hidden', position: 'relative',
        transition: 'background 0.2s, color 0.2s' }}>

        {mobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
        )}

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <nav style={{
          width: sidebarOpen ? 220 : (mobile ? 0 : 52),
          borderRight: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          background: T.navBg,
          ...(mobile ? {
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease', width: 230,
            boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
          } : {
            transition: 'width 0.2s ease', overflow: 'hidden',
          }),
        }}>

          {/* Logo */}
          <div style={{
            padding: sidebarOpen ? '20px 16px 16px' : '16px 0',
            display: 'flex', alignItems: 'center',
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            borderBottom: `1px solid ${T.border}40`,
          }}>
            {sidebarOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <img src={USI_LOGO_B64} alt='USI'
                  style={{ width: 44, height: 34, objectFit: 'contain', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: T.amber, fontWeight: 700,
                    letterSpacing: 1.5, whiteSpace: 'nowrap' }}>FREIGHT OPS</div>
                  <div style={{ fontSize: 8, color: T.navText, letterSpacing: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                style={{ background: 'none', border: 'none', color: T.navText,
                  cursor: 'pointer', fontSize: 14, padding: '2px 4px',
                  flexShrink: 0, lineHeight: 1 }}>
                {sidebarOpen ? '◂' : '▸'}
              </button>
            )}
          </div>

          {/* Grouped nav */}
          <div style={{ paddingTop: 8, flex: 1, overflowY: 'auto' }}>
            {NAV_GROUPS.map(group => {
              const isCollapsed = collapsed[group.key];
              const groupActive = group.items.some(i => i.k === tab);
              return (
                <div key={group.key} style={{ marginBottom: 4 }}>
                  {/* Group header */}
                  {sidebarOpen ? (
                    <button
                      onClick={() => setCollapsed(c => ({ ...c, [group.key]: !c[group.key] }))}
                      style={{
                        width: '100%', background: 'transparent', border: 'none',
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px 6px', cursor: 'pointer',
                        color: groupActive ? T.amber : T.navText,
                        fontFamily: T.font, fontSize: 9, letterSpacing: 1.5,
                        fontWeight: 700, textAlign: 'left',
                      }}>
                      <span style={{ fontSize: 12 }}>{group.icon}</span>
                      <span style={{ flex: 1 }}>{group.label}</span>
                      <span style={{ fontSize: 8, opacity: 0.6 }}>{isCollapsed ? '▸' : '▾'}</span>
                    </button>
                  ) : !mobile ? (
                    <div style={{ textAlign: 'center', padding: '8px 0 4px',
                      color: T.navText, fontSize: 8, letterSpacing: 1 }}>
                      {group.icon}
                    </div>
                  ) : null}

                  {/* Group items */}
                  {(!isCollapsed || !sidebarOpen) && group.items.map(({ k, icon, label }) => (
                    <button key={k} onClick={() => navigateTo(k)}
                      title={!sidebarOpen ? label : undefined}
                      style={{
                        width: '100%',
                        background: tab === k ? `${T.amber}18` : 'transparent',
                        border: 'none',
                        borderLeft: tab === k ? `3px solid ${T.amber}` : '3px solid transparent',
                        color: tab === k ? T.amber : T.navText,
                        padding: sidebarOpen ? '9px 16px 9px 30px' : '11px 0',
                        textAlign: sidebarOpen ? 'left' : 'center',
                        cursor: 'pointer', fontFamily: T.font, fontSize: 10,
                        letterSpacing: 1.2,
                        display: 'flex', alignItems: 'center',
                        justifyContent: sidebarOpen ? 'flex-start' : 'center',
                        gap: 9, transition: 'all .15s',
                      }}>
                      <span style={{ fontSize: sidebarOpen ? 12 : 16 }}>{icon}</span>
                      {sidebarOpen && label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Bottom */}
          <div style={{ borderTop: `1px solid ${T.border}40`,
            padding: sidebarOpen ? '12px 16px' : '12px 0' }}>
            <button onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                width: sidebarOpen ? '100%' : 'auto',
                display: 'flex', alignItems: 'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                gap: 8, background: 'none', border: 'none',
                color: T.navText, cursor: 'pointer', fontFamily: T.font,
                fontSize: 10, letterSpacing: 1,
                padding: sidebarOpen ? '6px 4px' : '8px', marginBottom: 8,
              }}>
              <span style={{ fontSize: 15 }}>{isDark ? '☀' : '☾'}</span>
              {sidebarOpen && (isDark ? 'LIGHT MODE' : 'DARK MODE')}
            </button>

            {sidebarOpen ? (
              <>
                <div style={{ fontSize: 9, color: T.navText, opacity: 0.7, marginBottom: 6,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </div>
                <button onClick={() => signOut(auth)}
                  style={{ background: 'none', border: `1px solid ${T.border}`,
                    borderRadius: 4, color: T.navText, cursor: 'pointer',
                    fontFamily: T.font, fontSize: 9, letterSpacing: 1,
                    padding: '5px 10px', width: '100%' }}>
                  Sign Out
                </button>
              </>
            ) : !mobile ? (
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => signOut(auth)} title='Sign Out'
                  style={{ background: 'none', border: 'none', color: T.navText,
                    cursor: 'pointer', fontSize: 14, padding: 4 }}>⏻</button>
              </div>
            ) : null}
          </div>
        </nav>

        {/* ── Main ────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex',
          flexDirection: 'column', background: T.bg, transition: 'background 0.2s' }}>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: mobile ? '12px 16px' : '12px 24px',
            borderBottom: `1px solid ${T.border}`,
            background: T.card, flexShrink: 0, boxShadow: T.shadow,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {mobile && (
                <button onClick={() => setSidebarOpen(true)}
                  style={{ background: 'none', border: `1px solid ${T.border}`,
                    borderRadius: 4, color: T.amber, cursor: 'pointer',
                    padding: '6px 10px', fontSize: 16, lineHeight: 1 }}>☰</button>
              )}
              <div>
                {activeGroup?.sub && (
                  <div style={{ fontSize: 8, color: T.textDim, letterSpacing: 1.5,
                    marginBottom: 2 }}>{activeGroup.sub}</div>
                )}
                <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, letterSpacing: 2 }}>
                  {activeTab?.icon} {activeTab?.label}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1,
              textAlign: 'right', lineHeight: 1.6 }}>
              <div>PT USI PETROTRANS SAMUDRA</div>
              <div>PT USI PETROTRANS ENERGI</div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: mobile ? '16px' : '28px 32px' }}>
            {tab === 'vessels'     && <Vessels    db={db} updateDB={updateDB} />}
            {tab === 'trucks'      && <Trucks     db={db} updateDB={updateDB} />}
            {tab === 'sea-routes'  && <Routes     db={db} updateDB={updateDB} mode='sea' />}
            {tab === 'land-routes' && <Routes     db={db} updateDB={updateDB} mode='land' />}
            {tab === 'sea-calc'    && <Calculator db={db} updateDB={updateDB} mode='sea' />}
            {tab === 'land-calc'   && <Calculator db={db} updateDB={updateDB} mode='land' />}
            {tab === 'delivery'    && <DeliveryOrder db={db} updateDB={updateDB} />}
            {tab === 'masterdata'  && <MasterDataModule db={db} updateDB={updateDB} />}
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
