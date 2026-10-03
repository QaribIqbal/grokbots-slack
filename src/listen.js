#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadEnv } from "./env.js";
import { handleIncoming, repostCrewMessage } from "./relay.js";
import { CONTENT_CHANNEL } from "./roles.js";
import { slackApi } from "./slack.js";

loadEnv();

const SEEN_PATH = new URL("../inbox/relayed.json", import.meta.url);
const LOCK_EMOJI = "arrows_counterclockwise";

function loadSeen() {
  try {
    const data = JSON.parse(readFileSync(SEEN_PATH, "utf8"));
    return new Set(Array.isArray(data.ts) ? data.ts : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen) {
  mkdirSync(new URL("../inbox/", import.meta.url), { recursive: true });
  const ts = [...seen].slice(-500);
  writeFileSync(SEEN_PATH, JSON.stringify({ ts }, null, 2));
}

async function addLock(token, decision) {
  try {
    await slackApi(token, "reactions.add", {
      channel: decision.channel,
      timestamp: decision.sourceTs,
      name: LOCK_EMOJI,
    });
    return true;
  } catch (error) {
    if (error.message.includes("already_reacted")) return false;
    console.error(`lock skipped: ${error.message}`);
    return true;
  }
}

async function removeLock(token, decision) {
  try {
    await slackApi(token, "reactions.remove", {
      channel: decision.channel,
      timestamp: decision.sourceTs,
      name: LOCK_EMOJI,
    });
  } catch (error) {
    console.error(`unlock skipped: ${error.message}`);
  }
}

function listenToken() {
  return process.env.SLACK_APP_TOKEN_MAESTRO || process.env.SLACK_APP_TOKEN || "";
}

export async function openSocket(appToken, onEvent) {
  const data = await slackApi(appToken, "apps.connections.open", {});
  const ws = new WebSocket(data.url);
  await new Promise((resolve, reject) => {
    const fail = (error) => reject(error instanceof Error ? error : new Error(String(error)));
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", fail, { once: true });
  });

  ws.addEventListener("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.data);
    } catch {
      return;
    }
    if (msg.envelope_id) {
      ws.send(JSON.stringify({ envelope_id: msg.envelope_id }));
    }
    if (msg.type === "hello") {
      console.log(`socket hello connections=${msg.num_connections ?? "?"}`);
    }
    if (msg.type === "disconnect") {
      console.error(`socket disconnect ${msg.reason || ""}`.trim());
      ws.close();
      return;
    }
    const event = msg.payload?.event;
    if (!event) return;
    if (event.channel === CONTENT_CHANNEL.id && (event.type === "message" || !event.type)) {
      console.log(
        `saw message user=${event.user || "-"} bot=${event.bot_id || "-"} subtype=${event.subtype || "-"} ts=${event.ts || "-"}`,
      );
    }
    onEvent(event).catch((error) => {
      console.error(`event failed: ${error.message}`);
    });
  });

  return ws;
}

async function main() {
  const appToken = listenToken();
  if (!appToken) {
    console.error("No Maestro app token. Socket Mode needs SLACK_APP_TOKEN_MAESTRO (xapp-).");
    process.exitCode = 2;
    return;
  }
  const seen = loadSeen();
  const lockToken = process.env.SLACK_BOT_TOKEN_MAESTRO || process.env.SLACK_BOT_TOKEN;

  let chain = Promise.resolve();
  const onEvent = (event) => {
    chain = chain
      .then(async () => {
        if (event.type && event.type !== "message" && event.type !== "app_mention") return;
        const outcome = await handleIncoming(event, {
          seen,
          lock: lockToken
            ? (decision) => addLock(lockToken, decision)
            : undefined,
          forget: lockToken ? (decision) => removeLock(lockToken, decision) : undefined,
          post: (decision) => repostCrewMessage(decision, { slack: slackApi }),
        });
        if (outcome.action === "relayed") {
          saveSeen(seen);
          console.log(
            `relayed ${outcome.roleKey} as app message ${outcome.ts} from ${outcome.sourceTs}`,
          );
        }
      })
      .catch((error) => {
        console.error(`event failed: ${error.message}`);
      });
    return chain;
  };

  let stopped = false;
  const shutdown = () => {
    stopped = true;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (!stopped) {
    let ws;
    try {
      ws = await openSocket(appToken, onEvent);
      console.log("listening on #content");
      await new Promise((resolve) => {
        ws.addEventListener("close", resolve, { once: true });
        const timer = setInterval(() => {
          if (stopped) {
            clearInterval(timer);
            ws.close();
          }
        }, 500);
        ws.addEventListener("close", () => clearInterval(timer), { once: true });
      });
    } catch (error) {
      console.error(`socket error: ${error.message}`);
    }
    if (!stopped) {
      console.error("reconnecting");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
