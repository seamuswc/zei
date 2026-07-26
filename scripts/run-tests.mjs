import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

const files = walk("src/lib");
let failed = 0;
for (const f of files) {
  console.log(`> ${f}`);
  const r = spawnSync("npx", ["tsx", f], { stdio: "inherit" });
  if (r.status !== 0) failed += 1;
}
if (failed) {
  console.error(`${failed} test file(s) failed`);
  process.exit(1);
}
console.log(`All ${files.length} test files passed`);
