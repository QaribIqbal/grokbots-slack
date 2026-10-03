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

## Apps in TechBeez

Maestro, Scout, Scribe, Pixel, and Cutter are installed and are members of `#content`. Gatekeeper's app is created, and Slack returned `service_limits_exceeded` on install, so that name is applied with `chat:write.customize` until the install succeeds.

Bot tokens live in `.env` on the machine that posts. They are not committed. `npm run whoami` prints the connected bot users.

`npm run links` prints create-app URLs if an app has to be rebuilt. Use bot tokens (`xoxb-`). A personal user token will keep posting as Qarib.

## Marketplace agents

```bash
node src/marketplace.js "Clip Bot"
```

This finds the official Add link. The Grok Bot app on Qarib's computer has to finish Add Bot. Maestro cannot complete that click from here.
