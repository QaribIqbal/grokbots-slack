export async function slackApi(token, method, body) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json();
  if (!data.ok) {
    const hint =
      data.error === "missing_scope" && body?.username
        ? " Add chat:write.customize to the app and reinstall it."
        : "";
    const detail = data.response_metadata?.messages?.filter(Boolean).join(" ");
    throw new Error(
      `Slack ${method} failed: ${data.error}${detail ? ` (${detail})` : ""}.${hint}`,
    );
  }
  return data;
}
