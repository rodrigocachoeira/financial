const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards ids that arrive from the browser before they reach a UUID column. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
