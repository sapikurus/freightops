import { useTheme } from '../App';

export function Hdr({ children, sub }) {
  const { T } = useTheme();
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: T.amber, fontFamily: T.font,
        letterSpacing: 2, fontWeight: 700 }}>
        {children}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: T.textDim, fontFamily: T.font,
          letterSpacing: 1, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

export function Btn({ children, onClick, disabled, variant, style = {}, title, type }) {
  const { s } = useTheme();
  return (
    <button onClick={onClick} disabled={disabled} title={title} type={type}
      style={{
        ...s.btn(variant), ...style,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      {children}
    </button>
  );
}

export function Inp({ label, value, onChange, type = 'text', placeholder,
                     style = {}, step, min, max, hint, disabled }) {
  const { T, s } = useTheme();
  return (
    <div>
      {label && <label style={s.label}>{label.toUpperCase()}</label>}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        step={step} min={min} max={max} disabled={disabled}
        style={{ ...s.input, opacity: disabled ? 0.5 : 1, ...style }}
      />
      {hint && (
        <div style={{ fontSize: 9, color: T.textDim, marginTop: -8, marginBottom: 10 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Sel({ label, value, onChange, children, style = {}, hint, disabled }) {
  const { T, s } = useTheme();
  return (
    <div>
      {label && <label style={s.label}>{label.toUpperCase()}</label>}
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...s.input, opacity: disabled ? 0.5 : 1, ...style }}>
        {children}
      </select>
      {hint && (
        <div style={{ fontSize: 9, color: T.textDim, marginTop: -8, marginBottom: 10 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Badge({ children, color }) {
  const { T } = useTheme();
  const c = color || T.amber;
  return (
    <span style={{
      background: `${c}22`,
      border: `1px solid ${c}44`,
      borderRadius: 3,
      color: c,
      fontSize: 9,
      fontFamily: T.font,
      letterSpacing: 1,
      padding: '2px 8px',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

export function Modal({ title, onClose, children, width = 520 }) {
  const { T } = useTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        width: Math.min(width, (typeof window !== 'undefined' ? window.innerWidth : 800) - 32),
        maxHeight: '90vh', overflow: 'auto', padding: 28, position: 'relative',
        color: T.text, fontFamily: T.font }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.amber, fontFamily: T.font,
            letterSpacing: 2, fontWeight: 700 }}>
            {title}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: T.textDim, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatBox({ label, value, sub, color }) {
  const { T, s } = useTheme();
  return (
    <div style={{ ...s.card, flex: 1, minWidth: 140, padding: '14px 16px', marginBottom: 0 }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5,
        marginBottom: 8, fontFamily: T.font }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || T.amber, fontFamily: T.font }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: T.textDim, marginTop: 4, fontFamily: T.font }}>{sub}</div>}
    </div>
  );
}

export function SectionLabel({ children }) {
  const { T } = useTheme();
  return (
    <div style={{ fontSize: 9, color: T.amber, letterSpacing: 2,
      fontFamily: T.font, marginBottom: 10, marginTop: 20, fontWeight: 700 }}>
      {children}
    </div>
  );
}

export function Divider() {
  const { T } = useTheme();
  return <div style={{ borderTop: `1px solid ${T.border}`, margin: '16px 0' }} />;
}

// Semantic notice panel — use instead of hardcoded background colors.
// tone: 'info' | 'good' | 'warn' | 'bad'
export function Notice({ tone = 'info', children, style = {} }) {
  const { s } = useTheme();
  return <div style={{ ...s.notice(tone), ...style }}>{children}</div>;
}

// Empty-state placeholder
export function Empty({ children }) {
  const { T } = useTheme();
  return (
    <div style={{ color: T.textDim, textAlign: 'center', marginTop: 60,
      fontSize: 13, fontFamily: T.font }}>
      {children}
    </div>
  );
}

// Formatted number input with id-ID thousand separators while unfocused.
export function NumInput({ value, onChange, style = {}, placeholder }) {
  const { s } = useTheme();
  const raw = (value === '' || value == null) ? '' : (+value || 0);
  return (
    <input
      type='number'
      value={raw}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === '' ? '' : (+e.target.value || 0))}
      style={{ ...s.input, marginBottom: 0, textAlign: 'right', ...style }}
    />
  );
}
