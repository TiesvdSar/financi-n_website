import { describe, expect, it } from 'vitest';
import { berekenBijtelling, bijtellingDelen } from './bijtelling';
import { box1Belasting, heffingskortingen } from './belasting';

describe('bijtellingDelen', () => {
  it('rekent 22% voor een benzine-, diesel- of hybride auto', () => {
    expect(bijtellingDelen(40000, 'brandstof', 2026)).toEqual([{ percentage: 0.22, over: 40000, bedrag: 8800 }]);
  });

  it('rekent voor een EV uit 2026 18% tot € 30.000 en 22% daarboven', () => {
    const d = bijtellingDelen(45000, 'elektrisch', 2026);
    expect(d).toHaveLength(2);
    expect(d[0]).toEqual({ percentage: 0.18, over: 30000, bedrag: 5400 });
    expect(d[1].over).toBe(15000);
    expect(d[1].bedrag).toBeCloseTo(3300, 6);
  });

  it('gebruikt het percentage van het jaar van eerste toelating', () => {
    expect(bijtellingDelen(30000, 'elektrisch', 2024)[0].percentage).toBe(0.16);
    expect(bijtellingDelen(30000, 'elektrisch', 2027)[0].percentage).toBe(0.2);
    expect(bijtellingDelen(35000, 'elektrisch', 2022)).toHaveLength(1);
  });

  it('geeft waterstofauto’s het lage percentage over de hele waarde', () => {
    expect(bijtellingDelen(70000, 'waterstof', 2026)).toEqual([{ percentage: 0.18, over: 70000, bedrag: 12600 }]);
  });

  it('heeft één deel als een EV onder de grens blijft', () => {
    expect(bijtellingDelen(25000, 'elektrisch', 2026)).toEqual([{ percentage: 0.18, over: 25000, bedrag: 4500 }]);
  });
});

describe('box 1 en heffingskortingen 2026', () => {
  it('rekent de schijven door', () => {
    expect(box1Belasting(38883)).toBeCloseTo(38883 * 0.3575, 6);
    expect(box1Belasting(100000)).toBeCloseTo(38883 * 0.3575 + (78426 - 38883) * 0.3756 + (100000 - 78426) * 0.495, 6);
  });
  it('bouwt de heffingskortingen af', () => {
    expect(heffingskortingen(29736)).toBeCloseTo(3115 + 5300 + (29736 - 25845) * 0.0195, 6);
    expect(heffingskortingen(45592)).toBeCloseTo(3115 - (45592 - 29736) * 0.06398 + 5685, 0);
    expect(heffingskortingen(78426)).toBeCloseTo(5685 - (78426 - 45592) * 0.0651, 0);
    expect(heffingskortingen(140000)).toBe(0);
  });
});

describe('berekenBijtelling', () => {
  it('berekent de extra belasting met afbouw van heffingskortingen', () => {
    const r = berekenBijtelling({ cataloguswaarde: 40000, aandrijving: 'brandstof', jaarEersteToelating: 2026, brutoJaarsalaris: 50000 });
    // 8.800 bijtelling in de schijf van 37,56%, plus afbouw AHK (6,398%) en AK (6,51%).
    expect(r.bijtellingPerJaar).toBe(8800);
    expect(r.extraBelastingPerJaar).toBeCloseTo(8800 * (0.3756 + 0.06398 + 0.0651), 2);
    expect(r.effectiefTarief).toBeCloseTo(0.50468, 4);
  });

  it('verlaagt de bijtelling met de eigen bijdrage, die je zelf netto betaalt', () => {
    const r = berekenBijtelling({ cataloguswaarde: 40000, aandrijving: 'brandstof', jaarEersteToelating: 2026, brutoJaarsalaris: 50000, eigenBijdragePerMaand: 100 });
    expect(r.bijtellingPerJaar).toBe(8800 - 1200);
    expect(r.nettoKostenPerMaand).toBeCloseTo(r.extraBelastingPerMaand + 100, 6);
  });

  it('laat de bijtelling niet onder nul zakken bij een hoge eigen bijdrage', () => {
    const r = berekenBijtelling({ cataloguswaarde: 20000, aandrijving: 'brandstof', jaarEersteToelating: 2026, brutoJaarsalaris: 50000, eigenBijdragePerMaand: 1000 });
    expect(r.bijtellingPerJaar).toBe(0);
    expect(r.extraBelastingPerJaar).toBe(0);
  });

  it('is voor een EV goedkoper dan dezelfde auto met 22%', () => {
    const r = berekenBijtelling({ cataloguswaarde: 45000, aandrijving: 'elektrisch', jaarEersteToelating: 2026, brutoJaarsalaris: 60000 });
    expect(r.nettoKostenPerMaand).toBeLessThan(r.nettoKostenStandaardPerMaand);
  });

  it('rekent in de hoogste schijf met 49,5%', () => {
    const r = berekenBijtelling({ cataloguswaarde: 40000, aandrijving: 'brandstof', jaarEersteToelating: 2026, brutoJaarsalaris: 150000 });
    expect(r.effectiefTarief).toBeCloseTo(0.495, 6);
  });
});

describe('arbeidskorting 2026', () => {
  it('bouwt op in drie stappen en sluit aan op de grenzen', async () => {
    const { arbeidskorting } = await import('./belasting');
    expect(arbeidskorting(0)).toBe(0);
    expect(arbeidskorting(11965)).toBeCloseTo(996, 0);
    expect(arbeidskorting(25845)).toBeCloseTo(5300, 0);
    expect(arbeidskorting(45592)).toBeCloseTo(5685, 0);
    expect(arbeidskorting(132920)).toBeCloseTo(0, 0);
  });
  it('maakt de belasting nooit negatief', async () => {
    const { nettoBelasting } = await import('./belasting');
    expect(nettoBelasting(0)).toBe(0);
    expect(nettoBelasting(5000)).toBe(0);
  });
});
