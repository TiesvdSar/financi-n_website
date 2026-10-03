/**
 * Verdeling salaris en dividend voor een directeur-grootaandeelhouder (tarieven 2026).
 *
 * Salaris: kostenpost voor de BV; de DGA betaalt box 1 (na heffingskortingen) en de
 * inkomensafhankelijke bijdrage Zvw. Een DGA die niet verzekerd is voor de werknemersverzekeringen
 * heeft geen werkgeversheffing Zvw en geen WW/WIA-premies.
 * Dividend: de rest van de winst na Vpb, volledig uitgekeerd en belast in box 2.
 *
 * Vereenvoudigingen: geen pensioenopbouw, geen toeslagen, de hele winst wordt elk jaar uitgekeerd.
 */
import { box2Belasting, nettoBelasting, vpb, zvwBijdrage } from './belasting';

export const GEBRUIKELIJK_LOON_2026 = 58000;

export interface Verdeling {
  salaris: number;
  nettoSalaris: number;
  vpb: number;
  dividend: number;
  nettoDividend: number;
  totaalNetto: number;
  /** Totale belasting en premies als deel van de winst. */
  druk: number;
}

export function verdeling(winstVoorSalaris: number, salaris: number): Verdeling {
  const s = Math.min(Math.max(0, salaris), Math.max(0, winstVoorSalaris));
  const nettoSalaris = s - nettoBelasting(s) - zvwBijdrage(s);
  const winst = winstVoorSalaris - s;
  const belastingBv = vpb(winst);
  const dividend = Math.max(0, winst - belastingBv);
  const nettoDividend = dividend - box2Belasting(dividend);
  const totaalNetto = nettoSalaris + nettoDividend;
  return {
    salaris: s,
    nettoSalaris,
    vpb: belastingBv,
    dividend,
    nettoDividend,
    totaalNetto,
    druk: winstVoorSalaris > 0 ? 1 - totaalNetto / winstVoorSalaris : 0,
  };
}

export interface SweetSpot {
  beste: Verdeling;
  minimum: Verdeling;
  alleenSalaris: Verdeling;
  /** Totaal netto per salarisniveau, voor de grafiek. */
  curve: Verdeling[];
}

/** Zoekt het salaris (in stappen van € 500, niet onder het minimumsalaris) met het hoogste totale netto-inkomen. */
export function sweetSpot(winstVoorSalaris: number, minimumSalaris: number): SweetSpot {
  const min = Math.min(minimumSalaris, winstVoorSalaris);
  const stap = 500;
  const curve: Verdeling[] = [];
  for (let s = min; s < winstVoorSalaris; s += stap) curve.push(verdeling(winstVoorSalaris, s));
  curve.push(verdeling(winstVoorSalaris, winstVoorSalaris));
  const beste = curve.reduce((a, b) => (b.totaalNetto > a.totaalNetto + 0.005 ? b : a));
  return { beste, minimum: curve[0], alleenSalaris: curve[curve.length - 1], curve };
}
