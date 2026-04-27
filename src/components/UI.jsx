import { T, s } from '../tokens';

export function Hdr({ children }) {
  return (
    <div style={{ fontSize: 11, color: T.amber, fontFamily: T.font,
      letterSpacing: 2, marginBottom: 20, fontWeight: 700 }}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, disabled, variant, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s.btn(variant), ...style,
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {children}
    </button>
  );
}

export function Inp({ label, value, onChange, type = 'text', placeholder, style = {}, step }) {
  return (
    <div>
      {label && <label style={s.label}>{label.toUpperCase()}</label>}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        style={{ ...s.input, ...style }}
      />
    </div>
  );
}

export function Sel({ label, value, onChange, children, style = {} }) {
  return (
    <div>
      {label && <label style={s.label}>{label.toUpperCase()}</label>}
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}
        style={{ ...s.input, ...style }}>
        {children}
      </select>
    </div>
  );
}

export function Badge({ children, color }) {
  return (
    <span style={{
      background: `${color || T.amber}22`,
      border: `1px solid ${color || T.amber}44`,
      borderRadius: 3,
      color: color || T.amber,
      fontSize: 9,
      fontFamily: T.font,
      letterSpacing: 1,
      padding: '2px 8px',
    }}>
      {children}
    </span>
  );
}

export function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        width: Math.min(width, window.innerWidth - 32), maxHeight: '90vh',
        overflow: 'auto', padding: 28, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.amber, fontFamily: T.font, letterSpacing: 2, fontWeight: 700 }}>
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
  return (
    <div style={{ ...s.card, flex: 1, minWidth: 140, padding: '14px 16px', marginBottom: 0 }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5, marginBottom: 8, fontFamily: T.font }}>
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
  return (
    <div style={{ fontSize: 9, color: T.amber, letterSpacing: 2,
      fontFamily: T.font, marginBottom: 10, marginTop: 20, fontWeight: 700 }}>
      {children}
    </div>
  );
}

export function Divider() {
  return <div style={{ borderTop: `1px solid ${T.border}`, margin: '16px 0' }} />;
}
