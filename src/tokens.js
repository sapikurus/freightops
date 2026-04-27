// FreightOps design tokens — dark and light mode

export const DARK = {
  bg:        '#0a0f14',
  card:      '#111820',
  border:    '#1e2a38',
  amber:     '#f59e0b',
  amberGlow: 'rgba(245,158,11,0.08)',
  blue:      '#38bdf8',
  green:     '#4ade80',
  red:       '#f87171',
  teal:      '#2dd4bf',
  text:      '#e2e8f0',
  textDim:   '#64748b',
  textFaint: '#334155',
  font:      "'DM Mono', 'Fira Code', monospace",
  navBg:     '#0d131a',
  inputBg:   '#0d141c',
};

export const LIGHT = {
  bg:        '#f1f5f9',
  card:      '#ffffff',
  border:    '#e2e8f0',
  amber:     '#d97706',
  amberGlow: 'rgba(217,119,6,0.08)',
  blue:      '#0284c7',
  green:     '#16a34a',
  red:       '#dc2626',
  teal:      '#0d9488',
  text:      '#0f172a',
  textDim:   '#64748b',
  textFaint: '#94a3b8',
  font:      "'DM Mono', 'Fira Code', monospace",
  navBg:     '#1e293b',
  inputBg:   '#f8fafc',
};

export function makeStyles(T) {
  return {
    card: {
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      padding: 20,
      marginBottom: 16,
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
      color: v === 'ghost' ? T.textDim : (T === DARK ? '#000' : '#fff'),
      cursor: 'pointer',
      fontFamily: T.font,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.5,
      padding: '8px 16px',
      transition: 'all .15s',
    }),
  };
}

// Static defaults — components import these then override with useTheme()
export const T = DARK;
export const s = makeStyles(DARK);
