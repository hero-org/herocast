// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const REDACTED_HEADERS = new Set(['authorization', 'apikey', 'api-key', 'cookie', 'x-api-key']);
const JWT_RE = /eyJ[A-Za-z0-9_\-.]{40,}/g;
const SB_RE = /sb_[a-z0-9_]{30,}/g;

function scrubSecrets(value: string): string {
  return value.replace(JWT_RE, '[REDACTED_JWT]').replace(SB_RE, '[REDACTED_SB]');
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Scrub bearer tokens, Supabase anon/service keys, and other credential-like
  // strings out of every Sentry event before the SDK ships it. Wrapped in
  // try/catch so a bug in scrubbing never blocks an otherwise-valid event.
  beforeSend(event) {
    try {
      if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
          if (REDACTED_HEADERS.has(key.toLowerCase())) {
            event.request.headers[key] = '[REDACTED]';
          }
        }
      }

      if (event.extra) {
        for (const key of Object.keys(event.extra)) {
          const v = event.extra[key];
          if (typeof v === 'string') {
            event.extra[key] = scrubSecrets(v);
          }
        }
      }

      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (typeof crumb.message === 'string') {
            crumb.message = scrubSecrets(crumb.message);
          }
          if (crumb.data) {
            for (const key of Object.keys(crumb.data)) {
              const v = crumb.data[key];
              if (typeof v === 'string') {
                crumb.data[key] = scrubSecrets(v);
              }
            }
          }
        }
      }

      // Scrub local variable captures from each stack frame — axios errors
      // serialize `config.headers.Authorization` into `frame.vars` and that
      // slips past the header/extra/breadcrumb passes above.
      if (event.exception?.values) {
        for (const ev of event.exception.values) {
          const frames = ev.stacktrace?.frames;
          if (!frames) continue;
          for (const frame of frames) {
            const vars = frame.vars as Record<string, unknown> | undefined;
            if (!vars || typeof vars !== 'object') continue;
            for (const key of Object.keys(vars)) {
              const val = vars[key];
              if (typeof val === 'string') {
                vars[key] = scrubSecrets(val);
              } else if (val && typeof val === 'object') {
                try {
                  vars[key] = JSON.parse(scrubSecrets(JSON.stringify(val)));
                } catch {
                  /* leave as-is if non-serializable */
                }
              }
            }
          }
        }
      }

      // Scrub `contexts` — Sentry often stores request/response bodies here.
      if (event.contexts) {
        for (const ctxName of Object.keys(event.contexts)) {
          const ctx = event.contexts[ctxName] as Record<string, unknown> | undefined;
          if (!ctx || typeof ctx !== 'object') continue;
          for (const key of Object.keys(ctx)) {
            const val = ctx[key];
            if (typeof val === 'string') {
              ctx[key] = scrubSecrets(val);
            }
          }
        }
      }
    } catch {
      /* never block the SDK */
    }
    return event;
  },

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',
});
