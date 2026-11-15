import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PKG_DIR = resolve(import.meta.dir, "..");
const DIST_BIN = join(PKG_DIR, "dist", "index.js");

describe("rundeploy CLI e2e", () => {
  const tempWorkDir = mkdtempSync(join(tmpdir(), "rundeploy-cli-e2e-"));
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;
  let lastUploadHasFile = false;

  beforeAll(() => {
    mkdirSync(join(tempWorkDir, "dist"), { recursive: true });
    writeFileSync(join(tempWorkDir, "dist", "index.html"), "<h1>Hello</h1>");

    server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/api/v1/projects" && req.method === "GET") {
          return Response.json({
            projects: [
              {
                id: "prj_1",
                name: "demo",
                slug: "demo",
                spaFallback: true,
                activeDeploymentId: "dep_1",
                prodUrl: "https://demo.rundeploy.ru",
                createdAt: new Date().toISOString(),
              },
            ],
            total: 1,
            limit: 5,
          });
        }
        if (url.pathname === "/api/v1/projects/prj_1/deployments" && req.method === "POST") {
          const form = await req.formData();
          const file = form.get("file");
          lastUploadHasFile = file instanceof Blob && file.size > 0;
          return Response.json(
            {
              deployment: {
                id: "dep_2",
                projectId: "prj_1",
                versionNumber: 2,
                status: "active",
                filesCount: 1,
                sizeBytes: 14,
                previewUrl: "https://dep_2--demo.rundeploy.ru",
                createdAt: new Date().toISOString(),
              },
              prodUrl: "https://demo.rundeploy.ru",
              previewUrl: "https://dep_2--demo.rundeploy.ru",
              functionsCount: 0,
            },
            { status: 201 },
          );
        }
        return Response.json({ title: "Not Found" }, { status: 404 });
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
    rmSync(tempWorkDir, { recursive: true, force: true });
  });

  it("prints help under Node.js", async () => {
    const { stdout } = await execFileAsync("node", [DIST_BIN, "--help"], { encoding: "utf8" });
    expect(stdout).toContain("rundeploy");
    expect(stdout).toContain("rollback");
  });

  it("deploys build directory to API and saves local project link", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [DIST_BIN, "./dist", "--name", "demo", "--api-url", baseUrl],
      {
        cwd: tempWorkDir,
        encoding: "utf8",
        env: { ...process.env, RUNDEPLOY_TOKEN: "dp_live_test_token", NO_COLOR: "1" },
      },
    );

    expect(lastUploadHasFile).toBe(true);
    expect(stdout).toContain("Релиз v2");
    expect(stdout).toContain("https://demo.rundeploy.ru");
  });
});
