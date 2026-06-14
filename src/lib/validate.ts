/**
 * Basic input validation utilities for admin API routes.
 * Not a full schema library — just sanity checks to prevent obviously bad data.
 */

/** Validate that a value is a non-empty string */
export function isNonEmptyString(val: unknown, maxLen = 500): val is string {
  return typeof val === "string" && val.trim().length > 0 && val.length <= maxLen;
}

/** Validate that a value is a valid difficulty */
export function isValidDifficulty(val: unknown): val is string {
  return typeof val === "string" && ["easy", "medium", "hard"].includes(val);
}

/** Validate that a value is a valid challenge type */
export function isValidChallengeType(val: unknown): val is string {
  return typeof val === "string" && ["multiple_choice", "ordering", "workflow_build"].includes(val);
}

/** Validate that a value is a valid category */
export function isValidCategory(val: unknown): val is string {
  return typeof val === "string" && [
    "prompting", "agents", "tools", "automation", "1c", "debugging", "workflow", "review"
  ].includes(val);
}

/** Validate that a value is a non-negative integer */
export function isNonNegativeInt(val: unknown): val is number {
  return typeof val === "number" && Number.isInteger(val) && val >= 0;
}

/** Validate that a value is an array */
export function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val);
}

/** Validate that a value is a valid JSON string or object */
export function isValidJSON(val: unknown): boolean {
  if (typeof val === "object") return true;
  if (typeof val === "string") {
    try { JSON.parse(val); return true; } catch { return false; }
  }
  return false;
}

/** Sanitize string for SQL safety — reject if contains suspicious patterns */
export function isSafeString(val: unknown): val is string {
  if (typeof val !== "string") return false;
  // Block obvious injection patterns
  const dangerous = /(;|\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE)\b.*\b(FROM|TABLE|INTO|SET)\b)/i;
  return !dangerous.test(val);
}

/** Validate challenge creation body */
export function validateChallengeBody(body: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!isNonEmptyString(body.title, 300)) errors.push("title: обязательное поле (строка до 300 символов)");
  if (!body.difficulty || !isValidDifficulty(body.difficulty)) errors.push("difficulty: должно быть easy/medium/hard");
  if (!body.type || !isValidChallengeType(body.type)) errors.push("type: должно быть multiple_choice/ordering/workflow_build");
  if (!body.category || !isValidCategory(body.category)) errors.push("category: недопустимая категория");
  
  if (body.xpReward !== undefined && !isNonNegativeInt(body.xpReward)) errors.push("xpReward: должно быть неотрицательным числом");
  if (body.options !== undefined && !isValidJSON(body.options)) errors.push("options: должно быть JSON");
  if (body.correctAnswer !== undefined && !isValidJSON(body.correctAnswer)) errors.push("correctAnswer: должно быть JSON");
  if (body.hints !== undefined && !isValidJSON(body.hints)) errors.push("hints: должно быть JSON");
  
  return { valid: errors.length === 0, errors };
}

/** Validate achievement creation body */
export function validateAchievementBody(body: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!isNonEmptyString(body.name, 200)) errors.push("name: обязательное поле (строка до 200 символов)");
  if (!isNonEmptyString(body.description, 1000)) errors.push("description: обязательное поле");
  if (body.xpReward !== undefined && !isNonNegativeInt(body.xpReward)) errors.push("xpReward: должно быть неотрицательным числом");
  if (body.category !== undefined && typeof body.category !== "string") errors.push("category: должно быть строкой");
  if (body.condition !== undefined && !isValidJSON(body.condition)) errors.push("condition: должно быть JSON");
  
  return { valid: errors.length === 0, errors };
}

/** Validate user update body (admin) */
export function validateUserUpdateBody(body: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const allowedRoles = ["user", "admin"];
  if (body.role !== undefined && !allowedRoles.includes(body.role as string)) errors.push("role: должно быть user/admin");
  if (body.xp !== undefined && !isNonNegativeInt(body.xp)) errors.push("xp: должно быть неотрицательным числом");
  if (body.level !== undefined && (!isNonNegativeInt(body.level) || (body.level as number) < 1)) errors.push("level: должно быть положительным числом");
  if (body.hearts !== undefined && !isNonNegativeInt(body.hearts)) errors.push("hearts: должно быть неотрицательным числом");
  if (body.streak !== undefined && !isNonNegativeInt(body.streak)) errors.push("streak: должно быть неотрицательным числом");
  
  return { valid: errors.length === 0, errors };
}
