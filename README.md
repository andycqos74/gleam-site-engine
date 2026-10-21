# QoS Community Trust website

The six-page "Winding Route" site from the design handover (Home, About, Programmes, Shop, Gallery, Contact, plus a
Privacy page). Approved staff edit the words and photos **in place on the page** after signing in, and every change is
recorded, so any change can be undone.

## Stack

| Layer | Choice |
| --- | --- |
| Server | Node.js 22, Express 5, server-rendered HTML (no build step) |
| Content | SQLite (`better-sqlite3`) in the `/data` volume, with uploaded photos in `/data/media` |
| Photos | Resized on upload with `sharp` to 800 px and 1600 px WebP |
| Front end | Plain CSS and a little vanilla JS; fonts self-hosted (no Google requests) |
| Hosting | One Docker image, published to GHCR by GitHub Actions; Portainer stack with a Cloudflare Tunnel |

```
src/content/defaults.js   Every editable piece of text/photo on the site, with its starting value
src/content/schema.js     The editable lists (programmes, team, gallery, …) and their fields
src/content/store.js      Reading/saving content, validation, change history
src/pages/*.js            Page templates; kit.js marks what is editable
public/js/editor.js       The in-page editor (only loaded for signed-in users)
public/js/site.js         Visitor scripts: mobile menu, filters, lightbox, contact form
deploy/portainer          Portainer stack and its variables
```

## Editing the site (for Trust staff)

1. Go to `https://<your site>/admin` and sign in.
2. Press **Edit this page** in the bar at the bottom of any page.
3. **Words:** click any outlined text and type. Big headlines: put `[square brackets]` around the words that should be
   highlighted in a coloured pill.
4. **Buttons:** click a button to change its words; a box appears underneath to change where it goes.
5. **Photos:** click a photo (or an empty striped box) and pick *Upload a new photo*, *Choose an uploaded photo* or
   *Describe the photo* (for screen readers).
6. **Lists** (programmes, journey stops, stories, timeline, team, vacancies, funders, venues, shop products, gallery):
   point at an item for its toolbar: ✎ all details (price, age group, links, "show on homepage", …), arrows to
   reorder, 👁 to hide from visitors, 🗑 to delete. **+ Add …** under a list adds a new item.
7. Press **Save changes**. Visitors see the change immediately.
8. **Page settings** (in the bar) holds the search-engine title and description, plus a few links such as the default
   *Book Now* address, Facebook/Instagram addresses and the map position.

Made a mistake? **Admin → Change history** lists every change with a *Put back* button.
Contact form messages appear under **Admin → Messages** (and are emailed too if SMTP is set up).

Administrators add and remove editors under **Admin → People**. New people get a one-time password that they must
change at first sign-in.

## Before go-live

The handover marks these as placeholders. They're all editable in place:

- Journey story names, quotes and photos (Home)
- Timeline years and milestones (`20XX`) (Home and About)
- Staff names, roles and headshots (About)
- Programme times, venues and prices marked `TBC` (Programmes)
- Shop products and `£XX` prices, and where each *Book/Add/Enquire* button goes (Shop)
- Funder and partner logos (About; the section stays hidden until one is added)
- Photos for every striped slot. Empty gallery tiles are not shown to visitors.
- Facebook and Instagram addresses (Gallery → Page settings); the buttons appear once set
- The default *Book Now* link (Programmes → Page settings), e.g. the online bookings site
- Review the starter Privacy Policy text
- The example *Community Football Coach* vacancy starts hidden because its closing date has passed

Notes on the design:

- **Shop:** there is no checkout yet ("Book Now / Book / Add: link to the booking/e-commerce system (TBD by client)").
  Each product's button links wherever an editor sets it, so the design's basket counter is left out until a shop
  system is chosen.
- **Vacancies** show only when at least one is visible, as the handover asks.
- The **Journeys** nav item goes to the journeys section on the homepage.

## Run it locally

```bash
npm install
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe12345 npm run dev   # http://localhost:8080
npm test
```

Or with Docker: `cp .env.example .env && docker compose up --build`.

## Deploy with Portainer

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and publishes the image to
`ghcr.io/andycqos74/trust-website` with tags `<branch>`, `sha-<commit>` and `latest` (default branch), for both
amd64 and arm64.

1. In Cloudflare Zero Trust, create a tunnel (Docker) and copy its token. Add a public hostname for the site with
   service `http://web:8080`.
2. In Portainer: **Stacks → Add stack → Web editor**, paste `deploy/portainer/docker-compose.yml`.
3. Add the variables from `deploy/portainer/stack.env` (Environment variables → Advanced mode, or *Load variables
   from .env file*). Set at least `APP_TAG`, `BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and
   `CLOUDFLARE_TUNNEL_TOKEN`.
4. Deploy, then sign in at `<BASE_URL>/admin`.

The GHCR package is private by default: either make it public under the repository's *Packages* settings, or add a
GHCR registry in Portainer (username + a personal access token with `read:packages`).

To update, pick the new tag (or keep `latest`) and use **Pull and redeploy**. Content is not in the image, so updates
never overwrite edits.

If you'd rather use an existing reverse proxy than a tunnel, delete the `cloudflared` service and uncomment the
`ports:` lines on `web`.

### Back-ups

Everything editors create lives in the `site-data` volume (`site.db` plus the `media` folder). Back up that volume,
for example with a nightly copy from the Docker host:

```bash
docker run --rm -v <stack>_site-data:/data -v /backups:/backups alpine \
  tar czf /backups/trust-website-$(date +%F).tgz -C /data .
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First administrator, created only when there are no accounts yet |
| `BASE_URL` | Public address, for canonical links, sitemap and social previews |
| `CONTACT_TO`, `MAIL_FROM`, `SMTP_*` | Email contact-form messages (they are always stored in Admin → Messages) |
| `COOKIE_SECURE` | `true` in production (HTTPS only sign-in cookie); blank = automatic |
| `DATA_DIR` | Where the database and photos are kept (`/data` in the image) |
| `PORT` | Listening port (8080) |
| `TRUST_PROXY` | Express `trust proxy` setting; defaults to private networks (tunnel/proxy containers) |

## Adding something new to a page

- A single editable piece of text or photo: add a key to `src/content/defaults.js`, then use `k.text('key')`,
  `k.headline('key')`, `k.link('key')` (with a `key.url` field) or `k.image('key')` in the page template.
- A new list: add it to `COLLECTIONS` in `src/content/schema.js` (and optional starting items to `SEED` in
  `defaults.js`), then render it with `k.coll()` / `k.item()` / `k.F()` / `k.FI()` / `k.FL()`.
