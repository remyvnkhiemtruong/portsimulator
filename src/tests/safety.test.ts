import { describe, it, expect } from "vitest";
import { SimulationEngine } from "../simulation/engine/SimulationEngine";
import {
  localHull,
  worldHull,
  hullRelation,
} from "../simulation/geometry/hulls";
import { assessGrounding, depthAt } from "../simulation/environment/bathymetry";
import { rangeReadings } from "../simulation/sensors/virtualTelemetry";
function pair() {
  const e = new SimulationEngine("free");
  const a = e.spawn("AB", "cargo"),
    b = e.spawn("BA", "cargo");
  return { e, a, b };
}
describe("Convex hull collisions", () => {
  it("detects edge contact, overlap and separation symmetrically", () => {
    const { e, a, b } = pair();
    e.moveShip(a.id, 0, 0);
    e.moveShip(b.id, 9, 0);
    expect(e.collisionNow).toBe(true);
    expect(e.contacts[0].point.x).toBeCloseTo(4.5);
    expect(hullRelation(worldHull(b), worldHull(a)).colliding).toBe(true);
    e.moveShip(b.id, 9.01, 0);
    expect(e.collisionNow).toBe(false);
    expect(e.closestPair!.distance).toBeCloseTo(0.01);
  });
  it("does not mistake bow bounding-box overlap for actual hull contact", () => {
    const a = { x: 0, y: 0, direction: "AB" as const, length: 9, width: 3 },
      b = { x: 5.6, y: 2.4, direction: "AB" as const, length: 5, width: 2 };
    expect(hullRelation(worldHull(a), worldHull(b)).colliding).toBe(false);
    expect(localHull(9, 3)).toHaveLength(5);
  });
  it("distinguishes opposite-direction channel occupancy from a collision", () => {
    const { e, a, b } = pair();
    e.moveShip(a.id, 0, -1.7);
    e.moveShip(b.id, 0, 1.7);
    expect(e.conflictNow).toBe(true);
    expect(e.collisionNow).toBe(false);
    expect(e.closestPair!.distance).toBeGreaterThan(0);
  });
  it("counts each contact episode once, auto-pauses, clears on separation and removal", () => {
    const { e, a, b } = pair();
    e.moveShip(a.id, 0, 0);
    e.start();
    e.moveShip(b.id, 3, 0);
    expect(e.running).toBe(false);
    expect(e.collisionCount).toBe(1);
    e.refreshManualState();
    e.refreshManualState();
    expect(e.collisionCount).toBe(1);
    e.moveShip(b.id, 20, 0);
    expect(e.collisionHistory[0].endedAt).not.toBe(null);
    e.moveShip(b.id, 2, 0);
    expect(e.collisionCount).toBe(2);
    e.remove(b.id);
    expect(e.contacts).toEqual([]);
  });
  it("records contact crossed in a large pointer jump", () => {
    const { e, a, b } = pair();
    e.moveShip(a.id, 0, 0);
    e.moveShip(b.id, 15, 0);
    const before = e.collisionCount;
    e.moveShip(b.id, -15, 0);
    expect(e.collisionCount).toBe(before + 1);
    expect(e.collisionNow).toBe(false);
  });
  it("detects same-direction contact and all three pairs in a three-ship overlap", () => {
    const { e, a, b } = pair();
    const c = e.spawn("AB", "fishing");
    b.direction = "AB";
    for (const s of [a, b, c]) e.moveShip(s.id, 0, 0);
    expect(e.contacts).toHaveLength(3);
    expect(new Set(e.contacts.map((c) => c.key)).size).toBe(3);
  });
  it("keeps running when automatic collision pause is disabled", () => {
    const { e, a, b } = pair();
    e.pauseOnCollision = false;
    e.moveShip(a.id, 0, 0);
    e.start();
    e.moveShip(b.id, 0, 0);
    expect(e.running).toBe(true);
  });
});
describe("Bathymetry and grounding", () => {
  it("keeps deep-water hulls clear and detects even a hull corner on the shallow shelf", () => {
    const e = new SimulationEngine("free"),
      s = e.spawn("AB");
    e.moveShip(s.id, -42, 0);
    expect(assessGrounding(s, 0).status).toBe("clear");
    e.moveShip(s.id, -42, 4.2);
    expect(depthAt({ x: s.x, y: s.y }, 0)).toBe(5.5);
    expect(assessGrounding(s, 0)).toMatchObject({
      status: "grounded",
      depth: 1.2,
      draft: 1.8,
    });
  });
  it("separates grounding risk from confirmed bottom contact when level changes", () => {
    const e = new SimulationEngine("free"),
      s = e.spawn("AB");
    e.moveShip(s.id, -42, 7);
    expect(e.groundingNow).toBe(true);
    e.setWaterLevel(1);
    expect(e.groundingAssessments[0].status).toBe("risk");
    e.setWaterLevel(1.5);
    expect(e.groundingAssessments[0].status).toBe("clear");
  });
  it("uses ship-specific draft, not vessel center position alone", () => {
    const e = new SimulationEngine("free"),
      s = e.spawn("AB", "fishing");
    e.moveShip(s.id, -42, 7);
    expect(e.groundingAssessments[0].status).toBe("risk");
    s.draft = 1.3;
    e.refreshManualState();
    expect(e.groundingNow).toBe(true);
    expect(e.groundingAssessments[0].clearance).toBeCloseTo(-0.1);
  });
  it("pauses only on a new grounding and allows sensor water-level adjustment while paused", () => {
    const e = new SimulationEngine("free"),
      s = e.spawn("AB");
    e.start();
    e.moveShip(s.id, -42, 7);
    expect(e.running).toBe(false);
    expect(e.groundingCount).toBe(1);
    e.refreshManualState();
    expect(e.groundingCount).toBe(1);
    const before = e.getSensorPacket();
    e.setWaterLevel(1);
    expect(
      e.getSensorPacket().sensors.depthProbes.D_B -
        before.sensors.depthProbes.D_B,
    ).toBeCloseTo(1);
    expect(e.time).toBe(0);
  });
});
describe("Virtual ESP32 sensor signals", () => {
  it("raycasts the first hull echo and returns no echo outside the beam", () => {
    const e = new SimulationEngine("free"),
      s = e.spawn("AB");
    e.moveShip(s.id, -30, 0);
    let readings = rangeReadings(e.ships);
    expect(readings[0].value).toBeCloseTo(9.62);
    e.moveShip(s.id, -30, 2);
    expect(rangeReadings(e.ships)[0].value).toBeCloseTo(11.62);
    e.moveShip(s.id, 0, 2);
    expect(rangeReadings(e.ships)[0].value).toBeNull();
  });
  it("publishes simulator-labelled gates, ranges and depth probes without leaking ship positions as sensor values", () => {
    const { e, a, b } = pair();
    e.moveShip(a.id, 0, 0);
    e.moveShip(b.id, 0, 0);
    const p = e.getSensorPacket();
    expect(e.collisionNow).toBe(true);
    expect(p.source).toBe("simulation");
    expect(Object.values(p.sensors.gates)).toEqual([0, 0, 0, 0]);
    expect(p.sensors.range.US_A.valid).toBe(false);
    expect(p.sensors.depthProbes.D_A).toBe(2);
    expect(p.sensors.depthProbes.D_B).toBe(1.6);
    expect(JSON.stringify(p)).not.toContain("PT-001");
  });
});
