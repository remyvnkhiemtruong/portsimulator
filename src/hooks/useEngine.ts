import { useEffect, useReducer } from "react";
import { useAppStore } from "../stores/useAppStore";
import { FIXED_DT } from "../simulation/engine/SimulationEngine";
export function useRefresh(ms = 200) {
  const [, update] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(update, ms);
    return () => clearInterval(id);
  }, [ms]);
}
export function useSimulationLoop() {
  const engine = useAppStore((s) => s.engine);
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      accumulator = 0;
    const loop = (now: number) => {
      const elapsed = Math.min((now - last) / 1000, 0.25);
      last = now;
      if (engine.running) {
        accumulator += elapsed * engine.multiplier;
        while (engine.running && accumulator >= FIXED_DT) {
          engine.step();
          accumulator -= FIXED_DT;
        }
        if (!engine.running) accumulator = 0;
      } else accumulator = 0;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine]);
}
