import { context } from "esbuild";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const staticDir = resolve(projectRoot, "..", "devices", "static", "dashboard");

mkdirSync(staticDir, { recursive: true });

const ctx = await context({
  entryPoints: [resolve(projectRoot, "src", "main.jsx")],
  bundle: true,
  outdir: staticDir,
  entryNames: "main",
  assetNames: "assets/[name]",
  sourcemap: true,
  format: "esm",
  jsx: "automatic",
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
    ".css": "css",
    ".png": "file",
    ".jpg": "file",
    ".svg": "file",
    ".woff2": "file",
  },
  target: ["es2020"],
});

await ctx.watch();
console.log("Watching frontend sources. Output ->", staticDir);

process.stdin.resume();
