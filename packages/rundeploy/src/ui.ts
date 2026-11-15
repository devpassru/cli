const useColor = process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";

const wrap = (code: string, text: string): string =>
  useColor ? `\x1b[${code}m${text}\x1b[0m` : text;

export const c = {
  bold: (s: string) => wrap("1", s),
  dim: (s: string) => wrap("2", s),
  green: (s: string) => wrap("32", s),
  red: (s: string) => wrap("31", s),
  yellow: (s: string) => wrap("33", s),
  cyan: (s: string) => wrap("36", s),
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function printError(message: string): void {
  console.error(`${c.red("Ошибка:")} ${message}`);
}
