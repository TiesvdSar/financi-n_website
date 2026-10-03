/**
 * Rekenlogica voor de maximale hypotheek en de maandlasten (normen 2026).
 *
 * Bronnen:
 * - Tijdelijke regeling hypothecair krediet, gewijzigd per 1 januari 2026 (Staatscourant 2025, 36471):
 *   financieringslastpercentages (bijlage 1), energielabelbedragen (art. 4), extra bedrag alleenstaanden (art. 3, lid 8).
 * - Nibud, Advies hypotheeknormen 2026, tabel 7: bruteringsfactoren voor de maandlast van een studielening.
 * - AFM: toetsrente bij een rentevaste periode korter dan 10 jaar is in 2026 5%.
 *
 * Vereenvoudigingen:
 * - Alleen een annuïteitenhypotheek met 30 jaar looptijd en volledig aftrekbare rente (box 1).
 * - Andere financiële verplichtingen dan een studieschuld (zoals een persoonlijke lening) zijn niet meegenomen.
 * - De netto maandlast gebruikt één aftrektarief voor de hele looptijd.
 */
import woonquote from './data/woonquote-2026.json';
import { annuiteit } from './studieschuld';

export const LOOPTIJD_MAANDEN = 360;
/** Toetsrente van de AFM voor een rentevaste periode korter dan 10 jaar (2026). */
export const AFM_TOETSRENTE = 5;
export const EXTRA_ALLEENSTAANDE = 17000;
export const ENERGIELABELS = {
  onbekend: { label: 'Weet ik niet / E, F of G', bedrag: 0 },
  CD: { label: 'C of D', bedrag: 5000 },
  AB: { label: 'A of B', bedrag: 10000 },
  'A+': { label: 'A+ of A++', bedrag: 20000 },
  'A+++': { label: 'A+++', bedrag: 25000 },
  'A++++': { label: 'A++++', bedrag: 30000 },
  'A++++G': { label: 'A++++ met energieprestatiegarantie (10+ jaar)', bedrag: 40000 },
} as const;
export type Energielabel = keyof typeof ENERGIELABELS;

/** Bruteringsfactor per renteklasse (zelfde klassen als de financieringslasttabel). */
const BRUTERINGSFACTOREN = [1.05, 1.05, 1.1, 1.15, 1.2, 1.2, 1.25, 1.3, 1.3, 1.35, 1.4, 1.4];

/** Box 1-tarieven 2026 voor de renteaftrek. */
const GRENS_SCHIJF_1 = 38883;
const AFTREK_LAAG = 0.3575;
const AFTREK_HOOG = 0.3756;
/** Eigenwoningforfait 2026 voor een WOZ-waarde tussen € 75.000 en € 1.350.000. */
const FORFAIT = 0.0035;
const FORFAIT_ONDERGRENS = 75000;
const VILLAGRENS = 1350000;

export interface HypotheekInvoer {
  inkomen: number;
  partner?: boolean;
  partnerInkomen?: number;
  aowBereikt?: boolean;
  /** Hypotheekrente in procenten. */
  rentePct: number;
  rentevastJaren: number;
  energielabel?: Energielabel;
  /** Restschuld studielening (samen, als je een partner hebt). */
  studieschuld?: number;
  studieRentePct?: number;
  studieLooptijdJaren?: number;
  /** Koopsom/woningwaarde; begrenst de hypotheek op 100% en bepaalt het eigenwoningforfait. */
  woningwaarde?: number;
  /** Gewenst leenbedrag; standaard het maximum. */
  leenbedrag?: number;
  waardestijgingPct?: number;
}

export interface JaarOverzicht {
  jaar: number;
  restschuld: number;
  woningwaarde: number;
  /** Woningwaarde min restschuld. */
  overwaarde: number;
  renteBrutoCumulatief: number;
  renteNettoCumulatief: number;
}

export interface HypotheekResultaat {
  toetsinkomen: number;
  toetsrente: number;
  financieringslastPct: number;
  maxMaandlast: number;
  /** Maximale hypotheek op basis van inkomen, zonder studieschuld. */
  maxZonderStudieschuld: number;
  studieMaandlast: number;
  bruteringsfactor: number;
  verlagingDoorStudieschuld: number;
  extraAlleenstaande: number;
  extraEnergielabel: number;
  maxOpInkomen: number;
  /** Maximum na begrenzing op de woningwaarde. */
  maxHypotheek: number;
  begrensdOpWoningwaarde: boolean;
  hypotheek: number;
  brutoMaandlast: number;
  renteEersteMaand: number;
  aflossingEersteMaand: number;
  aftrektarief: number;
  nettoMaandlast: number;
  totaalBrutoRente: number;
  totaalNettoRente: number;
  jaren: JaarOverzicht[];
}

/** Index van de renteklasse in de tabel: <= 1,5%, 1,501-2,0%, ..., >= 6,501%. */
export function renteklasse(rentePct: number): number {
  if (rentePct <= 1.5) return 0;
  return Math.min(11, Math.ceil((rentePct - 1.5) / 0.5 - 1e-9));
}

export function toetsrente(rentePct: number, rentevastJaren: number): number {
  return rentevastJaren < 10 ? Math.max(rentePct, AFM_TOETSRENTE) : rentePct;
}

export function financieringslastPct(toetsinkomen: number, toetsrentePct: number, aowBereikt: boolean): number {
  const tabel = aowBereikt ? woonquote.aowBereikt : woonquote.aowNietBereikt;
  let rij = 0;
  for (let i = 0; i < tabel.inkomens.length; i++) {
    if (toetsinkomen >= tabel.inkomens[i]) rij = i;
  }
  return tabel.percentages[rij][renteklasse(toetsrentePct)];
}

