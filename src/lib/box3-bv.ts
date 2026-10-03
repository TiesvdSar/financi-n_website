/**
 * Vergelijking van vermogensopbouw: privé beleggen in box 3 (stelsel vanaf 2028) tegenover
 * beleggen in een BV (vennootschapsbelasting, box 2 bij uitkering of liquidatie).
 *
 * Box 3 vanaf 2028 (wetsvoorstel Wet werkelijk rendement box 3): 36% over het werkelijke rendement
 * (dividend + waardeverandering), heffingsvrij resultaat € 1.800 per persoon, verliezen vanaf
 * € 500 vooruit verrekenbaar.
 *
 * BV: dividend wordt jaarlijks belast met Vpb; koerswinst pas bij verkoop (waardering tegen
 * kostprijs). Bij liquidatie: Vpb over de nog niet belaste koerswinst, daarna box 2 over wat
 * je meer terugkrijgt dan je hebt ingebracht.
 *
 * Vereenvoudigingen: vaste rendementen, belasting betaald uit het vermogen zelf, tarieven 2026
 * voor Vpb en box 2, geen dividendbelasting (die wordt verrekend met box 2).
 */
import { box2Belasting, vpb } from './belasting';

export const BOX3_TARIEF = 0.36;
export const HEFFINGSVRIJ_RESULTAAT = 1800;
export const VERLIESDREMPEL = 500;

export interface VermogenInvoer {
  startvermogen: number;
  jaarlijkseInleg?: number;
  jaren: number;
  /** Dividend- en renterendement per jaar, in procenten. */
  dividendPct: number;
  /** Koersrendement per jaar, in procenten. */
  koersPct: number;
  /** Fiscale partners: dubbel heffingsvrij resultaat en dubbele eerste schijf in box 2. */
  partner?: boolean;
  bvKostenPerJaar?: number;
  /** Het geld blijft in de BV: box 2 bij opheffen niet meerekenen (wel Vpb over de koerswinst). */
  zonderBox2?: boolean;
}

export interface VermogenJaar {
  jaar: number;
  box3: number;
  /** Netto voor jou als je de BV aan het eind van dit jaar opheft. */
  bvNettoBijLiquidatie: number;
  /** Waarde van de beleggingen in de BV (vóór belasting bij liquidatie). */
  bvWaarde: number;
}

export interface VermogenResultaat {
  jaren: VermogenJaar[];
  box3Eind: number;
  box3TotaalBelasting: number;
  bvEind: number;
  bvTotaalVpb: number;
  bvBox2BijLiquidatie: number;
  bvTotaalKosten: number;
  /** Variant: de BV keert elk jaar haar winst na Vpb uit. */
  uitkeren: { nettoOntvangenTotaal: number; nettoBijLiquidatie: number; totaal: number; totaalBox2: number };
}

interface BvStaat {
  waarde: number;
  /** Fiscale boekwaarde (kostprijs) van de beleggingen. */
  kostprijs: number;
  /** Ingebracht kapitaal: komt bij liquidatie belastingvrij terug. */
  kapitaal: number;
  verlies: number;
}

function vpbMetVerlies(winst: number, staat: BvStaat): number {
  if (winst < 0) {
    staat.verlies += -winst;
    return 0;
  }
  const verrekend = Math.min(staat.verlies, winst);
  staat.verlies -= verrekend;
  return vpb(winst - verrekend);
}

/** Netto voor de aandeelhouder als de BV nu wordt opgeheven, na een jaarwinst `jaarwinst`. */
function liquidatie(staat: BvStaat, jaarwinst: number, personen: number, zonderBox2 = false) {
  const koerswinst = staat.waarde - staat.kostprijs;
  const resterendVerlies = Math.max(0, staat.verlies);
  const basis = Math.max(0, jaarwinst);
  const extraVpb = vpb(Math.max(0, basis + koerswinst - resterendVerlies)) - vpb(basis);
  const naVpb = staat.waarde - Math.max(0, extraVpb);
  const box2 = zonderBox2 ? 0 : box2Belasting(naVpb - staat.kapitaal, personen);
  return { netto: naVpb - box2, box2, vpb: Math.max(0, extraVpb) };
}

