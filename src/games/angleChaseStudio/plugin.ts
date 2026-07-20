import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type {
  PuzzleCandidate,
  ValidationIssue,
  ValidationResult
} from "../../core/types.ts";

// ===== Seeded RNG =====

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed ^ 0x1a4c9e37) >>> 0;
  }
  next(): number {
    // Math.imul keeps this a precision-safe 32-bit multiply. A plain `this.s *
    // 1103515245` overflows Number.MAX_SAFE_INTEGER for large `s`, which
    // silently zeroes out the low bits of the result — harmless for wide
    // ranges but catastrophic for small-modulus choices (e.g. a 50/50 coin
    // flip via `% 2`), which would otherwise always collapse to 0.
    this.s = (Math.imul(this.s, 1103515245) + 12345) >>> 0;
    return this.s;
  }
  int(min: number, max: number): number {
    // LCGs are notorious for short-period, correlated low bits (a classic
    // Hull-Dobell-style weakness): consecutive calls' low bits are related by
    // a simple deterministic flip, so two small-modulus choices a few calls
    // apart can end up perfectly correlated instead of independent. Shifting
    // out the low 8 bits before reducing avoids that for small ranges
    // (booleans, coin flips) while barely affecting large ranges.
    return min + ((this.next() >>> 8) % (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[(this.next() >>> 8) % arr.length];
  }
}

// ===== Geometry primitives =====

type Pt = { x: number; y: number };
type Seg = { a: Pt; b: Pt };

// An arc marker: starting at absolute direction `dir1` (degrees, standard
// math convention measured counter-clockwise from the +x axis), sweeping
// counter-clockwise by `value` degrees. Because `value` is always derived
// directly from the same geometry used to draw the rays, there is never any
// ambiguity about which of the two possible arcs (value vs. 360-value) to
// draw.
type AngleMark = {
  vertex: Pt;
  dir1: number;
  value: number;
  label: string;
  isTarget: boolean;
  isGiven: boolean;
  radius: number;
};

// A small text label pinned to a named geometric point (a vertex or a named
// point like the extension point E). Used whenever the prompt refers to a
// point/vertex by letter (e.g. "point V", "triangle ABC", "the apex angle at
// A") so the player can map the words onto the figure. Purely presentational —
// never part of the deduction — so it does not affect the answer or the chain.
type PointLabel = { x: number; y: number; label: string };

// A circle primitive (introduced for the tier 9-10 circle-geometry strand).
// Purely presentational geometry: the renderer draws it BEFORE segments/arcs/
// labels so chords, radii, tangents, and point letters sit on top. Points that
// lie on the circle are still labeled through the existing `pointLabels`
// mechanism — the circle itself carries no labels.
type Circle = { cx: number; cy: number; r: number };

type Diagram = {
  width: number;
  height: number;
  segments: Seg[];
  angleMarks: AngleMark[];
  pointLabels?: PointLabel[];
  circles?: Circle[];
};

type ChainStep = {
  theorem: string;
  text: string;
  resultValue: number;
};

type GenResult = {
  promptText: string;
  diagram: Diagram;
  answer: number;
  targetLabel: string;
  chain: ChainStep[];
  skillTags: string[];
  variant: string;
  selfCheck: boolean;
};

function normDeg(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function dirPoint(v: Pt, dirDeg: number, dist: number): Pt {
  const rad = (dirDeg * Math.PI) / 180;
  return { x: v.x + dist * Math.cos(rad), y: v.y - dist * Math.sin(rad) };
}

function fullLine(v: Pt, dirDeg: number, halfLen: number): Seg {
  return {
    a: dirPoint(v, dirDeg, halfLen),
    b: dirPoint(v, normDeg(dirDeg + 180), halfLen)
  };
}

// Given two other points p1, p2 as seen from `vertex`, build an AngleMark
// whose arc visually matches the real angle between them. Works for any
// three points regardless of how they were constructed.
function angleMarkFromVertex(
  vertex: Pt,
  p1: Pt,
  p2: Pt,
  value: number,
  label: string,
  isTarget: boolean,
  isGiven: boolean,
  radius: number
): AngleMark {
  const dir1 = normDeg(
    (Math.atan2(-(p1.y - vertex.y), p1.x - vertex.x) * 180) / Math.PI
  );
  const dir2 = normDeg(
    (Math.atan2(-(p2.y - vertex.y), p2.x - vertex.x) * 180) / Math.PI
  );
  const sweep12 = normDeg(dir2 - dir1);
  const start = Math.abs(sweep12 - value) < 1 ? dir1 : dir2;
  return { vertex, dir1: start, value, label, isTarget, isGiven, radius };
}

// Split a full turn (or a set of ray directions) into consecutive regions.
// `dirsRaw` must be the exact absolute directions of every ray from the
// shared vertex; regions are the gaps between consecutive sorted directions
// (wrapping around 360). Because directions are all integers in this game,
// every region value comes out as an exact integer too.
function computeRegions(
  dirsRaw: number[]
): { boundary: [number, number]; value: number }[] {
  const dirs = dirsRaw.map(normDeg);
  const sorted = [...dirs].sort((a, b) => a - b);
  const regions: { boundary: [number, number]; value: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const d1 = sorted[i];
    const d2 = sorted[(i + 1) % sorted.length];
    const value =
      i === sorted.length - 1
        ? Math.round(360 - d1 + d2)
        : Math.round(d2 - d1);
    regions.push({ boundary: [d1, d2], value });
  }
  return regions;
}

function triangleApex(angleB: number, angleC: number, B: Pt, C: Pt): Pt {
  const d = Math.hypot(C.x - B.x, C.y - B.y);
  const bRad = (angleB * Math.PI) / 180;
  const cRad = (angleC * Math.PI) / 180;
  const cotB = Math.cos(bRad) / Math.sin(bRad);
  const cotC = Math.cos(cRad) / Math.sin(cRad);
  const h = d / (cotB + cotC);
  const x = h * cotB;
  return { x: B.x + x, y: B.y - h };
}

function finitePt(p: Pt): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

// The (non-reflex) angle in degrees between rays vertex→p1 and vertex→p2,
// computed straight from raw (x, y) coordinates. Used by the circle-geometry
// generators' selfCheck to re-derive every marked angle from the drawn figure
// independently of the theorem arithmetic that produced it — catching the
// class of bug where the chain and solve() agree but are both wrong.
function angleAt(vertex: Pt, p1: Pt, p2: Pt): number {
  const a1 = Math.atan2(-(p1.y - vertex.y), p1.x - vertex.x);
  const a2 = Math.atan2(-(p2.y - vertex.y), p2.x - vertex.x);
  let d = (Math.abs(a1 - a2) * 180) / Math.PI;
  if (d > 180) d = 360 - d;
  return d;
}

// True when a to-scale figure's drawn angle matches its theorem value within a
// half-degree — the tolerance the grader itself uses.
function angleMatches(vertex: Pt, p1: Pt, p2: Pt, expected: number): boolean {
  return Math.abs(angleAt(vertex, p1, p2) - expected) < 0.5;
}

// A point on a circle centered at O, at standard-math direction `dirDeg`
// (counter-clockwise from +x; screen y grows downward, handled by dirPoint).
function circlePt(O: Pt, dirDeg: number, r: number): Pt {
  return dirPoint(O, dirDeg, r);
}

// Place a vertex label opposite the average direction of the edges leaving
// that vertex — i.e. into the widest open wedge around it, which is where the
// interior angle's arc is NOT drawn. Robust even when three or more segments
// (e.g. a triangle vertex whose side is also extended) meet at the point.
function labelAwayFromEdges(
  vertex: Pt,
  neighbors: Pt[],
  dist: number,
  label: string
): PointLabel {
  let sx = 0;
  let sy = 0;
  for (const nb of neighbors) {
    const dx = nb.x - vertex.x;
    const dy = nb.y - vertex.y;
    const len = Math.hypot(dx, dy) || 1;
    sx += dx / len;
    sy += dy / len;
  }
  const len = Math.hypot(sx, sy);
  if (len < 1e-6) return { x: vertex.x, y: vertex.y - dist, label };
  return { x: vertex.x - (sx / len) * dist, y: vertex.y - (sy / len) * dist, label };
}

// For a single-vertex "fan" figure (rays around a common point V), place the
// V label a short distance from the vertex, aimed into the WIDEST angular gap
// between rays so it never lands on a ray or an arc.
function vertexLabelInWidestGap(
  V: Pt,
  dirs: number[],
  dist: number,
  label: string
): PointLabel {
  const sorted = [...dirs.map(normDeg)].sort((a, b) => a - b);
  let bestMid = 90;
  let bestGap = -1;
  for (let i = 0; i < sorted.length; i++) {
    const d1 = sorted[i];
    const d2 = sorted[(i + 1) % sorted.length];
    const gap = i === sorted.length - 1 ? 360 - d1 + d2 : d2 - d1;
    if (gap > bestGap) {
      bestGap = gap;
      bestMid = normDeg(d1 + gap / 2);
    }
  }
  const rad = (bestMid * Math.PI) / 180;
  return { x: V.x + dist * Math.cos(rad), y: V.y - dist * Math.sin(rad), label };
}

// ===== Hint ladder builder (shared across all templates) =====

function buildHintsFromChain(chain: ChainStep[], answer: number): string[] {
  if (chain.length === 0) {
    return ["Look at the diagram.", "Apply an angle theorem.", `Answer: ${answer}°`];
  }
  const theoremNames = chain.map((c) => c.theorem).join(" → then → ");

  const hint1 =
    chain.length === 1
      ? `Look closely at how the given angle and the angle marked "?" are positioned. What geometric relationship connects them? (Related idea: ${chain[0].theorem}.)`
      : `This one takes a few steps. Work outward from the given angle, one relationship at a time. The chain of ideas you'll need: ${theoremNames}.`;

  const hint2 =
    chain.length === 1
      ? chain[0].text
      : chain
          .slice(0, chain.length - 1)
          .map((c) => c.text)
          .join(" ");

  const hint3 =
    chain.length === 1
      ? `So the marked angle = ${answer}°.`
      : `${chain[chain.length - 1].text} So the marked angle = ${answer}°.`;

  return [hint1, hint2, hint3];
}

// ===== Template 1: angles on a straight line =====

function genLine(rng: Rng, parts: 2 | 3): GenResult {
  const V: Pt = { x: 220, y: 180 };
  const halfLen = 150;
  // Tilt the whole straight line by a random angle so the figure isn't always
  // drawn flat. Region values are computed in unrotated (0°..180°) space, so
  // `rot` only affects the drawn directions — the arithmetic and chain are
  // orientation-independent.
  const rot = rng.int(0, 359);

  let dirsBetween: number[];
  let values: number[];

  if (parts === 2) {
    const a = rng.int(15, 165);
    values = [a, 180 - a];
    dirsBetween = [a];
  } else {
    let a = 60;
    let b = 60;
    let c = 60;
    for (let tries = 0; tries < 60; tries++) {
      a = rng.int(15, 150);
      b = rng.int(15, 150);
      c = 180 - a - b;
      if (c >= 15 && c <= 150) break;
    }
    if (a + b + c !== 180) {
      a = 60;
      b = 60;
      c = 60;
    }
    values = [a, b, c];
    dirsBetween = [a, a + b];
  }

  const dirs = [0, ...dirsBetween, 180];
  const sorted = [...dirs].sort((x, y) => x - y);
  const regionVals: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    regionVals.push(sorted[i + 1] - sorted[i]);
  }

  const hideIdx = rng.int(0, parts - 1);
  const givenIdx = regionVals.map((_, i) => i).filter((i) => i !== hideIdx);
  const targetVal = regionVals[hideIdx];

  const chainText =
    parts === 2
      ? `Angles on a straight line always add up to 180°. 180 − ${regionVals[givenIdx[0]]} = ${targetVal}°.`
      : `All the angles along this straight line add up to 180°. ${givenIdx
          .map((i) => regionVals[i])
          .join(" + ")} + ? = 180, so ? = 180 − ${givenIdx
          .map((i) => regionVals[i])
          .join(" − ")} = ${targetVal}°.`;

  const chain: ChainStep[] = [
    { theorem: "Angles on a Line", text: chainText, resultValue: targetVal }
  ];

  const segments: Seg[] = [fullLine(V, rot, halfLen)];
  for (const d of dirsBetween) {
    segments.push({ a: V, b: dirPoint(V, normDeg(d + rot), halfLen * 0.75) });
  }

  const angleMarks: AngleMark[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    angleMarks.push({
      vertex: V,
      dir1: normDeg(sorted[i] + rot),
      value: sorted[i + 1] - sorted[i],
      label: i === hideIdx ? "?" : `${regionVals[i]}°`,
      isTarget: i === hideIdx,
      isGiven: i !== hideIdx,
      radius: 42 + i * 20
    });
  }

  // The line spans directions rot and rot+180; the reflex side (the empty half)
  // is the widest gap, so V's label lands cleanly off the line there.
  const pointLabels: PointLabel[] = [
    vertexLabelInWidestGap(V, [rot, normDeg(rot + 180), ...dirsBetween.map((d) => normDeg(d + rot))], 20, "V")
  ];

  const selfCheck = regionVals.reduce((s, v) => s + v, 0) === 180;

  return {
    promptText:
      'Rays split a straight line at point V. Find the measure of the angle marked "?".',
    diagram: { width: 440, height: 350, segments, angleMarks, pointLabels },
    answer: targetVal,
    targetLabel: "the marked angle",
    chain,
    skillTags: ["geometry", "angles", "linear_pair", "angles_on_a_line"],
    variant: `line-${parts}`,
    selfCheck
  };
}

// ===== Template 2: angles around a point (sum 360) =====

function genPoint(rng: Rng, parts: 3 | 4): GenResult {
  const V: Pt = { x: 220, y: 180 };

  let vals: number[] = [];
  for (let tries = 0; tries < 60; tries++) {
    vals = [];
    let remaining = 360;
    for (let i = 0; i < parts - 1; i++) {
      const roomLeft = (parts - 1 - i) * 20;
      const maxV = Math.min(200, remaining - roomLeft);
      const v = rng.int(20, Math.max(20, maxV));
      vals.push(v);
      remaining -= v;
    }
    vals.push(remaining);
    if (remaining >= 20 && remaining <= 260) break;
  }
  if (vals.reduce((s, v) => s + v, 0) !== 360 || vals.some((v) => v < 10)) {
    const each = Math.floor(360 / parts);
    vals = Array(parts).fill(each);
    vals[0] += 360 - vals.reduce((s, v) => s + v, 0);
  }

  const hideIdx = rng.int(0, parts - 1);
  const givenIdx = vals.map((_, i) => i).filter((i) => i !== hideIdx);
  const targetVal = vals[hideIdx];

  const chainText = `The angles all the way around a point always add up to 360°. ${givenIdx
    .map((i) => vals[i])
    .join(" + ")} + ? = 360, so ? = 360 − ${givenIdx
    .map((i) => vals[i])
    .join(" − ")} = ${targetVal}°.`;

  const chain: ChainStep[] = [
    { theorem: "Angles Around a Point", text: chainText, resultValue: targetVal }
  ];

  // Spin the whole fan of rays by a random offset so the configuration isn't
  // always anchored to 0°. Every angle value between consecutive rays is
  // unchanged, so the answer and chain are orientation-independent.
  const rot = rng.int(0, 359);
  let cum = rot;
  const dirsRaw: number[] = [];
  for (const v of vals) {
    dirsRaw.push(normDeg(cum));
    cum += v;
  }

  const halfLen = 130;
  const segments: Seg[] = dirsRaw.map((d) => ({
    a: V,
    b: dirPoint(V, d, halfLen)
  }));
  const angleMarks: AngleMark[] = vals.map((v, i) => ({
    vertex: V,
    dir1: dirsRaw[i],
    value: v,
    label: i === hideIdx ? "?" : `${v}°`,
    isTarget: i === hideIdx,
    isGiven: i !== hideIdx,
    radius: 38 + i * 16
  }));

  const pointLabels: PointLabel[] = [
    vertexLabelInWidestGap(V, dirsRaw, 18, "V")
  ];

  const selfCheck = vals.reduce((s, v) => s + v, 0) === 360;

  return {
    promptText:
      'Several rays meet at point V. Find the measure of the angle marked "?".',
    diagram: { width: 440, height: 340, segments, angleMarks, pointLabels },
    answer: targetVal,
    targetLabel: "the marked angle",
    chain,
    skillTags: ["geometry", "angles", "angles_around_a_point"],
    variant: `point-${parts}`,
    selfCheck
  };
}

// ===== Template 3: two lines crossing (vertical angles) =====

function genCross(rng: Rng): GenResult {
  const V: Pt = { x: 220, y: 170 };
  const a = rng.int(20, 160);
  // Rotate the whole "X" by a random offset so the crossing isn't always drawn
  // with one line horizontal. `a` is the angle between the two lines, so all
  // four region values are unchanged by the rotation.
  const rot = rng.int(0, 179);
  const dirs = [rot, normDeg(rot + 180), normDeg(rot + a), normDeg(rot + a + 180)];
  const regions = computeRegions(dirs);

  const gIdx = rng.int(0, 3);
  const hopIsVertical = rng.pick([true, false]);
  const tIdx = hopIsVertical
    ? (gIdx + 2) % 4
    : (gIdx + rng.pick([1, 3])) % 4;

  const givenVal = regions[gIdx].value;
  const targetVal = regions[tIdx].value;

  const chain: ChainStep[] = hopIsVertical
    ? [
        {
          theorem: "Vertical Angles",
          text: `The given angle and the angle marked "?" are vertical angles — they sit directly across from each other where the two lines cross. Vertical angles are always equal, so the marked angle = ${givenVal}°.`,
          resultValue: targetVal
        }
      ]
    : [
        {
          theorem: "Linear Pair",
          text: `The given angle and the angle marked "?" sit next to each other along one of the straight lines, so they are supplementary (they add to 180°). 180 − ${givenVal} = ${targetVal}°.`,
          resultValue: targetVal
        }
      ];

  const halfLen = 150;
  const segments: Seg[] = [fullLine(V, rot, halfLen), fullLine(V, normDeg(rot + a), halfLen)];
  const angleMarks: AngleMark[] = regions.map((r, i) => ({
    vertex: V,
    dir1: r.boundary[0],
    value: r.value,
    label: i === gIdx ? `${givenVal}°` : i === tIdx ? "?" : "",
    isTarget: i === tIdx,
    isGiven: i === gIdx,
    radius: 34
  }));

  const selfCheck =
    regions.reduce((s, r) => s + r.value, 0) === 360 &&
    regions[gIdx].value === (hopIsVertical ? regions[tIdx].value : 180 - regions[tIdx].value);

  const pointLabels: PointLabel[] = [
    vertexLabelInWidestGap(V, dirs, 18, "V")
  ];

  return {
    promptText:
      'Two lines cross at point V. Find the measure of the angle marked "?".',
    diagram: { width: 440, height: 340, segments, angleMarks, pointLabels },
    answer: targetVal,
    targetLabel: "the marked angle",
    chain,
    skillTags: [
      "geometry",
      "angles",
      hopIsVertical ? "vertical_angles" : "linear_pair",
      "angle_chasing"
    ],
    variant: `cross-${hopIsVertical ? "vertical" : "linear"}`,
    selfCheck
  };
}

// ===== Template 4: triangle angle sum (basic) =====

function genTriangleBasic(rng: Rng): GenResult {
  let A = 60;
  let B = 60;
  let C = 60;
  let Ap: Pt = { x: 0, y: 0 };
  const Bp: Pt = { x: 110, y: 250 };
  const Cp: Pt = { x: 370, y: 250 };

  for (let tries = 0; tries < 60; tries++) {
    A = rng.int(20, 130);
    B = rng.int(20, 130);
    C = 180 - A - B;
    if (C < 20 || C > 130) continue;
    Ap = triangleApex(B, C, Bp, Cp);
    if (finitePt(Ap) && Ap.y > 55 && Ap.y < 235 && Ap.x > 55 && Ap.x < 425) break;
  }
  if (!finitePt(Ap) || Ap.y <= 55 || Ap.y >= 235 || Ap.x <= 55 || Ap.x >= 425) {
    A = 60;
    B = 60;
    C = 60;
    Ap = triangleApex(B, C, Bp, Cp);
  }

  const angles = [A, B, C];
  const hideIdx = rng.int(0, 2);
  const givenIdx = [0, 1, 2].filter((i) => i !== hideIdx);
  const targetVal = angles[hideIdx];

  const chainText = `The three angles inside any triangle always add up to 180°. ${givenIdx
    .map((i) => angles[i])
    .join(" + ")} + ? = 180, so ? = 180 − ${givenIdx
    .map((i) => angles[i])
    .join(" − ")} = ${targetVal}°.`;

  const chain: ChainStep[] = [
    { theorem: "Triangle Angle Sum", text: chainText, resultValue: targetVal }
  ];

  const segments: Seg[] = [
    { a: Ap, b: Bp },
    { a: Bp, b: Cp },
    { a: Cp, b: Ap }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(Ap, Bp, Cp, A, hideIdx === 0 ? "?" : `${A}°`, hideIdx === 0, hideIdx !== 0, 30),
    angleMarkFromVertex(Bp, Ap, Cp, B, hideIdx === 1 ? "?" : `${B}°`, hideIdx === 1, hideIdx !== 1, 30),
    angleMarkFromVertex(Cp, Ap, Bp, C, hideIdx === 2 ? "?" : `${C}°`, hideIdx === 2, hideIdx !== 2, 30)
  ];

  const selfCheck = A + B + C === 180 && finitePt(Ap);

  return {
    promptText:
      'Find the measure of the triangle’s angle marked "?".',
    diagram: { width: 480, height: 300, segments, angleMarks },
    answer: targetVal,
    targetLabel: "the marked angle",
    chain,
    skillTags: ["geometry", "angles", "triangle_angle_sum"],
    variant: "triangle-basic",
    selfCheck
  };
}

// ===== Template 5: triangle with algebraic angle expressions =====

function genTriangleAlgebraic(rng: Rng): GenResult {
  let x = 20;
  let k1 = 2;
  let k2 = 10;
  let angle1 = 40;
  let angle2 = 30;
  let knownC = 110;
  let found = false;

  const Bp: Pt = { x: 110, y: 250 };
  const Cp: Pt = { x: 370, y: 250 };
  let Ap: Pt = { x: 240, y: 100 };

  for (let tries = 0; tries < 100; tries++) {
    x = rng.int(6, 35);
    k1 = rng.int(1, 3);
    k2 = rng.pick([10, 15, 20, -10, -15, 25, -20, 30, -25]);
    angle1 = k1 * x;
    angle2 = x + k2;
    knownC = 180 - angle1 - angle2;
    if (
      angle1 >= 15 &&
      angle1 <= 150 &&
      angle2 >= 15 &&
      angle2 <= 150 &&
      knownC >= 20 &&
      knownC <= 130
    ) {
      const candApex = triangleApex(angle2, knownC, Bp, Cp);
      if (
        finitePt(candApex) &&
        candApex.y > 55 && candApex.y < 235 &&
        candApex.x > 55 && candApex.x < 425
      ) {
        Ap = candApex;
        found = true;
        break;
      }
    }
  }
  if (!found) {
    x = 20;
    k1 = 2;
    k2 = 10;
    angle1 = 40;
    angle2 = 30;
    knownC = 110;
    Ap = triangleApex(angle2, knownC, Bp, Cp);
  }

  const targetIsAngle1 = rng.pick([true, false]);
  const targetVal = targetIsAngle1 ? angle1 : angle2;

  const label1 = k1 === 1 ? "x°" : `${k1}x°`;
  const label2 =
    k2 === 0 ? "x°" : k2 > 0 ? `(x + ${k2})°` : `(x − ${-k2})°`;

  const eqText = `${k1 === 1 ? "x" : k1 + "x"} + (x ${k2 >= 0 ? "+ " + k2 : "− " + -k2}) + ${knownC} = 180`;
  const simplifiedCoef = k1 + 1;
  const simplifiedConst = k2 + knownC;
  const rhs = 180 - simplifiedConst;

  const chain: ChainStep[] = [
    {
      theorem: "Triangle Angle Sum (set up equation)",
      text: `The three angles of the triangle add up to 180°. Set up the equation: ${eqText}.`,
      resultValue: x
    },
    {
      theorem: "Solve the equation",
      text: `Combine like terms: ${simplifiedCoef}x + ${simplifiedConst} = 180, so ${simplifiedCoef}x = ${rhs}, and x = ${x}.`,
      resultValue: x
    },
    {
      theorem: "Substitute back",
      text: `Now substitute x = ${x} into the angle you need: ${targetIsAngle1 ? label1 : label2} = ${targetVal}°.`,
      resultValue: targetVal
    }
  ];

  const segments: Seg[] = [
    { a: Ap, b: Bp },
    { a: Bp, b: Cp },
    { a: Cp, b: Ap }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(Ap, Bp, Cp, angle1, label1, targetIsAngle1, !targetIsAngle1, 30),
    angleMarkFromVertex(Bp, Ap, Cp, angle2, label2, !targetIsAngle1, targetIsAngle1, 30),
    angleMarkFromVertex(Cp, Ap, Bp, knownC, `${knownC}°`, false, true, 30)
  ];

  const selfCheck = angle1 + angle2 + knownC === 180 && finitePt(Ap);

  return {
    promptText:
      "Two of this triangle's angles are given as expressions in x, and one is a plain number. Find x, then find the numeric measure of the highlighted angle.",
    diagram: { width: 480, height: 300, segments, angleMarks },
    answer: targetVal,
    targetLabel: "the highlighted angle",
    chain,
    skillTags: ["geometry", "angles", "triangle_angle_sum", "algebra", "equations"],
    variant: "triangle-algebraic",
    selfCheck
  };
}

// ===== Template 6: exterior angle theorem =====

function genTriangleExterior(rng: Rng): GenResult {
  let A = 40;
  let B = 50;
  let C = 90;
  const Bp: Pt = { x: 100, y: 250 };
  const Cp: Pt = { x: 300, y: 250 };
  let Ap: Pt = { x: 200, y: 100 };

  for (let tries = 0; tries < 60; tries++) {
    A = rng.int(20, 110);
    B = rng.int(20, 110);
    C = 180 - A - B;
    if (C < 20 || C > 130) continue;
    Ap = triangleApex(B, C, Bp, Cp);
    if (finitePt(Ap) && Ap.y > 55 && Ap.y < 235 && Ap.x > 45 && Ap.x < 360) break;
  }
  if (!finitePt(Ap) || Ap.y <= 55 || Ap.y >= 235 || Ap.x <= 45 || Ap.x >= 360) {
    A = 40;
    B = 50;
    C = 90;
    Ap = triangleApex(B, C, Bp, Cp);
  }

  const ext = 180 - C;

  const dirBC = normDeg(
    (Math.atan2(-(Cp.y - Bp.y), Cp.x - Bp.x) * 180) / Math.PI
  );
  const Dp = dirPoint(Cp, dirBC, 90);

  const chain: ChainStep[] = [
    {
      theorem: "Triangle Angle Sum",
      text: `First find the missing interior angle at the bottom-right vertex: the three angles of the triangle add to 180°, so that angle = 180 − ${A} − ${B} = ${C}°.`,
      resultValue: C
    },
    {
      theorem: "Exterior Angle Theorem",
      text: `The exterior angle marked "?" and that interior angle sit on a straight line together, so they add to 180°: exterior angle = 180 − ${C} = ${ext}°. (Notice that's the same as ${A} + ${B} — an exterior angle always equals the sum of the two remote interior angles.)`,
      resultValue: ext
    }
  ];

  // Draw the full triangle (including side CA) plus the extension C→D. The
  // exterior angle at C sits in the wedge between the extension CD and side CA,
  // so CA must be present for that arc — and for angle A's arc — to be bounded
  // by real segments rather than floating.
  const segments: Seg[] = [
    { a: Ap, b: Bp },
    { a: Bp, b: Cp },
    { a: Cp, b: Ap },
    { a: Cp, b: Dp }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(Bp, Ap, Cp, B, `${B}°`, false, true, 28),
    angleMarkFromVertex(Ap, Bp, Cp, A, `${A}°`, false, true, 26),
    angleMarkFromVertex(Cp, Dp, Ap, ext, "?", true, false, 30)
  ];

  const selfCheck = A + B + C === 180 && ext === 180 - C && finitePt(Ap) && finitePt(Dp);

  return {
    promptText:
      'One side of this triangle is extended beyond a vertex, forming an exterior angle. Find the measure of the angle marked "?".',
    diagram: { width: 440, height: 320, segments, angleMarks },
    answer: ext,
    targetLabel: "the exterior angle",
    chain,
    skillTags: ["geometry", "angles", "triangle_angle_sum", "exterior_angle_theorem"],
    variant: "triangle-exterior",
    selfCheck
  };
}

// ===== Template 7: parallel lines cut by a transversal =====

function genParallel(rng: Rng, hops: 1 | 2 | 3): GenResult {
  const viewW = 460;
  const a = rng.int(40, 140);
  const downDir = normDeg(a + 180);
  const L = 190;

  const P2x = 230;
  const P1: Pt = {
    x: P2x - L * Math.cos((downDir * Math.PI) / 180),
    y: 90
  };
  const P2: Pt = dirPoint(P1, downDir, L);

  const regions = computeRegions([0, 180, a, normDeg(a + 180)]);
  const startIdx = rng.int(0, 3);

  const chain: ChainStep[] = [];
  let finalPoint: "P1" | "P2" = "P1";
  let finalIdx = startIdx;

  function adjacentIdx(idx: number): number {
    return rng.pick([(idx + 1) % 4, (idx + 3) % 4]);
  }

  if (hops === 1) {
    finalPoint = "P2";
    finalIdx = startIdx;
    chain.push({
      theorem: "Corresponding Angles",
      text: `These two angles are corresponding angles — they sit in the same position at each crossing point where the transversal cuts the two parallel lines. Corresponding angles are always equal, so the marked angle = ${regions[startIdx].value}°.`,
      resultValue: regions[startIdx].value
    });
  } else {
    const useVerticalFirst = rng.pick([true, false]);
    const midIdx = useVerticalFirst ? (startIdx + 2) % 4 : adjacentIdx(startIdx);

    if (useVerticalFirst) {
      chain.push({
        theorem: "Vertical Angles",
        text: `At the top crossing point, the given angle and the next angle we need are vertical angles (equal), so that angle also = ${regions[midIdx].value}°.`,
        resultValue: regions[midIdx].value
      });
    } else {
      chain.push({
        theorem: "Linear Pair",
        text: `At the top crossing point, the given angle and the next angle we need lie on a straight line together (supplementary), so that angle = 180 − ${regions[startIdx].value} = ${regions[midIdx].value}°.`,
        resultValue: regions[midIdx].value
      });
    }

    chain.push({
      theorem: "Corresponding Angles",
      text: `That angle corresponds to an angle at the bottom crossing point (same position relative to the transversal and its parallel line) — corresponding angles are equal, so the matching angle at the bottom crossing point is also ${regions[midIdx].value}°.`,
      resultValue: regions[midIdx].value
    });

    if (hops === 2) {
      finalPoint = "P2";
      finalIdx = midIdx;
    } else {
      const useVerticalSecond = rng.pick([true, false]);
      const endIdx = useVerticalSecond ? (midIdx + 2) % 4 : adjacentIdx(midIdx);
      if (useVerticalSecond) {
        chain.push({
          theorem: "Vertical Angles",
          text: `Finally, at the bottom crossing point, the angle marked "?" is vertically opposite the angle we just found, so it also = ${regions[endIdx].value}°.`,
          resultValue: regions[endIdx].value
        });
      } else {
        chain.push({
          theorem: "Linear Pair",
          text: `Finally, at the bottom crossing point, the angle marked "?" and the angle we just found lie on a straight line together, so it = 180 − ${regions[midIdx].value} = ${regions[endIdx].value}°.`,
          resultValue: regions[endIdx].value
        });
      }
      finalPoint = "P2";
      finalIdx = endIdx;
    }
  }

  const targetVal = regions[finalIdx].value;
  const givenVal = regions[startIdx].value;

  const marginX = Math.max(50, Math.min(150, P1.x - 20, viewW - 20 - P1.x, P2.x - 20, viewW - 20 - P2.x));

  const segments: Seg[] = [
    fullLine(P1, 0, marginX),
    fullLine(P2, 0, marginX),
    { a: dirPoint(P1, a, 40), b: dirPoint(P2, downDir, 40) }
  ];

  function marksForPoint(point: Pt, pointName: "P1" | "P2"): AngleMark[] {
    return regions.map((r, i) => {
      const isG = pointName === "P1" && i === startIdx;
      const isT = pointName === finalPoint && i === finalIdx;
      return {
        vertex: point,
        dir1: r.boundary[0],
        value: r.value,
        label: isG ? `${r.value}°` : isT ? "?" : "",
        isTarget: isT,
        isGiven: isG,
        radius: 30
      };
    });
  }

  const angleMarks: AngleMark[] = [
    ...marksForPoint(P1, "P1"),
    ...marksForPoint(P2, "P2")
  ];

  const selfCheck =
    regions.reduce((s, r) => s + r.value, 0) === 360 &&
    regions[startIdx].value === givenVal &&
    Number.isFinite(targetVal);

  return {
    promptText:
      'Two parallel lines are cut by a transversal. Find the measure of the angle marked "?".',
    diagram: { width: viewW, height: 380, segments, angleMarks },
    answer: targetVal,
    targetLabel: "the marked angle",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "parallel_lines",
      "corresponding_angles",
      "alternate_angles",
      "co_interior_angles"
    ],
    variant: `parallel-${hops}hop`,
    selfCheck
  };
}

