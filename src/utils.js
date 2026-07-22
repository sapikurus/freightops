// FreightOps utils — calculation engine
//
// SEA model (v2): a voyage is an OPEN CHAIN of legs.
//   Loading port D → leg1 → drop Y → leg2 → drop Z → (optional ballast leg back to D)
// Each leg carries its own distance, speed, aux hours, heater hours,
// cargo dropped, and destination port fee.
//
// LAND model: unchanged single origin→destination round trip.

export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function idr(n, dp = 0) {
  if (n == null || isNaN(+n)) return '–';
  return (+n).toLocaleString('id-ID', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function idr0(n) { return idr(n, 0); }
export function idr2(n) { return idr(n, 2); }

export const LAND_SPEED_KMH = 30; // safety standard — not user-editable

// ── Default maintenance plans ────────────────────────────────
export const DEFAULT_VESSEL_MAINTENANCE = [
  { type: 'Routine Service',    intervalMonths: 3,  durationDays: 1,  costIDR: 0 },
  { type: 'Small Docking',      intervalMonths: 18, durationDays: 5,  costIDR: 0 },
  { type: 'Medium Docking',     intervalMonths: 36, durationDays: 14, costIDR: 0 },
  { type: 'Big Docking',        intervalMonths: 48, durationDays: 30, costIDR: 0 },
  { type: 'BKI/Permit Renewal', intervalMonths: 12, durationDays: 3,  costIDR: 0 },
];

export const DEFAULT_TRUCK_MAINTENANCE = [
  { type: 'Routine Service',  intervalMonths: 3,  durationDays: 1, costIDR: 0 },
  { type: 'Major Service',    intervalMonths: 12, durationDays: 2, costIDR: 0 },
  { type: 'STNK/KIR Renewal', intervalMonths: 12, durationDays: 2, costIDR: 0 },
];

export const DEFAULT_VESSEL_TYPES = [
  { id: 'vt1', name: 'SPOB' },
  { id: 'vt2', name: 'Tanker' },
  { id: 'vt3', name: 'OB' },
  { id: 'vt4', name: 'Tug & Barge' },
];

// ── Annual maintenance days & cost from plan ─────────────────
export function calcMaintenanceAnnual(plan) {
  let days = 0, cost = 0;
  (plan || []).forEach(p => {
    const occurrences = 12 / (+p.intervalMonths || 12);
    days += (+p.durationDays || 0) * occurrences;
    cost += (+p.costIDR || 0) * occurrences;
  });
  return { days: Math.round(days), cost: Math.round(cost) };
}

// ── Annualized perizinan cost from master data ───────────────
export function calcPerizinanAnnual(perizinanList) {
  let annual = 0;
  (perizinanList || []).forEach(p => {
    const occurrences = 12 / (+p.intervalMonths || 12);
    annual += (+p.costIDR || 0) * occurrences;
  });
  return Math.round(annual);
}

// ── Blank leg factory ────────────────────────────────────────
export function blankLeg(seq = 1) {
  return {
    id: uid(),
    seq,
    destination:  '',
    cargoName:    '',
    distanceNM:   '',
    speedKnots:   '',
    cargoKL:      '',   // volume DROPPED at this leg's destination
    auxHours:     '',   // hours aux engine runs on this leg
    heaterHours:  '',   // hours extra heater runs on this leg
    portFee:      '',   // destination port fee, IDR
    unloadHours:  '',   // time spent discharging at this destination
    isBallast:    false, // true = repositioning leg, no cargo
  };
}

// ── Voyage geometry: hours + fuel per leg ────────────────────
// Returns per-leg detail plus voyage totals. Pure geometry + fuel,
// no cost allocation. Full precision throughout.
export function calcVoyage(vessel, voyage, opts = {}) {
  const { rpmKey = 'standard' } = opts;

  const legs = (voyage.legs || []).map(l => ({ ...l }));

  const mainLperHr   = +(vessel.consumptionLperHour    || 0); // main engine at std RPM
  const auxLperHr    = +(vessel.auxConsumptionLperHour || 0);
  const heaterLperHr = +(vessel.heaterConsumptionLperHour || 0);

  // RPM multiplier applies to MAIN ENGINE ONLY.
  const rpmCoeff = +(vessel.rpmCoefficients?.[rpmKey] ?? 1.0) || 1.0;

  const loadHours = +(voyage.loadingHours     || 0);
  const waitHours = +(voyage.portWaitingHours || 0);

  const detail = legs.map(l => {
    const dist  = +(l.distanceNM || 0);
    const speed = +(l.speedKnots || 0);
    // Guard against divide-by-zero; a zero-speed leg contributes no sail time.
    const sailHours = speed > 0 ? dist / speed : 0;

    const auxH    = +(l.auxHours    || 0);
    const heaterH = +(l.heaterHours || 0);
    const unloadH = +(l.unloadHours || 0);

    const mainFuelL   = sailHours * mainLperHr * rpmCoeff;
    const auxFuelL    = auxH      * auxLperHr;
    const heaterFuelL = heaterH   * heaterLperHr;
    const legFuelL    = mainFuelL + auxFuelL + heaterFuelL;

    return {
      ...l,
      sailHours,
      unloadHours: unloadH,
      legHours:    sailHours + unloadH,
      mainFuelL, auxFuelL, heaterFuelL, legFuelL,
      cargoKL:  l.isBallast ? 0 : +(l.cargoKL || 0),
      portFee:  +(l.portFee || 0),
    };
  });

  const sailHoursTotal   = detail.reduce((a, l) => a + l.sailHours,   0);
  const unloadHoursTotal = detail.reduce((a, l) => a + l.unloadHours, 0);
  const voyageHours      = Math.max(0.5, sailHoursTotal + unloadHoursTotal + loadHours + waitHours);

  const totalFuelL   = detail.reduce((a, l) => a + l.legFuelL, 0);
  const mainFuelL    = detail.reduce((a, l) => a + l.mainFuelL, 0);
  const auxFuelL     = detail.reduce((a, l) => a + l.auxFuelL, 0);
  const heaterFuelL  = detail.reduce((a, l) => a + l.heaterFuelL, 0);

  const totalCargoKL = detail.reduce((a, l) => a + l.cargoKL, 0);
  const portFeesTotal = detail.reduce((a, l) => a + l.portFee, 0)
                      + +(voyage.loadingPortFee || 0);

  const capacityKL = +(vessel.capacityKL || 0);
  const occupancyPct = capacityKL > 0 ? (totalCargoKL / capacityKL) * 100 : 0;

  // Return-to-base check: does the chain end where it started?
  const loadingPort = (voyage.loadingPort || '').trim().toLowerCase();
  const lastDest    = (detail[detail.length - 1]?.destination || '').trim().toLowerCase();
  const returnsToBase = loadingPort !== '' && lastDest !== '' && loadingPort === lastDest;

  return {
    legs: detail,
    sailHoursTotal, unloadHoursTotal, loadHours, waitHours, voyageHours,
    totalFuelL, mainFuelL, auxFuelL, heaterFuelL,
    totalCargoKL, capacityKL, occupancyPct,
    portFeesTotal,
    loadingPortFee: +(voyage.loadingPortFee || 0),
    returnsToBase,
    rpmCoeff,
  };
}

// ── Shared annual fixed-cost block (both sea and land) ───────
function calcFixedAnnual(asset, params, masterData, maintAnnual) {
  const { maintMultiplier = 1.0, overheadCost = 0 } = params;
  const type = asset.type === 'vessel' ? 'vessel' : 'truck';

  const purchasePrice = +(asset.purchasePrice || 0);
  const residualValue = +(asset.residualValue || 0);
  const depYears      = +(asset.depreciationYears || 8);
  const financingMode = asset.financingMode || 'depreciation';

  let depreciation = 0, installmentAnnual = 0;
  if (financingMode === 'installment') {
    // Bank installment already bundles principal, interest, insurance, depreciation.
    installmentAnnual = +(asset.monthlyInstallment || 0) * 12;
  } else {
    depreciation = depYears > 0 ? (purchasePrice - residualValue) / depYears : 0;
  }
  const financingCost = financingMode === 'installment' ? installmentAnnual : depreciation;

  const salaryAnnual = type === 'vessel'
    ? +(asset.crewMonthlyCost || 0) * 12
    : (asset.driverType === 'borongan' ? 0 : +(asset.driverMonthlyCost || 0) * 12);

  // In installment mode insurance + repair buffer are already inside the installment.
  const insurance    = financingMode === 'installment' ? 0 : +(asset.insuranceAnnual || 0);
  const repairBuffer = financingMode === 'installment' ? 0
    : purchasePrice * (+(asset.repairBufferPct ?? 1.5) / 100);

  const maintCost = maintAnnual.cost * (+maintMultiplier || 1);

  // Overhead pool from master data
  const company = type === 'vessel' ? 'PTS' : 'PTE';
  let overheadAnnual = +overheadCost || 0;
  const pool = masterData?.overheadPool?.[company];
  if (pool) {
    const totalMonthly = (pool.items || []).reduce((a, i) => a + (+i.amount || 0), 0);
    const activeUnits  = Math.max(1, +(pool.activeUnits || 1));
    overheadAnnual += (totalMonthly / activeUnits) * 12;
  }

  const perizinanAnnual = calcPerizinanAnnual(masterData?.perizinan?.[company] || []);

  const totalFixed = financingCost + salaryAnnual + insurance
                   + maintCost + repairBuffer + overheadAnnual + perizinanAnnual;

  return {
    financingMode, financingCost, depreciation, installmentAnnual,
    salaryAnnual, insurance, maintCost, repairBuffer,
    overheadAnnual, perizinanAnnual, totalFixed,
  };
}

// ── SEA: multi-leg voyage OAT ────────────────────────────────
export function calcVoyageOAT(vessel, voyage, params, masterData) {
  const {
    fuelPricePerLiter = 0,
    opDaysOffset      = 0,
    maintMultiplier   = 1.0,
    rpmKey            = 'standard',
  } = params;

  const maintAnnual   = calcMaintenanceAnnual(vessel.maintenancePlan);
  const baseDays      = 365 - maintAnnual.days;
  const effectiveDays = Math.max(1, baseDays + (+opDaysOffset || 0));

  const v = calcVoyage(vessel, voyage, { rpmKey });

  const tripsPerYear = v.voyageHours > 0
    ? Math.floor((effectiveDays * 24) / v.voyageHours) : 0;

  // Denominator is ACTUAL cargo carried, not capacity.
  // Unused capacity is therefore a real cost penalty — by design.
  const annualVolumeKL = tripsPerYear * v.totalCargoKL;
  const annualVolumeL  = annualVolumeKL * 1000;

  const fixed = calcFixedAnnual(vessel, params, masterData, maintAnnual);

  // Per-voyage operating cost
  const fuelCost   = v.totalFuelL * (+fuelPricePerLiter || 0);
  const premi      = +(vessel.crewPremiPerTrip || 0);
  const portFees   = v.portFeesTotal;
  const otherFees  = +(voyage.otherFees || 0);
  const opPerVoyage = fuelCost + premi + portFees + otherFees;

  const totalOperating  = opPerVoyage * tripsPerYear;
  const totalAnnualCost = fixed.totalFixed + totalOperating;

  const oatPerKL = annualVolumeKL > 0 ? totalAnnualCost / annualVolumeKL : 0;
  const oatPerL  = oatPerKL / 1000;

  // ── Per-leg OAT — shared costs allocated BY VOLUME ──────────
  // Direct  = that leg's own fuel + its destination port fee.
  // Shared  = annual fixed + crew premi + loading-port fee + other fees
  //           + fuel burned on ballast legs (no cargo to charge it to).
  // Allocation basis: leg cargo volume ÷ total cargo volume.
  const annualFixedPerVoyage = tripsPerYear > 0 ? fixed.totalFixed / tripsPerYear : 0;

  const ballastFuelCost = v.legs
    .filter(l => l.isBallast || l.cargoKL <= 0)
    .reduce((a, l) => a + l.legFuelL * (+fuelPricePerLiter || 0), 0);

  const sharedPerVoyage = annualFixedPerVoyage + premi
                        + v.loadingPortFee + otherFees + ballastFuelCost;

  const legResults = v.legs.map(l => {
    const share = v.totalCargoKL > 0 ? l.cargoKL / v.totalCargoKL : 0;
    // Ballast legs carry no cargo, so their fuel is pooled into shared above.
    const directCost = (l.isBallast || l.cargoKL <= 0)
      ? l.portFee
      : l.legFuelL * (+fuelPricePerLiter || 0) + l.portFee;
    const allocatedShared = sharedPerVoyage * share;
    const legTotalCost    = directCost + allocatedShared;
    const legOatPerKL     = l.cargoKL > 0 ? legTotalCost / l.cargoKL : 0;
    return {
      ...l,
      volumeShare: share,
      directCost,
      allocatedShared,
      legTotalCost,
      legOatPerKL,
      legOatPerL: legOatPerKL / 1000,
    };
  });

  return {
    mode: 'sea',
    // Voyage geometry
    legs: legResults,
    voyageHours: v.voyageHours,
    sailHoursTotal: v.sailHoursTotal,
    unloadHoursTotal: v.unloadHoursTotal,
    loadHours: v.loadHours,
    waitHours: v.waitHours,
    effectiveDays,
    maintDaysLost: maintAnnual.days,
    tripsPerYear,
    // Cargo
    totalCargoKL: v.totalCargoKL,
    capacityKL: v.capacityKL,
    occupancyPct: v.occupancyPct,
    unusedKL: Math.max(0, v.capacityKL - v.totalCargoKL),
    returnsToBase: v.returnsToBase,
    annualVolumeKL, annualVolumeL,
    // Fuel
    totalFuelL: v.totalFuelL,
    mainFuelL: v.mainFuelL,
    auxFuelL: v.auxFuelL,
    heaterFuelL: v.heaterFuelL,
    rpmCoeff: v.rpmCoeff,
    // Fixed
    ...fixed,
    // Operating
    fuelCost, premi, portFees, otherFees, opPerVoyage, totalOperating,
    ballastFuelCost, sharedPerVoyage,
    // Summary
    totalAnnualCost, oatPerL, oatPerKL,
  };
}

// ── LAND: single route round trip ────────────────────────────
export function calcTruckOAT(truck, route, params, masterData) {
  const {
    fuelPricePerLiter = 0,
    opDaysOffset      = 0,
  } = params;

  const maintAnnual   = calcMaintenanceAnnual(truck.maintenancePlan);
  const baseDays      = 365 - maintAnnual.days;
  const effectiveDays = Math.max(1, baseDays + (+opDaysOffset || 0));

  const distanceKm = +(route.distanceKm || 0);
  const distTotal  = distanceKm * 2; // out and back
  const driveHours = distTotal / LAND_SPEED_KMH;
  const voyageHours = Math.max(0.5,
    driveHours + (+route.loadingHours || 0) + (+route.unloadingHours || 0) + (+route.restHours || 0));

  const tripsPerYear = Math.floor((effectiveDays * 24) / voyageHours);

  // Truck cargo: allow partial load, defaulting to full capacity.
  const capacityKL = +(truck.capacityKL || 0);
  const cargoKL    = route.cargoKL != null && route.cargoKL !== ''
    ? +route.cargoKL : capacityKL;
  const occupancyPct = capacityKL > 0 ? (cargoKL / capacityKL) * 100 : 0;

  const annualVolumeKL = tripsPerYear * cargoKL;
  const annualVolumeL  = annualVolumeKL * 1000;

  const fixed = calcFixedAnnual(truck, params, masterData, maintAnnual);

  // Fuel: km ÷ (km/L) = litres.  NOTE: asset stores km/L, not L/km.
  const kmPerL = +(truck.consumptionKmPerL || 0);
  const fuelLitres = kmPerL > 0 ? distTotal / kmPerL : 0;
  const fuelCost   = fuelLitres * (+fuelPricePerLiter || 0);

  // Per-km maintenance rates from master data (PTE)
  const rates = masterData?.maintenanceRates?.PTE || {};
  const perKm = (+rates.servicePerKm || 0) + (+rates.tirePerKm || 0);
  const kmMaintPerTrip = distTotal * perKm;

  const premi = truck.driverType === 'borongan' ? +(truck.driverPremiPerTrip || 0) : 0;
  const tollFees   = +(route.tollFees   || 0);
  const portalFees = +(route.portalFees ?? route.informalFees ?? 0);
  const otherFees  = +(route.otherFees  || 0);

  const opPerTrip = fuelCost + premi + tollFees + portalFees + otherFees + kmMaintPerTrip;
  const totalOperating  = opPerTrip * tripsPerYear;
  const totalAnnualCost = fixed.totalFixed + totalOperating;

  const oatPerKL = annualVolumeKL > 0 ? totalAnnualCost / annualVolumeKL : 0;
  const oatPerL  = oatPerKL / 1000;

  return {
    mode: 'land',
    effectiveDays, maintDaysLost: maintAnnual.days,
    voyageHours, driveHours, tripsPerYear,
    distanceKm, distTotal,
    capacityKL, cargoKL, occupancyPct,
    unusedKL: Math.max(0, capacityKL - cargoKL),
    annualVolumeKL, annualVolumeL,
    ...fixed,
    fuelLitres, fuelCost, premi, tollFees, portalFees, otherFees,
    kmMaintPerTrip, opPerTrip, totalOperating,
    totalAnnualCost, oatPerL, oatPerKL,
  };
}

// ── Unified entry point ──────────────────────────────────────
export function calcOAT(asset, routeOrVoyage, params, masterData) {
  return asset?.type === 'vessel'
    ? calcVoyageOAT(asset, routeOrVoyage, params, masterData)
    : calcTruckOAT(asset, routeOrVoyage, params, masterData);
}

// ── Voyage code generator ────────────────────────────────────
export function nextVoyageCode(voyages) {
  const prefix = 'V-';
  const existing = (voyages || [])
    .map(v => parseInt(String(v.code || '').replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return prefix + String(next).padStart(3, '0');
}

// ── INIT_DB ───────────────────────────────────────────────────
export const INIT_DB = {
  vessels:        [],
  trucks:         [],
  voyages:        [],   // saved multi-leg sea voyage templates (geometry only)
  landRoutes:     [],   // saved land routes
  routes:         [],   // legacy — kept so old data isn't destroyed
  calculations:   [],
  deliveryOrders: [],
  settings:     { bunkerPrice: 0, dieselPrice: 0 },

  vesselTypes: DEFAULT_VESSEL_TYPES.map(x => ({ ...x })),

  overheadPool: {
    PTE: {
      activeUnits: 17,
      items: [
        { id: 'oh1', name: 'Gaji Staff',   amount: 90000000 },
        { id: 'oh2', name: 'BPJS',         amount: 4900000 },
        { id: 'oh3', name: 'Telephone',    amount: 350000 },
        { id: 'oh4', name: 'Listrik',      amount: 4400000 },
        { id: 'oh5', name: 'PDAM',         amount: 1000000 },
        { id: 'oh6', name: 'ATK',          amount: 1500000 },
        { id: 'oh7', name: 'Expedisi',     amount: 4000000 },
        { id: 'oh8', name: 'Sewa Bangunan',amount: 21000000 },
        { id: 'oh9', name: 'Entertain',    amount: 25000000 },
        { id: 'oh10',name: 'Keamanan',     amount: 5000000 },
        { id: 'oh11',name: 'Dinas',        amount: 22000000 },
        { id: 'oh12',name: 'Umum + Admin', amount: 13000000 },
      ],
    },
    PTS: { activeUnits: 1, items: [] },
  },

  perizinan: {
    PTE: [
      { id: 'pz1', name: 'STNK (1 tahun)',   intervalMonths: 12, costIDR: 7000000 },
      { id: 'pz2', name: 'KIR/Keur (6 bln)', intervalMonths: 6,  costIDR: 800000 },
      { id: 'pz3', name: 'Tera (2 tahun)',   intervalMonths: 24, costIDR: 1650000 },
    ],
    PTS: [
      { id: 'pz1', name: 'BKI Renewal',   intervalMonths: 12, costIDR: 0 },
      { id: 'pz2', name: 'Izin Berlayar', intervalMonths: 12, costIDR: 0 },
    ],
  },

  // Per-km rates apply to LAND ONLY. PTS intentionally has no entry.
  maintenanceRates: {
    PTE: { servicePerKm: 800, tirePerKm: 1300 },
  },
};
