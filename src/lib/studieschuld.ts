/**
 * Rekenlogica voor het terugbetalen van een DUO-studieschuld.
 *
 * Bronnen (bedragen 2026):
 * - https://duo.nl/particulier/studieschuld-terugbetalen/berekening-maandbedrag.jsp
 * - https://duo.nl/particulier/studieschuld-terugbetalen/uw-inkomen.jsp
 *
 * Vereenvoudigingen:
 * - De rente blijft de hele looptijd gelijk (in werkelijkheid staat hij 5 jaar vast).
 * - De draagkracht gebruikt het inkomen van hetzelfde jaar (DUO kijkt naar 2 jaar eerder).
 * - De vrijgestelde inkomensgrenzen blijven op het niveau van 2026 (DUO indexeert ze jaarlijks).
 * - Aflosvrije periodes worden niet meegenomen.
 */

export type Regeling = 'SF35' | 'SF15';

export interface RegelingParameters {
  looptijdJaren: number;
  /** Deel van het inkomen boven de vrijstelling dat je maximaal betaalt. */
  draagkrachtPercentage: number;
  vrijstellingAlleenstaand: number;
  vrijstellingMetPartner: number;
}

export const REGELINGEN: Record<Regeling, RegelingParameters> = {
  SF35: { looptijdJaren: 35, draagkrachtPercentage: 0.04, vrijstellingAlleenstaand: 26819.42, vrijstellingMetPartner: 38351.77 },
  SF15: { looptijdJaren: 15, draagkrachtPercentage: 0.12, vrijstellingAlleenstaand: 22528.31, vrijstellingMetPartner: 32183.3 },
};

export const RENTE_2026: Record<Regeling, number> = { SF35: 2.33, SF15: 2.29 };

export interface StudieschuldInvoer {
  schuld: number;
  /** Rente per jaar in procenten, bv. 2.33. */
  rentePct: number;
  regeling: Regeling;
  looptijdJaren: number;
  /** Aantal jaren vanaf nu tot het aflossen begint (aanloopfase is standaard 2). */
  startNaJaren: number;
  /** Verwacht bruto jaarinkomen in het eerste aflosjaar. */
  brutoJaarinkomen: number;
  salarisgroeiPct?: number;
  partner?: boolean;
  /** Bruto jaarinkomen van de partner in het eerste aflosjaar. */
  partnerInkomen?: number;
  extraAflossingPerMaand?: number;
  inflatiePct?: number;
}

export interface JaarRegel {
  /** Jaar vanaf nu, beginnend bij 1. */
  jaar: number;
  fase: 'aanloop' | 'aflossen';
  schuldEind: number;
  /** Schuld aan het eind van het jaar, uitgedrukt in euro's van nu. */
  schuldEindReeel: number;
  betaald: number;
  rente: number;
  /** Verplicht maandbedrag in dit jaar (0 in de aanloopfase). */
  maandbedrag: number;
  wettelijkMaandbedrag: number;
  draagkrachtMaandbedrag: number;
  inkomen: number;
}

export interface StudieschuldResultaat {
  jaren: JaarRegel[];
  schuldBijStart: number;
  totaalBetaald: number;
  totaalRente: number;
  kwijtgescholden: number;
  /** Jaar (vanaf nu) waarin de schuld volledig is afgelost, of null als dat niet binnen de looptijd lukt. */
  afgelostInJaar: number | null;
  eersteJaar: { maandbedrag: number; wettelijk: number; draagkracht: number; renteMaand: number } | null;
}

/** Maandbedrag waarmee `schuld` in `maanden` termijnen volledig is afgelost (annuïteit). */
export function annuiteit(schuld: number, rentePerMaand: number, maanden: number): number {
  if (schuld <= 0 || maanden <= 0) return 0;
  if (rentePerMaand === 0) return schuld / maanden;
  return (schuld * rentePerMaand) / (1 - (1 + rentePerMaand) ** -maanden);
}

