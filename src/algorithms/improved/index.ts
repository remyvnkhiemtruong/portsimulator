import { BaseDetector } from "../base";
import {
  SENSOR_IDS,
  type Direction,
  type SensorEvent,
  type SensorId,
} from "../../types";
interface Track {
  direction: Direction;
  stage: number;
  first: number;
  last: number;
  entered: boolean;
  approachDuration: number;
}
const paths: Record<Direction, SensorId[]> = {
  AB: ["A1", "A2", "B2", "B1"],
  BA: ["B1", "B2", "A2", "A1"],
};
export interface ImprovedOptions {
  debounce: number;
  activationWindow: number;
  occupancyTimeout: number;
  stuckTimeout: number;
  channelRatio: number;
}
export class ImprovedDetector extends BaseDetector {
  private raw = Object.fromEntries(
    SENSOR_IDS.map((id) => [id, false]),
  ) as Record<SensorId, boolean>;
  private stable = { ...this.raw };
  private changed = Object.fromEntries(
    SENSOR_IDS.map((id) => [id, 0]),
  ) as Record<SensorId, number>;
  private highSince = { ...this.changed };
  private tracks: Track[] = [];
  private locked = false;
  private recent: Partial<Record<SensorId, number>> = {};
  readonly options: ImprovedOptions;
  constructor(options: Partial<ImprovedOptions> = {}) {
    super("B");
    this.options = {
      debounce: 0.12,
      activationWindow: 14,
      occupancyTimeout: 55,
      stuckTimeout: 12,
      channelRatio: 5,
      ...options,
    };
  }
  feed(e: SensorEvent) {
    if (e.value !== this.raw[e.sensorId]) {
      this.raw[e.sensorId] = e.value;
      this.changed[e.sensorId] = e.timestamp;
    }
  }
  markDataGap(time: number) {
    this.fault(
      time,
      "Mất hoặc thiếu dữ liệu thiết bị. Không suy ra luồng trống; cần xác minh và tạo phiên mới.",
    );
  }
  private fault(time: number, detail: string, uncertain = false) {
    if (this.locked) return;
    this.locked = true;
    this.faults++;
    this.state = uncertain ? "UNCERTAIN" : "FAULT";
    this.emit(time, detail, time, "fault");
  }
  tick(t: number) {
    for (const id of SENSOR_IDS) {
      if (
        this.raw[id] !== this.stable[id] &&
        t - this.changed[id] + 1e-8 >= this.options.debounce
      ) {
        this.stable[id] = this.raw[id];
        if (this.stable[id]) {
          this.highSince[id] = this.changed[id];
          this.rise(id, t, this.changed[id]);
        }
      }
      if (this.stable[id] && t - this.highSince[id] > this.options.stuckTimeout)
        this.fault(
          t,
          `${id} mức cao quá ${this.options.stuckTimeout}s; cần kiểm tra và reset thủ công.`,
        );
    }
    for (const tr of this.tracks) {
      const limit = tr.entered
        ? this.options.occupancyTimeout
        : this.options.activationWindow;
      if (t - tr.last > limit)
        this.fault(t, "Hết cửa sổ chờ chuỗi; chưa có bằng chứng luồng trống.");
    }
  }
  private rise(id: SensorId, t: number, input: number) {
    if (this.locked) {
      if (
        (id === "A1" && this.tracks.some((tr) => tr.direction === "BA")) ||
        (id === "B1" && this.tracks.some((tr) => tr.direction === "AB"))
      ) {
        this.warning = true;
        this.emit(
          t,
          "Tiếp cận đối hướng trong khi trạng thái chưa được xác minh.",
          input,
        );
      }
      return;
    }
    this.recent[id] = t;
    // A head pulse may be either an exit or new approach. Ordered inner evidence is required.
    // Infer a minimum inner-channel transit from the observed approach interval.
    // Configured ratio is relative sensor spacing, never a simulator ship position.
    // Factor 0.5 allows up to 2x speed after entry; inconsistent pulses become uncertain.
    const matches = this.tracks.filter(
      (tr) =>
        paths[tr.direction][tr.stage] === id &&
        (tr.stage !== 2 ||
          t - tr.last >= tr.approachDuration * this.options.channelRatio * 0.5),
    );
    const newDirection: Direction | null =
      id === "A1" ? "AB" : id === "B1" ? "BA" : null;
    if (matches.length > 0) {
      const tr = matches[0];
      // Never disambiguate overlapping reverse-direction tracks with hidden simulator identity.
      if (
        matches.length > 1 &&
        matches.some((m) => m.direction !== tr.direction)
      ) {
        this.fault(
          t,
          "Xung phù hợp nhiều chuỗi đối hướng; không thể gán tàu.",
          true,
        );
        return;
      }
      if (t - tr.last > this.options.activationWindow && tr.stage !== 2) {
        this.fault(t, "Chuỗi vượt cửa sổ thời gian hợp lệ.");
        return;
      }
      tr.stage++;
      tr.last = t;
      if (tr.stage === 2) {
        tr.approachDuration = t - tr.first;
        tr.entered = true;
        this.occupancy++;
      }
      if (tr.stage === 4) {
        this.occupancy = Math.max(0, this.occupancy - 1);
        if (tr.direction === "AB") this.completedAB++;
        else this.completedBA++;
        this.tracks.splice(this.tracks.indexOf(tr), 1);
        this.updateState();
        this.emit(
          t,
          "Chuỗi bốn cảm biến hợp lệ: hoàn tất lượt quan sát.",
          input,
          "passage",
          tr.direction,
        );
        return;
      }
      this.updateState();
      this.emit(
        t,
        `Chuỗi ${tr.direction}: bước ${tr.stage}/4.`,
        input,
        tr.stage === 2 ? "entry" : "state",
        tr.stage === 2 ? tr.direction : undefined,
      );
      return;
    }
    if (newDirection) {
      const opposite = this.tracks.some((tr) => tr.direction !== newDirection);
      if (opposite) {
        this.warning = true;
        this.state = "WARNING";
        this.emit(
          t,
          "Phát hiện tiếp cận đối hướng khi còn chuỗi chưa hoàn tất.",
          input,
        );
      }
      this.tracks.push({
        direction: newDirection,
        stage: 1,
        first: t,
        last: t,
        entered: false,
        approachDuration: 0,
      });
      this.updateState();
      this.emit(t, `Chờ cặp cảm biến xác nhận hướng ${newDirection}.`, input);
      return;
    }
    // A duplicate or inner edge without a valid predecessor cannot prove a passage.
    this.fault(
      t,
      `${id} không có tiền nhiệm hợp lệ; có thể mất xung, quay đầu hoặc nhiễu.`,
      true,
    );
  }
  private updateState() {
    if (this.locked) return;
    if (this.warning) {
      this.state = "WARNING";
      return;
    }
    if (this.tracks.length === 0) {
      this.state = "FREE";
      return;
    }
    const tr = this.tracks[0];
    this.state =
      this.occupancy > 0
        ? tr.direction === "AB"
          ? "OCCUPIED_AB"
          : "OCCUPIED_BA"
        : tr.direction === "AB"
          ? "PENDING_A"
          : "PENDING_B";
  }
}
