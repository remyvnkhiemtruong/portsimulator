import { describe, it, expect } from "vitest";
import { SimulationEngine } from "../simulation/engine/SimulationEngine";
describe("Interactive ship movement", () => {
  it("updates coordinates and sensors while paused without advancing the clock", () => {
    const e = new SimulationEngine("free"),
      ship = e.spawn("AB");
    e.beginDrag(ship.id);
    e.moveShip(ship.id, -42, 3);
    expect(ship.x).toBe(-42);
    expect(ship.y).toBe(3);
    expect(e.sensors.sensors[0].state).toBe(true);
    e.moveShip(ship.id, 0, 3);
    expect(e.sensors.sensors[0].state).toBe(false);
    expect(e.time).toBe(0);
  });
  it("holds only the dragged ship; other ships keep moving; release resumes it", () => {
    const e = new SimulationEngine("free"),
      a = e.spawn("AB"),
      b = e.spawn("BA");
    e.beginDrag(a.id);
    e.advance(1);
    expect(a.x).toBe(-57);
    expect(b.x).toBeLessThan(57);
    e.endDrag();
    e.advance(1);
    expect(a.x).toBeGreaterThan(-57);
    expect(e.time).toBe(2);
  });
  it("constrains dragging to the water and ignores invalid positions", () => {
    const e = new SimulationEngine("free"),
      s = e.spawn("AB");
    e.moveShip(s.id, 1000, -1000);
    expect([s.x, s.y]).toEqual([62, -7]);
    e.moveShip(s.id, NaN, 2);
    expect([s.x, s.y]).toEqual([62, -7]);
  });
  it("updates conflict state immediately when ships are moved or removed", () => {
    const e = new SimulationEngine("free"),
      a = e.spawn("AB"),
      b = e.spawn("BA");
    e.moveShip(a.id, 0, -2);
    e.moveShip(b.id, 12, 2);
    expect(e.conflictNow).toBe(true);
    e.remove(b.id);
    expect(e.conflictNow).toBe(false);
  });
});
