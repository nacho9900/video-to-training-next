// Prompts and response schemas for the Gemini generation pipeline.
// The two-step question strategy (questions with correct answers, then
// distractors) is adapted from the proven bloox flow, but the prompts here are
// domain-agnostic: they work for any explainer video — a software tutorial, a
// science lesson, a finance explainer, a cooking demo — not just operational
// procedures.

import { Type, type Schema } from "@google/genai";

export interface PromptPair {
  system: string;
  user: string;
}

export interface QuestionCoreAI {
  question: string;
  correctAnswer: string;
  correctReason: string;
  timestamp: number;
}

export interface QuestionsAIResponse {
  questions: QuestionCoreAI[];
}

export interface DistractorsAIResponse {
  falseOptions: string[];
}

export interface DocsAIResponse {
  documentation: string;
}

export interface TitleAIResponse {
  title: string;
}

function withLanguageNote(prompt: string, language: string): string {
  return `${prompt}\n\nIMPORTANT: Respond in ${language}.`;
}

// ---- Questions with correct answers ----

export function buildQuestionsPrompt(
  numberOfQuestions: number,
  language: string,
): PromptPair {
  const system =
    "You are an expert instructional designer and assessment writer. " +
    "You create clear, specific multiple-choice questions that test genuine understanding of what a video teaches — on any subject, from simple explanations to complex technical topics.";

  const user =
    "Generate " +
    numberOfQuestions +
    " questions with correct answers based ONLY on the provided video.\n\n" +
    "CRITICAL - IDENTIFY THE TRUE PURPOSE:\n" +
    "Before writing questions, determine what the video is really teaching:\n" +
    '- CONCEPTUAL/INSTRUCTIONAL: explaining how to understand, interpret, or reason about something (e.g., "How compound interest works", "How to read a chart").\n' +
    '- PROCEDURAL/HOW-TO: demonstrating how to carry out a specific task step by step (e.g., "How to deploy an app", "How to solve this equation").\n\n' +
    "For CONCEPTUAL/INSTRUCTIONAL content:\n" +
    "- Focus on the ideas, principles, and reasoning being taught.\n" +
    "- DO NOT ask about incidental examples used only to illustrate a point (e.g., if a specific chart is shown as an example, don't ask about that chart's exact numbers).\n" +
    '- Ask about the underlying concept or method (e.g., "What does a steeper slope on this kind of chart indicate?").\n\n' +
    "For PROCEDURAL/HOW-TO content:\n" +
    "- Focus on the specific steps, their order, the tools or inputs used, and common pitfalls.\n" +
    "- Ask about how the task is actually performed.\n\n" +
    "GUIDELINES:\n" +
    "- Each question must cover a distinct, specific point from the video.\n" +
    "- Questions must be clear, concise, and unambiguous.\n" +
    "- Base questions ONLY on what is shown or said in the video.\n" +
    "- Avoid redundancy between questions.\n" +
    "- Correct answers must be specific and directly verifiable from the video.\n" +
    "- Provide a clear, pedagogical explanation of why the correct answer is correct.\n" +
    "- Include the exact timestamp (in seconds) where the relevant content appears.\n" +
    "- Preserve any units, terms, or notation exactly as used in the video.\n\n" +
    "TIMESTAMP AND CORRECT REASON FORMAT:\n" +
    "- Provide the timestamp in SECONDS (e.g., 45 for 0:45, 135 for 2:15, 90 for 1:30).\n" +
    "- The timestamp should point to where the content appears in the video.\n" +
    '- In the correctReason, start with a reference to the time (e.g., "At 2:15" or "At 0:45").\n' +
    "- Follow with a clear pedagogical explanation.\n" +
    "- Example timestamp: 135 (for 2 minutes 15 seconds).\n" +
    '- Example correctReason: "At 1:20, the video shows that each period\'s interest is added to the balance, so future interest is calculated on a larger amount."\n\n' +
    "EXAMPLES (across different kinds of videos):\n\n" +
    "Example 1 - CONCEPTUAL (finance explainer):\n" +
    "{\n" +
    '  "question": "Why does compound interest grow faster over time than simple interest?",\n' +
    '  "correctAnswer": "Because interest is earned on previously accumulated interest, not just the original principal",\n' +
    '  "correctReason": "At 1:20, the video shows that each period\'s interest is added to the balance, so future interest is calculated on a larger amount.",\n' +
    '  "timestamp": 80\n' +
    "}\n" +
    'NOT: "What starting amount was used in the example?" (focuses on the illustrative example, not the concept)\n\n' +
    "Example 2 - PROCEDURAL (software tutorial):\n" +
    "{\n" +
    '  "question": "Which command creates a new branch and switches to it in one step?",\n' +
    '  "correctAnswer": "git checkout -b <branch-name>",\n' +
    '  "correctReason": "At 3:05, the presenter runs `git checkout -b feature` to create the branch and switch to it at once.",\n' +
    '  "timestamp": 185\n' +
    "}\n\n" +
    "Example 3 - CONCEPTUAL (science lesson):\n" +
    "{\n" +
    '  "question": "What is the main role of chlorophyll in photosynthesis?",\n' +
    '  "correctAnswer": "Absorbing light energy to drive the reaction",\n' +
    '  "correctReason": "At 0:50, the narrator explains that chlorophyll captures light energy, which powers the conversion of CO2 and water into glucose.",\n' +
    '  "timestamp": 50\n' +
    "}\n" +
    'NOT: "What color was the leaf in the diagram?" (focuses on an incidental detail, not the concept)\n\n' +
    "Example 4 - PROCEDURAL (cooking demo):\n" +
    "{\n" +
    '  "question": "What should you do to the pan before adding the eggs?",\n' +
    '  "correctAnswer": "Heat it and coat it with a thin layer of butter",\n' +
    '  "correctReason": "At 2:15, the cook heats the pan and adds butter so the eggs do not stick.",\n' +
    '  "timestamp": 135\n' +
    "}";

  return { system, user: withLanguageNote(user, language) };
}

