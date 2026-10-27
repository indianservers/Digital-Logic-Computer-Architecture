export interface Chapter {
  id: string;
  title: string;
  keywords: string;
  paragraphs: string[];
  equation: string;
  example: string[];
  pitfalls: string[];
  question: string;
  answer: string;
  references: string[];
}
export interface TheoryArticle {
  id: string;
  title: string;
  studio: string;
  studioTitle: string;
  route: string;
  introduction: string;
  concepts: string[];
  guide: string[];
  takeaways: string[];
  chapterIds: string[];
  details?: Array<{title:string; body:string}>;
  questions?: Array<{question:string; answer:string}>;
}

export interface LessonDiagram {
  title: string;
  variant?: "hamming" | "kmap" | "pipeline";
  nodes: Array<{ label: string; detail: string }>;
  note: string;
}
export interface LessonTopic {
  id: string;
  match: RegExp;
  concepts: Array<[string,string]>;
  flow: string[];
  example: string[];
  question: string;
  answer: string;
}
