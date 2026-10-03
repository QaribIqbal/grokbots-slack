import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertDownloaded,
  downloadSlackFile,
  hasFtyp,
  looksLikeHtml,
  parseFileId,
} from "../src/files.js";

test("file ids come from a bare id or a Slack link", () => {
  assert.equal(parseFileId("F0C6GSCS8UA"), "F0C6GSCS8UA");
  assert.equal(
    parseFileId("https://files.slack.com/files-pri/T0BB7191ZK9-F0C6GSCS8UA/cutter-test.mp4"),
    "F0C6GSCS8UA",
  );
  assert.equal(
    parseFileId("https://techbeezworkspace.slack.com/files/U0C6JNBKAD7/F0C6GSCS8UA/cutter-test.mp4"),
    "F0C6GSCS8UA",
  );
  assert.throws(() => parseFileId("not a file"), /file id/);
});

test("a login page and a short download are rejected", () => {
  const html = Buffer.from("<a href=\"https://example.slack.com\">login</a>");
  assert.equal(looksLikeHtml(html), true);
  assert.throws(() => assertDownloaded(html, { size: html.length, mimetype: "video/mp4", name: "a.mp4" }), /login page/);
  const mp4 = Buffer.alloc(32);
  mp4.write("ftyp", 4, "ascii");
  assert.equal(hasFtyp(mp4), true);
  assert.throws(() => assertDownloaded(mp4, { size: 751585, mimetype: "video/mp4", name: "a.mp4" }), /751585/);
});

test("a redirect on slack.com keeps the bot token and the bytes are written whole", async () => {
  const mp4 = Buffer.alloc(32);
  mp4.write("ftyp", 4, "ascii");
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, authorization: init.headers.Authorization, redirect: init.redirect });
    if (url === "https://files.slack.com/start") {
      return {
        status: 302,
        ok: false,
        headers: { get: (name) => (name === "location" ? "https://files.slack.com/files-pri/T-F123/a.mp4" : null) },
      };
    }
    return {
      status: 200,
      ok: true,
      headers: { get: (name) => (name === "content-type" ? "video/mp4" : null) },
      body: new Blob([mp4]).stream(),
    };
  };
  const dir = mkdtempSync(join(tmpdir(), "slack-file-"));
  const outPath = join(dir, "clip.mp4");
  try {
    const saved = await downloadSlackFile({
      file: "F0C6GSCS8UA",
      token: "xoxb-test",
      outPath,
      fetchImpl,
      form: async () => ({
        file: {
          id: "F0C6GSCS8UA",
          name: "clip.mp4",
          mimetype: "video/mp4",
          size: mp4.length,
          url_private_download: "https://files.slack.com/start",
        },
      }),
    });
    assert.equal(saved.bytes, mp4.length);
    assert.equal(readFileSync(outPath).compare(mp4), 0);
    assert.equal(calls[0].redirect, "manual");
    assert.equal(calls[1].authorization, "Bearer xoxb-test");
    assert.match(calls[1].url, /files-pri/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a redirect off slack.com does not send the bot token", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, authorization: init.headers.Authorization ?? null });
    if (url.startsWith("https://files.slack.com/")) {
      return {
        status: 302,
        ok: false,
        headers: { get: (name) => (name === "location" ? "https://cdn.example/signed.mp4" : null) },
      };
    }
    const mp4 = Buffer.alloc(16);
    mp4.write("ftyp", 4, "ascii");
    return {
      status: 200,
      ok: true,
      headers: { get: (name) => (name === "content-type" ? "video/mp4" : null) },
      body: new Blob([mp4]).stream(),
    };
  };
  const dir = mkdtempSync(join(tmpdir(), "slack-cdn-"));
  try {
    await downloadSlackFile({
      file: "https://files.slack.com/files-pri/T-F0C6GSCS8UA/a.mp4",
      token: "xoxb-test",
      outPath: join(dir, "a.mp4"),
      fetchImpl,
      form: async () => ({
        file: {
          id: "F0C6GSCS8UA",
          name: "a.mp4",
          mimetype: "video/mp4",
          size: 16,
          url_private: "https://files.slack.com/files-pri/T-F0C6GSCS8UA/download",
        },
      }),
    });
    assert.equal(calls.at(-1).authorization, null);
    assert.equal(calls.at(-1).url, "https://cdn.example/signed.mp4");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
