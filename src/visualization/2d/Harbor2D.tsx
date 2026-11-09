import { useEffect, useRef, useState } from "react";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useRefresh } from "../../hooks/useEngine";
import { localHull, worldHull } from "../../simulation/geometry/hulls";
import { DEPTH_ZONES } from "../../simulation/environment/bathymetry";
export default function Harbor2D() {
  const engine = useAppStore((s) => s.engine),
    selected = useAppStore((s) => s.selected),
    set = useAppStore((s) => s.set),
    showHulls = useAppStore((s) => s.showHulls),
    showTrails = useAppStore((s) => s.showTrails),
    showDistances = useAppStore((s) => s.showDistances),
    showDepths = useAppStore((s) => s.showDepths),
    showSensorBeams = useAppStore((s) => s.showSensorBeams);
  useRefresh(50);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const svgRef = useRef<SVGSVGElement>(null),
    worldRef = useRef<SVGGElement>(null);
  const shipDrag = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const point = (clientX: number, clientY: number) => {
    const matrix = worldRef.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: (p.x - 550) / 8, y: (p.y - 250) / 8 };
  };
  const finishDrag = () => {
    drag.current = null;
    if (shipDrag.current) {
      shipDrag.current = null;
      engine.endDrag();
      set({ draggingShip: null });
    }
  };
  useEffect(() => {
    window.addEventListener("blur", finishDrag);
    return () => {
      window.removeEventListener("blur", finishDrag);
      if (shipDrag.current) {
        shipDrag.current = null;
        engine.endDrag();
        useAppStore.getState().set({ draggingShip: null });
      }
    };
  }, [engine]);
  const danger = engine.conflictNow;
  const ships = engine.ships.filter((s) => s.status !== "completed");
  return (
    <div className="map-container" data-testid="harbor-2d">
      <svg
        ref={svgRef}
        role="img"
        aria-label="Bản đồ cảng 2D"
        viewBox="0 0 1100 500"
        onWheel={(e) =>
          setZoom((z) => Math.max(0.65, Math.min(3, z - e.deltaY * 0.001)))
        }
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onPointerMove={(e) => {
          if (shipDrag.current) {
            const p = point(e.clientX, e.clientY);
            if (p)
              engine.moveShip(
                shipDrag.current.id,
                p.x + shipDrag.current.offsetX,
                p.y + shipDrag.current.offsetY,
              );
            return;
          }
          if (drag.current) {
            const scale = 1100 / e.currentTarget.clientWidth;
            setPan({
              x: drag.current.px + (e.clientX - drag.current.x) * scale,
              y: drag.current.py + (e.clientY - drag.current.y) * scale,
            });
          }
        }}
      >
        <defs>
          <pattern
            id="water-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M28 0H0V28"
              fill="none"
              stroke="#37728c"
              strokeOpacity=".11"
            />
          </pattern>
          <pattern
            id="land-grid"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 18L18 0" stroke="#67818a" strokeOpacity=".08" />
          </pattern>
          <linearGradient id="water-fill" x2="0" y2="1">
            <stop stopColor="#0c2c3c" />
            <stop offset="1" stopColor="#0b2333" />
          </linearGradient>
        </defs>
        <rect width="1100" height="500" fill="url(#water-fill)" />
        <rect width="1100" height="500" fill="url(#water-grid)" />
        <g
          ref={worldRef}
          transform={`translate(${550 + pan.x},${250 + pan.y}) scale(${zoom}) translate(-550,-250)`}
        >
          <path
            d="M0 0H1100V100H870L795 155H310L235 100H0ZM0 500H1100V400H870L795 345H310L235 400H0Z"
            fill="#1a2d38"
            stroke="#567078"
            strokeWidth="2"
          />
          <path
            d="M0 0H1100V100H870L795 155H310L235 100H0ZM0 500H1100V400H870L795 345H310L235 400H0Z"
            fill="url(#land-grid)"
          />
          <g fill="#263d48" stroke="#48606b">
            <rect x="373" y="85" width="140" height="65" rx="3" />
            <rect x="525" y="108" width="72" height="42" rx="2" />
            <rect x="645" y="349" width="140" height="55" rx="3" />
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={390 + i * 28}
                y="97"
                width="20"
                height="38"
                fill={i % 2 ? "#36585c" : "#3c4c5c"}
              />
            ))}
            <rect x="336" y="365" width="70" height="55" />
            <rect x="348" y="375" width="45" height="20" fill="#54818a" />
          </g>
          <text x="440" y="66" className="map-land-label">
            CẦU CẢNG 01
          </text>
          <text x="370" y="446" className="map-land-label">
            TRẠM ĐIỀU HÀNH
          </text>
          <rect
            x="310"
            y="180"
            width="480"
            height="140"
            rx="3"
            fill={
              engine.collisionNow
                ? "#ef5a6420"
                : danger
                  ? "#e7b26214"
                  : "#3bd3bd08"
            }
            stroke={
              engine.collisionNow ? "#f76872" : danger ? "#d3a864" : "#378a92"
            }
            strokeDasharray="6 6"
          />
          <path
            d="M80 250H1020"
            stroke="#53a6b0"
            strokeWidth="1"
            strokeOpacity=".4"
            strokeDasharray="10 9"
          />
          {[180, 550, 920].map((x) => (
            <g key={x} stroke="#67a4ad" fill="none" opacity=".5">
              <path
                d={`M${x - 22} 215h44l-8 -5m8 5l-8 5M${x + 22} 285h-44l8 -5m-8 5l8 5`}
              />
            </g>
          ))}
          <text x="550" y="177" className="map-small" textAnchor="middle">
            LUỒNG HẸP · VÙNG ĐÁNH GIÁ XUNG ĐỘT
          </text>
          {Array.from({ length: 9 }, (_, i) => [330 + i * 55, 170]).map(
            ([x, y], i) => (
              <g key={i}>
                {[y, 500 - y].map((yy, j) => (
                  <g key={j}>
                    <circle
                      cx={x}
                      cy={yy}
                      r="4"
                      fill={j ? "#f1ab59" : "#45d4aa"}
                    />
                    <circle
                      cx={x}
                      cy={yy}
                      r="8"
                      fill="none"
                      stroke={j ? "#f1ab59" : "#45d4aa"}
                      strokeOpacity=".17"
                    />
                  </g>
                ))}
              </g>
            ),
          )}
          {engine.sensors.sensors.map((s) => {
            const x = 550 + s.x * 8;
            return (
              <g
                key={s.id}
                data-testid={`sensor-${s.id}`}
                data-active={s.state}
              >
                <rect
                  x={x - 6}
                  y="195"
                  width="12"
                  height="110"
                  fill={s.state ? "#4ee1b82c" : "#4b9ba208"}
                />
                <path
                  d={`M${x} 183v134`}
                  stroke={s.state ? "#6debc8" : "#4c8590"}
                  strokeWidth={s.state ? 2 : 1}
                  strokeDasharray="4 4"
                />
                {s.state && (
                  <circle
                    className="sensor-pulse"
                    cx={x}
                    cy="185"
                    r="18"
                    fill="none"
                    stroke="#55ecc8"
                  />
                )}
                <rect
                  x={x - 17}
                  y="133"
                  width="34"
                  height="27"
                  rx="4"
                  fill={s.state ? "#194c43" : "#1c3543"}
                  stroke={s.state ? "#5bedc6" : "#638a98"}
                />
                <text
                  x={x}
                  y="151"
                  textAnchor="middle"
                  fill={s.state ? "#76f0cf" : "#b0cbd4"}
                  fontSize="13"
                  fontWeight="600"
                >
                  {s.id}
                </text>
                <circle
                  cx={x}
                  cy="185"
                  r="5"
                  fill={s.state ? "#66e7c1" : "#628c97"}
                />
                <text x={x} y="331" textAnchor="middle" className="map-small">
                  {s.x} đv
                </text>
              </g>
            );
          })}
          <g>
            <text x="60" y="174" className="map-end">
              A
            </text>
            <text x="60" y="198" className="map-small">
              ĐẦU VÀO PHÍA A
            </text>
            <text x="1035" y="174" textAnchor="end" className="map-end">
              B
            </text>
            <text x="1035" y="198" textAnchor="end" className="map-small">
              ĐẦU VÀO PHÍA B
            </text>
          </g>
          {[260, 840].map((x) => (
            <g key={x}>
              <rect
                x={x - 8}
                y="351"
                width="16"
                height="37"
                rx="6"
                fill="#0b1724"
                stroke="#4d6877"
              />
              <circle
                cx={x}
                cy="361"
                r="4"
                fill={
                  engine.collisionNow
                    ? "#ff6b77"
                    : danger
                      ? "#e8b96a"
                      : "#352a38"
                }
                className={danger ? "blink" : ""}
              />
              <circle
                cx={x}
                cy="378"
                r="4"
                fill={danger ? "#253c3c" : "#49d9ad"}
              />
            </g>
          ))}
          {showTrails &&
            ships.map((s) => {
              const trail = engine.trails.get(s.id);
              return trail && trail.length > 1 ? (
                <polyline
                  key={`trail-${s.id}`}
                  points={trail
                    .map((p) => `${550 + p.x * 8},${250 + p.y * 8}`)
                    .join(" ")}
                  fill="none"
                  stroke={s.direction === "AB" ? "#68dbce" : "#d6b176"}
                  strokeWidth="2"
                  strokeDasharray="4 5"
                  opacity=".38"
                  pointerEvents="none"
                />
              ) : null;
            })}
          {showDistances &&
            engine.closestPair &&
            engine.closestPair.distance > 0.001 &&
            (() => {
              const p = engine.closestPair!,
                a = { x: 550 + p.pointA.x * 8, y: 250 + p.pointA.y * 8 },
                b = { x: 550 + p.pointB.x * 8, y: 250 + p.pointB.y * 8 },
                x = (a.x + b.x) / 2,
                y = (a.y + b.y) / 2;
              return (
                <g className="gap-annotation" pointerEvents="none">
                  <path
                    d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                    stroke={p.distance < 2.5 ? "#efc177" : "#96c5d0"}
                    strokeDasharray="5 5"
                    strokeWidth="1.3"
                  />
                  <circle cx={a.x} cy={a.y} r="3" fill="#d0e5e9" />
                  <circle cx={b.x} cy={b.y} r="3" fill="#d0e5e9" />
                  <rect
                    x={x - 49}
                    y={y - 30}
                    width="98"
                    height="22"
                    rx="5"
                    fill="#112e3c"
                    stroke="#486d7a"
                  />
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fill="#cbe7e9"
                    fontSize="11"
                  >
                    {p.distance.toFixed(2)} đv · thân tàu
                  </text>
                </g>
              );
            })()}
          {showDepths &&
            DEPTH_ZONES.map((z) => (
              <g key={z.id} pointerEvents="none">
                <polygon
                  points={z.polygon
                    .map((p) => `${550 + p.x * 8},${250 + p.y * 8}`)
                    .join(" ")}
                  fill={z.depth < 2 ? "#c69c5140" : "#9ea87329"}
                  stroke="#dbc08268"
                  strokeDasharray="3 5"
                  strokeWidth="1"
                />
                <text
                  x={550 + z.label.x * 8}
                  y={250 + z.label.y * 8}
                  fill="#e5ce99"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {z.id === "shoal-west"
                    ? "D_A · "
                    : z.id === "shoal-east"
                      ? "D_B · "
                      : ""}
                  {Math.max(0, z.depth + engine.waterLevel).toFixed(1)} đv
                </text>
              </g>
            ))}
          {showSensorBeams &&
            engine.rangeSensors.map((s) => {
              const end = s.hit ?? {
                x: s.origin.x + s.direction.x * s.maxRange,
                y: s.origin.y + s.direction.y * s.maxRange,
              };
              return (
                <g key={s.id} pointerEvents="none">
                  <line
                    x1={550 + s.origin.x * 8}
                    y1={250 + s.origin.y * 8}
                    x2={550 + end.x * 8}
                    y2={250 + end.y * 8}
                    stroke={s.hit ? "#bcebc6" : "#54869a"}
                    strokeWidth={s.hit ? 2 : 1}
                    strokeDasharray="3 5"
                    opacity={s.hit ? 0.85 : 0.3}
                  />
                  <rect
                    x={550 + s.origin.x * 8 - 8}
                    y={250 + s.origin.y * 8 - 5}
                    width="16"
                    height="10"
                    rx="3"
                    fill={s.hit ? "#7ce5ae" : "#42768c"}
                  />
                  <text
                    x={550 + s.origin.x * 8 + (s.direction.y > 0 ? 18 : 0)}
                    y={250 + s.origin.y * 8 + (s.direction.y > 0 ? 14 : 21)}
                    textAnchor={s.direction.y > 0 ? "start" : "middle"}
                    fill="#9accc5"
                    fontSize="9"
                  >
                    {s.id}
                  </text>
                  {s.hit && (
                    <circle
                      cx={550 + s.hit.x * 8}
                      cy={250 + s.hit.y * 8}
                      r="4"
                      fill="#a5efc5"
                    />
                  )}
                </g>
              );
            })}
          {ships.map((s) => {
            const x = 550 + s.x * 8,
              y = 250 + s.y * 8;
            const colliding = engine.contacts.some((c) =>
              c.shipIds.includes(s.id),
            );
            const grounding = engine.groundingAssessments.find(
              (a) => a.shipId === s.id,
            );
            return (
              <g
                key={s.id}
                data-testid={`ship-${s.id}`}
                data-x={s.x.toFixed(4)}
                data-y={s.y.toFixed(4)}
                data-colliding={colliding}
                data-grounding={grounding?.status ?? "clear"}
                role="button"
                aria-label={`Chọn tàu ${s.id}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") set({ selected: s.id });
                  const delta: Record<string, [number, number]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  };
                  if (delta[e.key]) {
                    e.preventDefault();
                    set({ selected: s.id });
                    engine.moveShip(
                      s.id,
                      s.x + delta[e.key][0],
                      s.y + delta[e.key][1],
                    );
                  }
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  const p = point(e.clientX, e.clientY);
                  if (!p || !engine.beginDrag(s.id)) return;
                  shipDrag.current = {
                    id: s.id,
                    offsetX: s.x - p.x,
                    offsetY: s.y - p.y,
                  };
                  set({ selected: s.id, draggingShip: s.id });
                  svgRef.current?.setPointerCapture(e.pointerId);
                }}
                onClick={() => set({ selected: s.id })}
                className={`map-ship ${engine.draggingShipId === s.id ? "dragging" : ""}`}
              >
                {selected === s.id && (
                  <rect
                    x={x - s.length * 4 - 7}
                    y={y - 23}
                    width={s.length * 8 + 14}
                    height="46"
                    rx="9"
                    stroke="#a5f2e4"
                    fill="#54e0c310"
                    strokeDasharray="3 3"
                  />
                )}
                <g
                  transform={`translate(${x},${y}) rotate(${s.direction === "AB" ? 0 : 180})`}
                >
                  <path
                    d={`${localHull(s.length, s.width)
                      .map((p, i) => `${i ? "L" : "M"}${p.x * 8} ${p.y * 8}`)
                      .join(" ")}Z`}
                    fill={
                      colliding
                        ? "#e77577"
                        : grounding?.status === "grounded"
                          ? "#ebad58"
                          : s.type === "fishing"
                            ? "#d8a966"
                            : "#69bec8"
                    }
                    stroke={colliding ? "#ffb7bc" : "#a7e5e6"}
                    strokeWidth="1.4"
                  />
                  <rect
                    x={-s.length * 3}
                    y="-9"
                    width="14"
                    height="18"
                    rx="2"
                    fill="#e3e7d9"
                  />
                  <rect
                    x={-s.length * 3 + 3}
                    y="-6"
                    width="5"
                    height="12"
                    fill="#335669"
                  />
                  {s.type !== "fishing" &&
                    [0, 1].map((i) => (
                      <rect
                        key={i}
                        x={-2 + i * 13}
                        y="-8"
                        width="10"
                        height="16"
                        fill={i ? "#c49665" : "#4d8b94"}
                      />
                    ))}
                </g>
                {showHulls && (
                  <polygon
                    points={worldHull(s)
                      .map((p) => `${550 + p.x * 8},${250 + p.y * 8}`)
                      .join(" ")}
                    fill="none"
                    stroke={colliding ? "#ff9a91" : "#a5e8de"}
                    strokeWidth={colliding ? 3 : 1}
                    strokeDasharray={colliding ? undefined : "4 3"}
                    opacity={colliding ? 1 : 0.6}
                    pointerEvents="none"
                  />
                )}
                <text
                  x={x}
                  y={y - 32}
                  textAnchor="middle"
                  className="ship-label"
                >
                  {s.id}
                </text>
                <text
                  x={x}
                  y={y + 37}
                  textAnchor="middle"
                  className="map-small"
                >
                  {s.speed.toFixed(1)} đv/s{" "}
                  {s.status === "stopped" ? "· DỪNG" : ""}
                </text>
              </g>
            );
          })}
          {engine.contacts.map((c) => (
            <g
              key={c.key}
              transform={`translate(${550 + c.point.x * 8},${250 + c.point.y * 8})`}
              pointerEvents="none"
              data-testid="collision-marker-2d"
            >
              <circle
                className="contact-pulse"
                r="24"
                fill="#ff675518"
                stroke="#ff846c"
                strokeWidth="2"
              />
              <circle r="10" fill="#fa665d" stroke="#ffd8b5" strokeWidth="2" />
              <text
                y="5"
                textAnchor="middle"
                fontWeight="800"
                fill="#fff4d8"
                fontSize="15"
              >
                !
              </text>
            </g>
          ))}
          {engine.groundingAssessments
            .filter((a) => a.status !== "clear")
            .map((a) => (
              <g
                key={a.shipId}
                transform={`translate(${550 + a.point.x * 8},${250 + a.point.y * 8})`}
                pointerEvents="none"
                data-testid={`grounding-marker-${a.shipId}`}
              >
                <circle
                  r={a.status === "grounded" ? 18 : 13}
                  fill="#ffbc5522"
                  stroke="#f9c370"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
                <text
                  y="-24"
                  textAnchor="middle"
                  fill="#ffe1a8"
                  fontSize="11"
                  fontWeight="600"
                >
                  {a.status === "grounded" ? "CHẠM ĐÁY" : "CẢNH BÁO CẠN"}
                </text>
              </g>
            ))}
        </g>
        <g transform="translate(1045,42)" stroke="#91b0bd" fill="none">
          <path d="M0 21V-12l-5 9m5-9l5 9M-16 7h32" />
          <text
            y="-21"
            textAnchor="middle"
            stroke="none"
            fill="#91b0bd"
            fontSize="11"
          >
            BẮC
          </text>
        </g>
        <g transform="translate(30,466)">
          <path d="M0 0h80M0-4v8M80-4v8" stroke="#7796a5" />
          <text x="94" y="4" className="map-small">
            10 đơn vị mô phỏng
          </text>
        </g>
      </svg>
      <div className="map-toolbar">
        <button
          aria-label="Phóng to bản đồ"
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
        >
          <Plus size={16} />
        </button>
        <button
          aria-label="Thu nhỏ bản đồ"
          onClick={() => setZoom((z) => Math.max(0.65, z - 0.2))}
        >
          <Minus size={16} />
        </button>
        <button
          aria-label="Đặt lại camera 2D"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <LocateFixed size={16} />
        </button>
      </div>
      <div className="map-corner-label">2D / NHÌN TỪ TRÊN</div>
    </div>
  );
}
