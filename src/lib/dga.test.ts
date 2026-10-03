import { describe, expect, it } from 'vitest';
import { sweetSpot, verdeling } from './dga';
import { box2Belasting, nettoBelasting, vpb, zvwBijdrage } from './belasting';

describe('verdeling', () => {
  it('telt netto salaris en netto dividend op', () => {
    const v = verdeling(100000, 58000);
    const nettoSalaris = 58000 - nettoBelasting(58000) - 58000 * 0.0485;
    const dividend = 42000 - 42000 * 0.19;
    expect(v.nettoSalaris).toBeCloseTo(nettoSalaris, 6);
    expect(v.dividend).toBeCloseTo(dividend, 6);
    expect(v.nettoDividend).toBeCloseTo(dividend * (1 - 0.245), 6);
    expect(v.totaalNetto).toBeCloseTo(nettoSalaris + dividend * 0.755, 6);
  });

  it('heeft geen dividend als alles salaris is', () => {
    const v = verdeling(80000, 80000);
    expect(v.dividend).toBe(0);
    expect(v.vpb).toBe(0);
  });

  it('kapt de Zvw-bijdrage af op het maximum', () => {
    expect(zvwBijdrage(100000)).toBeCloseTo(79409 * 0.0485, 6);
  });

  it('kan geen hoger salaris uitbetalen dan de winst', () => {
    expect(verdeling(40000, 58000).salaris).toBe(40000);
  });
});

describe('sweetSpot', () => {
  it('zoekt niet onder het minimumsalaris', () => {
    const s = sweetSpot(150000, 58000);
    expect(s.beste.salaris).toBeGreaterThanOrEqual(58000);
    expect(s.minimum.salaris).toBe(58000);
    expect(s.alleenSalaris.salaris).toBe(150000);
  });

  it('vindt het salaris met het hoogste totale netto', () => {
    const s = sweetSpot(150000, 0);
    for (const v of s.curve) expect(s.beste.totaalNetto).toBeGreaterThanOrEqual(v.totaalNetto - 0.01);
  });

  it('komt bij een lage winst uit op alles salaris als het minimum hoger is dan de winst', () => {
    const s = sweetSpot(40000, 58000);
    expect(s.curve).toHaveLength(1);
    expect(s.beste.salaris).toBe(40000);
  });

  it('rekent de belastingdruk uit als deel van de winst', () => {
    const v = verdeling(100000, 58000);
    expect(v.druk).toBeCloseTo(1 - v.totaalNetto / 100000, 10);
  });

  it('gebruikt dezelfde Vpb- en box 2-tarieven als de rest van de site', () => {
    const v = verdeling(300000, 58000);
    expect(v.vpb).toBeCloseTo(vpb(242000), 6);
    expect(v.nettoDividend).toBeCloseTo(v.dividend - box2Belasting(v.dividend), 6);
  });
});
