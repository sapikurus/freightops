import { useState } from 'react';
import { DARK, makeStyles } from '../tokens';
import { useTheme } from '../App';
import { Hdr, Btn, SectionLabel } from '../components/UI';
import { uid, idr0 } from '../utils';

function MasterTable({ T, s, title, rows, onUpdate, columns, addRow, note }) {
  return (
    <div style={{ ...s.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: T.amber, letterSpacing: 1.5, fontFamily: T.font, fontWeight: 700 }}>{title}</div>
        {addRow && <Btn variant='ghost' onClick={addRow} style={{ padding: '3px 12px', fontSize: 10 }}>+ Add Row</Btn>}
      </div>
      {note && <div style={{ fontSize: 10, color: T.textDim, marginBottom: 10 }}>{note}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{columns.map(c => <th key={c.key} style={{ ...s.th, width: c.width }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map(c => (
                <td key={c.key} style={s.td}>
                  {c.readOnly
                    ? <span style={{ color: T.amber, fontWeight: 700, fontFamily: T.font }}>{c.format ? c.format(row[c.key]) : row[c.key]}</span>
                    : c.key === '__del'
                      ? <button onClick={() => onUpdate(rows.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 14 }}>×</button>
                      : <input type={c.type || 'text'} value={row[c.key] ?? ''}
                          onChange={e => {
                            const updated = [...rows];
                            updated[i] = { ...updated[i], [c.key]: c.type === 'number' ? +e.target.value : e.target.value };
                            onUpdate(updated);
                          }}
                          style={{ ...s.input, marginBottom: 0, width: '100%',
                            fontSize: 11, padding: '5px 8px' }} />
                  }
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} style={{ ...s.td, textAlign: 'center', color: T.textDim, fontSize: 11 }}>
              No entries — click Add Row
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function MasterDataModule({ db, updateDB }) {
  const { T, s } = useTheme();
  const [section, setSection] = useState('overhead');

  const overheadPTE = db.overheadPool?.PTE || { activeUnits: 1, items: [] };
  const overheadPTS = db.overheadPool?.PTS || { activeUnits: 1, items: [] };
  const perizinanPTE = db.perizinan?.PTE || [];
  const perizinanPTS = db.perizinan?.PTS || [];
  const maintRates = db.maintenanceRates || { PTE: { servicePerKm: 0, tirePerKm: 0 }, PTS: {} };

  // Computed totals
  const totalPTE = (overheadPTE.items || []).reduce((s, i) => s + (+i.amount || 0), 0);
  const totalPTS = (overheadPTS.items || []).reduce((s, i) => s + (+i.amount || 0), 0);
  const perUnitPTE = overheadPTE.activeUnits > 0 ? totalPTE / overheadPTE.activeUnits : 0;
  const perUnitPTS = overheadPTS.activeUnits > 0 ? totalPTS / overheadPTS.activeUnits : 0;

  const updateOverhead = (company, field, value) =>
    updateDB(d => ({ ...d, overheadPool: { ...d.overheadPool, [company]: { ...d.overheadPool[company], [field]: value } } }));

  const updatePerizinan = (company, rows) =>
    updateDB(d => ({ ...d, perizinan: { ...d.perizinan, [company]: rows } }));

  const updateMaintRates = (company, field, value) =>
    updateDB(d => ({ ...d, maintenanceRates: { ...d.maintenanceRates, [company]: { ...d.maintenanceRates[company], [field]: +value } } }));

  const sections = [
    ['overhead',     '💼 Overhead Pool'],
    ['perizinan',    '📋 Perizinan'],
    ['maintenance',  '🔧 Maintenance Rates'],
  ];

  return (
    <div>
      <Hdr>📊 MASTER DATA</Hdr>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {sections.map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)} style={{
            ...s.btn('ghost'), padding: '7px 16px', fontSize: 10,
            borderColor: section === k ? T.amber : T.border,
            color: section === k ? T.amber : T.textDim,
          }}>{l}</button>
        ))}
      </div>

      {/* ── OVERHEAD POOL ─────────────────────────────────────── */}
      {section === 'overhead' && <div>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 20, lineHeight: 1.7 }}>
          Monthly overhead costs divided by number of active units → overhead per unit per month → included in OAT calculation automatically.
        </div>

        {[['PTE','🚛 PT USI Petrotrans Energi (Land)'], ['PTS','⛴ PT USI Petrotrans Samudra (Sea)']].map(([co, label]) => {
          const pool  = co === 'PTE' ? overheadPTE : overheadPTS;
          const total = co === 'PTE' ? totalPTE : totalPTS;
          const perUnit = co === 'PTE' ? perUnitPTE : perUnitPTS;

          return (
            <div key={co} style={{ ...s.card }}>
              <div style={{ fontSize: 10, color: T.amber, letterSpacing: 1.5, fontFamily: T.font, fontWeight: 700, marginBottom: 12 }}>
                {label}
              </div>

              {/* Active units input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16,
                background: T.bg, borderRadius: 4, padding: '10px 14px', border: `1px solid ${T.border}` }}>
                <div>
                  <label style={{ ...s.label }}>ACTIVE UNITS (ARMADA)</label>
                  <input type='number' min='1' value={pool.activeUnits || 1}
                    onChange={e => updateOverhead(co, 'activeUnits', +e.target.value || 1)}
                    style={{ ...s.input, width: 80, marginBottom: 0, padding: '5px 8px' }} />
                </div>
                <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1 }}>TOTAL OVERHEAD / MONTH</div>
                  <div style={{ fontSize: 16, color: T.amber, fontWeight: 700, fontFamily: T.font }}>Rp {idr0(total)}</div>
                </div>
                <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1 }}>PER UNIT / MONTH</div>
                  <div style={{ fontSize: 16, color: T.green, fontWeight: 700, fontFamily: T.font }}>Rp {idr0(perUnit)}</div>
                </div>
                <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1 }}>PER UNIT / YEAR</div>
                  <div style={{ fontSize: 16, color: T.green, fontWeight: 700, fontFamily: T.font }}>Rp {idr0(perUnit * 12)}</div>
                </div>
              </div>

              <MasterTable T={T} s={s} title='Monthly Cost Items'
                rows={pool.items || []}
                onUpdate={rows => updateOverhead(co, 'items', rows)}
                addRow={() => updateOverhead(co, 'items', [...(pool.items || []), { id: uid(), name: 'New Item', amount: 0 }])}
                columns={[
                  { key: 'name',   label: 'Cost Item',         width: '60%' },
                  { key: 'amount', label: 'Amount / Month (IDR)', type: 'number', width: '35%' },
                  { key: '__del',  label: '',                   width: '5%' },
                ]}
              />
            </div>
          );
        })}
      </div>}

      {/* ── PERIZINAN ─────────────────────────────────────────── */}
      {section === 'perizinan' && <div>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 20, lineHeight: 1.7 }}>
          Vehicle permits and licenses. Costs are amortized monthly and added to each unit's annual fixed cost in the OAT calculation.
        </div>

        {[['PTE','🚛 PTE — Land Vehicles'], ['PTS','⛴ PTS — Vessels']].map(([co, label]) => {
          const rows = co === 'PTE' ? perizinanPTE : perizinanPTS;
          const annualTotal = rows.reduce((sum, p) => sum + (+p.costIDR || 0) * (12 / (+p.intervalMonths || 12)), 0);

          return (
            <div key={co} style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: T.amber, letterSpacing: 1.5, fontFamily: T.font, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 11, color: T.textDim }}>
                  Total annualized: <strong style={{ color: T.amber }}>Rp {idr0(annualTotal)}</strong> / unit / year
                </div>
              </div>
              <MasterTable T={T} s={s} title=''
                rows={rows}
                onUpdate={rows => updatePerizinan(co, rows)}
                addRow={() => updatePerizinan(co, [...rows, { id: uid(), name: 'New Permit', intervalMonths: 12, costIDR: 0 }])}
                columns={[
                  { key: 'name',           label: 'Permit / License',      width: '40%' },
                  { key: 'intervalMonths', label: 'Interval (months)',      type: 'number', width: '20%' },
                  { key: 'costIDR',        label: 'Cost per Renewal (IDR)', type: 'number', width: '35%' },
                  { key: '__del',          label: '',                       width: '5%' },
                ]}
              />
            </div>
          );
        })}
      </div>}

      {/* ── MAINTENANCE RATES ─────────────────────────────────── */}
      {section === 'maintenance' && <div>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 20, lineHeight: 1.7 }}>
          Per-km maintenance rates for land trucks (from PTE's actual cost data). When set, these replace the maintenance plan estimate in the OAT operating cost calculation.
          <br />Leave at 0 to use the per-truck maintenance plan instead.
        </div>

        {[['PTE','🚛 PTE — Land Rates (IDR/km)'], ['PTS','⛴ PTS — Vessel Rates (not applicable)']].map(([co, label]) => {
          const rates = db.maintenanceRates?.[co] || {};
          return (
            <div key={co} style={s.card}>
              <div style={{ fontSize: 10, color: T.amber, letterSpacing: 1.5, fontFamily: T.font, fontWeight: 700, marginBottom: 16 }}>{label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={s.label}>SERVICE RATE (IDR/km)</label>
                  <input type='number' value={rates.servicePerKm || 0}
                    onChange={e => updateMaintRates(co, 'servicePerKm', e.target.value)}
                    style={{ ...s.input, marginBottom: 0 }} />
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>PTE default: Rp 800/km</div>
                </div>
                <div>
                  <label style={s.label}>TIRE RATE (IDR/km)</label>
                  <input type='number' value={rates.tirePerKm || 0}
                    onChange={e => updateMaintRates(co, 'tirePerKm', e.target.value)}
                    style={{ ...s.input, marginBottom: 0 }} />
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>PTE default: Rp 1,300/km</div>
                </div>
                <div style={{ background: T.bg, borderRadius: 4, padding: '10px 14px',
                  border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, marginBottom: 4 }}>COMBINED RATE</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.amber, fontFamily: T.font }}>
                    Rp {idr0((+rates.servicePerKm || 0) + (+rates.tirePerKm || 0))}/km
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}
