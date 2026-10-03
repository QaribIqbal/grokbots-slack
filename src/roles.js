/** Crew members that speak in #content, plus the people they talk to. */

export const CONTENT_CHANNEL = {
  id: "C0C6AFD5XH9",
  name: "content",
};

export const PEOPLE = {
  rio: { id: "U0C6JNBKAD7", name: "Rio" },
  cursor: { id: "U0C6BGH3UAH", name: "Cursor" },
  qarib: { id: "U0BCGPNSXRN", name: "Qarib Iqbal" },
};

export const ROLES = {
  maestro: {
    key: "maestro",
    displayName: "Maestro",
    emoji: ":studio_microphone:",
    description: "Runs the content crew and delivers one finished package per job.",
    appId: "A0C7BHSFYNL",
    slackUserId: "U0C6B0NMH43",
  },
  scout: {
    key: "scout",
    displayName: "Scout",
    emoji: ":mag:",
    description: "Checks facts before anyone writes.",
    appId: "A0C6K5H9J7K",
    slackUserId: "U0C6H2UJRC2",
  },
  scribe: {
    key: "scribe",
    displayName: "Scribe",
    emoji: ":writing_hand:",
    description: "Writes the hook, caption, on-image text, and hashtags.",
    appId: "A0C6B0MEB6X",
    slackUserId: "U0C6K5K4001",
  },
  pixel: {
    key: "pixel",
    displayName: "Pixel",
    emoji: ":art:",
    description: "Builds stills and carousels.",
    appId: "A0C6B0MJZPV",
    slackUserId: "U0C6F8LBYMU",
  },
  cutter: {
    key: "cutter",
    displayName: "Cutter",
    emoji: ":movie_camera:",
    description: "Cuts Reels and burns in titles.",
    appId: "A0C6K5HHZ4H",
    slackUserId: "U0C6BTT6GS1",
  },
  gatekeeper: {
    key: "gatekeeper",
    displayName: "Gatekeeper",
    emoji: ":white_check_mark:",
    description: "Passes or fails a finished piece before it reaches Rio.",
    appId: "A0C6B0N29BM",
    slackUserId: null,
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

export function getRole(roleKey) {
  const role = ROLES[String(roleKey || "").toLowerCase()];
  if (!role) {
    throw new Error(
      `Unknown role "${roleKey}". Use one of: ${ROLE_KEYS.join(", ")}`,
    );
  }
  return role;
}
