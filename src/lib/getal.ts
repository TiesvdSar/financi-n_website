/** Leest een Nederlands getal: "30.000", "2,33", "€ 1.250,50" of "2.5". Geeft NaN bij ongeldige invoer. */
export function parseGetal(tekst: string): number {
  let t = tekst.replace(/[€\s]/g, '');
  if (t === '') return NaN;
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
