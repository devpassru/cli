import { spawn } from "node:child_process";
import { c } from "@devpass/cli-core";
import { DEFAULT_SSH_HOST, DEFAULT_SSH_PORT } from "../config.js";

export interface TunnelOptions {
  port: number;
  subdomain?: string;
  localHost?: string;
  sshHost?: string;
  sshPort?: number;
  tcp?: boolean;
  remotePort?: number;
  auth?: string;
  ip?: string;
  review?: boolean;
  identityFile?: string;
}

export function buildSshArgs(opts: TunnelOptions): string[] {
  const localHost = opts.localHost?.trim() || "localhost";
  const sshHost = opts.sshHost?.trim() || DEFAULT_SSH_HOST;
  const sshPort = opts.sshPort ?? DEFAULT_SSH_PORT;

  let forwardSpec: string;
  if (opts.tcp) {
    const rPort = opts.remotePort ?? 0;
    forwardSpec = `${rPort}:${localHost}:${opts.port}`;
  } else if (opts.subdomain?.trim()) {
    forwardSpec = `${opts.subdomain.trim()}:80:${localHost}:${opts.port}`;
  } else {
    forwardSpec = `80:${localHost}:${opts.port}`;
  }

  const args = [
    "-p",
    String(sshPort),
    "-R",
    forwardSpec,
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=3",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];

  if (opts.identityFile?.trim()) {
    args.push("-i", opts.identityFile.trim());
  }

  args.push(sshHost);

  if (opts.auth?.trim()) {
    args.push("--auth", opts.auth.trim());
  }
  if (opts.ip?.trim()) {
    args.push("--ip", opts.ip.trim());
  }
  if (opts.review) {
    args.push("--review");
  }

  return args;
}

export async function runTunnel(
  rawPort: string | undefined,
  opts: Omit<TunnelOptions, "port">,
): Promise<void> {
  if (!rawPort) {
    throw new Error("Укажите локальный порт, например: `runport 3000`.");
  }
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Некорректный порт: "${rawPort}". Ожидается число от 1 до 65535.`);
  }

  const args = buildSshArgs({ ...opts, port });
  console.log(
    `${c.cyan("→")} Запуск ${opts.tcp ? "TCP" : "HTTP"}-туннеля на ${c.bold(`${opts.localHost || "localhost"}:${port}`)}...`,
  );

  await new Promise<void>((resolve, reject) => {
    const child = spawn("ssh", args, {
      stdio: "inherit",
    });

    const forwardSignal = (sig: NodeJS.Signals) => {
      if (!child.killed) {
        child.kill(sig);
      }
    };

    process.on("SIGINT", forwardSignal);
    process.on("SIGTERM", forwardSignal);

    child.once("error", (err) => {
      process.off("SIGINT", forwardSignal);
      process.off("SIGTERM", forwardSignal);
      reject(new Error(`Не удалось запустить ssh: ${err.message}`));
    });

    child.once("exit", (code, signal) => {
      process.off("SIGINT", forwardSignal);
      process.off("SIGTERM", forwardSignal);
      if (signal === "SIGINT" || signal === "SIGTERM" || code === 0 || code === 130) {
        resolve();
      } else {
        reject(new Error(`SSH-туннель завершился с кодом ${code ?? "unknown"}`));
      }
    });
  });
}
