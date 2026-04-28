import { useState } from 'react';
import { useTheme } from '../App';
import { Hdr, Btn, SectionLabel } from '../components/UI';
import { uid } from '../utils';

// ── Formatted number input — shows thousand separators when not focused ──
function NumInput({ value, onChange, style = {} }) {
  const { T, s } = useTheme();
  const [focused, setFocused] = useState(false);
  const raw = (value === '' || value == null) ? 0 : +value || 0;
  const display = focused
    ? (raw === 0 ? '' : String(raw))
    : raw.toLocaleString('id-ID');

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

// ── Editable table ────────────────────────────────────────────
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

// ── Stat tile ─────────────────────────────────────────────────
function StatTile({ label, value, color }) {
  const { T } = useTheme();
  return (
    <div style={{ flex: 1, padding: '14px 18px', borderRight: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || T.amber, fontFamily: T.font }}>
        {value}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MasterDataModule({ db, updateDB }) {
  const { T, s } = useTheme();
  const [section, setSection] = useState('overhead');
  const [company, setCompany] = useState('PTE');

  const sections  = [
    ['overhead',    '💼 Overhead Pool'],
    ['perizinan',   '📋 Perizinan'],
    ['maintenance', '🔧 Maintenance Rates'],
  ];
  const companies = [
    ['PTE', '🚛 PTE — Land (PT USI Petrotrans Energi)'],
    ['PTS', '⛴ PTS — Sea (PT USI Petrotrans Samudra)'],
  ];

  const updOH   = (field, val) => updateDB(d => ({
    ...d, overheadPool: { ...d.overheadPool,
      [company]: { ...(d.overheadPool?.[company] || {}), [field]: val } } }));
  const updPZ   = rows => updateDB(d => ({
    ...d, perizinan: { ...d.perizinan, [company]: rows } }));
  const updRate = (field, val) => updateDB(d => ({
    ...d, maintenanceRates: { ...d.maintenanceRates,
      [company]: { ...(d.maintenanceRates?.[company] || {}), [field]: +val } } }));

  const pool   = db.overheadPool?.[company]       || { activeUnits: 1, items: [] };
  const pzRows = db.perizinan?.[company]           || [];
  const rates  = db.maintenanceRates?.[company]   || {};
  const totalOH  = (pool.items || []).reduce((s, i) => s + (+i.amount || 0), 0);
  const perUnit  = Math.max(1, pool.activeUnits || 1);
  const perUnitM = totalOH / perUnit;
  const pzAnnual = pzRows.reduce((s, p) => s + (+p.costIDR || 0) * (12 / (+p.intervalMonths || 12)), 0);
  const idr = n => Math.round(+n || 0).toLocaleString('id-ID');

  return (
    <div>
      <Hdr>📊 MASTER DATA</Hdr>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {sections.map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)} style={{
            ...s.btn('ghost'), padding: '8px 18px', fontSize: 10,
            borderColor: section === k ? T.amber : T.border,
            color:       section === k ? T.amber : T.textDim,
            fontWeight:  section === k ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>

      {/* Company tabs — underline style */}
      <div style={{ display: 'flex', borderBottom: `2px solid ${T.border}`, marginBottom: 20 }}>
        {companies.map(([k, l]) => (
          <button key={k} onClick={() => setCompany(k)} style={{
            background: 'none', border: 'none',
            borderBottom: `2px solid ${company === k ? T.amber : 'transparent'}`,
            marginBottom: -2,
            color:      company === k ? T.amber : T.textDim,
            cursor:     'pointer', fontFamily: T.font,
            fontSize:   11, fontWeight: company === k ? 700 : 400,
            letterSpacing: 1, padding: '10px 20px', transition: 'all .15s',
          }}>{l}</button>
        ))}
      </div>

      {/* ── OVERHEAD POOL ─────────────────────────────────────── */}
      {section === 'overhead' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Monthly overhead costs shared across the fleet. Divided by active units to get per-unit cost,
          which is automatically included in each OAT calculation.
        </div>

        {/* Summary bar */}
        <div style={{ ...s.card, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{ padding: '14px 18px', borderRight: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={{ ...s.label, marginBottom: 6 }}>ACTIVE UNITS</label>
              <input type='number' min='1' value={pool.activeUnits || 1}
                onChange={e => updOH('activeUnits', +e.target.value || 1)}
                style={{ ...s.input, marginBottom: 0, width: 70, textAlign: 'center', padding: '5px' }} />
            </div>
            <StatTile label='TOTAL / MONTH'     value={`Rp ${idr(totalOH)}`} color={T.amber} />
            <StatTile label='PER UNIT / MONTH'  value={`Rp ${idr(perUnitM)}`} color={T.green} />
            <StatTile label='PER UNIT / YEAR'   value={`Rp ${idr(perUnitM * 12)}`} color={T.green} />
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
              { key: 'name',   label: 'Cost Item',           width: '58%' },
              { key: 'amount', label: 'Amount / Month (IDR)', width: '37%', type: 'number', align: 'right' },
              { key: '__del',  label: '',                     width: '5%' },
            ]}
          />
        </div>
      </>}

      {/* ── PERIZINAN ─────────────────────────────────────────── */}
      {section === 'perizinan' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Vehicle permits and licenses. Each entry is amortized over its renewal interval
          and added to the annual fixed cost per unit in the OAT calculation.
        </div>

        <div style={{ ...s.card, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <StatTile label='TOTAL ANNUALIZED / UNIT / YEAR' value={`Rp ${idr(pzAnnual)}`} color={T.amber} />
            <StatTile label='EQUIVALENT / MONTH'             value={`Rp ${idr(pzAnnual / 12)}`} color={T.textDim} />
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
              { key: 'name',           label: 'Permit / License',         width: '43%' },
              { key: 'intervalMonths', label: 'Renewal Interval (months)', width: '22%', type: 'number', align: 'right' },
              { key: 'costIDR',        label: 'Cost per Renewal (IDR)',    width: '30%', type: 'number', align: 'right' },
              { key: '__del',          label: '',                          width: '5%' },
            ]}
          />
        </div>
      </>}

      {/* ── MAINTENANCE RATES ─────────────────────────────────── */}
      {section === 'maintenance' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Per-km maintenance rates used in the OAT operating cost calculation.
          When non-zero, these replace the per-truck maintenance plan estimate.
          Leave at 0 to use individual truck maintenance plans instead.
        </div>

        <div style={s.card}>
          <SectionLabel>RATES (IDR / KM)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={s.label}>SERVICE RATE (IDR/km)</label>
              <NumInput value={rates.servicePerKm || 0}
                onChange={v => updRate('servicePerKm', v)} />
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>PTE reference: Rp 800/km</div>
            </div>
            <div>
              <label style={s.label}>TIRE RATE (IDR/km)</label>
              <NumInput value={rates.tirePerKm || 0}
                onChange={v => updRate('tirePerKm', v)} />
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
            borderRadius: 4, padding: '10px 14px', marginTop: 8 }}>
            ℹ Per-km rates are not applicable for vessels. Vessel maintenance costs are
            better captured in each vessel's Maintenance Plan.
          </div>
        )}
      </>}
    </div>
  );
}
