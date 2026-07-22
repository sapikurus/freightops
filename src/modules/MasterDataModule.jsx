import { useState } from 'react';
import { useTheme } from '../App';
import { Hdr, Btn, SectionLabel, NumInput, Notice } from '../components/UI';
import { uid, idr0 } from '../utils';

function EditableTable({ rows, onUpdate, columns, addRow, emptyMsg }) {
  const { T, s } = useTheme();
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
          <thead>
            <tr>{columns.map(c => (
              <th key={c.key} style={{ ...s.th, width: c.width,
                textAlign: c.align || 'left' }}>{c.label}</th>
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
                          title='Remove'
                          style={{ background: 'none', border: 'none', color: T.red,
                            cursor: 'pointer', fontSize: 16, lineHeight: 1,
                            padding: '0 4px' }}>×</button>
                      : c.type === 'number'
                        ? <NumInput value={row[c.key]}
                            onChange={v => { const u = [...rows]; u[i] = { ...u[i], [c.key]: v }; onUpdate(u); }}
                            style={{ width: '100%' }} />
                        : <input type='text' value={row[c.key] || ''}
                            placeholder={c.placeholder}
                            onChange={e => { const u = [...rows]; u[i] = { ...u[i], [c.key]: e.target.value }; onUpdate(u); }}
                            style={{ ...s.input, marginBottom: 0, width: '100%',
                              fontSize: 11, padding: '5px 8px' }} />
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {addRow && (
        <Btn variant='ghost' onClick={addRow}
          style={{ fontSize: 10, padding: '4px 14px' }}>+ Add Row</Btn>
      )}
    </div>
  );
}

function StatTile({ label, value, color, last }) {
  const { T } = useTheme();
  return (
    <div style={{ flex: 1, minWidth: 150, padding: '14px 18px',
      borderRight: last ? 'none' : `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5,
        marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: T.font }}>
        {value}
      </div>
    </div>
  );
}

export default function MasterDataModule({ db, updateDB }) {
  const { T, s } = useTheme();
  const [company, setCompany] = useState('PTS');
  const [section, setSection] = useState('overhead');

  const companies = [
    ['PTS', '⛴',  'PT USI Petrotrans Samudra', 'SEA FREIGHT'],
    ['PTE', '🚛', 'PT USI Petrotrans Energi',  'LAND FREIGHT'],
  ];

  // Sections differ by company:
  //   PTE gets per-km maintenance rates (mileage-based wear).
  //   PTS gets vessel types instead — mileage rates don't apply at sea.
  const sections = company === 'PTS'
    ? [['overhead',    '💼 Overhead Pool'],
       ['perizinan',   '📋 Perizinan'],
       ['vesseltypes', '⛴ Vessel Types']]
    : [['overhead',    '💼 Overhead Pool'],
       ['perizinan',   '📋 Perizinan'],
       ['maintenance', '🔧 Maintenance Rates']];

  const switchCompany = (k) => {
    setCompany(k);
    // Keep the section if it exists for the new company, else fall back.
    const valid = (k === 'PTS'
      ? ['overhead', 'perizinan', 'vesseltypes']
      : ['overhead', 'perizinan', 'maintenance']);
    if (!valid.includes(section)) setSection('overhead');
  };

  const updOH = (field, val) => updateDB(d => ({
    ...d, overheadPool: { ...d.overheadPool,
      [company]: { ...(d.overheadPool?.[company] || {}), [field]: val } } }));
  const updPZ = rows => updateDB(d => ({
    ...d, perizinan: { ...d.perizinan, [company]: rows } }));
  const updRate = (field, val) => updateDB(d => ({
    ...d, maintenanceRates: { ...d.maintenanceRates,
      PTE: { ...(d.maintenanceRates?.PTE || {}), [field]: +val || 0 } } }));
  const updTypes = rows => updateDB(d => ({ ...d, vesselTypes: rows }));

  const pool   = db.overheadPool?.[company] || { activeUnits: 1, items: [] };
  const pzRows = db.perizinan?.[company] || [];
  const rates  = db.maintenanceRates?.PTE || {};
  const types  = db.vesselTypes || [];

  const totalOH  = (pool.items || []).reduce((a, i) => a + (+i.amount || 0), 0);
  const perUnit  = totalOH / Math.max(1, pool.activeUnits || 1);
  const pzAnnual = pzRows.reduce((a, p) =>
    a + (+p.costIDR || 0) * (12 / (+p.intervalMonths || 12)), 0);
  const co = companies.find(c => c[0] === company);

  const vesselsUsingType = (name) =>
    (db.vessels || []).filter(v => v.vesselType === name).length;

  return (
    <div>
      <Hdr sub='Shared reference data feeding every OAT calculation'>📊 MASTER DATA</Hdr>

      {/* Company selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {companies.map(([k, icon, name, sub]) => (
          <button key={k} onClick={() => switchCompany(k)} style={{
            flex: 1, minWidth: 200, background: company === k ? T.amberGlow : T.card,
            border: `2px solid ${company === k ? T.amber : T.border}`,
            borderRadius: 8, padding: '16px 20px', cursor: 'pointer',
            textAlign: 'left', transition: 'all .15s', fontFamily: T.font,
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700,
              color: company === k ? T.amber : T.text,
              letterSpacing: 1, marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 11, color: company === k ? T.amber : T.text }}>{name}</div>
            <div style={{ fontSize: 9, color: T.textDim, marginTop: 2,
              letterSpacing: 1 }}>{sub}</div>
          </button>
        ))}
      </div>

      {/* Section tabs */}
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

      <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5,
        marginBottom: 16, fontFamily: T.font }}>
        {co?.[1]} {co?.[0]} — {co?.[2]} &nbsp;›&nbsp;{' '}
        {sections.find(x => x[0] === section)?.[1]}
      </div>

      {/* ── OVERHEAD POOL ──────────────────────────────────── */}
      {section === 'overhead' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Monthly overhead shared across the fleet. Divided by active units to give overhead
          per unit per month, then annualized into every OAT calculation for this company.
        </div>
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{ padding: '14px 18px', borderRight: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={{ ...s.label, marginBottom: 6 }}>ACTIVE UNITS</label>
              <input type='number' min='1' value={pool.activeUnits || 1}
                onChange={e => updOH('activeUnits', Math.max(1, +e.target.value || 1))}
                style={{ ...s.input, marginBottom: 0, width: 80,
                  textAlign: 'center', padding: 5 }} />
            </div>
            <StatTile label='TOTAL / MONTH'    value={`Rp ${idr0(totalOH)}`}      color={T.amber} />
            <StatTile label='PER UNIT / MONTH' value={`Rp ${idr0(perUnit)}`}      color={T.green} />
            <StatTile label='PER UNIT / YEAR'  value={`Rp ${idr0(perUnit * 12)}`} color={T.green} last />
          </div>
        </div>
        <div style={s.card}>
          <SectionLabel>MONTHLY COST ITEMS</SectionLabel>
          <EditableTable
            rows={pool.items || []}
            onUpdate={rows => updOH('items', rows)}
            addRow={() => updOH('items',
              [...(pool.items || []), { id: uid(), name: 'New Item', amount: 0 }])}
            emptyMsg='No items yet — click Add Row'
            columns={[
              { key: 'name',   label: 'Cost Item',            width: '58%' },
              { key: 'amount', label: 'Amount / Month (IDR)', width: '37%',
                type: 'number', align: 'right' },
              { key: '__del',  label: '',                     width: '5%' },
            ]}
          />
        </div>
      </>}

      {/* ── PERIZINAN ──────────────────────────────────────── */}
      {section === 'perizinan' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Permits and licenses. Each is amortized over its renewal interval and added
          to the annual fixed cost per unit.
        </div>
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <StatTile label='TOTAL ANNUALIZED / UNIT'
              value={`Rp ${idr0(pzAnnual)}`} color={T.amber} />
            <StatTile label='EQUIVALENT / MONTH'
              value={`Rp ${idr0(pzAnnual / 12)}`} color={T.textDim} last />
          </div>
        </div>
        <div style={s.card}>
          <SectionLabel>PERMIT / LICENSE ITEMS</SectionLabel>
          <EditableTable
            rows={pzRows}
            onUpdate={updPZ}
            addRow={() => updPZ([...pzRows,
              { id: uid(), name: 'New Permit', intervalMonths: 12, costIDR: 0 }])}
            emptyMsg='No permits yet — click Add Row'
            columns={[
              { key: 'name',           label: 'Permit / License',          width: '43%' },
              { key: 'intervalMonths', label: 'Renewal Interval (months)', width: '22%',
                type: 'number', align: 'right' },
              { key: 'costIDR',        label: 'Cost per Renewal (IDR)',    width: '30%',
                type: 'number', align: 'right' },
              { key: '__del',          label: '',                          width: '5%' },
            ]}
          />
        </div>
      </>}

      {/* ── VESSEL TYPES (PTS only) ────────────────────────── */}
      {section === 'vesseltypes' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          The list of vessel classifications offered as a dropdown when adding or editing
          a vessel. These are labels only — they carry no default figures, so changing a
          name here never alters an existing calculation.
        </div>
        <div style={s.card}>
          <SectionLabel>VESSEL TYPES</SectionLabel>
          <EditableTable
            rows={types}
            onUpdate={updTypes}
            addRow={() => updTypes([...types, { id: uid(), name: '' }])}
            emptyMsg='No vessel types yet — click Add Row'
            columns={[
              { key: 'name',  label: 'Type Name', width: '92%',
                placeholder: 'e.g. SPOB, Tanker, OB, Tug & Barge' },
              { key: '__del', label: '',          width: '8%' },
            ]}
          />
          {types.length > 0 && (
            <div style={{ marginTop: 14, fontSize: 10, color: T.textDim }}>
              In use:{' '}
              {types.map((t, i) => {
                const n = vesselsUsingType(t.name);
                return (
                  <span key={t.id || i} style={{ marginRight: 12 }}>
                    <strong style={{ color: n > 0 ? T.amber : T.textFaint }}>
                      {t.name || '(unnamed)'}
                    </strong>
                    <span style={{ color: T.textFaint }}> ×{n}</span>
                  </span>
                );
              })}
            </div>
          )}
          <Notice tone='warn' style={{ marginTop: 14 }}>
            Renaming a type does not update vessels already assigned to the old name —
            they keep the previous text until edited. Deleting a type leaves those
            vessels with a type that is no longer in the dropdown.
          </Notice>
        </div>
      </>}

      {/* ── MAINTENANCE RATES (PTE only) ───────────────────── */}
      {section === 'maintenance' && <>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, lineHeight: 1.7 }}>
          Per-kilometre maintenance rates added to the operating cost of every land trip.
          Distance-based wear applies to trucks only.
        </div>
        <div style={s.card}>
          <SectionLabel>RATES (IDR / KM)</SectionLabel>
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
            <div>
              <label style={s.label}>SERVICE RATE (IDR/km)</label>
              <NumInput value={rates.servicePerKm || 0}
                onChange={v => updRate('servicePerKm', v)} />
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 6 }}>
                PTE reference: Rp 800/km
              </div>
            </div>
            <div>
              <label style={s.label}>TIRE RATE (IDR/km)</label>
              <NumInput value={rates.tirePerKm || 0}
                onChange={v => updRate('tirePerKm', v)} />
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 6 }}>
                PTE reference: Rp 1.300/km
              </div>
            </div>
            <div style={{ ...s.cardInset, display: 'flex', flexDirection: 'column',
              justifyContent: 'center', marginBottom: 0 }}>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5,
                marginBottom: 6 }}>COMBINED RATE</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.amber,
                fontFamily: T.font }}>
                Rp {idr0((+rates.servicePerKm || 0) + (+rates.tirePerKm || 0))}/km
              </div>
            </div>
          </div>
        </div>
      </>}
    </div>
  );
}
