/**
 * Merge order: generated → manual override. Override wins field by field.
 * - A key absent from the override keeps the generated value.
 * - An explicit `null` in the override means "the source does not publish this" and wins.
 * - Arrays are replaced wholesale (a compound list is one fact, not a set of mergeable parts).
 * Conflicts (both sides non-null and different) are reported for auditing, never silently hidden.
 */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface MergeResult {
  value: Json;
  conflicts: { path: string; generated: Json; override: Json }[];
}

const isObject = (v: unknown): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function mergeRecord(generated: Json | undefined, override: Json | undefined): MergeResult {
  const conflicts: MergeResult['conflicts'] = [];
  const walk = (g: Json | undefined, o: Json | undefined, path: string): Json => {
    if (o === undefined) return structuredClone(g ?? null);
    if (g === undefined || g === null) return structuredClone(o);
    if (isObject(g) && isObject(o)) {
      const out: Record<string, Json> = {};
      for (const k of new Set([...Object.keys(g), ...Object.keys(o)]))
        out[k] = walk(g[k], o[k], path ? `${path}.${k}` : k);
      return out;
    }
    const bookkeeping =
      path.startsWith('validation') || path.startsWith('provenance') || path.endsWith('retrievedAt');
    // Includes `null` overrides hiding a value Pirelli has since published: worth a human look.
    if (!bookkeeping && JSON.stringify(g) !== JSON.stringify(o)) {
      conflicts.push({ path, generated: g, override: o });
    }
    return structuredClone(o);
  };
  return { value: walk(generated, override, ''), conflicts };
}
