import type { Ship } from "../../types";
export interface Point2 {
  x: number;
  y: number;
}
export interface HullRelation {
  colliding: boolean;
  distance: number;
  pointA: Point2;
  pointB: Point2;
  contact: Point2;
}
const EPS = 1e-8;
// One nominal footprint for drawing AND detection. No bounding-box false positives
// in the tapered bow. Direction BA rotates the footprint by 180 degrees.
export function localHull(length: number, width: number): Point2[] {
  const l = length / 2,
    w = width / 2,
    bow = Math.min(1.5, length * 0.3);
  return [
    { x: -l, y: -w * 0.8 },
    { x: l - bow, y: -w },
    { x: l, y: 0 },
    { x: l - bow, y: w },
    { x: -l, y: w * 0.8 },
  ];
}
export function worldHull(
  s: Pick<Ship, "x" | "y" | "direction" | "length" | "width">,
): Point2[] {
  const sign = s.direction === "AB" ? 1 : -1;
  return localHull(s.length, s.width).map((p) => ({
    x: s.x + p.x * sign,
    y: s.y + p.y * sign,
  }));
}
function signedDistance(p: Point2, a: Point2, b: Point2) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
function clippedPolygon(subject: Point2[], clip: Point2[]) {
  let output = subject;
  for (let i = 0; i < clip.length && output.length; i++) {
    const a = clip[i],
      b = clip[(i + 1) % clip.length],
      input = output;
    output = [];
    let prev = input[input.length - 1],
      prevD = signedDistance(prev, a, b);
    for (const cur of input) {
      const d = signedDistance(cur, a, b);
      if (d >= -EPS !== prevD >= -EPS) {
        const t = prevD / (prevD - d);
        output.push({
          x: prev.x + (cur.x - prev.x) * t,
          y: prev.y + (cur.y - prev.y) * t,
        });
      }
      if (d >= -EPS) output.push(cur);
      prev = cur;
      prevD = d;
    }
  }
  return output;
}
export function polygonsOverlap(a: Point2[], b: Point2[]) {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length],
        nx = -(q.y - p.y),
        ny = q.x - p.x;
      const pa = a.map((v) => v.x * nx + v.y * ny),
        pb = b.map((v) => v.x * nx + v.y * ny);
      if (
        Math.max(...pa) < Math.min(...pb) - EPS ||
        Math.max(...pb) < Math.min(...pa) - EPS
      )
        return false;
    }
  return true;
}
function projection(p: Point2, a: Point2, b: Point2): Point2 {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return { x: a.x + dx * t, y: a.y + dy * t };
}
export function hullRelation(a: Point2[], b: Point2[]): HullRelation {
  if (polygonsOverlap(a, b)) {
    const region = clippedPolygon(a, b);
    const p = region.length
      ? {
          x: region.reduce((n, p) => n + p.x, 0) / region.length,
          y: region.reduce((n, p) => n + p.y, 0) / region.length,
        }
      : a[0];
    return { colliding: true, distance: 0, pointA: p, pointB: p, contact: p };
  }
  let distance = Infinity,
    pointA = a[0],
    pointB = b[0];
  for (let pass = 0; pass < 2; pass++) {
    const from = pass ? b : a,
      to = pass ? a : b;
    for (const p of from)
      for (let i = 0; i < to.length; i++) {
        const q = projection(p, to[i], to[(i + 1) % to.length]),
          d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < distance) {
          distance = d;
          pointA = pass ? q : p;
          pointB = pass ? p : q;
        }
      }
  }
  return {
    colliding: false,
    distance,
    pointA,
    pointB,
    contact: { x: (pointA.x + pointB.x) / 2, y: (pointA.y + pointB.y) / 2 },
  };
}
