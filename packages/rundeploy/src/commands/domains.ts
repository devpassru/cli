import { type CommonFlags, createAuthenticatedClient, resolveTargetProjectId } from "../context.js";
import { c } from "../ui.js";

export async function runDomainsCommand(
  subcommand: string | undefined,
  args: string[],
  flags: CommonFlags,
): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const { projectId } = await resolveTargetProjectId(client, flags);

  const action = subcommand || "ls";

  if (action === "ls" || action === "list") {
    const { domains, cnameTarget, serverIp } = await client.listDomains(projectId);
    console.log(c.bold(`Домены проекта (${domains.length}):`));
    if (domains.length === 0) {
      console.log(c.dim("  Кастомные домены не привязаны."));
      return;
    }
    for (const d of domains) {
      const dns = d.dnsStatus === "verified" ? c.green("DNS ok") : c.yellow(`DNS ${d.dnsStatus}`);
      const ssl =
        d.sslStatus === "active"
          ? c.green("SSL active")
          : d.sslStatus === "issuing"
            ? c.cyan("SSL issuing")
            : c.dim(`SSL ${d.sslStatus}`);
      console.log(`  ${c.bold(d.domain)} [${dns} | ${ssl}] ${c.dim(`(${d.id})`)}`);
    }
    console.log(c.dim(`  CNAME: ${cnameTarget}${serverIp ? ` | A: ${serverIp}` : ""}`));
    return;
  }

  if (action === "add") {
    const domain = args[0]?.trim().toLowerCase();
    if (!domain) {
      throw new Error("Использование: rundeploy domains add <domain>");
    }
    const res = await client.addDomain(projectId, domain);
    console.log(`${c.green("✓")} Домен ${c.bold(res.domain.domain)} добавлен.`);
    console.log(
      `  Настройте у регистратора: ${c.cyan(
        `CNAME ${res.instructions.cname.host} -> ${res.instructions.cname.target}`,
      )}`,
    );
    if (res.instructions.aRecord) {
      console.log(
        `  Или для корневого домена: ${c.cyan(
          `A ${res.instructions.aRecord.host} -> ${res.instructions.aRecord.ip}`,
        )}`,
      );
    }
    console.log(c.dim(`  Затем выполните: rundeploy domains verify ${res.domain.domain}`));
    return;
  }

  if (action === "verify") {
    const target = args[0]?.trim().toLowerCase();
    if (!target) {
      throw new Error("Использование: rundeploy domains verify <domain|dom_id>");
    }
    const { domains } = await client.listDomains(projectId);
    const match = domains.find((d) => d.id === target || d.domain === target);
    if (!match) {
      throw new Error(`Домен "${target}" не найден в этом проекте.`);
    }
    const res = await client.verifyDomain(projectId, match.id);
    if (res.verification.verified) {
      console.log(
        `${c.green("✓")} DNS для ${c.bold(res.domain.domain)} подтвержден. Выпускается SSL-сертификат.`,
      );
    } else {
      throw new Error(res.verification.error || "DNS пока не настроен.");
    }
    return;
  }

  if (action === "rm" || action === "delete") {
    const target = args[0]?.trim().toLowerCase();
    if (!target) {
      throw new Error("Использование: rundeploy domains rm <domain|dom_id>");
    }
    const { domains } = await client.listDomains(projectId);
    const match = domains.find((d) => d.id === target || d.domain === target);
    if (!match) {
      throw new Error(`Домен "${target}" не найден в этом проекте.`);
    }
    await client.deleteDomain(projectId, match.id);
    console.log(`${c.green("✓")} Домен ${c.bold(match.domain)} удален.`);
    return;
  }

  throw new Error(`Неизвестная подкоманда domains: ${action}. Доступны: ls, add, verify, rm.`);
}
