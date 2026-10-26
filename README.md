# Gleam Site Engine

A small website engine where approved staff edit words, photos, links and lists **in place on the page**, with
every change recorded and undoable. The look and content model of each site come from a **theme**; the engine
supplies everything else (editing, accounts, change history, photo uploads, contact form, news-style item pages,
scheduling, sitemap, admin screens). One Docker image runs any number of sites, each in its own container with its
own theme and its own database.

Themes included:

| Theme | Site |
| --- | --- |
| `qos` | QoS Community Trust ("Winding Route" design): Home, About, Programmes, Shop, News, Gallery, Contact, Privacy |
| `solwai` | SolwAI marketing site (design handover "firstlive"): AI services home page, plus a page each for Drum, This-Organiser, Unseen, Luggage, B-ook and Gleam |
| `starter` | A plain community-hub site to copy when building a new design: Home, About, News, Contact |

## Stack

| Layer | Choice |
| --- | --- |
| Server | Node.js 22, Express 5, server-rendered HTML (no build step) |
| Content | SQLite (`better-sqlite3`) in each site's `/data` volume, with uploaded photos in `/data/media` |
| Photos | Resized on upload with `sharp` to 800 px and 1600 px WebP |
| Front end | Whatever the theme ships: plain CSS and a little vanilla JS in both built-in themes |
| Hosting | One Docker image, published to GHCR by GitHub Actions; one Portainer stack per site |

```
src/                     The engine
  app.js                 Routes: theme pages, item pages, contact form, admin, editing API
  theme.js               Loads and checks the theme named by THEME
  kit.js                 The template toolkit ("k") that marks what is editable
  document.js            The HTML document: <head>, social tags, editing tools around the theme's layout
  content/store.js       Reading/saving content, validation, change history, content updates
  content/types.js       Field types and date helpers
  theme-api.js           What themes import from the engine
  assistant.js           The visitor chat assistant (Claude): settings, site knowledge, conversations
  analytics.js           Visitor statistics: Umami's tracking script and the Umami API for Admin → Visitors
  cards.js, card-page.js Digital business cards: storage, vCard, QR codes, and the card page at /c/<code>
public/                  Engine assets, served at /_engine/ (editor.js, editor.css, admin.js, chat.js, chat.css, card.css)
themes/<name>/           One folder per theme
  theme.js               The manifest: content model, pages, layout, assets
  public/                The theme's CSS, JS, fonts and images, served at the site root
deploy/portainer         Portainer stack and its variables
```

## Editing a site (for staff)

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
7. **News:** press **+ Add news article** (homepage or News page). The new article opens on its own page: set the
   headline, **publish date**, tag and summary in the panel, then click the article text to write it (the bar above
   it does bold, italic, headings, lists and links). An article with a future publish date stays hidden from
   visitors until that day (UK time) and shows a *Scheduled* badge to editors. The homepage shows the three latest;
   the News page shows them all, newest first.
8. Press **Save changes**. Visitors see the change immediately.
9. **Page settings** (in the bar) holds the search-engine title and description, plus a few links such as the default
   *Book Now* address, Facebook/Instagram addresses and the map position.

Made a mistake? **Admin → Change history** lists every change with a *Put back* button.
Contact form messages appear under **Admin → Messages** (and are emailed too if SMTP is set up). So do phone messages
taken by the AI voice agent, if it's switched on (see [Phone messages](#phone-messages-from-the-ai-voice-agent)); the
*All / Website / Phone* buttons filter the list.

If the site is connected to Umami (see *Visitor statistics* below), **Admin → Visitors** shows how many people visit,
which pages they read, where they came from, and their countries and devices, over the last 24 hours, 7 days, 30 days
or 12 months.

Administrators add and remove editors under **Admin → People**. New people get a one-time password that they must
change at first sign-in.

## Business cards

Digital business cards for staff, like Blinq or HiHello, on the site's own domain. Each card is a phone-sized page at
`https://<your site>/c/<code>` with the person's photo, job title, phone numbers, email and links, and a **Save
contact** button that adds them to the phone's contacts (a vCard, with the photo). Share a card by its QR code or
its link. The plan and the ideas for later are in [docs/business-cards](docs/business-cards/README.md).

1. An administrator opens **Admin → Business cards → Organisation settings**: the organisation's name, logo and
   card colour, plus a main phone number, website and address that every card shares. Blank ones use the site's own
   name, admin logo and address.
