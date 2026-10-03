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
    throw new Error(`Slack ${method} failed: ${data.error}.${hint}`);
  }
  return data;
}
