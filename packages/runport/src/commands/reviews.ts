import { c } from "@devpass/cli-core";
import { type CommonFlags, createAuthenticatedClient } from "../context.js";

export async function runReviewsCommand(
  subcommand: string | undefined,
  args: string[],
  flags: CommonFlags & { subdomain?: string; status?: "open" | "resolved" },
): Promise<void> {
  const client = await createAuthenticatedClient(flags);
  const action = subcommand || "ls";

  switch (action) {
    case "ls":
    case "list": {
      const res = await client.listReviews({
        subdomain: flags.subdomain,
        status: flags.status,
      });
      if (res.reviews.length === 0) {
        console.log(c.dim("Комментариев ревью не найдено."));
        return;
      }
      for (const r of res.reviews) {
        const badge = r.status === "open" ? c.yellow("open") : c.green("resolved");
        console.log(
          `#${r.review_number} [${badge}] ${c.bold(`${r.subdomain}.runport.ru${r.path}`)} ${c.dim(`(${r.id})`)}`,
        );
        console.log(`   ${r.comment}`);
        if (r.selector) {
          console.log(`   ${c.dim(`selector: ${r.selector}`)}`);
        }
      }
      if (res.hiddenCount > 0) {
        console.log(
          c.dim(
            `\nСкрыто отзывов на бесплатном тарифе: ${res.hiddenCount}. Полный доступ на Pro/Business.`,
          ),
        );
      }
      break;
    }

    case "resolve": {
      const id = args[0];
      if (!id) {
        throw new Error("Укажите ID комментария: `runport reviews resolve <id>`.");
      }
      await client.resolveReview(id);
      console.log(`${c.green("✓")} Комментарий ${c.bold(id)} отмечен как resolved.`);
      break;
    }

    default:
      throw new Error(`Неизвестная подкоманда reviews: "${action}". Используйте: ls, resolve.`);
  }
}