2. **New card** for each person: name, pronouns, job title, team, photo, email, mobile, work phone, website, up to
   eight links (LinkedIn, a booking page, …) and a line about them. Include personal details only with the
   person's agreement: anyone with the link can see the card.
3. Each card's page in the admin shows its QR code (*SVG for print*, *PNG* for email and social media), *Copy link*
   and *Open card*, and how many times it has been viewed and saved. Visits by signed-in users aren't counted.
4. Tick *Business cards are in use* in Organisation settings. Until then every card link says "not found" to
   visitors (signed-in users can still open them to check).

The code in a card's address is random and never changes, so edits never break a printed QR code. When someone
leaves, **Deactivate** their card: its link then says "This business card is no longer in use" without any of their
details. **Delete permanently** erases the card and its change history. Card pages are `noindex`, left out of the
sitemap and blocked in `robots.txt`; with Umami set up, *Save contact* taps are counted as the `card-save` event.

## Chat assistant

An optional AI chat popup (bottom right of every page) where visitors ask about the site, e.g. *"When is the
Saturday club?"* or *"How do I book?"*, and Claude answers from the site's own words. It works with every theme and
needs no theme changes.

1. Whoever runs the server adds `ANTHROPIC_API_KEY` to the site's stack (one key can serve every site; model and
   effort are `ASSISTANT_MODEL` / `ASSISTANT_EFFORT`) and redeploys.
2. An administrator opens **Admin → Chat assistant**, ticks *Show the chat assistant to visitors*, and sets what
   makes it this site's own: its name, the line under the name, greeting, pop-up teaser, up to four suggested
   questions, button colour, **extra information** (facts not on the site: opening hours, parking, FAQs) and the
   **instructions** (who it is, what it should and shouldn't do, tone). Standard instructions are filled in to start.
3. *Use the words on this website* gives it every visible page, list and item page as its knowledge, refreshed as soon
   as anything is edited. Hidden and scheduled items are left out.

The same page lists the latest questions visitors asked and the answers they got (kept for 90 days), to help improve
the instructions. The popup is hidden while editing. Answers come from the `/_chat` endpoint (same site only, 30
questions an hour per visitor); conversations are kept in memory for an hour. A theme can open the chat from its
own button with `data-gchat-open`.

## Before go-live (QoS theme)

Copy, figures and many photos come from the Trust's strategy document (*Engage, Empower, Evolve*, October 2026).
Still to fill in, all editable in place:

- Programme times, venues and prices marked `TBC` (Programmes), and the default *Book Now* link (Programmes → Page
  settings), e.g. the online bookings site
- Shop products' `£XX` prices, and where each *Book/Add/Enquire* button goes (Shop)
- Staff names, roles and headshots (About; only Ali is shown, three empty places are hidden until filled in)
- Funder and partner logos and links (About; SPFL Trust, SGN and DWP show as names)
- A photo for Michael's story and for the programmes without one (Autism Football, Walking Football, KGV Sports Complex)
- Facebook and Instagram addresses (Gallery → Page settings); the buttons appear once set. The Trust's Facebook
  page appears to be `https://www.facebook.com/qoscommunity`
- Review the starter Privacy Policy text
- The example *Community Football Coach* vacancy starts hidden because its closing date has passed

Photos from the strategy document are in `themes/qos/public/img/trust/`, and editors can reuse them from the photo library.

Notes on the design:

- **Shop:** there is no checkout yet ("Book Now / Book / Add: link to the booking/e-commerce system (TBD by client)").
  Each product's button links wherever an editor sets it, so the design's basket counter is left out until a shop
  system is chosen.
- **Vacancies** show only when at least one is visible, as the handover asks.
- The **Journeys** nav item goes to the journeys section on the homepage.

## Before go-live (SolwAI theme)

Copy, figures and layout follow the SolwAI design handover word for word. Still to do, all editable in place unless noted:

- Replace `[EMAIL]` and `[PHONE]` in the home page's contact panel (click them), and set the address of its
  *Book a free AI review* button (click it; it starts as `mailto:[EMAIL]`).
- Give the app pages' *Get started* buttons real addresses (they go to the home page's contact panel for now).
  Unseen's *Read the docs* button stays hidden from visitors until it has an address.
- Set the addresses of the *Privacy policy* and *Terms of service* links at the bottom of each app page
  (click each link; they go nowhere until set). Each app has its own pair, so they can point to each app's own policies.
  B-ook's already point to its policies, plain HTML pages in `themes/solwai/public/b-ook/` (served at `/b-ook/privacy`
  and `/b-ook/terms`, styled by `public/css/legal.css`); edit those files to change the wording.