// ===== Template 8: polygon interior angle sum =====

function genPolygon(rng: Rng): GenResult {
  const n = rng.int(5, 8);
  const totalSum = (n - 2) * 180;

  let vals: number[] = [];
  for (let tries = 0; tries < 80; tries++) {
    vals = [];
    let remaining = totalSum;
    for (let i = 0; i < n - 1; i++) {
      const avg = remaining / (n - i);
      const v = Math.max(60, Math.min(170, Math.round(avg + rng.int(-25, 25))));
      vals.push(v);
      remaining -= v;
    }
    vals.push(remaining);
    if (remaining >= 60 && remaining <= 170) break;
  }
  if (vals.reduce((s, v) => s + v, 0) !== totalSum || vals[n - 1] < 10) {
    const each = Math.round(totalSum / n);
    vals = Array(n).fill(each);
    vals[n - 1] = totalSum - each * (n - 1);
  }

  const hideIdx = rng.int(0, n - 1);
  const givenVals = vals.filter((_, i) => i !== hideIdx);
  const targetVal = vals[hideIdx];

  const chainText = `The interior angles of any ${n}-sided polygon always add up to (n−2)×180° = (${n}−2)×180° = ${totalSum}°. Add up the ${
    n - 1
  } known angles: ${givenVals.join(" + ")} = ${givenVals.reduce((s, v) => s + v, 0)}. So the missing angle = ${totalSum} − ${givenVals.reduce(
    (s, v) => s + v,
    0
  )} = ${targetVal}°.`;

  const chain: ChainStep[] = [
    { theorem: "Polygon Angle Sum", text: chainText, resultValue: targetVal }
  ];

  const center: Pt = { x: 230, y: 195 };
  const R = 135;
  // Random starting rotation so the (simplified, not-to-scale) n-gon isn't
  // always drawn in the same orientation.
  const rot = rng.int(0, 359);
  const verts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const theta = rot + i * (360 / n);
    verts.push(dirPoint(center, theta, R));
  }

  const segments: Seg[] = verts.map((v, i) => ({ a: v, b: verts[(i + 1) % n] }));
  const regularInteriorAngle = ((n - 2) * 180) / n;
  const angleMarks: AngleMark[] = verts.map((v, i) => {
    const prev = verts[(i - 1 + n) % n];
    const next = verts[(i + 1) % n];
    return angleMarkFromVertex(
      v,
      prev,
      next,
      regularInteriorAngle,
      i === hideIdx ? "?" : `${vals[i]}°`,
      i === hideIdx,
      i !== hideIdx,
      26
    );
  });

  const selfCheck = vals.reduce((s, v) => s + v, 0) === totalSum;

  return {
    promptText: `This ${n}-sided polygon's angles are labeled (the sketch is simplified and not drawn exactly to scale). Find the measure of the angle marked "?".`,
    diagram: { width: 460, height: 390, segments, angleMarks },
    answer: targetVal,
    targetLabel: "the marked angle",
    chain,
    skillTags: ["geometry", "angles", "polygon_angle_sum"],
    variant: `polygon-${n}`,
    selfCheck
  };
}

