import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createDeployArchive, detectBuildDirectory } from "../src/archive.js";

describe("archive", () => {
  const root = mkdtempSync(join(tmpdir(), "rundeploy-cli-archive-"));

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("detects dist directory containing index.html", () => {
    const projectDir = join(root, "proj1");
    mkdirSync(join(projectDir, "dist"), { recursive: true });
    writeFileSync(join(projectDir, "dist", "index.html"), "<h1>Hi</h1>");

    expect(detectBuildDirectory(projectDir)).toBe(join(projectDir, "dist"));
  });

  it("creates valid .tar.gz archive, ignores .env/node_modules and includes sibling api/", async () => {
    const projectDir = join(root, "proj2");
    const distDir = join(projectDir, "dist");
    const apiDir = join(projectDir, "api");
    mkdirSync(join(distDir, "assets"), { recursive: true });
    mkdirSync(join(distDir, "node_modules", "pkg"), { recursive: true });
    mkdirSync(apiDir, { recursive: true });

    writeFileSync(join(distDir, "index.html"), "<html>ok</html>");
    writeFileSync(join(distDir, "assets", "app.js"), "console.log(1);");
    writeFileSync(join(distDir, ".env"), "SECRET=123");
    writeFileSync(join(distDir, "node_modules", "pkg", "index.js"), "ignored");
    writeFileSync(join(apiDir, "hello.ts"), "export default () => new Response('hi');");

    const bundle = await createDeployArchive({
      buildDir: distDir,
      cwd: projectDir,
      includeApi: true,
    });

    expect(bundle.hasIndexHtml).toBe(true);
    expect(bundle.includedApiDir).toBe(true);
    expect(bundle.filesCount).toBe(3);

    const tarText = gunzipSync(bundle.archive).toString("utf8");
    expect(tarText).toContain("index.html");
    expect(tarText).toContain("assets/app.js");
    expect(tarText).toContain("api/hello.ts");
    expect(tarText).not.toContain(".env");
    expect(tarText).not.toContain("node_modules");
  });
});
