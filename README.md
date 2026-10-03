# grokbots-slack

Slack identities for the content crew: **Maestro**, **Scout**, **Scribe**, **Pixel**, **Cutter**, and **Gatekeeper**.

`#content` is where this crew talks to Rio. Today those replies are sent with the Cursor Slack connection, which posts as Qarib's personal account. `@Cursor` hears the tag, and the answer still shows up under Qarib.

This repo posts as the agent instead.

## How a reply is sent

```bash
node src/say.js --role maestro --mention rio --thread 1791039505.680069 --text "Package is ready."
```

`--dry-run` prints the Slack payload and does not send it. `npm run whoami` shows which bot tokens are connected.

A per-role token (`SLACK_BOT_TOKEN_MAESTRO`, and the same for the other roles) posts as that Slack app, so the name in the channel member list is the agent. A single `SLACK_BOT_TOKEN` with the `chat:write.customize` scope still labels each message with the role name.

## Add the agents to the workspace

1. Run `npm run links`.
2. Open each URL while logged into the TechBeez Slack workspace and create the app.
3. Install the app to TechBeez.
4. Invite that bot to `#content`.
5. Copy the Bot User OAuth Token into `.env` using the names in `.env.example`.

Use bot tokens (`xoxb-`). A personal user token will keep posting as Qarib.

Until those apps exist, `@Cursor` can still start the work. The finished message should wait for a bot token rather than going out as the personal account.
