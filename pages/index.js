/**
 * pages/index.js — Cockpit hoofdpagina
 *
 * Toont Jira-items, ongelezen mail en agenda-items naast elkaar.
 * Data wordt geladen via de eigen backend API-routes.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import Head from "next/head";
import styles from "../styles/cockpit.module.css";

// ─── Hulpfuncties ────────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Vandaag";
  if (diff === -1) return "Gisteren";
  if (diff === 1) return "Morgen";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function initials(name = "") {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function priorityColor(p) {
  const m = { Highest: "#E24B4A", High: "#E24B4A", Medium: "#EF9F27", Low: "#639922", Lowest: "#639922" };
  return m[p] ?? "#888780";
}

function statusClass(cat) {
  const m = { "in-progress": "sp-prog", "to-do": "sp-todo", done: "sp-done", indeterminate: "sp-review" };
  return m[cat] ?? "sp-todo";
}

// ─── Component: Jira item ────────────────────────────────────────────────────

function JiraItem({ issue, onSelect, selected }) {
  return (
    <div
      className={`${styles.jiraItem} ${selected ? styles.jiraItemSelected : ""}`}
      onClick={() => onSelect(issue)}
    >
      <div className={styles.jiraKey}>{issue.key}</div>
      <div className={styles.jiraBody}>
        <div className={styles.jiraTitle}>{issue.title}</div>
        <div className={styles.jiraMeta}>
          <span
            className={styles.priorityDot}
            style={{ background: priorityColor(issue.priority) }}
          />
          {issue.sprint && <span className={styles.sprintLabel}>{issue.sprint}</span>}
          <span className={`${styles.statusPill} ${styles[statusClass(issue.statusCategory)]}`}>
            {issue.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Component: Update panel ─────────────────────────────────────────────────

function UpdatePanel({ issue, onClose, onPosted }) {
  const [comment, setComment] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  async function post() {
    if (!comment.trim() && !newStatus) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jira/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey: issue.key, comment: comment.trim(), newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSuccess(true);
      setComment("");
      setNewStatus("");
      onPosted?.();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.updatePanel}>
      <div className={styles.selectedIssue}>
        <div className={styles.selKey}>
          {issue.key} · {issue.status}
        </div>
        <div className={styles.selTitle}>{issue.title}</div>
        {issue.description && (
          <div className={styles.selDesc}>{issue.description}</div>
        )}
      </div>
      <textarea
        className={styles.updateTextarea}
        rows={3}
        placeholder="Schrijf een update of comment..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className={styles.btnRow}>
        <select
          className={styles.statusSelect}
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
        >
          <option value="">Status ongewijzigd</option>
          <option value="In Progress">→ In progress</option>
          <option value="In Review">→ In review</option>
          <option value="Done">→ Done</option>
        </select>
        <button className={styles.btn} onClick={onClose}>Annuleren</button>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={post}
          disabled={loading || (!comment.trim() && !newStatus)}
        >
          {loading ? "Bezig..." : "Posten naar Jira ↗"}
        </button>
      </div>
      {success && <div className={styles.successMsg}>✓ Update succesvol gepost naar Jira</div>}
      {error && <div className={styles.errorMsg}>✗ {error}</div>}
    </div>
  );
}

// ─── Component: Mail item ────────────────────────────────────────────────────

const AVATAR_COLORS = ["#B5D4F4", "#9FE1CB", "#CECBF6", "#F5C4B3", "#FAC775"];
const AVATAR_TEXT = ["#0C447C", "#085041", "#3C3489", "#712B13", "#633806"];

function MailItem({ mail, index }) {
  const ci = index % AVATAR_COLORS.length;
  return (
    <div className={styles.mailItem}>
      {!mail.isRead && <div className={styles.unreadDot} />}
      {mail.isRead && <div style={{ width: 6, flexShrink: 0 }} />}
      <div
        className={styles.avatar}
        style={{ background: AVATAR_COLORS[ci], color: AVATAR_TEXT[ci] }}
      >
        {initials(mail.from.name)}
      </div>
      <div className={styles.mailBody}>
        <div className={styles.mailSender}>{mail.from.name}</div>
        <div className={styles.mailSubject}>{mail.subject}</div>
      </div>
      <div className={styles.mailTime}>{formatDate(mail.receivedAt)}</div>
    </div>
  );
}

// ─── Component: Agenda item ───────────────────────────────────────────────────

const AGENDA_COLORS = ["#378ADD", "#7F77DD", "#1D9E75", "#EF9F27"];

function AgendaItem({ event, index }) {
  const color = AGENDA_COLORS[index % AGENDA_COLORS.length];
  return (
    <div className={styles.agendaItem}>
      <div className={styles.agendaTime}>
        {event.isAllDay ? "Hele dag" : `${formatTime(event.start)}`}
        {!event.isAllDay && event.end && (
          <>
            <br />
            {formatTime(event.end)}
          </>
        )}
      </div>
      <div className={styles.agendaBar} style={{ background: color }} />
      <div className={styles.agendaDetails}>
        <div className={styles.agendaTitle}>{event.title}</div>
        <div className={styles.agendaSub}>
          {event.location ?? (event.onlineMeetingUrl ? "Online vergadering" : "")}
          {event.attendeeCount > 0 && ` · ${event.attendeeCount} deelnemers`}
        </div>
      </div>
    </div>
  );
}

// ─── Cockpit hoofdpagina ──────────────────────────────────────────────────────

export default function CockpitPage() {
  const { data: session, status } = useSession();

  const [issues, setIssues] = useState([]);
  const [mail, setMail] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [loadingMail, setLoadingMail] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const hasJira = session?.connectedProviders?.includes("atlassian");
  const hasMs = session?.connectedProviders?.includes("microsoft-entra-id");

  const loadIssues = useCallback(async () => {
    if (!hasJira) return;
    setLoadingIssues(true);
    try {
      const res = await fetch("/api/jira/issues");
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues);
      }
    } finally {
      setLoadingIssues(false);
    }
  }, [hasJira]);

  const loadMail = useCallback(async () => {
    if (!hasMs) return;
    setLoadingMail(true);
    try {
      const res = await fetch("/api/outlook/mail");
      if (res.ok) setMail((await res.json()).mail);
    } finally {
      setLoadingMail(false);
    }
  }, [hasMs]);

  const loadEvents = useCallback(async () => {
    if (!hasMs) return;
    setLoadingEvents(true);
    try {
      const res = await fetch("/api/outlook/calendar?days=7");
      if (res.ok) setEvents((await res.json()).events);
    } finally {
      setLoadingEvents(false);
    }
  }, [hasMs]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadIssues();
    loadMail();
    loadEvents();
    setLastSync(new Date());
  }, [status, loadIssues, loadMail, loadEvents]);

  const filteredIssues = issues.filter((i) => {
    if (filter === "all") return true;
    if (filter === "in-progress") return i.statusCategory === "in-progress";
    if (filter === "todo") return i.statusCategory === "to-do";
    if (filter === "review") return i.statusCategory === "indeterminate";
    return true;
  });

  const unreadCount = mail.filter((m) => !m.isRead).length;
  const todayEvents = events.filter((e) => {
    const d = new Date(e.start);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  });

  if (status === "loading") {
    return <div className={styles.loading}>Laden...</div>;
  }

  if (status === "unauthenticated") {
    return (
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>Mijn cockpit</h1>
          <p className={styles.loginSub}>
            Log in om je Jira-items, mail en agenda te bekijken.
          </p>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => signIn()}>
            Inloggen
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Cockpit</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Mijn cockpit</h1>
          <div className={styles.headerRight}>
            <span className={styles.syncLabel}>
              <span className={styles.syncDot} />
              {lastSync
                ? `Gesynchroniseerd · ${formatTime(lastSync.toISOString())}`
                : "Laden..."}
            </span>
            <a href="/settings" className={styles.settingsLink}>Integraties</a>
            <a href="/api/auth/signout" className={styles.settingsLink}>Uitloggen</a>
          </div>
        </header>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statNum} style={{ color: "#185FA5" }}>
              {loadingIssues ? "…" : issues.length}
            </div>
            <div className={styles.statLbl}>Open Jira-items</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum} style={{ color: "#E24B4A" }}>
              {loadingMail ? "…" : unreadCount}
            </div>
            <div className={styles.statLbl}>Ongelezen mails</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum} style={{ color: "#1D9E75" }}>
              {loadingEvents ? "…" : todayEvents.length}
            </div>
            <div className={styles.statLbl}>Afspraken vandaag</div>
          </div>
        </div>

        {/* Waarschuwingen bij ontbrekende koppelingen */}
        {!hasJira && (
          <div className={styles.warningBanner}>
            Atlassian nog niet gekoppeld.{" "}
            <a href="/settings">Koppel je Jira-account →</a>
          </div>
        )}
        {!hasMs && (
          <div className={styles.warningBanner}>
            Microsoft 365 nog niet gekoppeld.{" "}
            <a href="/settings">Koppel je Microsoft-account →</a>
          </div>
        )}

        {/* Main grid */}
        <div className={styles.mainGrid}>
          {/* Jira kolom */}
          <div className={styles.jiraCol}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Mijn Jira-items</span>
                <span className={`${styles.badge} ${styles.badgeBlue}`}>
                  {issues.length} open
                </span>
              </div>

              <div className={styles.filterRow}>
                {[
                  { key: "all", label: "Alles" },
                  { key: "in-progress", label: "Bezig" },
                  { key: "todo", label: "Te doen" },
                  { key: "review", label: "Review" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    className={`${styles.filterBtn} ${filter === key ? styles.filterBtnActive : ""}`}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loadingIssues && <div className={styles.loadingInline}>Laden...</div>}
              {!loadingIssues && filteredIssues.length === 0 && (
                <div className={styles.emptyState}>Geen items gevonden</div>
              )}
              {filteredIssues.map((issue) => (
                <JiraItem
                  key={issue.id}
                  issue={issue}
                  selected={selectedIssue?.id === issue.id}
                  onSelect={(i) =>
                    setSelectedIssue(selectedIssue?.id === i.id ? null : i)
                  }
                />
              ))}

              {selectedIssue && (
                <UpdatePanel
                  issue={selectedIssue}
                  onClose={() => setSelectedIssue(null)}
                  onPosted={() => {
                    loadIssues();
                    setLastSync(new Date());
                  }}
                />
              )}
            </div>
          </div>

          {/* Rechterkolom: mail + agenda */}
          <div className={styles.rightCol}>
            {/* Mail */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Outlook mail</span>
                <span className={`${styles.badge} ${styles.badgeRed}`}>
                  {unreadCount} nieuw
                </span>
              </div>
              {loadingMail && <div className={styles.loadingInline}>Laden...</div>}
              {!loadingMail && mail.length === 0 && (
                <div className={styles.emptyState}>Geen ongelezen mail</div>
              )}
              {mail.slice(0, 6).map((m, i) => (
                <MailItem key={m.id} mail={m} index={i} />
              ))}
            </div>

            {/* Agenda */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Agenda</span>
                <span className={`${styles.badge} ${styles.badgeGreen}`}>
                  {new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}
                </span>
              </div>
              {loadingEvents && <div className={styles.loadingInline}>Laden...</div>}
              {!loadingEvents && todayEvents.length === 0 && (
                <div className={styles.emptyState}>Geen afspraken vandaag</div>
              )}
              {todayEvents.map((e, i) => (
                <AgendaItem key={e.id} event={e} index={i} />
              ))}
              <a href="/agenda/new" className={styles.addEventLink}>+ Afspraak inplannen</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
