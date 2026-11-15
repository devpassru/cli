import { type CommonFlags, createAuthenticatedClient } from "../context.js";
import { c } from "../ui.js";

export async function runProjectsList(flags: CommonFlags): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const { projects, total, limit } = await client.listProjects();

  console.log(c.bold(`Проекты (${total}/${limit}):`));
  if (projects.length === 0) {
    console.log(
      c.dim("  Проектов пока нет. Создайте первый через `rundeploy ./dist --name my-app`."),
    );
    return;
  }

  for (const p of projects) {
    const status = p.activeDeploymentId ? c.green("● active") : c.yellow("○ empty");
    console.log(`  ${status} ${c.bold(p.slug)} ${c.dim(`(${p.id})`)} -> ${c.cyan(p.prodUrl)}`);
  }
}
