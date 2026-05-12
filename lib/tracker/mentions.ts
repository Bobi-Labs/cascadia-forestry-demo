import { createAdminClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "./telegram";

/**
 * Parse @mentions from text content.
 * Matches patterns like @Bees, @Jaime (case-insensitive).
 * Returns array of display names mentioned.
 */
export function parseMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))]; // Remove @ prefix, dedupe
}

/**
 * Notify mentioned users via Telegram DM.
 * Looks up each mentioned name in tracker_users, sends a DM if they have telegram_chat_id set.
 */
export async function notifyMentionedUsers(
  projectId: string,
  author: string,
  text: string,
  context: "note" | "chat" = "chat",
): Promise<void> {
  const mentions = parseMentions(text);
  if (mentions.length === 0) return;

  const admin = createAdminClient();

  // Get telegram config for bot token
  const { data: config } = await admin
    .from("tracker_telegram_config")
    .select("bot_token")
    .eq("project_id", projectId)
    .single();

  if (!config?.bot_token) return;

  // Look up mentioned users (case-insensitive match on display_name)
  const { data: users } = await admin
    .from("tracker_users")
    .select("display_name, telegram_chat_id");

  if (!users) return;

  // Match mentioned names to users
  for (const mention of mentions) {
    const user = users.find(
      (u) => u.display_name.toLowerCase() === mention.toLowerCase(),
    );

    if (user?.telegram_chat_id) {
      // Don't notify yourself
      if (user.display_name.toLowerCase() === author.toLowerCase()) continue;

      const snippet = text.length > 100 ? text.slice(0, 100) + "..." : text;
      const contextLabel = context === "note" ? "a note" : "the chat";
      const message = `📌 *${author}* mentioned you in ${contextLabel}:\n\n${snippet}`;

      await sendTelegramMessage(user.telegram_chat_id, config.bot_token, message).catch(
        () => {},
      );
    }
  }
}
