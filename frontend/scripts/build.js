import { build } from "esbuild";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, "..");
const staticDir = resolve(projectRoot, "..", "devices", "static", "dashboard");

mkdirSync(staticDir, { recursive: true });

const sharedConfig = {
  entryPoints: [resolve(projectRoot, "src", "main.jsx")],
  bundle: true,
  outdir: staticDir,
  entryNames: "main",
  assetNames: "assets/[name]",
  sourcemap: true,
  format: "esm",
  target: ["es2020"],
  jsx: "automatic",
  minify: true,
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
    ".css": "css",
    ".png": "file",
    ".jpg": "file",
    ".svg": "file",
    ".woff2": "file",
  },
  metafile: true,
};

try {
  const result = await build(sharedConfig);
  const { warnings } = result;
  if (warnings.length) {
    console.warn("Build completed with warnings:");
    warnings.forEach((warn) => console.warn(warn));
  }
  console.log("Dashboard assets built to", staticDir);
} catch (err) {
  console.error(err);
  process.exit(1);
}
