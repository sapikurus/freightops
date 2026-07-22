import { useState, useRef } from 'react';
import { useTheme } from '../App';
import { Hdr, Btn, Inp, Sel, SectionLabel, Notice, Empty } from '../components/UI';
import * as XLSX from 'xlsx';
import { uid, idr0, DEFAULT_TRUCK_MAINTENANCE, calcMaintenanceAnnual } from '../utils';
import { TRUCK_TEMPLATE_B64 } from '../templateData';

function downloadTemplate() {
  const binary = atob(TRUCK_TEMPLATE_B64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'FreightOps_Truck_Import_Template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

const DEF_FORM = {
  licensePlate: '', brand: '', truckType: '', builtYear: '',
  purchasePrice: '', residualValue: '', depreciationYears: 8,
  capacityKL: '',
  consumptionKmPerL: '',
  driverType: 'fulltime',
  driverMonthlyCost: '', driverPremiPerTrip: '',
  insuranceAnnual: '',
  repairBufferPct: 1.5,
  financingMode: 'depreciation',
  monthlyInstallment: '',
  targetTripsPerMonth: 60,
  maintenancePlan: DEFAULT_TRUCK_MAINTENANCE.map(x => ({ ...x })),
  notes: '',
};

export default function Trucks({ db, updateDB }) {
  const { T, s } = useTheme();
  const [view, setView] = useState('list');
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const importRef = useRef(null);
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const trucks = db.trucks || [];

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets['Trucks'];
        const wm = wb.Sheets['Maintenance Plan'];
        if (!ws) { alert('Sheet "Trucks" not found. Please use the official template.'); return; }
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const parsed = [];
        for (let i = 3; i < rows.length; i++) {
          const r = rows[i];
          if (!r[0]) continue;
          parsed.push({
            id: uid(), type: 'truck',
            licensePlate:       String(r[0]).trim().toUpperCase(),
            brand:              r[1]  || '',
            truckType:          r[2]  || '',
            builtYear:          r[3]  || '',
            capacityKL:         +r[4] || 0,
            consumptionKmPerL:  +r[5] || 0,
            driverType: String(r[6]).trim() === 'borongan' ? 'borongan' : 'fulltime',
            driverMonthlyCost:  +r[7] || 0,
            driverPremiPerTrip: +r[8] || 0,
            purchasePrice:      +r[9] || 0,
            residualValue:      +r[10]|| 0,
            depreciationYears:  +r[11]|| 8,
            insuranceAnnual:    +r[12]|| 0,
            repairBufferPct:    +r[13]|| 1.5,
            financingMode: 'depreciation',
            maintenancePlan: DEFAULT_TRUCK_MAINTENANCE.map(x => ({ ...x })),
          });
        }
        if (wm) {
          const mrows = XLSX.utils.sheet_to_json(wm, { header: 1, defval: '' });
          for (let i = 2; i < mrows.length; i++) {
            const r = mrows[i];
            if (!r[0] || !r[1]) continue;
            const t = parsed.find(t => t.licensePlate === String(r[0]).trim().toUpperCase());
            if (t) {
              if (t.maintenancePlan.every(p => p.costIDR === 0)) t.maintenancePlan = [];
              t.maintenancePlan.push({
                type: String(r[1]).trim(), intervalMonths: +r[2] || 12,
                durationDays: +r[3] || 1, costIDR: +r[4] || 0,
              });
            }
          }
        }
        setImportPreview(parsed);
      } catch (err) { alert('Could not parse file: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importPreview) return;
    updateDB(d => ({ ...d, trucks: [...(d.trucks || []), ...importPreview] }));
    const n = importPreview.length;
    setImportPreview(null);
    alert(`Imported ${n} truck${n !== 1 ? 's' : ''}.`);
  };

  const openNew = () => {
    setForm({ ...DEF_FORM, maintenancePlan: DEFAULT_TRUCK_MAINTENANCE.map(x => ({ ...x })) });
    setEditingId(null); setView('form');
  };
  const openEdit = (t) => { setForm({ ...DEF_FORM, ...t }); setEditingId(t.id); setView('form'); };
  const cancelForm = () => { setView('list'); setForm({}); setEditingId(null); };

  const del = (id) => {
    if (!confirm('Delete truck?')) return;
    updateDB(d => ({ ...d, trucks: (d.trucks || []).filter(t => t.id !== id) }));
  };

  const save = () => {
    if (!form.licensePlate?.trim()) { alert('License plate is required'); return; }
    const num = k => +form[k] || 0;
    const record = {
      ...form, type: 'truck',
      licensePlate: form.licensePlate.trim().toUpperCase(),
      purchasePrice: num('purchasePrice'),
      residualValue: num('residualValue'),
      depreciationYears: +form.depreciationYears || 8,
      capacityKL: num('capacityKL'),
      consumptionKmPerL: num('consumptionKmPerL'),
      driverMonthlyCost: num('driverMonthlyCost'),
      driverPremiPerTrip: num('driverPremiPerTrip'),
      insuranceAnnual: num('insuranceAnnual'),
      repairBufferPct: +form.repairBufferPct || 1.5,
      financingMode: form.financingMode || 'depreciation',
      monthlyInstallment: num('monthlyInstallment'),
      targetTripsPerMonth: +form.targetTripsPerMonth || 60,
      maintenancePlan: form.maintenancePlan || [],
      id: editingId || uid(),
    };
    updateDB(d => ({
      ...d,
      trucks: editingId
        ? (d.trucks || []).map(t => t.id === editingId ? record : t)
        : [...(d.trucks || []), record],
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

  // ══ FORM VIEW ═══════════════════════════════════════════════
  if (view === 'form') {
    return (
      <div style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
          <Hdr sub={editingId ? 'Editing existing truck record' : 'Creating a new truck record'}>
            {editingId ? `🚛 EDIT TRUCK — ${form.licensePlate || ''}` : '🚛 NEW TRUCK'}
          </Hdr>
          <Btn variant='ghost' onClick={cancelForm}>← Back to List</Btn>
        </div>

        <div style={s.card}>
          <SectionLabel>TRUCK IDENTITY</SectionLabel>
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            <Inp label='License Plate *' value={form.licensePlate}
              onChange={v => sf('licensePlate', v.toUpperCase())} placeholder='e.g. L 1234 AB' />
            <Inp label='Brand' value={form.brand} onChange={v => sf('brand', v)}
              placeholder='e.g. Hino, Isuzu' />
            <Inp label='Truck Type' value={form.truckType} onChange={v => sf('truckType', v)}
              placeholder='e.g. FM 260 JD Tanker' />
            <Inp label='Built Year' type='number' value={form.builtYear}
              onChange={v => sf('builtYear', v)} />
          </div>
        </div>

        <div style={s.card}>
          <SectionLabel>CAPACITY & FUEL</SectionLabel>
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            <Inp label='Cargo Capacity (KL)' type='number' value={form.capacityKL}
              onChange={v => sf('capacityKL', v)} />
            <Inp label='Fuel Consumption (km/L)' type='number' step='0.1'
              value={form.consumptionKmPerL} onChange={v => sf('consumptionKmPerL', v)}
              hint='Kilometres per litre — higher is more efficient' />
          </div>
        </div>

        <div style={s.card}>
          <SectionLabel>DRIVER ARRANGEMENT</SectionLabel>
          <Sel label='Driver Type' value={form.driverType} onChange={v => sf('driverType', v)}>
            <option value='fulltime'>Full-time Employee (monthly salary)</option>
            <option value='borongan'>Premi Borongan (per trip)</option>
          </Sel>
          {form.driverType === 'fulltime'
            ? <Inp label='Monthly Salary (IDR)' type='number' value={form.driverMonthlyCost}
                onChange={v => sf('driverMonthlyCost', v)}
                hint='Counted as an annual fixed cost' />
            : <Inp label='Premi per Trip (IDR)' type='number' value={form.driverPremiPerTrip}
                onChange={v => sf('driverPremiPerTrip', v)}
                hint='Counted per trip in operating cost, not as fixed salary' />}
        </div>

        <div style={s.card}>
          <SectionLabel>FINANCIALS</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[['depreciation', '📊 Depreciation Model'],
              ['installment',  '🏦 BEP / Installment Mode']].map(([k, l]) => (
              <button key={k} onClick={() => sf('financingMode', k)}
                style={{ flex: 1, minWidth: 200, ...s.btn('ghost'), padding: '10px 12px',
                  borderColor: form.financingMode === k ? T.amber : T.border,
                  color: form.financingMode === k ? T.amber : T.textDim, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 0 }}>
                  {k === 'depreciation'
                    ? 'From purchase price, residual value, useful life'
                    : 'Actual bank installment per month'}
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
              <div style={{ display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
                <Inp label='Monthly Installment (IDR)' type='number'
                  value={form.monthlyInstallment} onChange={v => sf('monthlyInstallment', v)} />
                <Inp label='Target Trips / Month' type='number'
                  value={form.targetTripsPerMonth}
                  onChange={v => sf('targetTripsPerMonth', v)} />
                <div style={{ ...s.cardInset, display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>
                    INSTALLMENT / RIT
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.amber,
                    fontFamily: T.font }}>
                    {form.monthlyInstallment && form.targetTripsPerMonth
                      ? `Rp ${idr0(+form.monthlyInstallment / +form.targetTripsPerMonth)}`
                      : '–'}
                  </div>
                  <div style={{ fontSize: 9, color: T.textDim, marginTop: 4 }}>
                    Reference only — OAT uses actual trips/year
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
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

        <div style={s.card}>
          <SectionLabel>MAINTENANCE PLAN</SectionLabel>
          <Notice tone='info'>
            This plan drives downtime (days lost per year) and the annual maintenance reserve.
            Per-kilometre service and tire rates are set separately in
            Master Data › PTE › Maintenance Rates.
          </Notice>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <thead><tr>
                {['Service Type', 'Interval (months)', 'Duration (days)',
                  'Est. Cost (IDR)', ''].map(h =>
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
            Annualized: <strong style={{ color: T.amber }}>{maintSummary.days} days/year</strong>{' '}
            lost · Reserve:{' '}
            <strong style={{ color: T.amber }}>Rp {idr0(maintSummary.cost)}/year</strong>
          </Notice>
        </div>

        <div style={s.card}>
          <Inp label='Notes (optional)' value={form.notes} onChange={v => sf('notes', v)} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end',
          marginTop: 8, marginBottom: 40 }}>
          <Btn variant='ghost' onClick={cancelForm}>Cancel</Btn>
          <Btn onClick={save}>{editingId ? 'Save Changes' : 'Create Truck'}</Btn>
        </div>
      </div>
    );
  }

  // ══ LIST VIEW ═══════════════════════════════════════════════
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <Hdr sub='PT USI Petrotrans Energi'>🚛 TRUCKS</Hdr>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant='ghost' onClick={downloadTemplate}>↓ Template</Btn>
          <Btn variant='ghost' onClick={() => importRef.current?.click()}>↑ Import Excel</Btn>
          <input ref={importRef} type='file' accept='.xlsx'
            onChange={handleImportFile} style={{ display: 'none' }} />
          <Btn onClick={openNew}>+ Add Truck</Btn>
        </div>
      </div>

      {importPreview && (
        <div style={{ ...s.card, borderColor: `${T.green}55` }}>
          <div style={{ fontSize: 11, color: T.green, fontWeight: 700, marginBottom: 8 }}>
            Preview — {importPreview.length} truck{importPreview.length !== 1 ? 's' : ''} found
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 12 }}>
            {importPreview.map(t => `${t.licensePlate} (${idr0(t.capacityKL)} KL)`).join(' · ')}
          </div>
          <Notice tone='warn'>
            These are appended to the existing list — duplicates are not detected.
          </Notice>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={confirmImport}>✓ Confirm Import</Btn>
            <Btn variant='ghost' onClick={() => setImportPreview(null)}>Cancel</Btn>
          </div>
        </div>
      )}

      {trucks.length === 0 && !importPreview && (
        <Empty>No trucks registered yet — click "+ Add Truck"</Empty>
      )}

      {trucks.length > 0 && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['License Plate', 'Brand / Type', 'Built', 'Cap (KL)',
                  'km/L', 'Driver', 'Financing', 'Buffer %', ''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {trucks.map(t => (
                  <tr key={t.id}>
                    <td style={{ ...s.td, fontWeight: 700, color: T.teal }}>{t.licensePlate}</td>
                    <td style={s.td}>{t.brand} {t.truckType}</td>
                    <td style={s.td}>
                      {t.builtYear || '–'}{' '}
                      <span style={{ color: T.textDim, fontSize: 10 }}>
                        ({assetAge(t.builtYear)})</span>
                    </td>
                    <td style={s.tdNum}>{idr0(t.capacityKL)}</td>
                    <td style={s.tdNum}>{t.consumptionKmPerL || '–'}</td>
                    <td style={s.td}>
                      <span style={{ fontSize: 10,
                        color: t.driverType === 'borongan' ? T.amber : T.green }}>
                        {t.driverType === 'borongan'
                          ? `Premi Rp ${idr0(t.driverPremiPerTrip)}/trip`
                          : `Rp ${idr0(t.driverMonthlyCost)}/mo`}
                      </span>
                    </td>
                    <td style={s.tdNum}>
                      {t.financingMode === 'installment'
                        ? <span style={{ color: T.blue, fontSize: 10 }}>
                            Rp {idr0(t.monthlyInstallment)}/mo</span>
                        : `Rp ${idr0(t.purchasePrice)}`}
                    </td>
                    <td style={s.tdNum}>
                      {t.financingMode === 'installment' ? '–' : `${t.repairBufferPct || 1.5}%`}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn variant='ghost' onClick={() => openEdit(t)}
                          style={{ padding: '3px 10px' }}>Edit</Btn>
                        <Btn variant='ghost' onClick={() => del(t.id)}
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
