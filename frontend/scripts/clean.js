import { rmSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const staticDir = resolve(projectRoot, "..", "devices", "static", "dashboard");

rmSync(staticDir, { recursive: true, force: true });
console.log("Removed", staticDir);
