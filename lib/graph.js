/**
 * lib/graph.js
 *
 * Server-side Microsoft Graph API adapter.
 * Afhandeling van mail (lezen) en agenda (lezen + aanmaken).
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ─── Mail ────────────────────────────────────────────────────────────────────

/**
 * Haal ongelezen mails op uit de inbox (max 20).
 */
export async function getUnreadMail(accessToken) {
  const res = await fetch(
    `${GRAPH_BASE}/me/mailFolders/inbox/messages` +
      `?$filter=isRead eq false` +
      `&$select=id,subject,from,receivedDateTime,bodyPreview,isRead` +
      `&$orderby=receivedDateTime desc` +
      `&$top=20`,
    {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    }
  );
  if (!res.ok) throw new Error(`Graph mail fout: ${res.status}`);
  const data = await res.json();
  return data.value.map(normalizeMail);
}

/**
 * Haal alle mails op (gelezen + ongelezen), voor de volledige maillijst.
 */
export async function getAllMail(accessToken, top = 20) {
  const res = await fetch(
    `${GRAPH_BASE}/me/mailFolders/inbox/messages` +
      `?$select=id,subject,from,receivedDateTime,bodyPreview,isRead` +
      `&$orderby=receivedDateTime desc` +
      `&$top=${top}`,
    {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    }
  );
  if (!res.ok) throw new Error(`Graph mail fout: ${res.status}`);
  const data = await res.json();
  return data.value.map(normalizeMail);
}

// ─── Agenda ──────────────────────────────────────────────────────────────────

/**
 * Haal agenda-items op voor vandaag en de komende N dagen.
 */
export async function getCalendarEvents(accessToken, daysAhead = 7) {
  const now = new Date();
  const start = startOfDay(now).toISOString();
  const end = addDays(now, daysAhead).toISOString();

  const res = await fetch(
    `${GRAPH_BASE}/me/calendarview` +
      `?startDateTime=${start}&endDateTime=${end}` +
      `&$select=id,subject,start,end,location,organizer,attendees,isAllDay,onlineMeetingUrl` +
      `&$orderby=start/dateTime asc` +
      `&$top=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        Prefer: `outlook.timezone="Europe/Amsterdam"`,
      },
    }
  );
  if (!res.ok) throw new Error(`Graph calendar fout: ${res.status}`);
  const data = await res.json();
  return data.value.map(normalizeEvent);
}

/**
 * Maak een nieuwe agenda-afspraak aan.
 */
export async function createEvent(accessToken, eventData) {
  const body = {
    subject: eventData.title,
    start: {
      dateTime: eventData.startDateTime,
      timeZone: "Europe/Amsterdam",
    },
    end: {
      dateTime: eventData.endDateTime,
      timeZone: "Europe/Amsterdam",
    },
    location: eventData.location ? { displayName: eventData.location } : undefined,
    body: eventData.description
      ? { contentType: "Text", content: eventData.description }
      : undefined,
    attendees: (eventData.attendees ?? []).map((email) => ({
      emailAddress: { address: email },
      type: "required",
    })),
    isOnlineMeeting: eventData.online ?? false,
  };

  const res = await fetch(`${GRAPH_BASE}/me/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Event aanmaken mislukt (${res.status}): ${err}`);
  }
  return normalizeEvent(await res.json());
}

// ─── Normalisatie ─────────────────────────────────────────────────────────────

function normalizeMail(msg) {
  return {
    id: msg.id,
    subject: msg.subject ?? "(geen onderwerp)",
    from: {
      name: msg.from?.emailAddress?.name ?? "Onbekend",
      email: msg.from?.emailAddress?.address ?? "",
      initials: initials(msg.from?.emailAddress?.name ?? "?"),
    },
    preview: msg.bodyPreview ?? "",
    receivedAt: msg.receivedDateTime,
    isRead: msg.isRead,
  };
}

function normalizeEvent(evt) {
  return {
    id: evt.id,
    title: evt.subject ?? "(geen titel)",
    start: evt.start?.dateTime,
    end: evt.end?.dateTime,
    isAllDay: evt.isAllDay ?? false,
    location: evt.location?.displayName ?? null,
    organizer: evt.organizer?.emailAddress?.name ?? null,
    attendeeCount: (evt.attendees ?? []).length,
    onlineMeetingUrl: evt.onlineMeetingUrl ?? null,
  };
}

// ─── Hulpfuncties ─────────────────────────────────────────────────────────────

function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
