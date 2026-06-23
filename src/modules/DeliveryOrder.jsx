import { useState } from 'react';
import { useTheme } from '../App';
import { Hdr, Btn, Inp, Sel, SectionLabel, Modal } from '../components/UI';
import { uid, todayStr } from '../utils';
import { USI_LOGO_B64 } from '../logoData';

// ── Roman numeral months ───────────────────────────────────────
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const ID_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];
const ID_DAYS   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function formatDateID(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${ID_DAYS[d.getDay()]}, ${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function romanMonth(dateStr) {
  if (!dateStr) return 'I';
  return ROMAN[new Date(dateStr + 'T00:00:00').getMonth()];
}

function shortYear(dateStr) {
  if (!dateStr) return '26';
  return String(new Date(dateStr + 'T00:00:00').getFullYear()).slice(-2);
}

// ── Number to Indonesian words ─────────────────────────────────
function terbilang(n) {
  const satuan = ['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan',
                  'Sepuluh','Sebelas'];
  if (n === 0) return 'Nol';
  if (n < 0)   return 'Minus ' + terbilang(-n);
  if (n < 12)  return satuan[n];
  if (n < 20)  return satuan[n - 10] + ' Belas';
  if (n < 100) return satuan[Math.floor(n/10)] + ' Puluh' + (n%10 ? ' ' + satuan[n%10] : '');
  if (n < 200) return 'Seratus' + (n%100 ? ' ' + terbilang(n%100) : '');
  if (n < 1000) return satuan[Math.floor(n/100)] + ' Ratus' + (n%100 ? ' ' + terbilang(n%100) : '');
  if (n < 2000) return 'Seribu' + (n%1000 ? ' ' + terbilang(n%1000) : '');
  if (n < 1000000) return terbilang(Math.floor(n/1000)) + ' Ribu' + (n%1000 ? ' ' + terbilang(n%1000) : '');
  if (n < 1000000000) return terbilang(Math.floor(n/1000000)) + ' Juta' + (n%1000000 ? ' ' + terbilang(n%1000000) : '');
  return terbilang(Math.floor(n/1000000000)) + ' Miliar' + (n%1000000000 ? ' ' + terbilang(n%1000000000) : '');
}

// ── Empty form ─────────────────────────────────────────────────
const EMPTY_DO = {
  entity:        'USI',     // USI | PPS
  doNumber:      '',
  date:          todayStr(),
  city:          'SBY',
  soldTo:        '',
  shipToName:    '',
  shipToAddress: '',
  shipToCity:    '',
  shipToZip:     '',
  qtyOrder:      '',
  fuelType:      'BIOSOLAR B40',
  qtyReceived:   '',
  deliveredBy:   '',
  temperature:   '',
  density:       '',
  flashPoint:    '',
  waterContent:  '',
  startHour:     '',
  finishHour:    '',
  startFlowmeter:'',
  finishFlowmeter:'',
  signerName:    'NICO',
  refPONumber:   '',
  notes:         '',
};

// ── DO number generator ────────────────────────────────────────
function generateDONumber(dos, form) {
  const seq = (dos || []).length + 1;
  const seqStr = String(seq).padStart(7, '0');
  const entity = form.entity || 'USI';
  const city   = form.city   || 'SBY';
  const rm     = romanMonth(form.date);
  const yr     = shortYear(form.date);
  // Format: FT-0000001/USI-SBY/DO/III/26
  return `FT-${seqStr}/${entity}-${city}/DO/${rm}/${yr}`;
}

// ── PDF generator ──────────────────────────────────────────────
function printDO(form) {
  const vol = parseInt(form.qtyOrder || 0, 10);
  const tb  = vol > 0 ? terbilang(vol) + ' Liter' : '';

  // Company header per entity
  const isUSI   = form.entity === 'USI';
  const companyName = isUSI
    ? 'PT UNITED SHIPPING INDONESIA'
    : 'PT PETROPRIMA SEJAHTERA';
  const companyAddr = isUSI
    ? 'Jl. Cimanuk No. 3B, Surabaya 60241<br>Telp: (031) 5677xxx'
    : 'Jl. Contoh No. 1, Jakarta<br>Telp: (021) 5555xxx';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Bunker Delivery Note — ${form.doNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
  body { font-size: 11pt; color: #000; background: #fff; padding: 15mm 18mm; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px; }
  .header img { height: 50px; object-fit: contain; }
  .header-center { text-align: center; flex: 1; }
  .title { font-size: 16pt; font-weight: 900; text-decoration: underline; letter-spacing: 1px; }
  .docnum { font-size: 9pt; color: #333; margin-top: 4px; }
  table.main { width: 100%; border-collapse: collapse; margin-top: 14px; }
  table.main td { border: 1px solid #999; padding: 6px 10px; vertical-align: top; }
  table.main td.lbl { width: 130px; font-weight: 600; background: #f4f4f4; white-space: nowrap; }
  table.main td.val { font-weight: 700; }
  table.main td.qty { font-weight: 700; font-size: 12pt; }
  .start-finish { width: 100%; border-collapse: collapse; margin-top: 0; }
  .start-finish th { background: #222; color: #fff; text-align: center; padding: 5px; font-size: 10pt; border: 1px solid #999; }
  .start-finish td { border: 1px solid #999; padding: 7px 10px; }
  .start-finish td.sf-lbl { font-weight: 600; width: 120px; }
  table.specs { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.specs td { border: 1px solid #999; padding: 6px 10px; }
  table.specs td.sp-lbl { background: #f4f4f4; width: 110px; font-weight: 600; }
  .sig-section { display: flex; justify-content: space-between; margin-top: 24px; }
  .sig-block { text-align: center; width: 30%; }
  .sig-block .sig-name { font-weight: 700; font-size: 10pt; }
  .sig-block .sig-line { border-top: 1px solid #000; margin-top: 48px; padding-top: 4px; font-size: 9pt; }
  .notes-box { border: 1px solid #999; padding: 10px 14px; min-height: 60px; margin-top: 16px; font-size: 10pt; }
  @page { margin: 10mm 15mm; size: A4; }
  @media print { body { padding: 0; } }
</style></head><body>

<!-- HEADER -->
<div class="header">
  <img src="${USI_LOGO_B64}" alt="logo" />
  <div class="header-center">
    <div class="title">BUNKER DELIVERY NOTE</div>
    <div class="docnum">${form.doNumber || '—'}</div>
  </div>
  <div style="width:80px; text-align:right; font-size:9pt; color:#555;">
    ${companyName}<br><span style="font-size:8pt">${companyAddr}</span>
  </div>
</div>

<!-- MAIN TABLE -->
<table class="main">
  <tr>
    <td class="lbl">SOLD TO</td>
    <td class="val" colspan="3"><strong>${form.soldTo || '—'}</strong></td>
  </tr>
  <tr>
    <td class="lbl">SHIP TO</td>
    <td colspan="3">
      ${form.shipToName || '—'}<br>
      ${form.shipToAddress || ''}<br>
      ${[form.shipToCity, form.shipToZip].filter(Boolean).join(', ')}
    </td>
  </tr>
  <tr>
    <td class="lbl">QTY ORDER</td>
    <td class="qty" colspan="3">
      <strong>${vol > 0 ? vol.toLocaleString('id-ID') : '—'} Liter</strong>
      ${tb ? `<span style="font-weight:400; font-size:10pt"> (${tb})</span>` : ''}
    </td>
  </tr>
  <tr>
    <td class="lbl">DELIVERED by</td>
    <td colspan="3">${form.deliveredBy || '—'}</td>
  </tr>
  <tr>
    <td class="lbl">DELIVERY Date</td>
    <td colspan="3">${formatDateID(form.date)}</td>
  </tr>
  <tr>
    <td class="lbl" style="padding:0; border-right:none;"></td>
    <td colspan="3" style="padding:0; border-left:none;">
      <table class="start-finish">
        <thead>
          <tr><th colspan="2">START</th><th colspan="2">FINISH</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="sf-lbl">HOUR:</td>
            <td style="width:80px">${form.startHour || ''}</td>
            <td class="sf-lbl">HOUR:</td>
            <td>${form.finishHour || ''}</td>
          </tr>
          <tr>
            <td class="sf-lbl">FLOWMETER:</td>
            <td>${form.startFlowmeter || ''}</td>
            <td class="sf-lbl">FLOWMETER:</td>
            <td>${form.finishFlowmeter || ''}</td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>
</table>

<!-- SPECS TABLE -->
<table class="specs" style="margin-top:10px;">
  <tr>
    <td class="sp-lbl">Fuel Type</td>
    <td><strong>${form.fuelType || '—'}</strong></td>
    <td class="sp-lbl">QTY RECEIVED</td>
    <td style="text-align:right; font-weight:700;">
      ${form.qtyReceived ? (+form.qtyReceived).toLocaleString('id-ID') : ''}&nbsp;&nbsp;LITER
    </td>
  </tr>
  <tr>
    <td class="sp-lbl">Temperature</td>
    <td>${form.temperature || ''}&nbsp;&nbsp;C</td>
    <td class="sp-lbl">Density</td>
    <td>${form.density || ''}</td>
  </tr>
  <tr>
    <td class="sp-lbl">Flash Point</td>
    <td>${form.flashPoint || ''}</td>
    <td class="sp-lbl">Water Content</td>
    <td>${form.waterContent || ''}</td>
  </tr>
</table>

<!-- SIGNATURES -->
<div class="sig-section">
  <div class="sig-block">
    <div class="sig-name">${companyName}</div>
    <div class="sig-line">${form.signerName || ''}</div>
  </div>
  <div class="sig-block">
    <div class="sig-name">CLIENT</div>
    <div class="sig-line">................................</div>
  </div>
  <div class="sig-block">
    <div class="sig-name">BUNKER VESSEL</div>
    <div class="sig-line">................................</div>
  </div>
</div>

<!-- NOTES -->
<div style="font-weight:700; font-size:10pt; margin-top:16px;">NOTES</div>
<div class="notes-box">
  ${form.refPONumber ? `Reference PO Number: ${form.refPONumber}<br>` : ''}
  ${form.notes || ''}
</div>

</body></html>`;

  const w = window.open('', '_blank', 'width=820,height=1000');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── Main component ─────────────────────────────────────────────
export default function DeliveryOrder({ db, updateDB }) {
  const { T, s } = useTheme();
  const dos = db.deliveryOrders || [];

  const [modal, setModal]   = useState(null); // null | 'new' | 'edit'
  const [form,  setForm]    = useState({ ...EMPTY_DO });
  const [filter, setFilter] = useState('all');
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    const fresh = { ...EMPTY_DO, date: todayStr() };
    fresh.doNumber = generateDONumber(dos, fresh);
    setForm(fresh);
    setModal('new');
  };

  const openEdit = (d) => { setForm({ ...d }); setModal('edit'); };

  const save = () => {
    const isEdit = modal === 'edit';
    const record = { ...form, id: isEdit ? form.id : uid(), createdAt: isEdit ? form.createdAt : todayStr() };
    updateDB(d => ({
      ...d,
      deliveryOrders: isEdit
        ? (d.deliveryOrders || []).map(x => x.id === record.id ? record : x)
        : [...(d.deliveryOrders || []), record],
    }));
    setModal(null);
  };

  const del = (id) => {
    if (!confirm('Delete this Delivery Order?')) return;
    updateDB(d => ({ ...d, deliveryOrders: (d.deliveryOrders || []).filter(x => x.id !== id) }));
  };

  const filtered = filter === 'all' ? dos : dos.filter(d => d.entity === filter);

  const StatusBadge = ({ entity }) => (
    <span style={{ fontSize: 9, fontFamily: T.font, letterSpacing: 1, padding: '2px 8px',
      borderRadius: 3, background: entity === 'USI' ? `${T.blue}22` : `${T.amber}22`,
      color: entity === 'USI' ? T.blue : T.amber,
      border: `1px solid ${entity === 'USI' ? T.blue : T.amber}44` }}>
      {entity}
    </span>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <Hdr>📄 DELIVERY ORDERS — Bunker Delivery Note</Hdr>
        <Btn onClick={openNew}>+ New DO</Btn>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['all','All'],['USI','USI'],['PPS','PPS']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            ...s.btn('ghost'), padding: '6px 14px', fontSize: 10,
            borderColor: filter === k ? T.amber : T.border,
            color: filter === k ? T.amber : T.textDim,
          }}>{l}</button>
        ))}
      </div>

      {dos.length === 0 && (
        <div style={{ color: T.textDim, textAlign: 'center', marginTop: 60, fontSize: 13 }}>
          No Delivery Orders yet — click "+ New DO" to create one
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['','DO Number','Date','Sold To','Fuel Type','Qty Order','Qty Received','Delivered By',''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[...filtered].reverse().map(d => (
                  <tr key={d.id}>
                    <td style={s.td}><StatusBadge entity={d.entity} /></td>
                    <td style={{ ...s.td, fontFamily: T.font, fontSize: 11, fontWeight: 700, color: T.amber }}>
                      {d.doNumber}
                    </td>
                    <td style={{ ...s.td, fontSize: 11, color: T.textDim }}>{formatDateID(d.date)}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{d.soldTo}</td>
                    <td style={s.td}>{d.fuelType}</td>
                    <td style={s.tdNum}>{d.qtyOrder ? (+d.qtyOrder).toLocaleString('id-ID') + ' L' : '—'}</td>
                    <td style={s.tdNum}>{d.qtyReceived ? (+d.qtyReceived).toLocaleString('id-ID') + ' L' : '—'}</td>
                    <td style={{ ...s.td, fontSize: 11, color: T.textDim }}>{d.deliveredBy}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn variant='ghost' onClick={() => printDO(d)}
                          style={{ padding: '3px 10px', fontSize: 9, color: T.teal }}>Print</Btn>
                        <Btn variant='ghost' onClick={() => openEdit(d)}
                          style={{ padding: '3px 10px' }}>Edit</Btn>
                        <Btn variant='ghost' onClick={() => del(d.id)}
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

      {/* Modal */}
      {modal && (
        <Modal title={modal === 'edit' ? `Edit DO: ${form.doNumber}` : 'New Delivery Order'}
          onClose={() => setModal(null)} width={640}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={s.label}>ENTITY</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['USI','PPS'].map(k => (
                  <button key={k} onClick={() => {
                    sf('entity', k);
                    sf('doNumber', generateDONumber(dos, { ...form, entity: k }));
                  }} style={{
                    ...s.btn('ghost'), flex: 1, padding: '8px',
                    borderColor: form.entity === k ? T.amber : T.border,
                    color: form.entity === k ? T.amber : T.textDim, fontWeight: form.entity === k ? 700 : 400,
                  }}>{k}</button>
                ))}
              </div>
            </div>
            <Inp label='Date' type='date' value={form.date} onChange={v => {
              sf('date', v);
              sf('doNumber', generateDONumber(dos, { ...form, date: v }));
            }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
            <Inp label='DO Number' value={form.doNumber} onChange={v => sf('doNumber', v)} />
            <Inp label='City Code' value={form.city} onChange={v => {
              sf('city', v.toUpperCase());
              sf('doNumber', generateDONumber(dos, { ...form, city: v.toUpperCase() }));
            }} placeholder='SBY' />
          </div>

          <SectionLabel>CLIENT</SectionLabel>
          <Inp label='Sold To (Company Name)' value={form.soldTo} onChange={v => sf('soldTo', v)} />
          <Inp label='Ship To — Company / Factory Name' value={form.shipToName} onChange={v => sf('shipToName', v)} />
          <Inp label='Ship To — Address' value={form.shipToAddress} onChange={v => sf('shipToAddress', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='City' value={form.shipToCity} onChange={v => sf('shipToCity', v)} />
            <Inp label='ZIP Code' value={form.shipToZip} onChange={v => sf('shipToZip', v)} />
          </div>

          <SectionLabel>DELIVERY</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Delivered By (Transporter)' value={form.deliveredBy} onChange={v => sf('deliveredBy', v)} />
            <Inp label='Fuel Type' value={form.fuelType} onChange={v => sf('fuelType', v)} placeholder='BIOSOLAR B40' />
            <Inp label='Qty Order (Liters)' type='number' value={form.qtyOrder} onChange={v => sf('qtyOrder', v)} />
            <Inp label='Qty Received (Liters)' type='number' value={form.qtyReceived} onChange={v => sf('qtyReceived', v)} />
          </div>

          <SectionLabel>FLOWMETER & TIME</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <Inp label='Start Hour' value={form.startHour} onChange={v => sf('startHour', v)} placeholder='08:00' />
            <Inp label='Finish Hour' value={form.finishHour} onChange={v => sf('finishHour', v)} placeholder='10:30' />
            <Inp label='Start Flowmeter' value={form.startFlowmeter} onChange={v => sf('startFlowmeter', v)} />
            <Inp label='Finish Flowmeter' value={form.finishFlowmeter} onChange={v => sf('finishFlowmeter', v)} />
          </div>

          <SectionLabel>FUEL SPECIFICATIONS</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <Inp label='Temperature (°C)' value={form.temperature} onChange={v => sf('temperature', v)} />
            <Inp label='Density' value={form.density} onChange={v => sf('density', v)} />
            <Inp label='Flash Point' value={form.flashPoint} onChange={v => sf('flashPoint', v)} />
            <Inp label='Water Content' value={form.waterContent} onChange={v => sf('waterContent', v)} />
          </div>

          <SectionLabel>DOCUMENT</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label='Signer Name' value={form.signerName} onChange={v => sf('signerName', v)} />
            <Inp label='Reference PO Number' value={form.refPONumber} onChange={v => sf('refPONumber', v)} />
          </div>
          <Inp label='Notes' value={form.notes} onChange={v => sf('notes', v)} />

          {/* Preview of terbilang */}
          {form.qtyOrder && +form.qtyOrder > 0 && (
            <div style={{ fontSize: 11, color: T.textDim, background: T.bg,
              borderRadius: 4, padding: '8px 12px', marginBottom: 12 }}>
              Terbilang: <strong style={{ color: T.amber }}>{terbilang(+form.qtyOrder)} Liter</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant='ghost' onClick={() => printDO(form)}>Preview / Print</Btn>
            <Btn variant='ghost' onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save DO</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
