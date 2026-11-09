import { ShieldCheck, TriangleAlert, Focus, Anchor } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
export default function CollisionPanel() {
  const { engine, set } = useAppStore();
  const pair = engine.closestPair,
    last = engine.collisionHistory.at(-1);
  const severity = engine.collisionNow
    ? "collision"
    : pair && pair.distance < 2.5
      ? "near"
      : "clear";
  const grounding =
    engine.groundingAssessments.find((a) => a.status === "grounded") ??
    engine.groundingAssessments.find((a) => a.status === "risk");
  if (grounding && !engine.collisionNow)
    return (
      <section className="collision-inspector grounding">
        <div className="section-title">
          <Anchor size={18} />
          <h2>
            {grounding.status === "grounded"
              ? "Chạm đáy mô hình"
              : "Nguy cơ mắc cạn"}
          </h2>
          <span className="live-tag">TRỰC TIẾP</span>
        </div>
        <p className="contact-status">
          {grounding.shipId} · khoảng hở dưới đáy
        </p>
        <div className="clearance-reading">
          <strong>{grounding.clearance.toFixed(2)}</strong>
          <span>
            đv
            <small>
              {grounding.status === "grounded"
                ? "Thân tàu đã chạm đáy"
                : "Dư địa độ sâu thấp"}
            </small>
          </span>
        </div>
        <div className="grounding-measures">
          <span>
            Độ sâu <b>{grounding.depth.toFixed(1)} đv</b>
          </span>
          <span>
            Mớn nước <b>{grounding.draft.toFixed(1)} đv</b>
          </span>
        </div>
        <button
          className="grounding-focus"
          onClick={() => set({ selected: grounding.shipId })}
        >
          <Focus size={13} />
          Chọn tàu để chỉnh mớn nước
        </button>
        <div className="contact-meta">
          <span>{engine.groundingCount} lần chạm đáy</span>
          <span>Kéo tàu về vùng sâu hơn</span>
        </div>
      </section>
    );
  return (
    <section
      className={`collision-inspector ${severity}`}
      aria-label="Giám sát tiếp xúc thân tàu"
    >
      <div className="section-title">
        {engine.collisionNow ? (
          <TriangleAlert size={18} />
        ) : (
          <ShieldCheck size={18} />
        )}
        <h2>Tiếp xúc thân tàu</h2>
        <span className="live-tag">TRỰC TIẾP</span>
      </div>
      <p className="contact-status" data-testid="collision-status">
        {engine.collisionNow
          ? "Đã phát hiện va chạm"
          : severity === "near"
            ? "Hai thân tàu đang ở rất gần"
            : "Chưa có va chạm"}
      </p>
      <div className="clearance-reading">
        <strong data-testid="hull-distance">
          {pair ? pair.distance.toFixed(2) : "—"}
        </strong>
        <span>
          đv<small>khoảng hở nhỏ nhất</small>
        </span>
      </div>
      <div className="pair-label">
        {pair
          ? `${pair.shipIds[0]}  ↔  ${pair.shipIds[1]}`
          : "Thêm ít nhất hai tàu để theo dõi"}
      </div>
      {engine.contacts.map((c) => (
        <div key={c.key} className="contact-row">
          <button
            aria-label={`Chọn cặp va chạm ${c.shipIds.join(" và ")}`}
            onClick={() => set({ selected: c.shipIds[0] })}
          >
            <Focus size={14} />
            {c.shipIds.join(" ↔ ")}
          </button>
          <small>
            Tiếp xúc tại ({c.point.x.toFixed(1)}, {c.point.y.toFixed(1)})
          </small>
        </div>
      ))}
      <label className="pause-toggle">
        <input
          type="checkbox"
          checked={engine.pauseOnCollision}
          onChange={(e) => (engine.pauseOnCollision = e.target.checked)}
        />{" "}
        Tự tạm dừng khi va chạm
      </label>
      <div className="contact-meta">
        <span>{engine.collisionCount} lần tiếp xúc</span>
        <span>
          {engine.collisionNow
            ? "Kéo tàu để tách ra"
            : last
              ? "Lần tiếp xúc trước đã kết thúc"
              : "Chưa ghi nhận tiếp xúc"}
        </span>
      </div>
    </section>
  );
}
