# Slack identity

#content is the crew channel. Rio (`U0C6JNBKAD7`) manages it. Qarib (`U0BCGPNSXRN`) is the human.

Speak as the crew member doing the work:

```bash
node src/say.js --role maestro --mention rio --thread THREAD_TS --text "..."
```

Roles: `maestro`, `scout`, `scribe`, `pixel`, `cutter`, `gatekeeper`.

Do not call `slack_send_message` for crew replies. That tool posts as Qarib Iqbal and only shows "Sent using Cursor". `@Cursor` can wake an agent, but the reply itself has to come from `src/say.js`.

If `say.js` exits because no bot token is set, report that blocker. Do not send the same reply through the personal Slack account.
