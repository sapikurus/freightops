import { useState, useRef } from 'react';
import { T as DARK, makeStyles } from '../tokens';
import { useTheme } from '../App';
import { Hdr, Btn, Modal, Inp, Sel, SectionLabel } from '../components/UI';
import * as XLSX from 'xlsx';
import { uid, idr0, DEFAULT_TRUCK_MAINTENANCE, calcMaintenanceAnnual } from '../utils';
import { TRUCK_TEMPLATE_B64 } from '../templateData';

function downloadTemplate() {
  const binary = atob(TRUCK_TEMPLATE_B64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
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
  const [modal, setModal] = useState(null);
  const [form,  setForm]  = useState({});
  const [importPreview, setImportPreview] = useState(null);
  const importRef = useRef(null);
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets['Trucks'];
        const wm = wb.Sheets['Maintenance Plan'];
        if (!ws) { alert('❌ Sheet "Trucks" not found. Please use the official template.'); return; }
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const trucks = [];
        for (let i = 3; i < rows.length; i++) {
          const r = rows[i];
          if (!r[0]) continue;
          const t = {
            id: uid(), type: 'truck',
            licensePlate:       String(r[0]).trim().toUpperCase(),
            brand:              r[1]  || '',
            truckType:          r[2]  || '',
            builtYear:          r[3]  || '',
            capacityKL:         +r[4] || 0,
            consumptionKmPerL:  +r[5] || 0,
            driverType:         String(r[6]).trim() === 'borongan' ? 'borongan' : 'fulltime',
            driverMonthlyCost:  +r[7] || 0,
            driverPremiPerTrip: +r[8] || 0,
            purchasePrice:      +r[9] || 0,
            residualValue:      +r[10]|| 0,
            depreciationYears:  +r[11]|| 8,
            insuranceAnnual:    +r[12]|| 0,
            repairBufferPct:    +r[13]|| 1.5,
            maintenancePlan:    DEFAULT_TRUCK_MAINTENANCE.map(x => ({ ...x })),
          };
          trucks.push(t);
        }
        if (wm) {
          const mrows = XLSX.utils.sheet_to_json(wm, { header: 1, defval: '' });
          for (let i = 2; i < mrows.length; i++) {
            const r = mrows[i];
            if (!r[0] || !r[1]) continue;
            const plate = String(r[0]).trim().toUpperCase();
            const t = trucks.find(t => t.licensePlate === plate);
            if (t) {
              if (t.maintenancePlan.every(p => p.costIDR === 0)) t.maintenancePlan = [];
              t.maintenancePlan.push({
                type: String(r[1]).trim(), intervalMonths: +r[2]||12,
                durationDays: +r[3]||1, costIDR: +r[4]||0,
              });
            }
          }
        }
        setImportPreview(trucks);
      } catch(err) { alert('❌ Could not parse file: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importPreview) return;
    updateDB(d => ({ ...d, trucks: [...d.trucks, ...importPreview] }));
    setImportPreview(null);
    alert(`✅ Imported ${importPreview.length} truck${importPreview.length !== 1 ? 's' : ''} successfully.`);
  };

  const trucks = db.trucks || [];

  const openNew  = () => { setForm({ ...DEF_FORM, maintenancePlan: DEFAULT_TRUCK_MAINTENANCE.map(x=>({...x})) }); setModal('new'); };
  const openEdit = (t) => { setForm({ ...t }); setModal('edit'); };
  const del      = (id) => { if (!confirm('Delete truck?')) return; updateDB(d => ({ ...d, trucks: d.trucks.filter(t => t.id !== id) })); };

  const save = () => {
    if (!form.licensePlate?.trim()) { alert('License plate required'); return; }
    const isEdit = modal === 'edit';
    const record = { ...form, type: 'truck',
      purchasePrice: +form.purchasePrice || 0,
      residualValue: +form.residualValue || 0,
      depreciationYears: +form.depreciationYears || 8,
      capacityKL: +form.capacityKL || 0,
      consumptionKmPerL: +form.consumptionKmPerL || 0,
      driverMonthlyCost: +form.driverMonthlyCost || 0,
      driverPremiPerTrip: +form.driverPremiPerTrip || 0,
      insuranceAnnual: +form.insuranceAnnual || 0,
      repairBufferPct: +form.repairBufferPct || 1.5,
      financingMode: form.financingMode || 'depreciation',
      monthlyInstallment: +form.monthlyInstallment || 0,
      targetTripsPerMonth: +form.targetTripsPerMonth || 60,
    };
    if (!isEdit) record.id = uid();
    updateDB(d => ({
      ...d,
      trucks: isEdit
        ? d.trucks.map(t => t.id === record.id ? record : t)
        : [...d.trucks, record],
    }));
    setModal(null);
  };

  const updateMaintRow = (i, k, v) => {
    const plan = [...(form.maintenancePlan || [])];
    plan[i] = { ...plan[i], [k]: k === 'type' ? v : (+v || 0) };
    sf('maintenancePlan', plan);
  };

  const maintSummary = calcMaintenanceAnnual(form.maintenancePlan || []);
  const assetAge = (yr) => !yr ? '–' : `${new Date().getFullYear() - +yr} yrs`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <Hdr>🚛 TRUCKS — PT USI Petrotrans Energi</Hdr>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant='ghost' onClick={downloadTemplate} style={{ fontSize: 10 }}>↓ Template</Btn>
          <Btn variant='ghost' onClick={() => importRef.current?.click()}>↑ Import Excel</Btn>
          <input ref={importRef} type='file' accept='.xlsx' onChange={handleImportFile} style={{ display:'none' }} />
          <Btn onClick={openNew}>+ Add Truck</Btn>
        </div>
      </div>
      {importPreview && (
        <div style={{ ...s.card, borderColor: `${T.green}44`, background: '#0d1c14', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.green, fontWeight: 700, marginBottom: 8 }}>
            ⚠ Preview — {importPreview.length} truck{importPreview.length !== 1 ? 's' : ''} found
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 12 }}>
            {importPreview.map(t => `${t.licensePlate} (${t.capacityKL} KL)`).join(' · ')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={confirmImport} style={{ background: '#0d5a2a', borderColor: T.green }}>✓ Confirm Import</Btn>
            <Btn variant='ghost' onClick={() => setImportPreview(null)}>Cancel</Btn>
          </div>
        </div>
      )}

      {trucks.length === 0 && (
        <div style={{ color: T.textDim, textAlign: 'center', marginTop: 60, fontSize: 13 }}>
          No trucks registered yet
        </div>
      )}

      {trucks.length > 0 && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['License Plate','Brand / Type','Built','Cap (KL)','Consumption (km/L)','Driver','Purchase Price','Buffer %',''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {trucks.map(t => (
                  <tr key={t.id}>
                    <td style={{ ...s.td, fontWeight: 700, color: T.teal }}>{t.licensePlate}</td>
                    <td style={s.td}>{t.brand} {t.truckType}</td>
                    <td style={s.td}>{t.builtYear || '–'} <span style={{ color: T.textDim, fontSize: 10 }}>({assetAge(t.builtYear)})</span></td>
                    <td style={s.tdNum}>{idr0(t.capacityKL)} KL</td>
                    <td style={s.tdNum}>{t.consumptionKmPerL || '–'} km/L</td>
                    <td style={s.td}>
                      <span style={{ fontSize: 10, color: t.driverType === 'borongan' ? T.amber : T.green }}>
                        {t.driverType === 'borongan' ? `Premi Rp ${idr0(t.driverPremiPerTrip)}/trip` : `Rp ${idr0(t.driverMonthlyCost)}/mo`}
                      </span>
                    </td>
                    <td style={s.tdNum}>Rp {idr0(t.purchasePrice)}</td>
                    <td style={s.tdNum}>{t.repairBufferPct || 1.5}%</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn variant='ghost' onClick={() => openEdit(t)} style={{ padding: '3px 10px' }}>Edit</Btn>
                        <Btn variant='ghost' onClick={() => del(t.id)} style={{ padding: '3px 10px', color: T.red }}>Del</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'edit' ? `Edit: ${form.licensePlate}` : 'New Truck'} onClose={() => setModal(null)} width={580}>
          <SectionLabel>TRUCK IDENTITY</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='License Plate' value={form.licensePlate} onChange={v => sf('licensePlate', v.toUpperCase())} />
            <Inp label='Brand' value={form.brand} onChange={v => sf('brand', v)} placeholder='e.g. Hino, Isuzu, Mercedes' />
            <Inp label='Truck Type' value={form.truckType} onChange={v => sf('truckType', v)} placeholder='e.g. FM 260 JD Tanker' />
            <Inp label='Built Year' type='number' value={form.builtYear} onChange={v => sf('builtYear', v)} />
          </div>

          <SectionLabel>CAPACITY & FUEL</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Cargo Capacity (KL)' type='number' value={form.capacityKL} onChange={v => sf('capacityKL', v)} />
            <Inp label='Fuel Consumption (km/L)' type='number' step='0.1' value={form.consumptionKmPerL} onChange={v => sf('consumptionKmPerL', v)} />
          </div>

          <SectionLabel>DRIVER ARRANGEMENT</SectionLabel>
          <Sel label='Driver Type' value={form.driverType} onChange={v => sf('driverType', v)}>
            <option value='fulltime'>Full-time Employee</option>
            <option value='borongan'>Premi Borongan (per trip)</option>
          </Sel>
          {form.driverType === 'fulltime'
            ? <Inp label='Monthly Salary (IDR)' type='number' value={form.driverMonthlyCost} onChange={v => sf('driverMonthlyCost', v)} />
            : <Inp label='Premi per Trip (IDR)' type='number' value={form.driverPremiPerTrip} onChange={v => sf('driverPremiPerTrip', v)} />
          }

          <SectionLabel>FINANCIALS & FINANCING MODE</SectionLabel>
          {/* Financing mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['depreciation','📊 Depreciation Model'],['installment','🏦 BEP / Installment Mode']].map(([k,l]) => (
              <button key={k} onClick={() => sf('financingMode', k)}
                style={{ flex: 1, ...s.btn('ghost'), padding: '10px 12px',
                  borderColor: form.financingMode === k ? T.amber : T.border,
                  color:       form.financingMode === k ? T.amber : T.textDim,
                  textAlign: 'left' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 9, color: T.textDim }}>
                  {k === 'depreciation'
                    ? 'Calculate from purchase price, residual value, interest'
                    : 'Enter actual monthly bank installment (incl. insurance + depreciation)'}
                </div>
              </button>
            ))}
          </div>

          {form.financingMode === 'installment' ? (
            <div style={{ ...s.card, background: T.bg, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.amber, marginBottom: 12 }}>
                BEP MODE — Enter the actual monthly installment from bank (Angsuran/bulan incl. asuransi + penyusutan)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Inp label='Monthly Installment / Angsuran (IDR)' type='number'
                  value={form.monthlyInstallment} onChange={v => sf('monthlyInstallment', v)} />
                <Inp label='Target Trips / Month' type='number'
                  value={form.targetTripsPerMonth} onChange={v => sf('targetTripsPerMonth', v)} />
                <div style={{ ...s.card, padding: '10px 12px', marginBottom: 0 }}>
                  <div style={{ fontSize: 9, color: T.textDim, marginBottom: 4 }}>INSTALLMENT / RIT</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.amber, fontFamily: T.font }}>
                    {form.monthlyInstallment && form.targetTripsPerMonth
                      ? `Rp ${idr0(+form.monthlyInstallment / +form.targetTripsPerMonth)}`
                      : '–'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Inp label='Purchase Price (IDR)' type='number' value={form.purchasePrice} onChange={v => sf('purchasePrice', v)} />
              <Inp label='Residual Value (IDR)' type='number' value={form.residualValue} onChange={v => sf('residualValue', v)} />
              <Inp label='Depreciation Years' type='number' value={form.depreciationYears} onChange={v => sf('depreciationYears', v)} />
              <Inp label='Insurance Annual (IDR)' type='number' value={form.insuranceAnnual} onChange={v => sf('insuranceAnnual', v)} />
              <Inp label='Repair Buffer %' type='number' step='0.1' value={form.repairBufferPct} onChange={v => sf('repairBufferPct', v)} />
            </div>
          )}

          <SectionLabel>MAINTENANCE PLAN</SectionLabel>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
            <thead><tr>
              {['Service Type','Interval (months)','Duration (days)','Est. Cost (IDR)'].map(h =>
                <th key={h} style={{ ...s.th, fontSize: 9 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(form.maintenancePlan || []).map((row, i) => (
                <tr key={i}>
                  <td style={s.td}><input value={row.type} onChange={e => updateMaintRow(i,'type',e.target.value)} style={{ ...s.input, marginBottom: 0 }} /></td>
                  <td style={s.td}><input type='number' value={row.intervalMonths} onChange={e => updateMaintRow(i,'intervalMonths',e.target.value)} style={{ ...s.input, marginBottom: 0 }} /></td>
                  <td style={s.td}><input type='number' value={row.durationDays} onChange={e => updateMaintRow(i,'durationDays',e.target.value)} style={{ ...s.input, marginBottom: 0 }} /></td>
                  <td style={s.td}><input type='number' value={row.costIDR} onChange={e => updateMaintRow(i,'costIDR',e.target.value)} style={{ ...s.input, marginBottom: 0 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: T.textDim, background: '#0d141c', borderRadius: 4, padding: '8px 12px', marginBottom: 16 }}>
            Auto-calculated: <strong style={{ color: T.teal }}>{maintSummary.days} days/year</strong> lost ·
            Reserve: <strong style={{ color: T.teal }}>Rp {idr0(maintSummary.cost)}/year</strong>
          </div>

          <Inp label='Notes (optional)' value={form.notes} onChange={v => sf('notes', v)} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant='ghost' onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save Truck</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
