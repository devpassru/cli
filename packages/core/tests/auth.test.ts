import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearCredentials,
  getCredentialsPath,
  loginWithBrowser,
  readCredentials,
  resolveAuthToken,
  writeCredentials,
} from "../src/index.js";

describe("@devpass/cli-core", () => {
  const prevXdg = process.env.XDG_CONFIG_HOME;
  const tempDirs: string[] = [];

  afterEach(async () => {
    if (prevXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = prevXdg;
    }
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("shares credentials across CLIs in ~/.config/devpass/credentials.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "devpass-cli-test-"));
    tempDirs.push(dir);
    process.env.XDG_CONFIG_HOME = dir;

    expect(getCredentialsPath()).toBe(join(dir, "devpass", "credentials.json"));

    await writeCredentials({ apiKey: "dp_live_shared123", email: "dev@devpass.ru" });
    const creds = await readCredentials();
    expect(creds.apiKey).toBe("dp_live_shared123");
    expect(creds.email).toBe("dev@devpass.ru");

    expect(await resolveAuthToken(undefined, ["RUNPORT_TOKEN"])).toBe("dp_live_shared123");
    expect(await resolveAuthToken(undefined, ["RUNDEPLOY_TOKEN"])).toBe("dp_live_shared123");

    await clearCredentials();
    expect((await readCredentials()).apiKey).toBeUndefined();
  });

  it("completes browser loopback login and exchanges code for apiKey", async () => {
    const authServer = createServer(async (req, res) => {
      if (req.url === "/api/v1/cli/token" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }
        const parsed = JSON.parse(body) as { code: string; redirectUri: string };
        expect(parsed.code).toBe("one_time_code_42");
        expect(parsed.redirectUri.startsWith("http://127.0.0.1:")).toBe(true);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            apiKey: "dp_live_browser_ok",
            email: "browser@devpass.ru",
            userId: "usr_123",
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => authServer.listen(0, "127.0.0.1", () => resolve()));
    const authAddr = authServer.address() as AddressInfo;
    const authUrl = `http://127.0.0.1:${authAddr.port}`;

    try {
      const result = await loginWithBrowser({
        client: "runport",
        authUrl,
        timeoutMs: 5000,
        openUrl: async (loginUrl) => {
          const parsed = new URL(loginUrl);
          expect(parsed.pathname).toBe("/cli/auth");
          expect(parsed.searchParams.get("client")).toBe("runport");
          const redirectUri = parsed.searchParams.get("redirect_uri") ?? "";
          const state = parsed.searchParams.get("state") ?? "";
          expect(redirectUri).not.toBe("");
          expect(state).not.toBe("");

          const cbUrl = new URL(redirectUri);
          cbUrl.searchParams.set("code", "one_time_code_42");
          cbUrl.searchParams.set("state", state);
          const cbRes = await fetch(cbUrl.toString());
          expect(cbRes.status).toBe(200);
          return true;
        },
      });

      expect(result.apiKey).toBe("dp_live_browser_ok");
      expect(result.email).toBe("browser@devpass.ru");
      expect(result.userId).toBe("usr_123");
    } finally {
      authServer.close();
    }
  });
});
