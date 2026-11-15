import { type CommonFlags, createAuthenticatedClient, resolveTargetProjectId } from "../context.js";
import { c } from "../ui.js";

export async function runRollback(flags: CommonFlags & { deploymentId?: string }): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const { projectId } = await resolveTargetProjectId(client, flags);

  let targetDepId = flags.deploymentId?.trim();
  if (!targetDepId) {
    const { deployments, activeDeploymentId } = await client.listDeployments(projectId);
    const previous = deployments.find(
      (d) => d.id !== activeDeploymentId && (d.status === "ready" || d.status === "rolled_back"),
    );
    if (!previous) {
      throw new Error("Не найден предыдущий доступный релиз для отката.");
    }
    targetDepId = previous.id;
  }

  const res = await client.rollback(projectId, targetDepId);
  console.log(
    `${c.green("✓")} Откат выполнен на ${c.bold(`v${res.deployment.versionNumber}`)} (${c.dim(
      res.deployment.id,
    )})`,
  );
  console.log(`  Production: ${c.cyan(res.prodUrl)}`);
}
