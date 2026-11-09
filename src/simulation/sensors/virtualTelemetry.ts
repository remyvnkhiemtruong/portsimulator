import type { Point2 } from "../geometry/hulls";
import { worldHull } from "../geometry/hulls";
import type { Ship, Sensor, SensorEvent } from "../../types";
import { depthAt } from "../environment/bathymetry";
export interface RangeReading {
  id: "US_A" | "US_B";
  origin: Point2;
  direction: Point2;
  maxRange: number;
  value: number | null;
  hit: Point2 | null;
}
export const RANGE_STATIONS = [
  {
    id: "US_A" as const,
    origin: { x: -30, y: -11 },
    direction: { x: 0, y: 1 },
    maxRange: 22,
  },
  {
    id: "US_B" as const,
    origin: { x: 30, y: 11 },
    direction: { x: 0, y: -1 },
    maxRange: 22,
  },
];
function cross(a: Point2, b: Point2) {
  return a.x * b.y - a.y * b.x;
}
export function rangeReadings(ships: Ship[]): RangeReading[] {
  return RANGE_STATIONS.map((s) => {
    let value: number | null = null,
      hit: Point2 | null = null;
    for (const ship of ships) {
      if (ship.status === "completed") continue;
      const p = worldHull(ship);
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length],
          edge = { x: b.x - a.x, y: b.y - a.y },
          v = { x: a.x - s.origin.x, y: a.y - s.origin.y },
          den = cross(s.direction, edge);
        if (Math.abs(den) < 1e-10) continue;
        const t = cross(v, edge) / den,
          u = cross(v, s.direction) / den;
        if (
          t >= 0 &&
          t <= s.maxRange &&
          u >= 0 &&
          u <= 1 &&
          (value === null || t < value)
        ) {
          value = t;
          hit = {
            x: s.origin.x + s.direction.x * t,
            y: s.origin.y + s.direction.y * t,
          };
        }
      }
    }
    return { ...s, value, hit };
  });
}
export function sensorPacket(
  time: number,
  sensors: Sensor[],
  ranges: RangeReading[],
  level: number,
  events: SensorEvent[] = [],
  bootId = "virtual",
) {
  return {
    schemaVersion: 1,
    source: "simulation" as const,
    deviceId: "esp32-virtual-01",
    bootId,
    timestamp: time,
    units: { time: "sim_s", distance: "sim_unit" },
    events: events
      .slice(-16)
      .map((e) => ({
        sequence: Number(e.id.slice(4)),
        timestamp: e.timestamp,
        sensorId: e.sensorId,
        value: e.value,
      })),
    sensors: {
      gates: Object.fromEntries(sensors.map((s) => [s.id, s.state ? 1 : 0])),
      range: Object.fromEntries(
        ranges.map((s) => [
          s.id,
          { value: s.value, valid: s.value !== null, maxRange: s.maxRange },
        ]),
      ),
      waterLevel: level,
      depthProbes: {
        D_A: depthAt({ x: -22, y: -5.1 }, level),
        D_B: depthAt({ x: 15, y: 5.1 }, level),
      },
    },
  };
}
