// FreightOps utils

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

// ── Default maintenance plans ────────────────────────────────
export const DEFAULT_VESSEL_MAINTENANCE = [
  { type: 'Routine Service',    intervalMonths: 3,  durationDays: 1,  costIDR: 0 },
  { type: 'Small Docking',      intervalMonths: 18, durationDays: 5,  costIDR: 0 },
  { type: 'Medium Docking',     intervalMonths: 36, durationDays: 14, costIDR: 0 },
  { type: 'Big Docking',        intervalMonths: 48, durationDays: 30, costIDR: 0 },
  { type: 'BKI/Permit Renewal', intervalMonths: 12, durationDays: 3,  costIDR: 0 },
];

export const DEFAULT_TRUCK_MAINTENANCE = [
  { type: 'Routine Service',   intervalMonths: 3,  durationDays: 1, costIDR: 0 },
  { type: 'Major Service',     intervalMonths: 12, durationDays: 2, costIDR: 0 },
  { type: 'STNK/KIR Renewal', intervalMonths: 12, durationDays: 2, costIDR: 0 },
];

// ── Annual maintenance days & cost from plan ─────────────────
export function calcMaintenanceAnnual(plan) {
  let days = 0, cost = 0;
  (plan || []).forEach(p => {
    const occurrences = 12 / (p.intervalMonths || 12);
    days += (p.durationDays || 0) * occurrences;
    cost += (p.costIDR || 0) * occurrences;
  });
  return { days: Math.round(days), cost: Math.round(cost) };
}

// ── Annualized perizinan cost from master data ───────────────
export function calcPerizinanAnnual(perizinanList) {
  let annual = 0;
  (perizinanList || []).forEach(p => {
    // intervalMonths: how often it's renewed (e.g. 12 for annual, 6 for semi-annual)
    const occurrences = 12 / (p.intervalMonths || 12);
    annual += (p.costIDR || 0) * occurrences;
  });
  return Math.round(annual);
}

