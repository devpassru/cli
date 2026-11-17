import { readFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { basename, join } from "node:path";
import { c } from "@devpass/cli-core";
import { type CommonFlags, createAuthenticatedClient } from "../context.js";

async function findDefaultPublicKey(): Promise<{ path: string; content: string }> {
  const candidates = [
    join(homedir(), ".ssh", "id_ed25519.pub"),
    join(homedir(), ".ssh", "id_rsa.pub"),
    join(homedir(), ".ssh", "id_ecdsa.pub"),
  ];
  for (const path of candidates) {
    try {
      const content = (await readFile(path, "utf8")).trim();
      if (content) return { path, content };
    } catch {
      // try next
    }
  }
  throw new Error(
    "Не найден публичный SSH-ключ в ~/.ssh/. Укажите путь явно: `runport keys add ~/.ssh/id_ed25519.pub`.",
  );
}

export async function runKeysCommand(
  subcommand: string | undefined,
  args: string[],
  flags: CommonFlags & { name?: string },
): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const action = subcommand || "ls";

  switch (action) {
    case "ls":
    case "list": {
      const keys = await client.listKeys();
      if (keys.length === 0) {
        console.log(c.dim("SSH-ключи не добавлены. Добавьте ключ: `runport keys add`."));
        return;
      }
      for (const k of keys) {
        console.log(`${c.cyan(String(k.id).padEnd(6))} ${c.bold(k.name)}  ${c.dim(k.fingerprint)}`);
      }
      break;
    }

    case "add": {
      const pathArg = args[0];
      let content: string;
      let keyPath: string;
      if (pathArg) {
        keyPath = pathArg;
        content = (await readFile(pathArg, "utf8")).trim();
      } else {
        const found = await findDefaultPublicKey();
        keyPath = found.path;
        content = found.content;
      }
      const keyName = flags.name?.trim() || `${hostname()} (${basename(keyPath)})`;
      const created = await client.addKey({ name: keyName, publicKey: content });
      console.log(
        `${c.green("✓")} SSH-ключ ${c.bold(created.name || keyName)} добавлен ${c.dim(`(${created.fingerprint})`)}`,
      );
      break;
    }

    case "rm":
    case "delete": {
      const idStr = args[0];
      const id = idStr ? Number.parseInt(idStr, 10) : Number.NaN;
      if (!idStr || Number.isNaN(id)) {
        throw new Error("Укажите ID ключа: `runport keys rm <id>`.");
      }
      await client.deleteKey(id);
      console.log(`${c.green("✓")} SSH-ключ #${id} удалён.`);
      break;
    }

    default:
      throw new Error(`Неизвестная подкоманда keys: "${action}". Используйте: ls, add, rm.`);
  }
}
