import { Query } from 'appwrite';
import { rowChannel, type ChannelPreset } from '@/sdk/channels';

export type BuilderOp =
  | 'equal'
  | 'notEqual'
  | 'greaterThan'
  | 'greaterThanEqual'
  | 'lessThan'
  | 'lessThanEqual'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'search'
  | 'isNull'
  | 'isNotNull';

export type BuilderFilter = {
  field: string;
  op: BuilderOp;
  value: string;
};

export const BUILDER_OPS: Array<{ id: BuilderOp; label: string; noValue?: boolean }> = [
  { id: 'equal', label: '=' },
  { id: 'notEqual', label: '≠' },
  { id: 'greaterThan', label: '>' },
  { id: 'greaterThanEqual', label: '≥' },
  { id: 'lessThan', label: '<' },
  { id: 'lessThanEqual', label: '≤' },
  { id: 'contains', label: 'contains' },
  { id: 'startsWith', label: 'startsWith' },
  { id: 'endsWith', label: 'endsWith' },
  { id: 'search', label: 'search' },
  { id: 'isNull', label: 'is null', noValue: true },
  { id: 'isNotNull', label: 'is not null', noValue: true },
];

export const DEFAULT_BUILDER_FILTER: BuilderFilter = { field: 'priority', op: 'equal', value: 'high' };

function coerce(v: string): string | number | boolean {
  const t = v.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t !== '' && !Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

export function filterToQuery(f: BuilderFilter): string | undefined {
  const field = f.field.trim();
  if (!field) return undefined;
  switch (f.op) {
    case 'equal': return Query.equal(field, coerce(f.value));
    case 'notEqual': return Query.notEqual(field, coerce(f.value));
    case 'greaterThan': return Query.greaterThan(field, coerce(f.value) as any);
    case 'greaterThanEqual': return Query.greaterThanEqual(field, coerce(f.value) as any);
    case 'lessThan': return Query.lessThan(field, coerce(f.value) as any);
    case 'lessThanEqual': return Query.lessThanEqual(field, coerce(f.value) as any);
    case 'contains': return Query.contains(field, f.value);
    case 'startsWith': return Query.startsWith(field, f.value);
    case 'endsWith': return Query.endsWith(field, f.value);
    case 'search': return Query.search(field, f.value);
    case 'isNull': return Query.isNull(field);
    case 'isNotNull': return Query.isNotNull(field);
    default: return undefined;
  }
}

export function describeFilter(f: BuilderFilter): string {
  const def = BUILDER_OPS.find((o) => o.id === f.op);
  const label = def?.label ?? f.op;
  return def?.noValue ? `${f.field} ${label}` : `${f.field} ${label} ${f.value}`;
}

/** Convert builder filters into a `custom` ChannelPreset the SDK already knows how to build. */
export function builderToPreset(
  filters: BuilderFilter[],
  databaseId: string,
  tableId: string,
): ChannelPreset {
  const resolved = filters.filter((f) => f.field.trim() !== '');
  const queries = resolved
    .map((f) => filterToQuery(f))
    .filter((q): q is string => !!q);
  const label = resolved.length === 0
    ? 'Builder (empty)'
    : resolved.slice(0, 2).map(describeFilter).join(' ∧ ')
      + (resolved.length > 2 ? ` + ${resolved.length - 2}` : '');
  return {
    id: 'custom',
    label,
    raw: rowChannel(databaseId, tableId),
    queries,
  };
}
