// All settings come from environment variables (see .env.example and deploy/portainer/stack.env).
const bool = (v, fallback) => (v == null || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8080),
    dataDir: env.DATA_DIR || './data',
    // Which design and content model this site runs: a folder in themes/. A custom theme can be mounted into the
    // container at /app/themes/<name>.
    theme: env.THEME || 'qos',
    baseUrl: (env.BASE_URL || '').replace(/\/+$/, ''),
    adminEmail: (env.ADMIN_EMAIL || '').trim().replace(/^(['"])(.*)\1$/, '$2'),
    // Quotes around the value are a common copy-paste slip in Portainer's variable editor; ignore them.
    adminPassword: (env.ADMIN_PASSWORD || '').trim().replace(/^(['"])(.*)\1$/, '$2'),
    adminReset: bool(env.ADMIN_RESET, false),
    // Unset: cookies are marked Secure when the request arrived over HTTPS (X-Forwarded-Proto from the proxy/tunnel).
    cookieSecure: env.COOKIE_SECURE == null || env.COOKIE_SECURE === '' ? undefined : bool(env.COOKIE_SECURE, true),
    trustProxy: env.TRUST_PROXY || undefined,
    contactTo: env.CONTACT_TO || '',
    mailFrom: env.MAIL_FROM || env.CONTACT_TO || '',
    smtpHost: env.SMTP_HOST || '',
    smtpPort: Number(env.SMTP_PORT || 587),
    smtpUser: env.SMTP_USER || '',
    smtpPassword: env.SMTP_PASSWORD || '',
    // Visitor statistics from an Umami server (see analytics.js). UMAMI_URL + UMAMI_WEBSITE_ID add the tracking
    // script; an API key or a username/password also lets Admin > Visitors show the figures.
    umami: {
      url: (env.UMAMI_URL || '').trim().replace(/\/+$/, ''),
      websiteId: (env.UMAMI_WEBSITE_ID || '').trim(),
      apiUrl: (env.UMAMI_API_URL || '').trim().replace(/\/+$/, ''),
      apiKey: (env.UMAMI_API_KEY || '').trim(),
      username: (env.UMAMI_USERNAME || '').trim(),
      password: (env.UMAMI_PASSWORD || '').trim().replace(/^(['"])(.*)\1$/, '$2'),
      scriptName: (env.UMAMI_SCRIPT_NAME || 'script.js').trim().replace(/^\/+/, ''),
    },
  };
}
