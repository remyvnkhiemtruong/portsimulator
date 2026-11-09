import {
  SENSOR_IDS,
  type NoiseConfig,
  type Sensor,
  type SensorEvent,
  type SensorId,
  type Ship,
} from "../../types";
import { SeededRandom } from "../../utils/random";
export class SensorEngine {
  sensors: Sensor[];
  private random: SeededRandom;
  private seq = 0;
  private physical: Record<string, boolean> = {};
  private bounceUntil: Record<string, number> = {};
  private falseUntil: Record<string, number> = {};
  private dropoutUntil: Record<string, number> = {};
  private observed: Record<string, boolean> = {};
  private pending: { due: number; sensorId: SensorId; value: boolean }[] = [];
  constructor(
    seed: number,
    gap: number,
    private noise: NoiseConfig,
  ) {
    this.random = new SeededRandom(seed);
    this.sensors = SENSOR_IDS.map((id, i) => ({
      id,
      x: [-30 - gap, -30, 30, 30 + gap][i],
      radius: 0.7,
      state: false,
      lastActivation: null,
      history: [],
    }));
  }
  update(
    t: number,
    dt: number,
    ships: Ship[],
    fault?: { sensor: SensorId; mode: "missing" | "stuck"; from: number },
  ): SensorEvent[] {
    for (const s of this.sensors) {
      const covered = ships.some(
        (v) =>
          v.status !== "completed" &&
          Math.abs(v.x - s.x) <= v.length / 2 + s.radius,
      );
      if (covered !== this.physical[s.id]) {
        this.physical[s.id] = covered;
        if (
          this.noise.enabled &&
          this.random.next() < this.noise.bounce * this.noise.probability
        )
          this.bounceUntil[s.id] = t + 0.1;
      }
      let value = covered;
      if (this.noise.enabled) {
        const scale = this.noise.probability;
        if (this.random.next() < this.noise.falseTrigger * scale * dt)
          this.falseUntil[s.id] = t + 0.06 + this.random.next() * 0.24;
        if (covered && this.random.next() < this.noise.dropout * scale * dt)
          this.dropoutUntil[s.id] = t + 0.06 + this.random.next() * 0.35;
        if (t < (this.falseUntil[s.id] ?? 0)) value = true;
        if (t < (this.dropoutUntil[s.id] ?? 0)) value = false;
        if (t < (this.bounceUntil[s.id] ?? 0) && Math.floor(t / dt) % 2 === 0)
          value = !value;
      }
      if (fault && fault.sensor === s.id && t >= fault.from)
        value = fault.mode === "stuck";
      if (value !== (this.observed[s.id] ?? false)) {
        this.observed[s.id] = value;
        this.pending.push({
          due: t + (this.noise.enabled ? this.noise.delay : 0),
          sensorId: s.id,
          value,
        });
      }
    }
    const events: SensorEvent[] = [];
    for (const p of this.pending.filter((p) => p.due <= t + 1e-8)) {
      const s = this.sensors.find((s) => s.id === p.sensorId)!;
      if (s.state === p.value) continue;
      s.state = p.value;
      if (p.value) s.lastActivation = t;
      s.history.push({ t, value: p.value });
      if (s.history.length > 1000) s.history.shift();
      events.push({
        id: `raw-${++this.seq}`,
        timestamp: t,
        sensorId: s.id,
        value: s.state,
      });
    }
    this.pending = this.pending.filter((p) => p.due > t + 1e-8);
    return events;
  }
}
