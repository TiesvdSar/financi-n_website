import { describe, expect, it } from 'vitest';
import { geleendScenario, nettoRentePct } from './geleend-geld';

/** Overig vermogen levert € 5.000 op: het heffingsvrije resultaat is daarmee al benut. */
const basis = { leenbedrag: 10000, rentePct: 4, rendementPct: 7, overigRendement: 5000 };

describe('geleendScenario met ander box 3-rendement (voorbeelden uit het artikel)', () => {
  it('€ 10.000 tegen 4% met 7% rendement: € 108 extra belasting, € 144 voordeel, € 192 netto', () => {
    const s = geleendScenario(basis);
    expect(s.resultaat).toBeCloseTo(300, 6);
    expect(s.extraBelasting).toBeCloseTo(108, 6);
    expect(s.belastingvoordeel).toBeCloseTo(144, 6);
    expect(s.netto).toBeCloseTo(192, 6);
  });

  it('€ 50.000: € 720 voordeel en € 960 netto', () => {
    const s = geleendScenario({ ...basis, leenbedrag: 50000, overigRendement: 10000 });
    expect(s.belastingvoordeel).toBeCloseTo(720, 6);
    expect(s.netto).toBeCloseTo(960, 6);
  });

  it('0% rendement: de volledige rente gaat af van je resultaat, je krijgt 36% terug', () => {
    const s = geleendScenario({ ...basis, rendementPct: 0 });
    expect(s.extraBelasting).toBeCloseTo(-144, 6);
    expect(s.netto).toBeCloseTo(-256, 6);
    expect(s.verrekenbaarVerlies).toBe(0);
  });

  it('−20%: het verlies verlaagt dezelfde jaar je belasting op ander rendement', () => {
    const s = geleendScenario({ ...basis, rendementPct: -20 });
    expect(s.extraBelasting).toBeCloseTo(-864, 6);
    expect(s.netto).toBeCloseTo(-1536, 6);
    expect(s.verrekenbaarVerlies).toBe(0);
  });

  it('break-even ligt precies bij rendement = rente', () => {
    expect(geleendScenario({ ...basis, rendementPct: 4 }).netto).toBeCloseTo(0, 6);
  });

  it('volgt een andere rente', () => {
    const s = geleendScenario({ ...basis, rentePct: 6 });
    expect(s.belastingvoordeel).toBeCloseTo(216, 6);
  });
});

describe('geleendScenario zonder ander box 3-rendement', () => {
  it('gebruikt dan eerst het heffingsvrije resultaat', () => {
    const s = geleendScenario({ ...basis, leenbedrag: 50000, overigRendement: 0 });
    expect(s.extraBelasting).toBe(0);
    expect(s.belastingvoordeel).toBeCloseTo((3500 - 1800) * 0.36, 6);
  });

  it('kan een verlies alleen naar latere jaren meenemen', () => {
    const s = geleendScenario({ ...basis, overigRendement: 0, rendementPct: -20 });
    expect(s.netto).toBeCloseTo(-2400, 6);
    expect(s.verrekenbaarVerlies).toBeCloseTo(2400, 6);
  });

  it('neemt een verlies onder € 500 niet mee', () => {
    expect(geleendScenario({ ...basis, overigRendement: 0, rendementPct: 0 }).verrekenbaarVerlies).toBe(0);
  });
});

describe('nettoRentePct', () => {
  it('4% rente kost netto 2,56%', () => {
    expect(nettoRentePct(4)).toBeCloseTo(2.56, 10);
  });
});
