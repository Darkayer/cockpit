/**
 * pages/api/outlook/mail.js    — GET ongelezen/alle mails
 * pages/api/outlook/calendar.js — GET events, POST nieuw event
 *
 * Beide routes zitten in dit bestand als aparte exports.
 * Split ze later in aparte bestanden als het project groeit.
 */

import { getToken } from "next-auth/jwt";
import { getUnreadMail, getAllMail, getCalendarEvents, createEvent } from "../../../lib/graph";

// ─── Mail ─────────────────────────────────────────────────────────────────────
export async function mailHandler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const msToken = token?.connectedProviders?.["microsoft-entra-id"]?.accessToken;

  if (!msToken) {
    return res.status(403).json({
      error: "Microsoft 365 niet gekoppeld",
      hint: "Koppel je Microsoft-account via Instellingen > Integraties",
    });
  }

  try {
    if (req.method === "GET") {
      const { all } = req.query;
      const mail = all ? await getAllMail(msToken) : await getUnreadMail(msToken);
      return res.status(200).json({ mail });
    }
    return res.status(405).json({ error: "Methode niet toegestaan" });
  } catch (err) {
    console.error("[/api/outlook/mail]", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Agenda ───────────────────────────────────────────────────────────────────
export async function calendarHandler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const msToken = token?.connectedProviders?.["microsoft-entra-id"]?.accessToken;

  if (!msToken) {
    return res.status(403).json({ error: "Microsoft 365 niet gekoppeld" });
  }

  try {
    if (req.method === "GET") {
      const { days } = req.query;
      const events = await getCalendarEvents(msToken, Number(days) || 7);
      return res.status(200).json({ events });
    }

    if (req.method === "POST") {
      const event = await createEvent(msToken, req.body);
      return res.status(201).json({ event });
    }

    return res.status(405).json({ error: "Methode niet toegestaan" });
  } catch (err) {
    console.error("[/api/outlook/calendar]", err);
    return res.status(500).json({ error: err.message });
  }
}

// Standaard export voor /api/outlook/mail
export default mailHandler;