// ===== Template 9: isosceles triangle + exterior angle (composite) =====

// Isosceles triangle ABC with AB = AC. Side AB is extended beyond B to a
// point E, forming an exterior angle at B. Given that exterior angle, the
// player must chain three theorems to reach the apex: a linear pair (to get
// the interior base angle at B), the isosceles base-angles theorem (to get
// the equal base angle at C), and finally the triangle angle sum (to get the
// apex). This mirrors the classic "isosceles + exterior angle" olympiad-prep
// composite: no single theorem application solves it, and the intermediate
// base angle is never marked in the diagram, so the player must actually
// track it as scratch work.
function genIsoscelesExterior(rng: Rng): GenResult {
  let beta = 50;
  let apex = 80;
  const Bp: Pt = { x: 120, y: 250 };
  const Cp: Pt = { x: 340, y: 250 };
  let Ap: Pt = { x: 230, y: 100 };
  let found = false;

  for (let tries = 0; tries < 60; tries++) {
    beta = rng.int(25, 60);
    apex = 180 - 2 * beta;
    if (apex < 55 || apex > 130) continue;
    Ap = triangleApex(beta, beta, Bp, Cp);
    if (finitePt(Ap) && Ap.y > 30 && Ap.y < 230) {
      found = true;
      break;
    }
  }
  if (!found) {
    beta = 50;
    apex = 80;
    Ap = triangleApex(beta, beta, Bp, Cp);
  }

  const ext = 180 - beta;

  // Extend side AB beyond B to point E (E, B, A are collinear).
  const dirAtoB = normDeg(
    (Math.atan2(-(Bp.y - Ap.y), Bp.x - Ap.x) * 180) / Math.PI
  );
  const Ep = dirPoint(Bp, dirAtoB, 95);

  const chain: ChainStep[] = [
    {
      theorem: "Linear Pair",
      text: `The exterior angle at B (angle EBC) and the triangle's interior angle at B (angle ABC) sit on the straight line through E, B, and A, so they're supplementary. Interior angle ABC = 180 − ${ext} = ${beta}°.`,
      resultValue: beta
    },
    {
      theorem: "Isosceles Base Angles",
      text: `Since AB = AC, triangle ABC is isosceles, so its base angles are equal: angle ACB = angle ABC = ${beta}°.`,
      resultValue: beta
    },
    {
      theorem: "Triangle Angle Sum",
      text: `The three angles of triangle ABC add to 180°, so the apex angle = 180 − ${beta} − ${beta} = ${apex}°.`,
      resultValue: apex
    }
  ];

  const segments: Seg[] = [
    { a: Ap, b: Ep },
    { a: Bp, b: Cp },
    { a: Cp, b: Ap }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(Bp, Ep, Cp, ext, `${ext}°`, false, true, 30),
    angleMarkFromVertex(Ap, Bp, Cp, apex, "?", true, false, 30)
  ];

  const pointLabels: PointLabel[] = [
    labelAwayFromEdges(Ap, [Bp, Cp], 18, "A"),
    labelAwayFromEdges(Bp, [Ap, Cp, Ep], 20, "B"),
    labelAwayFromEdges(Cp, [Ap, Bp], 18, "C"),
    labelAwayFromEdges(Ep, [Bp], 16, "E")
  ];

  const selfCheck =
    beta * 2 + apex === 180 &&
    ext === 180 - beta &&
    finitePt(Ap) &&
    finitePt(Ep);

  return {
    promptText:
      'Triangle ABC is isosceles with AB = AC. Side AB is extended beyond B to point E, forming an exterior angle at B. Find the measure of the triangle\'s angle marked "?" (the apex angle at A).',
    diagram: { width: 460, height: 360, segments, angleMarks, pointLabels },
    answer: apex,
    targetLabel: "the apex angle",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "isosceles_triangle",
      "exterior_angle_theorem",
      "triangle_angle_sum",
      "angle_chasing"
    ],
    variant: "isosceles-exterior",
    selfCheck
  };
}

