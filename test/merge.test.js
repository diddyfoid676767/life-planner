// node test/merge.test.js: runs web/merge.js on testdata/merge-cases.json
// (merge_test.go runs the Go version on the same cases)
const { merge, same } = require('../web/merge.js');
const cases = require('../testdata/merge-cases.json');
let bad = 0;
for (const c of cases) {
  const b = JSON.stringify(c.base), m = JSON.stringify(c.mine), t = JSON.stringify(c.theirs);
  const got = merge(c.base, c.mine, c.theirs);
  if (!same(got, c.want)) { bad++; console.log('FAIL', c.name, '\n got ', JSON.stringify(got), '\n want', JSON.stringify(c.want)); }
  if (JSON.stringify(c.base) !== b || JSON.stringify(c.mine) !== m || JSON.stringify(c.theirs) !== t) { bad++; console.log('FAIL inputs changed', c.name); }
}
console.log(bad ? bad + ' failed' : 'all ' + cases.length + ' passed');
process.exit(bad ? 1 : 0);
