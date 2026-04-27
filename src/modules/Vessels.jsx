import { useState } from 'react';
import { T, s } from '../tokens';
import { Hdr, Btn, Badge, Modal, Inp, Sel, SectionLabel, Divider } from '../components/UI';
import { uid, idr0, DEFAULT_VESSEL_MAINTENANCE, calcMaintenanceAnnual } from '../utils';

const DEF_FORM = {
  name: '', imoNumber: '', builtYear: '', flag: 'Indonesia',
  purchasePrice: '', residualValue: '', depreciationYears: 8,
  capacityKL: '',
  engineType: '', consumptionLperHour: '',
  rpmCoefficients: { low: 0.75, standard: 1.0, high: 1.3 },
  crewCount: '', crewMonthlyCost: '', crewPremiPerTrip: '',
  insuranceAnnual: '',
  repairBufferPct: 1.5,
  maintenancePlan: DEFAULT_VESSEL_MAINTENANCE.map(x => ({ ...x })),
  notes: '',
};

export default function Vessels({ db, updateDB }) {
  const [modal, setModal] = useState(null);
  const [form,  setForm]  = useState({});
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const vessels = db.vessels || [];

  const openNew  = () => { setForm({ ...DEF_FORM, maintenancePlan: DEFAULT_VESSEL_MAINTENANCE.map(x=>({...x})) }); setModal('new'); };
  const openEdit = (v) => { setForm({ ...v }); setModal('edit'); };
  const del      = (id) => { if (!confirm('Delete vessel?')) return; updateDB(d => ({ ...d, vessels: d.vessels.filter(v => v.id !== id) })); };

  const save = () => {
    if (!form.name?.trim()) { alert('Vessel name required'); return; }
    const isEdit = modal === 'edit';
    const record = { ...form, type: 'vessel',
      purchasePrice: +form.purchasePrice || 0,
      residualValue: +form.residualValue || 0,
      depreciationYears: +form.depreciationYears || 8,
      capacityKL: +form.capacityKL || 0,
      consumptionLperHour: +form.consumptionLperHour || 0,
      crewCount: +form.crewCount || 0,
      crewMonthlyCost: +form.crewMonthlyCost || 0,
      crewPremiPerTrip: +form.crewPremiPerTrip || 0,
      insuranceAnnual: +form.insuranceAnnual || 0,
      repairBufferPct: +form.repairBufferPct || 1.5,
      maintenancePlan: form.maintenancePlan || [],
    };
    if (!isEdit) record.id = uid();
    updateDB(d => ({
      ...d,
      vessels: isEdit
        ? d.vessels.map(v => v.id === record.id ? record : v)
        : [...d.vessels, record],
    }));
    setModal(null);
  };

  const updateMaintRow = (i, k, v) => {
    const plan = [...(form.maintenancePlan || [])];
    plan[i] = { ...plan[i], [k]: k === 'type' ? v : (+v || 0) };
    sf('maintenancePlan', plan);
  };

  const maintSummary = calcMaintenanceAnnual(form.maintenancePlan || []);

  // ── Asset age helper ────────────────────────────────────────
  const assetAge = (builtYear) => {
    if (!builtYear) return '–';
    return `${new Date().getFullYear() - +builtYear} yrs`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <Hdr>⛴ VESSELS — PT USI Petrotrans Samudra</Hdr>
        <Btn onClick={openNew}>+ Add Vessel</Btn>
      </div>

      {vessels.length === 0 && (
        <div style={{ color: T.textDim, textAlign: 'center', marginTop: 60, fontSize: 13 }}>
          No vessels registered yet
        </div>
      )}

      {vessels.length > 0 && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Vessel Name','IMO','Built','Cap (KL)','Crew','Consumption (L/hr)','Purchase Price','Repair Buffer %',''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {vessels.map(v => {
                  const maint = calcMaintenanceAnnual(v.maintenancePlan || []);
                  return (
                    <tr key={v.id}>
                      <td style={{ ...s.td, fontWeight: 700, color: T.amber }}>{v.name}</td>
                      <td style={{ ...s.td, color: T.textDim, fontSize: 10 }}>{v.imoNumber || '–'}</td>
                      <td style={s.td}>{v.builtYear || '–'} <span style={{ color: T.textDim, fontSize: 10 }}>({assetAge(v.builtYear)})</span></td>
                      <td style={s.tdNum}>{idr0(v.capacityKL)} KL</td>
                      <td style={s.tdNum}>{v.crewCount || '–'} crew</td>
                      <td style={s.tdNum}>{v.consumptionLperHour || '–'} L/hr</td>
                      <td style={s.tdNum}>Rp {idr0(v.purchasePrice)}</td>
                      <td style={s.tdNum}>{v.repairBufferPct || 1.5}%</td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn variant='ghost' onClick={() => openEdit(v)} style={{ padding: '3px 10px' }}>Edit</Btn>
                          <Btn variant='ghost' onClick={() => del(v.id)} style={{ padding: '3px 10px', color: T.red }}>Del</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'edit' ? `Edit: ${form.name}` : 'New Vessel'} onClose={() => setModal(null)} width={600}>
          <SectionLabel>VESSEL IDENTITY</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Vessel Name' value={form.name} onChange={v => sf('name', v)} />
            <Inp label='IMO Number (optional)' value={form.imoNumber} onChange={v => sf('imoNumber', v)} />
            <Inp label='Built Year' type='number' value={form.builtYear} onChange={v => sf('builtYear', v)} />
            <Inp label='Flag' value={form.flag} onChange={v => sf('flag', v)} />
          </div>

          <SectionLabel>CAPACITY & ENGINE</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Cargo Capacity (KL)' type='number' value={form.capacityKL} onChange={v => sf('capacityKL', v)} />
            <Inp label='Engine Type' value={form.engineType} onChange={v => sf('engineType', v)} placeholder='e.g. MAN B&W 6S50ME' />
            <Inp label='Fuel Consumption at Std RPM (L/hour)' type='number' value={form.consumptionLperHour} onChange={v => sf('consumptionLperHour', v)} />
          </div>
          <div style={{ ...s.card, padding: 12, marginTop: 4 }}>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8 }}>RPM COEFFICIENTS (fuel multiplier vs standard)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {['low','standard','high'].map(k => (
                <div key={k}>
                  <label style={{ ...s.label, color: k === 'low' ? T.blue : k === 'high' ? T.red : T.green }}>
                    {k.toUpperCase()}
                  </label>
                  <input type='number' step='0.01'
                    value={form.rpmCoefficients?.[k] ?? (k === 'standard' ? 1.0 : k === 'low' ? 0.75 : 1.3)}
                    onChange={e => sf('rpmCoefficients', { ...form.rpmCoefficients, [k]: +e.target.value })}
                    style={{ ...s.input, width: '100%' }} />
                </div>
              ))}
            </div>
          </div>

          <SectionLabel>CREW</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Inp label='Number of Crew' type='number' value={form.crewCount} onChange={v => sf('crewCount', v)} />
            <Inp label='Total Crew Monthly Cost (IDR)' type='number' value={form.crewMonthlyCost} onChange={v => sf('crewMonthlyCost', v)} />
            <Inp label='Crew Premi per Trip (IDR)' type='number' value={form.crewPremiPerTrip} onChange={v => sf('crewPremiPerTrip', v)} />
          </div>

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
                  <td style={s.td}>
                    <input value={row.type} onChange={e => updateMaintRow(i,'type',e.target.value)}
                      style={{ ...s.input, marginBottom: 0 }} />
                  </td>
                  <td style={s.td}>
                    <input type='number' value={row.intervalMonths} onChange={e => updateMaintRow(i,'intervalMonths',e.target.value)}
                      style={{ ...s.input, marginBottom: 0 }} />
                  </td>
                  <td style={s.td}>
                    <input type='number' value={row.durationDays} onChange={e => updateMaintRow(i,'durationDays',e.target.value)}
                      style={{ ...s.input, marginBottom: 0 }} />
                  </td>
                  <td style={s.td}>
                    <input type='number' value={row.costIDR} onChange={e => updateMaintRow(i,'costIDR',e.target.value)}
                      style={{ ...s.input, marginBottom: 0 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: T.textDim, background: '#0d141c',
            borderRadius: 4, padding: '8px 12px', marginBottom: 16 }}>
            Auto-calculated: <strong style={{ color: T.amber }}>{maintSummary.days} days/year</strong> lost to maintenance ·
            Reserve: <strong style={{ color: T.amber }}>Rp {idr0(maintSummary.cost)}/year</strong>
          </div>

          <Inp label='Notes (optional)' value={form.notes} onChange={v => sf('notes', v)} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant='ghost' onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save Vessel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
