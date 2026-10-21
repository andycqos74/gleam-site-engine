// Starting content, taken from the design handover. Anything an editor changes is stored in the database and
// overrides these values; keys added here later appear on the site straight away with their default.
//
// Placeholders the Trust still needs to replace are marked in the handover: story names and quotes, timeline
// years, staff, "TBC" programme details, shop prices and funder logos.

const t = (value) => ({ type: 'text', value });         // one line of plain text
const p = (value) => ({ type: 'textarea', value });     // plain text, line breaks kept
const r = (value) => ({ type: 'rich', value });         // bold, italic, links, lists
const h = (value) => ({ type: 'headline', value });     // [square brackets] mark the highlighted pills
const u = (value) => ({ type: 'url', value });
const img = (value = '') => ({ type: 'image', value });

const OSCR = 'https://www.oscr.org.uk/about-charities/search-the-register/charity-details?number=SC047994';

export const FIELDS = {
  // Whole site: header, footer and contact details
  'site.name': t('QoS Community Trust'),
  'site.tagline': t('Charity of Queen of the South FC'),
  'site.logo': img('/img/trust-logo.png'),
  'site.logo.alt': t('Queen of the South Community Trust'),
  'nav.cta': t('Get Involved'),
  'nav.cta.url': u('/contact?topic=Volunteering'),
  'footer.legal': t('QoS Community Trust is a brand name of KGV Trust SCIO'),
  'footer.charity': t('Charity Number SC047994'),
  'contact.email': t('community@qosfc.com'),
  'contact.phone': t('01387 254853'),
  'contact.address': t('Palmerston Park, 76–94 Terregles St, Dumfries DG2 9BA'),
  'links.booking': u('/contact?topic=Bookings'),
  'links.facebook': u(''),
  'links.instagram': u(''),

  // Home
  'meta.home.title': t('QoS Community Trust | Football, tennis and community sport in Dumfries'),
  'meta.home.description': t('The charity of Queen of the South FC, bringing football, tennis and community sport to every age in Dumfries & Galloway.'),
  'home.hero.title': h('Every [journey] starts with a [kick-about]'),
  'home.hero.sub': p('The charity of Queen of the South FC, bringing football, tennis and community sport to every age in Dumfries & Galloway.'),
  'home.hero.cta1': t('Explore Programmes'),
  'home.hero.cta1.url': u('/programmes'),
  'home.hero.cta2': t('Our Story'),
  'home.hero.cta2.url': u('/about#story'),
  'home.hero.img1': img(''),
  'home.hero.img1.alt': t('Tennis coaching at KGV'),
  'home.hero.img2': img('/img/trust_wednesdayclub.jpg'),
  'home.hero.img2.alt': t('Children training at Queens Arena'),
  'home.hero.img3': img(''),
  'home.hero.img3.alt': t('Walking football'),
  'home.journeys.eyebrow': t('Journeys'),
  'home.journeys.title': t('Pick your starting point'),
  'home.journeys.sub': t("Follow the route. There's always a next stop."),
  'home.programmes.title': t('Our Programmes'),
  'home.programmes.link': t('See All Programmes →'),
  'home.programmes.link.url': u('/programmes'),
  'home.stories.eyebrow': t('Journey Stories'),
  'home.stories.title': t('Where it took them'),
  'home.stories.link': t('More Stories →'),
  'home.stories.link.url': u('/gallery'),
  'home.timeline.eyebrow': t('Our Story'),
  'home.timeline.title': t("The Trust's journey so far"),
  'home.funders.eyebrow': t('Funders & Partners'),
  'home.funders.title': t('Fuel the journey for the next generation'),
  'home.funders.text': p('Our work relies on grants, sponsorship and fundraising. See where it goes, and how to get involved.'),
  'home.funders.cta1': t('Partner With Us'),
  'home.funders.cta1.url': u('/contact?topic=Partnerships'),
  'home.funders.cta2': t('Annual Report & Trustees'),
  'home.funders.cta2.url': u(OSCR),

  // About
  'meta.about.title': t('About the Trust | QoS Community Trust'),
  'meta.about.description': t("We're the official charity of Queen of the South FC, using football, tennis and community sport to help people of every age in Dumfries & Galloway."),
  'about.hero.eyebrow': t('About the Trust'),
  'about.hero.title': h('The [community] side of [Queens]'),
  'about.hero.text': p("We're the official charity of Queen of the South FC. We use football, tennis and community sport to help people of every age in Dumfries & Galloway get active, make friends and feel part of the club."),
  'about.hero.img': img('/img/trust_saturdayclub.jpg'),
  'about.hero.img.alt': t('Saturday Club'),
  'about.hero.img2': img(''),
  'about.hero.img2.alt': t('One of our coaches'),
  'about.story.eyebrow': t('Our Story'),
  'about.story.title': t("The Trust's journey so far"),
  'about.team.title': t('Meet the team'),
  'about.team.link': t('Trustees & Annual Report →'),
  'about.team.link.url': u(OSCR),
  'about.join.eyebrow': t('Join the team'),
  'about.join.title': t('Work and volunteer with us'),
  'about.join.text': p('Coaches, volunteers and helpers keep every programme running. Current vacancies appear here.'),
  'about.funders.title': t('Funders & Partners'),
  'about.cta.title': t('Want to back the next generation?'),
  'about.cta.button': t('Partner With Us'),
  'about.cta.button.url': u('/contact?topic=Partnerships'),

  // Programmes
  'meta.programmes.title': t('Programmes | QoS Community Trust'),
  'meta.programmes.description': t('Every programme we run, from soft play to walking football, for every age in Dumfries & Galloway.'),
  'programmes.hero.title': h('Find your [next stop]'),
  'programmes.hero.sub': p('Every programme we run, from soft play to walking football. Pick an age to narrow it down.'),
  'programmes.camp.eyebrow': t('Holiday Camps'),
  'programmes.camp.title': t('October Camp'),
  'programmes.camp.venue': t('Queens Arena'),
  'programmes.camp.time': t('10am – 3pm'),
  'programmes.camp.text': p('Full days of coached football, games and new pals through the school holidays.'),
  'programmes.camp.cta': t('Book Camp Places'),
  'programmes.camp.cta.url': u('/contact?topic=Bookings'),
  'programmes.camp.img1': img('/img/trust_wednesdayclub.jpg'),
  'programmes.camp.img1.alt': t('Camp session'),
  'programmes.camp.img2': img(''),
  'programmes.camp.img2.alt': t('Camp huddle'),
  'programmes.venues.title': t('Where we play'),

  // Shop
  'meta.shop.title': t('Shop | QoS Community Trust'),
  'meta.shop.description': t('Camp places, club sessions, parties and Trust kit. Every purchase goes back into community sport.'),
  'shop.hero.title': h('Book it, [wear it], gift it'),
  'shop.hero.sub': p('Camp places, club sessions, parties and Trust kit. Every purchase goes back into community sport.'),
  'shop.hero.img': img(''),
  'shop.hero.img.alt': t('Trust kit'),
  'shop.party.title': t('Planning a party?'),
  'shop.party.text': p("Soft play and football parties at Lochmaben. Tell us the date and we'll do the rest."),
  'shop.party.cta': t('Enquire About Parties'),
  'shop.party.cta.url': u('/contact?topic=Parties'),

  // Gallery
  'meta.gallery.title': t('Gallery | QoS Community Trust'),
  'meta.gallery.description': t('Snapshots from Saturday Club, camps, girls’ football, matchdays, tennis and KGV.'),
  'gallery.hero.title': h('Snapshots from [the route]'),
  'gallery.share.title': t('Spot yourself? Share yours.'),
  'gallery.share.text': p('Follow the Trust for photos from every camp, club and matchday.'),
  'gallery.share.facebook': t('Facebook'),
  'gallery.share.instagram': t('Instagram'),

  // Contact
  'meta.contact.title': t('Contact | QoS Community Trust'),
  'meta.contact.description': t('Questions about a programme, a booking or getting involved? Send us a message or pop into Palmerston Park.'),
  'contact.hero.title': h('Come and [say hello]'),
  'contact.hero.sub': p('Questions about a programme, a booking or getting involved? Send us a message or pop into Palmerston Park.'),
  'contact.form.title': t('Send a message'),
  'contact.form.success': p("Thanks for getting in touch. We'll reply as soon as we can, usually within two working days."),
  'contact.details.eyebrow': t('Get in touch'),
  'contact.map.lat': t('55.0714'),
  'contact.map.lon': t('-3.6231'),
  'contact.venues.title': t('Find our venues'),

  // Privacy
  // News
  'meta.news.title': t('News | QoS Community Trust'),
  'meta.news.description': t('The latest from QoS Community Trust: camps, clubs, matchdays and community sport in Dumfries & Galloway.'),
  'news.hero.title': h("What's [new]"),
  'news.hero.sub': p('Camps, clubs, matchdays and everything else happening across the Trust.'),
  'news.empty': p('No news just now. Check back soon.'),
  'home.news.eyebrow': t('News'),
  'home.news.title': t('Latest from the Trust'),
  'home.news.link': t('All News →'),
  'home.news.link.url': u('/news'),

  'meta.privacy.title': t('Privacy Policy | QoS Community Trust'),
  'meta.privacy.description': t('How QoS Community Trust (KGV Trust SCIO) uses personal information.'),
  'privacy.title': t('Privacy Policy'),
  'privacy.body': r(`<p>QoS Community Trust is a brand name of KGV Trust SCIO (Scottish Charity Number SC047994). This notice explains how we use personal information collected through this website.</p>
<h2>What we collect</h2>
<p>When you use our contact form we collect your name, email address, the topic you picked and your message. We use these only to reply to you and to keep a record of the enquiry.</p>
<h2>How long we keep it</h2>
<p>We keep enquiries for as long as we need them to deal with your request, and then delete them.</p>
<h2>Cookies</h2>
<p>This website does not use advertising or tracking cookies. A cookie is set only when a member of Trust staff signs in to edit the site.</p>
<h2>Your rights</h2>
<p>You can ask to see, correct or delete the information we hold about you by emailing <a href="mailto:community@qosfc.com">community@qosfc.com</a>. You can also complain to the Information Commissioner's Office (ico.org.uk).</p>
<p><em>The Trust should review this notice before the site goes live.</em></p>`),
};

