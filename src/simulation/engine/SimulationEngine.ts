import { BasicDetector } from "../../algorithms/basic";
import { ImprovedDetector } from "../../algorithms/improved";
import { SensorEngine } from "../sensors/SensorEngine";
import { getScenario } from "../scenarios";
import { worldHull, hullRelation, type Point2 } from "../geometry/hulls";
import type {
  CollisionContact,
  CollisionEpisode,
  ClosestPair,
} from "../geometry/types";
import {
  assessGrounding,
  DEFAULT_DRAFTS,
  type GroundingAssessment,
} from "../environment/bathymetry";
import {
  rangeReadings,
  sensorPacket,
  type RangeReading,
} from "../sensors/virtualTelemetry";
import type {
  Decision,
  Detector,
  Direction,
  LogCategory,
  LogEvent,
  RunResult,
  Scenario,
  SensorEvent,
  Ship,
  ShipType,
  SimConfig,
  SpawnSpec,
} from "../../types";
export const DEFAULT_CONFIG: SimConfig = {
  seed: 2026,
  speed: 4,
  interval: 4,
  sensorGap: 12,
  noise: {
    enabled: false,
    probability: 0.3,
    falseTrigger: 0.08,
    dropout: 0.04,
    bounce: 0.4,
    delay: 0.08,
  },
};
export const FIXED_DT = 0.02;
export class SimulationEngine {
  time = 0;
  running = false;
  draggingShipId: string | null = null;
  contacts: CollisionContact[] = [];
  collisionHistory: CollisionEpisode[] = [];
  closestPair: ClosestPair | null = null;
  pauseOnCollision = true;
  collisionCount = 0;
  trails = new Map<string, Point2[]>();
  waterLevel = 0;
  pauseOnGrounding = true;
  groundingAssessments: GroundingAssessment[] = [];
  groundingCount = 0;
  rangeSensors: RangeReading[] = rangeReadings([]);
  get groundingNow() {
    return this.groundingAssessments.some((a) => a.status === "grounded");
  }
  get groundingRisk() {
    return this.groundingAssessments.some((a) => a.status !== "clear");
  }
  setWaterLevel(level: number) {
    if (!Number.isFinite(level)) return;
    this.waterLevel = Math.max(-1, Math.min(1.5, level));
    this.refreshManualState();
  }
  getSensorPacket() {
    return sensorPacket(
      this.time,
      this.sensors.sensors,
      this.rangeSensors,
      this.waterLevel,
      this.rawEvents,
      this.runId,
    );
  }
  get collisionNow() {
    return this.contacts.length > 0;
  }
  multiplier = 1;
  ships: Ship[] = [];
  sensors: SensorEngine;
  algorithms: { A: Detector; B: Detector };
  logs: LogEvent[] = [];
  rawEvents: SensorEvent[] = [];
  runId: string;
  config: SimConfig;
  scenario: Scenario;
  truthConflict = false;
  conflictNow = false;
  truthAB = 0;
  truthBA = 0;
  warnings = { A: false, B: false };
  firstWarnings: { A: number | null; B: number | null } = { A: null, B: null };
  latency: { A: number[]; B: number[] } = { A: [], B: [] };
  cpuMs = { A: 0, B: 0 };
  truncated = false;
  private seq = 0;
  private shipSeq = 0;
  private schedule: SpawnSpec[];
  private spawned = new Set<number>();
  private truthEntries: { time: number; direction: Direction }[] = [];
  private entered = new Set<string>();
  private entryDecisions: { A: Decision[]; B: Decision[] } = { A: [], B: [] };
  constructor(scenarioId = "normal-ab", config: SimConfig = DEFAULT_CONFIG) {
    this.config = structuredClone(config);
    this.scenario = structuredClone(getScenario(scenarioId));
    if (this.scenario.noise && !this.config.noise.enabled)
      this.config.noise = { ...this.config.noise, ...this.scenario.noise };
    const unique =
      globalThis.crypto?.randomUUID?.().slice(0, 8) ??
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.runId = `${scenarioId}-${config.seed}-${unique}`;
    this.sensors = new SensorEngine(
      config.seed,
      config.sensorGap,
      this.config.noise,
    );
    this.scenario.duration *= Math.max(1, 4 / config.speed);
    this.algorithms = {
      A: new BasicDetector(),
      B: new ImprovedDetector({
        channelRatio: 60 / config.sensorGap,
        activationWindow: Math.max(14, config.sensorGap / config.speed + 8),
        occupancyTimeout: Math.max(55, 80 / config.speed + 20),
        stuckTimeout: Math.max(12, 12 / config.speed + 3),
      }),
    };
    this.schedule = this.scenario.ships.map((s, i) => ({
      ...s,
      at: scenarioId === "continuous" ? i * config.interval : s.at,
      speed: s.speed ?? config.speed,
    }));
  }
  log(
    category: LogCategory,
    type: string,
    detail: string,
    extra: Partial<LogEvent> = {},
  ) {
    const e: LogEvent = {
      id: `e-${++this.seq}`,
      runId: this.runId,
      dataType: this.runId.startsWith("hardware-")
        ? "Hardware Data"
        : "Simulation Data",
      timestamp: this.time,
      category,
      type,
      detail,
      ...extra,
    };
    this.logs.push(e);
    if (this.logs.length > 20000) {
      this.logs.shift();
      this.truncated = true;
    }
    return e;
  }
  start() {
    this.running = true;
    this.log("user", "start", "Chạy mô phỏng.");
  }
  pause() {
    this.running = false;
    this.log("user", "pause", "Tạm dừng mô phỏng.");
  }
  spawn(
    direction: Direction,
    type: ShipType = "cargo",
    speed = this.config.speed,
  ) {
    const sizes = { fishing: [5, 2], cargo: [9, 3], transport: [11, 2.8] };
    const size = sizes[type];
    const ship: Ship = {
      id: `PT-${String(++this.shipSeq).padStart(3, "0")}`,
      type,
      direction,
      initialDirection: direction,
      x: direction === "AB" ? -57 : 57,
      y: direction === "AB" ? -1.7 : 1.7,
      speed,
      length: size[0],
      width: size[1],
      draft: DEFAULT_DRAFTS[type],
      spawnTime: this.time,
      status: "moving",
      reversed: false,
    };
    this.ships.push(ship);
    this.log("user", "spawn", `Tạo ${ship.id}, hướng ${direction}.`);
    return ship;
  }
  remove(id: string) {
    if (this.draggingShipId === id) this.endDrag();
    this.ships = this.ships.filter((s) => s.id !== id);
    this.refreshManualState();
    this.log(
      "user",
      "remove",
      `Xóa ${id}; thuật toán giữ trạng thái để tránh giả định luồng trống.`,
    );
  }
  beginDrag(id: string) {
    if (!this.ships.some((s) => s.id === id && s.status !== "completed"))
      return false;
    this.draggingShipId = id;
    return true;
  }
  moveShip(id: string, x: number, y: number) {
    const ship = this.ships.find(
      (s) => s.id === id && s.status !== "completed",
    );
    if (!ship || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const targetX = Math.max(-62, Math.min(62, x)),
      targetY = Math.max(-7, Math.min(7, y));
    const fromX = ship.x,
      fromY = ship.y;
    // Subdivide large pointer jumps, so dragging through another hull still
    // records contact even if the final pointer position is clear.
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(targetX - fromX, targetY - fromY) / 0.25),
    );
    for (let i = 1; i <= steps; i++) {
      ship.x = fromX + ((targetX - fromX) * i) / steps;
      ship.y = fromY + ((targetY - fromY) * i) / steps;
      this.evaluateCollisions();
      this.evaluateGrounding();
    }
    this.sampleTrails();
    this.refreshManualState();
  }
  endDrag() {
    this.draggingShipId = null;
  }
  refreshManualState() {
    this.evaluateTruth();
    this.evaluateCollisions();
    this.evaluateGrounding();
    this.rangeSensors = rangeReadings(this.ships);
    this.acceptSensorEvents(
      this.sensors.update(this.time, 0, this.ships, this.scenario.fault),
      this.time,
    );
  }
  private sampleTrails() {
    for (const s of this.ships) {
      if (s.status === "completed") continue;
      const points = this.trails.get(s.id) ?? [];
      const last = points.at(-1);
      if (!last || Math.hypot(last.x - s.x, last.y - s.y) >= 0.5) {
        points.push({ x: s.x, y: s.y });
        if (points.length > 180) points.shift();
        this.trails.set(s.id, points);
      }
    }
  }
  private evaluateGrounding() {
    const previous = new Map(
      this.groundingAssessments.map((a) => [a.shipId, a.status]),
    );
    this.groundingAssessments = this.ships
      .filter((s) => s.status !== "completed")
      .map((s) => assessGrounding(s, this.waterLevel));
    for (const a of this.groundingAssessments) {
      if (a.status === "grounded" && previous.get(a.shipId) !== "grounded") {
        this.groundingCount++;
        this.log(
          "truth",
          "grounding",
          `${a.shipId} chạm đáy mô hình: sâu ${a.depth.toFixed(2)}, mớn ${a.draft.toFixed(2)}.`,
        );
        if (this.pauseOnGrounding) this.running = false;
      }
    }
  }
  private evaluateCollisions() {
    const active = this.ships.filter((s) => s.status !== "completed"),
      polygons = active.map(worldHull),
      previous = new Map(this.contacts.map((c) => [c.key, c]));
    const contacts: CollisionContact[] = [];
    let closest: ClosestPair | null = null;
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i],
          b = active[j],
          relation = hullRelation(polygons[i], polygons[j]),
          shipIds: [string, string] = [a.id, b.id];
        if (!closest || relation.distance < closest.distance)
          closest = {
            shipIds,
            distance: relation.distance,
            pointA: relation.pointA,
            pointB: relation.pointB,
          };
        if (!relation.colliding) continue;
        const key = [a.id, b.id].sort().join("|"),
          old = previous.get(key);
        const contact: CollisionContact = {
          key,
          shipIds,
          point: relation.contact,
          startedAt: old?.startedAt ?? this.time,
        };
        contacts.push(contact);
        if (!old) {
          this.collisionCount++;
          this.collisionHistory.push({
            ...contact,
            id: this.collisionCount,
            endedAt: null,
          });
          if (this.collisionHistory.length > 100) this.collisionHistory.shift();
          this.log(
            "truth",
            "collision-start",
            `Va chạm hình học: ${a.id} và ${b.id}.`,
          );
          if (this.pauseOnCollision) this.running = false;
        }
      }
    for (const old of this.contacts)
      if (!contacts.some((c) => c.key === old.key)) {
        const episode = [...this.collisionHistory]
          .reverse()
          .find((c) => c.key === old.key && c.endedAt === null);
        if (episode) episode.endedAt = this.time;
        this.log(
          "truth",
          "collision-end",
          `Hai thân tàu đã tách: ${old.shipIds.join(" / ")}.`,
        );
      }
    this.contacts = contacts;
    this.closestPair = closest;
  }
  private evaluateTruth() {
    for (const s of this.ships) {
      if (
        !this.entered.has(s.id) &&
        s.status !== "completed" &&
        Math.abs(s.x) <= 30 + s.length / 2 + 0.7
      ) {
        this.entered.add(s.id);
        this.truthEntries.push({
          time: this.time,
          direction: s.initialDirection ?? s.direction,
        });
      }
    }
    const inChannel = this.ships.filter(
      (s) =>
        s.status !== "completed" &&
        s.x + s.length / 2 >= -30 &&
        s.x - s.length / 2 <= 30,
    );
    const conflict =
      inChannel.some((s) => s.direction === "AB") &&
      inChannel.some((s) => s.direction === "BA");
    if (conflict !== this.conflictNow) {
      this.log(
        "truth",
        conflict ? "conflict-start" : "conflict-end",
        conflict
          ? "Ground truth: hai tàu đối hướng cùng chiếm dụng đoạn [-30, 30]."
          : "Kết thúc khoảng chiếm dụng đối hướng.",
      );
    }
    this.conflictNow = conflict;
    this.truthConflict ||= conflict;
  }
  acceptSensorEvents(events: SensorEvent[], time: number) {
    for (const e of events) {
      this.rawEvents.push(e);
      if (this.rawEvents.length > 20000) {
        this.rawEvents.shift();
        this.truncated = true;
      }
      this.log(
        "sensor",
        e.value ? "rising" : "falling",
        `${e.sensorId}: ${e.value ? "che vùng phát hiện" : "rời vùng phát hiện"}.`,
        { timestamp: e.timestamp, sensorId: e.sensorId, value: e.value },
      );
    }
    for (const name of ["A", "B"] as const) {
      const before = performance.now();
      const detector = this.algorithms[name];
      // Flush the previous stable level BEFORE the next timestamped edge. This
      // preserves complete pulses even when HTTP returns several edges together.
      for (const e of events) {
        detector.tick(e.timestamp);
        detector.feed(e);
      }
      detector.tick(time);
      const ds = detector.drain();
      this.cpuMs[name] = performance.now() - before;
      this.record(ds);
    }
  }
  private record(ds: Decision[]) {
    for (const d of ds) {
      this.latency[d.algorithm].push(d.latencyMs);
      if (this.latency[d.algorithm].length > 20000)
        this.latency[d.algorithm].shift();
      if (d.kind === "entry") this.entryDecisions[d.algorithm].push(d);
      if (d.warning) {
        this.warnings[d.algorithm] = true;
        if (this.firstWarnings[d.algorithm] === null)
          this.firstWarnings[d.algorithm] = d.timestamp;
      }
      this.log("algorithm", d.kind, d.detail, {
        timestamp: d.timestamp,
        algorithm: d.algorithm,
        state: d.state,
        warning: d.warning,
        direction: d.direction,
        latencyMs: d.latencyMs,
      });
    }
  }
  step() {
    this.time = Number((this.time + FIXED_DT).toFixed(8));
    this.schedule.forEach((spec, i) => {
      if (!this.spawned.has(i) && this.time + 1e-8 >= spec.at) {
        this.spawned.add(i);
        const s = this.spawn(spec.direction, spec.type, spec.speed);
        (s as Ship & { spec?: SpawnSpec }).spec = spec;
      }
    });
    for (const s of this.ships) {
      if (s.status !== "moving" || s.id === this.draggingShipId) continue;
      const spec = (s as Ship & { spec?: SpawnSpec }).spec;
      const sign = s.direction === "AB" ? 1 : -1;
      const next = s.x + sign * s.speed * FIXED_DT;
      if (
        spec?.stopAt !== undefined &&
        (s.x - spec.stopAt) * (next - spec.stopAt) <= 0
      ) {
        s.x = spec.stopAt;
        s.status = "stopped";
        this.log("truth", "stopped", `${s.id} dừng tại ${s.x}.`);
        continue;
      }
      if (
        spec?.reverseAt !== undefined &&
        !s.reversed &&
        (s.x - spec.reverseAt) * (next - spec.reverseAt) <= 0
      ) {
        s.reversed = true;
        s.direction = s.direction === "AB" ? "BA" : "AB";
        this.log("truth", "reversed", `${s.id} quay đầu.`);
      }
      s.x = next;
      if (Math.abs(s.x) > 66) {
        s.status = "completed";
        if (!s.reversed) {
          if (s.direction === "AB") this.truthAB++;
          else this.truthBA++;
        }
        this.log("truth", "completed", `${s.id} kết thúc hành trình.`, {
          direction: s.direction,
        });
      }
    }
    this.evaluateTruth();
    this.evaluateCollisions();
    this.sampleTrails();
    this.evaluateGrounding();
    this.rangeSensors = rangeReadings(this.ships);
    this.acceptSensorEvents(
      this.sensors.update(this.time, FIXED_DT, this.ships, this.scenario.fault),
      this.time,
    );
  }
  advance(seconds: number) {
    for (let i = 0; i < Math.floor((seconds + 1e-8) / FIXED_DT); i++)
      this.step();
  }
  result(): RunResult {
    const average = (v: number[]) =>
      v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    // Offline evaluator only: geometry independently timestamps each first inner-sensor
    // entry. Greedy one-to-one time association, THEN compare direction. Missing=wrong.
    const window =
      0.5 + (this.config.noise.enabled ? this.config.noise.delay : 0);
    const correct = (name: "A" | "B") => {
      const available = [...this.entryDecisions[name]];
      let count = 0;
      for (const truth of this.truthEntries) {
        const i = available.findIndex(
          (d) =>
            d.timestamp >= truth.time - 0.021 &&
            d.timestamp <= truth.time + window,
        );
        if (i >= 0) {
          const [d] = available.splice(i, 1);
          if (d.direction === truth.direction) count++;
        }
      }
      return count;
    };
    return {
      runId: this.runId,
      scenario: this.scenario.id,
      seed: this.config.seed,
      duration: this.time,
      dataType: "Simulation Data",
      truthConflict: this.truthConflict,
      truthAB: this.truthAB,
      truthBA: this.truthBA,
      A: this.algorithms.A.snapshot(),
      B: this.algorithms.B.snapshot(),
      warningA: this.warnings.A,
      warningB: this.warnings.B,
      firstWarningA: this.firstWarnings.A,
      firstWarningB: this.firstWarnings.B,
      events: this.rawEvents.length,
      latencyA: average(this.latency.A),
      latencyB: average(this.latency.B),
      directionCorrectA: correct("A"),
      directionCorrectB: correct("B"),
      directionSamples: this.truthEntries.length,
      config: structuredClone(this.config),
    };
  }
}
