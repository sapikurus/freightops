import { useState } from 'react';
import { T, s } from '../tokens';
import { Hdr, Btn, Modal, Inp, Sel, SectionLabel } from '../components/UI';
import { uid, idr0, DEFAULT_TRUCK_MAINTENANCE, calcMaintenanceAnnual } from '../utils';

const DEF_FORM = {
  licensePlate: '', brand: '', truckType: '', builtYear: '',
  purchasePrice: '', residualValue: '', depreciationYears: 8,
  capacityKL: '',
  consumptionLperKm: '',
  driverType: 'fulltime',
  driverMonthlyCost: '', driverPremiPerTrip: '',
  insuranceAnnual: '',
  repairBufferPct: 1.5,
  maintenancePlan: DEFAULT_TRUCK_MAINTENANCE.map(x => ({ ...x })),
  notes: '',
};

export default function Trucks({ db, updateDB }) {
  const [modal, setModal] = useState(null);
  const [form,  setForm]  = useState({});
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
      consumptionLperKm: +form.consumptionLperKm || 0,
      driverMonthlyCost: +form.driverMonthlyCost || 0,
      driverPremiPerTrip: +form.driverPremiPerTrip || 0,
      insuranceAnnual: +form.insuranceAnnual || 0,
      repairBufferPct: +form.repairBufferPct || 1.5,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <Hdr>🚛 TRUCKS — PT USI Petrotrans Energi</Hdr>
        <Btn onClick={openNew}>+ Add Truck</Btn>
      </div>

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
                {['License Plate','Brand / Type','Built','Cap (KL)','Consumption','Driver','Purchase Price','Buffer %',''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {trucks.map(t => (
                  <tr key={t.id}>
                    <td style={{ ...s.td, fontWeight: 700, color: T.teal }}>{t.licensePlate}</td>
                    <td style={s.td}>{t.brand} {t.truckType}</td>
                    <td style={s.td}>{t.builtYear || '–'} <span style={{ color: T.textDim, fontSize: 10 }}>({assetAge(t.builtYear)})</span></td>
                    <td style={s.tdNum}>{idr0(t.capacityKL)} KL</td>
                    <td style={s.tdNum}>{t.consumptionLperKm || '–'} L/km</td>
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
            <Inp label='Fuel Consumption (L/km)' type='number' step='0.01' value={form.consumptionLperKm} onChange={v => sf('consumptionLperKm', v)} />
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

          <SectionLabel>FINANCIALS</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Inp label='Purchase Price (IDR)' type='number' value={form.purchasePrice} onChange={v => sf('purchasePrice', v)} />
            <Inp label='Residual Value (IDR)' type='number' value={form.residualValue} onChange={v => sf('residualValue', v)} />
            <Inp label='Depreciation Years' type='number' value={form.depreciationYears} onChange={v => sf('depreciationYears', v)} />
            <Inp label='Insurance Annual (IDR)' type='number' value={form.insuranceAnnual} onChange={v => sf('insuranceAnnual', v)} />
            <Inp label='Repair Buffer %' type='number' step='0.1' value={form.repairBufferPct} onChange={v => sf('repairBufferPct', v)} />
          </div>

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
