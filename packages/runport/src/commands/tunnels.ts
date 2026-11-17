import { c } from "@devpass/cli-core";
import { type CommonFlags, createAuthenticatedClient } from "../context.js";

export async function runTunnelsList(flags: CommonFlags): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const me = await client.me();

  if (me.tunnels.length === 0) {
    console.log(c.dim("Нет активных или зарезервированных туннелей."));
    return;
  }

  for (const t of me.tunnels) {
    const status = t.isOnline ? c.green("● online") : c.dim("○ offline");
    const target = t.subdomain
      ? `https://${t.subdomain}.runport.ru`
      : `tcp://srv.runport.ru:${t.port}`;
    const badges: string[] = [];
    if (t.is_reserved) badges.push("reserved");
    if (t.custom_domain) badges.push(t.custom_domain);
    if (t.is_review_mode) badges.push("review");
    if (t.auth_user) badges.push("auth");
    const meta = badges.length > 0 ? c.dim(` [${badges.join(", ")}]`) : "";
    console.log(`${status}  ${c.bold(target)}${meta}`);
  }
}

export async function runReserve(subdomain: string | undefined, flags: CommonFlags): Promise<void> {
  if (!subdomain?.trim()) {
    throw new Error("Укажите поддомен: `runport reserve <subdomain>`.");
  }
  const client = await createAuthenticatedClient(flags);
  const res = await client.reserveTunnel({ subdomain: subdomain.trim() });
  console.log(
    `${c.green("✓")} Поддомен ${c.bold(`https://${res.subdomain || subdomain}.runport.ru`)} зарезервирован.`,
  );
}

export async function runUnreserve(
  subdomain: string | undefined,
  flags: CommonFlags,
): Promise<void> {
  if (!subdomain?.trim()) {
    throw new Error("Укажите поддомен: `runport unreserve <subdomain>`.");
  }
  const client = await createAuthenticatedClient(flags);
  await client.deleteTunnel({ subdomain: subdomain.trim() });
  console.log(`${c.green("✓")} Резерв поддомена ${c.bold(subdomain.trim())} удалён.`);
}

export async function runClose(target: string | undefined, flags: CommonFlags): Promise<void> {
  if (!target?.trim()) {
    throw new Error("Укажите поддомен или TCP-порт: `runport close <subdomain|port>`.");
  }
  const client = await createAuthenticatedClient(flags);
  const trimmed = target.trim();
  const maybePort = Number.parseInt(trimmed, 10);
  if (String(maybePort) === trimmed && maybePort >= 10000 && maybePort <= 60000) {
    await client.closeTunnel({ port: maybePort });
    console.log(`${c.green("✓")} Сигнал закрытия отправлен на TCP-порт ${c.bold(trimmed)}.`);
  } else {
    await client.closeTunnel({ subdomain: trimmed });
    console.log(`${c.green("✓")} Сигнал закрытия отправлен на туннель ${c.bold(trimmed)}.`);
  }
}
