import { c } from "@devpass/cli-core";
import { type CommonFlags, createAuthenticatedClient } from "../context.js";

export async function runLogs(
  flags: CommonFlags & { subdomain?: string; limit?: number },
): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const { logs } = await client.getLogs();

  const filtered = flags.subdomain?.trim()
    ? logs.filter((l) => l.subdomain === flags.subdomain?.trim())
    : logs;

  const limit =
    flags.limit !== undefined && Number.isFinite(flags.limit) && flags.limit > 0 ? flags.limit : 20;
  const items = filtered.slice(0, limit);

  if (items.length === 0) {
    console.log(c.dim("Логов запросов пока нет."));
    return;
  }

  for (const l of items) {
    const status = l.status_code ?? 0;
    const statusText =
      status >= 500
        ? c.red(String(status))
        : status >= 400
          ? c.yellow(String(status))
          : c.green(String(status || "---"));
    const duration = l.duration_ms !== null ? c.dim(`${l.duration_ms}ms`) : "";
    console.log(
      `${c.dim(l.timestamp)}  ${statusText}  ${c.bold(l.method.padEnd(6))} https://${l.subdomain}.runport.ru${l.path}  ${duration}`,
    );
  }
}
