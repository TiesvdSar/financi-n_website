/**
 * Eenvoudige SVG-lijngrafiek voor de calculators: één y-as in euro's, kruisdraad met tooltip
 * bij hover, en bediening met de pijltjestoetsen. Opmaak staat in src/styles/calculator.css.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface Reeks {
  naam: string;
  /** Kleurslot uit calculator.css: 1 of 2. */
  slot: 1 | 2;
  waarden: number[];
  stippel?: boolean;
}

export interface GrafiekOpties {
  /** X-waarden (jaren); gelijk aan de lengte van elke reeks. */
  x: number[];
  reeksen: Reeks[];
  xTitel: string;
  /** Optionele achtergrondband vanaf x = 0, bijvoorbeeld voor een aanloopfase. */
  band?: { tot: number; label: string };
  tooltipKop: (x: number) => string;
  formatteer: (waarde: number) => string;
  /** Opmaak van de x-as; standaard het getal zelf. */
  formatteerX?: (x: number) => string;
  /** Optionele markering van één x-waarde, bijvoorbeeld een optimum. */
  markering?: { x: number; label: string };
}

function maak<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function mooieStap(ruw: number): number {
  const macht = 10 ** Math.floor(Math.log10(ruw));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * macht >= ruw) return f * macht;
  return 10 * macht;
}

