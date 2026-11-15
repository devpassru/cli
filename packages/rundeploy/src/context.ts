import { RunDeployClient } from "./api.js";
import { readLocalProjectLink, resolveApiUrl, resolveAuthToken } from "./config.js";

export interface CommonFlags {
  token?: string;
  apiUrl?: string;
  project?: string;
  name?: string;
}

export async function createAuthenticatedClient(flags: CommonFlags): Promise<RunDeployClient> {
  const token = await resolveAuthToken(flags.token);
  if (!token) {
    throw new Error(
      "Не найдены учетные данные. Выполните `rundeploy login` или передайте RUNDEPLOY_TOKEN / DEVPASS_API_KEY.",
    );
  }
  const baseUrl = await resolveApiUrl(flags.apiUrl);
  return new RunDeployClient({ baseUrl, token });
}

export async function resolveTargetProjectId(
  client: RunDeployClient,
  flags: CommonFlags,
): Promise<{ projectId: string; slug?: string }> {
  if (flags.project) {
    return { projectId: flags.project };
  }

  if (flags.name) {
    const { projects } = await client.listProjects();
    const match = projects.find((p) => p.slug === flags.name?.trim().toLowerCase());
    if (!match) {
      throw new Error(`Проект со slug "${flags.name}" не найден.`);
    }
    return { projectId: match.id, slug: match.slug };
  }

  const local = await readLocalProjectLink();
  if (local) {
    return { projectId: local.projectId, slug: local.slug };
  }

  throw new Error(
    "Не указан проект. Запустите из папки с .rundeploy/project.json или укажите --project <id> / --name <slug>.",
  );
}