export function berekenVermogen(invoer: VermogenInvoer): VermogenResultaat {
  const div = invoer.dividendPct / 100;
  const koers = invoer.koersPct / 100;
  const inleg = invoer.jaarlijkseInleg ?? 0;
  const kosten = invoer.bvKostenPerJaar ?? 0;
  const personen = invoer.partner ? 2 : 1;
  const heffingsvrij = HEFFINGSVRIJ_RESULTAAT * personen;

  // Box 3
  let box3 = invoer.startvermogen;
  let box3Verlies = 0;
  let box3Belasting = 0;

  // BV: laten zitten
  const bv: BvStaat = { waarde: invoer.startvermogen, kostprijs: invoer.startvermogen, kapitaal: invoer.startvermogen, verlies: 0 };
  let bvVpb = 0;
  let bvKosten = 0;

  // BV: jaarlijks uitkeren
  const bvU: BvStaat = { ...bv };
  let ontvangen = 0;
  let box2Uitkeren = 0;

  const jaren: VermogenJaar[] = [{ jaar: 0, box3, bvNettoBijLiquidatie: liquidatie(bv, 0, personen, invoer.zonderBox2).netto, bvWaarde: bv.waarde }];
  let laatsteLiquidatie = liquidatie(bv, 0, personen, invoer.zonderBox2);
  let laatsteLiquidatieU = liquidatie(bvU, 0, personen, invoer.zonderBox2);

  for (let jaar = 1; jaar <= invoer.jaren; jaar++) {
    // Box 3: belasting over het werkelijke rendement van dit jaar.
    const resultaat = box3 * (div + koers);
    let belasting = 0;
    if (resultaat < 0) {
      if (-resultaat >= VERLIESDREMPEL) box3Verlies += -resultaat;
    } else {
      const belastbaar = Math.max(0, resultaat - heffingsvrij);
      const verrekend = Math.min(box3Verlies, belastbaar);
      box3Verlies -= verrekend;
      belasting = (belastbaar - verrekend) * BOX3_TARIEF;
    }
    box3Belasting += belasting;
    box3 = box3 + resultaat - belasting + inleg;

    // BV, laten zitten: dividend min kosten is de jaarwinst; koerswinst blijft onbelast tot verkoop.
    const dividend = bv.waarde * div;
    const jaarwinst = dividend - kosten;
    const belastingBv = vpbMetVerlies(jaarwinst, bv);
    bvVpb += belastingBv;
    bvKosten += kosten;
    const herbelegd = dividend - kosten - belastingBv;
    bv.waarde = bv.waarde * (1 + koers) + herbelegd + inleg;
    bv.kostprijs += herbelegd + inleg;
    bv.kapitaal += inleg;
    laatsteLiquidatie = liquidatie(bv, jaarwinst, personen, invoer.zonderBox2);

    // BV, jaarlijks uitkeren: de winst na Vpb gaat via box 2 naar privé.
    const dividendU = bvU.waarde * div;
    const jaarwinstU = dividendU - kosten;
    const belastingU = vpbMetVerlies(jaarwinstU, bvU);
    const uitkering = Math.max(0, dividendU - kosten - belastingU);
    const box2 = box2Belasting(uitkering, personen);
    box2Uitkeren += box2;
    ontvangen += uitkering - box2;
    const tekort = Math.min(0, dividendU - kosten - belastingU);
    bvU.waarde = bvU.waarde * (1 + koers) + tekort + inleg;
    bvU.kostprijs += tekort + inleg;
    bvU.kapitaal += inleg;
    laatsteLiquidatieU = liquidatie(bvU, jaarwinstU, personen, invoer.zonderBox2);

    jaren.push({ jaar, box3, bvNettoBijLiquidatie: laatsteLiquidatie.netto, bvWaarde: bv.waarde });
  }

  return {
    jaren,
    box3Eind: box3,
    box3TotaalBelasting: box3Belasting,
    bvEind: laatsteLiquidatie.netto,
    bvTotaalVpb: bvVpb + laatsteLiquidatie.vpb,
    bvBox2BijLiquidatie: laatsteLiquidatie.box2,
    bvTotaalKosten: bvKosten,
    uitkeren: {
      nettoOntvangenTotaal: ontvangen,
      nettoBijLiquidatie: laatsteLiquidatieU.netto,
      totaal: ontvangen + laatsteLiquidatieU.netto,
      totaalBox2: box2Uitkeren + laatsteLiquidatieU.box2,
    },
  };
}

/**
 * Laagste startvermogen (in stappen van € 10.000, tot € 10 miljoen) waarbij de BV (laten zitten)
 * aan het eind netto meer oplevert dan box 3, bij verder gelijke invoer. Null als dat niet gebeurt.
 */
export function omslagpunt(invoer: Omit<VermogenInvoer, 'startvermogen'>): number | null {
  for (let start = 10000; start <= 10000000; start += start < 1000000 ? 10000 : 100000) {
    const r = berekenVermogen({ ...invoer, startvermogen: start });
    if (r.bvEind > r.box3Eind) return start;
  }
  return null;
}

/**
 * Vuistregel: het jaarlijkse rendement waarboven 19% Vpb plus vaste BV-kosten minder is dan box 3,
 * zolang het geld in de BV blijft (zonder box 2): tarief × (R − heffingsvrij) = 19% × R + kosten.
 */
export function omslagRendement(kosten: number, tarief = BOX3_TARIEF, heffingsvrij = HEFFINGSVRIJ_RESULTAAT): number {
  return (kosten + tarief * heffingsvrij) / (tarief - 0.19);
}
