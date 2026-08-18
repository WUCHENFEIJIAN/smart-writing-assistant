export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

export function hasKnownSchemaVersion(value: unknown): value is { schemaVersion: 1 } {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === CURRENT_STORAGE_SCHEMA_VERSION
  );
}

