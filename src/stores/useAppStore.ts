import { create } from "zustand";
import { SimulationEngine } from "../simulation/engine/SimulationEngine";
export function createPlayground() {
  const engine = new SimulationEngine("free");
  const a = engine.spawn("AB", "cargo"),
    b = engine.spawn("BA", "fishing");
  engine.moveShip(a.id, -43, -2);
  engine.moveShip(b.id, 43, 2);
  engine.trails.clear();
  return engine;
}
export function createCollisionDemo() {
  const e = new SimulationEngine("free");
  const a = e.spawn("AB", "cargo", 3),
    b = e.spawn("BA", "cargo", 3);
  e.moveShip(a.id, -18, 0);
  e.moveShip(b.id, 18, 0);
  e.collisionHistory = [];
  e.collisionCount = 0;
  e.trails.clear();
  return e;
}
export function createGroundingDemo() {
  const e = new SimulationEngine("free");
  const s = e.spawn("AB", "cargo", 3);
  e.moveShip(s.id, -14, 3.4);
  e.trails.clear();
  return e;
}
interface AppState {
  engine: SimulationEngine;
  view: "2d" | "3d" | "split";
  selected: string | null;
  draggingShip: string | null;
  quality: "low" | "high";
  showHulls: boolean;
  showTrails: boolean;
  showDistances: boolean;
  showDepths: boolean;
  showSensorBeams: boolean;
  set: (patch: Partial<AppState>) => void;
  reset: () => void;
}
export const useAppStore = create<AppState>((set, get) => ({
  engine: createPlayground(),
  view: "2d",
  selected: null,
  draggingShip: null,
  quality: "high",
  showHulls: true,
  showTrails: true,
  showDistances: true,
  showDepths: true,
  showSensorBeams: true,
  set,
  reset: () => {
    get().engine.pause();
    get().engine.endDrag();
    set({ engine: createPlayground(), selected: null, draggingShip: null });
  },
}));
