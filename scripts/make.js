const { writeFileSync, mkdirSync } = require("fs");

const TSCONFIG = `{
    "compilerOptions": {
        "target": "es2022",
        "module": "commonjs",
        "typeRoots": ["../../types"],
        "strict": true,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
    },
    "include": ["**/*", "../../types/**/*.d.ts"],
}`;

const project = process.argv[2];
if (!project) {
  console.error("Usage: npm run make <project>");
  process.exit(1);
}

const dirname = `src/${project}`;
const configPath = `src/${project}/tsconfig.json`;
const sourcePath = `src/${project}/${project}.ts`;

try {
  mkdirSync(dirname);
  console.log(`Creating ${configPath}...`);
  writeFileSync(configPath, TSCONFIG);
  console.log(`Creating ${sourcePath}...`);
  writeFileSync(sourcePath, "");
} catch (err) {
  console.error(err);
  process.exit(1);
}
