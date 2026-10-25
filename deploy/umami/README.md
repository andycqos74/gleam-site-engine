# Umami statistics server

A Portainer stack for [Umami](https://umami.is), the open-source, privacy-friendly alternative to Google Analytics
that Gleam sites use for visitor figures. One Umami server counts visitors for every site you run: Gleam sites,
and any other website you add a one-line script to. It doesn't use cookies or store IP addresses.

The stack runs three containers: `umami` (the app and dashboard), `db` (PostgreSQL, holding all the figures in the
`umami-db` volume) and `cloudflared` (a Cloudflare Tunnel, so no ports are opened on the server). It needs about
300–500 MB of memory.

## Set it up

1. In Cloudflare Zero Trust, create a tunnel (Docker) and copy its token. Add a public hostname for it, such as
   `stats.example.org`, with service `http://umami:3000`.
2. In Portainer: **Stacks → Add stack → Web editor**, name it e.g. `umami`, and paste `docker-compose.yml`.
3. Add the variables from `stack.env`. Set `POSTGRES_PASSWORD` and `APP_SECRET` to long random values
   (`openssl rand -hex 24`, `openssl rand -hex 32`) and `CLOUDFLARE_TUNNEL_TOKEN`.
4. Deploy. The first start sets up the database (give it a minute), then open `https://stats.example.org` and sign
   in as **admin** / **umami**. Change that password at once (**Settings → Profile**).

## Add a website

**Settings → Websites → Add website**, with the site's name and domain (e.g. `www.example.org.uk`). Open the
website's **Settings** for its **Website ID** and its tracking code.

- **A Gleam site:** set `UMAMI_URL=https://stats.example.org` and `UMAMI_WEBSITE_ID=<website ID>` on its stack and
  redeploy. Gleam adds the script itself. To show the figures under the site's **Admin → Visitors**, also give it the
  view-only login below (`UMAMI_USERNAME`, `UMAMI_PASSWORD`). See *Visitor statistics* in the main README.
- **Any other site:** paste the tracking code into the page's `<head>`:

  ```html
  <script defer src="https://stats.example.org/script.js" data-website-id="<website ID>"></script>
  ```

  If that site sends a Content-Security-Policy, allow `https://stats.example.org` in `script-src` and `connect-src`.

## A view-only login for Gleam sites

Gleam reads each site's figures from the Umami API. Give it an account that can only look:

1. **Settings → Teams → Create team**, e.g. *Websites*.
2. Move each website into the team: the website's **Settings → Transfer**.
3. **Admin → Users → Create user**, e.g. `gleam`, with role **View only** and a long password. Leave two-factor
   sign-in off for it.
4. In the team, **Add member**: `gleam`, role **Team view only**.

Every Gleam site can use the same `gleam` login; each one only asks for its own website ID. To give a person
read-only access to the full dashboard, add them to the team the same way.

## Countries

Behind a Cloudflare Tunnel, Umami takes visitors' countries from Cloudflare's `CF-IPCountry` header, which Cloudflare
adds by default (**Network → IP Geolocation** in the Cloudflare dashboard).

## Updates and back-ups

To update, use **Pull and redeploy** (`UMAMI_TAG=3` follows Umami 3.x; Umami upgrades its database by itself on
start). Before updating to a new major version (4), read Umami's release notes.

Back up the `umami-db` volume, e.g. a nightly database dump from the Docker host:

```bash
docker exec umami-db-1 pg_dump -U umami umami | gzip > /backups/umami-$(date +%F).sql.gz
```

(The container name is `<stack>-db-1`; check it under **Containers** in Portainer.)
