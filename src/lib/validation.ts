/**
 * Zod validation schemas for admin API routes.
 * Prevents SQL injection by validating and typing all incoming request bodies.
 * Replaces ad-hoc field whitelists with strict schemas.
 */
import { z } from "zod";

// ─── Challenge update schema ────────────────────────────────────────────────
export const challengeUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(5000).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  type: z.enum(["multiple_choice", "code", "text", "ordering", "matching", "fill_blank"]).optional(),
  category: z.string().min(1).max(200).optional(),
  xpReward: z.number().int().min(0).max(1000).optional(),
  content: z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
  options: z.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  correctAnswer: z.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  explanation: z.string().max(5000).optional(),
  hints: z.union([z.string(), z.array(z.unknown())]).optional(),
  validationType: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
}).strict(); // Reject unknown keys

// ─── Knowledge space update schema ──────────────────────────────────────────
export const spaceUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(100).optional(),
  order: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
}).strict();

// ─── Glossary term update schema ────────────────────────────────────────────
export const glossaryUpdateSchema = z.object({
  term: z.string().min(1).max(300).optional(),
  definition: z.string().min(1).max(10000).optional(),
  shortDefinition: z.string().max(500).optional(),
  category: z.string().max(200).optional(),
  aliases: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  sourceArticleId: z.string().max(100).optional(),
  order: z.number().int().min(0).optional(),
  aiGenerated: z.boolean().optional(),
}).strict();

// ─── Article update schema ──────────────────────────────────────────────────
export const articleUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  summary: z.string().max(2000).optional(),
  spaceId: z.string().max(100).optional(),
  isPublished: z.boolean().optional(),
  // Sprint 6 fields
  videoUrl: z.string().url().max(1000).optional().or(z.literal("")),
  pdfUrl: z.string().url().max(1000).optional().or(z.literal("")),
  pptxUrl: z.string().url().max(1000).optional().or(z.literal("")),
  sourceUrl: z.string().url().max(1000).optional().or(z.literal("")),
  sourceType: z.enum(["youtube", "rutube", "vk", "yandex_disk", "video", "direct", "pdf", "pptx", "url", "manual"]).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  estimatedTime: z.union([z.string().max(50), z.number().int().min(1).max(999)]).optional(),
  status: z.enum(["pending", "processing", "done", "error"]).optional(),
  aiGenerated: z.boolean().optional(),
  errorMessage: z.string().max(2000).optional(),
  // JSON fields
  tags: z.array(z.string()).optional(),
  keyTopics: z.array(z.string()).optional(),
  keyConcepts: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  nextTopics: z.array(z.string()).optional(),
  // Sprint 7 JSONB fields
  quiz: z.record(z.string(), z.unknown()).optional().nullable(),
  practical_task: z.record(z.string(), z.unknown()).optional().nullable(),
  timecodes: z.array(z.unknown()).optional().nullable(),
}).strict();

// ─── Category update schema ─────────────────────────────────────────────────
export const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(100).optional(),
  order: z.number().int().min(0).optional(),
  parentId: z.string().max(100).optional().nullable(),
  spaceId: z.string().max(100).optional().nullable(),
}).strict();

// ─── Processing queue update schema ─────────────────────────────────────────
export const processUpdateSchema = z.object({
  status: z.enum(["pending", "processing", "done", "error"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  result: z.record(z.string(), z.unknown()).optional().nullable(),
  error: z.string().max(5000).optional().nullable(),
}).strict();

// ─── Helper: build SET clause from validated data ───────────────────────────
// This replaces the old ad-hoc field iteration with a type-safe approach.
// Column names come from the schema definition, NOT from user input.

type JsonFieldSet = Set<string>;

/**
 * Build parameterized SQL SET clause from validated data.
 * Returns { setClauses, values } ready for: UPDATE table SET ${setClauses} WHERE id = $N
 *
 * @param data - Validated data from Zod schema (already safe)
 * @param jsonFields - Set of field names that should be JSON.stringified
 * @returns { setClauses: string[], values: unknown[], nextParamIdx: number }
 */
export function buildSetClause(
  data: Record<string, unknown>,
  jsonFields: JsonFieldSet,
  startParamIdx: number = 1,
): { setClauses: string[]; values: unknown[]; nextParamIdx: number } {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = startParamIdx;

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    setClauses.push(`"${key}" = $${paramIdx}`);

    if (jsonFields.has(key)) {
      values.push(value === null ? null : JSON.stringify(value));
    } else {
      values.push(value);
    }
    paramIdx++;
  }

  return { setClauses, values, nextParamIdx: paramIdx };
}

// ─── JSON field sets for each table ─────────────────────────────────────────
export const CHALLENGE_JSON_FIELDS = new Set(["content", "options", "correctAnswer", "hints"]);
export const GLOSSARY_JSON_FIELDS = new Set(["aliases", "relatedTerms"]);
export const ARTICLE_JSON_FIELDS = new Set([
  "tags", "keyTopics", "keyConcepts", "prerequisites", "nextTopics",
  "quiz", "practical_task", "timecodes",
]);
export const CATEGORY_JSON_FIELDS = new Set<string>();
export const PROCESS_JSON_FIELDS = new Set(["result"]);
