const { spawnSync } = require("node:child_process");

const project = process.argv[2];
if (!project) {
  console.error("Usage: npm run compile <project>");
  process.exit(1);
}

const entry = `src/${project}/${project}.ts`;
const outdir = `out/${project}`;

console.log("running: tsc %s --target es2022 --outDir %s", entry, outdir);

const { status } = spawnSync(
  "tsc",
  [entry, "--target", "es2022", "--outDir", outdir],
  {
    stdio: "inherit",
    shell: true,
  }
);
process.exit(status ?? 1);