// ── Core OAT calculation ──────────────────────────────────────
export function calcOAT(asset, route, params, masterData) {
  const {
    fuelPricePerLiter,
    opDaysOffset    = 0,
    maintMultiplier = 1.0,
    rpmKey          = 'standard',
    overheadCost    = 0,       // legacy lump sum — superseded by masterData overhead pool
  } = params;

  const type = asset.type; // 'vessel' | 'truck'

  // ── 1. Effective operational days ────────────────────────────
  const maintAnnual   = calcMaintenanceAnnual(asset.maintenancePlan);
  const baseDays      = 365 - Math.round(maintAnnual.days);
  const effectiveDays = Math.max(1, baseDays + opDaysOffset);

  // ── 2. Voyage time (hours) ───────────────────────────────────
  let voyageHours;
  if (type === 'vessel') {
    const speedKnots = (route.speedKnots || 8) * (rpmKey === 'low' ? 0.85 : rpmKey === 'high' ? 1.15 : 1.0);
    const sailHours  = (route.distanceNM || 0) * 2 / speedKnots;
    voyageHours = sailHours + (route.loadingHours || 0) + (route.unloadingHours || 0) + (route.portWaitingHours || 0);
  } else {
    const SPEED_KMH  = 30;
    const driveHours = (route.distanceKm || 0) * 2 / SPEED_KMH;
    voyageHours = driveHours + (route.loadingHours || 0) + (route.unloadingHours || 0) + (route.restHours || 0);
  }
  voyageHours = Math.max(0.5, voyageHours);

  // ── 3. Trips per year ────────────────────────────────────────
  const tripsPerYear = Math.floor((effectiveDays * 24) / voyageHours);

  // ── 4. Annual volume ─────────────────────────────────────────
  const capacityL     = (asset.capacityKL || 0) * 1000;
  const annualVolumeL = tripsPerYear * capacityL;
  const annualVolumeKL = annualVolumeL / 1000;

  // ── 5. Fixed costs (annual) ──────────────────────────────────
  const purchasePrice = +(asset.purchasePrice || 0);
  const residualValue = +(asset.residualValue || 0);
  const depYears      = +(asset.depreciationYears || 8);

  let depreciation = 0;
  let monthlyInstallmentAnnual = 0;
  let financingMode = asset.financingMode || 'depreciation';

  if (financingMode === 'installment') {
    // PTE method: use actual monthly installment × 12
    // (includes principal, interest, insurance, depreciation already)
    monthlyInstallmentAnnual = +(asset.monthlyInstallment || 0) * 12;
    depreciation = 0; // not used in installment mode
  } else {
    depreciation = depYears > 0 ? (purchasePrice - residualValue) / depYears : 0;
  }

  let salaryAnnual;
  if (type === 'vessel') {
    salaryAnnual = +(asset.crewMonthlyCost || 0) * 12;
  } else {
    salaryAnnual = asset.driverType === 'borongan'
      ? 0  // premi handled in operating
      : +(asset.driverMonthlyCost || 0) * 12;
  }

  // In installment mode, insurance & repair buffer are included in the installment
  const insurance    = financingMode === 'installment' ? 0 : +(asset.insuranceAnnual || 0);
  const maintCost    = Math.round(maintAnnual.cost * maintMultiplier);
  const repairBuffer = financingMode === 'installment' ? 0 : Math.round(purchasePrice * (+(asset.repairBufferPct || 1.5) / 100));

  // ── Overhead from master data pool (PTE or PTS) ──────────────
  let overheadAnnual = +overheadCost || 0; // legacy fallback
  if (masterData) {
    const company = type === 'vessel' ? 'PTS' : 'PTE';
    const pool    = masterData.overheadPool?.[company];
    if (pool) {
      const totalMonthly  = (pool.items || []).reduce((s, i) => s + (+i.amount || 0), 0);
      const activeUnits   = +(pool.activeUnits || 1);
      const perUnitMonthly = totalMonthly / activeUnits;
      overheadAnnual = perUnitMonthly * 12;
    }
  }

  // ── Perizinan from master data ────────────────────────────────
  let perizinanAnnual = 0;
  if (masterData) {
    const company = type === 'vessel' ? 'PTS' : 'PTE';
    const pList   = masterData.perizinan?.[company] || [];
    perizinanAnnual = calcPerizinanAnnual(pList);
  }

  const financingCost = financingMode === 'installment' ? monthlyInstallmentAnnual : depreciation;
  const totalFixed = financingCost + salaryAnnual + insurance + maintCost + repairBuffer + overheadAnnual + perizinanAnnual;

  // ── 6. Operating costs (per trip × trips) ────────────────────
  let fuelCostPerTrip;
  if (type === 'vessel') {
    const rpmCoeff     = asset.rpmCoefficients?.[rpmKey] ?? 1.0;
    const sailHours    = voyageHours - (route.loadingHours || 0) - (route.unloadingHours || 0) - (route.portWaitingHours || 0);
    fuelCostPerTrip    = sailHours * (asset.consumptionLperHour || 0) * rpmCoeff * fuelPricePerLiter;
  } else {
    // Use maintenance rates from master data if available, otherwise asset plan
    const distTotal = (route.distanceKm || 0) * 2;

    let serviceRatePerKm = 0, tireRatePerKm = 0;
    if (masterData?.maintenanceRates?.PTE) {
      serviceRatePerKm = +(masterData.maintenanceRates.PTE.servicePerKm || 0);
      tireRatePerKm    = +(masterData.maintenanceRates.PTE.tirePerKm    || 0);
    }

    const kmMaintCostPerTrip = distTotal * (serviceRatePerKm + tireRatePerKm);
    fuelCostPerTrip = distTotal / (asset.consumptionKmPerL || 1) * fuelPricePerLiter;
    // If km-based maintenance rates exist, override the annual plan for operating cost
    if (kmMaintCostPerTrip > 0) {
      // Return km-based maintenance separately so UI can show it
      var kmMaintPerTrip = kmMaintCostPerTrip;
    }
  }

  const premi = type === 'vessel'
    ? +(asset.crewPremiPerTrip || 0)
    : asset.driverType === 'borongan' ? +(asset.driverPremiPerTrip || 0) : 0;

  const portOrToll  = type === 'vessel'
    ? (+(route.portFeeOrigin || 0) + +(route.portFeeDestination || 0))
    : +(route.tollFees || 0);

  const portalFees = +(route.portalFees || route.informalFees || 0); // support old key
  const otherFees  = +(route.otherFees || 0);
  const kmMaint    = (typeof kmMaintPerTrip !== 'undefined') ? kmMaintPerTrip : 0;

  const opPerTrip      = fuelCostPerTrip + premi + portOrToll + portalFees + otherFees + kmMaint;
  const totalOperating = opPerTrip * tripsPerYear;
  const totalAnnualCost = totalFixed + totalOperating;

  const oatPerL  = annualVolumeL  > 0 ? totalAnnualCost / annualVolumeL  : 0;
  const oatPerKL = annualVolumeKL > 0 ? totalAnnualCost / annualVolumeKL : 0;

  return {
    effectiveDays,
    voyageHours,
    tripsPerYear,
    annualVolumeL,
    annualVolumeKL,
    // Fixed breakdown
    financingMode,
    financingCost,
    salaryAnnual,
    insurance,
    maintCost,
    repairBuffer,
    overheadAnnual,
    perizinanAnnual,
    overheadCost: overheadAnnual, // compat
    totalFixed,
    // Operating breakdown
    fuelCostPerTrip,
    premi,
    portOrToll,
    portalFees,
    kmMaintPerTrip: kmMaint,
    otherFees,
    opPerTrip,
    totalOperating,
    // Summary
    totalAnnualCost,
    oatPerL,
    oatPerKL,
  };
}

