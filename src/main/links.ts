export interface SiteGuidance {
  changePasswordUrl: string | null;
  websiteUrl: string | null;
  mfaRecommendation: string;
  passkeyRecommendation: string;
  passkeyKnown: boolean;
}

const PASSKEY_DOMAINS = new Set([
  "accounts.google.com",
  "google.com",
  "github.com",
  "microsoft.com",
  "live.com",
  "apple.com",
  "amazon.com",
  "paypal.com",
  "linkedin.com",
  "discord.com",
  "dropbox.com",
  "adobe.com",
  "tiktok.com",
  "x.com",
]);

const MFA_NOTES: Record<string, string> = {
  "google.com": "Use a passkey or security key; keep backup codes offline.",
  "github.com": "GitHub supports passkeys, authenticator apps, and security keys.",
  "microsoft.com": "Prefer a passkey or Microsoft Authenticator over SMS.",
  "apple.com": "Review trusted devices and recovery contacts with two factor authentication.",
  "amazon.com": "Enable two step verification and review registered devices.",
  "paypal.com": "Use an authenticator app or security key when available.",
};

function matchingDomain(hostname: string, candidates: Iterable<string>): string | null {
  for (const candidate of candidates) {
    if (hostname === candidate || hostname.endsWith(`.${candidate}`)) return candidate;
  }
  return null;
}

export function normalizeWebsite(rawUrl: string): {
  websiteUrl: string | null;
  hostname: string;
  origin: string | null;
} {
  const candidate = rawUrl.trim();
  if (!candidate) return { websiteUrl: null, hostname: "Unknown website", origin: null };

  try {
    const parsed = new URL(/^[a-z][a-z\d+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { websiteUrl: null, hostname: candidate.slice(0, 120), origin: null };
    }
    parsed.username = "";
    parsed.password = "";
    const secureOrigin = `https://${parsed.host}`;
    return {
      websiteUrl: secureOrigin,
      hostname: parsed.hostname.toLowerCase(),
      origin: secureOrigin,
    };
  } catch {
    return { websiteUrl: null, hostname: candidate.slice(0, 120), origin: null };
  }
}

export function siteGuidance(rawUrl: string): SiteGuidance & { hostname: string } {
  const { websiteUrl, hostname, origin } = normalizeWebsite(rawUrl);
  const passkeyMatch = matchingDomain(hostname, PASSKEY_DOMAINS);
  const mfaMatch = matchingDomain(hostname, Object.keys(MFA_NOTES));

  return {
    hostname,
    websiteUrl,
    changePasswordUrl: origin ? `${origin}/.well-known/change-password` : null,
    mfaRecommendation:
      (mfaMatch && MFA_NOTES[mfaMatch]) ||
      "Review the site's security settings. Prefer an authenticator app or security key over SMS.",
    passkeyRecommendation: passkeyMatch
      ? "This service is known to support passkeys. Add one, then keep a recovery method."
      : "Look for a passkey option in security settings; support can vary by account and region.",
    passkeyKnown: Boolean(passkeyMatch),
  };
}
