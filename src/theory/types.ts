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
