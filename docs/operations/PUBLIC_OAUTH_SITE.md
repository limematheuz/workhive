# Public WorkHive site and Google OAuth verification

WorkHive uses two public hosts with separate responsibilities:

- `workhive.es`: marketing homepage, contact, privacy policy and terms.
- `app.workhive.es`: login, dashboard, API callbacks and the authenticated product.

The marketing host is served by the existing frontend container, but Caddy does
not expose backend API, upload or health routes on that host. Its root path is
internally rewritten to the public `/about` page. The application host keeps its
existing behavior.

## Production configuration

Set these non-secret values in the production `.env`:

```dotenv
APP_DOMAIN=app.workhive.es
MARKETING_DOMAIN=workhive.es
GOOGLE_CALENDAR_REDIRECT_URI=https://app.workhive.es/api/v1/calendar/google/callback
```

Do not replace `APP_DOMAIN` with the marketing domain. Google OAuth client IDs,
client secrets and token-encryption keys remain private production variables.

In DNS, point the apex `workhive.es` record to the same production edge used by
the application and point `www.workhive.es` to `workhive.es`. Caddy obtains the
TLS certificates after DNS resolves and ports 80/443 reach the instance.

After deploying, verify before changing Google OAuth:

```bash
curl -I https://workhive.es
curl -I https://workhive.es/privacy
curl -I https://workhive.es/terms
curl -I https://app.workhive.es/login
```

The public homepage must return `200` without authentication and must not
redirect to another domain.

## Google Auth Platform values

Use the following public URLs in the WorkHive OAuth brand configuration:

- Homepage: `https://workhive.es`
- Privacy policy: `https://workhive.es/privacy`
- Terms of service: `https://workhive.es/terms`
- Authorized domain: `workhive.es`
- Redirect URI: `https://app.workhive.es/api/v1/calendar/google/callback`

Only request the Google Calendar scopes required by the implemented sync. Submit
brand and data-access verification only after the production URLs are reachable
and display the same `WorkHive` name used by the OAuth consent screen.

## Local development

No new secret is required locally. `MARKETING_DOMAIN=workhive.localhost` is a
local routing value only. The public page can also be reviewed directly at
`http://localhost:3000/about`; real Google OAuth still uses the redirect URI
registered for the environment being tested.
