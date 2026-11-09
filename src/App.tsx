import { lazy, Suspense, useState, useRef, useEffect } from "react";
import {
  Anchor,
  ArrowLeftRight,
  Hand,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Ship as ShipIcon,
  Trash2,
  Waves,
  ScanLine,
  Route,
  Ruler,
  TriangleAlert,
  ArrowUpRight,
  Radio,
} from "lucide-react";
import {
  useAppStore,
  createCollisionDemo,
  createGroundingDemo,
} from "./stores/useAppStore";
import CollisionPanel from "./components/CollisionPanel";
import SensorPanel from "./components/SensorPanel";
import { useRefresh, useSimulationLoop } from "./hooks/useEngine";
import Harbor2D from "./visualization/2d/Harbor2D";
import { SimulationEngine } from "./simulation/engine/SimulationEngine";
import type { ShipType } from "./types";
const Harbor3D = lazy(() => import("./visualization/3d/Harbor3D"));
const shipNames: Record<ShipType, string> = {
  fishing: "Tàu cá",
  cargo: "Tàu hàng",
  transport: "Tàu vận tải",
};
export default function App() {
  useSimulationLoop();
  useRefresh(100);
  const {
    engine,
    view,
    selected,
    set,
    reset,
    showHulls,
    showTrails,
    showDistances,
    showDepths,
  } = useAppStore();
  const [type, setType] = useState<ShipType>("cargo");
  const ship = engine.ships.find(
    (s) => s.id === selected && s.status !== "completed",
  );
  const active = engine.ships.filter((s) => s.status !== "completed");
  const clock = `${String(Math.floor(engine.time / 60)).padStart(2, "0")}:${(engine.time % 60).toFixed(1).padStart(4, "0")}`;
  const occupied = active.some((s) => Math.abs(s.x) <= 30 + s.length / 2);
  const selectedDepth = engine.groundingAssessments.find(
    (a) => a.shipId === selected,
  );
  const inspector = useRef<HTMLElement>(null);
  function reveal(selector: string) {
    const pane = inspector.current,
      target = pane?.querySelector<HTMLElement>(selector);
    if (pane && target)
      pane.scrollTop +=
        target.getBoundingClientRect().top -
        pane.getBoundingClientRect().top -
        46;
  }
  useEffect(() => {
    if (selected) reveal(".selected-ship");
    else if (inspector.current) inspector.current.scrollTop = 0;
  }, [selected, engine]);
  function loadScenario(id: string) {
    engine.pause();
    engine.endDrag();
    const next =
      id === "collision-demo"
        ? createCollisionDemo()
        : id === "grounding-demo"
          ? createGroundingDemo()
          : new SimulationEngine(id);
    next.pauseOnCollision = engine.pauseOnCollision;
    next.pauseOnGrounding = engine.pauseOnGrounding;
    next.setWaterLevel(engine.waterLevel);
    set({ engine: next, selected: null, draggingShip: null });
    next.start();
  }
  function add(direction: "AB" | "BA") {
    const s = engine.spawn(direction, type);
    engine.refreshManualState();
    set({ selected: s.id });
  }
  return (
    <div className="sim-app">
      <header className="sim-header">
        <div className="sim-brand">
          <span>
            <Anchor size={24} />
          </span>
          <div>
            <strong>Port Traffic</strong>
            <small>Không gian mô phỏng tương tác</small>
          </div>
        </div>
        <div className="view-tabs" aria-label="Chế độ hiển thị">
          {(["2d", "3d", "split"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => set({ view: v })}
            >
              {v === "split" ? "Chia đôi" : v.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="sim-clock">
          <i className={engine.running ? "running" : ""} />
          <span>{engine.running ? "Đang chạy" : "Tạm dừng"}</span>
          <b data-testid="simulation-clock">{clock}</b>
        </div>
      </header>
      <div className="playground-layout">
        <main className="scene-workspace">
          <div className="scene-heading">
            <div>
              <span className="eyebrow">CẢNG MÔ PHỎNG</span>
              <h1>Thử điều khiển luồng tàu</h1>
            </div>
            <span
              className={`scene-state ${engine.collisionNow ? "danger" : engine.groundingRisk ? "grounding" : engine.conflictNow ? "caution" : occupied ? "busy" : ""}`}
              data-testid="channel-state"
            >
              <i />
              {engine.collisionNow
                ? "Phát hiện va chạm"
                : engine.groundingNow
                  ? "Tàu chạm đáy mô hình"
                  : engine.groundingRisk
                    ? "Nguy cơ mắc cạn"
                    : engine.conflictNow
                      ? "Hai tàu ngược chiều trong luồng"
                      : occupied
                        ? "Có tàu trong luồng"
                        : "Luồng trống"}
            </span>
          </div>
          <div className="scene-summary">
            <span>
              <ShipIcon size={14} />
              <b>{active.length}</b> tàu trong mô hình
            </span>
            <span>
              <Ruler size={14} />
              Khoảng hở gần nhất{" "}
              <b>
                {engine.closestPair
                  ? `${engine.closestPair.distance.toFixed(2)} đv`
                  : "—"}
              </b>
            </span>
            <span className={engine.collisionNow ? "summary-danger" : ""}>
              <ScanLine size={14} />
              {engine.collisionNow
                ? `${engine.contacts.length} cặp đang tiếp xúc`
                : "Phát hiện theo đường bao thân tàu"}
            </span>
          </div>
          <div className={`scene-stage ${view === "split" ? "split" : ""}`}>
            {view !== "3d" && <Harbor2D />}
            {view !== "2d" && (
              <Suspense
                fallback={<div className="empty">Đang tải mô hình 3D…</div>}
              >
                <Harbor3D />
              </Suspense>
            )}
            <div className="scene-layers" aria-label="Lớp hiển thị">
              <button
                title="Đường bao thân tàu"
                aria-label="Hiện đường bao thân tàu"
                aria-pressed={showHulls}
                onClick={() => set({ showHulls: !showHulls })}
              >
                <ScanLine size={14} />
                <span>Thân tàu</span>
              </button>
              <button
                title="Vệt di chuyển"
                aria-label="Hiện vệt di chuyển"
                aria-pressed={showTrails}
                onClick={() => set({ showTrails: !showTrails })}
              >
                <Route size={14} />
                <span>Vệt tàu</span>
              </button>
              <button
                title="Khoảng cách mép thân tàu"
                aria-label="Hiện khoảng hở"
                aria-pressed={showDistances}
                onClick={() => set({ showDistances: !showDistances })}
              >
                <Ruler size={14} />
                <span>Khoảng hở</span>
              </button>
              <button
                aria-label="Hiện vùng nước nông"
                aria-pressed={showDepths}
                onClick={() => set({ showDepths: !showDepths })}
              >
                <Waves size={14} />
                <span>Độ sâu</span>
              </button>
            </div>
            {engine.collisionNow ? (
              <div
                className="scene-alert"
                role="alert"
                data-testid="collision-alert"
              >
                <div className="alert-symbol">
                  <TriangleAlert size={24} />
                </div>
                <div>
                  <strong>VA CHẠM THÂN TÀU</strong>
                  <p>
                    {engine.contacts[0].shipIds.join(" ↔ ")} ·{" "}
                    {engine.running
                      ? "Mô phỏng tiếp tục"
                      : "Mô phỏng đã tạm dừng"}
                  </p>
                  <small>Kéo hai tàu tách ra để kết thúc tiếp xúc.</small>
                </div>
              </div>
            ) : engine.groundingNow ? (
              <div
                className="scene-alert grounding"
                role="alert"
                data-testid="grounding-alert"
              >
                <div className="alert-symbol">
                  <Anchor size={24} />
                </div>
                <div>
                  <strong>TÀU CHẠM ĐÁY MÔ HÌNH</strong>
                  <p>
                    {engine.groundingAssessments
                      .filter((a) => a.status === "grounded")
                      .map((a) => a.shipId)
                      .join(" / ")}{" "}
                    · Mớn nước lớn hơn hoặc bằng độ sâu
                  </p>
                  <small>
                    Kéo tàu về vùng sâu hơn hoặc điều chỉnh mực nước.
                  </small>
                </div>
              </div>
            ) : engine.groundingRisk ? (
              <div className="scene-caution" data-testid="grounding-risk">
                <Anchor size={17} />
                <span>
                  Nguy cơ mắc cạn <b>· khoảng hở dưới đáy ≤ 0,6 đv</b>
                </span>
              </div>
            ) : engine.conflictNow ? (
              <div className="scene-caution">
                <TriangleAlert size={17} />
                <span>
                  Tàu đối hướng trong luồng <b>· chưa chạm thân tàu</b>
                </span>
              </div>
            ) : (
              <div className="scene-caption">
                <span className="caption-line" />
                Luồng A → B · Kéo thả tàu để thử tình huống
              </div>
            )}
          </div>
          <div className="interaction-hint">
            <Hand size={16} />
            <span>
              <b>Giữ chuột trên tàu rồi kéo</b> để thay đổi vị trí. Kéo vùng
              nước để di chuyển góc nhìn.
            </span>
          </div>
          <div className="playback-bar">
            <div className="playback-left">
              <button
                className="primary"
                onClick={() =>
                  engine.running ? engine.pause() : engine.start()
                }
              >
                {engine.running ? <Pause size={17} /> : <Play size={17} />}{" "}
                {engine.running ? "Tạm dừng" : "Chạy mô phỏng"}
              </button>
              <button
                aria-label="Đặt lại mô phỏng"
                title="Đặt lại"
                onClick={reset}
              >
                <RotateCcw size={17} />
              </button>
            </div>
            <label>
              Tốc độ{" "}
              <select
                aria-label="Hệ số thời gian"
                value={engine.multiplier}
                onChange={(e) => (engine.multiplier = Number(e.target.value))}
              >
                {[0.5, 1, 2, 4].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </label>
            <span className="ship-count">
              <ShipIcon size={15} />
              {active.length} tàu
            </span>
          </div>
        </main>
        <aside className="controls-panel" ref={inspector}>
          <div className="inspector-nav">
            <button onClick={() => reveal('[data-section="create"]')}>
              <Plus size={13} />
              Tạo tàu
            </button>
            <button disabled={!ship} onClick={() => reveal(".selected-ship")}>
              <ShipIcon size={13} />
              Tàu chọn
            </button>
            <button
              onClick={() => reveal(".virtual-sensor-panel")}
              aria-label="Mở cảm biến ESP32 ảo"
            >
              <Radio size={13} />
              ESP32
            </button>
          </div>
          <CollisionPanel />
          <section data-section="create">
            <div className="section-title">
              <Waves size={17} />
              <h2>Tạo tình huống</h2>
            </div>
            <p>Thêm tàu và kéo đến vị trí bạn muốn.</p>
            <button
              className="collision-demo"
              onClick={() => loadScenario("collision-demo")}
            >
              <TriangleAlert size={16} />
              <span>Thử tình huống va chạm</span>
              <ArrowUpRight size={15} />
            </button>
            <button
              className="grounding-demo"
              onClick={() => loadScenario("grounding-demo")}
            >
              <Anchor size={16} />
              <span>Thử nguy cơ mắc cạn</span>
              <ArrowUpRight size={15} />
            </button>
            <label>
              Loại tàu
              <select
                aria-label="Loại tàu thêm mới"
                value={type}
                onChange={(e) => setType(e.target.value as ShipType)}
              >
                {Object.entries(shipNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="spawn-buttons">
              <button onClick={() => add("AB")}>
                <Plus size={15} /> Từ A → B
              </button>
              <button onClick={() => add("BA")}>
                <Plus size={15} /> Từ B → A
              </button>
            </div>
            <label>
              Kịch bản nhanh
              <select
                aria-label="Kịch bản nhanh"
                value=""
                onChange={(e) => {
                  if (e.target.value) loadScenario(e.target.value);
                }}
              >
                <option value="" disabled>
                  Chọn một tình huống…
                </option>
                <option value="normal-ab">Một tàu A → B</option>
                <option value="normal-ba">Một tàu B → A</option>
                <option value="conflict">Hai tàu ngược chiều</option>
                <option value="convoy">Hai tàu cùng chiều</option>
                <option value="collision-demo">
                  Hai tàu va chạm trực diện
                </option>
                <option value="grounding-demo">Tàu đi vào bãi nông</option>
              </select>
            </label>
          </section>
          <section className="selected-ship">
            <div className="section-title">
              <ShipIcon size={17} />
              <h2>{ship ? ship.id : "Tàu đang chọn"}</h2>
            </div>
            {ship ? (
              <>
                <div className="selected-type">
                  {shipNames[ship.type]}
                  <span>{ship.direction === "AB" ? "A → B" : "B → A"}</span>
                </div>
                <div className="coordinate-pair">
                  <div>
                    <span>Vị trí X</span>
                    <strong data-testid="selected-x">
                      {ship.x.toFixed(1)}
                    </strong>
                  </div>
                  <div>
                    <span>Vị trí Y</span>
                    <strong data-testid="selected-y">
                      {ship.y.toFixed(1)}
                    </strong>
                  </div>
                </div>
                <label>
                  Vận tốc: {ship.speed.toFixed(1)} đv/s
                  <input
                    aria-label="Vận tốc tàu"
                    type="range"
                    min="0"
                    max="8"
                    step="0.5"
                    value={ship.speed}
                    onChange={(e) => (ship.speed = Number(e.target.value))}
                  />
                </label>
                <label>
                  Mớn nước: {(ship.draft ?? 1.8).toFixed(1)} đv
                  <input
                    aria-label="Mớn nước tàu"
                    type="range"
                    min=".4"
                    max="3.2"
                    step=".1"
                    value={ship.draft ?? 1.8}
                    onChange={(e) => {
                      ship.draft = Number(e.target.value);
                      engine.refreshManualState();
                    }}
                  />
                </label>
                {selectedDepth && (
                  <div
                    className={`underkeel-card ${selectedDepth.status}`}
                    data-testid="underkeel-card"
                  >
                    <span>
                      Độ sâu dưới thân (mô hình){" "}
                      <b>{selectedDepth.depth.toFixed(1)} đv</b>
                    </span>
                    <span>
                      Khoảng hở dưới đáy{" "}
                      <strong>{selectedDepth.clearance.toFixed(2)} đv</strong>
                    </span>
                    <small>
                      {selectedDepth.status === "grounded"
                        ? "Đã chạm đáy"
                        : selectedDepth.status === "risk"
                          ? "Dư địa dưới đáy thấp"
                          : "Đủ độ sâu trong mô hình"}
                    </small>
                  </div>
                )}
                <div className="ship-actions">
                  <button
                    onClick={() => {
                      ship.direction = ship.direction === "AB" ? "BA" : "AB";
                      engine.refreshManualState();
                    }}
                  >
                    <ArrowLeftRight size={14} /> Đổi hướng
                  </button>
                  <button
                    aria-label="Xóa tàu đang chọn"
                    onClick={() => {
                      engine.remove(ship.id);
                      set({ selected: null });
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </>
            ) : (
              <div className="selection-empty">
                <Hand size={25} />
                <p>Nhấp hoặc kéo một tàu để chọn và điều chỉnh.</p>
              </div>
            )}
          </section>
          <SensorPanel />
        </aside>
      </div>
      <footer>
        Chỉ là mô phỏng tương tác · Không dùng điều khiển giao thông hàng hải
        thực tế.
      </footer>
    </div>
  );
}
