// Trial analysis on local sample files, using the same lib/files + lib/ai code as the app.
// Run with: npm run ai:trial -- <output.json> [folder ...]   (default folders: samples, samples/test)
// Override the model for one run with OPENAI_MODEL=<model> before the command.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { convertFile, type FileKind } from "../lib/files";
import { analyzeTender } from "../lib/ai/analyze";

// USD per 1M tokens (input, output)
const PRICES: Record<string, [number, number]> = {
  "gpt-6.1-sol": [2, 10],
  "gpt-6.1-terra": [1, 5],
  "gpt-6-astra": [10, 50],
};

const KINDS: Record<string, FileKind> = {
  ".pdf": "pdf",
  ".doc": "word",
  ".docx": "word",
  ".xls": "excel",
  ".xlsx": "excel",
};

const [output, ...folders] = process.argv.slice(2);
if (!output) {
  console.error("Usage: npm run ai:trial -- <output.json> [folder ...]");
  process.exit(1);
}

const paths = (folders.length ? folders : ["samples", "samples/test"]).flatMap((dir) =>
  readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((p) => statSync(p).isFile() && KINDS[extname(p).toLowerCase()]),
);

const loaded = await Promise.all(
  paths.map((p) => convertFile(p.split(/[\\/]/).pop()!, KINDS[extname(p).toLowerCase()], readFileSync(p))),
);
for (const f of loaded) {
  console.log(f.ok ? `  read      ${f.name} (${f.kind})` : `  NOT READ  ${f.name}: ${f.note}`);
}

const started = Date.now();
const out = await analyzeTender(loaded.filter((f) => f.ok));
const seconds = (Date.now() - started) / 1000;

const price = Object.entries(PRICES).find(([m]) => out.model.startsWith(m))?.[1];
const cost = price ? (out.inputTokens * price[0] + out.outputTokens * price[1]) / 1e6 : NaN;

console.log(`\nmodel:   ${out.model}`);
console.log(`time:    ${seconds.toFixed(1)}s`);
console.log(`tokens:  ${out.inputTokens} in / ${out.outputTokens} out`);
console.log(`cost:    $${cost.toFixed(3)}`);
console.log(
  `items:   ${out.result.requirements.length} requirements, ${out.result.deadlines.length} deadlines, ` +
    `${out.result.tasks.length} tasks, ${out.result.issues.length} issues`,
);
writeFileSync(output, JSON.stringify({ seconds, cost, ...out }, null, 2));
console.log(`saved:   ${output}`);
