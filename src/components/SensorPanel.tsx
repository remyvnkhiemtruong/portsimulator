import { useState } from "react";
import { Radio, Copy, Waves, Trash2 } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { SimulationEngine } from "../simulation/engine/SimulationEngine";
export default function SensorPanel() {
  const { engine, set, showSensorBeams, quality, view } = useAppStore();
  const [copyState, setCopyState] = useState("");
  const packet = engine.getSensorPacket();
  return (
    <section className="virtual-sensor-panel">
      <div className="section-title">
        <Radio size={17} />
        <h2>Cảm biến ESP32 ảo</h2>
        <span className="live-tag">MÔ PHỎNG</span>
      </div>
      <p>Tín hiệu được tính từ vị trí tàu và mặt nước.</p>
      <div className="sensor-strip">
        {engine.sensors.sensors.map((s) => (
          <div
            key={s.id}
            className={s.state ? "active" : ""}
            data-testid={`sensor-status-${s.id}`}
            data-active={s.state}
          >
            <i />
            <b>{s.id}</b>
            <small>{s.state ? "Có tàu · 1" : "Trống · 0"}</small>
          </div>
        ))}
      </div>
      <div className="range-readings">
        {engine.rangeSensors.map((s) => (
          <div key={s.id}>
            <span>
              {s.id} <small>tia đo khoảng cách</small>
            </span>
            <strong data-testid={`range-${s.id}`}>
              {s.value === null ? "—" : `${s.value.toFixed(2)} đv`}
            </strong>
            <small>
              {s.value === null
                ? "Không có vật trong tia đo"
                : "Đang nhận echo từ thân tàu"}
            </small>
          </div>
        ))}
      </div>
      <div className="depth-probes">
        <span>
          D_A <b>{packet.sensors.depthProbes.D_A.toFixed(1)}</b> đv
        </span>
        <span>
          D_B <b>{packet.sensors.depthProbes.D_B.toFixed(1)}</b> đv
        </span>
      </div>
      <label>
        Mực nước: {engine.waterLevel >= 0 ? "+" : ""}
        {engine.waterLevel.toFixed(1)} đv
        <input
          aria-label="Mực nước mô phỏng"
          type="range"
          min="-1"
          max="1.5"
          step=".1"
          value={engine.waterLevel}
          onChange={(e) => engine.setWaterLevel(Number(e.target.value))}
        />
      </label>
      <label className="pause-toggle">
        <input
          type="checkbox"
          checked={engine.pauseOnGrounding}
          onChange={(e) => (engine.pauseOnGrounding = e.target.checked)}
        />{" "}
        Tạm dừng khi tàu chạm đáy
      </label>
      <label className="pause-toggle">
        <input
          type="checkbox"
          checked={showSensorBeams}
          onChange={(e) => set({ showSensorBeams: e.target.checked })}
        />{" "}
        Hiện tia đo US_A / US_B
      </label>
      <details className="telemetry-details">
        <summary>Xem gói tín hiệu cho ESP32</summary>
        <p>
          Đơn vị giả định; không phải dữ liệu thiết bị thật. A1…B1 không đo được
          khoảng cách hoặc độ sâu.
        </p>
        <pre data-testid="virtual-esp32-packet">
          {JSON.stringify(packet, null, 2)}
        </pre>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                JSON.stringify(packet, null, 2),
              );
              setCopyState("Đã sao chép");
            } catch {
              setCopyState("Hãy chọn và sao chép phần JSON bên trên.");
            }
          }}
        >
          <Copy size={13} />
          {copyState || "Sao chép JSON"}
        </button>
      </details>
      {view !== "2d" && (
        <label>
          Đồ họa 3D
          <select
            aria-label="Chất lượng 3D"
            value={quality}
            onChange={(e) => set({ quality: e.target.value as "low" | "high" })}
          >
            <option value="high">Cao</option>
            <option value="low">Nhẹ</option>
          </select>
        </label>
      )}
      <button
        className="clear-button"
        onClick={() => {
          engine.pause();
          engine.endDrag();
          set({
            engine: new SimulationEngine("free"),
            selected: null,
            draggingShip: null,
          });
        }}
      >
        <Trash2 size={14} />
        Xóa tất cả tàu
      </button>
    </section>
  );
}
