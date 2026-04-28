import { useState } from 'react';
import { T, s } from '../tokens';
import { Hdr, Btn, Sel, Inp, SectionLabel, StatBox } from '../components/UI';
import { calcOAT, idr0, idr2, uid, todayStr } from '../utils';
import { nextRouteCode } from './Routes';

function Row({ label, value, color, bold, indent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: `1px solid ${T.border}22` }}>
      <span style={{ fontSize: 11, color: T.textDim, paddingLeft: indent ? 16 : 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: color || T.text, fontWeight: bold ? 700 : 400,
        fontFamily: T.font }}>{value}</span>
    </div>
  );
}

function ScenarioCol({ label, result, color, params, isSea }) {
  if (!result) return <div style={{ flex: 1 }} />;
  return (
    <div style={{ flex: 1, ...s.card, marginBottom: 0, borderColor: `${color}44` }}>
      <div style={{ fontSize: 9, color, letterSpacing: 2, fontFamily: T.font, marginBottom: 12, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 9, color: T.textDim, marginBottom: 8 }}>
        Op. days: <strong style={{ color }}>{result.effectiveDays}</strong> ·
        Trips/yr: <strong style={{ color }}>{result.tripsPerYear}</strong>
        {isSea && <> · RPM: <strong style={{ color }}>{params.rpmKey}</strong></>}
      </div>
      <div style={{ fontSize: 9, color: T.textDim, marginBottom: 12 }}>
        Maint × {params.maintMultiplier.toFixed(1)}
      </div>
      <div style={{ fontSize: 9, color: T.textDim }}>OAT/L</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: T.font, marginBottom: 4 }}>
        Rp {idr0(result.oatPerL)}
      </div>
      <div style={{ fontSize: 10, color: T.textDim }}>IDR/KL: Rp {idr0(result.oatPerKL)}</div>
    </div>
  );
}

