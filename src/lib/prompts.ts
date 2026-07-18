// Prompts and response schemas for the Gemini generation pipeline.
// The questions/distractors prompts are ported (with minor wording tweaks —
// this app has no separate process description, only the video itself) from
// the proven bloox TrainingQuestionAIFactoryGemini prompts. The docs prompt
// is new to this app.

import { Type, type Schema } from "@google/genai";

import { RESPONSE_LANGUAGE } from "./constants";

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

function withLanguageNote(prompt: string): string {
  return `${prompt}\n\nIMPORTANT: Respond in ${RESPONSE_LANGUAGE}.`;
}

// ---- Questions with correct answers ----

export function buildQuestionsPrompt(numberOfQuestions: number): PromptPair {
  const system =
    "You are an expert in operational processes and employee training assessment. " +
    "Your specialty is creating clear, specific questions that evaluate comprehension and execution of procedures.";

  const user =
    "Generate " +
    numberOfQuestions +
    " training questions with correct answers based on the provided process video.\n\n" +
    "CRITICAL - IDENTIFY THE TRUE PURPOSE:\n" +
    "Before generating questions, determine if the process is:\n" +
    '- INSTRUCTIONAL/REFERENCE: Teaching how to interpret, read, or understand something (e.g., "How to read labels", "Understanding safety symbols")\n' +
    '- ACTUAL PROCEDURE: Teaching how to execute a specific task (e.g., "Making chocolate cake", "Cleaning equipment")\n\n' +
    "For INSTRUCTIONAL content:\n" +
    "- Focus questions on the METHODOLOGY or INTERPRETATION SKILLS being taught\n" +
    '- DO NOT ask about specific examples shown (e.g., if showing a steak label as example, don\'t ask "What cut of meat was shown?")\n' +
    '- Ask about the PROCESS of reading/interpreting (e.g., "What information should you check first on a food label?")\n\n' +
    "For ACTUAL PROCEDURE content:\n" +
    "- Focus questions on specific steps, materials, techniques, and safety measures\n" +
    "- Ask about the actual execution of the task\n\n" +
    "GUIDELINES:\n" +
    "- Each question must focus on a specific, distinct aspect of the process\n" +
    "- Questions should be clear, concise, and unambiguous\n" +
    "- Base questions ONLY on the provided video content\n" +
    "- Avoid redundancy between questions\n" +
    "- Correct answers should be specific and directly verifiable from the content\n" +
    "- Provide a clear, pedagogical explanation for why the correct answer is correct\n" +
    "- Include the exact timestamp (in seconds) where this content appears in the video\n" +
    "- Use metric system for measurements (grams, liters, °C) unless the video specifies otherwise\n\n" +
    "TIMESTAMP AND CORRECT REASON FORMAT:\n" +
    "- Provide the timestamp in SECONDS (e.g., 45 for 0:45, 135 for 2:15, 90 for 1:30)\n" +
    "- The timestamp should point to where the content is mentioned in the video\n" +
    '- In the correctReason, start with a reference to the time (e.g., "At 2:15" or "At 0:45")\n' +
    "- Follow with a clear pedagogical explanation\n" +
    "- Example timestamp: 135 (for 2 minutes 15 seconds)\n" +
    '- Example correctReason: "At 2:15, the instructor demonstrates that preheating to 175°C ensures even baking and proper rise of the cake."\n\n' +
    "EXAMPLES:\n\n" +
    "Example 1 - INSTRUCTIONAL (Food Label Reading):\n" +
    "{\n" +
    '  "question": "What is the first section you should identify on a food label?",\n' +
    '  "correctAnswer": "The nutrition facts panel",\n' +
    '  "correctReason": "At 0:45, the video explains that the nutrition facts panel is the primary source of nutritional information and is legally required to be prominently displayed, making it the starting point for label reading.",\n' +
    '  "timestamp": 45\n' +
    "}\n" +
    'NOT: "What type of meat was shown in the example?" (this focuses on the example, not the skill)\n\n' +
    "Example 2 - ACTUAL PROCEDURE (Chocolate Cake):\n" +
    "{\n" +
    '  "question": "What temperature should the oven be preheated to?",\n' +
    '  "correctAnswer": "175°C",\n' +
    '  "correctReason": "At 2:15, the instructor specifies that preheating to 175°C ensures even baking and proper rise of the cake.",\n' +
    '  "timestamp": 135\n' +
    "}\n\n" +
    "Example 3 - INSTRUCTIONAL (Safety Symbols):\n" +
    "{\n" +
    '  "question": "How do you identify a high-risk hazard symbol?",\n' +
    '  "correctAnswer": "By the red color and triangle shape",\n' +
    '  "correctReason": "At 1:30, the training material shows that high-risk hazard symbols use red triangles as a universal warning indicator to ensure immediate visual recognition of dangerous situations.",\n' +
    '  "timestamp": 90\n' +
    "}\n" +
    'NOT: "What chemical was shown in the example sign?" (this focuses on the example, not the skill)\n\n' +
    "Example 4 - ACTUAL PROCEDURE (Equipment Cleaning):\n" +
    "{\n" +
    '  "question": "What is the first step before starting the cleaning procedure?",\n' +
    '  "correctAnswer": "Disconnect the equipment from the power source",\n' +
    '  "correctReason": "At 0:30, the safety protocol emphasizes that disconnecting power is essential for worker safety to prevent electrical shock or accidental equipment activation during cleaning.",\n' +
    '  "timestamp": 30\n' +
    "}";

  return { system, user: withLanguageNote(user) };
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
    "- Use metric system for measurements (grams, liters, °C) unless specified otherwise\n" +
    "- Ensure each false option is clearly distinguishable from the correct one\n\n" +
    "EXAMPLES:\n\n" +
    "Example 1:\n" +
    'Question: "What temperature should the oven be preheated to?"\n' +
    'Correct: "175°C"\n' +
    'Why correct: "At 02:15, the instructor specifies that preheating to 175°C ensures even baking and proper rise of the cake."\n' +
    'False options: ["150°C", "200°C", "225°C"]\n' +
    "Explanation: These are clearly different temperatures, not subtle variations like 170°C or 180°C which could be ambiguous.\n\n" +
    "Example 2:\n" +
    'Question: "How long should hands be washed with soap?"\n' +
    'Correct: "At least 20 seconds"\n' +
    'Why correct: "At 01:10, the hygiene protocol states that 20 seconds is the minimum time needed to effectively remove contaminants."\n' +
    'False options: ["At least 5 seconds", "At least 40 seconds", "At least 60 seconds"]\n' +
    "Explanation: Significantly different durations that are clearly wrong (too short or unnecessarily long), not close variations like 15 or 25 seconds.\n\n" +
    "Example 3:\n" +
    'Question: "What is the first step before cleaning equipment?"\n' +
    'Correct: "Disconnect from power source"\n' +
    'Why correct: "At 00:30, the safety protocol emphasizes that disconnecting power is essential for worker safety to prevent electrical shock."\n' +
    'False options: ["Apply cleaning solution", "Remove loose debris with a brush", "Drain all liquids from the system"]\n' +
    "Explanation: These are clearly different actions that come at other stages, not subtle variations of disconnecting power.";

  return { system, user: withLanguageNote(user) };
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

// ---- Documentation ----

export function buildDocsPrompt(): PromptPair {
  const system =
    "You are an expert technical writer and instructional designer. " +
    "Your specialty is turning procedural and instructional videos into thorough, well-organized reference documentation.";

  const user =
    "Generate thorough Markdown documentation of the provided video's content.\n\n" +
    "GUIDELINES:\n" +
    "- Start with a short Overview section summarizing the purpose and scope of the video.\n" +
    "- Break the rest of the content into clearly titled sections using Markdown headings (##).\n" +
    "- Reference where in the video each key point appears using a `[mm:ss]` timestamp marker.\n" +
    "- Where the video demonstrates a procedure, present it as a numbered step-by-step list, with each step carrying its own `[mm:ss]` timestamp.\n" +
    "- Capture specific, verifiable details: measurements, temperatures, durations, tools, materials, and any safety warnings mentioned.\n" +
    "- Use metric system for measurements (grams, liters, °C) unless the video specifies otherwise.\n" +
    "- Base the documentation ONLY on what is shown or said in the video — do not invent content that is not present.\n" +
    "- Use proper Markdown formatting (headings, bullet lists, numbered lists, bold for key terms) so the output renders cleanly.\n\n" +
    "Respond with the documentation content only, as a single Markdown string.";

  return { system, user: withLanguageNote(user) };
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