// ===== Template 10: angle bisector splitting two triangles sharing a cevian =====

// Triangle ABC with cevian AD, where AD bisects angle A and D lies on BC.
// This creates two sub-triangles, ABD and ADC, that share side AD. Given
// angle B and one bisected half-angle (angle BAD), the player must solve
// triangle ABD for the cevian's angle at D, hop across the straight line
// B-D-C (linear pair) to get the cevian's angle on the other side, invoke
// the bisector property to get the other half-angle, and then solve
// triangle ADC for angle C. D's position is derived exactly via the angle
// bisector length-ratio theorem (BD:DC = AB:AC), so the figure is genuinely
// consistent, not just visually suggestive.
function genCevianTwoTriangles(rng: Rng): GenResult {
  let angleB = 50;
  let half = 30;
  let angleC = 70;
  const Bp: Pt = { x: 90, y: 255 };
  const Cp: Pt = { x: 350, y: 255 };
  let Ap: Pt = { x: 220, y: 100 };
  let found = false;

  for (let tries = 0; tries < 100; tries++) {
    angleB = rng.int(25, 100);
    half = rng.int(15, 65);
    const apexFull = 2 * half;
    angleC = 180 - angleB - apexFull;
    if (angleC < 15 || angleC > 130) continue;
    Ap = triangleApex(angleB, angleC, Bp, Cp);
    if (finitePt(Ap) && Ap.y > 20 && Ap.y < 230 && Ap.x > 10 && Ap.x < 430) {
      found = true;
      break;
    }
  }
  if (!found) {
    angleB = 50;
    half = 30;
    angleC = 180 - angleB - 2 * half;
    Ap = triangleApex(angleB, angleC, Bp, Cp);
  }

  const angleADB = 180 - angleB - half;
  const angleADC = 180 - angleADB;

  const AB = Math.hypot(Ap.x - Bp.x, Ap.y - Bp.y);
  const AC = Math.hypot(Ap.x - Cp.x, Ap.y - Cp.y);
  const t = AB / (AB + AC);
  const Dp: Pt = {
    x: Bp.x + t * (Cp.x - Bp.x),
    y: Bp.y + t * (Cp.y - Bp.y)
  };

  const chain: ChainStep[] = [
    {
      theorem: "Triangle Angle Sum",
      text: `Look at the smaller triangle ABD first: its angles are ${angleB}° at B and ${half}° at A (half of the bisected angle). So angle ADB = 180 − ${angleB} − ${half} = ${angleADB}°.`,
      resultValue: angleADB
    },
    {
      theorem: "Linear Pair",
      text: `B, D, and C lie on the same straight line, so angle ADC and angle ADB are supplementary: angle ADC = 180 − ${angleADB} = ${angleADC}°.`,
      resultValue: angleADC
    },
    {
      theorem: "Angle Bisector",
      text: `AD bisects angle A, so its other half, angle DAC, is also ${half}° — the same as angle BAD.`,
      resultValue: half
    },
    {
      theorem: "Triangle Angle Sum",
      text: `Now use the other small triangle, ADC: angle ACB = 180 − angle ADC − angle DAC = 180 − ${angleADC} − ${half} = ${angleC}°.`,
      resultValue: angleC
    }
  ];

  const segments: Seg[] = [
    { a: Ap, b: Bp },
    { a: Bp, b: Cp },
    { a: Cp, b: Ap },
    { a: Ap, b: Dp }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(Bp, Ap, Cp, angleB, `${angleB}°`, false, true, 30),
    angleMarkFromVertex(Ap, Bp, Dp, half, `${half}°`, false, true, 24),
    angleMarkFromVertex(Cp, Ap, Bp, angleC, "?", true, false, 30)
  ];

  const pointLabels: PointLabel[] = [
    labelAwayFromEdges(Ap, [Bp, Cp, Dp], 18, "A"),
    labelAwayFromEdges(Bp, [Ap, Cp], 18, "B"),
    labelAwayFromEdges(Cp, [Ap, Bp], 18, "C"),
    labelAwayFromEdges(Dp, [Bp, Cp, Ap], 18, "D")
  ];

  const selfCheck =
    angleB + 2 * half + angleC === 180 &&
    angleADB === 180 - angleB - half &&
    angleADC === angleB + half &&
    finitePt(Ap) &&
    finitePt(Dp) &&
    Dp.x > Math.min(Bp.x, Cp.x) &&
    Dp.x < Math.max(Bp.x, Cp.x);

  return {
    promptText:
      'In triangle ABC, segment AD bisects angle A, with D on side BC. Find the measure of the angle marked "?" (angle ACB).',
    diagram: { width: 460, height: 320, segments, angleMarks, pointLabels },
    answer: angleC,
    targetLabel: "angle ACB",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "angle_bisector",
      "triangle_angle_sum",
      "linear_pair",
      "angle_chasing"
    ],
    variant: "cevian-two-triangles",
    selfCheck
  };
}