export const questionsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          correctAnswer: { type: Type.STRING },
          correctReason: { type: Type.STRING },
          timestamp: { type: Type.NUMBER },
        },
        required: ["question", "correctAnswer", "correctReason", "timestamp"],
      },
    },
  },
  required: ["questions"],
};

// ---- False options / distractors ----

export function buildDistractorsPrompt(
  question: string,
  correctAnswer: string,
  correctReason: string,
  n: number,
  language: string,
): PromptPair {
  const system =
    "You are an expert in creating effective multiple-choice assessment questions. " +
    "Your specialty is generating clearly incorrect but plausible distractors that test real understanding without creating ambiguity.";

  const user =
    "Generate " +
    n +
    " clearly incorrect but plausible options for this question.\n\n" +
    "Question: " +
    question +
    "\n" +
    "Correct answer: " +
    correctAnswer +
    "\n" +
    "Why this is correct: " +
    correctReason +
    "\n\n" +
    "CRITICAL - AVOID AMBIGUITY:\n" +
    "- Each false option must be CLEARLY WRONG and DISTINCTLY DIFFERENT from the correct answer\n" +
    '- Do NOT create options that could be interpreted as "also correct" or "partially correct"\n' +
    "- Avoid vague or subjective options that might be debatable\n" +
    "- For numerical values: use significantly different numbers (not just small variations)\n" +
    "- For procedures: use clearly different actions or wrong sequences\n" +
    "- For definitions: use notably different concepts, not subtle variations\n\n" +
    "GUIDELINES:\n" +
    "- False options must be believable enough to test understanding\n" +
    "- Avoid obviously absurd or unrelated answers\n" +
    "- Use common misconceptions or typical mistakes\n" +
    "- Maintain similar length and structure to the correct answer\n" +
    "- Consider the context and reasoning provided for the correct answer\n" +
    "- Preserve any units, terms, or notation exactly as used in the correct answer\n" +
    "- Ensure each false option is clearly distinguishable from the correct one\n\n" +
    "EXAMPLES (across different kinds of videos):\n\n" +
    "Example 1 (a numeric value):\n" +
    'Question: "According to the video, what is the minimum recommended password length?"\n' +
    'Correct: "12 characters"\n' +
    'Why correct: "At 1:40, the presenter recommends at least 12 characters for a strong password."\n' +
    'False options: ["4 characters", "6 characters", "8 characters"]\n' +
    "Explanation: Clearly different values that are wrong relative to the stated minimum, not close variations like 11 or 13.\n\n" +
    "Example 2 (a software command):\n" +
    'Question: "Which command creates a new branch and switches to it?"\n' +
    'Correct: "git checkout -b feature"\n' +
    'Why correct: "At 3:05, the presenter uses git checkout -b to create and switch in one step."\n' +
    'False options: ["git branch -d feature", "git merge feature", "git clone feature"]\n' +
    "Explanation: Real Git commands that do clearly different things (delete, merge, clone), so none is 'also correct'.\n\n" +
    "Example 3 (a concept):\n" +
    'Question: "What is the main role of chlorophyll in photosynthesis?"\n' +
    'Correct: "Absorbing light energy"\n' +
    'Why correct: "At 0:50, the narrator explains chlorophyll captures the light energy that powers the reaction."\n' +
    'False options: ["Releasing oxygen into the air", "Storing glucose in the leaf", "Transporting water from the roots"]\n' +
    "Explanation: Real parts of plant biology, but not chlorophyll's role — clearly different concepts, not subtle variations.";

  return { system, user: withLanguageNote(user, language) };
}

