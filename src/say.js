#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadEnv } from "./env.js";
import { CONTENT_CHANNEL, ROLE_KEYS } from "./roles.js";
import { buildPayload, resolveIdentity } from "./payload.js";
import { slackApi } from "./slack.js";

loadEnv();

const { values } = parseArgs({
  options: {
    role: { type: "string" },
    text: { type: "string" },
    channel: { type: "string", default: CONTENT_CHANNEL.id },
    thread: { type: "string" },
    mention: { type: "string" },
    "no-sign": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    whoami: { type: "boolean", default: false },
  },
  strict: true,
});

async function whoami() {
  const seen = new Set();
  const lines = [];
  for (const roleKey of ROLE_KEYS) {
    const identity = resolveIdentity(roleKey);
    if (!identity.token || seen.has(identity.token)) continue;
    seen.add(identity.token);
    const auth = await slackApi(identity.token, "auth.test", {});
    lines.push(
      `${identity.mode === "member" ? roleKey : "shared"}  ${auth.user} (${auth.user_id})  team ${auth.team}`,
    );
  }
  if (lines.length === 0) {
    console.error(
      "No Slack bot token is set. Add SLACK_BOT_TOKEN or SLACK_BOT_TOKEN_MAESTRO (and the other roles) from a bot user, not a personal user token.",
    );
    process.exitCode = 2;
    return;
  }
  console.log(lines.join("\n"));
}

async function main() {
  if (values.whoami) {
    await whoami();
    return;
  }
  if (!values.role || !values.text) {
    console.error(
      "Usage: node src/say.js --role maestro --text \"...\" [--thread TS] [--mention rio] [--channel C...] [--dry-run]",
    );
    process.exitCode = 2;
    return;
  }

  const { identity, payload } = buildPayload({
    roleKey: values.role,
    text: values.text,
    channel: values.channel,
    threadTs: values.thread,
    mentionPerson: values.mention,
    sign: !values["no-sign"],
  });

  if (values["dry-run"] || identity.mode === "missing") {
    console.log(
      JSON.stringify(
        {
          ok: identity.mode !== "missing",
          mode: identity.mode,
          role: identity.role.displayName,
          payload,
          note:
            identity.mode === "missing"
              ? "No bot token. This would still post as Qarib if sent through the Slack user plugin. Set a bot token first."
              : undefined,
        },
        null,
        2,
      ),
    );
    if (identity.mode === "missing" && !values["dry-run"]) process.exitCode = 2;
    return;
  }

  const result = await slackApi(identity.token, "chat.postMessage", payload);
  console.log(result.ts);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
