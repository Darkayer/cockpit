/**
 * pages/settings.js — Integraties beheren
 *
 * Overzicht van gekoppelde accounts (Atlassian, Microsoft, Google).
 * Gebruikers kunnen hier accounts koppelen en ontkoppelen.
 */

import { useSession, signIn } from "next-auth/react";
import Head from "next/head";
import styles from "../styles/cockpit.module.css";

const INTEGRATIONS = [
  {
    id: "atlassian",
    name: "Atlassian / Jira",
    description: "Toegang tot je Jira-items, sprints en projecten.",
    icon: "J",
    iconBg: "#0052CC",
    iconColor: "#fff",
    scopes: ["Jira-items lezen", "Comments plaatsen", "Status wijzigen"],
  },
  {
    id: "microsoft-entra-id",
    name: "Microsoft 365",
    description: "Toegang tot Outlook mail en agenda.",
    icon: "M",
    iconBg: "#00A4EF",
    iconColor: "#fff",
    scopes: ["Mail lezen", "Agenda lezen", "Afspraken aanmaken"],
  },
  {
    id: "google",
    name: "Google Workspace",
    description: "Gmail en Google Calendar koppelen (binnenkort beschikbaar).",
    icon: "G",
    iconBg: "#EA4335",
    iconColor: "#fff",
    scopes: ["Gmail lezen", "Calendar lezen", "Events aanmaken"],
    comingSoon: true,
  },
];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const connected = new Set(session?.connectedProviders ?? []);

  if (status === "loading") return <div className={styles.loading}>Laden...</div>;

  return (
    <>
      <Head><title>Integraties · Cockpit</title></Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Integraties</h1>
          <a href="/" className={styles.settingsLink}>← Terug naar cockpit</a>
        </header>

        <div className={styles.settingsGrid}>
          {INTEGRATIONS.map((integ) => {
            const isConnected = connected.has(integ.id);
            return (
              <div key={integ.id} className={styles.integrationCard}>
                <div className={styles.integHeader}>
                  <div
                    className={styles.integIcon}
                    style={{ background: integ.iconBg, color: integ.iconColor }}
                  >
                    {integ.icon}
                  </div>
                  <div className={styles.integInfo}>
                    <div className={styles.integName}>{integ.name}</div>
                    <div className={styles.integDesc}>{integ.description}</div>
                  </div>
                  <div>
                    {integ.comingSoon ? (
                      <span className={`${styles.badge} ${styles.badgeGray}`}>Binnenkort</span>
                    ) : isConnected ? (
                      <span className={`${styles.badge} ${styles.badgeGreen}`}>✓ Gekoppeld</span>
                    ) : (
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => signIn(integ.id)}
                      >
                        Koppelen
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.scopeList}>
                  {integ.scopes.map((s) => (
                    <span key={s} className={styles.scopePill}>{s}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.securityNote}>
          <strong>Privacy & beveiliging</strong> — Toegangstokens worden uitsluitend
          server-side opgeslagen en verlaten nooit jouw browser. Alle API-aanroepen
          lopen via de eigen backend proxy. Je kunt een koppeling op elk moment
          verwijderen vanuit het portaal van de betreffende dienst.
        </div>
      </div>
    </>
  );
}
