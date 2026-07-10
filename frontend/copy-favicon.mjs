import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "public", "logo", "logo.avif");
const destination = join(process.cwd(), "src", "app", "icon.avif");

if (existsSync(source)) {
    copyFileSync(source, destination);
}
