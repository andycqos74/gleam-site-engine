// The six app pages. They share one template (pages/app.js); this file says what each one has: its address, mark
// and accent (styled in solwai.css as body.page-<key>), the sections in order, and the starting words.
// Every word here becomes an editable field or list item, so editors change copy in place, not in this file.
//
// Section types (rendered by pages/app.js):
//   intro     two columns: heading on the left, a few paragraphs on the right
//   how       numbered steps (list <key>Steps)
//   features  cards with a cut corner (list <key>Features; "wide" spans the row)
//   list      heading and text beside a list with hairline rules (list <key>Points)
//   platforms a short list (list <key>Points) beside grey panels (list <key>Panels)
//   reasons   short points in a row under a hairline (list <key>Points)
//   panels    grey panels with an optional label (list <key>Panels)
//   closing   two columns: heading and one paragraph
// An app can also list legal links (legal: [[words, address], ...]), shown in a small row under the closing band.

export const APPS = [
  {
    key: 'drum',
    path: '/drum',
    name: 'Drum',
    mark: 'drum',
    title: 'Drum · SolwAI',
    hero: {
      title: 'Loyalty cards your customers won\'t lose.',
      lead: 'A digital stamp card for independent cafés. Customers join in seconds, staff stamp it with a scan, and you can see who keeps coming back. There\'s no app to download, no hardware to buy and no paper cards ending up in the bin.',
      cta: ['Start your loyalty programme', '/#contact'],
      cta2: ['See how it works ↓', '#how'],
      cta2Style: 'text',
    },
    sections: [
      { type: 'intro', title: 'The problem', body: '<p>Paper stamp cards get lost, forgotten and faked. Big-chain loyalty apps ask customers to download something they\'ll never open, and they keep your customer data for themselves. <strong>Your regulars deserve better, and so does your business.</strong></p>' },
      { type: 'how', title: 'How it works' },
      { type: 'features', title: 'Features' },
      { type: 'reasons', title: 'Why cafés choose Drum' },
    ],
    steps: [
      ['Customers join in 10 seconds', 'They scan a QR code on your counter, type their name, and their card is ready. There\'s no app store, no password and no account to forget. They can add it to their home screen or save it to Google Wallet.'],
      ['Staff scan, tap, done', 'Your till screen runs on any phone or tablet. Point the camera at the customer\'s QR code, tap "+1 coffee" or enter what they spent, and you\'re done. It takes about two seconds, even with a queue out the door.'],
      ['Their card updates instantly', 'The customer sees the new stamp land on their phone right there at the counter. When a card is full, it tells them their next one is free.'],
    ],
    features: [
      ['Stamp cards or points, your choice', 'Run a classic "buy 9, get the 10th free" stamp card, a points-per-pound scheme, or both side by side. You decide the rewards and what they cost.'],
      ['No app required', 'It works in any phone browser. Customers can install it to their home screen in one tap or add it to Google Wallet, so it\'s always in their pocket.'],
      ['Live updates', 'Stamps and rewards show up on the customer\'s card the moment they\'re added. Their Google Wallet pass updates too.'],
      ['Simple and secure for staff', 'The till and admin areas are PIN-protected, so staff can only stamp and redeem while you keep control of everything else.'],
      ['Know your regulars', 'Your dashboard shows signups, stamps earned and rewards redeemed by day and by day of week. Pick this week, last month or all time and spot your busiest days at a glance.'],
      ['Your customer list, owned by you', 'See every member, what they\'ve spent and their full history. Adjust points, fix mistakes or remove a customer in a couple of clicks.'],
      ['GDPR-friendly marketing opt-in', 'Customers choose whether to hear about offers when they sign up, and a clear privacy policy is built in. You build a mailing list of people who actually want to hear from you.'],
      ['Your brand, front and centre', 'Your café name, your logo and your rewards appear on the card, the till and the wallet pass.'],
    ],
    points: [
      ['No hardware.', 'Use the phone or tablet you already have.'],
      ['No training.', 'If your staff can use a camera, they can use the till.'],
      ['No friction for customers.', 'They join in seconds and nothing gets downloaded.'],
      ['No middleman.', 'Your customer data stays yours.'],
    ],
    cta: { title: 'Turn first-time visitors into regulars.', text: 'Set up your loyalty programme today and stamp your first card this afternoon.', button: ['Get started', '/#contact'] },
    legal: [['Privacy policy', ''], ['Terms of service', '']],
  },
  {
    key: 'organiser',
    path: '/this-organiser',
    name: 'This-Organiser',
    mark: 'organiser',
    title: 'This-Organiser · SolwAI',
    hero: {
      title: 'Get it out of your head. Get it done.',
      lead: 'This-Organiser is a task manager built around how work really happens. You capture things fast, plan each day realistically and always know what to start next.',
      cta: ['Get started', '/#contact'],
      cta2: ['See how it works', '#features'],
    },
    sections: [
      { type: 'intro', title: 'The problem', body: '<p>Most to-do apps are good at collecting tasks and bad at telling you when to start them. The due date shows up, the work doesn\'t fit, and the list keeps growing.</p><p><strong>This-Organiser works backwards from your deadlines. It tells you what to do today, not just what\'s due.</strong></p>' },
      { type: 'features', title: 'Features', id: 'features' },
      { type: 'closing', title: 'Your data, your server', text: 'This-Organiser runs as a single Docker container. Pull it, start it and open your browser. Your tasks stay in your own database and survive updates. Use it alone with no sign-in, or turn on accounts (email and password, or Google) where every person\'s data is fully separate.' },
    ],
    features: [
      ['Know when to start, not just when it\'s due', 'Every task has a <strong>due date</strong>, an <strong>estimated time to complete</strong> and a <strong>do date</strong> that\'s worked out from the other two. Give it "1d 4h" and a Friday deadline, and This-Organiser tells you when to begin. You can override the do date whenever you like and reset it with one click.', { wide: true }],
      ['Capture in one line', 'Every screen has a quick-add box. Type a title and press Enter. Dates, estimates, checklists, tags and dependencies can wait until later. Quick-add even works offline and syncs when you\'re back online.'],
      ['My Day', 'Start each morning with a short, realistic list: tasks you\'ve flagged for today plus anything whose start date has arrived. If you\'ve planned more hours than your day has, it warns you before you find out the hard way.'],
      ['Let AI plan your day', 'Click <strong>Plan my day</strong> and Claude picks a realistic set of tasks, with a reason for each one. Click <strong>Prioritise</strong> to rank everything that\'s open. No API key? A built-in planner still ranks your work using deadlines, priority, dependencies and workload.'],
      ['See the whole picture', '<ul><li><strong>Upcoming:</strong> a rolling view of what\'s overdue, due today, tomorrow, this week and later.</li><li><strong>Timeline:</strong> a clean Gantt chart grouped by project, with dependency lines and a "today" marker.</li><li><strong>Kanban boards and an epic-level roadmap</strong> for longer-running work.</li></ul>'],
      ['Dependencies that make sense', 'Mark a task as blocked by another. Blocked tasks are labelled clearly, drop down the ranking and are never suggested for today. Circular dependencies are caught before they cause trouble.'],
      ['A notepad that\'s always there', 'A ruled scratch pad sits at the bottom of every screen. Click anywhere on it to start a note, drag notes around and attach a note to a task or project. Turn any line into a task with one click.'],
      ['Work and personal, kept apart', 'Separate <strong>workspaces</strong> each keep their own projects, tasks, notes and boards. Moving a project, task or board to another workspace takes everything that belongs to it.'],
      ['Built for developers too', 'Plan epics, stories and tasks, track ideas and bugs, then <strong>push any of them to GitHub as issues</strong> with one click. When a pull request closes an issue, This-Organiser marks the item done.'],
      ['Everywhere you are', 'Install it on your phone, tablet or desktop as an app. It opens without a connection and sends a <strong>daily digest</strong> of what\'s overdue and due today, at a time you choose.'],
    ],
    cta: { title: 'Stop managing your list. Start finishing it.', text: '', button: ['Get This-Organiser', '/#contact'] },
    legal: [['Privacy policy', ''], ['Terms of service', '']],
  },
  {
    key: 'unseen',
    path: '/unseen',
    name: 'Unseen',
    mark: 'patrician',
    title: 'Unseen · SolwAI',
    hero: {
      title: 'Back up every server from one screen, without opening a single port.',
      lead: 'Unseen is a self-hosted backup system you control from a web dashboard. You install a small agent on each Windows, Linux or Docker machine. The agent connects out to your server, so you don\'t need a VPN, firewall changes or inbound ports on the clients.',
      cta: ['Get started', '/#contact'],
      // No address yet: the button stays hidden from visitors until an editor gives it one.
      cta2: ['Read the docs', ''],
    },
    sections: [
      { type: 'intro', title: 'The problem', body: '<p>Backing up a mix of machines usually means a different tool on each box, scripts nobody remembers writing, and a VPN or port-forward for every remote site. When something breaks, you find out at restore time.</p><p><strong>Unseen puts all of it on one server, behind one port, in one dashboard.</strong></p>' },
      { type: 'how', title: 'How it works' },
      { type: 'features', title: 'Features' },
      { type: 'platforms', title: 'Supported platforms' },
    ],
    steps: [
      ['Run the server.', 'Start it with one Docker Compose command, or install it as a single binary with systemd. Open the web interface and create your admin account.'],
      ['Enroll your clients.', 'Click <em>Enroll new client</em> and download the installer for that platform. The server address, a one-time token and the certificate fingerprint are already built into the installer, so there\'s nothing to copy. Run it once and the machine is protected.'],
      ['Set it and forget it.', 'Define jobs, schedules and retention in the dashboard. Backups run on time, and you can watch them progress live.'],
    ],
    features: [
      ['No inbound ports, no VPN', 'Agents make outbound TLS connections to your server and keep a control channel open. The server can then start backups, restores and job changes on demand, even on machines behind NAT or at remote sites. Your server only needs to expose one port.'],
      ['Full and incremental backups', 'Incremental runs read only the files that changed and upload only data the server doesn\'t already have. Every snapshot is still complete on its own, so a restore never has to rebuild a chain of incrementals.'],
      ['Built-in deduplication and compression', 'Data is stored by its SHA-256 hash and compressed with zstd. Identical data is stored once, even across different snapshots and different machines.'],
      ['Security built in', '<ul><li>Agents pin your server\'s certificate fingerprint, so a self-signed certificate is safe to use.</li><li>Each client enrolls with a one-time token.</li><li>Every block of data is hash-checked on upload and again on restore.</li></ul>'],
      ['Manage jobs from the dashboard or the client', 'Edit a job in the web interface, or on the machine itself with <code>backup-agent job add</code> or <code>agent.yaml</code>. Changes sync both ways automatically.'],
      ['Flexible scheduling', 'Set a cron schedule for each job, click <em>Back up now</em> whenever you need to, and have missed runs catch up when an offline machine comes back online.'],
      ['Retention that cleans up after itself', 'Keep the last N snapshots, or everything newer than N days. Old data is garbage-collected automatically.'],
      ['Works with Docker', 'The job editor shows a host\'s containers as tick-boxes, grouped by Compose stack. It fills in the volume paths for you, and for databases it recognises it also writes the dump hook, such as <code>pg_dump</code>.'],
      ['Store backups where you want', 'Use the server\'s local disk, any S3-compatible provider (Backblaze B2, Wasabi, Cloudflare R2, MinIO, Storj), or your own OneDrive or Google Drive, which you connect from the dashboard.'],
      ['Browse, restore and download', 'Look through any snapshot, then restore files to the original machine or download them straight from your browser.'],
      ['Remote file transfer', 'Browse a client\'s filesystem from the dashboard and send files to it or pull files from it. Transfers run quietly in the background, are checked end to end, and wait in a queue if the machine is offline.'],
      ['Remote command console', 'Run PowerShell, cmd or sh commands on any client and watch the output stream back live. You can cancel a command at any time, and doing so stops every process it started.'],
    ],
    points: [
      ['Windows Server', '(including legacy Windows 7-era systems)'],
      ['Ubuntu and Linux', ''],
      ['macOS', ''],
      ['Docker hosts', ''],
    ],
    panels: [
      ['', 'Your data stays yours', 'Unseen is self-hosted. Your backups go only to storage you choose, on hardware or accounts you control. There\'s no third-party service in the middle and no lock-in.'],
    ],
    cta: { title: 'Protect every machine you manage in an afternoon.', text: 'Run one server, install one agent per machine, and handle every backup from one dashboard.', button: ['Deploy Unseen', '/#contact'] },
    legal: [['Privacy policy', ''], ['Terms of service', '']],
  },
  {
    key: 'luggage',
    path: '/luggage',
    name: 'Luggage',
    mark: 'luggage',
    title: 'Luggage · SolwAI',
    hero: {
      title: 'Every drive you own, as one drive',
      lead: 'Luggage pools your local disks, OneDrive and Google Drive into a single self-hosted drive, with instant sharing links for every file.',
      cta: ['Get started', '/#contact'],
      cta2: ['How it works', '#how'],
    },
    sections: [
      { type: 'intro', title: 'Stop juggling storage accounts', body: '<p>You\'ve got space spread all over the place: a disk on your server, a OneDrive account, a Google Drive with some room left. Each has its own app, its own limit and its own folder structure, and none of them talk to each other.</p><p><strong>Luggage puts them together.</strong> Connect your storage and you get one file tree and one total capacity. A 1 GB local disk plus a 1 GB OneDrive shows up as 2 GB. You don\'t have to decide where a file goes; it just goes somewhere with room.</p>' },
      { type: 'how', title: 'How it works' },
      { type: 'features', title: 'A file manager that feels like a desktop app', dash: false },
      { type: 'list', title: 'Your files, served like a CDN', text: 'Every file gets a permanent public link that keeps working even if the file ends up stored somewhere else.' },
      { type: 'panels' },
    ],
    steps: [
      ['Connect your storage.', 'You can add local disks and sign in to OneDrive and Google Drive from the admin page. You can turn each one on or off, or remove it, whenever you like.'],
      ['Upload like it\'s one drive.', 'Drag and drop files in, and each upload goes to whichever connected storage has the most free space. If everything is full, it tells you plainly instead of failing quietly.'],
      ['Organise freely.', 'Renaming and moving files is instant, even with huge files. Your folder structure is kept separately from where the files are actually stored, so nothing gets copied between services when you tidy up.'],
    ],
    features: [
      ['Bulk actions', 'Select many files at once, then delete, move, copy or generate links in one go.'],
      ['Drag and drop', 'Between folders, or between two side-by-side panes. Hold Ctrl to copy.'],
      ['Built-in previews', 'For images, PDFs, video, audio and text, plus a thumbnail grid view.'],
      ['Edit images inline', 'Without downloading them.'],
      ['Large uploads just work.', 'Big files are sent in chunks, so you won\'t hit upload size limits like Cloudflare\'s 100 MB cap.'],
    ],
    points: [
      ['Friendly link names:', '<code>/f/team-logo</code> reads better than a random string.'],
      ['Images resized on the fly:', 'add <code>?w=800</code> or <code>?w=400&amp;h=400</code> to a link to get exactly the size you need.'],
      ['Optional WebP conversion', 'shrinks images as they\'re uploaded.'],
      ['Fast, cache-friendly delivery', 'that lets people skip around in videos and audio without downloading the whole file.'],
    ],
    panels: [
      ['', 'Use it as a Windows drive', 'Luggage can be mounted as a normal drive letter on Windows, so you can open, save and drag files in File Explorer as if your pooled storage were plugged into your PC.'],
      ['', 'You host it, you control it', 'Luggage runs on your own server from a single Docker container. Your file list stays in a database you control, and your files stay in storage you already own. There\'s no extra subscription or middleman, and no one else holding your data.'],
    ],
    cta: { title: 'One drive. All your space. Your server.', text: '', button: ['Get started', '/#contact'] },
    legal: [['Privacy policy', ''], ['Terms of service', '']],
  },
  {
    key: 'book',
    path: '/b-ook',
    name: 'B-ook',
    mark: 'book',
    title: 'B-ook · SolwAI',
    hero: {
      title: 'Bookings, payments and one calendar',
      lead: 'B-ook lets customers find, book and pay for pitches, rooms and other resources online. Your staff manage every booking from one calendar.',
      cta: ['Get started', '/#contact'],
      cta2: ['How it works', '#how'],
    },
    sections: [
      { type: 'intro', title: 'Built for venues that rent out space', body: '<p>Indoor pitches, meeting rooms, sports halls: if people book it by the hour, B-ook can take the booking. Customers see what\'s free, pick a slot and pay in one go.</p><p><strong>Two bookings can\'t land on the same slot.</strong> Each slot is held while a customer pays, and released if they don\'t finish.</p>' },
      { type: 'how', title: 'How it works' },
      { type: 'features', title: 'The admin work, done for you' },
      { type: 'panels' },
    ],
    steps: [
      ['Set up your resources', 'Add each pitch or room with its opening hours and prices. Block out dates when it\'s closed.'],
      ['Customers book and pay', 'They sign up or continue with Google, choose a slot and pay by card on a secure payment page. Confirmations and reminders go out by email.'],
      ['Staff run it from one calendar', 'See every booking in one place. Book on a customer\'s behalf, move a booking or change one week of a series without touching the rest.'],
    ],
    features: [
      ['Weekly bookings', 'Regular slots booked as a series. Long series can be paid a few weeks at a time from a saved card.'],
      ['Invoices and refunds', 'Invoices and receipts are created automatically, with your VAT number and payment details. Refunds follow your rules.'],
      ['Reports and reconciliation', 'A dashboard and reports show what\'s booked and paid, with payment reconciliation built in.'],
      ['Calendar feeds', 'Bookings appear in the calendar apps your staff already use.'],
      ['Secure staff log-in', 'Two-factor log-in with an authenticator app for everyone who manages bookings.'],
      ['GDPR tools', 'Set how long customer data is kept, and handle data requests from the admin pages.'],
    ],
    panels: [
      ['AI assistant', 'Answers booking questions for you', 'A chat window on every customer page answers questions about your resources and bookings, so fewer people need to phone.'],
      ['Your brand', 'Fits into your own website', 'B-ook takes your colours, fonts and logo. Embed the booking calendar on your club or venue site, and customers book without leaving it.'],
    ],
    cta: { title: 'Book, pay and manage in one place.', text: '', button: ['Get started', '/#contact'] },
    legal: [['Privacy policy', '/b-ook/privacy'], ['Terms of service', '/b-ook/terms']],
  },
  {
    key: 'gleam',
    path: '/gleam',
    name: 'Gleam',
    mark: 'gleam',
    title: 'Gleam · SolwAI',
    hero: {
      title: 'A website you edit on the page',
      lead: 'Gleam lets your staff change any words or photos right where they appear. Every change is recorded, so anything can be put back.',
      cta: ['Get started', '/#contact'],
      cta2: ['How it works', '#how'],
    },
    sections: [
      { type: 'intro', title: 'No admin screens to learn', body: '<p>Most website editors make you fill in forms on one screen and check the result on another. With Gleam you sign in, open the page you want to change and type.</p><p><strong>Mistakes are easy to undo.</strong> Change history lists every edit with a Put back button.</p>' },
      { type: 'how', title: 'How it works' },
      { type: 'features', title: 'Everything a small organisation needs' },
      { type: 'closing', title: 'Updates never overwrite your edits', text: 'Gleam runs from a single Docker image. Your words and photos are stored separately from the site itself, so we can update Gleam without touching your content. Fonts are hosted with the site, so visitors\' browsers make no requests to Google.' },
    ],
    steps: [
      ['Press Edit this page', 'Sign in and the edit bar appears at the bottom of every page. Everything you can change is outlined.'],
      ['Click and change it', 'Click text to type over it. Click a photo to upload a new one or pick one you\'ve used before. Click a button to change its words and where it goes.'],
      ['Save changes', 'Visitors see the update straight away, and the change is added to the history.'],
    ],
    features: [
      ['Lists you can rearrange', 'Programmes, team, gallery, shop items: add, reorder, hide or delete them on the page.'],
      ['News with scheduling', 'Write an article on its own page and set a publish date. It stays hidden until that day.'],
      ['Photos sized for you', 'Uploads are resized and converted to WebP automatically, so pages stay quick to load.'],
      ['Contact form', 'Messages are kept in the admin area and can be emailed to you as well.'],
      ['Editors and permissions', 'Administrators add and remove editors. New people set their own password when they first sign in.'],
      ['Search-friendly', 'Set each page\'s search-engine title and description from the edit bar.'],
    ],
    cta: { title: 'Your website, edited where you see it.', text: '', button: ['Get started', '/#contact'] },
    legal: [['Privacy policy', ''], ['Terms of service', '']],
  },
];

// Which lists each section type draws on (platforms shows panels beside its points).
const USES = { how: ['Steps'], features: ['Features'], list: ['Points'], platforms: ['Points', 'Panels'], reasons: ['Points'], panels: ['Panels'] };
export const listsOf = (app) => [...new Set(app.sections.flatMap((s) => USES[s.type] ?? []))];
