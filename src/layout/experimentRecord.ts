export interface ExperimentRun {
  configuration: string;
  observation: string;
  capturedAt: string;
}

export interface ExperimentRecord {
  version: 1;
  prediction: string;
  configuration: string;
  observation: string;
  conclusion: string;
  answer: string;
  reviewed: string[];
  runs: ExperimentRun[];
}

export const emptyExperiment = (): ExperimentRecord => ({
  version: 1, prediction: "", configuration: "", observation: "", conclusion: "", answer: "", reviewed: [], runs: [],
});

const boundedText = (value: unknown) => typeof value === "string" ? value.slice(0, 12000) : "";

/** Local storage is untrusted and may contain an older or partially written record. */
export function parseExperiment(raw: string | null): ExperimentRecord {
  if (!raw) return emptyExperiment();
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || !("version" in saved) || saved.version !== 1) return emptyExperiment();
    const value = saved as Record<string, unknown>;
    return {
      version: 1,
      prediction: boundedText(value.prediction), configuration: boundedText(value.configuration),
      observation: boundedText(value.observation), conclusion: boundedText(value.conclusion), answer: boundedText(value.answer),
      reviewed: Array.isArray(value.reviewed) ? value.reviewed.filter((step): step is string => typeof step === "string").slice(0, 40).map(boundedText) : [],
      runs: Array.isArray(value.runs) ? value.runs.filter((run): run is Record<string, unknown> => !!run && typeof run === "object")
        .filter((run) => typeof run.configuration === "string" && typeof run.observation === "string" && typeof run.capturedAt === "string")
        .slice(-6).map((run) => ({ configuration: boundedText(run.configuration), observation: boundedText(run.observation), capturedAt: boundedText(run.capturedAt) })) : [],
    };
  } catch { return emptyExperiment(); }
}

export const experimentStorageKey = (route: string) => `studio.experiment.v1:${route}`;

export function experimentReport(title: string, route: string, record: ExperimentRecord, steps: string[], expected: string[], question?: string): string {
  return [
    `# ${title} — Experiment record`, `Lab: ${route}`, "User-recorded observations; this report is not an automated simulation certificate.",
    "## Prediction", record.prediction || "Not recorded", "## Configuration", record.configuration || "Not recorded",
    "## Guided steps", ...steps.map((step) => `- [${record.reviewed.includes(step) ? "x" : " "}] ${step}`),
    "## Expected behavior", ...expected.map((item) => `- ${item}`),
    "## Observation", record.observation || "Not recorded", "## Comparison runs",
    ...record.runs.flatMap((run, i) => [`### Run ${i + 1} · ${run.capturedAt}`, `Configuration: ${run.configuration}`, `Observation: ${run.observation}`]),
    "## Conclusion", record.conclusion || "Not recorded", "## Self-check", question || "Explain why the output follows from the configuration.", record.answer || "Not answered",
  ].join("\n\n");
}