export function bruteringsfactor(toetsrentePct: number): number {
  return BRUTERINGSFACTOREN[renteklasse(toetsrentePct)];
}

/** Contante waarde van een maandbedrag over `maanden` termijnen: het leenbedrag dat bij die maandlast hoort. */
export function contanteWaarde(maandlast: number, rentePerMaand: number, maanden: number): number {
  if (maandlast <= 0) return 0;
  if (rentePerMaand === 0) return maandlast * maanden;
  return (maandlast * (1 - (1 + rentePerMaand) ** -maanden)) / rentePerMaand;
}

function forfait(woz: number): number {
  if (woz < FORFAIT_ONDERGRENS) return 0;
  if (woz <= VILLAGRENS) return woz * FORFAIT;
  return VILLAGRENS * FORFAIT + (woz - VILLAGRENS) * 0.0235;
}

export function berekenHypotheek(invoer: HypotheekInvoer): HypotheekResultaat {
  const partner = invoer.partner ?? false;
  const aow = invoer.aowBereikt ?? false;
  const toetsinkomen = invoer.inkomen + (partner ? (invoer.partnerInkomen ?? 0) : 0);
  const tRente = toetsrente(invoer.rentePct, invoer.rentevastJaren);
  const tRenteMaand = tRente / 100 / 12;
  const flPct = financieringslastPct(toetsinkomen, tRente, aow);
  const maxMaandlast = (toetsinkomen * flPct) / 100 / 12;

  const studieMaandlast = annuiteit(invoer.studieschuld ?? 0, (invoer.studieRentePct ?? 0) / 100 / 12, Math.round((invoer.studieLooptijdJaren ?? 35) * 12));
  const factor = bruteringsfactor(tRente);
  const maxZonderStudieschuld = contanteWaarde(maxMaandlast, tRenteMaand, LOOPTIJD_MAANDEN);
  const maxMetStudieschuld = contanteWaarde(Math.max(0, maxMaandlast - factor * studieMaandlast), tRenteMaand, LOOPTIJD_MAANDEN);

  const alleenstaandGrens = aow ? 29000 : 30000;
  const extraAlleenstaande = !partner && toetsinkomen > alleenstaandGrens ? EXTRA_ALLEENSTAANDE : 0;
  const extraEnergielabel = ENERGIELABELS[invoer.energielabel ?? 'onbekend'].bedrag;
  const maxOpInkomen = maxMetStudieschuld + extraAlleenstaande + extraEnergielabel;

  const begrensdOpWoningwaarde = invoer.woningwaarde !== undefined && invoer.woningwaarde < maxOpInkomen;
  const maxHypotheek = begrensdOpWoningwaarde ? invoer.woningwaarde! : maxOpInkomen;
  const hypotheek = invoer.leenbedrag !== undefined ? invoer.leenbedrag : maxHypotheek;

  // Maandlasten tegen de werkelijke rente.
  const i = invoer.rentePct / 100 / 12;
  const brutoMaandlast = annuiteit(hypotheek, i, LOOPTIJD_MAANDEN);
  const hoogsteInkomen = Math.max(invoer.inkomen, partner ? (invoer.partnerInkomen ?? 0) : 0);
  const aftrektarief = hoogsteInkomen > GRENS_SCHIJF_1 ? AFTREK_HOOG : AFTREK_LAAG;
  const startwaarde = invoer.woningwaarde ?? hypotheek;
  const groei = (invoer.waardestijgingPct ?? 0) / 100;

  let schuld = hypotheek;
  let renteBruto = 0;
  let renteNetto = 0;
  let renteEersteMaand = 0;
  const jaren: JaarOverzicht[] = [{ jaar: 0, restschuld: schuld, woningwaarde: startwaarde, overwaarde: startwaarde - schuld, renteBrutoCumulatief: 0, renteNettoCumulatief: 0 }];
  for (let m = 0; m < LOOPTIJD_MAANDEN; m++) {
    const jaar = Math.floor(m / 12);
    // Het forfait volgt de WOZ-waarde; die stijgt mee met de woningwaarde.
    const forfaitMaand = forfait(startwaarde * (1 + groei) ** jaar) / 12;
    const rente = schuld * i;
    if (m === 0) renteEersteMaand = rente;
    renteBruto += rente;
    renteNetto += rente - (rente - forfaitMaand) * aftrektarief;
    schuld -= brutoMaandlast - rente;
    if (m % 12 === 11) {
      const restschuld = Math.max(0, schuld);
      const waarde = startwaarde * (1 + groei) ** (jaar + 1);
      jaren.push({ jaar: jaar + 1, restschuld, woningwaarde: waarde, overwaarde: waarde - restschuld, renteBrutoCumulatief: renteBruto, renteNettoCumulatief: renteNetto });
    }
  }

  const forfaitStart = forfait(startwaarde) / 12;
  const nettoMaandlast = brutoMaandlast - (renteEersteMaand - forfaitStart) * aftrektarief;

  return {
    toetsinkomen,
    toetsrente: tRente,
    financieringslastPct: flPct,
    maxMaandlast,
    maxZonderStudieschuld,
    studieMaandlast,
    bruteringsfactor: factor,
    verlagingDoorStudieschuld: maxZonderStudieschuld - maxMetStudieschuld,
    extraAlleenstaande,
    extraEnergielabel,
    maxOpInkomen,
    maxHypotheek,
    begrensdOpWoningwaarde,
    hypotheek,
    brutoMaandlast,
    renteEersteMaand,
    aflossingEersteMaand: brutoMaandlast - renteEersteMaand,
    aftrektarief,
    nettoMaandlast,
    totaalBrutoRente: renteBruto,
    totaalNettoRente: renteNetto,
    jaren,
  };
}