const prog = (name, typeTag, stage, blurb, when, where, price, image, featured, homeTag) =>
  ({ name, typeTag, stage, blurb, when, where, price, image, featured, homeTag });

export const SEED = {
  news: [
    { title: 'Welcome to our new website', tag: 'News', date: 'today', summary: "Find every programme, camp and club in one place, with news from across the Trust posted here.", body: "<p>Welcome to the new home of QoS Community Trust online. You can find every programme we run, from soft play to walking football, on the <a href=\"/programmes\">Programmes</a> page, and keep up with camps, clubs and matchdays right here.</p><p>Questions about anything you see? <a href=\"/contact\">Get in touch</a>.</p>" },
  ],
  journey: [
    { stage: 'Wee Ones', ages: 'Under 5s', colour: 'gold', link: '/programmes?age=under5', short: 'Soft play and parties at Lochmaben', blurb: 'First steps, first bounces and plenty of noise at Lochmaben Community Centre.', chips: 'Soft Play, Birthday Parties' },
    { stage: 'Kids', ages: 'Primary school', colour: 'orange', link: '/programmes?age=primary', short: 'Camps, clubs and matchday fun', blurb: 'Coached football before school, after school, on matchdays and all through the holidays.', chips: 'Soccer Camps, Saturday Club, Wednesday Club, After School, Breakfast Club' },
    { stage: 'Growing Up', ages: 'Girls & teens', colour: 'sky', link: '/programmes?age=teens', short: "Girls' football and tennis", blurb: 'Keep playing, try something new and stay active with friends.', chips: "Girls' Football, Tennis at KGV" },
    { stage: 'For Life', ages: 'Adults & 50+', colour: 'green', link: '/programmes?age=adults', short: 'Walking football, tennis and the gym', blurb: 'Stay fit and sociable, whether that means a gentle game or a gym session at KGV.', chips: 'Walking Football, Tennis, KGV Gym' },
  ],
  programmes: [
    prog('Soft Play', 'Lochmaben', 'under5', 'Bouncy, noisy fun for the very youngest, plus birthday parties.', 'TBC', 'Lochmaben Community Centre', 'TBC', '', false, ''),
    prog('Soccer Camps', 'Holidays', 'primary', 'Days packed with football, games and new pals.', 'School holidays, 10am – 3pm', 'Queens Arena', 'TBC', '', true, 'Holidays'),
    prog('Saturday Club', 'Ages 6–12', 'primary', 'An hour of football, then cheer on Queens.', 'Saturdays', 'TBC', '£8', '/img/trust_saturdayclub.jpg', true, 'Ages 6–12 · £8'),
    prog('Wednesday Club', 'Midweek', 'primary', 'A midweek kick-about to break up the week.', 'Wednesdays', 'TBC', 'TBC', '/img/trust_wednesdayclub.jpg', true, 'Midweek'),
    prog('After School Clubs', 'Term time', 'primary', 'Coached sessions straight after the bell.', 'Term time', 'Local schools', 'TBC', '', true, 'Term time'),
    prog('Breakfast Club', 'Before school', 'primary', 'A good breakfast and a lively start.', 'Term time mornings', 'Local schools', 'TBC', '', true, 'Before school'),
    prog("Girls' Football", 'Girls', 'teens', 'Friendly sessions for first-timers and regulars.', 'TBC', 'TBC', 'TBC', '/img/trust_girlsfootball.jpg', true, 'Girls'),
    prog('Tennis', 'New · KGV', 'adults', 'Coaching and court time on three courts.', 'TBC', 'KGV', 'TBC', '', true, 'New · KGV'),
    prog('Walking Football', 'Adults', 'adults', 'The beautiful game, at a gentler pace.', 'TBC', 'TBC', 'TBC', '', true, 'Adults'),
    prog('KGV Gym', 'Fitness', 'adults', 'A friendly community gym at KGV.', 'TBC', 'KGV', 'TBC', '', false, ''),
  ],
  stories: [
    { name: 'Participant name', from: 'Saturday Club', to: "Girls' Football", quote: 'A short quote from the participant or their parent about what the programme meant to them.', image: '' },
    { name: 'Participant name', from: 'Soccer Camps', to: 'Volunteer Coach', quote: 'A short quote from the participant or their parent about what the programme meant to them.', image: '' },
    { name: 'Participant name', from: 'Walking Football', to: 'Club Regular', quote: 'A short quote from the participant or their parent about what the programme meant to them.', image: '' },
  ],
  timeline: Array.from({ length: 5 }, () => ({ year: '20XX', text: 'Milestone placeholder: what happened this year.' })),
  pillars: [
    { tag: 'Football', colour: 'gold', title: 'Football for all', body: 'Camps, clubs and matchday sessions from the first kick to walking football.' },
    { tag: 'KGV', colour: 'green', title: 'Tennis & fitness', body: 'Three tennis courts and a gym at KGV, open to the whole community.' },
    { tag: 'Community', colour: 'orange', title: 'Part of the club', body: 'Soft play in Lochmaben, birthday parties and matchday fun for every family.' },
  ],
  team: Array.from({ length: 4 }, () => ({ name: 'Staff name', role: 'Role', image: '' })),
  vacancies: [
    // Closing date has passed, so this example starts hidden; editors can show it or add a new one.
    { title: 'Community Football Coach', hours: '15–20 hours a week', summary: 'Delivering breakfast clubs, afterschool clubs and sports sessions for ages 4–12. Morning work and after school, with camps during school holidays.', closing: '4th September', applyLabel: 'Apply by Email', applyUrl: 'mailto:community@qosfc.com?subject=Community%20Football%20Coach', hidden: true },
  ],
  funders: [],
  venues: [
    { name: 'Palmerston Park', what: 'Home of Queen of the South and the Trust office.', short: 'Trust office and matchday sessions.', colour: 'navy' },
    { name: 'Queens Arena', what: 'Indoor pitches for camps and clubs.', short: 'Indoor camps and clubs.', colour: 'gold' },
    { name: 'KGV', what: 'Three tennis courts and the community gym.', short: 'Tennis courts and community gym.', colour: 'green' },
    { name: 'Lochmaben Community Centre', what: 'Soft play and birthday parties.', short: 'Soft play and parties.', colour: 'orange' },
  ],
  products: [
    { name: 'October Camp (day place)', category: 'book', note: 'Queens Arena · 10am – 3pm', price: '£XX' },
    { name: 'Saturday Club session', category: 'book', note: 'Ages 6–12, includes the match', price: '£8' },
    { name: 'Wednesday Club block', category: 'book', note: 'Term-time midweek sessions', price: '£XX' },
    { name: 'Tennis court hire', category: 'book', note: 'KGV · one hour', price: '£XX' },
    { name: 'Soft play party', category: 'party', note: 'Lochmaben Community Centre', price: 'From £XX', url: '/contact?topic=Parties' },
    { name: 'Trust training top', category: 'kit', note: 'Kids and adult sizes', price: '£XX', url: '/contact?topic=Programmes' },
    { name: 'Trust water bottle', category: 'kit', note: 'Navy with gold crest', price: '£XX', url: '/contact?topic=Programmes' },
    { name: 'Gift voucher', category: 'gift', note: 'Any amount, any programme', price: '£XX', url: '/contact?topic=Bookings' },
  ],
  gallery: [
    { category: 'saturday', image: '/img/trust_saturdayclub.jpg', caption: 'Saturday Club', size: 'l', shape: 'rect' },
    { category: 'girls', image: '/img/trust_girlsfootball.jpg', caption: "Girls' football session", size: 'tall', shape: 'archTop' },
    { category: 'tennis', image: '', caption: '', size: 's', shape: 'circle' },
    { category: 'matchday', image: '/img/match-paton.jpg', caption: 'Matchday at Palmerston Park', size: 's', shape: 'rect' },
    { category: 'camps', image: '/img/trust_wednesdayclub.jpg', caption: 'Wednesday Club', size: 'l', shape: 'rect' },
    { category: 'camps', image: '', caption: '', size: 's', shape: 'rect' },
    { category: 'tennis', image: '', caption: '', size: 'tall', shape: 'archBottom' },
    { category: 'saturday', image: '', caption: '', size: 's', shape: 'circle' },
    { category: 'matchday', image: '', caption: '', size: 'wide', shape: 'rect' },
    { category: 'girls', image: '', caption: '', size: 's', shape: 'rect' },
  ],
};
