import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitMetadata {
  commitSha?: string;
  commitMessage?: string;
}

export async function readGitMetadata(cwd: string = process.cwd()): Promise<GitMetadata> {
  try {
    const { stdout: sha } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
      cwd,
      timeout: 1500,
    });
    const { stdout: msg } = await execFileAsync("git", ["log", "-1", "--pretty=%s"], {
      cwd,
      timeout: 1500,
    });
    return {
      commitSha: sha.trim() || undefined,
      commitMessage: msg.trim() || undefined,
    };
  } catch {
    return {};
  }
}
