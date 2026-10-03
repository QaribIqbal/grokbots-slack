import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT_CHANNEL, PEOPLE } from "../src/roles.js";
import {
  classifyCrewPost,
  handleIncoming,
  isCursorClientPost,
  stripSentUsing,
} from "../src/relay.js";
import { buildPayload } from "../src/payload.js";

const CURSOR_FOOTER = `*Sent using* <@${PEOPLE.cursor.id}|Cursor>`;

function qaribMessage(text, extra = {}) {
  return {
    type: "message",
    channel: CONTENT_CHANNEL.id,
    user: PEOPLE.qarib.id,
    text,
    ts: "1791041718.936389",
    ...extra,
  };
}

test("a signed Cursor footer is a crew post for that role", () => {
  const text = `<@${PEOPLE.rio.id}> Clip Bot stays on its lane.\n\n— Scout\n${CURSOR_FOOTER}`;
  const decision = classifyCrewPost(qaribMessage(text, { thread_ts: "1791036580.790939" }));
  assert.equal(decision.roleKey, "scout");
  assert.equal(decision.threadTs, "1791036580.790939");
  assert.equal(decision.channel, CONTENT_CHANNEL.id);
  assert.doesNotMatch(decision.text, /sent using/i);
  assert.match(decision.text, /— Scout$/);
});

test("the relay payload uses that role's app and drops the Cursor footer", () => {
  const decision = classifyCrewPost(
    qaribMessage(`<@${PEOPLE.rio.id}> Package is ready.\n\n— Pixel\n${CURSOR_FOOTER}`),
  );
  const { identity, payload } = buildPayload({
    roleKey: decision.roleKey,
    text: decision.text,
    channel: decision.channel,
    threadTs: decision.threadTs,
    env: { SLACK_BOT_TOKEN_PIXEL: "xoxb-pixel" },
  });
  assert.equal(identity.mode, "member");
  assert.equal(identity.token, "xoxb-pixel");
  assert.equal(payload.username, undefined);
  assert.match(payload.text, /— Pixel$/);
  assert.doesNotMatch(payload.text, /Sent using/);
});

test("plain Sent using Cursor still counts", () => {
  assert.equal(isCursorClientPost("Hello\n\n— Maestro\nSent using Cursor"), true);
  assert.equal(stripSentUsing("Hello\n\n— Maestro\nSent using Cursor"), "Hello\n\n— Maestro");
});

test("human @Cursor pings and Muse notes stay on Qarib's account", () => {
  assert.equal(
    classifyCrewPost(qaribMessage(`<@${PEOPLE.cursor.id}> Maestro — capability test`)),
    null,
  );
  assert.equal(classifyCrewPost(qaribMessage("test\n*Sent using* Muse")), null);
  assert.equal(
    classifyCrewPost(qaribMessage(`Notes\n\n— Maestro\n*Sent using* Muse`)),
    null,
  );
});

test("unsigned Cursor posts are not guessed onto a role", () => {
  assert.equal(classifyCrewPost(qaribMessage(`On it.\n${CURSOR_FOOTER}`)), null);
});

test("bot messages and other people are ignored", () => {
  assert.equal(
    classifyCrewPost(qaribMessage(`Hi\n\n— Maestro\n${CURSOR_FOOTER}`, { bot_id: "B1" })),
    null,
  );
  assert.equal(
    classifyCrewPost(
      qaribMessage(`Hi\n\n— Cutter\n${CURSOR_FOOTER}`, { user: PEOPLE.rio.id }),
    ),
    null,
  );
  assert.equal(
    classifyCrewPost(
      qaribMessage(`Hi\n\n— Gatekeeper\n${CURSOR_FOOTER}`, { subtype: "message_changed" }),
    ),
    null,
  );
});

test("a seen source is posted once", async () => {
  const seen = new Set();
  const posts = [];
  const event = qaribMessage(`Ack\n\n— Gatekeeper\n${CURSOR_FOOTER}`);
  const post = async (decision) => {
    posts.push(decision.roleKey);
    return { result: { ts: "1.2" } };
  };
  const first = await handleIncoming(event, { seen, post });
  const second = await handleIncoming(event, { seen, post });
  assert.equal(first.action, "relayed");
  assert.equal(first.roleKey, "gatekeeper");
  assert.equal(second.reason, "seen");
  assert.deepEqual(posts, ["gatekeeper"]);
});

test("a failed post can be retried", async () => {
  const seen = new Set();
  const event = qaribMessage(`Ack\n\n— Scribe\n${CURSOR_FOOTER}`, { ts: "9.9" });
  await assert.rejects(
    handleIncoming(event, {
      seen,
      post: async () => {
        throw new Error("Slack chat.postMessage failed: ratelimited.");
      },
    }),
  );
  assert.equal(seen.has("9.9"), false);
});
