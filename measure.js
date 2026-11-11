/*
 * PlantMeasure measurement core. Pure functions, no DOM, so they can be unit tested.
 * Works in the browser (window.PMMeasure) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PMMeasure = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_SHAPE_FACTOR = 0.7; // leaf area ~ k * length * width
  const MIN_REF_FRACTION = 0.05;    // reference must span >= 5% of the longer image side
  const MAX_REF_CM = 1000;

  const isPoint = (q) => Array.isArray(q) && q.length === 2 &&
    q.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1);
  const isSegment = (p) => Array.isArray(p) && p.length === 2 && isPoint(p[0]) && isPoint(p[1]);

  function dist(a, b, w, h) {
    return Math.hypot((a[0] - b[0]) * w, (a[1] - b[1]) * h);
  }

  /** Parse the model's reply; tolerates code fences and surrounding prose. */
  function parseModelJson(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty reply from the model.');
    const m = text.match(/\{[\s\S]*\}/);
    try {
      const j = JSON.parse(m ? m[0] : text);
      if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not an object');
      return j;
    } catch (e) {
      throw new Error('The model did not return valid JSON. Please try again.');
    }
  }

  /** Reference length in cm, or null when missing, non-numeric, <= 0 or absurd. */
  function validRefLength(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) && n > 0 && n <= MAX_REF_CM ? n : null;
  }

  const round1 = (x) => Math.round(x * 10) / 10;
  const mean = (arr) => {
    const v = arr.filter((x) => x != null);
    return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };

  /**
   * Turn the model's normalized endpoints into centimetres.
   * @param {object} j        parsed model JSON
   * @param {number} w,h      image size in pixels (canvas size)
   * @param {number} refCm    known length of the reference object
   * @param {object} opts     { shapeFactor }
   */
  function analyze(j, w, h, refCm, opts) {
    const k = opts && Number.isFinite(opts.shapeFactor) && opts.shapeFactor > 0
      ? opts.shapeFactor : DEFAULT_SHAPE_FACTOR;
    const out = {
      shapeFactor: k, scale: null, refOk: false, warning: '', segments: [],
      leaves: [], leafCount: null, health: null, color: null, notes: null, confidence: null,
      leafL: null, leafW: null, leafA: null, height: null, stemD: null, fruitD: null,
    };

    const count = Number(j.leaf_count);
    out.leafCount = Number.isInteger(count) && count >= 0 && count < 10000 ? count : null;
    out.health = ['good', 'fair', 'poor'].includes(j.health) ? j.health : null;
    out.color = typeof j.color === 'string' ? j.color.slice(0, 80) : null;
    out.notes = typeof j.health_notes === 'string' ? j.health_notes.slice(0, 300) : null;
    out.confidence = ['low', 'medium', 'high'].includes(j.confidence) ? j.confidence : null;

    const R = j.reference;
    const refLen = validRefLength(refCm);
    if (!refLen) {
      out.warning = 'Enter a valid reference length (greater than 0 cm).';
    } else if (!R || R.found !== true || !isSegment([R.p1, R.p2])) {
      out.warning = 'Reference object not found. Retake with it clearly visible.';
    } else {
      const refPx = dist(R.p1, R.p2, w, h);
      if (refPx / Math.max(w, h) < MIN_REF_FRACTION) {
        out.warning = 'Reference object looks too small in the photo. Move closer and retake.';
      } else {
        out.scale = refLen / refPx;
        out.refOk = true;
        out.segments.push({ a: R.p1, b: R.p2, color: '#ffd400', label: 'ref' });
      }
    }

    const cm = (seg) => (out.refOk && isSegment(seg) ? round1(dist(seg[0], seg[1], w, h) * out.scale) : null);
    const addSeg = (seg, color, label) => { if (isSegment(seg)) out.segments.push({ a: seg[0], b: seg[1], color, label }); };

    (Array.isArray(j.leaves) ? j.leaves.slice(0, 4) : []).forEach((l, i) => {
      if (!l || typeof l !== 'object') return;
      const L = cm(l.length), W = cm(l.width);
      const A = L != null && W != null ? round1(k * L * W) : null;
      out.leaves.push({ L, W, A });
      addSeg(l.length, '#ff4d4d', 'L' + (i + 1) + (L != null ? ' ' + L : ''));
      addSeg(l.width, '#4da6ff', 'W' + (i + 1) + (W != null ? ' ' + W : ''));
    });
    out.leafL = mean(out.leaves.map((x) => x.L));
    out.leafW = mean(out.leaves.map((x) => x.W));
    out.leafA = mean(out.leaves.map((x) => x.A));

    if (j.stem && typeof j.stem === 'object') {
      out.height = cm(j.stem.height);
      out.stemD = cm(j.stem.diameter);
      addSeg(j.stem.height, '#7CFC00', 'H' + (out.height != null ? ' ' + out.height : ''));
      addSeg(j.stem.diameter, '#ff9f1c', out.stemD != null ? String(out.stemD) : '');
    }
    if (j.fruit && typeof j.fruit === 'object') {
      out.fruitD = cm(j.fruit.diameter);
      addSeg(j.fruit.diameter, '#ff66cc', out.fruitD != null ? String(out.fruitD) : '');
    }
    return out;
  }

  /** One CSV cell. Neutralizes spreadsheet formula injection (=, +, -, @). */
  function csvCell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function toCsv(rows, keys) {
    return [keys.map(csvCell).join(',')].concat(rows.map((r) => keys.map((x) => csvCell(r[x])).join(','))).join('\n');
  }

  return { DEFAULT_SHAPE_FACTOR, MIN_REF_FRACTION, isSegment, dist, parseModelJson, validRefLength, analyze, csvCell, toCsv };
});