export const distractorsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    falseOptions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["falseOptions"],
};

// ---- Title ----

export function buildTitlePrompt(text: string, language: string): PromptPair {
  const system =
    "You write short, descriptive titles for training modules. " +
    "You capture the subject of the training in a few words.";

  const user =
    "Based on the training content below, write ONE concise, descriptive title.\n\n" +
    "RULES:\n" +
    "- 3 to 7 words, in Title Case.\n" +
    "- Describe the subject/skill the training covers.\n" +
    "- No quotes, no trailing punctuation, no the word 'Training' unless it fits naturally.\n\n" +
    "TRAINING CONTENT:\n" +
    text;

  return { system, user: withLanguageNote(user, language) };
}

export const titleResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
  },
  required: ["title"],
};

export function isTitleAIResponse(value: unknown): value is TitleAIResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.title === "string";
}

// ---- Documentation ----

export function buildDocsPrompt(language: string): PromptPair {
  const system =
    "You are an expert technical writer and instructional designer. " +
    "You turn explainer videos on any topic — tutorials, lessons, demos, walkthroughs — into thorough, well-organized reference documentation.";

  const user =
    "Generate thorough Markdown documentation of the provided video's content.\n\n" +
    "GUIDELINES:\n" +
    "- Start with a short Overview section summarizing the purpose and scope of the video.\n" +
    "- Break the rest of the content into clearly titled sections using Markdown headings (##).\n" +
    "- Reference where in the video each key point appears using a `[mm:ss]` timestamp marker.\n" +
    "- Where the video demonstrates a step-by-step process, present it as a numbered list, with each step carrying its own `[mm:ss]` timestamp.\n" +
    "- Capture specific, verifiable details: key facts, values, definitions, terms, examples, and any warnings or caveats mentioned.\n" +
    "- Preserve units, terms, and notation exactly as used in the video.\n" +
    "- Base the documentation ONLY on what is shown or said in the video — do not invent content that is not present.\n" +
    "- Use proper Markdown formatting (headings, bullet lists, numbered lists, bold for key terms) so the output renders cleanly.\n\n" +
    "Respond with the documentation content only, as a single Markdown string.";

  return { system, user: withLanguageNote(user, language) };
}

export const docsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    documentation: { type: Type.STRING },
  },
  required: ["documentation"],
};

// ---- Response validators (defensive narrowing of Gemini's JSON output) ----

export function isQuestionCoreAI(value: unknown): value is QuestionCoreAI {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const q = value as Record<string, unknown>;
  return (
    typeof q.question === "string" &&
    typeof q.correctAnswer === "string" &&
    typeof q.correctReason === "string" &&
    typeof q.timestamp === "number"
  );
}

export function isQuestionsAIResponse(
  value: unknown,
): value is QuestionsAIResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.questions) && obj.questions.every(isQuestionCoreAI);
}

export function isDistractorsAIResponse(
  value: unknown,
): value is DistractorsAIResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.falseOptions) &&
    obj.falseOptions.every((option) => typeof option === "string")
  );
}

export function isDocsAIResponse(value: unknown): value is DocsAIResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.documentation === "string";
}

// ---- Shared helpers ----

/** Fisher-Yates shuffle; does not mutate the input array. */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
