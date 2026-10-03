import { CONTENT_CHANNEL, PEOPLE, getRole } from "./roles.js";

/**
 * Pick how this role will appear in Slack.
 * A per-role bot token posts as that app, so the name in the member list is the agent.
 * A shared bot token needs chat:write.customize and sets the name on each message.
 */
export function resolveIdentity(roleKey, env = process.env) {
  const role = getRole(roleKey);
  const own = env[`SLACK_BOT_TOKEN_${role.key.toUpperCase()}`];
  if (own) {
    return { role, token: own, mode: "member" };
  }
  if (env.SLACK_BOT_TOKEN) {
    return { role, token: env.SLACK_BOT_TOKEN, mode: "customize" };
  }
  return { role, token: null, mode: "missing" };
}

/** Slack incoming text is mrkdwn, not standard Markdown. */
export function toSlackText(text) {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "<$2|$1>");
}

export function mention(personKey) {
  const person = PEOPLE[personKey];
  if (!person) {
    throw new Error(
      `Unknown person "${personKey}". Use one of: ${Object.keys(PEOPLE).join(", ")}`,
    );
  }
  return `<@${person.id}>`;
}

export function withSignature(text, role) {
  const sign = `— ${role.displayName}`;
  if (text.includes(sign)) return text;
  return `${text.trimEnd()}\n\n${sign}`;
}

export function buildPayload({
  roleKey,
  text,
  channel = CONTENT_CHANNEL.id,
  threadTs,
  mentionPerson,
  sign = true,
  env = process.env,
}) {
  const identity = resolveIdentity(roleKey, env);
  let body = toSlackText(text).trim();
  if (!body) {
    throw new Error("Message text is empty");
  }
  if (mentionPerson) {
    const tag = mention(mentionPerson);
    if (!body.includes(tag)) {
      body = `${tag} ${body}`;
    }
  }
  if (sign) {
    body = withSignature(body, identity.role);
  }

  const payload = {
    channel,
    text: body,
  };
  if (threadTs) payload.thread_ts = threadTs;
  if (identity.mode === "customize") {
    payload.username = identity.role.displayName;
    payload.icon_emoji = identity.role.emoji;
  }
  return { identity, payload };
}
