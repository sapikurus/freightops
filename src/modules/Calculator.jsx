import { useState } from 'react';
import { useTheme } from '../App';
import { Hdr, Btn, Sel, Inp, SectionLabel, Notice, Empty, Badge } from '../components/UI';
import {
  calcVoyageOAT, calcTruckOAT, idr0, idr2, uid, todayStr,
  blankLeg, nextVoyageCode, LAND_SPEED_KMH,
} from '../utils';

// ── Small presentational helpers ──────────────────────────────
function Row({ label, value, color, bold, indent, hint }) {
  const { T } = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      alignItems: 'baseline', padding: '5px 0',
      borderBottom: `1px solid ${T.border}55`, gap: 12 }}>
      <span style={{ fontSize: 11, color: bold ? T.text : T.textDim,
        paddingLeft: indent ? 16 : 0, fontWeight: bold ? 700 : 400 }}>
        {label}
        {hint && <span style={{ fontSize: 9, color: T.textFaint, marginLeft: 6 }}>{hint}</span>}
      </span>
      <span style={{ fontSize: 11, color: color || T.text, fontWeight: bold ? 700 : 400,
        fontFamily: T.font, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function OccupancyBar({ cargoKL, capacityKL, pct }) {
  const { T } = useTheme();
  const over = pct > 100;
  const clamped = Math.min(100, Math.max(0, pct));
  const color = over ? T.red : pct >= 85 ? T.green : pct >= 60 ? T.amber : T.red;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5 }}>
          CARGO OCCUPANCY
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color, fontFamily: T.font }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 8, background: T.bg, borderRadius: 4,
        overflow: 'hidden', border: `1px solid ${T.border}` }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: color,
          transition: 'width .25s' }} />
      </div>
      <div style={{ fontSize: 10, color: T.textDim, marginTop: 6 }}>
        {idr0(cargoKL)} KL of {idr0(capacityKL)} KL
        {!over && capacityKL > cargoKL && (
          <span style={{ color: T.red }}> · {idr0(capacityKL - cargoKL)} KL unused</span>
        )}
        {over && <span style={{ color: T.red }}> · EXCEEDS CAPACITY</span>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function Calculator({ db, updateDB, mode = 'sea' }) {
  const { T, s } = useTheme();
  const isSea = mode === 'sea';

  const vessels    = db.vessels    || [];
  const trucks     = db.trucks     || [];
  const voyages    = db.voyages    || [];
  const landRoutes = db.landRoutes || [];

  const [assetId, setAssetId]     = useState('');
  const [fuelPrice, setFuelPrice] = useState(
    isSea ? (db.settings?.bunkerPrice || '') : (db.settings?.dieselPrice || ''));
  const [extraOverhead, setExtraOverhead] = useState('');
  const [result, setResult] = useState(null);

  // Scenario controls
  const [opDaysOffset, setOpDaysOffset]       = useState(0);
  const [maintMultiplier, setMaintMultiplier] = useState(1.0);
  const [rpmKey, setRpmKey]                   = useState('standard');

  // ── Sea voyage state ────────────────────────────────────────
  const [voyage, setVoyage] = useState({
    loadingPort: '', loadingHours: 8, portWaitingHours: 4,
    loadingPortFee: '', otherFees: '',
    legs: [blankLeg(1)],
  });
  const sv = (k, v) => { setVoyage(x => ({ ...x, [k]: v })); setResult(null); };

  const updLeg = (i, k, v) => {
    setVoyage(x => {
      const legs = [...x.legs];
      legs[i] = { ...legs[i], [k]: v };
      return { ...x, legs };
    });
    setResult(null);
  };
  const addLeg = () => {
    setVoyage(x => ({ ...x, legs: [...x.legs, blankLeg(x.legs.length + 1)] }));
    setResult(null);
  };
  const addReturnLeg = () => {
    setVoyage(x => {
      const last = x.legs[x.legs.length - 1];
      const back = blankLeg(x.legs.length + 1);
      back.destination = x.loadingPort || 'Base';
      back.distanceNM  = last?.distanceNM || '';
      back.speedKnots  = last?.speedKnots || '';
      back.isBallast   = true;
      back.cargoKL     = 0;
      return { ...x, legs: [...x.legs, back] };
    });
    setResult(null);
  };
  const delLeg = (i) => {
    setVoyage(x => ({ ...x, legs: x.legs.filter((_, j) => j !== i) }));
    setResult(null);
  };

  // ── Land route state ────────────────────────────────────────
  const [landRouteId, setLandRouteId] = useState('');
  const [landRoute, setLandRoute] = useState({
    origin: '', destination: '', distanceKm: '',
    loadingHours: 2, unloadingHours: 2, restHours: 0,
    tollFees: '', portalFees: '', otherFees: '', cargoKL: '',
  });
  const slr = (k, v) => { setLandRoute(x => ({ ...x, [k]: v })); setResult(null); };

  const loadSavedLand = (id) => {
    setLandRouteId(id);
    const r = landRoutes.find(x => x.id === id);
    if (r) setLandRoute({ ...landRoute, ...r });
    setResult(null);
  };

  const assets = isSea ? vessels : trucks;
  const asset  = assets.find(a => a.id === assetId);

  // Master data preview
  const company = isSea ? 'PTS' : 'PTE';
  const pool = db.overheadPool?.[company];
  const mdOverhead = pool
    ? Math.round((pool.items || []).reduce((a, i) => a + (+i.amount || 0), 0)
        / Math.max(1, pool.activeUnits || 1) * 12)
    : 0;
  const mdPerizinan = (db.perizinan?.[company] || [])
    .reduce((a, p) => a + (+p.costIDR || 0) * (12 / (+p.intervalMonths || 12)), 0);
  const mdRates = db.maintenanceRates?.PTE || {};

  const buildParams = (over = {}) => ({
    fuelPricePerLiter: +fuelPrice || 0,
    opDaysOffset:      +opDaysOffset || 0,
    maintMultiplier:   +maintMultiplier || 1,
    rpmKey,
    overheadCost:      +extraOverhead || 0,
    ...over,
  });

  // ── Validation + calculate ──────────────────────────────────
  const validate = () => {
    if (!asset) return `Select a ${isSea ? 'vessel' : 'truck'} first`;
    if (!fuelPrice || +fuelPrice <= 0) return 'Enter a fuel/bunker price';
    if (isSea) {
      if (!voyage.legs.length) return 'Add at least one leg';
      const cargo = voyage.legs.reduce((a, l) => a + (l.isBallast ? 0 : +l.cargoKL || 0), 0);
      if (cargo <= 0) return 'At least one leg must carry cargo';
      const badLeg = voyage.legs.findIndex(l =>
        (+l.distanceNM || 0) > 0 && (+l.speedKnots || 0) <= 0);
      if (badLeg >= 0) return `Leg ${badLeg + 1} has distance but no speed`;
    } else {
      if (!landRoute.distanceKm || +landRoute.distanceKm <= 0) return 'Enter route distance';
    }
    return null;
  };

  const calculate = () => {
    const err = validate();
    if (err) { alert(err); return; }
    setResult(isSea
      ? calcVoyageOAT(asset, voyage, buildParams(), db)
      : calcTruckOAT(asset, landRoute, buildParams(), db));
  };

  const canScenario = !validate();
  const scen = (over) => {
    if (!canScenario) return null;
    return isSea
      ? calcVoyageOAT(asset, voyage, buildParams(over), db)
      : calcTruckOAT(asset, landRoute, buildParams(over), db);
  };
  const conservative = scen({ opDaysOffset: -15, maintMultiplier: 1.3, rpmKey: 'standard' });
  const standard     = scen({ opDaysOffset: 0,   maintMultiplier: 1.0, rpmKey: 'standard' });
  const aggressive   = scen({ opDaysOffset: 15,  maintMultiplier: 0.8,
                              rpmKey: isSea ? 'high' : 'standard' });

  // ── Save voyage geometry as reusable route ──────────────────
  const saveVoyageAsRoute = () => {
    if (!voyage.legs.length) { alert('Nothing to save'); return; }
    const name = window.prompt('Name for this voyage route:',
      `${voyage.loadingPort || '?'} → ${voyage.legs.map(l => l.destination || '?').join(' → ')}`);
    if (name === null) return;
    // Geometry only — cargo volumes and heater hours stay with the calculation.
    const geometry = {
      id: uid(),
      code: nextVoyageCode(db.voyages),
      name: name || 'Untitled voyage',
      loadingPort: voyage.loadingPort,
      loadingHours: +voyage.loadingHours || 0,
      portWaitingHours: +voyage.portWaitingHours || 0,
      loadingPortFee: +voyage.loadingPortFee || 0,
      otherFees: +voyage.otherFees || 0,
      legs: voyage.legs.map((l, i) => ({
        id: uid(), seq: i + 1,
        destination: l.destination,
        distanceNM: +l.distanceNM || 0,
        speedKnots: +l.speedKnots || 0,
        unloadHours: +l.unloadHours || 0,
        portFee: +l.portFee || 0,
        isBallast: !!l.isBallast,
        // cargo/aux/heater deliberately NOT saved — they vary per shipment
        cargoKL: '', auxHours: '', heaterHours: '', cargoName: '',
      })),
      savedAt: todayStr(),
    };
    updateDB(d => ({ ...d, voyages: [...(d.voyages || []), geometry] }));
    alert(`Saved as ${geometry.code} — ${geometry.name}\n\nCargo volumes, aux and heater hours are not stored, since they change per shipment.`);
  };

  const loadVoyage = (id) => {
    const v = voyages.find(x => x.id === id);
    if (!v) return;
    setVoyage({
      loadingPort: v.loadingPort || '',
      loadingHours: v.loadingHours ?? 8,
      portWaitingHours: v.portWaitingHours ?? 4,
      loadingPortFee: v.loadingPortFee || '',
      otherFees: v.otherFees || '',
      legs: (v.legs || []).map((l, i) => ({ ...blankLeg(i + 1), ...l,
        cargoKL: '', auxHours: '', heaterHours: '' })),
    });
    setResult(null);
  };

  const saveCalc = () => {
    if (!result) return;
    const snap = {
      id: uid(), savedAt: todayStr(), mode,
      assetName: asset?.name || asset?.licensePlate || '',
      routeName: isSea
        ? `${voyage.loadingPort || '?'} → ${voyage.legs.map(l => l.destination || '?').join(' → ')}`
        : `${landRoute.origin || '?'} → ${landRoute.destination || '?'}`,
      fuelPrice: +fuelPrice,
      occupancyPct: result.occupancyPct,
      opDaysOffset: +opDaysOffset,
      maintMultiplier: +maintMultiplier,
      rpmKey: isSea ? rpmKey : null,
      result,
    };
    updateDB(d => ({ ...d, calculations: [...(d.calculations || []), snap] }));
    alert(`Saved: ${snap.assetName} — ${snap.routeName}`);
  };

  const savedCalcs = (db.calculations || []).filter(c => (c.mode || 'sea') === mode);

  // ── Live preview totals (before pressing Calculate) ──────────
  const liveCargo = isSea
    ? voyage.legs.reduce((a, l) => a + (l.isBallast ? 0 : +l.cargoKL || 0), 0)
    : (landRoute.cargoKL !== '' ? +landRoute.cargoKL : +(asset?.capacityKL || 0));
  const liveCapacity = +(asset?.capacityKL || 0);
  const liveOccupancy = liveCapacity > 0 ? (liveCargo / liveCapacity) * 100 : 0;

  // Return-to-base check (live)
  const lastDest = (voyage.legs[voyage.legs.length - 1]?.destination || '').trim().toLowerCase();
  const loadPort = (voyage.loadingPort || '').trim().toLowerCase();
  const chainOpen = isSea && voyage.legs.length > 0
    && loadPort !== '' && lastDest !== '' && loadPort !== lastDest;
  const noDestYet = isSea && voyage.legs.some(l => !String(l.destination || '').trim());

  return (
    <div>
      <Hdr sub={isSea ? 'PT USI Petrotrans Samudra — multi-leg voyage'
                      : 'PT USI Petrotrans Energi — round trip'}>
        ∑ OAT CALCULATOR — {isSea ? 'SEA' : 'LAND'}
      </Hdr>

      {assets.length === 0 && (
        <Empty>
          No {isSea ? 'vessels' : 'trucks'} registered yet.
          Add one under {isSea ? 'PTS › Vessels' : 'PTE › Trucks'} first.
        </Empty>
      )}

      {assets.length > 0 && <>
        {/* ── ASSET + PRICE ────────────────────────────────── */}
        <div style={s.card}>
          <SectionLabel>ASSET & FUEL PRICE</SectionLabel>
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            <Sel label={isSea ? 'Vessel' : 'Truck'} value={assetId}
              onChange={v => { setAssetId(v); setResult(null); }}>
              <option value=''>— Select {isSea ? 'vessel' : 'truck'} —</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name || a.licensePlate}
                  {a.vesselType ? ` · ${a.vesselType}` : ''} ({idr0(a.capacityKL)} KL)
                </option>
              ))}
            </Sel>
            <Inp label={isSea ? 'Bunker Price (IDR/Litre)' : 'Diesel Price (IDR/Litre)'}
              type='number' value={fuelPrice}
              onChange={v => { setFuelPrice(v); setResult(null); }} />
            <Inp label='Extra Overhead (IDR/year, optional)'
              type='number' value={extraOverhead}
              onChange={v => { setExtraOverhead(v); setResult(null); }}
              hint='Added on top of the Master Data overhead pool' />
          </div>

          {asset && isSea && (
            <Notice tone='info'>
              <strong>{asset.name}</strong> — Main {asset.consumptionLperHour || 0} L/hr ·
              Aux {asset.auxConsumptionLperHour || 0} L/hr ·
              Heater {asset.heaterConsumptionLperHour || 0} L/hr · Capacity {idr0(asset.capacityKL)} KL
              {!asset.auxConsumptionLperHour && !asset.heaterConsumptionLperHour && (
                <div style={{ marginTop: 4, color: T.textDim, fontSize: 10 }}>
                  Aux and heater rates are 0 — hours entered below will add no fuel cost.
                  Set them in the vessel record if this vessel has them.
                </div>
              )}
            </Notice>
          )}

          {(mdOverhead > 0 || mdPerizinan > 0) && (
            <div style={{ ...s.cardInset, marginBottom: 0 }}>
              <div style={{ fontSize: 9, color: T.teal, letterSpacing: 1.5, marginBottom: 6 }}>
                FROM MASTER DATA ({company})
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11 }}>
                {mdOverhead > 0 && <span>Overhead:{' '}
                  <strong style={{ color: T.teal }}>Rp {idr0(mdOverhead)}/yr</strong></span>}
                {mdPerizinan > 0 && <span>Perizinan:{' '}
                  <strong style={{ color: T.teal }}>Rp {idr0(mdPerizinan)}/yr</strong></span>}
                {!isSea && mdRates.servicePerKm > 0 && <span>Service:{' '}
                  <strong style={{ color: T.teal }}>Rp {idr0(mdRates.servicePerKm)}/km</strong></span>}
                {!isSea && mdRates.tirePerKm > 0 && <span>Tire:{' '}
                  <strong style={{ color: T.teal }}>Rp {idr0(mdRates.tirePerKm)}/km</strong></span>}
              </div>
            </div>
          )}
        </div>

        {/* ══ SEA: VOYAGE BUILDER ═══════════════════════════ */}
        {isSea && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <SectionLabel>VOYAGE — LOADING PORT & LEGS</SectionLabel>
              {voyages.length > 0 && (
                <div style={{ minWidth: 220 }}>
                  <Sel label='Load Saved Route' value=''
                    onChange={v => v && loadVoyage(v)}>
                    <option value=''>— Load geometry —</option>
                    {voyages.map(v => (
                      <option key={v.id} value={v.id}>[{v.code}] {v.name}</option>
                    ))}
                  </Sel>
                </div>
              )}
            </div>

            {/* Loading port */}
            <div style={{ ...s.cardInset, borderColor: `${T.amber}55` }}>
              <div style={{ fontSize: 9, color: T.amber, letterSpacing: 1.5,
                fontWeight: 700, marginBottom: 10 }}>⚓ LOADING PORT (ORIGIN)</div>
              <div style={{ display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                <Inp label='Port Name' value={voyage.loadingPort}
                  onChange={v => sv('loadingPort', v)} placeholder='e.g. Samarinda' />
                <Inp label='Loading Time (hrs)' type='number' value={voyage.loadingHours}
                  onChange={v => sv('loadingHours', v)} />
                <Inp label='Port Waiting (hrs)' type='number' value={voyage.portWaitingHours}
                  onChange={v => sv('portWaitingHours', v)} />
                <Inp label='Loading Port Fee (IDR)' type='number' value={voyage.loadingPortFee}
                  onChange={v => sv('loadingPortFee', v)} />
                <Inp label='Other Fees (IDR/voyage)' type='number' value={voyage.otherFees}
                  onChange={v => sv('otherFees', v)} />
              </div>
            </div>

            {/* Legs */}
            {voyage.legs.map((leg, i) => {
              const prev = i === 0
                ? (voyage.loadingPort || 'Loading port')
                : (voyage.legs[i - 1].destination || `Stop ${i}`);
              return (
                <div key={leg.id || i} style={{ ...s.cardInset,
                  borderColor: leg.isBallast ? `${T.textFaint}` : `${T.teal}55` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
                      color: leg.isBallast ? T.textDim : T.teal }}>
                      {leg.isBallast ? '⇢ BALLAST LEG' : `▸ LEG ${i + 1}`}
                      <span style={{ color: T.textDim, fontWeight: 400, marginLeft: 8 }}>
                        {prev} → {leg.destination || '?'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: 9, color: T.textDim,
                        display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                        <input type='checkbox' checked={!!leg.isBallast}
                          onChange={e => updLeg(i, 'isBallast', e.target.checked)} />
                        BALLAST (no cargo)
                      </label>
                      {voyage.legs.length > 1 && (
                        <button onClick={() => delLeg(i)}
                          style={{ background: 'none', border: 'none', color: T.red,
                            cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                    <Inp label='Destination' value={leg.destination}
                      onChange={v => updLeg(i, 'destination', v)} placeholder='e.g. Y' />
                    <Inp label='Distance (NM)' type='number' value={leg.distanceNM}
                      onChange={v => updLeg(i, 'distanceNM', v)} />
                    <Inp label='Speed (knots)' type='number' step='0.1' value={leg.speedKnots}
                      onChange={v => updLeg(i, 'speedKnots', v)} />
                    {!leg.isBallast && <>
                      <Inp label='Cargo Name' value={leg.cargoName}
                        onChange={v => updLeg(i, 'cargoName', v)} placeholder='e.g. CARGO X' />
                      <Inp label='Cargo Dropped (KL)' type='number' value={leg.cargoKL}
                        onChange={v => updLeg(i, 'cargoKL', v)} />
                    </>}
                    <Inp label='Aux Engine (hrs)' type='number' value={leg.auxHours}
                      onChange={v => updLeg(i, 'auxHours', v)} />
                    <Inp label='Extra Heater (hrs)' type='number' value={leg.heaterHours}
                      onChange={v => updLeg(i, 'heaterHours', v)} />
                    <Inp label='Discharge Time (hrs)' type='number' value={leg.unloadHours}
                      onChange={v => updLeg(i, 'unloadHours', v)} />
                    <Inp label='Port Fee (IDR)' type='number' value={leg.portFee}
                      onChange={v => updLeg(i, 'portFee', v)} />
                  </div>

                  {(+leg.distanceNM > 0 && +leg.speedKnots > 0) && (
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 8 }}>
                      Sail time: <strong style={{ color: T.text }}>
                        {(+leg.distanceNM / +leg.speedKnots).toFixed(1)} hrs</strong>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <Btn variant='ghost' onClick={addLeg}>+ Add Leg</Btn>
              <Btn variant='ghost' onClick={addReturnLeg}>+ Add Return / Ballast Leg</Btn>
              <Btn variant='ghost' onClick={saveVoyageAsRoute}>💾 Save Route Geometry</Btn>
            </div>

            {/* ── RETURN-TO-BASE WARNING ─────────────────── */}
            {chainOpen && (
              <div style={{ ...s.notice('bad'), marginTop: 14,
                borderWidth: 2, borderColor: T.red }}>
                <div style={{ fontSize: 11, color: T.red, fontWeight: 700,
                  letterSpacing: 1, marginBottom: 6 }}>
                  ⚠ VOYAGE DOES NOT RETURN TO THE LOADING PORT
                </div>
                <div style={{ fontSize: 11, color: T.text, lineHeight: 1.6 }}>
                  The chain ends at <strong>{voyage.legs[voyage.legs.length - 1]?.destination}</strong>,
                  but loading starts at <strong>{voyage.loadingPort}</strong>. The vessel has to get
                  back before it can load again — and that time and fuel are currently
                  <strong> not counted</strong>. Trips per year will be overstated and the resulting
                  OAT will be <strong>too low</strong>, often by 20–30%.
                  <div style={{ marginTop: 8 }}>
                    Add a return leg with the real distance and speed (tick BALLAST so it
                    carries no cargo), or accept the figure knowing it excludes repositioning.
                  </div>
                </div>
                <Btn variant='ghost' onClick={addReturnLeg}
                  style={{ marginTop: 10, borderColor: T.red, color: T.red }}>
                  + Add Return Leg to {voyage.loadingPort}
                </Btn>
              </div>
            )}

            {noDestYet && !chainOpen && (
              <Notice tone='warn' style={{ marginTop: 12 }}>
                Some legs have no destination name. Fill them in so the return-to-base
                check can tell whether the vessel makes it home.
              </Notice>
            )}

            {/* Live occupancy */}
            {asset && liveCargo > 0 && (
              <div style={{ ...s.cardInset, marginTop: 14, marginBottom: 0 }}>
                <OccupancyBar cargoKL={liveCargo} capacityKL={liveCapacity} pct={liveOccupancy} />
                {liveOccupancy > 100 && (
                  <Notice tone='bad' style={{ marginTop: 10, marginBottom: 0 }}>
                    Total cargo exceeds vessel capacity. Reduce the volumes or split the voyage.
                  </Notice>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ LAND: ROUTE ═══════════════════════════════════ */}
        {!isSea && (
          <div style={s.card}>
            <SectionLabel>ROUTE</SectionLabel>
            {landRoutes.length > 0 && (
              <Sel label='Load Saved Route' value={landRouteId} onChange={loadSavedLand}>
                <option value=''>— Enter manually —</option>
                {landRoutes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.code ? `[${r.code}] ` : ''}{r.name || `${r.origin} → ${r.destination}`}
                  </option>
                ))}
              </Sel>
            )}
            <div style={{ display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
              <Inp label='Origin' value={landRoute.origin} onChange={v => slr('origin', v)} />
              <Inp label='Destination' value={landRoute.destination}
                onChange={v => slr('destination', v)} />
              <Inp label='Distance (km, one way)' type='number' value={landRoute.distanceKm}
                onChange={v => slr('distanceKm', v)}
                hint={`Round trip is calculated automatically at ${LAND_SPEED_KMH} km/h`} />
              <Inp label='Cargo Carried (KL)' type='number' value={landRoute.cargoKL}
                onChange={v => slr('cargoKL', v)}
                hint={asset ? `Blank = full capacity (${idr0(asset.capacityKL)} KL)` : undefined} />
              <Inp label='Loading (hrs)' type='number' value={landRoute.loadingHours}
                onChange={v => slr('loadingHours', v)} />
              <Inp label='Unloading (hrs)' type='number' value={landRoute.unloadingHours}
                onChange={v => slr('unloadingHours', v)} />
              <Inp label='Rest / Break (hrs)' type='number' value={landRoute.restHours}
                onChange={v => slr('restHours', v)} />
              <Inp label='Toll Fees (IDR/trip)' type='number' value={landRoute.tollFees}
                onChange={v => slr('tollFees', v)} />
              <Inp label='Portal Fees / Uang Jalan (IDR/trip)' type='number'
                value={landRoute.portalFees} onChange={v => slr('portalFees', v)} />
              <Inp label='Other Fees (IDR/trip)' type='number' value={landRoute.otherFees}
                onChange={v => slr('otherFees', v)} />
            </div>
            <Notice tone='good' style={{ marginTop: 8 }}>
              Average speed fixed at {LAND_SPEED_KMH} km/h — safety standard, not adjustable.
            </Notice>
            {asset && liveCargo > 0 && (
              <div style={{ ...s.cardInset, marginBottom: 0 }}>
                <OccupancyBar cargoKL={liveCargo} capacityKL={liveCapacity} pct={liveOccupancy} />
              </div>
            )}
          </div>
        )}

        {/* ══ SCENARIO CONTROLS ═════════════════════════════ */}
        <div style={s.card}>
          <SectionLabel>SCENARIO PARAMETERS</SectionLabel>
          <div style={{ display: 'grid',
            gridTemplateColumns: isSea ? 'repeat(auto-fit,minmax(220px,1fr))'
                                       : 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
            <div>
              <label style={s.label}>
                OP. DAYS OFFSET: {opDaysOffset > 0 ? '+' : ''}{opDaysOffset} days
              </label>
              <input type='range' min='-30' max='30' step='1' value={opDaysOffset}
                onChange={e => { setOpDaysOffset(+e.target.value); setResult(null); }}
                style={{ width: '100%', accentColor: T.amber }} />
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: T.textDim }}>
                <span>−30</span><span>+30</span>
              </div>
            </div>
            <div>
              <label style={s.label}>
                MAINTENANCE MULTIPLIER: {(+maintMultiplier).toFixed(1)}×
              </label>
              <input type='range' min='0.5' max='1.5' step='0.1' value={maintMultiplier}
                onChange={e => { setMaintMultiplier(+e.target.value); setResult(null); }}
                style={{ width: '100%', accentColor: T.amber }} />
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: T.textDim }}>
                <span>0.5×</span><span>1.5×</span>
              </div>
            </div>
            {isSea && (
              <div>
                <label style={s.label}>RPM SETTING — MAIN ENGINE ONLY</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['low', 'standard', 'high'].map(k => (
                    <button key={k} onClick={() => { setRpmKey(k); setResult(null); }}
                      style={{ ...s.btn('ghost'), flex: 1, padding: '6px 4px',
                        borderColor: rpmKey === k ? T.amber : T.border,
                        color: rpmKey === k ? T.amber : T.textDim }}>
                      {k.toUpperCase()}
                      <div style={{ fontSize: 8, color: T.textDim, marginTop: 2 }}>
                        ×{asset?.rpmCoefficients?.[k] ??
                          (k === 'standard' ? 1.0 : k === 'low' ? 0.75 : 1.3)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <Btn onClick={calculate}>Calculate OAT</Btn>
            {result && <Btn variant='ghost' onClick={saveCalc}>💾 Save Snapshot</Btn>}
          </div>
        </div>
      </>}

      {/* ══ RESULTS ═════════════════════════════════════════ */}
      {result && <>
        {/* Headline */}
        <div style={{ ...s.card, borderColor: `${T.amber}66` }}>
          <SectionLabel>OAT RESULT</SectionLabel>
          {result.returnsToBase === false && isSea && (
            <Notice tone='bad'>
              <strong>This figure excludes the return to base.</strong> The voyage ends away
              from the loading port, so repositioning time and fuel are not in the cost.
              Treat this OAT as a floor, not a quotable rate.
            </Notice>
          )}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5 }}>IDR / LITRE</div>
              <div style={{ fontSize: 34, fontWeight: 700, color: T.amber,
                fontFamily: T.font, lineHeight: 1.2 }}>
                Rp {idr2(result.oatPerL)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5 }}>IDR / KL</div>
              <div style={{ fontSize: 34, fontWeight: 700, color: T.amber,
                fontFamily: T.font, lineHeight: 1.2 }}>
                Rp {idr0(result.oatPerKL)}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <OccupancyBar cargoKL={result.totalCargoKL ?? result.cargoKL}
                capacityKL={result.capacityKL} pct={result.occupancyPct} />
            </div>
          </div>
          {result.unusedKL > 0 && (
            <Notice tone='warn' style={{ marginTop: 14 }}>
              Cost is divided by <strong>{idr0(result.totalCargoKL ?? result.cargoKL)} KL</strong>{' '}
              actually carried, not the {idr0(result.capacityKL)} KL capacity. The{' '}
              {idr0(result.unusedKL)} KL of unused space raises the rate —
              filling it would lower OAT per litre.
            </Notice>
          )}
        </div>

        <div style={{ display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16 }}>
          {/* Operations */}
          <div style={s.card}>
            <SectionLabel>ANNUAL OPERATIONS</SectionLabel>
            <Row label='Calendar Days' value='365 days' />
            <Row label='Maintenance / Docking' value={`−${result.maintDaysLost} days`}
              color={T.red} indent />
            {opDaysOffset !== 0 && (
              <Row label='Scenario Offset'
                value={`${opDaysOffset > 0 ? '+' : ''}${opDaysOffset} days`}
                color={T.blue} indent />
            )}
            <Row label='Effective Operational Days' value={`${result.effectiveDays} days`}
              bold color={T.amber} />
            <Row label={isSea ? 'Voyage Time' : 'Round-trip Time'}
              value={`${result.voyageHours.toFixed(1)} hrs`} />
            {isSea && <>
              <Row label='Sailing' value={`${result.sailHoursTotal.toFixed(1)} hrs`} indent />
              <Row label='Loading' value={`${result.loadHours.toFixed(1)} hrs`} indent />
              <Row label='Discharging' value={`${result.unloadHoursTotal.toFixed(1)} hrs`} indent />
              <Row label='Port Waiting' value={`${result.waitHours.toFixed(1)} hrs`} indent />
            </>}
            <Row label={isSea ? 'Voyages per Year' : 'Trips per Year'}
              value={`${result.tripsPerYear}`} bold />
            <Row label='Annual Volume' value={`${idr0(result.annualVolumeKL)} KL`}
              bold color={T.green} />
          </div>

          {/* Fixed costs */}
          <div style={s.card}>
            <SectionLabel>FIXED COSTS (ANNUAL)</SectionLabel>
            {result.financingMode === 'installment'
              ? <Row label='Installment × 12' value={`Rp ${idr0(result.installmentAnnual)}`}
                  indent color={T.blue} hint='(incl. insurance + depreciation)' />
              : <Row label='Depreciation' value={`Rp ${idr0(result.depreciation)}`} indent />}
            <Row label={isSea ? 'Crew Salary' : 'Driver Salary'}
              value={`Rp ${idr0(result.salaryAnnual)}`} indent />
            <Row label='Insurance' value={`Rp ${idr0(result.insurance)}`} indent />
            <Row label='Maintenance Reserve' value={`Rp ${idr0(result.maintCost)}`} indent
              hint={maintMultiplier !== 1 ? `×${(+maintMultiplier).toFixed(1)}` : undefined} />
            <Row label='Repair Buffer' value={`Rp ${idr0(result.repairBuffer)}`} indent />
            {result.overheadAnnual > 0 && (
              <Row label='Overhead' value={`Rp ${idr0(result.overheadAnnual)}`}
                indent color={T.teal} />
            )}
            {result.perizinanAnnual > 0 && (
              <Row label='Perizinan' value={`Rp ${idr0(result.perizinanAnnual)}`}
                indent color={T.teal} />
            )}
            <Row label='TOTAL FIXED' value={`Rp ${idr0(result.totalFixed)}`}
              bold color={T.amber} />
          </div>

          {/* Operating */}
          <div style={s.card}>
            <SectionLabel>
              OPERATING COST ({isSea ? 'PER VOYAGE' : 'PER TRIP'} × {result.tripsPerYear})
            </SectionLabel>
            {isSea ? <>
              <Row label='Fuel — total' value={`Rp ${idr0(result.fuelCost)}`} indent bold />
              <Row label='Main engine' value={`${idr0(result.mainFuelL)} L`} indent
                hint={result.rpmCoeff !== 1 ? `RPM ×${result.rpmCoeff}` : undefined} />
              <Row label='Aux engine' value={`${idr0(result.auxFuelL)} L`} indent />
              <Row label='Extra heater' value={`${idr0(result.heaterFuelL)} L`} indent />
              <Row label='Total litres' value={`${idr0(result.totalFuelL)} L`} indent
                color={T.textDim} />
              <Row label='Crew Premi' value={`Rp ${idr0(result.premi)}`} indent />
              <Row label='Port Fees (all ports)' value={`Rp ${idr0(result.portFees)}`} indent />
              <Row label='Other Fees' value={`Rp ${idr0(result.otherFees)}`} indent />
              <Row label='Per Voyage Subtotal' value={`Rp ${idr0(result.opPerVoyage)}`} bold />
            </> : <>
              <Row label='Fuel' value={`Rp ${idr0(result.fuelCost)}`} indent
                hint={`${idr0(result.fuelLitres)} L`} />
              <Row label='Driver Premi' value={`Rp ${idr0(result.premi)}`} indent />
              <Row label='Toll Fees' value={`Rp ${idr0(result.tollFees)}`} indent />
              <Row label='Portal Fees / Uang Jalan' value={`Rp ${idr0(result.portalFees)}`}
                indent color={T.amber} />
              {result.kmMaintPerTrip > 0 && (
                <Row label='Maintenance per km' value={`Rp ${idr0(result.kmMaintPerTrip)}`}
                  indent color={T.teal} />
              )}
              <Row label='Other Fees' value={`Rp ${idr0(result.otherFees)}`} indent />
              <Row label='Per Trip Subtotal' value={`Rp ${idr0(result.opPerTrip)}`} bold />
            </>}
            <Row label='TOTAL OPERATING' value={`Rp ${idr0(result.totalOperating)}`}
              bold color={T.blue} />
            <Row label='TOTAL ANNUAL COST' value={`Rp ${idr0(result.totalAnnualCost)}`}
              bold color={T.amber} />
          </div>
        </div>

        {/* ── PER-LEG BREAKDOWN ────────────────────────────── */}
        {isSea && result.legs?.length > 0 && (
          <div style={s.card}>
            <SectionLabel>PER-LEG OAT — SHARED COSTS ALLOCATED BY VOLUME</SectionLabel>
            <Notice tone='info'>
              Each leg is charged its own fuel and port fee directly. Everything shared —
              annual fixed costs, crew premi, the loading-port fee, and any ballast-leg fuel —
              is split in proportion to the cargo each leg carries. A different allocation
              basis would move cost between legs; the blended figure above does not change.
            </Notice>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Leg', 'Destination', 'Cargo', 'Share', 'Fuel (L)',
                    'Direct Cost', 'Allocated Share', 'Leg Total', 'OAT / KL', 'OAT / L']
                    .map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {result.legs.map((l, i) => (
                    <tr key={l.id || i}>
                      <td style={s.td}>
                        {l.isBallast || l.cargoKL <= 0
                          ? <Badge color={T.textDim}>BALLAST</Badge>
                          : <Badge color={T.teal}>LEG {i + 1}</Badge>}
                      </td>
                      <td style={{ ...s.td, fontWeight: 700 }}>
                        {l.destination || '–'}
                        {l.cargoName && (
                          <div style={{ fontSize: 9, color: T.textDim, fontWeight: 400 }}>
                            {l.cargoName}
                          </div>
                        )}
                      </td>
                      <td style={s.tdNum}>{l.cargoKL > 0 ? `${idr0(l.cargoKL)} KL` : '–'}</td>
                      <td style={s.tdNum}>
                        {l.volumeShare > 0 ? `${(l.volumeShare * 100).toFixed(1)}%` : '–'}
                      </td>
                      <td style={s.tdNum}>{idr0(l.legFuelL)}</td>
                      <td style={s.tdNum}>Rp {idr0(l.directCost)}</td>
                      <td style={s.tdNum}>Rp {idr0(l.allocatedShared)}</td>
                      <td style={{ ...s.tdNum, fontWeight: 700 }}>Rp {idr0(l.legTotalCost)}</td>
                      <td style={{ ...s.tdNum, color: T.amber, fontWeight: 700 }}>
                        {l.cargoKL > 0 ? `Rp ${idr0(l.legOatPerKL)}` : '–'}
                      </td>
                      <td style={{ ...s.tdNum, color: T.amber }}>
                        {l.cargoKL > 0 ? `Rp ${idr2(l.legOatPerL)}` : '–'}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...s.td, fontWeight: 700 }} colSpan={2}>BLENDED (all cargo)</td>
                    <td style={{ ...s.tdNum, fontWeight: 700 }}>
                      {idr0(result.totalCargoKL)} KL</td>
                    <td style={s.tdNum}>100%</td>
                    <td style={{ ...s.tdNum, fontWeight: 700 }}>{idr0(result.totalFuelL)}</td>
                    <td style={s.tdNum} colSpan={2} />
                    <td style={{ ...s.tdNum, fontWeight: 700 }}>
                      Rp {idr0(result.totalAnnualCost / Math.max(1, result.tripsPerYear))}</td>
                    <td style={{ ...s.tdNum, color: T.amber, fontWeight: 700 }}>
                      Rp {idr0(result.oatPerKL)}</td>
                    <td style={{ ...s.tdNum, color: T.amber, fontWeight: 700 }}>
                      Rp {idr2(result.oatPerL)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {result.ballastFuelCost > 0 && (
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 10 }}>
                Ballast-leg fuel of Rp {idr0(result.ballastFuelCost)} per voyage carries no cargo,
                so it is pooled into the shared allocation rather than charged to one destination.
              </div>
            )}
          </div>
        )}
      </>}

      {/* ══ SCENARIOS ═══════════════════════════════════════ */}
      {canScenario && (conservative || standard || aggressive) && (
        <div style={s.card}>
          <SectionLabel>SCENARIO COMPARISON</SectionLabel>
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
            {[['CONSERVATIVE', conservative, T.red,   '−15 days · ×1.3 maint'],
              ['STANDARD',     standard,     T.amber, 'base assumptions'],
              ['AGGRESSIVE',   aggressive,   T.green,
                `+15 days · ×0.8 maint${isSea ? ' · high RPM' : ''}`]].map(([label, r, c, note]) =>
              r ? (
                <div key={label} style={{ ...s.card, marginBottom: 0, borderColor: `${c}55` }}>
                  <div style={{ fontSize: 9, color: c, letterSpacing: 2,
                    fontWeight: 700, marginBottom: 10 }}>{label}</div>
                  <div style={{ fontSize: 9, color: T.textDim, marginBottom: 10 }}>
                    Days: <strong style={{ color: c }}>{r.effectiveDays}</strong> ·{' '}
                    {isSea ? 'Voyages' : 'Trips'}: <strong style={{ color: c }}>{r.tripsPerYear}</strong>
                  </div>
                  <div style={{ fontSize: 9, color: T.textDim }}>IDR / LITRE</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: T.font }}>
                    Rp {idr2(r.oatPerL)}
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
                    Rp {idr0(r.oatPerKL)} / KL
                  </div>
                  <div style={{ fontSize: 9, color: T.textFaint, marginTop: 8 }}>{note}</div>
                </div>
              ) : <div key={label} />
            )}
          </div>
        </div>
      )}

      {/* ══ SAVED CALCULATIONS ══════════════════════════════ */}
      {savedCalcs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <SectionLabel>SAVED CALCULATIONS</SectionLabel>
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Date', 'Asset', 'Route', 'Fuel', 'Occupancy',
                    isSea ? 'Voyages/yr' : 'Trips/yr', 'OAT / L', 'OAT / KL', '']
                    .map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {[...savedCalcs].reverse().map(c => (
                    <tr key={c.id}>
                      <td style={{ ...s.td, fontSize: 10, color: T.textDim }}>{c.savedAt}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{c.assetName}</td>
                      <td style={{ ...s.td, fontSize: 11 }}>{c.routeName}</td>
                      <td style={s.tdNum}>Rp {idr0(c.fuelPrice)}</td>
                      <td style={s.tdNum}>
                        {c.occupancyPct != null ? `${c.occupancyPct.toFixed(0)}%` : '–'}
                      </td>
                      <td style={s.tdNum}>{c.result?.tripsPerYear}</td>
                      <td style={{ ...s.tdNum, color: T.amber, fontWeight: 700 }}>
                        Rp {idr2(c.result?.oatPerL)}</td>
                      <td style={{ ...s.tdNum, color: T.amber }}>
                        Rp {idr0(c.result?.oatPerKL)}</td>
                      <td style={s.td}>
                        <Btn variant='ghost' onClick={() => {
                          if (!confirm('Delete this saved calculation?')) return;
                          updateDB(d => ({ ...d,
                            calculations: (d.calculations || []).filter(x => x.id !== c.id) }));
                        }} style={{ padding: '3px 10px', color: T.red }}>Del</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