// ===== Template 11: isosceles triangle, base angles as two different expressions =====

function formatLinExpr(k: number, c: number): string {
  const coefPart = k === 1 ? "x" : `${k}x`;
  if (c === 0) return `${coefPart}°`;
  return `(${coefPart} ${c > 0 ? "+ " + c : "− " + -c})°`;
}

// Isosceles triangle ABC (AB = AC) whose two base angles are given as two
// *different-looking* linear expressions in x (e.g. `(2x + 5)°` at B and
// `(3x − 15)°` at C). Because the base angles must be equal, the player has
// to recognize that fact, set the two expressions equal to each other
// (a genuine two-expression equation, not a single substitution), solve for
// x, and then either report the base angle or take one more triangle-sum
// step to reach the apex.
function genIsoscelesAlgebraic(rng: Rng): GenResult {
  let x = 10;
  let k1 = 2;
  let k2 = 3;
  let c1 = 0;
  let c2 = 0;
  let beta = 40;
  let apex = 100;
  const Bp: Pt = { x: 120, y: 250 };
  const Cp: Pt = { x: 340, y: 250 };
  let Ap: Pt = { x: 230, y: 130 };
  let found = false;

  for (let tries = 0; tries < 80; tries++) {
    x = rng.int(4, 25);
    const options = [1, 2, 3];
    k1 = rng.pick(options);
    k2 = rng.pick(options.filter((v) => v !== k1));
    beta = rng.int(25, 60);
    apex = 180 - 2 * beta;
    c1 = beta - k1 * x;
    c2 = beta - k2 * x;
    if (Math.abs(c1) > 45 || Math.abs(c2) > 45 || c1 === c2) continue;
    Ap = triangleApex(beta, beta, Bp, Cp);
    if (finitePt(Ap) && Ap.y > 20 && Ap.y < 235) {
      found = true;
      break;
    }
  }
  if (!found) {
    x = 10;
    k1 = 2;
    k2 = 3;
    beta = 40;
    apex = 100;
    c1 = beta - k1 * x;
    c2 = beta - k2 * x;
    Ap = triangleApex(beta, beta, Bp, Cp);
  }

  const label1 = formatLinExpr(k1, c1);
  const label2 = formatLinExpr(k2, c2);

  const targetIsApex = rng.pick([true, false]);

  const eqSide = (k: number, c: number) =>
    `${k === 1 ? "x" : k + "x"} ${c >= 0 ? "+ " + c : "− " + -c}`;
  const eqText = `${eqSide(k1, c1)} = ${eqSide(k2, c2)}`;
  const kDiff = k1 - k2;
  const cDiff = c2 - c1;
  const kDiffTerm =
    kDiff === 1 ? "x" : kDiff === -1 ? "−x" : `${kDiff}x`;

  const chain: ChainStep[] = [
    {
      theorem: "Isosceles Base Angles (set up equation)",
      text: `Since AB = AC, the base angles at B and C must be equal. Set the two expressions equal: ${eqText}.`,
      resultValue: x
    },
    {
      theorem: "Solve the equation",
      text: `Combine like terms: ${kDiffTerm} = ${cDiff}, so x = ${x}.`,
      resultValue: x
    },
    {
      theorem: "Substitute back",
      text: `Substitute x = ${x} into either expression: ${label1} = ${beta}°. That's each base angle.`,
      resultValue: beta
    }
  ];

  if (targetIsApex) {
    chain.push({
      theorem: "Triangle Angle Sum",
      text: `The three angles of the triangle add to 180°, so the apex angle = 180 − ${beta} − ${beta} = ${apex}°.`,
      resultValue: apex
    });
  }

  const answer = targetIsApex ? apex : beta;

  let markB: AngleMark;
  let markC: AngleMark;
  const apexMarks: AngleMark[] = [];

  if (targetIsApex) {
    markB = angleMarkFromVertex(Bp, Ap, Cp, beta, label1, false, true, 30);
    markC = angleMarkFromVertex(Cp, Ap, Bp, beta, label2, false, true, 30);
    apexMarks.push(angleMarkFromVertex(Ap, Bp, Cp, apex, "?", true, false, 36));
  } else {
    const bIsTarget = rng.pick([true, false]);
    markB = angleMarkFromVertex(Bp, Ap, Cp, beta, label1, bIsTarget, !bIsTarget, 30);
    markC = angleMarkFromVertex(Cp, Ap, Bp, beta, label2, !bIsTarget, bIsTarget, 30);
  }

  const segments: Seg[] = [
    { a: Ap, b: Bp },
    { a: Bp, b: Cp },
    { a: Cp, b: Ap }
  ];

  const angleMarks: AngleMark[] = [markB, markC, ...apexMarks];

  const pointLabels: PointLabel[] = [
    labelAwayFromEdges(Ap, [Bp, Cp], 18, "A"),
    labelAwayFromEdges(Bp, [Ap, Cp], 18, "B"),
    labelAwayFromEdges(Cp, [Ap, Bp], 18, "C")
  ];

  const selfCheck =
    k1 * x + c1 === beta &&
    k2 * x + c2 === beta &&
    beta * 2 + apex === 180 &&
    finitePt(Ap);

  return {
    promptText:
      "Triangle ABC is isosceles with AB = AC. Its two base angles are given as two different-looking expressions in x. Find x, then find the numeric measure of the highlighted angle.",
    diagram: { width: 480, height: 300, segments, angleMarks, pointLabels },
    answer,
    targetLabel: "the highlighted angle",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "isosceles_triangle",
      "triangle_angle_sum",
      "algebra",
      "equations"
    ],
    variant: "isosceles-algebraic",
    selfCheck
  };
}

// ===== Template 12: triangle sitting on one of two parallel lines =====

// Triangle ABC has its base BC lying on a line, and a second line through
// A is parallel to it. AC acts as a transversal cutting both parallel
// lines, so the angle between the parallel line (at A) and AC is an
// alternate interior angle to angle ACB — genuinely equal to it, verified
// here by exact direction arithmetic rather than assumed. That composes
// with the ordinary triangle angle sum to reach the apex, forcing the
// player to combine a parallel-line theorem with a triangle theorem in a
// figure shape (two horizontal lines plus a triangle hanging between them)
// that doesn't appear at any earlier difficulty tier.
function genTriangleOnParallel(rng: Rng): GenResult {
  let angleB = 50;
  let angleC = 60;
  let apex = 70;
  const Bp: Pt = { x: 90, y: 260 };
  const Cp: Pt = { x: 350, y: 260 };
  let Ap: Pt = { x: 220, y: 120 };
  let found = false;

  for (let tries = 0; tries < 80; tries++) {
    angleB = rng.int(25, 100);
    angleC = rng.int(25, 100);
    apex = 180 - angleB - angleC;
    if (apex < 15 || apex > 130) continue;
    Ap = triangleApex(angleB, angleC, Bp, Cp);
    if (finitePt(Ap) && Ap.y > 40 && Ap.y < 235 && Ap.x > 30 && Ap.x < 410) {
      found = true;
      break;
    }
  }
  if (!found) {
    angleB = 50;
    angleC = 60;
    apex = 70;
    Ap = triangleApex(angleB, angleC, Bp, Cp);
  }

  const wingPt = dirPoint(Ap, 0, 90);

  const chain: ChainStep[] = [
    {
      theorem: "Alternate Angles",
      text: `The line through A is parallel to BC, and AC is a transversal crossing both. The marked angle at A and angle ACB are alternate interior angles — they sit on opposite sides of the transversal, each between the two parallel lines — so they're equal: angle ACB = ${angleC}°.`,
      resultValue: angleC
    },
    {
      theorem: "Triangle Angle Sum",
      text: `Now use the triangle's angle sum: angle A = 180 − ${angleB} − ${angleC} = ${apex}°.`,
      resultValue: apex
    }
  ];

  const segments: Seg[] = [
    { a: { x: 40, y: 260 }, b: { x: 400, y: 260 } },
    { a: { x: 40, y: Ap.y }, b: { x: 400, y: Ap.y } },
    { a: Ap, b: Bp },
    { a: Ap, b: Cp }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(Bp, Ap, Cp, angleB, `${angleB}°`, false, true, 30),
    angleMarkFromVertex(Ap, wingPt, Cp, angleC, `${angleC}°`, false, true, 22),
    angleMarkFromVertex(Ap, Bp, Cp, apex, "?", true, false, 44)
  ];

  // A sits on the upper parallel line; B and C sit on the lower one. Include
  // the horizontal lines' directions so each letter is pushed clear of both
  // the line it lies on and the triangle's sides.
  const topLeft: Pt = { x: 40, y: Ap.y };
  const topRight: Pt = { x: 400, y: Ap.y };
  const botLeft: Pt = { x: 40, y: 260 };
  const botRight: Pt = { x: 400, y: 260 };
  const pointLabels: PointLabel[] = [
    labelAwayFromEdges(Ap, [Bp, Cp, topLeft, topRight], 20, "A"),
    labelAwayFromEdges(Bp, [Ap, botLeft, botRight], 18, "B"),
    labelAwayFromEdges(Cp, [Ap, botLeft, botRight], 18, "C")
  ];

  const selfCheck = angleB + angleC + apex === 180 && finitePt(Ap);

  return {
    promptText:
      'Triangle ABC sits with its base BC on one line; a second line through A is parallel to it. Find the measure of the triangle\'s angle marked "?" (angle A).',
    diagram: { width: 440, height: 320, segments, angleMarks, pointLabels },
    answer: apex,
    targetLabel: "angle A",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "parallel_lines",
      "alternate_angles",
      "triangle_angle_sum",
      "angle_chasing"
    ],
    variant: "triangle-on-parallel",
    selfCheck
  };
}

// ===== Circle-geometry strand (difficulty tiers 9-10) =====
//
// Every circle generator draws a genuinely to-scale figure: points are placed
// on the circle by direction so that the theorem-claimed angles are the actual
// drawn angles. Each selfCheck re-derives the marked angles from the raw
// coordinates via angleAt() (an independent path from the theorem arithmetic
// stored in the chain), and confirms all geometry sits inside the viewBox.

const CIRCLE_W = 440;
const CIRCLE_H = 340;
const CIRCLE_O: Pt = { x: 220, y: 168 };
const CIRCLE_R = 108;

// Every drawn point/label must sit inside the canvas with a small margin so
// nothing clips the SVG edge.
function inBounds(p: Pt, w: number, h: number, margin = 6): boolean {
  return p.x >= margin && p.x <= w - margin && p.y >= margin && p.y <= h - margin;
}

// Place a letter for a point that lies ON the circle: push it radially outward
// from the centre so it never sits on top of a chord or arc.
function circleLabel(O: Pt, p: Pt, out: number, label: string): PointLabel {
  const dx = p.x - O.x;
  const dy = p.y - O.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / len) * out, y: p.y + (dy / len) * out, label };
}

// ===== Template 13 (tier 9): inscribed angle theorem / central = 2 × inscribed

