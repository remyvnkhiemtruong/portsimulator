import type { Point2 } from "./hulls";
export interface CollisionContact {
  key: string;
  shipIds: [string, string];
  point: Point2;
  startedAt: number;
}
export interface CollisionEpisode extends CollisionContact {
  id: number;
  endedAt: number | null;
}
export interface ClosestPair {
  shipIds: [string, string];
  distance: number;
  pointA: Point2;
  pointB: Point2;
}