- Confirm the product name "Unseen" (the design system calls it "Patrician") and the Consultancy and Hosting copy.

Notes on the design:

- Each app page is built from the sections listed for it in `themes/solwai/apps.js` (intro, steps, feature cards,
  lists, grey panels, closing). Their words, steps, cards and list items are all editable; adding a new app page,
  or changing an app's accent colour or mark, is a code change (`apps.js`, `marks.js`, `solwai.css`).
- The home page figures are a list (*Figure*), each placed in the *Dumfries & Galloway* or *United Kingdom* panel.
  The counts after "Apps with AI built in" and "Services" follow the number of visible cards.
- Fonts are self-hosted (Figtree, IBM Plex Mono and Red Hat Display from Fontsource; Quadrillion and C64 Keyboard
  from the handover), so pages make no requests to Google.
- Motion is subtle and decorative: the hero settles in line by line, the big app mark draws itself in, sections and
  cards rise into place as they scroll into view, accent dashes draw out beside each key point and the headline
  figures count up. It is off in edit mode and for visitors whose device asks for reduced motion.

## Run it locally

```bash
npm install
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe12345 npm run dev   # http://localhost:8080
npm test
```

Or with Docker: `cp .env.example .env && docker compose up --build`.

## Deploy with Portainer

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and publishes the image to
`ghcr.io/andycqos74/gleam-site-engine` with tags `<branch>`, `sha-<commit>` and `latest` (default branch), for both
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

### Can't sign in?

- Don't use a `$` in `ADMIN_PASSWORD`: Docker Compose treats `$name` as a variable and silently cuts the password
  short (write `$$` if you must). The container log shows the length of the password it received.
- To get back in, either set `ADMIN_RESET=true` and redeploy (the `ADMIN_EMAIL` account's password becomes
  `ADMIN_PASSWORD` again; set it back to `false` afterwards), or open **Containers → web → Console → Connect** in
  Portainer and run `node src/reset-admin.js you@example.org` to get a temporary password.

### Back-ups

Everything editors create lives in the `site-data` volume (`site.db` plus the `media` folder). Back up that volume,
for example with a nightly copy from the Docker host:

```bash
docker run --rm -v <stack>_site-data:/data -v /backups:/backups alpine \
  tar czf /backups/<stack>-$(date +%F).tgz -C /data .
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `THEME` | Which theme the site runs: a folder in `themes/` (default `qos`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First administrator, created only when there are no accounts yet |
| `ADMIN_RESET` | `true` = on start, set the `ADMIN_EMAIL` account's password back to `ADMIN_PASSWORD` |
| `BASE_URL` | Public address, for canonical links, sitemap and social previews |
| `CONTACT_TO`, `MAIL_FROM`, `SMTP_*` | Email contact-form messages (they are always stored in Admin → Messages) |
| `VOICE_API_TOKEN` | Shared secret for phone messages from the AI voice agent; blank = off (see below) |
| `COOKIE_SECURE` | `true` in production (HTTPS only sign-in cookie); blank = automatic |
| `DATA_DIR` | Where the database and photos are kept (`/data` in the image) |
| `PORT` | Listening port (8080) |
| `TRUST_PROXY` | Express `trust proxy` setting; defaults to private networks (tunnel/proxy containers) |
| `ANTHROPIC_API_KEY` (or `ASSISTANT_API_KEY`) | Visitor chat assistant (Claude). Off unless set; each site then turns it on under **Admin → Chat assistant** |
| `ASSISTANT_MODEL`, `ASSISTANT_EFFORT` | The assistant's model (default `claude-opus-5-5`) and effort: `low`, `medium` (default), `high`, `xhigh` or `max` |
| `ASSISTANT_MAX_MESSAGES` | Questions per conversation before the visitor is asked to start a new one (default 30) |
| `UMAMI_URL`, `UMAMI_WEBSITE_ID` | Count visitors with an Umami server (address, and this site's website ID in Umami) |
| `UMAMI_USERNAME`, `UMAMI_PASSWORD` or `UMAMI_API_KEY` | A view-only Umami login, so Admin → Visitors can show the figures |
| `UMAMI_API_URL` | Only for Umami Cloud: `https://api.umami.is/v1` (self-hosted: leave blank, it is `UMAMI_URL/api`) |
| `UMAMI_SCRIPT_NAME` | The tracker's file name, if the Umami server renames it with `TRACKER_SCRIPT_NAME` (default `script.js`) |

