import { describe, expect, it } from "vitest";
import { ImprovedDetector } from "../algorithms/improved";
import { BasicDetector } from "../algorithms/basic";
import {
  DEFAULT_CONFIG,
  SimulationEngine,
} from "../simulation/engine/SimulationEngine";
import { evaluate } from "../services/analytics";
import type { Detector, SensorEvent, SensorId } from "../types";
function event(t: number, id: SensorId, value = true): SensorEvent {
  return { id: `${t}-${id}`, timestamp: t, sensorId: id, value };
}
function pulse(d: Detector, t: number, id: SensorId) {
  d.feed(event(t, id));
  d.tick(t + 0.14);
  d.feed(event(t + 0.5, id, false));
  d.tick(t + 0.64);
}
describe("Improved sensor-only FSM", () => {
  it("uses pending, occupied, exit sequence and FREE only with evidence", () => {
    const b = new ImprovedDetector();
    pulse(b, 1, "A1");
    expect(b.snapshot().state).toBe("PENDING_A");
    pulse(b, 3, "A2");
    expect(b.snapshot().state).toBe("OCCUPIED_AB");
    pulse(b, 10, "B2");
    expect(b.snapshot().occupancy).toBe(1);
    pulse(b, 12, "B1");
    expect(b.snapshot()).toMatchObject({
      state: "FREE",
      occupancy: 0,
      completedAB: 1,
      warning: false,
    });
  });
  it("rejects sub-debounce bounce", () => {
    const b = new ImprovedDetector();
    b.feed(event(1, "A1"));
    b.feed(event(1.04, "A1", false));
    b.tick(1.5);
    expect(b.snapshot().state).toBe("FREE");
    expect(b.drain()).toEqual([]);
  });
  it("accepts stable pulse after bouncing and reports input-to-decision latency", () => {
    const b = new ImprovedDetector();
    b.feed(event(1, "A1"));
    b.feed(event(1.03, "A1", false));
    b.feed(event(1.06, "A1"));
    b.tick(1.18);
    expect(b.snapshot().state).toBe("PENDING_A");
    expect(b.drain()[0].latencyMs).toBeCloseTo(120);
  });
  it("does not read any hidden identity or position", () => {
    const a = new ImprovedDetector(),
      b = new ImprovedDetector();
    for (const [i, s] of ["A1", "A2", "B2", "B1"].entries()) {
      pulse(a, i * 3 + 1, s as SensorId);
      pulse(b, i * 3 + 1, s as SensorId);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
  });
  it("locks on missing predecessor rather than guessing a direction", () => {
    const b = new ImprovedDetector();
    pulse(b, 1, "A2");
    expect(b.snapshot().state).toBe("UNCERTAIN");
    b.tick(100);
    expect(b.snapshot().state).not.toBe("FREE");
  });
  it("pending timeout becomes FAULT, not FREE", () => {
    const b = new ImprovedDetector();
    pulse(b, 1, "A1");
    b.tick(20);
    expect(b.snapshot().state).toBe("FAULT");
  });
  it("detects stuck high even without new edges", () => {
    const b = new ImprovedDetector();
    b.feed(event(1, "A1"));
    b.tick(1.2);
    b.tick(14);
    expect(b.snapshot().faults).toBe(1);
    expect(b.snapshot().state).toBe("FAULT");
  });
  it("recognizes an exiting B1 edge without confusing it with opposite approach", () => {
    const b = new ImprovedDetector();
    for (const [i, s] of ["A1", "A2", "B2", "B1"].entries())
      pulse(b, [1, 4, 19, 22][i], s as SensorId);
    expect(b.snapshot().warning).toBe(false);
  });
  it("rejects physically implausible early exit based on observed transit timing", () => {
    const b = new ImprovedDetector();
    pulse(b, 1, "A1");
    pulse(b, 4, "A2");
    pulse(b, 4.8, "B2");
    expect(b.snapshot().state).toBe("UNCERTAIN");
    expect(b.snapshot().completedAB).toBe(0);
  });
  it("feeds exactly identical stream to both algorithms and computes actual confusion metrics", () => {
    const e = new SimulationEngine("conflict", DEFAULT_CONFIG);
    const seenA: SensorEvent[] = [],
      seenB: SensorEvent[] = [];
    const a = new BasicDetector(),
      b = new ImprovedDetector();
    e.algorithms.A = {
      feed: (v) => {
        seenA.push(v);
        a.feed(v);
      },
      tick: (t) => a.tick(t),
      drain: () => a.drain(),
      snapshot: () => a.snapshot(),
    };
    e.algorithms.B = {
      feed: (v) => {
        seenB.push(v);
        b.feed(v);
      },
      tick: (t) => b.tick(t),
      drain: () => b.drain(),
      snapshot: () => b.snapshot(),
    };
    e.advance(45);
    expect(seenA).toEqual(seenB);
    expect(seenA).toEqual(e.rawEvents);
    expect(evaluate([e.result()], "B")).toMatchObject({
      TP: 1,
      FP: 0,
      TN: 0,
      FN: 0,
      precision: 1,
      recall: 1,
      fpr: null,
    });
  });
  it("does not invent metrics for an empty experiment", () => {
    expect(evaluate([], "B")).toMatchObject({
      TP: 0,
      precision: null,
      recall: null,
      f1: null,
      latency: null,
    });
  });
  it("preserves pulses delivered together in one HTTP-style packet", () => {
    const e = new SimulationEngine();
    e.acceptSensorEvents(
      [
        event(1, "A1"),
        event(1.6, "A1", false),
        event(3, "A2"),
        event(3.6, "A2", false),
        event(10, "B2"),
        event(10.6, "B2", false),
        event(12, "B1"),
        event(12.6, "B1", false),
      ],
      13,
    );
    expect(e.algorithms.B.snapshot()).toMatchObject({
      state: "FREE",
      completedAB: 1,
    });
  });
});