export default function Calculator({ db, updateDB }) {
  const vessels = db.vessels || [];
  const trucks  = db.trucks  || [];
  const routes  = db.routes  || [];

  const [assetType, setAssetType] = useState('vessel');
  const [assetId,   setAssetId]   = useState('');
  const [routeMode, setRouteMode] = useState('saved'); // 'saved' | 'direct'
  const [routeId,   setRouteId]   = useState('');
  const [fuelPrice,    setFuelPrice]    = useState(db.settings?.bunkerPrice || '');
  const [overheadCost, setOverheadCost] = useState('');
  const [result,       setResult]       = useState(null);

  // Direct route entry state
  const [directRoute, setDirectRoute] = useState({
    type: 'sea', distanceNM: '', speedKnots: 8,
    loadingHours: 4, unloadingHours: 4, portWaitingHours: 2,
    portFeeOrigin: 0, portFeeDestination: 0, otherFees: 0,
    distanceKm: '', restHours: 0, tollFees: 0, informalFees: 0,
  });
  const sdr = (k, v) => setDirectRoute(r => ({ ...r, [k]: v }));

  // Scenario sliders
  const [opDaysOffset,    setOpDaysOffset]    = useState(0);
  const [maintMultiplier, setMaintMultiplier] = useState(1.0);
  const [rpmKey,          setRpmKey]          = useState('standard');

  const assets = assetType === 'vessel' ? vessels : trucks;
  const asset  = assets.find(a => a.id === assetId);
  const route  = routeMode === 'saved'
    ? routes.find(r => r.id === routeId)
    : { ...directRoute, type: assetType === 'vessel' ? 'sea' : 'land' };

  // Filter routes by type
  const compatRoutes = routes.filter(r =>
    assetType === 'vessel' ? r.type === 'sea' : r.type === 'land'
  );

  const isSea = assetType === 'vessel';

  // Pull overhead/perizinan/rates directly from db (no stale helper functions needed)
  const mdCompany = isSea ? 'PTS' : 'PTE';
  const mdPool    = db.overheadPool?.[mdCompany];
  const mdOverheadAnnual = mdPool
    ? Math.round(
        (mdPool.items || []).reduce((s, i) => s + (+i.amount || 0), 0)
        / Math.max(1, mdPool.activeUnits || 1)
        * 12
      )
    : 0;
  const mdPerizinanAnnual = (db.perizinan?.[mdCompany] || [])
    .reduce((s, p) => s + (+p.costIDR || 0) * (12 / (+p.intervalMonths || 12)), 0);
  const mdRates = db.maintenanceRates?.[mdCompany] || { servicePerKm: 0, tirePerKm: 0 };

  const calculate = () => {
    if (!asset || !fuelPrice) {
      alert('Please select an asset and enter fuel/bunker price'); return;
    }
    if (routeMode === 'saved' && !route) {
      alert('Please select a saved route'); return;
    }
    if (routeMode === 'direct') {
      const dist = isSea ? directRoute.distanceNM : directRoute.distanceKm;
      if (!dist || +dist <= 0) { alert('Please enter distance'); return; }
    }
    const params = {
      fuelPricePerLiter: +fuelPrice,
      opDaysOffset:    +opDaysOffset,
      maintMultiplier: +maintMultiplier,
      rpmKey,
      overheadCost:    mdOverheadAnnual + (+overheadCost || 0),
      perizinanCost:   mdPerizinanAnnual,
      servicePerKm:    mdRates.servicePerKm,
      tirePerKm:       mdRates.tirePerKm,
    };
    setResult(calcOAT(asset, route, params, db));
  };

  // Scenario results
  const scenarioBase = {
    fuelPricePerLiter: +fuelPrice,
    overheadCost:    mdOverheadAnnual + (+overheadCost || 0),
    perizinanCost:   mdPerizinanAnnual,
    servicePerKm:    mdRates.servicePerKm,
    tirePerKm:       mdRates.tirePerKm,
  };

  const conservativeResult = asset && route && fuelPrice ? calcOAT(asset, route, {
    ...scenarioBase, opDaysOffset: -15, maintMultiplier: 1.3, rpmKey: 'standard',
  }, db) : null;

  const standardResult = asset && route && fuelPrice ? calcOAT(asset, route, {
    ...scenarioBase, opDaysOffset: 0, maintMultiplier: 1.0, rpmKey: 'standard',
  }, db) : null;

  const aggressiveResult = asset && route && fuelPrice ? calcOAT(asset, route, {
    ...scenarioBase, opDaysOffset: +15, maintMultiplier: 0.8, rpmKey: isSea ? 'high' : 'standard',
  }, db) : null;

  const saveCalc = () => {
    if (!result) return;
    const snap = {
      id: uid(),
      savedAt: todayStr(),
      assetName: asset?.name || asset?.licensePlate,
      routeName: route?.name,
      fuelPrice: +fuelPrice,
      opDaysOffset: +opDaysOffset,
      maintMultiplier: +maintMultiplier,
      rpmKey,
      result,
    };
    updateDB(d => ({ ...d, calculations: [...(d.calculations || []), snap] }));
    alert(`✅ Calculation saved: ${snap.assetName} × ${snap.routeName}`);
  };

  return (
    <div>
      <Hdr>∑ OAT CALCULATOR</Hdr>

      {/* Inputs */}
      <div style={{ ...s.card }}>
        <SectionLabel>SELECT ASSET & ROUTE</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Sel label='Asset Type' value={assetType} onChange={v => { setAssetType(v); setAssetId(''); setRouteId(''); setResult(null); }}>
            <option value='vessel'>⛴ Vessel (Sea)</option>
            <option value='truck'>🚛 Truck (Land)</option>
          </Sel>
          <Sel label='Asset' value={assetId} onChange={v => { setAssetId(v); setResult(null); }}>
            <option value=''>— Select {assetType} —</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.name || a.licensePlate} ({a.capacityKL} KL)</option>)}
          </Sel>
          <Sel label={`Route (${isSea ? 'Sea' : 'Land'} only)`} value={assetId} onChange={v => { setAssetId(v); setResult(null); }}>
            <option value=''>— Select {assetType} —</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.name || a.licensePlate} ({a.capacityKL} KL)</option>)}
          </Sel>

          {/* Route mode toggle */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={s.label}>ROUTE INPUT MODE</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['saved','📍 Use Saved Route'],['direct','✏️ Enter Directly']].map(([k,l]) => (
                <button key={k} onClick={() => { setRouteMode(k); setResult(null); }}
                  style={{ ...s.btn('ghost'), flex: 1,
                    borderColor: routeMode === k ? T.amber : T.border,
                    color: routeMode === k ? T.amber : T.textDim }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {routeMode === 'saved' ? (
            <Sel label={`Saved Route (${isSea ? 'Sea' : 'Land'} only)`} value={routeId} onChange={v => { setRouteId(v); setResult(null); }}>
              <option value=''>— Select route —</option>
              {compatRoutes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.routeCode ? `[${r.routeCode}] ` : ''}{r.name} ({r.origin} → {r.destination})
                </option>
              ))}
            </Sel>
          ) : (
            <div style={{ gridColumn: '1 / -1', ...s.card, padding: 16, marginBottom: 0 }}>
              <SectionLabel>DIRECT ROUTE PARAMETERS</SectionLabel>
              {isSea ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Inp label='Distance (NM, one way)' type='number' value={directRoute.distanceNM} onChange={v => { sdr('distanceNM',v); setResult(null); }} />
                  <Inp label='Speed (knots, std RPM)' type='number' value={directRoute.speedKnots} onChange={v => { sdr('speedKnots',v); setResult(null); }} />
                  <Inp label='Loading (hours)' type='number' value={directRoute.loadingHours} onChange={v => { sdr('loadingHours',v); setResult(null); }} />
                  <Inp label='Unloading (hours)' type='number' value={directRoute.unloadingHours} onChange={v => { sdr('unloadingHours',v); setResult(null); }} />
                  <Inp label='Port Waiting (hours)' type='number' value={directRoute.portWaitingHours} onChange={v => { sdr('portWaitingHours',v); setResult(null); }} />
                  <Inp label='Port Fee Origin (IDR/trip)' type='number' value={directRoute.portFeeOrigin} onChange={v => { sdr('portFeeOrigin',v); setResult(null); }} />
                  <Inp label='Port Fee Dest (IDR/trip)' type='number' value={directRoute.portFeeDestination} onChange={v => { sdr('portFeeDestination',v); setResult(null); }} />
                  <Inp label='Other Fees (IDR/trip)' type='number' value={directRoute.otherFees} onChange={v => { sdr('otherFees',v); setResult(null); }} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Inp label='Distance (km, one way)' type='number' value={directRoute.distanceKm} onChange={v => { sdr('distanceKm',v); setResult(null); }} />
                  <div style={{ ...s.card, padding: '10px 12px', marginBottom: 0, background: '#0d1c14' }}>
                    <div style={{ fontSize: 10, color: T.green }}>SPEED FIXED 30 KM/H</div>
                  </div>
                  <Inp label='Loading (hours)' type='number' value={directRoute.loadingHours} onChange={v => { sdr('loadingHours',v); setResult(null); }} />
                  <Inp label='Unloading (hours)' type='number' value={directRoute.unloadingHours} onChange={v => { sdr('unloadingHours',v); setResult(null); }} />
                  <Inp label='Rest/Break (hours)' type='number' value={directRoute.restHours} onChange={v => { sdr('restHours',v); setResult(null); }} />
                  <Inp label='Toll Fees (IDR/trip)' type='number' value={directRoute.tollFees} onChange={v => { sdr('tollFees',v); setResult(null); }} />
                  <Inp label='Informal Fees (IDR/trip)' type='number' value={directRoute.informalFees} onChange={v => { sdr('informalFees',v); setResult(null); }} />
                  <Inp label='Other Fees (IDR/trip)' type='number' value={directRoute.otherFees} onChange={v => { sdr('otherFees',v); setResult(null); }} />
                </div>
              )}
              <button onClick={() => {
                // Save direct route to saved routes
                if (!window.confirm('Save this as a named route?')) return;
                const name = window.prompt('Route name (or leave blank for auto):') || '';
                updateDB(d => ({
                  ...d, routes: [...d.routes, {
                    ...directRoute,
                    type: isSea ? 'sea' : 'land',
                    id: Math.random().toString(36).slice(2,9)+Date.now().toString(36),
                    routeCode: nextRouteCode(d.routes, isSea ? 'sea' : 'land'),
                    name: name || `${directRoute.origin||'–'} → ${directRoute.destination||'–'}`,
                    origin: '', destination: '',
                  }]
                }));
              }} style={{ ...s.btn('ghost'), marginTop: 12, fontSize: 10 }}>
                💾 Save as Named Route
              </button>
            </div>
          )}
          <Inp label={isSea ? 'Bunker Price (IDR/Liter)' : 'Diesel Price (IDR/Liter)'}
            type='number' value={fuelPrice} onChange={v => { setFuelPrice(v); setResult(null); }} />
        <div style={{ gridColumn: '1 / -1' }}>
            <Inp label='Overhead / Additional Cost (IDR/year — manual lump sum, added on top of master data overhead)'
              type='number' value={overheadCost}
              onChange={v => { setOverheadCost(v); setResult(null); }}
              placeholder='e.g. additional allocation not in master data' />
          </div>

          {/* Master data summary */}
          {(mdOverheadAnnual > 0 || mdPerizinanAnnual > 0 || mdRates.servicePerKm > 0) && (
            <div style={{ gridColumn: '1 / -1', ...s.card, padding: '10px 14px', marginBottom: 0,
              background: T.bg, borderColor: T.teal + '44' }}>
              <div style={{ fontSize: 9, color: T.teal, letterSpacing: 1.5, marginBottom: 6 }}>
                FROM MASTER DATA ({mdEntity.toUpperCase()})
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11 }}>
                {mdOverheadAnnual > 0 && <span>Overhead: <strong style={{ color: T.teal }}>Rp {idr0(mdOverheadAnnual)}/yr</strong></span>}
                {mdPerizinanAnnual > 0 && <span>Perizinan: <strong style={{ color: T.teal }}>Rp {idr0(mdPerizinanAnnual)}/yr</strong></span>}
                {mdRates.servicePerKm > 0 && <span>Service: <strong style={{ color: T.teal }}>Rp {idr0(mdRates.servicePerKm)}/km</strong></span>}
                {mdRates.tirePerKm > 0 && <span>Tire: <strong style={{ color: T.teal }}>Rp {idr0(mdRates.tirePerKm)}/km</strong></span>}
              </div>
            </div>
          )}
        </div>

        {/* Scenario sliders */}
        <SectionLabel>SCENARIO PARAMETERS (adjust to explore scenarios)</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: isSea ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16 }}>
          <div>
            <label style={s.label}>OP. DAYS OFFSET: {opDaysOffset > 0 ? '+' : ''}{opDaysOffset} days</label>
            <input type='range' min='-30' max='30' step='1' value={opDaysOffset}
              onChange={e => { setOpDaysOffset(+e.target.value); setResult(null); }}
              style={{ width: '100%', accentColor: T.amber }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.textDim }}>
              <span>−30 (conservative)</span><span>+30 (aggressive)</span>
            </div>
          </div>
          <div>
            <label style={s.label}>MAINT. COST MULTIPLIER: {maintMultiplier.toFixed(1)}×</label>
            <input type='range' min='0.5' max='1.5' step='0.1' value={maintMultiplier}
              onChange={e => { setMaintMultiplier(+e.target.value); setResult(null); }}
              style={{ width: '100%', accentColor: T.amber }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.textDim }}>
              <span>0.5× (optimistic)</span><span>1.5× (conservative)</span>
            </div>
          </div>
          {isSea && (
            <div>
              <label style={s.label}>RPM SETTING</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['low','standard','high'].map(k => (
                  <button key={k} onClick={() => { setRpmKey(k); setResult(null); }}
                    style={{ ...s.btn('ghost'), flex: 1, padding: '6px 4px',
                      borderColor: rpmKey === k ? T.amber : T.border,
                      color: rpmKey === k ? T.amber : T.textDim }}>
                    {k.toUpperCase()}
                    <div style={{ fontSize: 8, color: T.textDim, marginTop: 2 }}>
                      ×{asset?.rpmCoefficients?.[k] ?? (k==='standard'?1.0:k==='low'?0.75:1.3)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Btn onClick={calculate}>Calculate OAT</Btn>
          {result && <Btn variant='ghost' onClick={saveCalc}>💾 Save Snapshot</Btn>}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            {/* Annual Ops */}
            <div style={s.card}>
              <SectionLabel>ANNUAL OPERATIONS</SectionLabel>
              <Row label='Calendar Days' value='365 days' />
              <Row label='Maintenance / Docking Days' value={`−${365 - result.effectiveDays} days`} color={T.red} indent />
              <Row label='Effective Operational Days' value={`${result.effectiveDays} days`} bold color={T.amber} />
              <Row label='Voyage Time' value={`${result.voyageHours.toFixed(1)} hrs/trip`} />
              <Row label='Trips per Year' value={`${result.tripsPerYear} trips`} bold />
              <Row label='Annual Volume' value={`${idr0(result.annualVolumeKL)} KL`} bold color={T.green} />
            </div>

            {/* Fixed costs */}
            <div style={s.card}>
              <SectionLabel>FIXED COSTS (ANNUAL)</SectionLabel>
              <Row label='Depreciation' value={`Rp ${idr0(result.depreciation)}`} indent />
              <Row label='Crew / Driver Salary' value={`Rp ${idr0(result.salaryAnnual)}`} indent />
              <Row label='Insurance' value={`Rp ${idr0(result.insurance)}`} indent />
              <Row label='Maintenance Reserve' value={`Rp ${idr0(result.maintCost)}`} indent />
              <Row label='Repair Buffer' value={`Rp ${idr0(result.repairBuffer)}`} indent />
              {result.useInstallment && (
                <Row label='Monthly Installment × 12 (BEP mode)'
                  value={`Rp ${idr0(result.installmentAnnual)}`} indent color={T.blue} />
              )}
              {result.perizinanCost > 0 && (
                <Row label='Perizinan (from Master Data)' value={`Rp ${idr0(result.perizinanCost)}`} indent color={T.teal} />
              )}
              {result.overheadCost > 0 && (
                <Row label='Overhead (Master Data + Manual)' value={`Rp ${idr0(result.overheadCost)}`} indent color={T.teal} />
              )}
              <Row label='TOTAL FIXED' value={`Rp ${idr0(result.totalFixed)}`} bold color={T.amber} />
            </div>
          </div>

          <div>
            {/* Operating costs */}
            <div style={s.card}>
              <SectionLabel>OPERATING COSTS (PER TRIP × {result.tripsPerYear} TRIPS)</SectionLabel>
              <Row label='Fuel / Bunker per trip' value={`Rp ${idr0(result.fuelCostPerTrip)}`} indent />
              <Row label='Crew / Driver Premi' value={`Rp ${idr0(result.premi)}`} indent />
              <Row label={isSea ? 'Port Fees' : 'Toll Fees'} value={`Rp ${idr0(result.portOrToll)}`} indent />
              <Row label='Portal Fees / Uang Jalan' value={`Rp ${idr0(result.portalFees)}`} indent />
              {result.maintPerTripKm > 0 && (
                <Row label='Maintenance / km (service + tire)' value={`Rp ${idr0(result.maintPerTripKm)}`} indent color={T.teal} />
              )}
              <Row label='Other Fees' value={`Rp ${idr0(result.otherFees)}`} indent />
              <Row label='Per Trip Subtotal' value={`Rp ${idr0(result.opPerTrip)}`} bold />
              <Row label='TOTAL OPERATING' value={`Rp ${idr0(result.totalOperating)}`} bold color={T.blue} />
            </div>

            {/* OAT result */}
            <div style={{ ...s.card, borderColor: `${T.amber}66`, background: '#0d1810' }}>
              <SectionLabel>TOTAL ANNUAL COST</SectionLabel>
              <Row label='Fixed + Operating' value={`Rp ${idr0(result.totalAnnualCost)}`} bold color={T.text} />
              <div style={{ borderTop: `2px solid ${T.amber}44`, marginTop: 12, paddingTop: 12 }}>
                <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 2, marginBottom: 8 }}>OAT RESULT</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.textDim }}>IDR / Liter</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: T.amber, fontFamily: T.font }}>
                      Rp {idr0(result.oatPerL)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.textDim }}>IDR / KL</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: T.amber, fontFamily: T.font }}>
                      Rp {idr0(result.oatPerKL)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scenarios comparison */}
      {(conservativeResult || standardResult || aggressiveResult) && (
        <div style={s.card}>
          <SectionLabel>SCENARIO COMPARISON</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <ScenarioCol label='CONSERVATIVE' result={conservativeResult} color={T.red}
              params={{ opDaysOffset: -15, maintMultiplier: 1.3, rpmKey: 'standard' }} isSea={isSea} />
            <ScenarioCol label='STANDARD' result={standardResult} color={T.amber}
              params={{ opDaysOffset: 0, maintMultiplier: 1.0, rpmKey: 'standard' }} isSea={isSea} />
            <ScenarioCol label='AGGRESSIVE' result={aggressiveResult} color={T.green}
              params={{ opDaysOffset: 15, maintMultiplier: 0.8, rpmKey: isSea ? 'high' : 'standard' }} isSea={isSea} />
          </div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 12 }}>
            Conservative: −15 op days, ×1.3 maint {isSea ? ', std RPM' : ''} ·
            Aggressive: +15 op days, ×0.8 maint {isSea ? ', high RPM' : ''}
          </div>
        </div>
      )}

      {/* Saved calculations */}
      {(db.calculations || []).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <SectionLabel>SAVED CALCULATIONS</SectionLabel>
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Date','Asset','Route','Fuel (IDR/L)','Trips/yr','OAT/L','OAT/KL',''].map(h =>
                  <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[...(db.calculations||[])].reverse().map(c => (
                  <tr key={c.id}>
                    <td style={{ ...s.td, fontSize: 10, color: T.textDim }}>{c.savedAt}</td>
                    <td style={{ ...s.td, fontWeight: 700 }}>{c.assetName}</td>
                    <td style={s.td}>{c.routeName}</td>
                    <td style={s.tdNum}>Rp {idr0(c.fuelPrice)}</td>
                    <td style={s.tdNum}>{c.result?.tripsPerYear}</td>
                    <td style={{ ...s.tdNum, color: T.amber, fontWeight: 700 }}>Rp {idr0(c.result?.oatPerL)}</td>
                    <td style={{ ...s.tdNum, color: T.amber }}>Rp {idr0(c.result?.oatPerKL)}</td>
                    <td style={s.td}>
                      <Btn variant='ghost' onClick={() => {
                        if (!confirm('Delete this saved calculation?')) return;
                        updateDB(d => ({ ...d, calculations: d.calculations.filter(x => x.id !== c.id) }));
                      }} style={{ padding: '3px 10px', color: T.red }}>Del</Btn>
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
