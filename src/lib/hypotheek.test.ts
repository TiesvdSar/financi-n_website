import { describe, expect, it } from 'vitest';
import { berekenHypotheek, bruteringsfactor, contanteWaarde, financieringslastPct, renteklasse, toetsrente, type HypotheekInvoer } from './hypotheek';

const stel: HypotheekInvoer = { inkomen: 65000, partner: true, partnerInkomen: 0, rentePct: 3.6, rentevastJaren: 10, energielabel: 'AB' };

describe('renteklasse', () => {
  it.each([
    [1.2, 0],
    [1.5, 0],
    [1.501, 1],
    [2.0, 1],
    [3.6, 5],
    [4.0, 5],
    [6.5, 10],
    [6.501, 11],
    [9, 11],
  ])('rente %d valt in klasse %d', (rente, klasse) => {
    expect(renteklasse(rente)).toBe(klasse);
  });
});

describe('toetsrente', () => {
  it('gebruikt minimaal 5% bij rentevast korter dan 10 jaar', () => {
    expect(toetsrente(3.5, 5)).toBe(5);
    expect(toetsrente(5.4, 5)).toBe(5.4);
  });
  it('gebruikt de werkelijke rente bij 10 jaar of langer vast', () => {
    expect(toetsrente(3.5, 10)).toBe(3.5);
  });
});

describe('financieringslastPct (tabel 2026)', () => {
  it('leest de juiste cel uit tabel 1', () => {
    expect(financieringslastPct(65000, 3.6, false)).toBe(22.9);
    expect(financieringslastPct(30000, 1, false)).toBe(15.5);
    expect(financieringslastPct(125000, 6.4, false)).toBe(31.5);
  });
  it('rondt het inkomen af naar de rij eronder', () => {
    expect(financieringslastPct(65999, 3.6, false)).toBe(financieringslastPct(65000, 3.6, false));
  });
  it('gebruikt de laagste rij onder het minimum en de hoogste rij boven het maximum', () => {
    expect(financieringslastPct(10000, 1, false)).toBe(15.5);
    expect(financieringslastPct(250000, 6.4, false)).toBe(31.5);
  });
  it('gebruikt tabel 2 na de AOW-leeftijd', () => {
    expect(financieringslastPct(29000, 1, true)).toBe(18.5);
  });
});

describe('studieschuld (Nibud-voorbeeld 2026)', () => {
  it('brutering en verlaging: € 72,21 × 1,20 bij 3,75% geeft € 18.711 minder', () => {
    expect(bruteringsfactor(3.75)).toBe(1.2);
    expect(contanteWaarde(1.2 * 72.21, 0.0375 / 12, 360)).toBeCloseTo(18711, -1);
  });
  it('verlaagt de maximale hypotheek met de gebruteerde maandlast', () => {
    const zonder = berekenHypotheek({ ...stel, rentePct: 3.75 });
    const met = berekenHypotheek({ ...stel, rentePct: 3.75, studieschuld: 20000, studieRentePct: 2.57, studieLooptijdJaren: 35 });
    expect(met.studieMaandlast).toBeCloseTo(72.21, 1);
    // Nibud rekent met het afgeronde maandbedrag € 72,21; wij met het onafgeronde (± € 72,25).
    expect(Math.abs(met.verlagingDoorStudieschuld - 18711)).toBeLessThan(25);
    expect(zonder.maxHypotheek - met.maxHypotheek).toBeCloseTo(met.verlagingDoorStudieschuld, 6);
  });
});

describe('berekenHypotheek', () => {
  it('komt uit op ± € 283.000 voor een stel met € 65.000, 3,6% en label A/B', () => {
    const r = berekenHypotheek(stel);
    expect(r.maxHypotheek).toBeGreaterThan(282000);
    expect(r.maxHypotheek).toBeLessThan(284000);
    expect(r.extraAlleenstaande).toBe(0);
  });

  it('geeft een alleenstaande € 17.000 extra', () => {
    const r = berekenHypotheek({ ...stel, partner: false });
    expect(r.extraAlleenstaande).toBe(17000);
    expect(r.maxHypotheek - berekenHypotheek(stel).maxHypotheek).toBeCloseTo(17000, 6);
  });

  it('geeft geen alleenstaandenbedrag bij een inkomen tot € 30.000', () => {
    expect(berekenHypotheek({ ...stel, partner: false, inkomen: 30000 }).extraAlleenstaande).toBe(0);
  });

  it('telt het partnerinkomen volledig mee', () => {
    const samen = berekenHypotheek({ ...stel, inkomen: 40000, partnerInkomen: 25000 });
    expect(samen.toetsinkomen).toBe(65000);
    expect(samen.maxHypotheek).toBeCloseTo(berekenHypotheek(stel).maxHypotheek, 6);
  });

  it('begrenst op de woningwaarde', () => {
    const r = berekenHypotheek({ ...stel, woningwaarde: 250000 });
    expect(r.begrensdOpWoningwaarde).toBe(true);
    expect(r.maxHypotheek).toBe(250000);
  });

  it('rekent met de AFM-toetsrente bij korte rentevaste periode', () => {
    const kort = berekenHypotheek({ ...stel, rentevastJaren: 5 });
    expect(kort.toetsrente).toBe(5);
    expect(kort.maxHypotheek).toBeLessThan(berekenHypotheek(stel).maxHypotheek);
  });

  it('berekent de bruto maandlast tegen de werkelijke rente', () => {
    const r = berekenHypotheek({ ...stel, leenbedrag: 300000, rentePct: 3.8 });
    expect(r.brutoMaandlast).toBeCloseTo(1397.87, 1);
    expect(r.renteEersteMaand).toBeCloseTo(950, 6);
  });

  it('trekt de rente af en telt het forfait bij voor de netto maandlast', () => {
    const r = berekenHypotheek({ ...stel, leenbedrag: 300000, rentePct: 3.8, woningwaarde: 300000 });
    const verwacht = r.brutoMaandlast - (950 - (300000 * 0.0035) / 12) * 0.3756;
    expect(r.nettoMaandlast).toBeCloseTo(verwacht, 6);
  });

  it('lost de hypotheek in 30 jaar volledig af', () => {
    const r = berekenHypotheek({ ...stel, leenbedrag: 300000 });
    expect(r.jaren).toHaveLength(31);
    expect(r.jaren[30].restschuld).toBeCloseTo(0, 2);
    expect(r.brutoMaandlast * 360 - r.totaalBrutoRente).toBeCloseTo(300000, 2);
  });

  it('laat de overwaarde stijgen met aflossing en waardestijging', () => {
    const r = berekenHypotheek({ ...stel, leenbedrag: 300000, woningwaarde: 300000, waardestijgingPct: 2 });
    expect(r.jaren[0].overwaarde).toBe(0);
    expect(r.jaren[10].woningwaarde).toBeCloseTo(300000 * 1.02 ** 10, 2);
    expect(r.jaren[10].overwaarde).toBeCloseTo(r.jaren[10].woningwaarde - r.jaren[10].restschuld, 6);
  });
});
