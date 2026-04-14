# Persoonlijke Cockpit — Webapp

Een persoonlijk dashboard dat Jira Cloud, Microsoft 365 (Outlook/Agenda) en
later Google Workspace samenbrengt in één overzicht.

---

## Functies

- **Jira Cloud**: al je toegewezen items zien, filteren op sprint/status,
  comments posten en status wijzigen — rechtstreeks naar Jira
- **Outlook mail**: ongelezen berichten in één oogopslag
- **Outlook agenda**: afspraken van vandaag en komende week, nieuwe events aanmaken
- **Multi-account**: meerdere OAuth-koppelingen (Atlassian, Microsoft, Google) per gebruiker
- **Veilig**: access tokens worden NOOIT naar de browser gestuurd

---

## Technische stack

| Laag       | Technologie          |
|------------|----------------------|
| Frontend   | Next.js 14 + React 18 |
| Auth       | NextAuth.js (OAuth 2.0) |
| Stijl      | CSS Modules          |
| Jira       | Atlassian REST API v3 |
| Mail/Agenda| Microsoft Graph API v1.0 |
| Hosting    | Vercel (aanbevolen)  |

---

## Installatie

### 1. Project opzetten

```bash
git clone <jouw-repo>
cd cockpit
npm install
cp .env.example .env.local
```

### 2. Atlassian (Jira) koppeling

1. Ga naar https://developer.atlassian.com/console/myapps/
2. Klik **Create** → **OAuth 2.0 integration**
3. Geef de app een naam (bijv. "Mijn Cockpit")
4. Voeg een **Callback URL** toe:
   - Lokaal: `http://localhost:3000/api/auth/callback/atlassian`
   - Productie: `https://jouwdomein.nl/api/auth/callback/atlassian`
5. Activeer de volgende **Permissions** (onder "Jira API"):
   - `read:jira-work`
   - `write:jira-work`
   - `read:jira-user`
   - `read:me`
   - `offline_access`
6. Kopieer **Client ID** en **Secret** naar `.env.local`:
   ```
   ATLASSIAN_CLIENT_ID=xxx
   ATLASSIAN_CLIENT_SECRET=xxx
   JIRA_DOMAIN=jouwbedrijf.atlassian.net
   ```

### 3. Microsoft 365 koppeling

1. Ga naar https://portal.azure.com → **App registrations** → **New registration**
2. Naam: bijv. "Cockpit"
3. **Supported account types**: *Accounts in this organizational directory only*
   (of *Multitenant* als je meerdere tenants wil ondersteunen)
4. **Redirect URI**: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. Na aanmaken → **Certificates & secrets** → **New client secret**
6. **API permissions** → Add a permission → Microsoft Graph:
   - `Mail.Read`
   - `Calendars.ReadWrite`
   - `User.Read`
   - `offline_access`
   - `openid`, `profile`, `email`
7. Kopieer naar `.env.local`:
   ```
   AZURE_AD_CLIENT_ID=xxx
   AZURE_AD_CLIENT_SECRET=xxx
   AZURE_AD_TENANT_ID=xxx   (te vinden op de Overview-pagina van je app)
   ```

### 4. NextAuth secret genereren

```bash
openssl rand -base64 32
```
Plak de output in `.env.local` als `NEXTAUTH_SECRET`.

### 5. Starten

```bash
npm run dev
# Open http://localhost:3000
```

---

## Projectstructuur

```
cockpit/
├── lib/
│   ├── jira.js          ← Jira REST API adapter (server-only)
│   └── graph.js         ← Microsoft Graph adapter (server-only)
├── pages/
│   ├── _app.js          ← SessionProvider wrapper
│   ├── index.js         ← Cockpit hoofdpagina
│   ├── settings.js      ← Integraties beheren
│   └── api/
│       ├── auth/
│       │   └── [...nextauth].js  ← OAuth providers
│       ├── jira/
│       │   └── issues.js         ← GET/POST Jira items
│       └── outlook/
│           ├── mail.js           ← GET mail
│           └── calendar.js       ← GET/POST agenda
├── styles/
│   ├── globals.css
│   └── cockpit.module.css
└── .env.example
```

---

## Uitbreiden met Google

1. Maak een Google Cloud project aan op https://console.cloud.google.com
2. Activeer **Gmail API** en **Google Calendar API**
3. Maak OAuth 2.0-credentials aan
4. Vul `GOOGLE_CLIENT_ID` en `GOOGLE_CLIENT_SECRET` in `.env.local`
5. Uncomment `GoogleProvider` in `pages/api/auth/[...nextauth].js`
6. Uncomment `"google"` in `pages/settings.js`

---

## Deployen naar Vercel

```bash
npm install -g vercel
vercel
```

Vercel detecteert Next.js automatisch. Voeg alle `.env.local`-variabelen
toe via het Vercel dashboard onder **Settings → Environment Variables**.
Vergeet `NEXTAUTH_URL` te updaten naar je productie-URL.

---

## Beveiliging

- Access tokens zitten in httpOnly cookies — niet bereikbaar via JavaScript
- API-routes controleren altijd de sessie via `getToken()`
- Tokens verlaten nooit de browser
- Alle externe API-aanroepen lopen via de backend proxy
- Voeg rate limiting toe (bijv. `next-rate-limit`) voor productie

---

## Volgende stappen (ideeën)

- [ ] Jira-items slepen tussen statussen (Kanban-stijl)
- [ ] E-mail beantwoorden vanuit de cockpit
- [ ] Jira-item direct koppelen aan een agenda-afspraak
- [ ] Push-notificaties bij nieuwe mails / Jira-mentions
- [ ] Wekelijks overzicht per mail
- [ ] Google Workspace koppeling
- [ ] Dark mode
