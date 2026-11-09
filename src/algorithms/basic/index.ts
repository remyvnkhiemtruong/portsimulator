import { BaseDetector } from "../base";
import type { Direction, SensorEvent } from "../../types";
// Deliberately simple baseline: no debounce, faults, sequence validation or uncertainty.
export class BasicDetector extends BaseDetector {
  private direction: Direction | null = null;
  constructor() {
    super("A");
  }
  feed(e: SensorEvent) {
    if (!e.value) return;
    if (e.sensorId === "A1" || e.sensorId === "B1") {
      const d: Direction = e.sensorId === "A1" ? "AB" : "BA";
      if (this.direction && this.direction !== d) {
        this.state = "WARNING";
        this.warning = true;
        this.emit(
          e.timestamp,
          "Tiếp cận đầu đối diện khi đang chiếm dụng.",
          e.timestamp,
        );
      } else if (!this.direction) {
        this.direction = d;
        this.state = d === "AB" ? "PENDING_A" : "PENDING_B";
        this.emit(e.timestamp, "Ghi nhận tín hiệu đầu vào.", e.timestamp);
      }
    }
    if (
      (e.sensorId === "A2" && this.direction === "AB") ||
      (e.sensorId === "B2" && this.direction === "BA")
    ) {
      this.occupancy = 1;
      this.state = this.direction === "AB" ? "OCCUPIED_AB" : "OCCUPIED_BA";
      this.emit(
        e.timestamp,
        "Xác nhận vào luồng theo tín hiệu đơn.",
        e.timestamp,
        "entry",
        this.direction,
      );
    }
    if (
      (e.sensorId === "B2" && this.direction === "AB") ||
      (e.sensorId === "A2" && this.direction === "BA")
    ) {
      const d = this.direction!;
      if (d === "AB") this.completedAB++;
      else this.completedBA++;
      this.occupancy = 0;
      this.direction = null;
      this.state = "FREE";
      this.warning = false;
      this.emit(
        e.timestamp,
        "Giải phóng tại cảm biến trong (quy tắc đối chứng).",
        e.timestamp,
        "passage",
        d,
      );
    }
  }
  tick(_time: number) {}
}
