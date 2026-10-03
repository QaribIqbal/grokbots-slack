import { CONTENT_CHANNEL, PEOPLE, ROLE_KEYS, ROLES } from "./roles.js";
import { buildPayload } from "./payload.js";

const ROLE_NAMES = ROLE_KEYS.map((key) => ROLES[key].displayName).join("|");
const SIGNATURE = new RegExp(`^[—–-]\\s*(${ROLE_NAMES})\\s*$`, "i");

function meaningfulLines(text) {
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isSentUsingLine(line) {
  return /^(\*|_)?sent using\b/i.test(String(line).trim());
}

/** Cursor's user connection adds this footer. A human @Cursor ping does not. */
export function isCursorClientPost(text) {
  const tail = meaningfulLines(text).slice(-3).join("\n");
  if (!/sent using/i.test(tail)) return false;
  return new RegExp(PEOPLE.cursor.id, "i").test(tail) || /\bcursor\b/i.test(tail);
}

export function stripSentUsing(text) {
  return String(text)
    .split("\n")
    .filter((line) => !isSentUsingLine(line))
    .join("\n")
    .trim();
}

export function roleFromSignature(text) {
  const lines = meaningfulLines(text).slice(-4);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = lines[i].match(SIGNATURE);
    if (!match) continue;
    const name = match[1].toLowerCase();
    return ROLE_KEYS.find((key) => ROLES[key].displayName.toLowerCase() === name) ?? null;
  }
  return null;
}

/**
 * A crew reply that went out on Qarib's account.
 * Returns null for bots, Rio, human notes, and unsigned Cursor posts.
 */
export function classifyCrewPost(event) {
  if (!event || event.bot_id || event.subtype) return null;
  if (event.user !== PEOPLE.qarib.id) return null;
  if (event.channel && event.channel !== CONTENT_CHANNEL.id) return null;
  const text = event.text || "";
  if (!isCursorClientPost(text)) return null;
  const body = stripSentUsing(text);
  const roleKey = roleFromSignature(body);
  if (!roleKey || !body) return null;
  return {
    roleKey,
    text: body,
    channel: event.channel || CONTENT_CHANNEL.id,
    threadTs: event.thread_ts || undefined,
    sourceTs: event.ts,
  };
}

export async function repostCrewMessage(decision, { env = process.env, slack }) {
  const { identity, payload } = buildPayload({
    roleKey: decision.roleKey,
    text: decision.text,
    channel: decision.channel,
    threadTs: decision.threadTs,
    sign: true,
    env,
  });
  if (identity.mode === "missing") {
    throw new Error(`No bot token for ${decision.roleKey}. Refusing to post as Qarib.`);
  }
  const result = await slack(identity.token, "chat.postMessage", payload);
  return { identity, payload, result };
}

export async function handleIncoming(event, { seen, post, lock, forget }) {
  const decision = classifyCrewPost(event);
  if (!decision) return { action: "ignore" };
  if (seen?.has(decision.sourceTs)) return { action: "ignore", reason: "seen" };
  if (lock && !(await lock(decision))) return { action: "ignore", reason: "locked" };
  seen?.add(decision.sourceTs);
  try {
    const posted = await post(decision);
    return {
      action: "relayed",
      roleKey: decision.roleKey,
      ts: posted?.result?.ts ?? posted?.ts,
      sourceTs: decision.sourceTs,
    };
  } catch (error) {
    seen?.delete(decision.sourceTs);
    if (forget) await forget(decision);
    throw error;
  }
}
