import { describe, expect, it } from 'vitest';
import { annuiteit, berekenStudieschuld, draagkrachtPerMaand, type StudieschuldInvoer } from './studieschuld';

const basis: StudieschuldInvoer = {
  schuld: 30000,
  rentePct: 2.33,
  regeling: 'SF35',
  looptijdJaren: 35,
  startNaJaren: 0,
  brutoJaarinkomen: 30000,
};

describe('annuiteit', () => {
  it('berekent het maandbedrag uit het artikel (€ 30.000, 2,33%, 35 jaar)', () => {
    expect(annuiteit(30000, 0.0233 / 12, 420)).toBeCloseTo(104.53, 2);
  });
  it('deelt de schuld gelijk bij 0% rente', () => {
    expect(annuiteit(12000, 0, 120)).toBe(100);
  });
  it('geeft 0 zonder schuld of termijnen', () => {
    expect(annuiteit(0, 0.01, 12)).toBe(0);
    expect(annuiteit(1000, 0.01, 0)).toBe(0);
  });
});

describe('draagkrachtPerMaand', () => {
  it('rekent 4% boven de vrijstelling voor SF35', () => {
    expect(draagkrachtPerMaand(30000, 'SF35', false)).toBeCloseTo(10.6, 2);
  });
  it('rekent 12% boven de vrijstelling voor SF15', () => {
    expect(draagkrachtPerMaand(32528.31, 'SF15', false)).toBeCloseTo(100, 2);
  });
  it('gebruikt de hogere vrijstelling met partner', () => {
    expect(draagkrachtPerMaand(38351.77, 'SF35', true)).toBe(0);
  });
  it('is 0 onder de vrijstelling', () => {
    expect(draagkrachtPerMaand(10000, 'SF35', false)).toBe(0);
  });
});

describe('berekenStudieschuld', () => {
  it('betaalt het laagste van wettelijk maandbedrag en draagkracht', () => {
    const r = berekenStudieschuld(basis);
    expect(r.eersteJaar?.maandbedrag).toBeCloseTo(10.6, 2);
    expect(r.eersteJaar?.wettelijk).toBeCloseTo(104.53, 2);
  });

  it('lost precies af binnen de looptijd bij een hoog inkomen', () => {
    const r = berekenStudieschuld({ ...basis, brutoJaarinkomen: 100000 });
    expect(r.afgelostInJaar).toBe(35);
    expect(r.kwijtgescholden).toBe(0);
    expect(r.totaalBetaald).toBeCloseTo(104.53455 * 420, 0);
  });

  it('scheldt de restschuld kwijt bij een laag inkomen', () => {
    const r = berekenStudieschuld({ ...basis, brutoJaarinkomen: 20000 });
    expect(r.totaalBetaald).toBe(0);
    expect(r.afgelostInJaar).toBeNull();
    expect(r.kwijtgescholden).toBeCloseTo(30000 * (1 + 0.0233 / 12) ** 420, 0);
  });

  it('laat de schuld groeien in de aanloopfase', () => {
    const r = berekenStudieschuld({ ...basis, startNaJaren: 2 });
    expect(r.schuldBijStart).toBeCloseTo(30000 * (1 + 0.0233 / 12) ** 24, 2);
    expect(r.jaren[0].fase).toBe('aanloop');
    expect(r.jaren[2].fase).toBe('aflossen');
    expect(r.jaren).toHaveLength(37);
  });

  it('lost eerder af met extra aflossing', () => {
    const r = berekenStudieschuld({ ...basis, brutoJaarinkomen: 100000, extraAflossingPerMaand: 200 });
    expect(r.afgelostInJaar).toBeLessThan(35);
    expect(r.kwijtgescholden).toBe(0);
  });

  it('verhoogt de draagkracht met salarisgroei', () => {
    const r = berekenStudieschuld({ ...basis, salarisgroeiPct: 3 });
    expect(r.jaren[1].draagkrachtMaandbedrag).toBeGreaterThan(r.jaren[0].draagkrachtMaandbedrag);
  });

  it('telt partnerinkomen alleen mee met partner', () => {
    const zonder = berekenStudieschuld({ ...basis, partnerInkomen: 40000 });
    const met = berekenStudieschuld({ ...basis, partner: true, partnerInkomen: 40000 });
    expect(zonder.eersteJaar?.draagkracht).toBeCloseTo(10.6, 2);
    expect(met.eersteJaar?.draagkracht).toBeCloseTo(((70000 - 38351.77) * 0.04) / 12, 2);
  });

  it('drukt de schuld uit in euro van nu bij inflatie', () => {
    const r = berekenStudieschuld({ ...basis, inflatiePct: 2 });
    expect(r.jaren[0].schuldEindReeel).toBeCloseTo(r.jaren[0].schuldEind / 1.02, 2);
  });

  it('is consistent: betaald = schuld + rente - kwijtgescholden', () => {
    const r = berekenStudieschuld({ ...basis, startNaJaren: 2, salarisgroeiPct: 2.5 });
    expect(r.totaalBetaald).toBeCloseTo(basis.schuld + r.totaalRente - r.kwijtgescholden, 4);
  });
});
