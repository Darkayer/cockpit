/**
 * pages/api/auth/[...nextauth].js
 *
 * NextAuth configuratie met ondersteuning voor meerdere providers.
 * Tokens worden server-side opgeslagen — nooit blootgesteld aan de browser.
 */

import NextAuth from "next-auth";

// ─── Provider: Atlassian (Jira) ──────────────────────────────────────────────
const AtlassianProvider = {
  id: "atlassian",
  name: "Atlassian",
  type: "oauth",
  authorization: {
    url: "https://auth.atlassian.com/authorize",
    params: {
      audience: "api.atlassian.com",
      scope: "read:jira-work write:jira-work read:jira-user read:me offline_access",
      prompt: "consent",
    },
  },
  token: "https://auth.atlassian.com/oauth/token",
  userinfo: "https://api.atlassian.com/me",
  clientId: process.env.ATLASSIAN_CLIENT_ID,
  clientSecret: process.env.ATLASSIAN_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.account_id,
      name: profile.display_name,
      email: profile.email,
      image: profile.picture,
    };
  },
};

// ─── Provider: Microsoft 365 ─────────────────────────────────────────────────
const MicrosoftProvider = {
  id: "microsoft-entra-id",
  name: "Microsoft 365",
  type: "oauth",
  wellKnown: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0/.well-known/openid-configuration`,
  authorization: {
    params: {
      scope: "openid profile email Mail.Read Calendars.ReadWrite offline_access",
    },
  },
  clientId: process.env.AZURE_AD_CLIENT_ID,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email ?? profile.preferred_username,
    };
  },
};

// ─── Provider: Google (klaar voor later) ─────────────────────────────────────
const GoogleProvider = {
  id: "google",
  name: "Google",
  type: "oauth",
  authorization: {
    url: "https://accounts.google.com/o/oauth2/v2/auth",
    params: {
      scope:
        "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
    },
  },
  token: "https://oauth2.googleapis.com/token",
  userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    };
  },
};

// ─── NextAuth configuratie ───────────────────────────────────────────────────
export const authOptions = {
  providers: [
    AtlassianProvider,
    MicrosoftProvider,
    // GoogleProvider, // Uncomment wanneer Google-koppeling nodig is
  ],

  callbacks: {
    /**
     * jwt callback: access/refresh tokens opslaan in het JWT.
     * Dit token leeft ALLEEN op de server (httpOnly cookie).
     */
    async jwt({ token, account, profile }) {
      if (account) {
        token.provider = account.provider;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;

        // Houd per provider bij wat gekoppeld is
        if (!token.connectedProviders) token.connectedProviders = {};
        token.connectedProviders[account.provider] = {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }
      return token;
    },

    /**
     * session callback: alleen veilige info naar de client sturen.
     * NOOIT access tokens naar de browser sturen.
     */
    async session({ session, token }) {
      session.user.id = token.sub;
      session.connectedProviders = Object.keys(token.connectedProviders ?? {});
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dagen
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
