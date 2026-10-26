# Digital business cards: research and plan

Status: Phase 1 is built (October 2026), without NFC; see [Business cards](../../README.md#business-cards) in the main
README for how to use it. Decided since the first draft: cards are an option in Gleam for every site, administrators
make and edit all cards (no self-editing), there's no "share your details back" form, and NFC is left for later (it
may come back as phone-to-phone sharing).

This plan adds digital business cards to the engine, similar to [Blinq](https://blinq.me/solutions/digital-business-card)
and [HiHello](https://www.hihello.com/features/digital-business-cards). An administrator creates a card for each
employee. Each card is a small page on the site's own domain. People open it from a QR code, an NFC card or tag, or a
link, and save the person to their phone's contacts with one tap.

It is an engine feature, so it works on every site and theme in the same way as Messages or the chat assistant. It
is off until an administrator turns it on.

## Contents

1. [What the commercial products do](#what-the-commercial-products-do)
2. [Scope of the first version](#scope-of-the-first-version)
3. [How it works](#how-it-works)
4. [Sharing: link, QR and NFC](#sharing-link-qr-and-nfc)
5. [Saving the contact (vCard)](#saving-the-contact-vcard)
6. [Fit with the engine](#fit-with-the-engine)
7. [Data model](#data-model)
8. [Routes](#routes)
9. [Admin screens](#admin-screens)
10. [Privacy (UK GDPR)](#privacy-uk-gdpr)
11. [Dependencies and costs](#dependencies-and-costs)
12. [Risks](#risks)
13. [Phased plan](#phased-plan)
14. [Open questions](#open-questions)

## What the commercial products do

Both products offer roughly the same features. The table shows what each one means for Gleam.

| Feature | Blinq / HiHello | Gleam |
| --- | --- | --- |
| Card page on the web, opens without an app | Yes | **Phase 1** |
| QR code to scan, download or print | Yes | **Phase 1**, made on the server |
| Save contact to the phone (vCard) | Yes | **Phase 1** |
| NFC card or tag that opens the card | Yes, they sell branded cards | Later (see [NFC](#nfc)); phone-to-phone sharing may be explored instead |
| Admin creates cards for staff, with company branding | Business plans | **Phase 1** |
| Staff can edit their own card | Yes | Not planned: administrators edit cards |
| Lead capture: "share your details back" form | Yes | Not planned: *Save contact* only |
| Analytics (views, saves) | Paid plans | Phase 1 counters; Umami already counts page views |
| Email signature and video-call background | Yes | Phase 2 signature snippet; backgrounds left out |
| Apple Wallet / Google Wallet pass | Yes | Phase 3, optional (needs developer accounts, see below) |
| Home or lock screen widget, Apple Watch | Native apps | Left out: needs a native app. Adding the QR image to the phone's photos covers most of it |
| CRM sync, SSO, HR system import, card scanning | Enterprise | Left out. A CSV import may come in Phase 2 |

## Scope of the first version

**In scope**

1. **Admin → Business cards** (administrators only): a list of cards, plus a form to add, edit, deactivate or delete
   one. The form takes a name, pronouns, job title, department, email, phone, mobile, a photo, a short bio and links
   (LinkedIn, website, booking page and so on).
2. **Organisation settings** shared by every card: organisation name, logo, accent colour, address and website. They
   default to the theme's `adminLogo`, `colours` and `site.name`.
3. A **public card page** at a short, permanent address, `/c/<code>`, designed to be read on a phone. It shows
   *Save contact*, tap-to-call, tap-to-email and the links.
4. A **vCard download** (`.vcf`) that includes the photo.
5. A **QR code** as SVG and PNG on the admin screen, ready to print or download.
6. View and save **counters** on each card.

**Out of scope for now:** NFC, wallet passes, email signatures, CSV import and CRM sync (see
[Phased plan](#phased-plan)). Staff self-editing and the lead-capture form were dropped.

## How it works

```
Admin → Business cards → New card
   └─ saves a row in `cards` with a random code, e.g. k7m2qx9d
        └─ the card's address is https://<site>/c/k7m2qx9d

That address goes on:  QR code (printed, shown on screen, emailed)
                       NFC card or sticker (written once)
                       email signature, LinkedIn, text message

Someone scans or taps → card page → [Save contact] → /c/k7m2qx9d.vcf → phone's "Add contact" screen
```

The code is random and never changes. Nothing printed or written to a tag depends on the person's name, job title or
details, so editing a card never breaks a QR code or an NFC tag that is already in use.

## Sharing: link, QR and NFC

### QR codes

- Generated on the server with the [`qrcode`](https://www.npmjs.com/package/qrcode) package (MIT licence, no native
  code), as SVG (for print) and PNG (for email and social media). Nothing extra loads in the browser, so the
  Content-Security-Policy stays the same.
- The QR code holds the card's **address**, not the vCard. A short address makes a sparse code that scans easily
  from a distance and on a lanyard. Every QR scanner, and the camera on every iPhone and Android phone, opens a web
  address.
- Error correction level M, plus an option to put the organisation's logo in the middle at level H.
- The card page also shows its own QR code, so one person can hold up their phone for another to scan. That's the
  "share in person" flow the apps offer.

### NFC

> Not built: NFC is set aside for now, and may come back as phone-to-phone sharing. The notes below are kept for
> then. Any NFC tag written with a card's address works with the cards as built.

NFC is possible, with one limitation: only Chrome on Android can **write** a tag from a web page. Any modern phone
can **read** one.

| | Android | iPhone |
| --- | --- | --- |
| **Read** a tag (open the card) | Yes. Tap the phone on the card and the link opens | Yes, on iPhone XS and later, with no app. A banner appears and opens the link |
| **Write** a tag from the Gleam admin page | Yes, in Chrome, using [Web NFC](https://developer.chrome.com/docs/capabilities/nfc) (`NDEFReader.write`). Needs HTTPS, a button press and NFC turned on | No. Safari has no Web NFC. Use a free app such as *NFC Tools*: paste the card's address and write it |

**What goes on the tag:** a single NDEF URL record holding the card's address, about 40 bytes. Any NTAG213 chip
(144 bytes) is enough. We won't put a whole vCard on the tag: iPhones don't act on a vCard read in the background, the
photo wouldn't fit, and a URL lets the details change without rewriting the tag.

**The admin button** ("Write to NFC tag", shown only where `'NDEFReader' in window`):

```js
const ndef = new NDEFReader();
await ndef.write({ records: [{ recordType: 'url', data: cardUrl }] });
```

After writing, the page offers to **lock the tag** (`ndef.makeReadOnly()`) so nobody can overwrite it. Locking is
permanent, so it's a separate, confirmed step. The engine's `Permissions-Policy` header doesn't restrict NFC today,
so it needs no change.

**Physical cards:** blank PVC NTAG213 or NTAG215 cards cost roughly £0.50 to £2 each in small quantities. Cards printed
with the organisation's design cost roughly £3 to £10 each, from many UK suppliers. Stickers (for a phone case or
a reception desk) and key fobs also work. We don't need to sell or brand hardware. The supplier can write the URL to
the chip, or staff write it themselves with the button above. Printing the same QR code on the back of the card is
a fallback for phones with NFC turned off.

## Saving the contact (vCard)

- `/c/<code>.vcf` returns `text/vcard; charset=utf-8` with `Content-Disposition: attachment; filename="Ali Smith.vcf"`.
- **vCard 3.0** rather than 4.0, because iOS Contacts handles 3.0 more reliably. Fields: `N`, `FN`, `ORG`, `TITLE`,
  `TEL;TYPE=WORK,VOICE`, `TEL;TYPE=CELL`, `EMAIL;TYPE=WORK`, `URL` (the card page and each link), `ADR;TYPE=WORK`,
  `NOTE` (bio) and `PHOTO;ENCODING=b;TYPE=JPEG` (a 300 px square JPEG made with `sharp`, about 20 KB).
- Text is escaped (`\,` `\;` `\n`) and lines are folded at 75 octets, as RFC 2426 (vCard 3.0) requires. This has its own unit
  tests, because a bad vCard fails silently on some phones.
- **iPhone:** Safari opens the contact preview with *Create New Contact*. **Android:** Chrome downloads the file, and
  opening it imports the contact into Contacts. This is the same flow Blinq and HiHello use on the web.

## Fit with the engine

The feature reuses what the engine already has:

| Need | Reuse |
| --- | --- |
| Admin-only screens | `adminRouter` with `auth.requireAdmin`, plus `adminLayout` and the forms in `src/admin-pages.js` |
| Photo upload and resize | `media.save()` in `src/media.js`, plus one square crop for the vCard |
| Change history and *Put back* | The `revisions` table, with a new `kind = 'card'`. `store.restore()` gets a branch for it |
| Organisation-wide settings | A JSON value in the `meta` table, as the chat assistant's settings are stored |
| Branding | `theme.adminLogo`, `theme.colours`, `site.name` as defaults |
| Visitor counts | Umami already tracks page views. The *Save contact* button gets `data-umami-event="card-save"` |

The card page is drawn by the **engine**, as the admin screens are, not by the theme's layout. That way it looks
like a card rather than a full website page, it loads fast on a phone, and every theme gets it with no work. It
takes the theme's logo and accent colour, and a theme may override it later with an optional `card(k, card)`
function in its manifest.

## Data model

New table, created by `src/cards.js` on new and existing databases (as the chat assistant creates its own):

```sql
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,         -- in the address /c/<code>; random, never changes or gets reused
  data TEXT NOT NULL,                -- JSON: name, pronouns, title, department, email, phone, mobile,
                                     --       photo, bio, links: [{ label, url }]
  active INTEGER NOT NULL DEFAULT 1, -- 0 = deactivated: the page says the person has moved on
  views INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER
);
```

- **Code:** 8 characters from the lookalike-free alphabet already used by `randomPassword()` (about 10^13
  possibilities), so nobody can guess or list the cards.
- **Organisation settings:** `meta` key `cards.settings`, holding `{ enabled, orgName, logo, accent, website, phone,
  address }`.
- **Counters:** a plain `UPDATE ... SET views = views + 1`. Signed-in users and obvious bots aren't counted. Counters
  never write a revision.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /c/:code` | Anyone | The card page. Deactivated: "This business card is no longer in use", with nothing about the person and a link to the organisation's website (HTTP 410). Unknown: 404 |
| `GET /c/:code.vcf` | Anyone | vCard download; counts a save |
| `GET /c/:code/qr.svg`, `qr.png` | Anyone | The QR code (so it can be used in an email signature) |
| `GET /admin/cards` | Admin | List of cards with their links, views and saves; deactivated cards last |
| `GET/POST /admin/cards/new`, `/admin/cards/:id` | Admin | Add or edit a card (photo upload through the existing `/api/media`) |
| `POST /admin/cards/:id/active`, `/delete` | Admin | Deactivate or reactivate, or erase a card |
| `GET/POST /admin/cards/settings` | Admin | Organisation settings and the on/off switch |

Card pages carry `<meta name="robots" content="noindex">` and are left out of `sitemap.xml`. `robots.txt` gains
`Disallow: /c/`. With the feature off, every `/c/` route returns 404.

## Admin screens

**Business cards (list):** photo, name, title, views, saves and active status, with *New card* and *Organisation
settings* buttons. The dashboard gets a tile for it, as it has for the chat assistant.

**Card editor:** the form on the left, and on the right the sharing panel:

- The QR code, with *SVG for print* / *PNG* downloads
- The card's address with *Copy link* and *Open card*
- Views and saves, *Deactivate* / *Reactivate* and *Delete permanently*

Later: *Email this card to <person>* (when SMTP is set up), and NFC (see above).

## Privacy (UK GDPR)

Cards publish employees' personal data, so:

- The lawful basis is usually *legitimate interests* (work contact details for a business purpose). Mobile numbers,
  photos, pronouns and bios are **optional**, and the form says to include them only with the person's agreement.
- Pages are `noindex` and the codes can't be guessed, but anyone with a link can still read the card. The admin
  screen says so.
- **Deactivate** (someone leaves) hides the details at once. **Delete** erases the row; the uploaded photo stays in
  the photo library, as with other uploads, until someone removes it. Revisions of a deleted card are erased too,
  so the person's details don't survive in the change history.
- The QoS privacy page needs a sentence about cards before it goes live.

## Dependencies and costs

| Item | Cost |
| --- | --- |
| `qrcode` npm package | Free (MIT) |
| `sharp` (already used) | Free |
| Blank NFC cards or stickers (NTAG213/215) | ~£0.50–£2 each |
| Printed branded NFC cards | ~£3–£10 each, depending on quantity and supplier |
| Apple Wallet passes (Phase 3) | Apple Developer Program, US$99 a year, plus a Pass Type ID certificate on the server |
| Google Wallet passes (Phase 3) | Free Google Wallet issuer account; a "Generic pass" signed as a JWT |

Compared with Blinq or HiHello business plans, which charge per user per month, this is a one-off build. The only
running costs are optional ones (physical cards, the Apple Developer fee).

## Risks

- **Web NFC is Android/Chrome only** and still marked experimental. The feature works without it (QR and link), and
  iPhone users write tags with a free app. If Chrome ever removed it, only the convenience button would go.
- **vCard quirks** between phones and contact apps. To reduce it: vCard 3.0, tested on a current iPhone, a current
  Android phone and Outlook before release.
- **A lost or misused NFC card or QR code** still points to the person's card. Deactivate the card in the admin and
  issue a new one, which gets a new code.
- **Card pages as a scraping target:** random codes, `noindex`, no listing page and the existing rate limits keep
  this low.

## Phased plan

**Phase 1: cards, QR and vCard (built)**

1. `cards` table, card store (CRUD, revisions, restore branch) and settings in `meta`
2. Admin list, editor, organisation settings and dashboard tile
3. Public card page (engine-rendered, themed with the logo and colour), deactivated and unknown pages, `noindex`,
   `robots.txt`
4. vCard builder with escaping, folding and photo, plus unit tests
5. QR SVG and PNG endpoints
6. View and save counters, and the Umami event attribute
7. Tests in `test/cards.test.js` (routes, admin-only access, 404 when off, vCard content) and a README section

**Phase 2: sharing further**

- NFC, or phone-to-phone sharing (see [NFC](#nfc))
- An email signature snippet (HTML with the photo, name and title, plus the QR code or card link) to copy into
  Outlook or Gmail
- CSV import for adding many staff at once
- *Email this card to the person*

**Phase 3: optional extras**

- Google Wallet and Apple Wallet passes showing the QR code (costs above)
- Let a theme supply its own card design (`card(k, card)` in the manifest)
- More than one card per person (for example, a coaching card and a Trust card)

## Open questions

Settled: cards are a Gleam option for every site; administrators edit all cards; *Save contact* only, no lead
form; NFC later.

1. Should the card address be on the main domain (`/c/...`), or on a separate short domain for smaller QR codes? The
   main domain is simpler and the codes are already short.

## Sources

- Blinq digital business card features: https://blinq.me/solutions/digital-business-card
- HiHello digital business card features: https://www.hihello.com/features/digital-business-cards
- Web NFC (Chrome for Android): https://developer.chrome.com/docs/capabilities/nfc
- Web NFC API on MDN (experimental, limited support): https://developer.mozilla.org/docs/Web/API/Web_NFC_API
- vCard 3.0, RFC 2426: https://www.rfc-editor.org/rfc/rfc2426
