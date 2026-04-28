import { useState } from 'react';
import { useTheme } from '../App';
import { Hdr, Btn, SectionLabel } from '../components/UI';
import { uid } from '../utils';

function NumInput({ value, onChange, style = {} }) {
  const { T, s } = useTheme();
  const [focused, setFocused] = useState(false);
  const raw = (value === '' || value == null) ? 0 : +value || 0;
  const display = focused ? (raw === 0 ? '' : String(raw)) : raw.toLocaleString('id-ID');
  return (
    <input
      type={focused ? 'number' : 'text'}
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={e => { setFocused(false); onChange(+e.target.value || 0); }}
      onChange={e => focused && onChange(+e.target.value || 0)}
      style={{ ...s.input, marginBottom: 0, textAlign: 'right', ...style }}
    />
  );
}

function EditableTable({ rows, onUpdate, columns, addRow, emptyMsg }) {
  const { T, s } = useTheme();
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>{columns.map(c => (
            <th key={c.key} style={{ ...s.th, width: c.width, textAlign: c.align || 'left' }}>{c.label}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length}
              style={{ ...s.td, textAlign: 'center', color: T.textDim, fontSize: 11 }}>
              {emptyMsg || 'No entries yet'}
            </td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map(c => (
                <td key={c.key} style={{ ...s.td, padding: '5px 8px' }}>
                  {c.key === '__del'
                    ? <button onClick={() => onUpdate(rows.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: T.red,
                          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
                    : c.type === 'number'
                      ? <NumInput value={row[c.key]}
                          onChange={v => { const u=[...rows]; u[i]={...u[i],[c.key]:v}; onUpdate(u); }}
                          style={{ width: '100%' }} />
                      : <input type='text' value={row[c.key] || ''}
                          onChange={e => { const u=[...rows]; u[i]={...u[i],[c.key]:e.target.value}; onUpdate(u); }}
                          style={{ ...s.input, marginBottom: 0, width: '100%', fontSize: 11, padding: '5px 8px' }} />
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {addRow && (
        <Btn variant='ghost' onClick={addRow} style={{ fontSize: 10, padding: '4px 14px' }}>+ Add Row</Btn>
      )}
    </div>
  );
}

function StatTile({ label, value, color, last }) {
  const { T } = useTheme();
  return (
    <div style={{ flex: 1, padding: '14px 18px',
      borderRight: last ? 'none' : `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color, fontFamily: T.font }}>
        {value}
      </div>
    </div>
  );
}

export default function MasterDataModule({ db, updateDB }) {
  const { T, s } = useTheme();
  // Company is TOP level, section is sub-level
  const [company, setCompany] = useState('PTE');
  const [section, setSection] = useState('overhead');

  const companies = [
    ['PTE', '🚛', 'PT USI Petrotrans Energi', 'LAND FREIGHT'],
    ['PTS', '⛴', 'PT USI Petrotrans Samudra', 'SEA FREIGHT'],
  ];
  const sections = [
    ['overhead',    '💼 Overhead Pool'],
    ['perizinan',   '📋 Perizinan'],
    ['maintenance', '🔧 Maintenance Rates'],
  ];

  const updOH   = (field, val) => updateDB(d => ({
    ...d, overheadPool: { ...d.overheadPool,
      [company]: { ...(d.overheadPool?.[company] || {}), [field]: val } } }));
  const updPZ   = rows => updateDB(d => ({
    ...d, perizinan: { ...d.perizinan, [company]: rows } }));
  const updRate = (field, val) => updateDB(d => ({
    ...d, maintenanceRates: { ...d.maintenanceRates,
      [company]: { ...(d.maintenanceRates?.[company] || {}), [field]: +val } } }));

  const pool   = db.overheadPool?.[company]     || { activeUnits: 1, items: [] };
  const pzRows = db.perizinan?.[company]         || [];
  const rates  = db.maintenanceRates?.[company] || {};
  const totalOH  = (pool.items || []).reduce((s, i) => s + (+i.amount || 0), 0);
  const perUnit  = totalOH / Math.max(1, pool.activeUnits || 1);
  const pzAnnual = pzRows.reduce((s, p) => s + (+p.costIDR || 0) * (12 / (+p.intervalMonths || 12)), 0);
  const idr = n => Math.round(+n || 0).toLocaleString('id-ID');
  const co = companies.find(c => c[0] === company);

  return (
    <div>
      <Hdr>📊 MASTER DATA</Hdr>

      {/* ── COMPANY selector — TOP LEVEL ────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {companies.map(([k, icon, name, sub]) => (
          <button key={k} onClick={() => setCompany(k)} style={{
            flex: 1, minWidth: 200, background: company === k ? T.amberGlow : T.card,
            border: `2px solid ${company === k ? T.amber : T.border}`,
            borderRadius: 8, padding: '16px 20px', cursor: 'pointer',
            textAlign: 'left', transition: 'all .15s',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: company === k ? T.amber : T.text,
              fontFamily: T.font, letterSpacing: 1, marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 11, color: company === k ? T.amber : T.text }}>{name}</div>
            <div style={{ fontSize: 9, color: T.textDim, marginTop: 2, letterSpacing: 1 }}>{sub}</div>
          </button>
        ))}
      </div>

      {/* ── SECTION sub-tabs — SECOND LEVEL ─────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap',
        borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
        {sections.map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)} style={{
            ...s.btn('ghost'), padding: '7px 16px', fontSize: 10,
            borderColor: section === k ? T.amber : T.border,
            color:       section === k ? T.amber : T.textDim,
            fontWeight:  section === k ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>

      {/* Context label */}
      <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, marginBottom: 16,
        fontFamily: T.font }}>
        {co?.[1]} {co?.[0]} — {co?.[2]} &nbsp;›&nbsp; {sections.find(s => s[0] === section)?.[1]}
      </div>

      {/* ── OVERHEAD POOL ─────────────────────────────────────── */}
      {section === 'overhead' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Monthly overhead costs shared across the fleet. Divided by active units → overhead per unit/month → automatically added to each OAT calculation.
        </div>
        <div style={{ ...s.card, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{ padding: '14px 18px', borderRight: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={{ ...s.label, marginBottom: 6 }}>ACTIVE UNITS</label>
              <input type='number' min='1' value={pool.activeUnits || 1}
                onChange={e => updOH('activeUnits', +e.target.value || 1)}
                style={{ ...s.input, marginBottom: 0, width: 70, textAlign: 'center', padding: '5px' }} />
            </div>
            <StatTile label='TOTAL / MONTH'    value={`Rp ${idr(totalOH)}`}       color={T.amber} />
            <StatTile label='PER UNIT / MONTH' value={`Rp ${idr(perUnit)}`}       color={T.green} />
            <StatTile label='PER UNIT / YEAR'  value={`Rp ${idr(perUnit * 12)}`}  color={T.green} last />
          </div>
        </div>
        <div style={s.card}>
          <SectionLabel>MONTHLY COST ITEMS</SectionLabel>
          <EditableTable
            rows={pool.items || []}
            onUpdate={rows => updOH('items', rows)}
            addRow={() => updOH('items', [...(pool.items || []), { id: uid(), name: 'New Item', amount: 0 }])}
            emptyMsg='No items yet — click Add Row'
            columns={[
              { key: 'name',   label: 'Cost Item',            width: '58%' },
              { key: 'amount', label: 'Amount / Month (IDR)', width: '37%', type: 'number', align: 'right' },
              { key: '__del',  label: '',                     width: '5%' },
            ]}
          />
        </div>
      </>}

      {/* ── PERIZINAN ─────────────────────────────────────────── */}
      {section === 'perizinan' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Permits and licenses. Each is amortized over its renewal interval and added to the annual fixed cost per unit.
        </div>
        <div style={{ ...s.card, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <StatTile label='TOTAL ANNUALIZED / UNIT / YEAR' value={`Rp ${idr(pzAnnual)}`}      color={T.amber} />
            <StatTile label='EQUIVALENT / MONTH'              value={`Rp ${idr(pzAnnual / 12)}`} color={T.textDim} last />
          </div>
        </div>
        <div style={s.card}>
          <SectionLabel>PERMIT / LICENSE ITEMS</SectionLabel>
          <EditableTable
            rows={pzRows}
            onUpdate={updPZ}
            addRow={() => updPZ([...pzRows, { id: uid(), name: 'New Permit', intervalMonths: 12, costIDR: 0 }])}
            emptyMsg='No permits yet — click Add Row'
            columns={[
              { key: 'name',           label: 'Permit / License',          width: '43%' },
              { key: 'intervalMonths', label: 'Renewal Interval (months)',  width: '22%', type: 'number', align: 'right' },
              { key: 'costIDR',        label: 'Cost per Renewal (IDR)',     width: '30%', type: 'number', align: 'right' },
              { key: '__del',          label: '',                           width: '5%' },
            ]}
          />
        </div>
      </>}

      {/* ── MAINTENANCE RATES ─────────────────────────────────── */}
      {section === 'maintenance' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Per-km maintenance rates for OAT operating cost. When non-zero, these replace the per-truck maintenance plan estimate. Leave at 0 to use individual truck maintenance plans.
        </div>
        <div style={s.card}>
          <SectionLabel>RATES (IDR / KM)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={s.label}>SERVICE RATE (IDR/km)</label>
              <NumInput value={rates.servicePerKm || 0} onChange={v => updRate('servicePerKm', v)} />
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>PTE reference: Rp 800/km</div>
            </div>
            <div>
              <label style={s.label}>TIRE RATE (IDR/km)</label>
              <NumInput value={rates.tirePerKm || 0} onChange={v => updRate('tirePerKm', v)} />
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>PTE reference: Rp 1,300/km</div>
            </div>
            <div style={{ background: T.bg, borderRadius: 4, padding: '12px 16px',
              border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5, marginBottom: 6 }}>COMBINED RATE</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.amber, fontFamily: T.font }}>
                Rp {idr((+rates.servicePerKm || 0) + (+rates.tirePerKm || 0))}/km
              </div>
            </div>
          </div>
        </div>
        {company === 'PTS' && (
          <div style={{ fontSize: 11, color: T.textDim, background: `${T.border}44`,
            borderRadius: 4, padding: '10px 14px', marginTop: 4 }}>
            ℹ Per-km rates are not applicable for vessels. Use the Maintenance Plan in each vessel record instead.
          </div>
        )}
      </>}
    </div>
  );
}
