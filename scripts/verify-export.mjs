import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("out");
const required = ["index.html", "404.html", "resume/index.html", "favicon.svg", "og.png", "robots.txt", "sitemap.xml"];
for (const file of required) {
  await access(path.join(root, file));
}

const htmlFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (entry.name.endsWith(".html")) htmlFiles.push(target);
  }
}
await walk(root);

const problems = [];
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(?:https?:|mailto:|tel:|#|data:|javascript:)/i.test(value)) continue;
    const local = value.replace(/^\//, "");
    const candidates = [path.join(root, local), path.join(root, local, "index.html"), path.join(root, `${local}.html`)];
    let found = false;
    for (const candidate of candidates) {
      try { await access(candidate); found = true; break; } catch {}
    }
    if (!found) problems.push(`${path.relative(root, file)} -> ${value}`);
  }
}
if (problems.length) {
  console.error(`Broken local references:\n${problems.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Export verified: ${htmlFiles.length} HTML pages and required assets exist.`);
}
