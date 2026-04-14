/**
 * pages/api/jira/issues.js
 *
 * GET  /api/jira/issues        — haal mijn Jira-items op
 * POST /api/jira/issues        — post een update/comment op een item
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getMyIssues, addComment, transitionIssue } from "../../../lib/jira";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: "Niet ingelogd" });
  }

  // Haal het Atlassian access token op uit de server-side JWT
  // (dit token verlaat nooit de browser)
  const accessToken = req.cookies["next-auth.session-token"]; // Wordt afgehandeld door NextAuth JWT callback

  // Voor productie: gebruik getToken() van next-auth/jwt
  const { getToken } = await import("next-auth/jwt");
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const atlassianToken = token?.connectedProviders?.atlassian?.accessToken;

  if (!atlassianToken) {
    return res.status(403).json({
      error: "Atlassian niet gekoppeld",
      hint: "Koppel je Atlassian-account via Instellingen > Integraties",
    });
  }

  try {
    if (req.method === "GET") {
      const issues = await getMyIssues(atlassianToken);
      return res.status(200).json({ issues });
    }

    if (req.method === "POST") {
      const { issueKey, comment, newStatus } = req.body;

      if (!issueKey) {
        return res.status(400).json({ error: "issueKey is verplicht" });
      }

      const results = {};

      if (comment) {
        results.comment = await addComment(atlassianToken, issueKey, comment);
      }

      if (newStatus) {
        results.transition = await transitionIssue(atlassianToken, issueKey, newStatus);
      }

      return res.status(200).json({ success: true, ...results });
    }

    return res.status(405).json({ error: "Methode niet toegestaan" });
  } catch (err) {
    console.error("[/api/jira/issues]", err);
    return res.status(500).json({ error: err.message });
  }
}