// A chord AB subtends a central angle AOB at the centre and an inscribed angle
// APB at a point P on the major arc. The inscribed angle is exactly half the
// central angle (both subtend the same minor arc AB). Two variants: given the
// central angle find the inscribed one, or given the inscribed angle find the
// central one.
function genInscribedCentral(rng: Rng): GenResult {
  const O = CIRCLE_O;
  const R = CIRCLE_R;

  // central is even so the inscribed half is an integer.
  let central = 80;
  let phi = 90;
  let delta = 0;
  let A: Pt = circlePt(O, 130, R);
  let B: Pt = circlePt(O, 50, R);
  let P: Pt = circlePt(O, 270, R);
  let ok = false;
  for (let tries = 0; tries < 80; tries++) {
    central = rng.int(20, 74) * 2; // 40..148, even
    phi = rng.int(0, 359);
    delta = rng.int(-45, 45);
    A = circlePt(O, phi + central / 2, R);
    B = circlePt(O, phi - central / 2, R);
    P = circlePt(O, phi + 180 + delta, R);
    const inscribed = central / 2;
    if (
      inBounds(A, CIRCLE_W, CIRCLE_H, 24) &&
      inBounds(B, CIRCLE_W, CIRCLE_H, 24) &&
      inBounds(P, CIRCLE_W, CIRCLE_H, 24) &&
      angleMatches(O, A, B, central) &&
      angleMatches(P, A, B, inscribed)
    ) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    central = 80;
    phi = 90;
    delta = 0;
    A = circlePt(O, phi + central / 2, R);
    B = circlePt(O, phi - central / 2, R);
    P = circlePt(O, phi + 180 + delta, R);
  }
  const inscribed = central / 2;

  const findInscribed = rng.pick([true, false]);
  const answer = findInscribed ? inscribed : central;

  const chain: ChainStep[] = findInscribed
    ? [
        {
          theorem: "Inscribed Angle Theorem",
          text: `The central angle AOB and the inscribed angle APB both sit on the same arc AB. The inscribed angle is always half the central angle, so angle APB = ${central} ÷ 2 = ${inscribed}°.`,
          resultValue: inscribed
        }
      ]
    : [
        {
          theorem: "Inscribed Angle Theorem",
          text: `The inscribed angle APB and the central angle AOB both stand on the same arc AB. The central angle is always twice the inscribed angle, so angle AOB = 2 × ${inscribed} = ${central}°.`,
          resultValue: central
        }
      ];

  const segments: Seg[] = [
    { a: O, b: A },
    { a: O, b: B },
    { a: P, b: A },
    { a: P, b: B }
  ];

  const centralMark = angleMarkFromVertex(
    O,
    A,
    B,
    central,
    findInscribed ? `${central}°` : "?",
    !findInscribed,
    findInscribed,
    26
  );
  const inscribedMark = angleMarkFromVertex(
    P,
    A,
    B,
    inscribed,
    findInscribed ? "?" : `${inscribed}°`,
    findInscribed,
    !findInscribed,
    30
  );

  const pointLabels: PointLabel[] = [
    circleLabel(O, A, 16, "A"),
    circleLabel(O, B, 16, "B"),
    circleLabel(O, P, 16, "P"),
    labelAwayFromEdges(O, [A, B], 16, "O")
  ];

  const selfCheck =
    central === inscribed * 2 &&
    angleMatches(O, A, B, central) &&
    angleMatches(P, A, B, inscribed) &&
    pointLabels.every((l) => inBounds(l, CIRCLE_W, CIRCLE_H));

  return {
    promptText: findInscribed
      ? 'O is the centre of the circle. The central angle AOB is given. Find the inscribed angle marked "?" at P.'
      : 'O is the centre of the circle. The inscribed angle at P is given. Find the central angle marked "?" at O.',
    diagram: {
      width: CIRCLE_W,
      height: CIRCLE_H,
      segments,
      angleMarks: [centralMark, inscribedMark],
      pointLabels,
      circles: [{ cx: O.x, cy: O.y, r: R }]
    },
    answer,
    targetLabel: findInscribed ? "the inscribed angle" : "the central angle",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "circle_theorems",
      "inscribed_angle",
      "angle_chasing"
    ],
    variant: findInscribed ? "inscribed-angle" : "central-angle",
    selfCheck
  };
}

// ===== Template 14 (tier 9): angle in a semicircle (Thales) =====

// Triangle ABC inscribed in a circle with BC a diameter through the centre O.
// The angle at A (subtended by the diameter) is a right angle. Two variants:
// name the right angle directly (single-theorem Thales), or combine Thales
// with the triangle angle sum to find the remaining acute angle.
function genThalesSemicircle(rng: Rng): GenResult {
  const O = CIRCLE_O;
  const R = CIRCLE_R;

  let beta = 40;
  let phi = 0;
  let A: Pt = circlePt(O, 90, R);
  let B: Pt = circlePt(O, 0, R);
  let C: Pt = circlePt(O, 180, R);
  let ok = false;
  for (let tries = 0; tries < 80; tries++) {
    beta = rng.int(28, 62);
    phi = rng.int(0, 359);
    // A at phi, B & C diametrically opposite (BC is the diameter through O).
    A = circlePt(O, phi, R);
    B = circlePt(O, phi + 180 - 2 * beta, R);
    C = circlePt(O, phi - 2 * beta, R);
    if (
      inBounds(A, CIRCLE_W, CIRCLE_H, 22) &&
      inBounds(B, CIRCLE_W, CIRCLE_H, 22) &&
      inBounds(C, CIRCLE_W, CIRCLE_H, 22) &&
      angleMatches(A, B, C, 90) &&
      angleMatches(B, A, C, beta) &&
      angleMatches(C, A, B, 90 - beta)
    ) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    beta = 40;
    phi = 0;
    A = circlePt(O, phi, R);
    B = circlePt(O, phi + 180 - 2 * beta, R);
    C = circlePt(O, phi - 2 * beta, R);
  }
  const gamma = 90 - beta;

  const targetIsRight = rng.pick([true, false]);

  const chain: ChainStep[] = targetIsRight
    ? [
        {
          theorem: "Angle in a Semicircle (Thales)",
          text: `BC is a diameter, so it passes through the centre O. Any angle inscribed in a semicircle — standing on a diameter — is a right angle, so the angle at A = 90°.`,
          resultValue: 90
        }
      ]
    : [
        {
          theorem: "Angle in a Semicircle (Thales)",
          text: `BC is a diameter, so the angle at A stands on a semicircle and is therefore a right angle: angle BAC = 90°.`,
          resultValue: 90
        },
        {
          theorem: "Triangle Angle Sum",
          text: `The three angles of triangle ABC add to 180°, so angle ACB = 180 − 90 − ${beta} = ${gamma}°.`,
          resultValue: gamma
        }
      ];

  const answer = targetIsRight ? 90 : gamma;

  const segments: Seg[] = [
    { a: B, b: C },
    { a: A, b: B },
    { a: A, b: C }
  ];

  const marks: AngleMark[] = [
    angleMarkFromVertex(A, B, C, 90, targetIsRight ? "?" : "90°", targetIsRight, !targetIsRight, 24),
    angleMarkFromVertex(B, A, C, beta, `${beta}°`, false, true, 28)
  ];
  if (!targetIsRight) {
    marks.push(angleMarkFromVertex(C, A, B, gamma, "?", true, false, 28));
  }

  const pointLabels: PointLabel[] = [
    circleLabel(O, A, 16, "A"),
    circleLabel(O, B, 16, "B"),
    circleLabel(O, C, 16, "C"),
    labelAwayFromEdges(O, [B, C, A], 14, "O")
  ];

  const selfCheck =
    beta + gamma === 90 &&
    angleMatches(A, B, C, 90) &&
    angleMatches(B, A, C, beta) &&
    angleMatches(C, A, B, gamma) &&
    // B, O, C collinear (BC really is a diameter).
    Math.abs(angleAt(O, B, C) - 180) < 0.5 &&
    pointLabels.every((l) => inBounds(l, CIRCLE_W, CIRCLE_H));

  return {
    promptText: targetIsRight
      ? 'BC is a diameter of the circle (it passes through the centre O). Find the angle marked "?" at A.'
      : 'BC is a diameter of the circle (it passes through the centre O). Find the angle marked "?" at C.',
    diagram: {
      width: CIRCLE_W,
      height: CIRCLE_H,
      segments,
      angleMarks: marks,
      pointLabels,
      circles: [{ cx: O.x, cy: O.y, r: R }]
    },
    answer,
    targetLabel: targetIsRight ? "the right angle" : "angle ACB",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "circle_theorems",
      "inscribed_angle",
      "thales",
      "triangle_angle_sum"
    ],
    variant: "thales-semicircle",
    selfCheck
  };
}

// ===== Template 15 (tier 9): cyclic quadrilateral opposite angles =====

// Quadrilateral ABCD inscribed in a circle. Opposite interior angles sum to
// 180°. Given one vertex angle, find the opposite one.
function genCyclicQuad(rng: Rng): GenResult {
  const O = CIRCLE_O;
  const R = CIRCLE_R;

  // Arc measures w1..w4 (A→B, B→C, C→D, D→A), even, summing 360.
  let w: number[] = [90, 90, 90, 90];
  let phi = 0;
  let A: Pt = circlePt(O, 45, R);
  let B: Pt = circlePt(O, 135, R);
  let C: Pt = circlePt(O, 225, R);
  let D: Pt = circlePt(O, 315, R);
  let angA = 90;
  let angB = 90;
  let angC = 90;
  let angD = 90;
  let ok = false;

  for (let tries = 0; tries < 120; tries++) {
    const raw: number[] = [];
    let remaining = 360;
    for (let i = 0; i < 3; i++) {
      const roomLeft = (3 - i) * 44;
      const maxV = Math.min(150, remaining - roomLeft);
      raw.push(rng.int(22, Math.max(22, Math.floor(maxV / 2))) * 2);
      remaining -= raw[i];
    }
    raw.push(remaining);
    if (raw[3] < 44 || raw[3] > 150 || raw[3] % 2 !== 0) continue;
    phi = rng.int(0, 359);
    const dA = phi;
    const dB = phi + raw[0];
    const dC = phi + raw[0] + raw[1];
    const dD = phi + raw[0] + raw[1] + raw[2];
    A = circlePt(O, dA, R);
    B = circlePt(O, dB, R);
    C = circlePt(O, dC, R);
    D = circlePt(O, dD, R);
    angA = (raw[1] + raw[2]) / 2;
    angB = (raw[2] + raw[3]) / 2;
    angC = (raw[3] + raw[0]) / 2;
    angD = (raw[0] + raw[1]) / 2;
    if ([angA, angB, angC, angD].some((v) => v < 45 || v > 135)) continue;
    if (
      inBounds(A, CIRCLE_W, CIRCLE_H, 22) &&
      inBounds(B, CIRCLE_W, CIRCLE_H, 22) &&
      inBounds(C, CIRCLE_W, CIRCLE_H, 22) &&
      inBounds(D, CIRCLE_W, CIRCLE_H, 22) &&
      angleMatches(A, B, D, angA) &&
      angleMatches(C, B, D, angC)
    ) {
      w = raw;
      ok = true;
      break;
    }
  }
  if (!ok) {
    w = [90, 90, 90, 90];
    phi = 0;
    A = circlePt(O, 0, R);
    B = circlePt(O, 90, R);
    C = circlePt(O, 180, R);
    D = circlePt(O, 270, R);
    angA = angB = angC = angD = 90;
  }

  // Pick which opposite pair and direction: given one, find the opposite.
  const pair = rng.pick([
    { g: "B", t: "D", gv: angB, tv: angD },
    { g: "D", t: "B", gv: angD, tv: angB },
    { g: "A", t: "C", gv: angA, tv: angC },
    { g: "C", t: "A", gv: angC, tv: angA }
  ]);

  const chain: ChainStep[] = [
    {
      theorem: "Cyclic Quadrilateral",
      text: `ABCD is a cyclic quadrilateral (all four vertices lie on the circle). Opposite angles of a cyclic quadrilateral add up to 180°, so angle ${pair.t} = 180 − ${pair.gv} = ${pair.tv}°.`,
      resultValue: pair.tv
    }
  ];

  const segments: Seg[] = [
    { a: A, b: B },
    { a: B, b: C },
    { a: C, b: D },
    { a: D, b: A }
  ];

  const vmap: Record<string, { p: Pt; adj: [Pt, Pt]; val: number }> = {
    A: { p: A, adj: [B, D], val: angA },
    B: { p: B, adj: [A, C], val: angB },
    C: { p: C, adj: [B, D], val: angC },
    D: { p: D, adj: [C, A], val: angD }
  };

  const angleMarks: AngleMark[] = (["A", "B", "C", "D"] as const).map((name) => {
    const v = vmap[name];
    const isG = name === pair.g;
    const isT = name === pair.t;
    return angleMarkFromVertex(
      v.p,
      v.adj[0],
      v.adj[1],
      v.val,
      isG ? `${v.val}°` : isT ? "?" : "",
      isT,
      isG,
      24
    );
  });

  const pointLabels: PointLabel[] = [
    circleLabel(O, A, 15, "A"),
    circleLabel(O, B, 15, "B"),
    circleLabel(O, C, 15, "C"),
    circleLabel(O, D, 15, "D")
  ];

  const selfCheck =
    angA + angC === 180 &&
    angB + angD === 180 &&
    pair.gv + pair.tv === 180 &&
    angleMatches(A, B, D, angA) &&
    angleMatches(B, A, C, angB) &&
    angleMatches(C, B, D, angC) &&
    angleMatches(D, C, A, angD) &&
    pointLabels.every((l) => inBounds(l, CIRCLE_W, CIRCLE_H));

  return {
    promptText:
      'ABCD is a quadrilateral with all four corners on the circle. Find the angle marked "?".',
    diagram: {
      width: CIRCLE_W,
      height: CIRCLE_H,
      segments,
      angleMarks,
      pointLabels,
      circles: [{ cx: O.x, cy: O.y, r: R }]
    },
    answer: pair.tv,
    targetLabel: `angle ${pair.t}`,
    chain,
    skillTags: [
      "geometry",
      "angles",
      "circle_theorems",
      "cyclic_quadrilateral",
      "angle_chasing"
    ],
    variant: "cyclic-quad",
    selfCheck
  };
}

