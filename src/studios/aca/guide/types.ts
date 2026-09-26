export interface GuideFormula {
  name: string;
  expression: string;
  note: string;
}

export interface GuideViva {
  question: string;
  answer: string;
}

export interface GuideCheck {
  prompt: string;
  choices: string[];
  answer: number;
  why: string;
}

export interface GuideExperiment {
  title: string;
  steps: string[];
}

export interface GuideLink {
  id: string;
  label: string;
}

export interface LabWalkthrough {
  howToUse: string[];
  observe: string[];
  experiments: GuideExperiment[];
  expected: string[];
  why: string[];
  challenge: string;
  check: string[];
  links: GuideLink[];
  checklist: [string, string, string, string];
}

export interface LabGuideContent {
  id: string;
  labNumber: number;
  title: string;
  aim: string;
  purpose: string;
  prerequisites: string[];
  learningObjectives: string[];
  theory: string[];
  keyTerms: Array<{ term: string; meaning: string }>;
  assumptions: string[];
  setup: string[];
  procedure: string[];
  controls: string[];
  observations: string[];
  formulas: GuideFormula[];
  expectedBehavior: string[];
  resultInterpretation: string[];
  misconceptions: string[];
  variations: string[];
  learningOutcomes: string[];
  viva: GuideViva[];
  selfCheck: GuideCheck[];
  summary: string;
  walkthrough?: LabWalkthrough;
}
