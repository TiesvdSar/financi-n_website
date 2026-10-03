/**
 * Beleggen met geleend geld: resultaat na rente en box 3 (stelsel vanaf 2028).
 *
 * In box 3 wordt het totale resultaat belast: rendement op al je bezittingen min de rente op je
 * box 3-schulden. De rente gaat dus volledig af van je totale resultaat; de besparing is 36% van
 * de rente zolang je totale resultaat boven het heffingsvrije resultaat blijft. Is het totaal
 * negatief (minstens € 500), dan mag je dat verlies verrekenen met latere jaren.
 */
import { BOX3_TARIEF, HEFFINGSVRIJ_RESULTAAT, VERLIESDREMPEL } from './box3-bv';

export interface GeleendInvoer {
  leenbedrag: number;
  rentePct: number;
  /** Totaal rendement (dividend + koers) op het geleende bedrag, in procenten. */
  rendementPct: number;
  /** Rendement op je overige box 3-vermogen dit jaar (eigen geld), in euro's. */
  overigRendement: number;
}

export interface GeleendScenario {
  rendementPct: number;
  rendement: number;
  rente: number;
  /** Rendement min rente van de lening. */
  resultaat: number;
  /** Hoeveel meer (+) of minder (−) box 3-belasting je betaalt door de lening. */
  extraBelasting: number;
  /** Hoeveel belasting de renteaftrek scheelt. */
  belastingvoordeel: number;
  /** Wat de lening je na rente en belasting oplevert. */
  netto: number;
  /** Verlies dat je met latere jaren mag verrekenen (als je totale box 3-resultaat negatief is). */
  verrekenbaarVerlies: number;
}

function box3(totaalResultaat: number): number {
  return Math.max(0, totaalResultaat - HEFFINGSVRIJ_RESULTAAT) * BOX3_TARIEF;
}

export function geleendScenario(invoer: GeleendInvoer): GeleendScenario {
  const rendement = (invoer.leenbedrag * invoer.rendementPct) / 100;
  const rente = (invoer.leenbedrag * invoer.rentePct) / 100;
  const resultaat = rendement - rente;
  const overig = invoer.overigRendement;

  const zonderLening = box3(overig);
  const metLening = box3(overig + resultaat);
  const metLeningZonderAftrek = box3(overig + rendement);
  const extraBelasting = metLening - zonderLening;
  const totaal = overig + resultaat;

  return {
    rendementPct: invoer.rendementPct,
    rendement,
    rente,
    resultaat,
    extraBelasting,
    belastingvoordeel: metLeningZonderAftrek - metLening,
    netto: resultaat - extraBelasting,
    verrekenbaarVerlies: -totaal >= VERLIESDREMPEL ? -totaal : 0,
  };
}

/** Wat de rente je netto kost als het belastingvoordeel volledig benut wordt. */
export function nettoRentePct(rentePct: number): number {
  return rentePct * (1 - BOX3_TARIEF);
}
