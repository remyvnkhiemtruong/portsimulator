export type SensorId = "A1" | "A2" | "B2" | "B1";
export const SENSOR_IDS: SensorId[] = ["A1", "A2", "B2", "B1"];
export type Direction = "AB" | "BA";
export type ShipType = "fishing" | "cargo" | "transport";
export type SystemState =
  | "FREE"
  | "PENDING_A"
  | "PENDING_B"
  | "OCCUPIED_AB"
  | "OCCUPIED_BA"
  | "WARNING"
  | "FAULT"
  | "UNCERTAIN";
export interface Ship {
  id: string;
  type: ShipType;
  direction: Direction;
  initialDirection?: Direction;
  x: number;
  y: number;
  speed: number;
  length: number;
  width: number;
  draft?: number;
  spawnTime: number;
  status: "moving" | "stopped" | "completed";
  reversed: boolean;
}
// This is the ENTIRE input contract available to warning algorithms. No ship data.
export interface SensorEvent {
  id: string;
  timestamp: number;
  sensorId: SensorId;
  value: boolean;
}
export interface Sensor {
  id: SensorId;
  x: number;
  radius: number;
  state: boolean;
  lastActivation: number | null;
  history: { t: number; value: boolean }[];
}
export interface Decision {
  algorithm: "A" | "B";
  timestamp: number;
  state: SystemState;
  warning: boolean;
  direction?: Direction;
  kind: "state" | "entry" | "passage" | "fault";
  detail: string;
  inputTimestamp: number;
  latencyMs: number;
}
export interface AlgorithmSnapshot {
  version: "A" | "B";
  state: SystemState;
  warning: boolean;
  occupancy: number;
  completedAB: number;
  completedBA: number;
  faults: number;
  lastLatencyMs: number;
}
export interface Detector {
  feed(event: SensorEvent): void;
  tick(time: number): void;
  snapshot(): AlgorithmSnapshot;
  drain(): Decision[];
}
export type LogCategory =
  "sensor" | "algorithm" | "truth" | "user" | "connection";
export interface LogEvent {
  id: string;
  runId: string;
  dataType: "Simulation Data" | "Hardware Data";
  timestamp: number;
  category: LogCategory;
  type: string;
  sensorId?: SensorId;
  value?: boolean;
  direction?: Direction;
  algorithm?: "A" | "B";
  state?: SystemState;
  warning?: boolean;
  detail: string;
  latencyMs?: number;
}
export interface NoiseConfig {
  enabled: boolean;
  probability: number;
  falseTrigger: number;
  dropout: number;
  bounce: number;
  delay: number;
}
export interface SimConfig {
  seed: number;
  speed: number;
  interval: number;
  sensorGap: number;
  noise: NoiseConfig;
}
export interface SpawnSpec {
  at: number;
  direction: Direction;
  speed?: number;
  type?: ShipType;
  stopAt?: number;
  reverseAt?: number;
}
export interface Scenario {
  id: string;
  name: string;
  description: string;
  expected: string;
  ships: SpawnSpec[];
  duration: number;
  noise?: Partial<NoiseConfig>;
  fault?: { sensor: SensorId; mode: "missing" | "stuck"; from: number };
  truthPlan: string;
}
export interface RunResult {
  runId: string;
  scenario: string;
  seed: number;
  duration: number;
  dataType: "Simulation Data";
  truthConflict: boolean;
  truthAB: number;
  truthBA: number;
  A: AlgorithmSnapshot;
  B: AlgorithmSnapshot;
  warningA: boolean;
  warningB: boolean;
  firstWarningA: number | null;
  firstWarningB: number | null;
  events: number;
  latencyA: number;
  latencyB: number;
  directionCorrectA: number;
  directionCorrectB: number;
  directionSamples: number;
  config: SimConfig;
}
export interface Evaluation {
  TP: number;
  FP: number;
  TN: number;
  FN: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  fpr: number | null;
  directionAccuracy: number | null;
  latency: number | null;
}