// ── INIT_DB ───────────────────────────────────────────────────
export const INIT_DB = {
  vessels:        [],
  trucks:         [],
  routes:         [],
  calculations:   [],
  deliveryOrders: [],
  settings:     { bunkerPrice: 0, dieselPrice: 0 },
  // Master data
  overheadPool: {
    PTE: {
      activeUnits: 17,
      items: [
        { id: 'oh1', name: 'Gaji Staff',        amount: 90000000 },
        { id: 'oh2', name: 'BPJS',               amount: 4900000 },
        { id: 'oh3', name: 'Telephone',          amount: 350000 },
        { id: 'oh4', name: 'Listrik',            amount: 4400000 },
        { id: 'oh5', name: 'PDAM',               amount: 1000000 },
        { id: 'oh6', name: 'ATK',                amount: 1500000 },
        { id: 'oh7', name: 'Expedisi',           amount: 4000000 },
        { id: 'oh8', name: 'Sewa Bangunan',      amount: 21000000 },
        { id: 'oh9', name: 'Entertain',          amount: 25000000 },
        { id: 'oh10',name: 'Keamanan',           amount: 5000000 },
        { id: 'oh11',name: 'Dinas',              amount: 22000000 },
        { id: 'oh12',name: 'Umum + Admin',       amount: 13000000 },
      ],
    },
    PTS: {
      activeUnits: 1,
      items: [],
    },
  },
  perizinan: {
    PTE: [
      { id: 'pz1', name: 'STNK (1 tahun)',  intervalMonths: 12, costIDR: 7000000 },
      { id: 'pz2', name: 'KIR/Keur (6 bln)', intervalMonths: 6,  costIDR: 800000 },
      { id: 'pz3', name: 'Tera (2 tahun)',   intervalMonths: 24, costIDR: 1650000 },
    ],
    PTS: [
      { id: 'pz1', name: 'BKI Renewal',      intervalMonths: 12, costIDR: 0 },
      { id: 'pz2', name: 'Izin Berlayar',    intervalMonths: 12, costIDR: 0 },
    ],
  },
  maintenanceRates: {
    PTE: {
      servicePerKm: 800,
      tirePerKm:    1300,
    },
    PTS: {
      servicePerKm: 0,
      tirePerKm:    0,
    },
  },
};