## Phone messages from the AI voice agent

The AI voice agent (planned in [docs/voice-agent](docs/voice-agent/README.md)) answers a business's phone and turns
each call into one or more follow-up messages. It delivers them to the business's site, where they're listed under
**Admin → Messages** with the contact form messages and emailed in the same way.

Set `VOICE_API_TOKEN` to a long random value (`openssl rand -hex 32`) and give the voice agent the same value. While
it's blank the endpoint doesn't exist. The agent sends:

```
POST /api/inbound/voice-message
Authorization: Bearer <VOICE_API_TOKEN>
Content-Type: application/json

{
  "ref": "call_01J9#1",                 required; unique per message (call ID plus task number)
  "message": "Wants a price for ...",    required, up to 5,000 characters
  "name": "Mrs X",                       optional; "Unknown caller" if missing
  "phone": "+44 7700 900432",            optional; "Number withheld" if missing
  "topic": "Price request",              optional
  "urgency": "normal",                   low | normal | urgent (default normal)
  "preferred_time": "Thursday afternoon",
  "needs_review": false,                 true shows a "Please check" badge
  "transcript_url": "https://...",       must start with http(s)://
  "at": "2026-11-03T14:12:00Z"           when the call was taken (default: now)
}
```

Replies: `201 {"ok": true, "id": 12}` when stored; `200 {..., "duplicate": true}` if that `ref` was already stored
(so the agent can safely retry); `401` for a wrong or missing token (20 failures in 15 minutes from one address get
`429`); `422 {"errors": {...}}` for invalid fields; `404` when `VOICE_API_TOKEN` isn't set.

## Visitor statistics (Umami)

Sites count visitors with [Umami](https://umami.is), an open-source, privacy-friendly alternative to Google Analytics.
Umami runs on its own (one server for every site, Gleam or not) and counts visits without cookies and without
storing IP addresses. Gleam adds two things:

- **The tracking script.** With `UMAMI_URL` and `UMAMI_WEBSITE_ID` set, every public page loads Umami's script, and the
  site's Content-Security-Policy allows the Umami server. Signed-in editors are not counted. The script is set to
  ignore query strings (they can carry personal details) and visitors whose browser sends *Do Not Track*, and
  `data-domains` limits counting to the `BASE_URL` host and its `www.` / bare-domain twin, so test copies of a site
  don't count.
- **Admin → Visitors**, showing the site's figures read from the Umami API by the server (the Umami login never
  reaches a browser, and figures are cached for five minutes). If Umami is unreachable the page says why; the public
  site is unaffected.

To connect a site:

1. Run an Umami server, for example with the Umami Portainer stack in `deploy/umami/`, at an address such as
   `https://stats.example.org`.
