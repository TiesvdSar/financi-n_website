/**
 * Belastingtarieven 2026, gedeeld door de calculators (onder de AOW-leeftijd).
 *
 * Vereenvoudiging: heffingskortingen worden begrensd op de totale box 1-belasting
 * (in werkelijkheid apart voor het belasting- en het premiedeel).
 */

/** Box 1-schijven 2026. */
const BOX1 = [
  { tot: 38883, tarief: 0.3575 },
  { tot: 78426, tarief: 0.3756 },
  { tot: Infinity, tarief: 0.495 },
];
const AHK = { max: 3115, grens: 29736, afbouw: 0.06398 };
/** Arbeidskorting 2026: opbouw in drie stappen, afbouw boven € 45.592. */
const AK_OPBOUW = [
  { vanaf: 0, basis: 0, pct: 0.08324 },
  { vanaf: 11965, basis: 996, pct: 0.31009 },
  { vanaf: 25845, basis: 5300, pct: 0.0195 },
];
const AK = { max: 5685, grens: 45592, afbouw: 0.0651 };

/** Inkomensafhankelijke bijdrage Zvw 2026 die je zelf betaalt (o.a. een DGA die niet verzekerd is voor de werknemersverzekeringen). */
export const ZVW = { tarief: 0.0485, maximum: 79409 };

/** Box 2 2026: per persoon; fiscale partners kunnen elk de eerste schijf gebruiken. */
export const BOX2 = { grens: 68843, laag: 0.245, hoog: 0.31 };

/** Vennootschapsbelasting 2026. */
export const VPB = { grens: 200000, laag: 0.19, hoog: 0.258 };

function schijven(bedrag: number, tabel: { tot: number; tarief: number }[]): number {
  let belasting = 0;
  let vorige = 0;
  for (const s of tabel) {
    if (bedrag > vorige) belasting += (Math.min(bedrag, s.tot) - vorige) * s.tarief;
    vorige = s.tot;
  }
  return belasting;
}

export function box1Belasting(inkomen: number): number {
  return schijven(inkomen, BOX1);
}

export function algemeneHeffingskorting(inkomen: number): number {
  return Math.max(0, AHK.max - Math.max(0, inkomen - AHK.grens) * AHK.afbouw);
}

export function arbeidskorting(arbeidsinkomen: number): number {
  if (arbeidsinkomen <= 0) return 0;
  if (arbeidsinkomen > AK.grens) return Math.max(0, AK.max - (arbeidsinkomen - AK.grens) * AK.afbouw);
  const schijf = [...AK_OPBOUW].reverse().find((s) => arbeidsinkomen > s.vanaf)!;
  return schijf.basis + (arbeidsinkomen - schijf.vanaf) * schijf.pct;
}

/** Heffingskortingen voor iemand wiens inkomen helemaal uit arbeid bestaat. */
export function heffingskortingen(inkomen: number): number {
  return algemeneHeffingskorting(inkomen) + arbeidskorting(inkomen);
}

/** Inkomstenbelasting box 1 na heffingskortingen (nooit negatief). */
export function nettoBelasting(inkomen: number): number {
  return Math.max(0, box1Belasting(inkomen) - heffingskortingen(inkomen));
}

export function zvwBijdrage(loon: number): number {
  return Math.min(Math.max(0, loon), ZVW.maximum) * ZVW.tarief;
}

/** Box 2-belasting over een uitkering; `personen` = 2 als fiscale partners de aandelen samen hebben. */
export function box2Belasting(bedrag: number, personen = 1): number {
  if (bedrag <= 0) return 0;
  const grens = BOX2.grens * personen;
  return Math.min(bedrag, grens) * BOX2.laag + Math.max(0, bedrag - grens) * BOX2.hoog;
}

export function vpb(winst: number): number {
  if (winst <= 0) return 0;
  return Math.min(winst, VPB.grens) * VPB.laag + Math.max(0, winst - VPB.grens) * VPB.hoog;
}
