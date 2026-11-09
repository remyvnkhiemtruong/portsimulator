import type { Evaluation, RunResult } from "../types";
// Evaluation unit: one complete scenario run -> one binary sample, for each algorithm.
export function evaluate(runs: RunResult[], algorithm: "A" | "B"): Evaluation {
  let TP = 0,
    FP = 0,
    TN = 0,
    FN = 0,
    correct = 0,
    samples = 0,
    latency = 0;
  for (const r of runs) {
    const prediction = algorithm === "A" ? r.warningA : r.warningB;
    if (r.truthConflict) {
      if (prediction) TP++;
      else FN++;
    } else {
      if (prediction) FP++;
      else TN++;
    }
    correct += algorithm === "A" ? r.directionCorrectA : r.directionCorrectB;
    samples += r.directionSamples;
    latency += algorithm === "A" ? r.latencyA : r.latencyB;
  }
  const ratio = (a: number, b: number) => (b ? a / b : null);
  return {
    TP,
    FP,
    TN,
    FN,
    precision: ratio(TP, TP + FP),
    recall: ratio(TP, TP + FN),
    f1: ratio(2 * TP, 2 * TP + FP + FN),
    fpr: ratio(FP, FP + TN),
    directionAccuracy: ratio(correct, samples),
    latency: runs.length ? latency / runs.length : null,
  };
}
