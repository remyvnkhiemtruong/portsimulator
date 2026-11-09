import type {
  AlgorithmSnapshot,
  Decision,
  Detector,
  Direction,
  SensorEvent,
  SystemState,
} from "../types";
export abstract class BaseDetector implements Detector {
  protected state: SystemState = "FREE";
  protected warning = false;
  protected occupancy = 0;
  protected completedAB = 0;
  protected completedBA = 0;
  protected faults = 0;
  protected decisions: Decision[] = [];
  protected lastLatencyMs = 0;
  constructor(readonly version: "A" | "B") {}
  abstract feed(event: SensorEvent): void;
  abstract tick(time: number): void;
  protected emit(
    time: number,
    detail: string,
    inputTimestamp = time,
    kind: Decision["kind"] = "state",
    direction?: Direction,
  ) {
    this.lastLatencyMs = Math.max(0, (time - inputTimestamp) * 1000);
    this.decisions.push({
      algorithm: this.version,
      timestamp: time,
      state: this.state,
      warning: this.warning,
      direction,
      kind,
      detail,
      inputTimestamp,
      latencyMs: this.lastLatencyMs,
    });
  }
  snapshot(): AlgorithmSnapshot {
    return {
      version: this.version,
      state: this.state,
      warning: this.warning,
      occupancy: this.occupancy,
      completedAB: this.completedAB,
      completedBA: this.completedBA,
      faults: this.faults,
      lastLatencyMs: this.lastLatencyMs,
    };
  }
  drain() {
    const d = this.decisions;
    this.decisions = [];
    return d;
  }
}
