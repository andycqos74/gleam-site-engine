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
    // Visitor chat assistant (Claude). Off for every site until an API key is set here AND an administrator turns
    // it on under Admin > Chat assistant, where each site keeps its own name, greeting and instructions.
    assistantApiKey: (env.ASSISTANT_API_KEY || env.ANTHROPIC_API_KEY || '').trim(),
    assistantModel: env.ASSISTANT_MODEL || 'claude-opus-5-5',
    // low, medium, high, xhigh or max: how hard the model thinks per answer.
    assistantEffort: ['low', 'medium', 'high', 'xhigh', 'max'].includes(env.ASSISTANT_EFFORT) ? env.ASSISTANT_EFFORT : 'medium',
    // Visitor messages per conversation before they're asked to start a new one.
    assistantMaxMessages: Number(env.ASSISTANT_MAX_MESSAGES || 30),
  };
}
