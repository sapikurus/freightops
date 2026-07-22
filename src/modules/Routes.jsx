import { useState } from 'react';
import { useTheme } from '../App';
import { Hdr, Btn, Modal, Inp, SectionLabel, Notice, Empty, Badge } from '../components/UI';
import { uid, idr0, LAND_SPEED_KMH } from '../utils';

function nextLandCode(routes) {
  const prefix = 'R-LT-';
  const existing = (routes || [])
    .map(r => parseInt(String(r.code || '').replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return prefix + String(next).padStart(3, '0');
}

const DEF_LAND = {
  name: '', origin: '', destination: '', distanceKm: '',
  loadingHours: 2, unloadingHours: 2, restHours: 0,
  tollFees: '', portalFees: '', otherFees: '', notes: '',
};

export default function Routes({ db, updateDB, mode = 'sea' }) {
  const { T, s } = useTheme();
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({});
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const voyages    = db.voyages    || [];
  const landRoutes = db.landRoutes || [];

  // ══ SEA — voyage geometry library (built in the Calculator) ══
  if (mode === 'sea') {
    const delVoyage = (id) => {
      if (!confirm('Delete this saved voyage geometry?')) return;
      updateDB(d => ({ ...d, voyages: (d.voyages || []).filter(v => v.id !== id) }));
    };

    return (
      <div>
        <Hdr sub='PT USI Petrotrans Samudra'>📍 SEA ROUTES</Hdr>

        <Notice tone='warn'>
          <strong>Under construction.</strong> Sea voyages are multi-leg chains, so they are
          built inside the <strong>PTS › Calculator</strong> where cargo and fuel are entered
          together. Once a voyage is laid out there, "Save Route Geometry" stores its shape —
          loading port, legs, distances, speeds and port fees — and it appears below for reuse.
          <div style={{ marginTop: 8 }}>
            Cargo volumes, aux and heater hours are deliberately not stored, since they change
            with every shipment. A dedicated editor for this page is planned.
          </div>
        </Notice>

        {voyages.length === 0 ? (
          <Empty>
            No saved voyage geometry yet — build a voyage in the Calculator and save it there.
          </Empty>
        ) : (
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Code', 'Name', 'Loading Port', 'Chain', 'Legs',
                    'Total NM', 'Port Fees', 'Saved', ''].map(h =>
                    <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {voyages.map(v => {
                    const legs = v.legs || [];
                    const totalNM = legs.reduce((a, l) => a + (+l.distanceNM || 0), 0);
                    const fees = legs.reduce((a, l) => a + (+l.portFee || 0), 0)
                      + (+v.loadingPortFee || 0);
                    const chain = [v.loadingPort || '?', ...legs.map(l => l.destination || '?')]
                      .join(' → ');
                    const returns = legs.length > 0 &&
                      String(legs[legs.length - 1].destination || '').trim().toLowerCase()
                        === String(v.loadingPort || '').trim().toLowerCase();
                    return (
                      <tr key={v.id}>
                        <td style={{ ...s.td, color: T.amber, fontSize: 10 }}>{v.code}</td>
                        <td style={{ ...s.td, fontWeight: 700 }}>{v.name}</td>
                        <td style={s.td}>{v.loadingPort || '–'}</td>
                        <td style={{ ...s.td, fontSize: 11, color: T.textDim }}>
                          {chain}
                          {!returns && (
                            <div style={{ marginTop: 4 }}>
                              <Badge color={T.red}>DOES NOT RETURN TO BASE</Badge>
                            </div>
                          )}
                        </td>
                        <td style={s.tdNum}>{legs.length}</td>
                        <td style={s.tdNum}>{idr0(totalNM)} NM</td>
                        <td style={s.tdNum}>Rp {idr0(fees)}</td>
                        <td style={{ ...s.td, fontSize: 10, color: T.textDim }}>{v.savedAt}</td>
                        <td style={s.td}>
                          <Btn variant='ghost' onClick={() => delVoyage(v.id)}
                            style={{ padding: '3px 10px', color: T.red }}>Del</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══ LAND — full route library ═══════════════════════════════
  const openNew  = () => { setForm({ ...DEF_LAND, code: nextLandCode(landRoutes) }); setModal('new'); };
  const openEdit = (r) => { setForm({ ...r }); setModal('edit'); };
  const del = (id) => {
    if (!confirm('Delete route?')) return;
    updateDB(d => ({ ...d, landRoutes: (d.landRoutes || []).filter(r => r.id !== id) }));
  };

  const save = () => {
    if (!form.distanceKm || +form.distanceKm <= 0) { alert('Distance is required'); return; }
    const isEdit = modal === 'edit';
    const record = { ...form, type: 'land' };
    ['distanceKm', 'loadingHours', 'unloadingHours', 'restHours',
     'tollFees', 'portalFees', 'otherFees'].forEach(k => { record[k] = +form[k] || 0; });
    if (!record.name?.trim() && record.origin && record.destination) {
      record.name = `${record.origin} → ${record.destination}`;
    }
    if (!isEdit) record.id = uid();
    updateDB(d => ({
      ...d,
      landRoutes: isEdit
        ? (d.landRoutes || []).map(r => r.id === record.id ? record : r)
        : [...(d.landRoutes || []), record],
    }));
    setModal(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <Hdr sub='PT USI Petrotrans Energi'>📍 LAND ROUTES</Hdr>
        <Btn onClick={openNew}>+ Add Route</Btn>
      </div>

      {landRoutes.length === 0 && <Empty>No land routes yet — click "+ Add Route"</Empty>}

      {landRoutes.length > 0 && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Code', 'Route', 'Origin → Destination', 'Distance',
                  'Round Trip Time', 'Per-Trip Fees', ''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {landRoutes.map(r => {
                  const driveH = (+r.distanceKm || 0) * 2 / LAND_SPEED_KMH;
                  const totalH = driveH + (+r.loadingHours || 0)
                    + (+r.unloadingHours || 0) + (+r.restHours || 0);
                  const fees = (+r.tollFees || 0) + (+r.portalFees || 0) + (+r.otherFees || 0);
                  return (
                    <tr key={r.id}>
                      <td style={{ ...s.td, color: T.teal, fontSize: 10 }}>{r.code || '–'}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{r.name}</td>
                      <td style={{ ...s.td, color: T.textDim, fontSize: 11 }}>
                        {r.origin} → {r.destination}
                      </td>
                      <td style={s.tdNum}>{idr0(r.distanceKm)} km</td>
                      <td style={s.tdNum}>{totalH.toFixed(1)} hrs</td>
                      <td style={s.tdNum}>Rp {idr0(fees)}</td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn variant='ghost' onClick={() => openEdit(r)}
                            style={{ padding: '3px 10px' }}>Edit</Btn>
                          <Btn variant='ghost' onClick={() => del(r.id)}
                            style={{ padding: '3px 10px', color: T.red }}>Del</Btn>
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
        <Modal title={modal === 'edit' ? `Edit Route — ${form.name || ''}` : 'New Land Route'}
          onClose={() => setModal(null)} width={560}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <Inp label='Code' value={form.code}
              onChange={v => sf('code', v.toUpperCase())} />
            <Inp label='Route Name (auto-filled if blank)' value={form.name}
              onChange={v => sf('name', v)} placeholder='e.g. Surabaya → Malang' />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Origin' value={form.origin} onChange={v => sf('origin', v)} />
            <Inp label='Destination' value={form.destination}
              onChange={v => sf('destination', v)} />
          </div>

          <SectionLabel>DISTANCE & TIME</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Distance (km, one way)' type='number' value={form.distanceKm}
              onChange={v => sf('distanceKm', v)} />
            <Inp label='Loading Time (hours)' type='number' value={form.loadingHours}
              onChange={v => sf('loadingHours', v)} />
            <Inp label='Unloading Time (hours)' type='number' value={form.unloadingHours}
              onChange={v => sf('unloadingHours', v)} />
            <Inp label='Rest / Break (hours)' type='number' value={form.restHours}
              onChange={v => sf('restHours', v)} />
          </div>
          <Notice tone='good'>
            Average speed fixed at {LAND_SPEED_KMH} km/h — safety standard, not adjustable.
            Round trip distance is applied automatically.
          </Notice>

          <SectionLabel>PER-TRIP FEES</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Toll Fees (IDR/trip)' type='number' value={form.tollFees}
              onChange={v => sf('tollFees', v)} />
            <Inp label='Portal Fees / Uang Jalan (IDR/trip)' type='number'
              value={form.portalFees} onChange={v => sf('portalFees', v)}
              hint='Named line item — never folded into other costs' />
            <Inp label='Other Fees (IDR/trip)' type='number' value={form.otherFees}
              onChange={v => sf('otherFees', v)} />
          </div>

          <Inp label='Notes (optional)' value={form.notes} onChange={v => sf('notes', v)} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant='ghost' onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save Route</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
