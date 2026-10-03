import { describe, expect, it } from 'vitest';
import { parseGetal } from './getal';

describe('parseGetal', () => {
  it.each([
    ['30.000', 30000],
    ['30000', 30000],
    ['2,33', 2.33],
    ['2.33', 2.33],
    ['€ 1.250,50', 1250.5],
    ['-1,5', -1.5],
  ])('leest "%s" als %d', (tekst, verwacht) => {
    expect(parseGetal(tekst)).toBe(verwacht);
  });
  it.each(['', 'abc', '1,2,3', '12a'])('geeft NaN voor "%s"', (tekst) => {
    expect(parseGetal(tekst)).toBeNaN();
  });
});
