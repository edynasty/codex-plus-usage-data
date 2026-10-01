import fs from "node:fs";

const latest = JSON.parse(fs.readFileSync(new URL("../data/latest.json", import.meta.url), "utf8"));
const context = JSON.parse(fs.readFileSync(new URL("../data/context.json", import.meta.url), "utf8"));

const expected = {
  requests: 15188,
  total_tokens: 2990722734,
  input_tokens: 235179076,
  output_tokens: 6231274,
  cache_read_tokens: 2749312384,
};

let failed = false;

function check(label, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(28)} ${actual.toLocaleString()} ${ok ? "" : `!= ${wanted.toLocaleString()}`}`);
  if (!ok) failed = true;
}

console.log("Public snapshot");
for (const [key, value] of Object.entries(expected)) {
  check(key, Number(latest.summary[key]), value);
}

const oneM = context.comparison.one_m;
const k272 = context.comparison.two_seventy_two_k;

console.log("\nContext aggregation");
check("1M + 272K requests", oneM.requests + k272.requests, latest.summary.requests);
check("1M + 272K total tokens", oneM.total_tokens + k272.total_tokens, latest.summary.total_tokens);
check("1M + 272K input tokens", oneM.input_tokens + k272.input_tokens, latest.summary.input_tokens);
check("1M + 272K output tokens", oneM.output_tokens + k272.output_tokens, latest.summary.output_tokens);
check("1M + 272K cache read", oneM.cache_read_tokens + k272.cache_read_tokens, latest.summary.cache_read_tokens);

if (failed) process.exit(1);