// ===== Template 16 (tier 10): triangle inscribed in a circle (composite) =====

// Triangle ABC inscribed in a circle centred O. Two radii OB and OC are drawn,
// showing the central angle BOC. Because the central angle on arc BC is twice
// the inscribed angle at A, the player recovers angle A, then uses the triangle
// angle sum to reach the third angle. A genuine circle + triangle interaction.
function genTriangleInCircle(rng: Rng): GenResult {
  const O = CIRCLE_O;
  const R = CIRCLE_R;

  let A = 50;
  let B = 60;
  let C = 70;
  let phi = 0;
  let Ap: Pt = circlePt(O, 0, R);
  let Bp: Pt = circlePt(O, 120, R);
  let Cp: Pt = circlePt(O, 240, R);
  let ok = false;

  for (let tries = 0; tries < 120; tries++) {
    A = rng.int(28, 82); // < 90 so central angle BOC = 2A is non-reflex
    B = rng.int(28, 110);
    C = 180 - A - B;
    if (C < 28 || C > 110) continue;
    phi = rng.int(0, 359);
    // Arc opposite each vertex = twice that vertex's angle.
    Ap = circlePt(O, phi, R);
    Bp = circlePt(O, phi + 2 * C, R);
    Cp = circlePt(O, phi + 2 * C + 2 * A, R);
    if (
      inBounds(Ap, CIRCLE_W, CIRCLE_H, 22) &&
      inBounds(Bp, CIRCLE_W, CIRCLE_H, 22) &&
      inBounds(Cp, CIRCLE_W, CIRCLE_H, 22) &&
      angleMatches(Ap, Bp, Cp, A) &&
      angleMatches(Bp, Ap, Cp, B) &&
      angleMatches(Cp, Ap, Bp, C) &&
      angleMatches(O, Bp, Cp, 2 * A)
    ) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    A = 50;
    B = 60;
    C = 70;
    phi = 0;
    Ap = circlePt(O, phi, R);
    Bp = circlePt(O, phi + 2 * C, R);
    Cp = circlePt(O, phi + 2 * C + 2 * A, R);
  }
  const central = 2 * A;

  // Given the central angle and angle B, find angle C; or given central + C,
  // find B. Either way angle A comes from the inscribed-angle theorem.
  const targetIsC = rng.pick([true, false]);
  const givenVal = targetIsC ? B : C;
  const targetVal = targetIsC ? C : B;
  const targetVertex = targetIsC ? "C" : "B";
  const givenVertex = targetIsC ? "B" : "C";

  const chain: ChainStep[] = [
    {
      theorem: "Inscribed Angle Theorem",
      text: `OB and OC are radii, so angle BOC is the central angle on arc BC. The inscribed angle at A stands on the same arc, so it is half the central angle: angle A = ${central} ÷ 2 = ${A}°.`,
      resultValue: A
    },
    {
      theorem: "Triangle Angle Sum",
      text: `The three angles of triangle ABC add to 180°, so angle ${targetVertex} = 180 − ${A} − ${givenVal} = ${targetVal}°.`,
      resultValue: targetVal
    }
  ];

  const segments: Seg[] = [
    { a: Ap, b: Bp },
    { a: Bp, b: Cp },
    { a: Cp, b: Ap },
    { a: O, b: Bp },
    { a: O, b: Cp }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(O, Bp, Cp, central, `${central}°`, false, true, 24),
    angleMarkFromVertex(
      Bp,
      Ap,
      Cp,
      B,
      givenVertex === "B" ? `${B}°` : targetVertex === "B" ? "?" : "",
      targetVertex === "B",
      givenVertex === "B",
      26
    ),
    angleMarkFromVertex(
      Cp,
      Ap,
      Bp,
      C,
      givenVertex === "C" ? `${C}°` : targetVertex === "C" ? "?" : "",
      targetVertex === "C",
      givenVertex === "C",
      26
    )
  ];

  const pointLabels: PointLabel[] = [
    circleLabel(O, Ap, 16, "A"),
    circleLabel(O, Bp, 16, "B"),
    circleLabel(O, Cp, 16, "C"),
    labelAwayFromEdges(O, [Bp, Cp], 15, "O")
  ];

  const selfCheck =
    A + B + C === 180 &&
    central === 2 * A &&
    angleMatches(Ap, Bp, Cp, A) &&
    angleMatches(O, Bp, Cp, central) &&
    angleMatches(Bp, Ap, Cp, B) &&
    angleMatches(Cp, Ap, Bp, C) &&
    pointLabels.every((l) => inBounds(l, CIRCLE_W, CIRCLE_H));

  return {
    promptText:
      'Triangle ABC is inscribed in the circle with centre O; the two radii OB and OC are drawn. Find the angle marked "?".',
    diagram: {
      width: CIRCLE_W,
      height: CIRCLE_H,
      segments,
      angleMarks,
      pointLabels,
      circles: [{ cx: O.x, cy: O.y, r: R }]
    },
    answer: targetVal,
    targetLabel: `angle ${targetVertex}`,
    chain,
    skillTags: [
      "geometry",
      "angles",
      "circle_theorems",
      "inscribed_angle",
      "triangle_angle_sum",
      "angle_chasing"
    ],
    variant: "triangle-in-circle",
    selfCheck
  };
}

// ===== Template 17 (tier 10): tangent-chord (alternate segment) composite =====

// A tangent touches the circle at A; triangle ABC is inscribed. The angle
// between the tangent and chord AB equals the inscribed angle in the alternate
// segment (angle ACB) — the alternate segment theorem. Combined with the given
// angle at B and the triangle angle sum, the player reaches angle A. A genuine
// tangent-line + inscribed-triangle interaction.
function genTangentAlternate(rng: Rng): GenResult {
  const O = CIRCLE_O;
  const R = CIRCLE_R;

  let A = 60;
  let B = 60;
  let C = 60;
  let phi = 0;
  let Ap: Pt = circlePt(O, 0, R);
  let Bp: Pt = circlePt(O, 120, R);
  let Cp: Pt = circlePt(O, 240, R);
  let T1: Pt = { x: 0, y: 0 };
  let T2: Pt = { x: 0, y: 0 };
  let tanEnd: Pt = { x: 0, y: 0 };
  let ok = false;

  for (let tries = 0; tries < 160; tries++) {
    B = rng.int(35, 85);
    C = rng.int(35, 85);
    A = 180 - B - C;
    if (A < 35 || A > 110) continue;
    phi = rng.int(0, 359);
    Ap = circlePt(O, phi, R);
    Bp = circlePt(O, phi + 2 * C, R);
    Cp = circlePt(O, phi + 2 * C + 2 * A, R);
    // Tangent at A is perpendicular to radius OA (direction phi): dirs phi±90.
    const tanLen = 78;
    T1 = dirPoint(Ap, phi + 90, tanLen);
    T2 = dirPoint(Ap, phi - 90, tanLen);
    // The tangent ray whose angle to chord AB equals C is the alternate-segment
    // side; pick it by direct measurement.
    tanEnd = Math.abs(angleAt(Ap, T1, Bp) - C) < Math.abs(angleAt(Ap, T2, Bp) - C) ? T1 : T2;
    if (
      inBounds(Ap, CIRCLE_W, CIRCLE_H, 20) &&
      inBounds(Bp, CIRCLE_W, CIRCLE_H, 20) &&
      inBounds(Cp, CIRCLE_W, CIRCLE_H, 20) &&
      inBounds(T1, CIRCLE_W, CIRCLE_H, 8) &&
      inBounds(T2, CIRCLE_W, CIRCLE_H, 8) &&
      angleMatches(Ap, Bp, Cp, A) &&
      angleMatches(Bp, Ap, Cp, B) &&
      angleMatches(Cp, Ap, Bp, C) &&
      angleMatches(Ap, tanEnd, Bp, C)
    ) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    B = 60;
    C = 60;
    A = 60;
    phi = 0;
    Ap = circlePt(O, phi, R);
    Bp = circlePt(O, phi + 2 * C, R);
    Cp = circlePt(O, phi + 2 * C + 2 * A, R);
    T1 = dirPoint(Ap, phi + 90, 78);
    T2 = dirPoint(Ap, phi - 90, 78);
    tanEnd = Math.abs(angleAt(Ap, T1, Bp) - C) < Math.abs(angleAt(Ap, T2, Bp) - C) ? T1 : T2;
  }

  const chain: ChainStep[] = [
    {
      theorem: "Alternate Segment Theorem",
      text: `The angle between the tangent at A and the chord AB equals the inscribed angle in the alternate segment. So angle ACB = ${C}°.`,
      resultValue: C
    },
    {
      theorem: "Triangle Angle Sum",
      text: `The three angles of triangle ABC add to 180°, so angle BAC = 180 − ${B} − ${C} = ${A}°.`,
      resultValue: A
    }
  ];

  const segments: Seg[] = [
    { a: T1, b: T2 },
    { a: Ap, b: Bp },
    { a: Bp, b: Cp },
    { a: Cp, b: Ap }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(Ap, tanEnd, Bp, C, `${C}°`, false, true, 22),
    angleMarkFromVertex(Bp, Ap, Cp, B, `${B}°`, false, true, 26),
    angleMarkFromVertex(Ap, Bp, Cp, A, "?", true, false, 34)
  ];

  const pointLabels: PointLabel[] = [
    circleLabel(O, Ap, 16, "A"),
    circleLabel(O, Bp, 16, "B"),
    circleLabel(O, Cp, 16, "C")
  ];

  const selfCheck =
    A + B + C === 180 &&
    angleMatches(Ap, Bp, Cp, A) &&
    angleMatches(Bp, Ap, Cp, B) &&
    angleMatches(Cp, Ap, Bp, C) &&
    angleMatches(Ap, tanEnd, Bp, C) &&
    inBounds(T1, CIRCLE_W, CIRCLE_H) &&
    inBounds(T2, CIRCLE_W, CIRCLE_H) &&
    pointLabels.every((l) => inBounds(l, CIRCLE_W, CIRCLE_H));

  return {
    promptText:
      'The straight line through A is a tangent to the circle at A, and triangle ABC is inscribed. The tangent–chord angle at A and the angle at B are given. Find the angle marked "?" (angle BAC).',
    diagram: {
      width: CIRCLE_W,
      height: CIRCLE_H,
      segments,
      angleMarks,
      pointLabels,
      circles: [{ cx: O.x, cy: O.y, r: R }]
    },
    answer: A,
    targetLabel: "angle BAC",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "circle_theorems",
      "tangent",
      "alternate_segment",
      "triangle_angle_sum",
      "angle_chasing"
    ],
    variant: "tangent-chord",
    selfCheck
  };
}

