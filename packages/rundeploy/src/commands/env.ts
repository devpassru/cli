import { type CommonFlags, createAuthenticatedClient, resolveTargetProjectId } from "../context.js";
import { c } from "../ui.js";

export async function runEnvCommand(
  subcommand: string | undefined,
  args: string[],
  flags: CommonFlags,
): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const { projectId } = await resolveTargetProjectId(client, flags);

  const action = subcommand || "ls";

  if (action === "ls" || action === "list") {
    const { variables } = await client.listEnv(projectId);
    console.log(c.bold(`Переменные окружения (${variables.length}):`));
    if (variables.length === 0) {
      console.log(c.dim("  Переменные не заданы."));
      return;
    }
    for (const v of variables) {
      console.log(`  ${c.cyan(v.key)} ${c.dim(`(обновлена ${v.updatedAt.slice(0, 10)})`)}`);
    }
    return;
  }

  if (action === "set") {
    const pair = args[0];
    let key = "";
    let value = "";
    if (pair?.includes("=")) {
      const idx = pair.indexOf("=");
      key = pair.slice(0, idx);
      value = pair.slice(idx + 1);
    } else if (args[0] && args[1] !== undefined) {
      key = args[0];
      value = args[1];
    } else {
      throw new Error("Использование: rundeploy env set KEY=VALUE");
    }

    const res = await client.setEnv(projectId, key, value);
    console.log(`${c.green("✓")} Переменная ${c.bold(res.variable.key)} сохранена.`);
    return;
  }

  if (action === "rm" || action === "delete") {
    const key = args[0]?.trim().toUpperCase();
    if (!key) {
      throw new Error("Использование: rundeploy env rm KEY");
    }
    await client.deleteEnv(projectId, key);
    console.log(`${c.green("✓")} Переменная ${c.bold(key)} удалена.`);
    return;
  }

  throw new Error(`Неизвестная подкоманда env: ${action}. Доступны: ls, set, rm.`);
}