2. In Umami, **Settings → Websites → Add website** with the site's domain, and copy its **Website ID**.
3. Give Gleam a login that can only read statistics. Once, in Umami: create a team (**Settings → Teams → Create
   team**, e.g. *Websites*); move each website into it (the website's **Settings → Transfer**); create a user with role
   **View only** (**Admin → Users → Create user**, e.g. `gleam`); and add that user to the team with role **Team view
   only** (the team's **Add member**). That account sees the team's websites and can change nothing; one account
   serves every site.
4. On the site's stack, set `UMAMI_URL`, `UMAMI_WEBSITE_ID`, `UMAMI_USERNAME` and `UMAMI_PASSWORD` (or
   `UMAMI_API_KEY` with an API key made while signed in as that user), then redeploy.

Leave two-factor sign-in off for the Gleam account (Gleam can't answer the code). Umami Cloud works too: set
`UMAMI_URL=https://cloud.umami.is`, `UMAMI_API_URL=https://api.umami.is/v1` and `UMAMI_API_KEY`.

Before turning it on, mention it in the site's privacy policy, e.g. *"We count visits with Umami, run on our own
server. It doesn't use cookies or store your IP address, and we can't identify you from it."* (The QoS Privacy page
and the B-OOK policy currently say the site uses no analytics.)

## Running more than one site

Every site is the same image with a different `THEME` and its own `/data` volume, so sites never share content,
accounts or photos.

1. In Portainer, add another stack from `deploy/portainer/docker-compose.yml` with a new stack name (e.g.
   `riverside-hub`). Portainer prefixes volumes with the stack name, so the new site gets its own `site-data`.
2. Set its variables: `THEME` (e.g. `starter`), `BASE_URL`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`, its own
   `CLOUDFLARE_TUNNEL_TOKEN` (or one tunnel with several public hostnames, if you put the sites on one network) and
   its own `CONTACT_TO`.
3. Deploy. The first start creates the site's database from the theme's starting content.

A theme that isn't built into the image can be kept on the server and mounted read-only at
`/app/themes/<name>` (see the commented line in the stack), with `THEME=<name>`. Updating the engine is then just
**Pull and redeploy**, and each site picks up the new engine with its own theme and content unchanged.

Locally, two sites side by side:

```bash
THEME=qos     DATA_DIR=./data-qos     PORT=8080 npm start
THEME=starter DATA_DIR=./data-starter PORT=8081 npm start
```

## Writing a theme

Copy `themes/starter` to `themes/<your-name>` and edit. A theme is a folder with:

- **`theme.js`**, whose default export is the manifest:

  | Key | What it is |
  | --- | --- |
  | `name`, `lang`, `timeZone` | Site name (fallback for the admin screens), page language, time zone for scheduled items |
  | `fields` | Single editable values: `{ 'home.hero.title': f.headline('Hello [world]'), ... }`. Types: `text`, `textarea`, `rich`, `headline`, `url`, `image` (helpers in `src/theme-api.js`). `meta.<page>.title` / `.description` become each page's title and description. Add `settings: ['<page>' or '*'], label` to put a field in that page's *Page settings* panel instead of on the page. |
  | `collections` | Editable lists: `{ team: { label, fields: { name: { type, label, default }, ... } } }`, plus optional `sortBy: '<field>'` (newest first), `publishDate: '<date field>'` (hidden until that day) and `itemPage: { base, titleField, render, meta }` (a page per item at `<base>/<id>-<slug>`). Field types add `select` (with `options`), `bool`, `list` and `date`. Every list gets *Hide from visitors* automatically. |
  | `seed`, `contentUpdates` | Starting items for each list; later revisions for running sites (see below) |
  | `pages` | `{ '/about': { key: 'about', render(k, extra) } }` |
  | `layout(k, { page, body })` | Everything inside `<body>`: header, `body`, footer. Links in `<header>` stay clickable in edit mode. |
  | `head(k, { page, version })` | Optional extra `<head>` content (font preloads, early scripts) |
  | `stylesheets`, `scripts` | Asset paths in the theme's `public/` folder |
  | `contact: { path, topics }` | Optional: the page whose form posts `name`, `email`, `topic`, `message` (and an empty `website` honeypot) |
  | `notFound(k)`, `favicon`, `shareImage`, `adminLogo`, `colours`, `csp` | Optional extras (`csp: { frameSrc: [...] }` allows e.g. a map embed; also `imgSrc`, `styleSrc`, `scriptSrc`, `fontSrc`, `connectSrc`) |

- **Templates** get `k`, the engine's toolkit. For single fields: `k.text(key, { tag, cls })`, `k.headline`,
  `k.rich`, `k.image`, `k.link(key)` (words in `key`, address in `key.url`), `k.value(key)`. For lists:
  `k.items(name)`, then `k.coll(name, items.map((it) => k.item(it, inner)))` with `k.F(it, field)`,
  `k.FI(it, imageField)` and `k.FL(it, labelField, urlField)` inside. Also `k.ed` (is an editor editing),
  `k.itemUrl(it)`, `k.scheduled(it)`, `k.status(it)` (editors' Hidden/Scheduled badge) and `k.date(iso)`.
  Escape-safe HTML comes from `html` in `src/theme-api.js`.
- **`public/`**: the theme's CSS, JS, fonts and images, served at the site root. Images that editors should be able
  to pick from the photo library go in `public/img/`. Style `.ph` (an empty photo slot) and `.pill` (highlighted
  headline words); the editing tools style themselves.

Run `npm test`, then `THEME=<your-name> npm run dev` to try it. The engine checks the manifest at start-up and
explains anything missing.

### Changing a theme's content on sites that already run it

Text fields need nothing: unedited fields always show the theme's current default, and edited ones keep the
editor's words. For lists, edit `seed`, then add an entry to the theme's `contentUpdates` with a new key, e.g.
`{ key: 'update:2027-01', replace: ['team'], append: ['news'] }`. On the next start, each `replace` list is swapped
for the new seed only if nobody has edited it on that site (otherwise it is kept and the log says so), and
`append` lists gain items whose title isn't there yet.

