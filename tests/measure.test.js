const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../measure.js');

// 1000 x 500 px image. Reference: 30 cm spanning x 0.2 -> 0.7 => 500 px => 0.06 cm/px.
const W = 1000, H = 500;
const base = () => ({
  reference: { found: true, p1: [0.2, 0.5], p2: [0.7, 0.5] },
  leaf_count: 5, color: 'dark green', health: 'good', health_notes: 'ok', confidence: 'high',
  leaves: [{ length: [[0.1, 0.1], [0.35, 0.1]], width: [[0.2, 0.1], [0.2, 0.4]] }],
  stem: { height: [[0.9, 0.1], [0.9, 0.9]], diameter: [[0.88, 0.5], [0.9, 0.5]] },
  fruit: null,
});

test('converts pixels to cm using the reference object', () => {
  const r = M.analyze(base(), W, H, 30);
  assert.equal(r.refOk, true);
  assert.ok(Math.abs(r.scale - 0.06) < 1e-9);
  assert.equal(r.leaves[0].L, 15);          // 250 px * 0.06
  assert.equal(r.leaves[0].W, 9);           // 0.3 * 500 px = 150 px * 0.06
  assert.equal(r.height, 24);               // 0.8 * 500 px = 400 px * 0.06
  assert.equal(r.stemD, 1.2);               // 0.02 * 1000 px = 20 px * 0.06
});

test('uses image aspect ratio (non-square images)', () => {
  const j = base();
  j.reference = { found: true, p1: [0.5, 0.1], p2: [0.5, 0.9] }; // vertical, 400 px of 500
  const r = M.analyze(j, W, H, 20);
  assert.ok(Math.abs(r.scale - 0.05) < 1e-9);
});

test('leaf area = shapeFactor * L * W, default 0.7, configurable', () => {
  assert.equal(M.analyze(base(), W, H, 30).leaves[0].A, 94.5);              // 0.7*15*9
  assert.equal(M.analyze(base(), W, H, 30, { shapeFactor: 0.8 }).leaves[0].A, 108); // 0.8*15*9
  assert.equal(M.analyze(base(), W, H, 30, { shapeFactor: -1 }).shapeFactor, 0.7);
});

test('withholds all sizes when the reference is missing', () => {
  const j = base(); j.reference = { found: false };
  const r = M.analyze(j, W, H, 30);
  assert.equal(r.refOk, false);
  assert.equal(r.leafL, null); assert.equal(r.height, null);
  assert.match(r.warning, /not found/i);
  assert.equal(r.leafCount, 5);
});

test('rejects invalid reference lengths', () => {
  for (const bad of ['', 'abc', 0, -5, NaN, 1e6, null, undefined]) {
    const r = M.analyze(base(), W, H, bad);
    assert.equal(r.refOk, false, 'should reject ' + String(bad));
  }
  assert.equal(M.validRefLength('30'), 30);
});

test('rejects a reference that is implausibly small in the photo', () => {
  const j = base(); j.reference = { found: true, p1: [0.5, 0.5], p2: [0.51, 0.5] };
  const r = M.analyze(j, W, H, 30);
  assert.equal(r.refOk, false);
  assert.match(r.warning, /too small/i);
});

test('ignores out-of-range or malformed points instead of crashing', () => {
  const j = base();
  j.leaves = [{ length: [[0, 0], [5, 5]], width: 'x' }, null, { length: [[0.1, 0.1], [0.35, 0.1]] }];
  j.stem = 'oops'; j.leaf_count = 'many'; j.health = 'excellent';
  const r = M.analyze(j, W, H, 30);
  assert.equal(r.leaves[0].L, null);
  assert.equal(r.leaves[1].L, 15);
  assert.equal(r.leafCount, null);
  assert.equal(r.health, null);
  assert.equal(r.height, null);
});

test('caps analysed leaves at four', () => {
  const j = base(); j.leaves = Array(9).fill(j.leaves[0]);
  assert.equal(M.analyze(j, W, H, 30).leaves.length, 4);
});

test('parseModelJson handles fences and prose, rejects junk', () => {
  assert.deepEqual(M.parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(M.parseModelJson('Here you go: {"a":1} done'), { a: 1 });
  assert.throws(() => M.parseModelJson('no json here'), /valid JSON/);
  assert.throws(() => M.parseModelJson(''), /Empty/);
  assert.throws(() => M.parseModelJson(null), /Empty/);
  assert.throws(() => M.parseModelJson('[1,2]'), /valid JSON/);
});

test('CSV escapes quotes and neutralizes formula injection', () => {
  assert.equal(M.csvCell('a"b'), '"a""b"');
  assert.equal(M.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  for (const c of ['+1', '-1', '@cmd']) assert.ok(M.csvCell(c).startsWith('"\''));
  assert.equal(M.csvCell(null), '""');
  assert.equal(M.csvCell(0), '"0"');
  const csv = M.toCsv([{ a: 1, b: 'x,y' }], ['a', 'b']);
  assert.equal(csv, '"a","b"\n"1","x,y"');
});
