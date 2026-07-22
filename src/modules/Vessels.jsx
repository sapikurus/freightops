import { useState, useRef } from 'react';
import { useTheme } from '../App';
import { Hdr, Btn, Badge, Inp, Sel, SectionLabel, Notice, Empty } from '../components/UI';
import { uid, idr0, DEFAULT_VESSEL_MAINTENANCE, calcMaintenanceAnnual } from '../utils';
import * as XLSX from 'xlsx';
import { VESSEL_TEMPLATE_B64 } from '../templateData';

function downloadTemplate() {
  const binary = atob(VESSEL_TEMPLATE_B64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'FreightOps_Vessel_Import_Template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

const DEF_FORM = {
  name: '', imoNumber: '', vesselType: '', builtYear: '', flag: 'Indonesia',
  purchasePrice: '', residualValue: '', depreciationYears: 8,
  capacityKL: '',
  engineType: '',
  consumptionLperHour: '',        // MAIN engine, L/hr at standard RPM
  auxConsumptionLperHour: '',     // AUX engine, L/hr
  heaterConsumptionLperHour: '',  // EXTRA HEATER, L/hr
  rpmCoefficients: { low: 0.75, standard: 1.0, high: 1.3 },
  crewCount: '', crewMonthlyCost: '', crewPremiPerTrip: '',
  insuranceAnnual: '',
  repairBufferPct: 1.5,
  financingMode: 'depreciation',
  monthlyInstallment: '',
  maintenancePlan: DEFAULT_VESSEL_MAINTENANCE.map(x => ({ ...x })),
  notes: '',
};

export default function Vessels({ db, updateDB }) {
  const { T, s } = useTheme();
  const [view, setView] = useState('list');   // 'list' | 'form'
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const importRef = useRef(null);
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const vessels     = db.vessels || [];
  const vesselTypes = db.vesselTypes || [];

  // ── Excel import ────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets['Vessels'];
        const wm = wb.Sheets['Maintenance Plan'];
        if (!ws) { alert('Sheet "Vessels" not found. Please use the official template.'); return; }

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const parsed = [];
        for (let i = 3; i < rows.length; i++) {
          const r = rows[i];
          if (!r[0]) continue;
          parsed.push({
            id: uid(), type: 'vessel',
            name:                r[0]  || '',
            imoNumber:           r[1]  || '',
            builtYear:           r[2]  || '',
            flag:                r[3]  || 'Indonesia',
            capacityKL:          +r[4] || 0,
            engineType:          r[5]  || '',
            consumptionLperHour: +r[6] || 0,
            rpmCoefficients: { low: +r[7]||0.75, standard: +r[8]||1.0, high: +r[9]||1.3 },
            crewCount:           +r[10]|| 0,
            crewMonthlyCost:     +r[11]|| 0,
            crewPremiPerTrip:    +r[12]|| 0,
            purchasePrice:       +r[13]|| 0,
            residualValue:       +r[14]|| 0,
            depreciationYears:   +r[15]|| 8,
            insuranceAnnual:     +r[16]|| 0,
            repairBufferPct:     +r[17]|| 1.5,
            notes:               r[18] || '',
            // Template predates 3-engine model — default to 0, edit after import.
            auxConsumptionLperHour: 0,
            heaterConsumptionLperHour: 0,
            vesselType: '',
            financingMode: 'depreciation',
            maintenancePlan: DEFAULT_VESSEL_MAINTENANCE.map(x => ({ ...x })),
          });
        }

        if (wm) {
          const mrows = XLSX.utils.sheet_to_json(wm, { header: 1, defval: '' });
          for (let i = 2; i < mrows.length; i++) {
            const r = mrows[i];
            if (!r[0] || !r[1]) continue;
            const v = parsed.find(v => v.name === String(r[0]).trim());
            if (v) {
              if (v.maintenancePlan.every(p => p.costIDR === 0)) v.maintenancePlan = [];
              v.maintenancePlan.push({
                type: String(r[1]).trim(), intervalMonths: +r[2] || 12,
                durationDays: +r[3] || 1,  costIDR: +r[4] || 0,
              });
            }
          }
        }
        setImportPreview(parsed);
      } catch (err) {
        alert('Could not parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importPreview) return;
    updateDB(d => ({ ...d, vessels: [...(d.vessels || []), ...importPreview] }));
    const n = importPreview.length;
    setImportPreview(null);
    alert(`Imported ${n} vessel${n !== 1 ? 's' : ''}. Aux engine and heater rates default to 0 — edit each vessel to set them.`);
  };

  // ── Navigation ──────────────────────────────────────────────
  const openNew = () => {
    setForm({ ...DEF_FORM, maintenancePlan: DEFAULT_VESSEL_MAINTENANCE.map(x => ({ ...x })) });
    setEditingId(null);
    setView('form');
  };
  const openEdit = (v) => {
    setForm({ ...DEF_FORM, ...v });
    setEditingId(v.id);
    setView('form');
  };
  const cancelForm = () => { setView('list'); setForm({}); setEditingId(null); };

  const del = (id) => {
    if (!confirm('Delete vessel?')) return;
    updateDB(d => ({ ...d, vessels: (d.vessels || []).filter(v => v.id !== id) }));
  };

  const save = () => {
    if (!form.name?.trim()) { alert('Vessel name is required'); return; }
    const num = k => +form[k] || 0;
    const record = {
      ...form, type: 'vessel',
      name: form.name.trim(),
      purchasePrice: num('purchasePrice'),
      residualValue: num('residualValue'),
      depreciationYears: +form.depreciationYears || 8,
      capacityKL: num('capacityKL'),
      consumptionLperHour:       num('consumptionLperHour'),
      auxConsumptionLperHour:    num('auxConsumptionLperHour'),
      heaterConsumptionLperHour: num('heaterConsumptionLperHour'),
      crewCount: num('crewCount'),
      crewMonthlyCost: num('crewMonthlyCost'),
      crewPremiPerTrip: num('crewPremiPerTrip'),
      insuranceAnnual: num('insuranceAnnual'),
      repairBufferPct: +form.repairBufferPct || 1.5,
      monthlyInstallment: num('monthlyInstallment'),
      financingMode: form.financingMode || 'depreciation',
      maintenancePlan: form.maintenancePlan || [],
      id: editingId || uid(),
    };
    updateDB(d => ({
      ...d,
      vessels: editingId
        ? (d.vessels || []).map(v => v.id === editingId ? record : v)
        : [...(d.vessels || []), record],
    }));
    cancelForm();
  };

  const updateMaintRow = (i, k, v) => {
    const plan = [...(form.maintenancePlan || [])];
    plan[i] = { ...plan[i], [k]: k === 'type' ? v : (+v || 0) };
    sf('maintenancePlan', plan);
  };
  const addMaintRow = () => sf('maintenancePlan',
    [...(form.maintenancePlan || []), { type: 'New Service', intervalMonths: 12, durationDays: 1, costIDR: 0 }]);
  const delMaintRow = (i) => sf('maintenancePlan',
    (form.maintenancePlan || []).filter((_, j) => j !== i));

  const maintSummary = calcMaintenanceAnnual(form.maintenancePlan || []);
  const assetAge = (y) => !y ? '–' : `${new Date().getFullYear() - +y} yrs`;

  const totalConsumption = (+form.consumptionLperHour || 0)
    + (+form.auxConsumptionLperHour || 0) + (+form.heaterConsumptionLperHour || 0);

  // ══ FORM VIEW ═══════════════════════════════════════════════
  if (view === 'form') {
    return (
      <div style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
          <Hdr sub={editingId ? 'Editing existing vessel record' : 'Creating a new vessel record'}>
            {editingId ? `⛴ EDIT VESSEL — ${form.name || ''}` : '⛴ NEW VESSEL'}
          </Hdr>
          <Btn variant='ghost' onClick={cancelForm}>← Back to List</Btn>
        </div>

        {/* IDENTITY */}
        <div style={s.card}>
          <SectionLabel>VESSEL IDENTITY</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            <Inp label='Vessel Name *' value={form.name} onChange={v => sf('name', v)}
              placeholder='e.g. SPOB A' />
            <Sel label='Vessel Type' value={form.vesselType} onChange={v => sf('vesselType', v)}
              hint={vesselTypes.length === 0
                ? 'No types defined — add them in Master Data › PTS › Vessel Types'
                : undefined}>
              <option value=''>— Select type —</option>
              {vesselTypes.map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </Sel>
            <Inp label='IMO Number (optional)' value={form.imoNumber}
              onChange={v => sf('imoNumber', v)} />
            <Inp label='Built Year' type='number' value={form.builtYear}
              onChange={v => sf('builtYear', v)} />
            <Inp label='Flag' value={form.flag} onChange={v => sf('flag', v)} />
            <Inp label='Cargo Capacity (KL)' type='number' value={form.capacityKL}
              onChange={v => sf('capacityKL', v)} />
          </div>
        </div>

        {/* ENGINES */}
        <div style={s.card}>
          <SectionLabel>ENGINES & FUEL CONSUMPTION</SectionLabel>
          <Notice tone='info'>
            Three separate consumption rates. <strong>Main engine</strong> burns while sailing and is
            the only one affected by the RPM setting. <strong>Aux engine</strong> and{' '}
            <strong>extra heater</strong> are billed by hours entered per leg in the calculator —
            leave at 0 if the vessel has none.
          </Notice>

          <Inp label='Engine Type / Model' value={form.engineType}
            onChange={v => sf('engineType', v)} placeholder='e.g. MAN B&W 6S50ME' />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
            <div style={{ ...s.cardInset, borderColor: `${T.amber}55` }}>
              <div style={{ fontSize: 9, color: T.amber, letterSpacing: 1.5,
                fontWeight: 700, marginBottom: 8 }}>⚙ MAIN ENGINE</div>
              <Inp label='Consumption (L/hour)' type='number' step='0.1'
                value={form.consumptionLperHour}
                onChange={v => sf('consumptionLperHour', v)} />
              <div style={{ fontSize: 9, color: T.textDim, marginTop: -6 }}>
                At standard RPM. Scaled by RPM coefficient.
              </div>
            </div>

            <div style={{ ...s.cardInset, borderColor: `${T.blue}55` }}>
              <div style={{ fontSize: 9, color: T.blue, letterSpacing: 1.5,
                fontWeight: 700, marginBottom: 8 }}>⚡ AUX ENGINE</div>
              <Inp label='Consumption (L/hour)' type='number' step='0.1'
                value={form.auxConsumptionLperHour}
                onChange={v => sf('auxConsumptionLperHour', v)} />
              <div style={{ fontSize: 9, color: T.textDim, marginTop: -6 }}>
                Optional. Hours entered per leg. Not RPM-scaled.
              </div>
            </div>

            <div style={{ ...s.cardInset, borderColor: `${T.red}55` }}>
              <div style={{ fontSize: 9, color: T.red, letterSpacing: 1.5,
                fontWeight: 700, marginBottom: 8 }}>🔥 EXTRA HEATER</div>
              <Inp label='Consumption (L/hour)' type='number' step='0.1'
                value={form.heaterConsumptionLperHour}
                onChange={v => sf('heaterConsumptionLperHour', v)} />
              <div style={{ fontSize: 9, color: T.textDim, marginTop: -6 }}>
                Optional. Hours entered per leg. Not RPM-scaled.
              </div>
            </div>
          </div>

          {totalConsumption > 0 && (
            <div style={{ ...s.cardInset, marginTop: 4, marginBottom: 0 }}>
              <span style={{ fontSize: 10, color: T.textDim }}>
                Combined maximum burn (all three running):{' '}
              </span>
              <strong style={{ color: T.amber, fontSize: 13 }}>
                {idr0(totalConsumption)} L/hour
              </strong>
            </div>
          )}

          <SectionLabel>RPM COEFFICIENTS — MAIN ENGINE ONLY</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {['low', 'standard', 'high'].map(k => (
              <div key={k}>
                <label style={{ ...s.label,
                  color: k === 'low' ? T.blue : k === 'high' ? T.red : T.green }}>
                  {k.toUpperCase()}
                </label>
                <input type='number' step='0.01'
                  value={form.rpmCoefficients?.[k] ??
                    (k === 'standard' ? 1.0 : k === 'low' ? 0.75 : 1.3)}
                  onChange={e => sf('rpmCoefficients',
                    { ...form.rpmCoefficients, [k]: +e.target.value })}
                  style={s.input} />
              </div>
            ))}
          </div>
        </div>

        {/* CREW */}
        <div style={s.card}>
          <SectionLabel>CREW</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            <Inp label='Number of Crew' type='number' value={form.crewCount}
              onChange={v => sf('crewCount', v)} />
            <Inp label='Total Crew Cost (IDR/month)' type='number' value={form.crewMonthlyCost}
              onChange={v => sf('crewMonthlyCost', v)} />
            <Inp label='Crew Premi per Voyage (IDR)' type='number' value={form.crewPremiPerTrip}
              onChange={v => sf('crewPremiPerTrip', v)} />
          </div>
        </div>

        {/* FINANCIALS */}
        <div style={s.card}>
          <SectionLabel>FINANCIALS</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[['depreciation', '📊 Depreciation Model'],
              ['installment',  '🏦 Installment / BEP Mode']].map(([k, l]) => (
              <button key={k} onClick={() => sf('financingMode', k)}
                style={{ flex: 1, minWidth: 200, ...s.btn('ghost'), padding: '10px 12px',
                  borderColor: form.financingMode === k ? T.amber : T.border,
                  color: form.financingMode === k ? T.amber : T.textDim,
                  textAlign: 'left' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 0 }}>
                  {k === 'depreciation'
                    ? 'From purchase price, residual value, useful life'
                    : 'Actual bank installment (incl. insurance + depreciation)'}
                </div>
              </button>
            ))}
          </div>

          {form.financingMode === 'installment' ? (
            <>
              <Notice tone='warn'>
                In installment mode, insurance and repair buffer are treated as already
                bundled inside the installment and are not added again.
              </Notice>
              <Inp label='Monthly Installment (IDR)' type='number'
                value={form.monthlyInstallment} onChange={v => sf('monthlyInstallment', v)} />
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
              <Inp label='Purchase Price (IDR)' type='number' value={form.purchasePrice}
                onChange={v => sf('purchasePrice', v)} />
              <Inp label='Residual Value (IDR)' type='number' value={form.residualValue}
                onChange={v => sf('residualValue', v)} />
              <Inp label='Depreciation Years' type='number' value={form.depreciationYears}
                onChange={v => sf('depreciationYears', v)} />
              <Inp label='Insurance (IDR/year)' type='number' value={form.insuranceAnnual}
                onChange={v => sf('insuranceAnnual', v)} />
              <Inp label='Repair Buffer (% of purchase/yr)' type='number' step='0.1'
                value={form.repairBufferPct} onChange={v => sf('repairBufferPct', v)} />
            </div>
          )}
        </div>

        {/* MAINTENANCE */}
        <div style={s.card}>
          <SectionLabel>MAINTENANCE PLAN</SectionLabel>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <thead><tr>
                {['Service Type', 'Interval (months)', 'Duration (days)', 'Est. Cost (IDR)', ''].map(h =>
                  <th key={h} style={{ ...s.th, fontSize: 9 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {(form.maintenancePlan || []).map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...s.td, padding: '5px 8px' }}>
                      <input value={row.type}
                        onChange={e => updateMaintRow(i, 'type', e.target.value)}
                        style={{ ...s.input, marginBottom: 0 }} /></td>
                    <td style={{ ...s.td, padding: '5px 8px' }}>
                      <input type='number' value={row.intervalMonths}
                        onChange={e => updateMaintRow(i, 'intervalMonths', e.target.value)}
                        style={{ ...s.input, marginBottom: 0, textAlign: 'right' }} /></td>
                    <td style={{ ...s.td, padding: '5px 8px' }}>
                      <input type='number' value={row.durationDays}
                        onChange={e => updateMaintRow(i, 'durationDays', e.target.value)}
                        style={{ ...s.input, marginBottom: 0, textAlign: 'right' }} /></td>
                    <td style={{ ...s.td, padding: '5px 8px' }}>
                      <input type='number' value={row.costIDR}
                        onChange={e => updateMaintRow(i, 'costIDR', e.target.value)}
                        style={{ ...s.input, marginBottom: 0, textAlign: 'right' }} /></td>
                    <td style={{ ...s.td, padding: '5px 8px' }}>
                      <button onClick={() => delMaintRow(i)}
                        style={{ background: 'none', border: 'none', color: T.red,
                          cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Btn variant='ghost' onClick={addMaintRow}
            style={{ fontSize: 10, padding: '4px 14px' }}>+ Add Row</Btn>

          <Notice tone='warn' style={{ marginTop: 12 }}>
            Annualized: <strong style={{ color: T.amber }}>{maintSummary.days} days/year</strong> lost
            to maintenance · Reserve:{' '}
            <strong style={{ color: T.amber }}>Rp {idr0(maintSummary.cost)}/year</strong>
          </Notice>
        </div>

        <div style={s.card}>
          <Inp label='Notes (optional)' value={form.notes} onChange={v => sf('notes', v)} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end',
          marginTop: 8, marginBottom: 40 }}>
          <Btn variant='ghost' onClick={cancelForm}>Cancel</Btn>
          <Btn onClick={save}>{editingId ? 'Save Changes' : 'Create Vessel'}</Btn>
        </div>
      </div>
    );
  }

  // ══ LIST VIEW ═══════════════════════════════════════════════
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <Hdr sub='PT USI Petrotrans Samudra'>⛴ VESSELS</Hdr>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant='ghost' onClick={downloadTemplate}>↓ Template</Btn>
          <Btn variant='ghost' onClick={() => importRef.current?.click()}>↑ Import Excel</Btn>
          <input ref={importRef} type='file' accept='.xlsx'
            onChange={handleImportFile} style={{ display: 'none' }} />
          <Btn onClick={openNew}>+ Add Vessel</Btn>
        </div>
      </div>

      {importPreview && (
        <div style={{ ...s.card, borderColor: `${T.green}55` }}>
          <div style={{ fontSize: 11, color: T.green, fontWeight: 700, marginBottom: 8 }}>
            Preview — {importPreview.length} vessel{importPreview.length !== 1 ? 's' : ''} found
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 12 }}>
            {importPreview.map(v => `${v.name} (${idr0(v.capacityKL)} KL)`).join(' · ')}
          </div>
          <Notice tone='warn'>
            These are appended to the existing list — duplicates are not detected.
            Aux engine and heater consumption default to 0 and must be set per vessel afterward.
          </Notice>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={confirmImport}>✓ Confirm Import</Btn>
            <Btn variant='ghost' onClick={() => setImportPreview(null)}>Cancel</Btn>
          </div>
        </div>
      )}

      {vessels.length === 0 && !importPreview && (
        <Empty>No vessels registered yet — click "+ Add Vessel"</Empty>
      )}

      {vessels.length > 0 && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Vessel Name', 'Type', 'Built', 'Cap (KL)', 'Crew',
                  'Main L/hr', 'Aux L/hr', 'Heater L/hr', 'Purchase Price', ''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {vessels.map(v => (
                  <tr key={v.id}>
                    <td style={{ ...s.td, fontWeight: 700, color: T.amber }}>{v.name}</td>
                    <td style={s.td}>
                      {v.vesselType ? <Badge>{v.vesselType}</Badge>
                        : <span style={{ color: T.textFaint, fontSize: 10 }}>—</span>}
                    </td>
                    <td style={s.td}>
                      {v.builtYear || '–'}{' '}
                      <span style={{ color: T.textDim, fontSize: 10 }}>({assetAge(v.builtYear)})</span>
                    </td>
                    <td style={s.tdNum}>{idr0(v.capacityKL)}</td>
                    <td style={s.tdNum}>{v.crewCount || '–'}</td>
                    <td style={{ ...s.tdNum, color: T.amber }}>{v.consumptionLperHour || '–'}</td>
                    <td style={{ ...s.tdNum, color: v.auxConsumptionLperHour ? T.blue : T.textFaint }}>
                      {v.auxConsumptionLperHour || '–'}</td>
                    <td style={{ ...s.tdNum, color: v.heaterConsumptionLperHour ? T.red : T.textFaint }}>
                      {v.heaterConsumptionLperHour || '–'}</td>
                    <td style={s.tdNum}>
                      {v.financingMode === 'installment'
                        ? <span style={{ color: T.blue, fontSize: 10 }}>
                            Rp {idr0(v.monthlyInstallment)}/mo</span>
                        : `Rp ${idr0(v.purchasePrice)}`}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn variant='ghost' onClick={() => openEdit(v)}
                          style={{ padding: '3px 10px' }}>Edit</Btn>
                        <Btn variant='ghost' onClick={() => del(v.id)}
                          style={{ padding: '3px 10px', color: T.red }}>Del</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
