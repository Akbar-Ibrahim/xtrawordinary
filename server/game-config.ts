import {
  gameConfigFieldSchema,
  getGameConfigConstraint,
  getSupportedGameConfigFields,
  type GameConfigUpdate,
} from "@shared/schema";

type ConfigParseResult =
  | { ok: true; config: GameConfigUpdate }
  | { ok: false; error: string };

export function parseGameConfigUpdate(slug: string, body: unknown): ConfigParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Config body must be an object" };
  }

  const entries = Object.entries(body);
  if (entries.length === 0) {
    return { ok: false, error: "At least one config field is required" };
  }

  const supportedFields = new Set(getSupportedGameConfigFields(slug));
  const config: GameConfigUpdate = {};

  for (const [key, value] of entries) {
    const parsedField = gameConfigFieldSchema.safeParse(key);
    if (!parsedField.success) {
      return { ok: false, error: `${key} is not a supported game config field` };
    }
    const field = parsedField.data;
    if (!supportedFields.has(field)) {
      return { ok: false, error: `${field} is not supported for ${slug}` };
    }
    if (value !== null && (!Number.isInteger(value) || (value as number) <= 0)) {
      return { ok: false, error: `${field} must be a positive integer or null` };
    }
    const constraint = getGameConfigConstraint(slug, field);
    if (value !== null && constraint.max !== undefined && (value as number) > constraint.max) {
      return { ok: false, error: `${field} must be at most ${constraint.max} for ${slug}` };
    }
    config[field] = value as number | null;
  }

  return { ok: true, config };
}