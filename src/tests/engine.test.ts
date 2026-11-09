import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  SimulationEngine,
} from "../simulation/engine/SimulationEngine";
import { SensorEngine } from "../simulation/sensors/SensorEngine";
import { scenarios } from "../simulation/scenarios";
import type { Ship } from "../types";
function run(id: string, seed = 2026) {
  const engine = new SimulationEngine(id, {
    ...structuredClone(DEFAULT_CONFIG),
    seed,
  });
  engine.advance(engine.scenario.duration);
  return engine;
}
describe("Fixed-step engine and sensors", () => {
  it("activates from hull overlap and emits rising/falling only at edges", () => {
    const sensors = new SensorEngine(1, 12, DEFAULT_CONFIG.noise);
    const ship: Ship = {
      id: "hidden",
      type: "cargo",
      direction: "AB",
      x: -42,
      y: 0,
      speed: 4,
      length: 6,
      width: 2,
      spawnTime: 0,
      status: "moving",
      reversed: false,
    };
    expect(sensors.update(1, 0.02, [ship])).toEqual([
      { id: "raw-1", timestamp: 1, sensorId: "A1", value: true },
    ]);
    expect(sensors.update(1.02, 0.02, [ship])).toEqual([]);
    ship.x = -35;
    expect(sensors.update(2, 0.02, [ship])).toEqual([
      { id: "raw-2", timestamp: 2, sensorId: "A1", value: false },
    ]);
  });
  it("moves continuously and supports pause through external driver", () => {
    const e = new SimulationEngine();
    e.step();
    const x = e.ships[0].x;
    e.step();
    expect(e.ships[0].x - x).toBeCloseTo(0.08);
    e.pause();
    expect(e.running).toBe(false);
  });
  it.each(["normal-ab", "normal-ba"])(
    "%s recognizes a complete clean passage and empties occupancy",
    (id) => {
      const e = run(id),
        b = e.algorithms.B.snapshot();
      expect(b.state).toBe("FREE");
      expect(b.occupancy).toBe(0);
      expect(b.completedAB + b.completedBA).toBe(1);
      expect(e.truthConflict).toBe(false);
      expect(e.warnings.B).toBe(false);
      expect(e.result().directionCorrectB).toBe(1);
    },
  );
  it("tracks two separable same-direction passages", () => {
    const e = run("convoy");
    expect(e.algorithms.B.snapshot()).toMatchObject({
      completedAB: 2,
      occupancy: 0,
      state: "FREE",
    });
    expect(e.warnings.B).toBe(false);
  });
  it.each(["conflict", "simultaneous"])(
    "%s warns on opposing arrivals",
    (id) => {
      const e = run(id);
      expect(e.truthConflict).toBe(true);
      expect(e.warnings.A).toBe(true);
      expect(e.warnings.B).toBe(true);
      expect(e.result().directionCorrectB).toBe(2);
      expect(e.algorithms.B.snapshot().occupancy).toBe(0);
    },
  );
  it("does not falsely release a stopped vessel", () => {
    const e = run("stopped");
    expect(e.algorithms.B.snapshot()).toMatchObject({
      state: "FAULT",
      occupancy: 1,
      completedAB: 0,
    });
  });
  it.each(["missing", "reverse", "stuck", "on-sensor"])(
    "%s ends conservatively",
    (id) => {
      const e = run(id);
      expect(["FAULT", "UNCERTAIN"]).toContain(e.algorithms.B.snapshot().state);
      expect(e.algorithms.B.snapshot().state).not.toBe("FREE");
    },
  );
  it("reveals undercount when two hulls create merged binary signals", () => {
    const e = run("close");
    expect(e.truthAB).toBe(2);
    expect(e.algorithms.B.snapshot().completedAB).toBe(1);
    expect(e.result().directionCorrectB).toBe(1);
  });
  it("replays identical noise from the same seed", () => {
    const a = run("noise", 17),
      b = run("noise", 17);
    expect(a.runId).not.toBe(b.runId);
    expect(a.rawEvents).toEqual(b.rawEvents);
    expect({ ...a.result(), runId: "" }).toEqual({ ...b.result(), runId: "" });
    expect(a.logs.map((l) => ({ ...l, runId: "" }))).toEqual(
      b.logs.map((l) => ({ ...l, runId: "" })),
    );
    expect(run("noise", 18).rawEvents).not.toEqual(a.rawEvents);
  });
  it("is independent of advance chunking", () => {
    const a = new SimulationEngine("conflict"),
      b = new SimulationEngine("conflict");
    a.advance(30);
    for (let i = 0; i < 300; i++) b.advance(0.1);
    expect(a.rawEvents).toEqual(b.rawEvents);
    expect({ ...a.result(), runId: "" }).toEqual({ ...b.result(), runId: "" });
  });
  it("runs every library scenario with actual sensor events", () => {
    for (const s of scenarios) {
      const e = run(s.id);
      expect(e.rawEvents.length, s.id).toBeGreaterThan(0);
      expect(e.time).toBeCloseTo(e.scenario.duration, 1);
    }
  });
  it("extends horizon and windows for low-speed configured runs", () => {
    const e = new SimulationEngine("normal-ab", {
      ...DEFAULT_CONFIG,
      speed: 1,
      sensorGap: 18,
    });
    e.advance(e.scenario.duration);
    expect(e.truthAB).toBe(1);
    expect(e.algorithms.B.snapshot()).toMatchObject({
      state: "FREE",
      completedAB: 1,
    });
  });
});
