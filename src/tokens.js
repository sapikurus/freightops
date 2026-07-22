// FreightOps design tokens — dark and light mode
//
// IMPORTANT: Do not import `T` or `s` directly from this file in components.
// Use `useTheme()` from App.jsx instead, so light/dark actually works.
// The static exports at the bottom exist only for Login.jsx's initial paint.

export const DARK = {
  bg:        '#0a0f14',
  card:      '#111820',
  cardAlt:   '#0d141c',   // nested card / inset panel
  border:    '#1e2a38',
  amber:     '#f59e0b',
  amberGlow: 'rgba(245,158,11,0.08)',
  blue:      '#38bdf8',
  green:     '#4ade80',
  greenGlow: 'rgba(74,222,128,0.10)',
  red:       '#f87171',
  redGlow:   'rgba(248,113,113,0.10)',
  teal:      '#2dd4bf',
  tealGlow:  'rgba(45,212,191,0.10)',
  text:      '#e2e8f0',
  textDim:   '#64748b',
  textFaint: '#334155',
  font:      "'DM Mono', 'Fira Code', monospace",
  navBg:     '#0d131a',
  navText:   '#64748b',
  inputBg:   '#0d141c',
  btnText:   '#000000',   // text on a filled amber button
  shadow:    'none',
  isDark:    true,
};

export const LIGHT = {
  bg:        '#f1f5f9',
  card:      '#ffffff',
  cardAlt:   '#f8fafc',
  border:    '#e2e8f0',
  amber:     '#d97706',
  amberGlow: 'rgba(217,119,6,0.08)',
  blue:      '#0284c7',
  green:     '#16a34a',
  greenGlow: 'rgba(22,163,74,0.08)',
  red:       '#dc2626',
  redGlow:   'rgba(220,38,38,0.08)',
  teal:      '#0d9488',
  tealGlow:  'rgba(13,148,136,0.08)',
  text:      '#0f172a',
  textDim:   '#64748b',
  textFaint: '#94a3b8',
  font:      "'DM Mono', 'Fira Code', monospace",
  navBg:     '#1e293b',
  navText:   '#94a3b8',
  inputBg:   '#ffffff',
  btnText:   '#ffffff',
  shadow:    '0 1px 3px rgba(0,0,0,0.08)',
  isDark:    false,
};

export function makeStyles(T) {
  return {
    card: {
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      padding: 20,
      marginBottom: 16,
      boxShadow: T.shadow,
    },
    cardInset: {
      background: T.cardAlt,
      border: `1px solid ${T.border}`,
      borderRadius: 4,
      padding: 12,
      marginBottom: 12,
    },
    label: {
      display: 'block',
      fontSize: 10,
      color: T.textDim,
      letterSpacing: 1.5,
      marginBottom: 6,
      fontFamily: T.font,
    },
    input: {
      background: T.inputBg,
      border: `1px solid ${T.border}`,
      borderRadius: 4,
      color: T.text,
      fontFamily: T.font,
      fontSize: 12,
      padding: '8px 10px',
      width: '100%',
      marginBottom: 12,
      outline: 'none',
      boxSizing: 'border-box',
    },
    th: {
      background: T.bg,
      color: T.textDim,
      fontSize: 9,
      fontFamily: T.font,
      letterSpacing: 1.5,
      padding: '8px 12px',
      textAlign: 'left',
      borderBottom: `1px solid ${T.border}`,
      whiteSpace: 'nowrap',
    },
    td: {
      padding: '10px 12px',
      fontSize: 12,
      borderBottom: `1px solid ${T.border}`,
      color: T.text,
      fontFamily: T.font,
    },
    tdNum: {
      padding: '10px 12px',
      fontSize: 12,
      borderBottom: `1px solid ${T.border}`,
      color: T.text,
      fontFamily: T.font,
      textAlign: 'right',
    },
    btn: (v) => ({
      background: v === 'ghost' ? 'transparent' : T.amber,
      border: `1px solid ${v === 'ghost' ? T.border : T.amber}`,
      borderRadius: 4,
      color: v === 'ghost' ? T.textDim : T.btnText,
      cursor: 'pointer',
      fontFamily: T.font,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.5,
      padding: '8px 16px',
      transition: 'all .15s',
    }),
    // Semantic notice panels — replace hardcoded '#0d1c14' etc.
    notice: (tone = 'info') => {
      const map = {
        info:  { c: T.teal,  g: T.tealGlow  },
        good:  { c: T.green, g: T.greenGlow },
        warn:  { c: T.amber, g: T.amberGlow },
        bad:   { c: T.red,   g: T.redGlow   },
      };
      const { c, g } = map[tone] || map.info;
      return {
        background: g,
        border: `1px solid ${c}44`,
        borderRadius: 4,
        padding: '10px 14px',
        fontSize: 11,
        color: T.text,
        marginBottom: 12,
      };
    },
  };
}

// Static fallbacks — ONLY for Login.jsx pre-theme paint. Do not use elsewhere.
export const T = DARK;
export const s = makeStyles(DARK);
