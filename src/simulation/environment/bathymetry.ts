import {
  hullRelation,
  worldHull,
  polygonsOverlap,
  type Point2,
} from "../geometry/hulls";
import type { Ship } from "../../types";
export interface DepthZone {
  id: string;
  name: string;
  depth: number;
  polygon: Point2[];
  label: Point2;
}
const rect = (x1: number, y1: number, x2: number, y2: number): Point2[] => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];
export const DEEP_WATER = 5.5;
export const DEPTH_ZONES: DepthZone[] = [
  {
    id: "north-shelf",
    name: "Bãi nông bờ Bắc",
    depth: 1.2,
    polygon: rect(-68, -11.8, 68, -5.6),
    label: { x: -46, y: -8 },
  },
  {
    id: "south-shelf",
    name: "Bãi nông bờ Nam",
    depth: 1.2,
    polygon: rect(-68, 5.6, 68, 11.8),
    label: { x: 46, y: 8 },
  },
  {
    id: "shoal-west",
    name: "Bãi bồi phía A",
    depth: 2,
    polygon: [
      { x: -30, y: -6.8 },
      { x: -24, y: -7.2 },
      { x: -13, y: -6.5 },
      { x: -12, y: -4.8 },
      { x: -20, y: -3.8 },
      { x: -28, y: -4.2 },
    ],
    label: { x: -22, y: -5.1 },
  },
  {
    id: "shoal-east-outer",
    name: "Rìa bãi bồi",
    depth: 2.3,
    polygon: [
      { x: 4, y: 4.2 },
      { x: 7, y: 2.8 },
      { x: 18, y: 2.6 },
      { x: 24, y: 4.1 },
      { x: 22, y: 6.7 },
      { x: 9, y: 7.2 },
    ],
    label: { x: 7, y: 4.3 },
  },
  {
    id: "shoal-east",
    name: "Bãi bồi phía B",
    depth: 1.6,
    polygon: [
      { x: 9, y: 4.6 },
      { x: 12, y: 3.7 },
      { x: 18, y: 3.6 },
      { x: 20, y: 4.9 },
      { x: 18, y: 6.3 },
      { x: 12, y: 6.6 },
    ],
    label: { x: 15, y: 5.1 },
  },
];
export const DEFAULT_DRAFTS = { fishing: 0.7, cargo: 1.8, transport: 2.4 };
export interface GroundingAssessment {
  shipId: string;
  depth: number;
  draft: number;
  clearance: number;
  status: "clear" | "risk" | "grounded";
  point: Point2;
  zoneId: string;
}
export function depthAt(point: Point2, level: number) {
  let depth = DEEP_WATER;
  for (const z of DEPTH_ZONES) {
    const tiny = rect(
      point.x - 1e-5,
      point.y - 1e-5,
      point.x + 1e-5,
      point.y + 1e-5,
    );
    if (polygonsOverlap(tiny, z.polygon)) depth = Math.min(depth, z.depth);
  }
  return Math.max(0, depth + level);
}
export function assessGrounding(
  ship: Ship,
  level: number,
): GroundingAssessment {
  const hull = worldHull(ship);
  let depth = DEEP_WATER,
    point = { x: ship.x, y: ship.y },
    zoneId = "deep";
  for (const z of DEPTH_ZONES) {
    if (z.depth >= depth) continue;
    if (!polygonsOverlap(hull, z.polygon)) continue;
    const relation = hullRelation(hull, z.polygon);
    if (relation.colliding) {
      depth = z.depth;
      point = relation.contact;
      zoneId = z.id;
    }
  }
  depth = Math.max(0, depth + level);
  const draft = ship.draft ?? DEFAULT_DRAFTS[ship.type],
    clearance = depth - draft;
  return {
    shipId: ship.id,
    depth,
    draft,
    clearance,
    status:
      clearance <= 1e-8 ? "grounded" : clearance <= 0.6 ? "risk" : "clear",
    point,
    zoneId,
  };
}
