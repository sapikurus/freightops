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
  { type: 'Routine Service',    intervalMonths: 3,  durationDays: 1, costIDR: 0 },
  { type: 'Major Service',      intervalMonths: 12, durationDays: 2, costIDR: 0 },
  { type: 'STNK/KIR Renewal',  intervalMonths: 12, durationDays: 2, costIDR: 0 },
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

// ── Core OAT calculation ──────────────────────────────────────
export function calcOAT(asset, route, params) {
  const {
    fuelPricePerLiter,
    opDaysOffset    = 0,
    maintMultiplier = 1.0,
    rpmKey          = 'standard',
    overheadCost    = 0,       // lump sum IDR added to total annual fixed cost
  } = params;

  const type = asset.type; // 'vessel' | 'truck'

  // ── 1. Effective operational days ────────────────────────────
  const maintAnnual = calcMaintenanceAnnual(asset.maintenancePlan);
  const baseDays    = 365 - Math.round(maintAnnual.days);
  const effectiveDays = Math.max(1, baseDays + opDaysOffset);

  // ── 2. Voyage time (hours) ───────────────────────────────────
  let voyageHours;
  if (type === 'vessel') {
    const rpmCoeff  = asset.rpmCoefficients?.[rpmKey] ?? 1.0;
    const speedKnots = (route.speedKnots || 8) * (rpmKey === 'low' ? 0.85 : rpmKey === 'high' ? 1.15 : 1.0);
    const sailHours  = (route.distanceNM || 0) * 2 / speedKnots;
    voyageHours = sailHours + (route.loadingHours || 0) + (route.unloadingHours || 0) + (route.portWaitingHours || 0);
  } else {
    const SPEED_KMH  = 30; // fixed
    const driveHours = (route.distanceKm || 0) * 2 / SPEED_KMH;
    voyageHours = driveHours + (route.loadingHours || 0) + (route.unloadingHours || 0) + (route.restHours || 0);
  }
  voyageHours = Math.max(0.5, voyageHours);

  // ── 3. Trips per year ────────────────────────────────────────
  const tripsPerYear = Math.floor((effectiveDays * 24) / voyageHours);

  // ── 4. Annual volume ─────────────────────────────────────────
  const capacityL    = (asset.capacityKL || 0) * 1000; // KL → Liters
  const annualVolumeL = tripsPerYear * capacityL;
  const annualVolumeKL = annualVolumeL / 1000;

  // ── 5. Fixed costs (annual) ──────────────────────────────────
  const purchasePrice   = +(asset.purchasePrice || 0);
  const residualValue   = +(asset.residualValue || 0);
  const depYears        = +(asset.depreciationYears || 8);
  const depreciation    = depYears > 0 ? (purchasePrice - residualValue) / depYears : 0;

  let salaryAnnual;
  if (type === 'vessel') {
    salaryAnnual = +(asset.crewMonthlyCost || 0) * 12;
  } else {
    salaryAnnual = asset.driverType === 'borongan'
      ? 0  // premi handled in operating
      : +(asset.driverMonthlyCost || 0) * 12;
  }

  const insurance       = +(asset.insuranceAnnual || 0);
  const maintCost       = Math.round(maintAnnual.cost * maintMultiplier);
  const repairBuffer    = Math.round(purchasePrice * (+(asset.repairBufferPct || 1.5) / 100));

  const totalFixed = depreciation + salaryAnnual + insurance + maintCost + repairBuffer + (+overheadCost || 0);

  // ── 6. Operating costs (per trip × trips) ────────────────────
  let fuelCostPerTrip;
  if (type === 'vessel') {
    const rpmCoeff         = asset.rpmCoefficients?.[rpmKey] ?? 1.0;
    const sailHours        = voyageHours - (route.loadingHours || 0) - (route.unloadingHours || 0) - (route.portWaitingHours || 0);
    fuelCostPerTrip        = sailHours * (asset.consumptionLperHour || 0) * rpmCoeff * fuelPricePerLiter;
  } else {
    fuelCostPerTrip = (route.distanceKm || 0) * 2 / (asset.consumptionKmPerL || 1) * fuelPricePerLiter;
  }

  const premi = type === 'vessel'
    ? +(asset.crewPremiPerTrip || 0)
    : asset.driverType === 'borongan' ? +(asset.driverPremiPerTrip || 0) : 0;

  const portOrToll  = type === 'vessel'
    ? (+(route.portFeeOrigin || 0) + +(route.portFeeDestination || 0))
    : +(route.tollFees || 0);

  const informalFees = +(route.informalFees || 0);
  const otherFees    = +(route.otherFees || 0);

  const opPerTrip       = fuelCostPerTrip + premi + portOrToll + informalFees + otherFees;
  const totalOperating  = opPerTrip * tripsPerYear;
  const totalAnnualCost = totalFixed + totalOperating;

  const oatPerL  = annualVolumeL > 0 ? totalAnnualCost / annualVolumeL  : 0;
  const oatPerKL = annualVolumeKL > 0 ? totalAnnualCost / annualVolumeKL : 0;

  return {
    effectiveDays,
    voyageHours,
    tripsPerYear,
    annualVolumeL,
    annualVolumeKL,
    // Fixed breakdown
    depreciation,
    salaryAnnual,
    insurance,
    maintCost,
    repairBuffer,
    overheadCost:  +overheadCost || 0,
    totalFixed,
    // Operating breakdown
    fuelCostPerTrip,
    premi,
    portOrToll,
    informalFees,
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
  vessels:      [],
  trucks:       [],
  routes:       [],
  calculations: [],
  settings:     { bunkerPrice: 0, dieselPrice: 0 },
};
