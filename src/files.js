import { closeSync, createWriteStream, mkdirSync, openSync, readSync, statSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { loadEnv } from "./env.js";
import { resolveIdentity } from "./payload.js";

const SLACK_HOST = /(^|\.)slack\.com$/i;

export function parseFileId(input) {
  const text = String(input || "").trim();
  if (/^F[A-Z0-9]{8,}$/.test(text)) return text;
  const fromPath = text.match(/\/(F[A-Z0-9]{8,})(?:\/|$|\?)/);
  if (fromPath) return fromPath[1];
  const loose = text.match(/\b(F[A-Z0-9]{8,})\b/);
  if (loose) return loose[1];
  throw new Error("Give a Slack file id like F0C6GSCS8UA, or a Slack file link that contains one.");
}

export function looksLikeHtml(bytes) {
  const head = Buffer.from(bytes.subarray(0, 64)).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<a href=");
}

export function hasFtyp(bytes) {
  return bytes.length > 12 && Buffer.from(bytes.subarray(4, 8)).toString("ascii") === "ftyp";
}

export function assertDownloaded(bytes, { size, mimetype, name } = {}) {
  if (looksLikeHtml(bytes)) {
    throw new Error("Slack returned a login page instead of the file. Send the bot token on the download request.");
  }
  if (size != null && bytes.length !== size) {
    throw new Error(
      `Downloaded ${bytes.length} bytes, Slack lists ${size}. The file was truncated or read as text.`,
    );
  }
  const video = mimetype === "video/mp4" || String(name || "").toLowerCase().endsWith(".mp4");
  if (video && !hasFtyp(bytes)) {
    throw new Error("Downloaded bytes are not an MP4. The ftyp header is missing.");
  }
}

function authHeaders(url, token) {
  return SLACK_HOST.test(new URL(url).hostname) ? { Authorization: `Bearer ${token}` } : {};
}

export async function slackForm(token, method, params) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data = await response.json();
  if (!data.ok) {
    const detail = data.response_metadata?.messages?.filter(Boolean).join(" ");
    throw new Error(`Slack ${method} failed: ${data.error}${detail ? ` (${detail})` : ""}.`);
  }
  return data;
}

/** Follow Slack redirects without dropping the bot token on slack.com, and without sending it to a CDN. */
export async function fetchPrivate(url, token, fetchImpl = fetch) {
  let current = url;
  for (let hop = 0; hop < 5; hop += 1) {
    const response = await fetchImpl(current, {
      redirect: "manual",
      headers: authHeaders(current, token),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    return response;
  }
  throw new Error("Too many redirects downloading the Slack file.");
}

export async function downloadSlackFile({
  file,
  token,
  outPath,
  fetchImpl = fetch,
  form = slackForm,
}) {
  const fileId = parseFileId(file);
  const info = await form(token, "files.info", { file: fileId });
  const meta = info.file;
  const url = meta.url_private_download || meta.url_private;
  if (!url) {
    throw new Error(`Slack file ${fileId} has no private download URL.`);
  }
  const response = await fetchPrivate(url, token, fetchImpl);
  const type = response.headers.get("content-type") || "";
  if (type.includes("text/html")) {
    throw new Error("Slack returned a login page instead of the file. Send the bot token on the download request.");
  }
  mkdirSync(dirname(outPath), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(outPath));
  const size = statSync(outPath).size;
  const head = Buffer.alloc(Math.min(64, size));
  const fd = openSync(outPath, "r");
  try {
    readSync(fd, head, 0, head.length, 0);
  } finally {
    closeSync(fd);
  }
  try {
    if (looksLikeHtml(head)) {
      throw new Error("Slack returned a login page instead of the file. Send the bot token on the download request.");
    }
    if (meta.size != null && size !== meta.size) {
      throw new Error(
        `Downloaded ${size} bytes, Slack lists ${meta.size}. The file was truncated or read as text.`,
      );
    }
    if ((meta.mimetype === "video/mp4" || String(meta.name || "").toLowerCase().endsWith(".mp4")) && !hasFtyp(head)) {
      throw new Error("Downloaded bytes are not an MP4. The ftyp header is missing.");
    }
  } catch (error) {
    unlinkSync(outPath);
    throw error;
  }
  return {
    fileId,
    name: meta.name,
    mimetype: meta.mimetype,
    bytes: size,
    path: outPath,
  };
}

async function main() {
  loadEnv();
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      role: { type: "string", default: "maestro" },
      file: { type: "string" },
      out: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const file = values.file || positionals[0];
  if (!file) {
    console.error("Usage: node src/files.js --role cutter --file F0C6GSCS8UA --out inbox/cutter-test.mp4");
    process.exitCode = 2;
    return;
  }
  const identity = resolveIdentity(values.role);
  if (!identity.token) {
    console.error(`No bot token for ${values.role}. Refusing to download with a personal Slack login.`);
    process.exitCode = 2;
    return;
  }
  if (values["dry-run"]) {
    const info = await slackForm(identity.token, "files.info", { file: parseFileId(file) });
    const meta = info.file;
    console.log(JSON.stringify({ fileId: meta.id, name: meta.name, mimetype: meta.mimetype, bytes: meta.size }, null, 2));
    return;
  }
  const fileId = parseFileId(file);
  const preview = await slackForm(identity.token, "files.info", { file: fileId });
  const outPath = values.out || `inbox/${preview.file.name || fileId}`;
  const saved = await downloadSlackFile({
    file: fileId,
    token: identity.token,
    outPath,
    form: async () => preview,
  });
  console.log(JSON.stringify(saved, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