/** Koppelt een grafiek aan een element met daarin `svg.plot` en `.tooltip`. */
export function maakLijnGrafiek(vlak: HTMLElement) {
  const svg = vlak.querySelector<SVGSVGElement>('svg.plot')!;
  const tooltip = vlak.querySelector<HTMLElement>('.tooltip')!;
  let opties: GrafiekOpties | null = null;
  let actief = -1;
  let breedte = 0;
  let x = (_: number) => 0;
  let y = (_: number) => 0;

  function teken(nieuw: GrafiekOpties) {
    opties = nieuw;
    breedte = Math.max(280, svg.clientWidth || 600);
    const hoogte = 260;
    const m = { links: 76, rechts: 16, boven: 12, onder: 36 };
    svg.setAttribute('viewBox', `0 0 ${breedte} ${hoogte}`);
    svg.setAttribute('height', String(hoogte));
    svg.replaceChildren();

    const xMin = opties.x[0];
    const xMax = Math.max(xMin + 1, opties.x[opties.x.length - 1]);
    const yMaxRuw = Math.max(1, ...opties.reeksen.flatMap((r) => r.waarden));
    const yMinRuw = Math.min(0, ...opties.reeksen.flatMap((r) => r.waarden));
    const stap = mooieStap((yMaxRuw - yMinRuw) / 4);
    const yMax = Math.ceil(yMaxRuw / stap) * stap;
    const yMin = Math.floor(yMinRuw / stap) * stap;

    x = (v) => m.links + ((v - xMin) / (xMax - xMin)) * (breedte - m.links - m.rechts);
    y = (v) => hoogte - m.onder - ((v - yMin) / (yMax - yMin)) * (hoogte - m.boven - m.onder);

    if (opties.band && opties.band.tot > 0) {
      const xEind = x(Math.min(opties.band.tot, xMax));
      svg.append(maak('rect', { x: m.links, y: m.boven, width: xEind - m.links, height: hoogte - m.boven - m.onder, class: 'band' }));
      if (xEind - m.links > 48) {
        const t = maak('text', { x: m.links + 4, y: m.boven + 12, class: 'as-tekst' });
        t.textContent = opties.band.label;
        svg.append(t);
      }
    }

    for (let w = yMin; w <= yMax + 1e-9; w += stap) {
      svg.append(maak('line', { x1: m.links, x2: breedte - m.rechts, y1: y(w), y2: y(w), class: w === 0 ? 'basislijn' : 'raster' }));
      const t = maak('text', { x: m.links - 8, y: y(w) + 4, 'text-anchor': 'end', class: 'as-tekst' });
      t.textContent = opties.formatteer(w);
      svg.append(t);
    }
    const xStap = mooieStap((xMax - xMin) / (breedte < 500 ? 4 : 6));
    for (let j = Math.ceil(xMin / xStap) * xStap; j <= xMax + 1e-9; j += xStap) {
      const t = maak('text', { x: x(j), y: hoogte - m.onder + 18, 'text-anchor': 'middle', class: 'as-tekst' });
      t.textContent = opties.formatteerX ? opties.formatteerX(j) : String(j);
      svg.append(t);
    }
    const asTitel = maak('text', { x: breedte - m.rechts, y: hoogte - 4, 'text-anchor': 'end', class: 'as-tekst' });
    asTitel.textContent = opties.xTitel;
    svg.append(asTitel);

    if (opties.markering) {
      const mx = x(opties.markering.x);
      svg.append(maak('line', { x1: mx, x2: mx, y1: m.boven, y2: hoogte - m.onder, class: 'markering' }));
      const t = maak('text', { x: mx + 4, y: m.boven + 12, class: 'as-tekst markering-tekst' });
      t.textContent = opties.markering.label;
      svg.append(t);
    }

    // Tweede reeks eerst, zodat de hoofdreeks bovenop ligt.
    for (const r of [...opties.reeksen].reverse()) {
      const d = r.waarden.map((v, i) => `${i ? 'L' : 'M'}${x(opties!.x[i]).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      svg.append(maak('path', { d, class: `lijn lijn-${r.slot}${r.stippel ? ' stippel' : ''}` }));
    }

    svg.append(maak('line', { class: 'kruis', x1: 0, x2: 0, y1: m.boven, y2: hoogte - m.onder, visibility: 'hidden' }));
    for (const r of opties.reeksen) svg.append(maak('circle', { class: `punt punt-${r.slot}`, r: 4, visibility: 'hidden' }));

    if (actief >= opties.x.length) actief = opties.x.length - 1;
    if (actief >= 0) toon(actief);
  }

  function toon(index: number) {
    if (!opties) return;
    actief = index;
    const px = x(opties.x[index]);
    const kruis = svg.querySelector('.kruis')!;
    kruis.setAttribute('x1', String(px));
    kruis.setAttribute('x2', String(px));
    kruis.setAttribute('visibility', 'visible');
    const punten = svg.querySelectorAll('.punt');
    opties.reeksen.forEach((r, i) => {
      punten[i].setAttribute('cx', String(px));
      punten[i].setAttribute('cy', String(y(r.waarden[index])));
      punten[i].setAttribute('visibility', 'visible');
    });

    const kop = document.createElement('p');
    kop.className = 'tt-kop';
    kop.textContent = opties.tooltipKop(opties.x[index]);
    const rijen = opties.reeksen.map((r) => {
      const div = document.createElement('div');
      div.className = 'tt-rij';
      const sleutel = document.createElement('span');
      sleutel.className = `tt-sleutel sleutel-${r.slot}`;
      const w = document.createElement('strong');
      w.textContent = opties!.formatteer(r.waarden[index]);
      const l = document.createElement('span');
      l.textContent = r.naam;
      div.append(sleutel, w, l);
      return div;
    });
    tooltip.replaceChildren(kop, ...rijen);
    tooltip.hidden = false;

    const vlakBreedte = svg.getBoundingClientRect().width;
    const links = px * (vlakBreedte / breedte);
    const tipBreedte = tooltip.offsetWidth;
    const rechtsVanLijn = links + 12 + tipBreedte <= vlakBreedte;
    tooltip.style.left = `${Math.max(0, rechtsVanLijn ? links + 12 : links - tipBreedte - 12)}px`;
  }

  function verberg() {
    actief = -1;
    tooltip.hidden = true;
    for (const el of svg.querySelectorAll('.kruis, .punt')) el.setAttribute('visibility', 'hidden');
  }

  svg.addEventListener('pointermove', (e) => {
    if (!opties) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * breedte;
    let beste = 0;
    for (let i = 1; i < opties.x.length; i++) {
      if (Math.abs(x(opties.x[i]) - vx) < Math.abs(x(opties.x[beste]) - vx)) beste = i;
    }
    toon(beste);
  });
  svg.addEventListener('pointerleave', verberg);
  svg.addEventListener('blur', verberg);
  svg.addEventListener('keydown', (e) => {
    if (!opties) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      toon(Math.min(opties.x.length - 1, Math.max(0, actief < 0 ? 0 : actief + delta)));
    } else if (e.key === 'Escape') {
      verberg();
    }
  });
  new ResizeObserver(() => {
    if (opties) teken(opties);
  }).observe(vlak);

  return { teken };
}
