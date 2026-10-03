import { describe, expect, it } from 'vitest';
import { berekenVermogen, omslagpunt, omslagRendement } from './box3-bv';
import { box2Belasting, vpb } from './belasting';

describe('belasting BV', () => {
  it('rekent Vpb in twee schijven', () => {
    expect(vpb(100000)).toBeCloseTo(19000, 6);
    expect(vpb(300000)).toBeCloseTo(38000 + 25800, 6);
    expect(vpb(-5)).toBe(0);
  });
  it('rekent box 2 in twee schijven, dubbele eerste schijf met partner', () => {
    expect(box2Belasting(68843)).toBeCloseTo(68843 * 0.245, 6);
    expect(box2Belasting(100000)).toBeCloseTo(68843 * 0.245 + (100000 - 68843) * 0.31, 6);
    expect(box2Belasting(100000, 2)).toBeCloseTo(100000 * 0.245, 6);
  });
});

describe('berekenVermogen — box 3 vanaf 2028', () => {
  it('belast het werkelijke rendement boven € 1.800 met 36%', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaren: 1, dividendPct: 0, koersPct: 10 });
    expect(r.box3TotaalBelasting).toBeCloseTo((10000 - 1800) * 0.36, 6);
    expect(r.box3Eind).toBeCloseTo(110000 - 2952, 6);
  });

  it('verdubbelt het heffingsvrije resultaat met partner', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaren: 1, dividendPct: 0, koersPct: 10, partner: true });
    expect(r.box3TotaalBelasting).toBeCloseTo((10000 - 3600) * 0.36, 6);
  });

  it('verrekent een verlies met latere winst', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaren: 2, dividendPct: 0, koersPct: -10 });
    // Jaar 1: -10.000 verlies. Jaar 2: -9.000, ook verlies. Geen belasting.
    expect(r.box3TotaalBelasting).toBe(0);
    const herstel = berekenVermogen({ startvermogen: 100000, jaren: 1, dividendPct: 0, koersPct: 5 });
    expect(herstel.box3TotaalBelasting).toBeGreaterThan(0);
  });
});

describe('berekenVermogen — BV', () => {
  it('belast koerswinst pas bij liquidatie: eerst Vpb, dan box 2 over de winst boven het ingebrachte kapitaal', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaren: 1, dividendPct: 0, koersPct: 10 });
    const naVpb = 110000 - 10000 * 0.19;
    expect(r.bvEind).toBeCloseTo(naVpb - (naVpb - 100000) * 0.245, 6);
    expect(r.jaren[1].bvWaarde).toBeCloseTo(110000, 6);
  });

  it('belast dividend jaarlijks met Vpb', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaren: 1, dividendPct: 2, koersPct: 0 });
    expect(r.bvTotaalVpb).toBeCloseTo(380, 6);
    expect(r.bvEind).toBeCloseTo(101620 - 1620 * 0.245, 6);
  });

  it('trekt de BV-kosten af van de winst', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaren: 1, dividendPct: 2, koersPct: 0, bvKostenPerJaar: 1000 });
    expect(r.bvTotaalVpb).toBeCloseTo(190, 6);
    expect(r.bvTotaalKosten).toBe(1000);
  });

  it('geeft na één jaar hetzelfde bij laten zitten en uitkeren', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaren: 1, dividendPct: 2, koersPct: 0 });
    expect(r.uitkeren.totaal).toBeCloseTo(r.bvEind, 6);
    expect(r.uitkeren.nettoOntvangenTotaal).toBeCloseTo(1620 - 1620 * 0.245, 6);
  });

  it('geeft de jaarlijkse inleg belastingvrij terug bij liquidatie', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaarlijkseInleg: 10000, jaren: 3, dividendPct: 0, koersPct: 0 });
    expect(r.bvEind).toBeCloseTo(130000, 6);
    expect(r.box3Eind).toBeCloseTo(130000, 6);
  });

  it('start bij jaar 0 op het startvermogen', () => {
    const r = berekenVermogen({ startvermogen: 250000, jaren: 10, dividendPct: 2, koersPct: 5 });
    expect(r.jaren[0]).toEqual({ jaar: 0, box3: 250000, bvNettoBijLiquidatie: 250000, bvWaarde: 250000 });
    expect(r.jaren).toHaveLength(11);
  });
});

describe('omslagpunt', () => {
  it('vindt een startvermogen waarboven de BV meer oplevert, of null', () => {
    const lang = omslagpunt({ jaren: 30, dividendPct: 0, koersPct: 7, bvKostenPerJaar: 2000 });
    expect(lang).not.toBeNull();
    const r = berekenVermogen({ jaren: 30, dividendPct: 0, koersPct: 7, bvKostenPerJaar: 2000, startvermogen: lang! });
    expect(r.bvEind).toBeGreaterThan(r.box3Eind);
    expect(omslagpunt({ jaren: 1, dividendPct: 2, koersPct: 5, bvKostenPerJaar: 2000 })).toBeNull();
  });
});

describe('zonder box 2 (geld blijft in de BV)', () => {
  it('rekent alleen Vpb over de koerswinst', () => {
    const r = berekenVermogen({ startvermogen: 100000, jaren: 1, dividendPct: 0, koersPct: 10, zonderBox2: true });
    expect(r.bvEind).toBeCloseTo(110000 - 1900, 6);
    expect(r.bvBox2BijLiquidatie).toBe(0);
  });
  it('ligt het omslagpunt veel lager dan met box 2', () => {
    const met = omslagpunt({ jaren: 20, dividendPct: 2, koersPct: 5, bvKostenPerJaar: 1500 });
    const zonder = omslagpunt({ jaren: 20, dividendPct: 2, koersPct: 5, bvKostenPerJaar: 1500, zonderBox2: true });
    expect(zonder).not.toBeNull();
    expect(zonder!).toBeLessThan(met ?? Infinity);
  });
});

describe('omslagRendement (vuistregel uit de video van Madelon Vos)', () => {
  it('komt met 35% en € 1.900 uit op € 10.400 tot € 13.500 bij € 1.000 tot € 1.500 kosten', () => {
    expect(omslagRendement(1000, 0.35, 1900)).toBeCloseTo(10406, 0);
    expect(omslagRendement(1500, 0.35, 1900)).toBeCloseTo(13531, 0);
  });
  it('rekent standaard met 36% en € 1.800', () => {
    expect(omslagRendement(1500)).toBeCloseTo(12635, 0);
  });
});
