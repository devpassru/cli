import { basename, resolve } from "node:path";
import { createDeployArchive, detectBuildDirectory } from "../archive.js";
import { readLocalProjectLink, writeLocalProjectLink } from "../config.js";
import { type CommonFlags, createAuthenticatedClient } from "../context.js";
import { readGitMetadata } from "../git.js";
import { c, formatBytes } from "../ui.js";

export interface DeployFlags extends CommonFlags {
  dir?: string;
  spa?: boolean;
  includeApi?: boolean;
  message?: string;
}

function slugifyDirName(dirPath: string): string {
  return basename(resolve(dirPath))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function runDeploy(flags: DeployFlags): Promise<void> {
  const startedAt = Date.now();
  const cwd = process.cwd();
  const client = await createAuthenticatedClient(flags);

  const buildDir = flags.dir ? resolve(cwd, flags.dir) : detectBuildDirectory(cwd);
  console.log(`${c.cyan("→")} Подготовка сборки из ${c.bold(buildDir)}...`);

  const bundle = await createDeployArchive({
    buildDir,
    cwd,
    includeApi: flags.includeApi !== false,
  });

  if (!bundle.hasIndexHtml) {
    throw new Error(
      `В корне сборки (${buildDir}) не найден index.html. Укажите корректную папку, например: rundeploy ./dist`,
    );
  }

  let projectId = flags.project?.trim();
  let projectSlug = flags.name?.trim().toLowerCase();

  if (!projectId) {
    if (projectSlug) {
      const { projects } = await client.listProjects();
      const existing = projects.find((p) => p.slug === projectSlug);
      if (existing) {
        projectId = existing.id;
      } else {
        console.log(`${c.cyan("→")} Создание проекта ${c.bold(projectSlug)}...`);
        const { project } = await client.createProject({
          name: projectSlug,
          slug: projectSlug,
          spaFallback: flags.spa !== false,
        });
        projectId = project.id;
        projectSlug = project.slug;
      }
      await writeLocalProjectLink({ projectId, slug: projectSlug, apiUrl: client.baseUrl }, cwd);
    } else {
      const local = await readLocalProjectLink(cwd);
      if (local) {
        projectId = local.projectId;
        projectSlug = local.slug;
      } else {
        const inferred = slugifyDirName(cwd);
        throw new Error(
          `Проект не привязан к этой папке. Укажите --name <slug>${
            inferred ? ` (например: rundeploy --name ${inferred})` : ""
          } или --project <id>.`,
        );
      }
    }
  }

  const git = await readGitMetadata(cwd);
  const commitMessage = flags.message || git.commitMessage;

  console.log(
    `${c.cyan("→")} Загрузка архива (${c.bold(String(bundle.filesCount))} файлов, ${c.bold(
      formatBytes(bundle.archive.length),
    )}${bundle.includedApiDir ? ", +api/" : ""})...`,
  );

  const result = await client.uploadDeployment({
    projectId,
    archive: bundle.archive,
    commitSha: git.commitSha,
    commitMessage,
  });

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log("");
  console.log(
    `${c.green("✓")} Релиз ${c.bold(`v${result.deployment.versionNumber}`)} (${c.dim(
      result.deployment.id,
    )}) опубликован за ${elapsedSec} с`,
  );
  console.log(`  Production: ${c.cyan(c.bold(result.prodUrl))}`);
  console.log(`  Preview:    ${c.dim(result.previewUrl)}`);
  if (typeof result.functionsCount === "number" && result.functionsCount > 0) {
    console.log(`  Functions:  ${c.green(`${result.functionsCount} маршрут(ов) /api/*`)}`);
  }
}
