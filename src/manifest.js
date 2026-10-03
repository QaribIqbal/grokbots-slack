import { ROLES } from "./roles.js";

const BOT_SCOPES = [
  "app_mentions:read",
  "channels:history",
  "channels:join",
  "channels:read",
  "chat:write",
  "chat:write.customize",
  "files:read",
  "files:write",
  "groups:history",
  "groups:read",
  "im:history",
  "im:read",
  "im:write",
  "mpim:history",
  "mpim:read",
  "reactions:read",
  "reactions:write",
  "users:read",
];

export function appManifest({ name, description }) {
  return {
    display_information: {
      name,
      description,
      background_color: "#0A0F0D",
    },
    features: {
      bot_user: {
        display_name: name,
        always_online: true,
      },
    },
    oauth_config: {
      scopes: {
        bot: BOT_SCOPES,
      },
    },
    settings: {
      event_subscriptions: {
        bot_events: [
          "app_mention",
          "message.channels",
          "message.groups",
          "message.im",
        ],
      },
      interactivity: {
        is_enabled: true,
      },
      org_deploy_enabled: false,
      socket_mode_enabled: true,
      token_rotation_enabled: false,
    },
  };
}

export function roleManifest(role) {
  return appManifest({
    name: role.displayName,
    description: role.description,
  });
}

export function crewManifests() {
  return Object.values(ROLES).map((role) => ({
    role,
    manifest: roleManifest(role),
  }));
}

export function createAppUrl(manifest) {
  return `https://api.slack.com/apps?new_app=1&manifest_json=${encodeURIComponent(JSON.stringify(manifest))}`;
}
