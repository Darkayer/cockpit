/**
 * lib/jira.js
 *
 * Server-side Jira Cloud adapter.
 * Alle API-aanroepen lopen via de backend — nooit direct vanuit de browser.
 */

const JIRA_API_BASE = `https://api.atlassian.com/ex/jira`;

/**
 * Haal de Atlassian Cloud ID op (nodig als prefix voor alle API-calls)
 */
export async function getCloudId(accessToken) {
  const res = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Atlassian resources fout: ${res.status}`);
  const sites = await res.json();
  if (!sites.length) throw new Error("Geen toegankelijke Jira-sites gevonden");
  return sites[0].id; // Gebruik de eerste site; uitbreiden voor multi-site ondersteuning
}

/**
 * Haal alle Jira-items op die aan de ingelogde gebruiker zijn toegewezen,
 * gesorteerd op prioriteit en sprint.
 */
export async function getMyIssues(accessToken) {
  const cloudId = await getCloudId(accessToken);

  const jql = encodeURIComponent(
    `assignee = currentUser() AND statusCategory != Done ORDER BY priority ASC, updated DESC`
  );

  const fields = [
    "summary", "status", "priority", "assignee",
    "sprint", "description", "comment", "updated",
    "issuetype", "project", "parent",
  ].join(",");

  const res = await fetch(
    `${JIRA_API_BASE}/${cloudId}/rest/api/3/search?jql=${jql}&fields=${fields}&maxResults=50`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Jira issues fout: ${res.status}`);

  const data = await res.json();
  return data.issues.map(normalizeIssue);
}

/**
 * Voeg een comment toe aan een Jira-item (Atlassian Document Format).
 */
export async function addComment(accessToken, issueKey, text) {
  const cloudId = await getCloudId(accessToken);

  const body = {
    body: {
      version: 1,
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text }],
        },
      ],
    },
  };

  const res = await fetch(
    `${JIRA_API_BASE}/${cloudId}/rest/api/3/issue/${issueKey}/comment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Comment posten mislukt (${res.status}): ${err}`);
  }
  return res.json();
}

/**
 * Verander de status van een Jira-item via een transition.
 */
export async function transitionIssue(accessToken, issueKey, targetStatus) {
  const cloudId = await getCloudId(accessToken);

  // 1. Haal beschikbare transitions op
  const tRes = await fetch(
    `${JIRA_API_BASE}/${cloudId}/rest/api/3/issue/${issueKey}/transitions`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
  );
  const { transitions } = await tRes.json();

  // 2. Zoek de gewenste transition op naam (case-insensitief)
  const match = transitions.find(
    (t) => t.name.toLowerCase().includes(targetStatus.toLowerCase())
  );
  if (!match) throw new Error(`Geen transition gevonden voor status: ${targetStatus}`);

  // 3. Voer de transition uit
  const res = await fetch(
    `${JIRA_API_BASE}/${cloudId}/rest/api/3/issue/${issueKey}/transitions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transition: { id: match.id } }),
    }
  );
  if (!res.ok) throw new Error(`Transition mislukt: ${res.status}`);
  return { success: true, transition: match.name };
}

// ─── Normaliseer ruwe Jira-data naar een schoon formaat ─────────────────────

function normalizeIssue(issue) {
  return {
    id: issue.id,
    key: issue.key,
    title: issue.fields.summary,
    status: issue.fields.status?.name ?? "Unknown",
    statusCategory: issue.fields.status?.statusCategory?.key ?? "indeterminate",
    priority: issue.fields.priority?.name ?? "Medium",
    issueType: issue.fields.issuetype?.name ?? "Task",
    project: issue.fields.project?.name ?? "",
    projectKey: issue.fields.project?.key ?? "",
    updated: issue.fields.updated,
    url: `https://${process.env.JIRA_DOMAIN}/browse/${issue.key}`,
    sprint: extractSprintName(issue.fields),
    description: extractTextFromADF(issue.fields.description),
    commentCount: issue.fields.comment?.total ?? 0,
  };
}

function extractSprintName(fields) {
  // Sprint-veld zit in custom fields; probeer bekende locaties
  const sprint = fields.sprint ?? fields.customfield_10020;
  if (!sprint) return null;
  if (Array.isArray(sprint)) return sprint[sprint.length - 1]?.name ?? null;
  return sprint.name ?? null;
}

function extractTextFromADF(adf) {
  // Haal platte tekst uit Atlassian Document Format
  if (!adf || !adf.content) return "";
  return adf.content
    .flatMap((block) => block.content ?? [])
    .filter((node) => node.type === "text")
    .map((node) => node.text)
    .join(" ")
    .slice(0, 300);
}
