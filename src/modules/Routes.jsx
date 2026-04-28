import { useState } from 'react';
import { T, s } from '../tokens';
import { Hdr, Btn, Modal, Inp, Sel, SectionLabel, Badge } from '../components/UI';
import { uid, idr0 } from '../utils';

// Auto-generate route code: R-SEA-001, R-LT-001
export function nextRouteCode(routes, type) {
  const prefix = type === 'sea' ? 'R-SEA-' : 'R-LT-';
  const existing = (routes || [])
    .filter(r => r.type === type && r.routeCode?.startsWith(prefix))
    .map(r => parseInt(r.routeCode.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return prefix + String(next).padStart(3, '0');
}

const DEF_SEA = {
  type: 'sea', name: '', origin: '', destination: '',
  distanceNM: '', speedKnots: 8,
  loadingHours: 4, unloadingHours: 4, portWaitingHours: 2,
  portFeeOrigin: '', portFeeDestination: '',
  otherFees: '', notes: '',
};

const DEF_LAND = {
  type: 'land', name: '', origin: '', destination: '',
  distanceKm: '',
  loadingHours: 2, unloadingHours: 2, restHours: 0,
  tollFees: '', portalFees: '', otherFees: '',
  notes: '',
};

export default function Routes({ db, updateDB }) {
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState({});
  const [typeFilter, setTypeFilter] = useState('all');
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const routes = db.routes || [];

  const openNew  = (type) => {
    const routeCode = nextRouteCode(routes, type);
    setForm(type === 'sea'
      ? { ...DEF_SEA, routeCode }
      : { ...DEF_LAND, routeCode });
    setModal('new');
  };
  const openEdit = (r) => { setForm({ ...r }); setModal('edit'); };
  const del      = (id) => { if (!confirm('Delete route?')) return; updateDB(d => ({ ...d, routes: d.routes.filter(r => r.id !== id) })); };

  const save = () => {
    if (!form.routeCode?.trim()) { alert('Route code required'); return; }
    const isEdit = modal === 'edit';
    const numFields = form.type === 'sea'
      ? ['distanceNM','speedKnots','loadingHours','unloadingHours','portWaitingHours','portFeeOrigin','portFeeDestination','otherFees']
      : ['distanceKm','loadingHours','unloadingHours','restHours','tollFees','portalFees','otherFees'];
    const record = { ...form };
    // Auto-fill name if blank
    if (!record.name?.trim() && record.origin && record.destination) {
      record.name = `${record.origin} → ${record.destination}`;
    }
    numFields.forEach(k => { record[k] = +form[k] || 0; });
    if (!isEdit) record.id = uid();
    updateDB(d => ({
      ...d,
      routes: isEdit
        ? d.routes.map(r => r.id === record.id ? record : r)
        : [...d.routes, record],
    }));
    setModal(null);
  };

  const filtered = typeFilter === 'all' ? routes : routes.filter(r => r.type === typeFilter);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <Hdr>📍 ROUTES</Hdr>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant='ghost' onClick={() => openNew('sea')} style={{ borderColor: T.amber, color: T.amber }}>+ Sea Route</Btn>
          <Btn variant='ghost' onClick={() => openNew('land')} style={{ borderColor: T.teal, color: T.teal }}>+ Land Route</Btn>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['all','All'],['sea','⛵ Sea'],['land','🛣 Land']].map(([k,l]) => (
          <button key={k} onClick={() => setTypeFilter(k)} style={{
            ...s.btn('ghost'),
            borderColor: typeFilter === k ? T.amber : T.border,
            color: typeFilter === k ? T.amber : T.textDim,
            fontSize: 10,
          }}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ color: T.textDim, textAlign: 'center', marginTop: 60, fontSize: 13 }}>
          No routes yet
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['','Code','Route Name','Origin → Dest','Distance','Voyage Time (est.)','Per-Trip Fees',''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const isSea = r.type === 'sea';
                  const sailH  = isSea ? (+r.distanceNM * 2 / (+r.speedKnots || 8)) : (+r.distanceKm * 2 / 30);
                  const totalH = sailH + (+r.loadingHours || 0) + (+r.unloadingHours || 0) +
                    (isSea ? (+r.portWaitingHours || 0) : (+r.restHours || 0));
                  const fees = isSea
                    ? (+r.portFeeOrigin || 0) + (+r.portFeeDestination || 0) + (+r.otherFees || 0)
                    : (+r.tollFees || 0) + (+r.portalFees || 0) + (+r.otherFees || 0);
                  return (
                    <tr key={r.id}>
                      <td style={{ ...s.td }}>
                        <Badge color={isSea ? T.amber : T.teal}>{isSea ? 'SEA' : 'LAND'}</Badge>
                      </td>
                      <td style={{ ...s.td, fontFamily: T.font, fontSize: 10, color: T.amber }}>
                        {r.routeCode || '–'}
                      </td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{r.name}</td>
                      <td style={{ ...s.td, color: T.textDim, fontSize: 11 }}>{r.origin} → {r.destination}</td>
                      <td style={s.tdNum}>{isSea ? `${r.distanceNM} NM` : `${r.distanceKm} km`}</td>
                      <td style={s.tdNum}>{totalH.toFixed(1)} hrs</td>
                      <td style={s.tdNum}>Rp {idr0(fees)}</td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn variant='ghost' onClick={() => openEdit(r)} style={{ padding: '3px 10px' }}>Edit</Btn>
                          <Btn variant='ghost' onClick={() => del(r.id)} style={{ padding: '3px 10px', color: T.red }}>Del</Btn>
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
        <Modal title={`${modal === 'edit' ? 'Edit' : 'New'} ${form.type === 'sea' ? 'Sea' : 'Land'} Route`}
          onClose={() => setModal(null)} width={540}>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 4 }}>
            <div>
              <label style={s.label}>ROUTE CODE (AUTO)</label>
              <input value={form.routeCode || ''} onChange={e => sf('routeCode', e.target.value.toUpperCase())}
                style={{ ...s.input }} />
            </div>
            <Inp label='Route Name (optional — auto-filled from origin → dest if blank)'
              value={form.name} onChange={v => sf('name', v)} placeholder='e.g. Samarinda → JMSE' />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Origin' value={form.origin} onChange={v => sf('origin', v)} />
            <Inp label='Destination' value={form.destination} onChange={v => sf('destination', v)} />
          </div>

          {form.type === 'sea' ? <>
            <SectionLabel>SEA PARAMETERS</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Inp label='Distance (nautical miles, one way)' type='number' value={form.distanceNM} onChange={v => sf('distanceNM', v)} />
              <Inp label='Speed at standard RPM (knots)' type='number' value={form.speedKnots} onChange={v => sf('speedKnots', v)} />
              <Inp label='Loading Time (hours)' type='number' value={form.loadingHours} onChange={v => sf('loadingHours', v)} />
              <Inp label='Unloading Time (hours)' type='number' value={form.unloadingHours} onChange={v => sf('unloadingHours', v)} />
              <Inp label='Port Waiting / Demurrage Allowance (hours)' type='number' value={form.portWaitingHours} onChange={v => sf('portWaitingHours', v)} />
            </div>
            <SectionLabel>PER-TRIP FEES</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Inp label='Port Fee — Origin (IDR/trip)' type='number' value={form.portFeeOrigin} onChange={v => sf('portFeeOrigin', v)} />
              <Inp label='Port Fee — Destination (IDR/trip)' type='number' value={form.portFeeDestination} onChange={v => sf('portFeeDestination', v)} />
              <Inp label='Other Fees (IDR/trip)' type='number' value={form.otherFees} onChange={v => sf('otherFees', v)} />
            </div>
          </> : <>
            <SectionLabel>LAND PARAMETERS</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Inp label='Distance (km, one way)' type='number' value={form.distanceKm} onChange={v => sf('distanceKm', v)} />
              <div style={{ ...s.card, padding: '10px 12px', marginBottom: 0, background: '#0d1c14' }}>
                <div style={{ fontSize: 10, color: T.green }}>AVG SPEED FIXED AT 30 KM/H</div>
                <div style={{ fontSize: 9, color: T.textDim, marginTop: 4 }}>Safety standard — not adjustable</div>
              </div>
              <Inp label='Loading Time (hours)' type='number' value={form.loadingHours} onChange={v => sf('loadingHours', v)} />
              <Inp label='Unloading Time (hours)' type='number' value={form.unloadingHours} onChange={v => sf('unloadingHours', v)} />
              <Inp label='Rest / Break Time (hours)' type='number' value={form.restHours} onChange={v => sf('restHours', v)} />
            </div>
            <SectionLabel>PER-TRIP FEES</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Inp label='Toll Fees (IDR/trip)' type='number' value={form.tollFees} onChange={v => sf('tollFees', v)} />
              <Inp label='Portal Fees (Uang Jalan) (IDR/trip)' type='number' value={form.portalFees} onChange={v => sf('portalFees', v)} />
              <Inp label='Other Fees (IDR/trip)' type='number' value={form.otherFees} onChange={v => sf('otherFees', v)} />
            </div>
          </>}

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
