import { describe, expect, it } from "bun:test";
import { buildSshArgs } from "../src/commands/tunnel.js";

describe("@devpass/runport buildSshArgs", () => {
  it("builds default HTTP tunnel args", () => {
    const args = buildSshArgs({ port: 3000 });
    expect(args).toContain("-p");
    expect(args).toContain("2222");
    expect(args).toContain("-R");
    expect(args).toContain("80:localhost:3000");
    expect(args).toContain("srv.runport.ru");
  });

  it("includes subdomain, review, auth, ip, and identity file flags", () => {
    const args = buildSshArgs({
      port: 5173,
      subdomain: "my-app",
      localHost: "127.0.0.1",
      review: true,
      auth: "admin:secret",
      ip: "1.2.3.4",
      identityFile: "~/.ssh/id_ed25519",
    });

    expect(args).toContain("my-app:80:127.0.0.1:5173");
    expect(args).toContain("-i");
    expect(args).toContain("~/.ssh/id_ed25519");
    expect(args).toContain("--auth");
    expect(args).toContain("admin:secret");
    expect(args).toContain("--ip");
    expect(args).toContain("1.2.3.4");
    expect(args).toContain("--review");
  });

  it("builds TCP tunnel args with remote port", () => {
    const args = buildSshArgs({
      port: 5432,
      tcp: true,
      remotePort: 15432,
    });
    expect(args).toContain("15432:localhost:5432");
  });
});
