import { type CommonFlags, createAuthenticatedClient, resolveTargetProjectId } from "../context.js";
import { c } from "../ui.js";

export async function runLogs(flags: CommonFlags & { limit?: number }): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const { projectId } = await resolveTargetProjectId(client, flags);
  const { logs } = await client.getFunctionLogs(projectId, flags.limit || 20);

  if (logs.length === 0) {
    console.log(c.dim("Логов вызовов serverless-функций пока нет."));
    return;
  }

  for (const entry of logs) {
    const statusColor = entry.status >= 500 ? c.red : entry.status >= 400 ? c.yellow : c.green;
    console.log(
      `${c.dim(entry.timestamp)} ${c.bold(entry.method)} ${entry.path} ${statusColor(
        String(entry.status),
      )} ${c.dim(`${entry.durationMs}ms`)}`,
    );
    for (const line of entry.logs) {
      console.log(`  ${c.dim("│")} ${line}`);
    }
    if (entry.error) {
      console.log(`  ${c.red("error:")} ${entry.error}`);
    }
  }
}
