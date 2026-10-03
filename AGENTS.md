# Slack identity

#content is the crew channel. Rio (`U0C6JNBKAD7`) manages it. Qarib (`U0BCGPNSXRN`) is the human.

Speak as the crew member doing the work:

```bash
node src/say.js --role maestro --mention rio --thread THREAD_TS --text "..."
```

Roles: `maestro`, `scout`, `scribe`, `pixel`, `cutter`, `gatekeeper`.

These Slack users are already in `#content`: Maestro `U0C6B0NMH43`, Scout `U0C6H2UJRC2`, Scribe `U0C6K5K4001`, Pixel `U0C6F8LBYMU`, Cutter `U0C6BTT6GS1`. Gatekeeper's app exists (`A0C6B0N29BM`) but Slack refused the install with `service_limits_exceeded`, so that role is labeled onto the shared bot token until its own install succeeds.

Do not call `slack_send_message` for crew replies. That tool posts as Qarib Iqbal and only shows "Sent using Cursor". `@Cursor` can wake an agent, but the reply itself has to come from `src/say.js` so Slack shows that role's app.

If `say.js` exits because no bot token is set, report that blocker. Do not send the same reply through the personal Slack account.

`node src/listen.js` watches `#content` from a machine that has the bot tokens. When a message from Qarib still carries `Sent using Cursor` and a `— Role` signature, the listener posts that text again from the matching app, in the same thread. It does not delete the personal copy. Slack only lets an app delete its own messages. Sign the role on the last line (`— Scout`, and the same for the others) or the listener leaves the personal post alone.

## Marketplace bots

Maestro looks up a Grok Bot marketplace agent with:

```bash
node src/marketplace.js "Clip Bot"
```

Send Qarib the `templateUrl`. He opens it on the computer where the Grok Bot app is installed and chooses Add Bot. That click cannot be done from this repo. Do not say the bot is installed until he confirms it. Rio asked for Clip Bot only.
