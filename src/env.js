import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { ROLE_KEYS, ROLES } from "./roles.js";

export function loadEnvFile(env = process.env, filePath) {
  const path = filePath ?? new URL("../.env", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && env[key] === undefined) env[key] = value;
  }
}

/** Fill missing bot and app tokens from the local Slack CLI install record. */
export function loadCrewApps(env = process.env, filePath) {
  const path = filePath ?? `${homedir()}/.slack/crew-apps.json`;
  if (!existsSync(path)) return;
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const roleKey of ROLE_KEYS) {
    const record = data[ROLES[roleKey].displayName];
    if (!record) continue;
    const botKey = `SLACK_BOT_TOKEN_${roleKey.toUpperCase()}`;
    const appKey = `SLACK_APP_TOKEN_${roleKey.toUpperCase()}`;
    if (record.bot_token && env[botKey] === undefined) env[botKey] = record.bot_token;
    if (record.app_token && env[appKey] === undefined) env[appKey] = record.app_token;
  }
  if (env.SLACK_BOT_TOKEN === undefined && env.SLACK_BOT_TOKEN_MAESTRO) {
    env.SLACK_BOT_TOKEN = env.SLACK_BOT_TOKEN_MAESTRO;
  }
}

export function loadEnv(env = process.env) {
  loadEnvFile(env);
  loadCrewApps(env);
}