// ===== Template 18 (tier 10): triangle sharing a side with a square =====

// A square ABCD sits with its top side AB shared by a triangle ABE built above
// it. Given the triangle's apex angle at E and its base angle at B, the player
// finds the base angle at A (triangle sum), notes the square's right angle at
// A, and adds them to reach angle DAE. A real two-shape composite: no circle,
// but a genuine interaction between a square's 90° corner and a triangle.
function genTriangleSquare(rng: Rng): GenResult {
  const W = 440;
  const H = 340;
  const side = 116;
  const cx = 220;
  const topY = 176;

  let p = 55; // base angle at A
  let q = 55; // base angle at B
  let apex = 70;
  let A: Pt = { x: cx - side / 2, y: topY };
  let B: Pt = { x: cx + side / 2, y: topY };
  let D: Pt = { x: cx - side / 2, y: topY + side };
  let C: Pt = { x: cx + side / 2, y: topY + side };
  let E: Pt = { x: cx, y: 60 };
  let ok = false;

  for (let tries = 0; tries < 100; tries++) {
    p = rng.int(40, 72);
    q = rng.int(40, 72);
    apex = 180 - p - q;
    if (apex < 40 || apex > 92) continue;
    E = triangleApex(p, q, A, B); // apex above AB, angle p at A, angle q at B
    // Require a tall-enough triangle so the apex angle's arc label at E stays
    // well clear of the base-angle arc labels at A and B.
    if (topY - E.y < 84) continue;
    if (
      finitePt(E) &&
      inBounds(E, W, H, 22) &&
      angleMatches(A, B, E, p) &&
      angleMatches(B, A, E, q) &&
      angleMatches(A, D, B, 90) &&
      angleMatches(A, D, E, 90 + p)
    ) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    p = 58;
    q = 58;
    apex = 64;
    E = triangleApex(p, q, A, B);
  }

  const target = 90 + p;

  const chain: ChainStep[] = [
    {
      theorem: "Triangle Angle Sum",
      text: `In triangle ABE the angles add to 180°, so the base angle at A = 180 − ${apex} − ${q} = ${p}°.`,
      resultValue: p
    },
    {
      theorem: "Square (right angle)",
      text: `ABCD is a square, so its corner angle DAB = 90°.`,
      resultValue: 90
    },
    {
      theorem: "Adjacent Angles",
      text: `The marked angle DAE is made of the square's corner DAB and the triangle's base angle BAE side by side: angle DAE = 90 + ${p} = ${target}°.`,
      resultValue: target
    }
  ];

  const segments: Seg[] = [
    { a: A, b: B },
    { a: B, b: C },
    { a: C, b: D },
    { a: D, b: A },
    { a: A, b: E },
    { a: B, b: E }
  ];

  const angleMarks: AngleMark[] = [
    angleMarkFromVertex(E, A, B, apex, `${apex}°`, false, true, 24),
    angleMarkFromVertex(B, A, E, q, `${q}°`, false, true, 22),
    angleMarkFromVertex(A, D, E, target, "?", true, false, 30)
  ];

  const pointLabels: PointLabel[] = [
    labelAwayFromEdges(A, [B, D, E], 16, "A"),
    labelAwayFromEdges(B, [A, C, E], 16, "B"),
    labelAwayFromEdges(C, [B, D], 15, "C"),
    labelAwayFromEdges(D, [A, C], 15, "D"),
    labelAwayFromEdges(E, [A, B], 15, "E")
  ];

  const selfCheck =
    p + q + apex === 180 &&
    target === 90 + p &&
    angleMatches(A, B, E, p) &&
    angleMatches(B, A, E, q) &&
    angleMatches(A, D, B, 90) &&
    angleMatches(A, D, E, target) &&
    pointLabels.every((l) => inBounds(l, W, H)) &&
    segments.every((s) => finitePt(s.a) && finitePt(s.b));

  return {
    promptText:
      'Square ABCD has an isosceles-looking triangle ABE built on its top side AB. The triangle\'s apex angle at E and base angle at B are given. Find the angle marked "?" (angle DAE).',
    diagram: {
      width: W,
      height: H,
      segments,
      angleMarks,
      pointLabels
    },
    answer: target,
    targetLabel: "angle DAE",
    chain,
    skillTags: [
      "geometry",
      "angles",
      "square",
      "triangle_angle_sum",
      "angle_chasing"
    ],
    variant: "triangle-square",
    selfCheck
  };
}

// ===== Difficulty dispatch =====

function generatePuzzleData(rng: Rng, difficulty: number): GenResult {
  const d = Math.max(1, Math.min(10, Math.round(difficulty)));
  const branch = rng.int(0, 1);
  switch (d) {
    case 1:
      return branch === 0 ? genCross(rng) : genLine(rng, 2);
    case 2:
      return branch === 0 ? genLine(rng, 3) : genPoint(rng, 3);
    case 3:
      return branch === 0 ? genTriangleBasic(rng) : genPoint(rng, 4);
    case 4:
      return branch === 0 ? genTriangleAlgebraic(rng) : genParallel(rng, 1);
    case 5:
      return branch === 0 ? genParallel(rng, 2) : genTriangleExterior(rng);
    case 6:
      return branch === 0 ? genParallel(rng, 3) : genPolygon(rng);
    case 7:
      return branch === 0 ? genIsoscelesExterior(rng) : genTriangleOnParallel(rng);
    case 8:
      return branch === 0 ? genCevianTwoTriangles(rng) : genIsoscelesAlgebraic(rng);
    case 9: {
      // Circle geometry, direct single-theorem: inscribed-angle / central,
      // angle in a semicircle (Thales), cyclic-quadrilateral opposite angles.
      const fam = rng.int(0, 2);
      return fam === 0
        ? genInscribedCentral(rng)
        : fam === 1
        ? genThalesSemicircle(rng)
        : genCyclicQuad(rng);
    }
    default: {
      // Tier 10: multi-step / composite circle & multi-shape figures.
      const fam = rng.int(0, 2);
      return fam === 0
        ? genTriangleInCircle(rng)
        : fam === 1
        ? genTangentAlternate(rng)
        : genTriangleSquare(rng);
    }
  }
}

// ===== Plugin =====

export const angleChaseStudioPlugin: GameTypePlugin = {
  id: "angle-chase-studio",
  name: "Angle Chase Studio",
  minGrade: 5,
  maxGrade: 10,
  description:
    "Chase down an unknown angle using vertical angles, angles on a line, triangle and polygon angle sums, and parallel-line angle theorems. At the hardest tiers, composite figures (isosceles triangles with exterior angles, angle bisectors splitting two shared-cevian triangles, and triangles sitting on parallel lines) and a full circle-geometry strand (inscribed-angle theorem, angle in a semicircle, cyclic quadrilaterals, tangent–chord/alternate-segment, and multi-shape composites) push toward olympiad-style angle chasing. Enter the degree measure of the marked angle.",

  generate(input) {
    const rng = new Rng(input.seed);
    const result = generatePuzzleData(rng, input.difficulty);

    return {
      gameTypeId: "angle-chase-studio",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: { text: result.promptText },
      data: {
        variant: result.variant,
        diagram: result.diagram,
        answer: result.answer,
        targetLabel: result.targetLabel,
        chain: result.chain,
        selfCheck: result.selfCheck
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: result.skillTags
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const answer = Number(candidate.data.answer);
    if (!Number.isFinite(answer)) return [];
    return [String(answer)];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues: ValidationIssue[] = [];
    const answer = Number(candidate.data.answer);
    const diagram = candidate.data.diagram as Diagram | undefined;
    const chain = candidate.data.chain as ChainStep[] | undefined;

    if (!Number.isInteger(answer) || answer <= 0 || answer >= 360) {
      issues.push({
        code: "bad_answer",
        message: `Answer ${answer} is out of valid angle range.`
      });
    }

    if (!diagram || !Array.isArray(diagram.segments) || diagram.segments.length === 0) {
      issues.push({ code: "no_diagram_segments", message: "Diagram segments missing." });
    } else {
      for (const seg of diagram.segments) {
        if (!finitePt(seg.a) || !finitePt(seg.b)) {
          issues.push({ code: "bad_segment", message: "Diagram segment has non-finite point." });
          break;
        }
      }
    }

    if (!diagram || !Array.isArray(diagram.angleMarks) || diagram.angleMarks.length === 0) {
      issues.push({ code: "no_angle_marks", message: "Diagram angle marks missing." });
    } else {
      const hasTarget = diagram.angleMarks.some((m) => m.isTarget);
      const hasGiven = diagram.angleMarks.some((m) => m.isGiven);
      if (!hasTarget) issues.push({ code: "no_target_mark", message: "No target angle mark found." });
      if (!hasGiven) issues.push({ code: "no_given_mark", message: "No given angle mark found." });
      for (const m of diagram.angleMarks) {
        if (
          !Number.isFinite(m.value) ||
          !finitePt(m.vertex) ||
          !Number.isFinite(m.dir1) ||
          !Number.isFinite(m.radius) ||
          m.radius <= 0
        ) {
          issues.push({ code: "bad_angle_mark", message: "Angle mark has non-finite fields." });
          break;
        }
      }
    }

    if (!Array.isArray(chain) || chain.length === 0) {
      issues.push({ code: "no_chain", message: "Hint deduction chain missing." });
    }

    if (candidate.data.selfCheck !== true) {
      issues.push({ code: "self_check_failed", message: "Generator self-check failed." });
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const expected = Number(candidate.data.answer);
    if (!Number.isFinite(expected)) return false;
    let cleaned = String(answer ?? "").trim().toLowerCase();
    cleaned = cleaned
      .replace(/degrees?$/, "")
      .replace(/deg$/, "")
      .replace(/°/g, "")
      .trim();
    if (cleaned === "") return false;
    const val = Number(cleaned);
    if (!Number.isFinite(val)) return false;
    return Math.abs(val - expected) < 0.5;
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const chain = (candidate.data.chain as ChainStep[]) || [];
    const answer = Number(candidate.data.answer);
    return buildHintsFromChain(chain, answer);
  }
};
