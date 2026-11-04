'use strict';
/* Merging two copies of the planner that were both changed since the copy
   they started from (base): a window and another window, or the phone and the
   PC. Nothing either side added is lost:
   - lists of things with an id (todos, sessions, workouts...) merge item by
     item: added on either side is kept, deleted on one side and untouched on
     the other is deleted, changed on both merges field by field
   - other lists merge the same way, matching identical entries
   - objects merge key by key; a value changed on one side takes that side
   - a value changed differently on both sides takes mine (the copy being
     saved now), except counters like coins spent, which add both changes
   - with no base (an old copy from before 2.33), nothing is deleted: both
     sides' items are kept
   cloudsync.go has the same rules in Go (mergePlanner); merge_test.go runs
   both on the same cases. */
(function (root) {
  const COUNTERS = new Set(['spent', 'bonus', 'opened', 'bank', 'pastBank', 'xp']);
  const NONE = undefined; // missing on that side
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  function same(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false; return true; }
    const ka = Object.keys(a); if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka) if (!(k in b) || !same(a[k], b[k])) return false;
    return true;
  }
  // the same entry written by Go or JS (keys in any order) gets the same text
  const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
    : isObj(v) ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
  // list entries are matched by id when they have one, otherwise by content;
  // the #n counts repeats so two identical entries stay two
  function keyed(arr) {
    const out = new Map(), seen = {};
    for (const x of arr) {
      const k0 = isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number') ? 'i' + typeof x.id + ':' + x.id : 'j' + canon(x);
      const n = seen[k0] = (seen[k0] || 0) + 1;
      out.set(k0 + '#' + n, x);
    }
    return out;
  }
  function mergeList(b, m, t) {
    const B = Array.isArray(b) ? keyed(b) : null, M = keyed(m), T = keyed(t);
    // theirs-only entries go after the entry of mine they followed there
    const after = new Map([['', []]]);
    let cur = after.get('');
    for (const [k, tv] of T) {
      if (M.has(k)) { if (!after.has(k)) after.set(k, []); cur = after.get(k); continue; }
      const v = merge(B ? B.get(k) : NONE, NONE, tv, null, !B);
      if (v !== NONE) cur.push(v);
    }
    const out = [...after.get('')];
    for (const [k, mv] of M) {
      const v = merge(B ? B.get(k) : NONE, mv, T.get(k), null, !B);
      if (v !== NONE) out.push(v);
      if (after.has(k)) out.push(...after.get(k));
    }
    return out;
  }
  // b, m, t: base, mine, theirs (NONE where missing). noBase: there is no
  // base copy at all, so missing never means deleted
  function merge(b, m, t, key, noBase) {
    if (same(m, t)) return m;
    if (m === NONE && t === NONE) return NONE;
    if (!noBase) {
      if (same(b, m)) return t;
      if (same(b, t)) return m;
    }
    if (m === NONE) return t; // deleted on one side, changed on the other: keep it
    if (t === NONE) return m;
    if (Array.isArray(m) && Array.isArray(t)) return mergeList(noBase ? null : b, m, t);
    if (isObj(m) && isObj(t)) {
      const bo = !noBase && isObj(b) ? b : null, out = {};
      for (const k of Object.keys(m)) { const v = merge(bo ? bo[k] : NONE, m[k], t[k], k, !bo); if (v !== NONE) out[k] = v; }
      for (const k of Object.keys(t)) if (!(k in m)) { const v = merge(bo ? bo[k] : NONE, NONE, t[k], k, !bo); if (v !== NONE) out[k] = v; }
      return out;
    }
    // counters (coins spent...) changed on both sides add both changes
    if (COUNTERS.has(key) && typeof b === 'number' && typeof m === 'number' && typeof t === 'number')
      return Math.max(0, b + (m - b) + (t - b));
    return m;
  }
  // base may be null (unknown); returns a new copy, the inputs aren't changed
  function mergePlanner(base, mine, theirs) {
    if (mine == null) return theirs;
    if (theirs == null) return mine;
    return merge(base == null ? NONE : base, mine, theirs, null, base == null);
  }
  const api = { merge: mergePlanner, same };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LPMerge = api;
})(typeof window !== 'undefined' ? window : globalThis);
