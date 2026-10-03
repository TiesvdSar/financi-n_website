/**
 * Rekenlogica voor de bijtelling van een auto van de zaak (2026).
 *
 * Bronnen:
 * - Bijtellingspercentages per jaar van eerste toelating (Belastingplan 2026); het percentage
 *   geldt 60 maanden vanaf de eerste toelating.
 * - Box 1-tarieven en heffingskortingen 2026: zie ./belasting.ts.
 */
import { nettoBelasting } from './belasting';

export type Aandrijving = 'elektrisch' | 'waterstof' | 'brandstof';

export const STANDAARD_PERCENTAGE = 0.22;

/** Verlaagd percentage voor elektrische auto's, per jaar van eerste toelating. */
export const EV_KORTING: Record<number, { percentage: number; grens: number }> = {
  2022: { percentage: 0.16, grens: 35000 },
  2023: { percentage: 0.16, grens: 30000 },
  2024: { percentage: 0.16, grens: 30000 },
  2025: { percentage: 0.17, grens: 30000 },
  2026: { percentage: 0.18, grens: 30000 },
  2027: { percentage: 0.2, grens: 30000 },
};

export interface BijtellingInvoer {
  cataloguswaarde: number;
  aandrijving: Aandrijving;
  jaarEersteToelating: number;
  brutoJaarsalaris: number;
  eigenBijdragePerMaand?: number;
}

export interface BijtellingResultaat {
  /** Delen van de berekening, bv. 18% over € 30.000 en 22% over de rest. */
  delen: { percentage: number; over: number; bedrag: number }[];
  bijtellingVoorEigenBijdrage: number;
  eigenBijdragePerJaar: number;
  bijtellingPerJaar: number;
  extraBelastingPerJaar: number;
  extraBelastingPerMaand: number;
  /** Extra belasting plus eigen bijdrage: wat er netto per maand van je loon afgaat. */
  nettoKostenPerMaand: number;
  effectiefTarief: number;
  /** Netto kosten per maand als dezelfde auto 22% bijtelling had (ter vergelijking). */
  nettoKostenStandaardPerMaand: number;
}

export function bijtellingDelen(cataloguswaarde: number, aandrijving: Aandrijving, jaar: number) {
  const korting = EV_KORTING[jaar];
  if (aandrijving === 'brandstof' || !korting) {
    return [{ percentage: STANDAARD_PERCENTAGE, over: cataloguswaarde, bedrag: cataloguswaarde * STANDAARD_PERCENTAGE }];
  }
  // Waterstof- en zonnecelauto's krijgen het verlaagde percentage over de hele cataloguswaarde.
  if (aandrijving === 'waterstof') {
    return [{ percentage: korting.percentage, over: cataloguswaarde, bedrag: cataloguswaarde * korting.percentage }];
  }
  const laag = Math.min(cataloguswaarde, korting.grens);
  const hoog = cataloguswaarde - laag;
  const delen = [{ percentage: korting.percentage, over: laag, bedrag: laag * korting.percentage }];
  if (hoog > 0) delen.push({ percentage: STANDAARD_PERCENTAGE, over: hoog, bedrag: hoog * STANDAARD_PERCENTAGE });
  return delen;
}

function nettoKosten(bijtellingVoorEigenBijdrage: number, eigenBijdragePerJaar: number, salaris: number) {
  const bijtelling = Math.max(0, bijtellingVoorEigenBijdrage - eigenBijdragePerJaar);
  const extraBelasting = nettoBelasting(salaris + bijtelling) - nettoBelasting(salaris);
  return { bijtelling, extraBelasting, perMaand: (extraBelasting + eigenBijdragePerJaar) / 12 };
}

export function berekenBijtelling(invoer: BijtellingInvoer): BijtellingResultaat {
  const delen = bijtellingDelen(invoer.cataloguswaarde, invoer.aandrijving, invoer.jaarEersteToelating);
  const bijtellingVoorEigenBijdrage = delen.reduce((som, d) => som + d.bedrag, 0);
  const eigenBijdragePerJaar = (invoer.eigenBijdragePerMaand ?? 0) * 12;
  const k = nettoKosten(bijtellingVoorEigenBijdrage, eigenBijdragePerJaar, invoer.brutoJaarsalaris);
  const standaard = nettoKosten(invoer.cataloguswaarde * STANDAARD_PERCENTAGE, eigenBijdragePerJaar, invoer.brutoJaarsalaris);

  return {
    delen,
    bijtellingVoorEigenBijdrage,
    eigenBijdragePerJaar,
    bijtellingPerJaar: k.bijtelling,
    extraBelastingPerJaar: k.extraBelasting,
    extraBelastingPerMaand: k.extraBelasting / 12,
    nettoKostenPerMaand: k.perMaand,
    effectiefTarief: k.bijtelling > 0 ? k.extraBelasting / k.bijtelling : 0,
    nettoKostenStandaardPerMaand: standaard.perMaand,
  };
}