/** Maximaal maandbedrag op basis van inkomen (draagkracht). */
export function draagkrachtPerMaand(jaarinkomen: number, regeling: Regeling, partner: boolean): number {
  const p = REGELINGEN[regeling];
  const vrijstelling = partner ? p.vrijstellingMetPartner : p.vrijstellingAlleenstaand;
  return (Math.max(0, jaarinkomen - vrijstelling) * p.draagkrachtPercentage) / 12;
}

const AFGEROND = 0.005;

export function berekenStudieschuld(invoer: StudieschuldInvoer): StudieschuldResultaat {
  const i = invoer.rentePct / 100 / 12;
  const groei = (invoer.salarisgroeiPct ?? 0) / 100;
  const inflatie = (invoer.inflatiePct ?? 0) / 100;
  const extra = invoer.extraAflossingPerMaand ?? 0;
  const partner = invoer.partner ?? false;
  const startMaand = Math.round(invoer.startNaJaren * 12);
  const totaalMaanden = startMaand + Math.round(invoer.looptijdJaren * 12);

  let schuld = invoer.schuld;
  let schuldBijStart = startMaand === 0 ? schuld : 0;
  let totaalBetaald = 0;
  let totaalRente = 0;
  let afgelostInJaar: number | null = null;
  let eersteJaar: StudieschuldResultaat['eersteJaar'] = null;
  const jaren: JaarRegel[] = [];

  let regel: JaarRegel | null = null;
  let maandbedrag = 0;

  for (let m = 0; m < totaalMaanden; m++) {
    const jaarIndex = Math.floor(m / 12);
    const aflossen = m >= startMaand;

    if (m % 12 === 0 || m === startMaand) {
      if (m % 12 === 0) {
        regel = {
          jaar: jaarIndex + 1,
          fase: aflossen ? 'aflossen' : 'aanloop',
          schuldEind: 0,
          schuldEindReeel: 0,
          betaald: 0,
          rente: 0,
          maandbedrag: 0,
          wettelijkMaandbedrag: 0,
          draagkrachtMaandbedrag: 0,
          inkomen: 0,
        };
        jaren.push(regel);
      }
      if (aflossen && regel) {
        // DUO berekent het maandbedrag ieder kalenderjaar opnieuw.
        const aflosjaar = Math.floor((m - startMaand) / 12);
        const factor = (1 + groei) ** aflosjaar;
        const inkomen = invoer.brutoJaarinkomen * factor + (partner ? (invoer.partnerInkomen ?? 0) * factor : 0);
        const wettelijk = annuiteit(schuld, i, totaalMaanden - m);
        const draagkracht = draagkrachtPerMaand(inkomen, invoer.regeling, partner);
        maandbedrag = Math.min(wettelijk, draagkracht);
        regel.fase = 'aflossen';
        regel.inkomen = inkomen;
        regel.wettelijkMaandbedrag = wettelijk;
        regel.draagkrachtMaandbedrag = draagkracht;
        regel.maandbedrag = maandbedrag;
        if (!eersteJaar) eersteJaar = { maandbedrag, wettelijk, draagkracht, renteMaand: schuld * i };
      }
    }

    if (m === startMaand) schuldBijStart = schuld;

    const rente = schuld * i;
    schuld += rente;
    totaalRente += rente;
    const betaling = Math.min(schuld, (aflossen ? maandbedrag : 0) + extra);
    schuld -= betaling;
    totaalBetaald += betaling;
    if (regel) {
      regel.rente += rente;
      regel.betaald += betaling;
    }

    if (m % 12 === 11 || m === totaalMaanden - 1) {
      if (regel) {
        regel.schuldEind = schuld;
        regel.schuldEindReeel = schuld / (1 + inflatie) ** (jaarIndex + 1);
      }
    }

    if (schuld <= AFGEROND) {
      schuld = 0;
      if (regel) {
        regel.schuldEind = 0;
        regel.schuldEindReeel = 0;
      }
      afgelostInJaar = jaarIndex + 1;
      break;
    }
  }

  return {
    jaren,
    schuldBijStart,
    totaalBetaald,
    totaalRente,
    kwijtgescholden: schuld,
    afgelostInJaar,
    eersteJaar,
  };
}
