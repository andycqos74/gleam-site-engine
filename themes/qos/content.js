// Starting content: the design handover's structure, with copy, figures and photos from the Trust's strategy
// document "Engage, Empower, Evolve" (October 2026). Anything an editor changes is stored in the database and
// overrides these values; keys added here later appear on the site straight away with their default.
// Lists (SEED) are written to the database once; CONTENT_UPDATES (below) brings later revisions of a list into a
// site that is already running.
//
// Still to fill in: programme times, venues and prices marked "TBC", shop prices, staff names and photos, and
// funder logos.

const t = (value) => ({ type: 'text', value });         // one line of plain text
const p = (value) => ({ type: 'textarea', value });     // plain text, line breaks kept
const r = (value) => ({ type: 'rich', value });         // bold, italic, links, lists
const h = (value) => ({ type: 'headline', value });     // [square brackets] mark the highlighted pills
const u = (value) => ({ type: 'url', value });
// Shown in a page's "Page settings" panel in the editor, rather than on the page itself.
const setting = (def, pages, label) => ({ ...def, settings: pages, label });
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
  'links.booking': setting(u('/contact?topic=Bookings'), ['programmes'], 'Default "Book Now" link for programmes (for example the online bookings site)'),
  'links.facebook': setting(u(''), ['gallery'], 'Facebook page address'),
  'links.instagram': setting(u(''), ['gallery'], 'Instagram page address'),

  // Home
  'meta.home.title': t('QoS Community Trust | Engage. Empower. Evolve.'),
  'meta.home.description': t('Queen of the South Community Trust, the charitable arm of Queen of the South FC: sport, education, employability and wellbeing for every age in Dumfries & Galloway.'),
  'home.hero.title': h('Every [journey] starts with a [kick-about]'),
  'home.hero.sub': p('The charitable arm of Queen of the South FC. Since 2017 we have used the reach of the club to engage, empower and evolve people of every age across Dumfries & Galloway.'),
  'home.hero.cta1': t('Explore Programmes'),
  'home.hero.cta1.url': u('/programmes'),
  'home.hero.cta2': t('Our Story'),
  'home.hero.cta2.url': u('/about#story'),
  'home.hero.img1': img('/img/trust/kgv-indoor-tennis.jpg'),
  'home.hero.img1.alt': t('Indoor tennis courts at the KGV Sports Complex'),
  'home.hero.img2': img('/img/trust/team-palmerston-park.jpg'),
  'home.hero.img2.alt': t('Young players in Queen of the South kit on the pitch at Palmerston Park'),
  'home.hero.img3': img('/img/trust/reading-challenge.jpg'),
  'home.hero.img3.alt': t('Reading with the Queens mascot for the 442 Reading Challenge'),
  'home.journeys.eyebrow': t('Journeys'),
  'home.journeys.title': t('Pick your starting point'),
  'home.journeys.sub': t("Join at any stop and move on when you're ready. There's always a next stop."),
  'home.programmes.title': t('Our Programmes'),
  'home.programmes.link': t('See All Programmes →'),
  'home.programmes.link.url': u('/programmes'),
  'home.stories.eyebrow': t('Lived Examples'),
  'home.stories.title': t('Where it took them'),
  'home.stories.link': t('More Stories →'),
  'home.stories.link.url': u('/news'),
  'home.timeline.eyebrow': t('Our Story'),
  'home.timeline.title': t("The Trust's journey so far"),
  'home.funders.eyebrow': t('Funders & Partners'),
  'home.funders.title': t('Fuel the journey for the next generation'),
  'home.funders.text': p('Our work relies on grants, partnerships and fundraising. Since 2023 we have grown from 3 funders to 7 and invested £982,999 in our community. Help us build the next decade.'),
  'home.impact.eyebrow': t('Where we are · 2023–2026'),
  'home.impact.title': t('Our impact so far'),
  'home.impact.text': p('From 18 projects and £170,520 in 2019–2022 to a people-led Trust investing close to a million pounds in Dumfries & Galloway.'),
  'home.funders.cta1': t('Partner With Us'),
  'home.funders.cta1.url': u('/contact?topic=Partnerships'),
  'home.funders.cta2': t('Annual Report & Trustees'),
  'home.funders.cta2.url': u(OSCR),

  // About
  'meta.about.title': t('About the Trust | QoS Community Trust'),
  'meta.about.description': t('Queen of the South Community Trust is the charitable arm of Queen of the South FC, established in 2017 to engage, empower and evolve everyone we work with.'),
  'about.hero.eyebrow': t('About the Trust'),
  'about.hero.title': h('[Engage] [Empower] [Evolve]'),
  'about.hero.text': p('Queen of the South Community Trust is the charitable arm of Queen of the South Football Club, established in 2017 with a clear purpose: to engage, empower and evolve everyone we work with. As we approach our tenth anniversary, we have grown from humble beginnings into an award-winning charity at the heart of Dumfries & Galloway.'),
  'about.mission.eyebrow': t('Our mission'),
  'about.mission.title': t('More than what happens on the pitch'),
  'about.mission.text': p('We believe in the power of sport to positively impact lives, inspire individuals and drive meaningful social change. Through the reach and influence of Queen of the South Football Club, we create opportunities, break down barriers and address inequalities, so that our work delivers lasting benefits for the communities we serve.\n\nWe see sport as more than participation: it is a vehicle for connection, education, personal development and social progress. Our ambition is not simply to run more programmes or reach more people, but to create lasting change, where everyone has the opportunity to participate, develop and thrive, whatever their circumstances or starting point.'),
  'about.principles.note': p('Being people-centred means we do the right things; being sustainable helps us keep doing them; and creating community impact makes sure our efforts turn into meaningful outcomes.'),
  'about.pillars.eyebrow': t('What we do'),
  'about.pillars.title': t('Our six pillars'),
  'about.pillars.text': p('Together, these let us meet immediate community needs and the wider factors that shape people\'s opportunities and quality of life. They are connected pathways, not one-off projects: someone may start at a football session and move on to volunteering, qualifications or work, while someone else simply comes to stay active and connected. Both journeys are equally valued.'),
  'about.impact.eyebrow': t('Where we are · 2023–2026'),
  'about.impact.title': t('Where we were, where we are'),
  'about.hero.img': img('/img/trust/football-development-stand.jpg'),
  'about.hero.img.alt': t('More than a hundred young players from our Football Development Programme in the stand at Palmerston Park'),
  'about.hero.img2': img('/img/trust/ali.jpg'),
  'about.hero.img2.alt': t('Ali, Football Programme Co-ordinator'),
  'about.story.eyebrow': t('Our Story'),
  'about.story.title': t("The Trust's journey so far"),
  'about.team.title': t('Meet the team'),
  'about.team.link': t('Trustees & Annual Report →'),
  'about.team.link.url': u(OSCR),
  'about.join.eyebrow': t('Join the team'),
  'about.join.title': t('Work and volunteer with us'),
  'about.join.text': p('Many of our coaches started as participants or volunteers. We create pathways from volunteering into coaching, qualifications and paid roles. Current vacancies appear here.'),
  'about.funders.title': t('Funders & Partners'),
  'about.cta.title': t('Want to back the next generation?'),
  'about.cta.button': t('Partner With Us'),
  'about.cta.button.url': u('/contact?topic=Partnerships'),

  // Programmes
  'meta.programmes.title': t('Programmes | QoS Community Trust'),
  'meta.programmes.description': t('Every programme we run, from the Football Development Programme to Football Memories, for every age in Dumfries & Galloway.'),
  'programmes.hero.title': h('Find your [next stop]'),
  'programmes.hero.sub': p('Every programme we run, from soft play to Football Memories. Pick an age to narrow it down.'),
  'programmes.camp.eyebrow': t('Holiday Camps'),
  'programmes.camp.title': t('October Camp'),
  'programmes.camp.venue': t('Queen of the South Arena'),
  'programmes.camp.time': t('10am – 3pm'),
  'programmes.camp.text': p('Full days of coached football, games and new pals through the school holidays.'),
  'programmes.camp.cta': t('Book Camp Places'),
  'programmes.camp.cta.url': u('/contact?topic=Bookings'),
  'programmes.camp.img1': img('/img/trust/camp-group.jpg'),
  'programmes.camp.img1.alt': t('Camp group with the Community Trust banner'),
  'programmes.camp.img2': img('/img/trust/camp-banner.jpg'),
  'programmes.camp.img2.alt': t('Young players celebrating with the Community Trust flag'),
  'programmes.venues.title': t('Where we play'),

  // Shop
  'meta.shop.title': t('Shop | QoS Community Trust'),
  'meta.shop.description': t('Camp places, club sessions, parties and Trust kit. Every purchase goes back into community sport.'),
  'shop.hero.title': h('Book it, [wear it], gift it'),
  'shop.hero.sub': p('Camp places, club sessions, parties and Trust kit. Every purchase goes back into community sport.'),
  'shop.hero.img': img('/img/trust/engage-empower-evolve.jpg'),
  'shop.hero.img.alt': t('A young player in Queen of the South kit in front of the Engage, Empower, Evolve banner'),
  'shop.party.title': t('Planning a party?'),
  'shop.party.text': p("Soft play and football parties at Lochmaben. Tell us the date and we'll do the rest."),
  'shop.party.cta': t('Enquire About Parties'),
  'shop.party.cta.url': u('/contact?topic=Parties'),

  // Gallery
  'meta.gallery.title': t('Gallery | QoS Community Trust'),
  'meta.gallery.description': t('Snapshots from our clubs, camps, schools and community work across Dumfries & Galloway.'),
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
  'contact.map.lat': setting(t('55.0714'), ['contact'], 'Map latitude'),
  'contact.map.lon': setting(t('-3.6231'), ['contact'], 'Map longitude'),
  'contact.venues.title': t('Find our venues'),

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
const I = (f) => `/img/trust/${f}`;

export const SEED = {
  news: [
    { title: 'Welcome to our new website', tag: 'News', date: 'today', summary: 'Find every programme, camp and club in one place, with news from across the Trust posted here.', body: '<p>Welcome to the new home of QoS Community Trust online. You can find every programme we run on the <a href="/programmes">Programmes</a> page, and keep up with camps, clubs and matchdays right here.</p><p>Questions about anything you see? <a href="/contact">Get in touch</a>.</p>' },
    {
      title: 'Engage, Empower, Evolve: our next chapter',
      tag: 'Strategy',
      date: 'today',
      image: I('football-development-stand.jpg'),
      summary: 'As we approach our tenth anniversary, we set out how we have grown since 2017 and where we go next.',
      body: `<p>Queen of the South Community Trust was established in 2017 as the charitable arm of Queen of the South Football Club, with a clear purpose: to engage, empower and evolve everyone we work with. As we approach our tenth anniversary, we are embarking on a new chapter of ambition, development and growth.</p>
<h2>Where we were</h2>
<p>Between 2019 and 2022 we delivered 18 projects with 3 funders, investing £170,520 in our community. Much of that work was shaped by the funding available rather than by a deep understanding of our community, and its impact often faded when a project ended. It led us to ask a simple question: were we delivering projects because they were available, or because our people needed them?</p>
<h2>Where we are</h2>
<p>In 2023 we began investing in local people, and in late 2023 we appointed a Development Officer to lead a three-year strategy focused on income generation, capital projects and creating value for the Trust. Since then we have grown to 5 full-time and 14 part-time staff, 35 school partners, 25 projects, 3 breakfast clubs and 7 funders, with two community awards and £982,999 invested in our community.</p>
<h2>Where we go next</h2>
<p>Our work is built on six pillars: education, employability, tackling poverty, physical wellbeing, mental wellbeing and community facilities. Rather than one-off programmes with a fixed beginning and end, we are creating connected pathways, so that someone who starts at a football session can build confidence, gain qualifications, volunteer or move into work, and someone who simply wants to stay active and connected is just as valued.</p>
<p><strong>We engage, we empower and we evolve.</strong> <a href="/about">Read more about the Trust</a>.</p>`,
    },
    {
      title: "Ali's journey: from Why Try to Football Programme Co-ordinator",
      tag: 'Lived Examples',
      date: 'today',
      image: I('ali.jpg'),
      summary: 'Ali first met the Trust through our behavioural project in school. Today he runs our Football Development Programme.',
      body: `<p>Ali began his journey on Why Try, our behavioural project in schools, which helped him focus on his schooling and find the pathway that suited him best.</p>
<blockquote><p>“I decided to get into sport because I realised on the Why Try project that sport was a viable career path.”</p></blockquote>
<p>He volunteered as a coach with the Trust while studying sport at college, putting what he was learning into practice, then went on to university to develop further.</p>
<blockquote><p>“When I graduated a full-time role came up at the Trust and it was the perfect fit for where my journey in sport started.”</p></blockquote>
<p>Ali is now our Football Programme Co-ordinator.</p>
<ul><li>Why Try participant</li><li>Voluntary coach with QoS</li><li>College for sport</li><li>University degree</li><li>Football Programme Co-ordinator</li></ul>`,
    },
    {
      title: "Michael's journey: from volunteer coach to primary teacher",
      tag: 'Lived Examples',
      date: 'today',
      summary: 'Volunteering on our school projects alongside his degree helped Michael into full-time coaching and then teaching.',
      body: `<p>Michael's journey with Queen of the South Community Trust began with a voluntary coaching position supporting school projects, giving him practical experience alongside his university degree. As his involvement grew, he was offered the chance to coach more regularly and contribute to a wider range of community programmes.</p>
<p>Working on projects such as Autism Football gave Michael valuable experience supporting neurodivergent children, developing his coaching and learning to adapt his approach to individual needs, while putting his academic learning into practice.</p>
<p>Michael went on to full-time coaching with the Trust and is now a full-time primary teacher. He describes his time with the club as the chance to make a difference in the community while finding a second home, where he feels a real sense of belonging and connection.</p>
<ul><li>Voluntary schools coach</li><li>Paid coaching</li><li>Full-time coaching</li><li>University degree</li><li>Full-time primary teacher</li></ul>`,
    },
  ],
  journey: [
    { stage: 'Wee Ones', ages: 'Under 5s', colour: 'gold', link: '/programmes?age=under5', short: 'Soft play and parties at Lochmaben', blurb: 'First steps, first bounces and plenty of noise at Lochmaben Community Centre.', chips: 'Soft Play, Birthday Parties' },
    { stage: 'Kids', ages: 'Primary school', colour: 'orange', link: '/programmes?age=primary', short: 'Football, breakfast clubs and reading', blurb: 'Coached football in school, after school, on matchdays and through the holidays, with breakfast, reading and a meal along the way.', chips: 'Football Development Programme, Soccer Camps, Breakfast Clubs, Extra Time, 442 Reading Challenge, Autism Football' },
    { stage: 'Growing Up', ages: 'Teens & young adults', colour: 'sky', link: '/programmes?age=teens', short: 'Volunteering, qualifications and work', blurb: 'Keep playing, start volunteering, gain qualifications and take your first steps into work.', chips: "Girls' Football, Kick Off Your Career, Foundation Apprenticeships, Volunteering" },
    { stage: 'For Life', ages: 'Adults & 50+', colour: 'green', link: '/programmes?age=adults', short: 'Active, connected and supported', blurb: 'Stay active, connected and supported, from tennis at KGV to Andy’s Man Club and Football Memories.', chips: "Walking Football, Tennis, Andy's Man Club, Football Memories" },
  ],
  programmes: [
    prog('Football Development Programme', 'Self-sustaining', 'primary', 'Our flagship coaching programme, with more than 245 children training and progressing with Queens.', 'TBC', 'TBC', 'TBC', I('football-development-stand.jpg'), true, '245+ children'),
    prog('Soccer Camps', 'Holidays', 'primary', 'Days packed with football, games and new pals through the school holidays.', 'School holidays, 10am – 3pm', 'Queen of the South Arena', 'TBC', I('camp-group.jpg'), true, 'Holidays'),
    prog('Breakfast Clubs', 'Before school', 'primary', 'Three breakfast clubs supporting more than 100 people each week with food and a positive start to the day.', 'Term time mornings', 'Local schools', 'TBC', I('schools-mascot.jpg'), true, '100+ every week'),
    prog('Extra Time', 'Food & fun', 'primary', 'Physical activity, creative learning, friends and a meal together. More than 100 families take part every week.', 'TBC', 'TBC', 'TBC', I('extra-time.jpg'), true, '100+ families'),
    prog('Autism Football', 'Inclusive', 'primary', 'Football sessions adapted for neurodivergent children, with coaches who tailor their approach to each child.', 'TBC', 'TBC', 'TBC', '', true, 'Inclusive'),
    prog('Saturday Club', 'Ages 6–12', 'primary', 'An hour of football, then cheer on Queens.', 'Saturdays', 'TBC', '£8', I('team-photo-stadium.jpg'), false, 'Ages 6–12 · £8'),
    prog('Wednesday Club', 'Midweek', 'primary', 'A midweek kick-about to break up the week.', 'Wednesdays', 'Queen of the South Arena', 'TBC', '/img/trust_wednesdayclub.jpg', false, 'Midweek'),
    prog('After School Clubs', 'Term time', 'primary', 'Coached sessions straight after the bell.', 'Term time', 'Local schools', 'TBC', I('school-visit.jpg'), false, 'Term time'),
    prog('442 Reading Challenge', 'In schools', 'primary', 'Using the pull of football to encourage reading, build literacy and support families.', 'Term time', 'Partner schools', 'TBC', I('reading-challenge.jpg'), false, 'Reading'),
    prog('Soft Play', 'Lochmaben', 'under5', 'Bouncy, noisy fun for the very youngest, plus birthday parties.', 'TBC', 'Lochmaben Community Centre', 'TBC', I('lochmaben-community-centre.jpg'), false, ''),
    prog("Girls' Football", 'Girls', 'teens', 'Friendly sessions for first-timers and regulars.', 'TBC', 'TBC', 'TBC', I('engage-empower-evolve.jpg'), true, 'Girls'),
    prog('Kick Off Your Career', 'Employability', 'teens', 'Explore career options, build employability skills and take positive steps towards your future.', 'TBC', 'TBC', 'TBC', I('kick-off-your-career.jpg'), false, 'Careers'),
    prog('Foundation Apprenticeships', 'Vocational', 'teens', 'Combine learning with real work experience at the club, building a foundation for further education, training or employment.', 'TBC', 'Palmerston Park', 'TBC', I('apprenticeships.jpg'), false, 'Apprenticeships'),
    prog('Tennis', 'Indoor · KGV', 'adults', 'Coaching and court time on the indoor courts at the KGV Sports Complex.', 'TBC', 'KGV Sports Complex', 'TBC', I('kgv-indoor-tennis.jpg'), true, 'Indoor · KGV'),
    prog('Walking Football', 'Adults', 'adults', 'The beautiful game, at a gentler pace.', 'TBC', 'TBC', 'TBC', '', false, 'Adults'),
    prog('KGV Sports Complex', 'Fitness', 'adults', 'A friendly community gym plus gymnastics, dance, badminton, hockey and pickleball.', 'TBC', 'KGV Sports Complex', 'TBC', '', false, 'Gym & sport'),
    prog("Andy's Man Club", 'Peer support', 'adults', 'We host Andy’s Man Club: a free peer-support group where men can come together and talk openly. #ITSOKAYTOTALK', 'TBC', 'TBC', 'Free', I('andys-man-club.jpg'), true, 'Free peer support'),
    prog('Football Memories', 'Dementia friendly', 'adults', 'Familiar football stories, shared memories and good company for people living with dementia.', 'TBC', 'TBC', 'TBC', I('football-memories.jpg'), false, 'Dementia friendly'),
  ],
  stories: [
    { name: 'Ali', from: 'Why Try participant', to: 'Football Programme Co-ordinator', quote: 'I decided to get into sport because I realised on the Why Try project that sport was a viable career path.', image: I('ali.jpg') },
    { name: 'Michael', from: 'Voluntary schools coach', to: 'Full-time primary teacher', quote: 'The chance to make a difference in the community while finding a second home.', image: '' },
  ],
  timeline: [
    { year: '2017', text: 'Queen of the South Community Trust is founded as the charitable arm of Queen of the South FC.' },
    { year: '2019–22', text: '18 projects with 3 funders, and £170,520 invested in our community.' },
    { year: '2023', text: 'We invest in local people and appoint a Development Officer to lead a three-year strategy.' },
    { year: '2026', text: '19 staff, 35 school partners, 25 projects, 2 community awards and £982,999 invested.' },
    { year: '2027', text: 'Our tenth anniversary, and a new chapter of ambition, development and growth.' },
  ],
  principles: [
    { title: 'Engage', colour: 'gold', body: 'Understand our people, build trust and create accessible opportunities for everyone to take part.' },
    { title: 'Empower', colour: 'blue', body: 'Equip people with the confidence, skills, relationships and support to shape their own futures.' },
    { title: 'Evolve', colour: 'green', body: 'Develop people, programmes and partnerships to create lasting opportunities and respond to changing community needs.' },
  ],
  pillars: [
    { tag: 'Education', colour: 'gold', title: 'Learning beyond the classroom', body: 'More than 35 school partners reaching over 4,300 young people, the 442 Reading Challenge, kit and graphic design projects, and HNC and degree-level routes into sport.' },
    { tag: 'Employability', colour: 'blue', title: 'Routes into work', body: 'Work placements, our youth employment programme, Kick Off Your Career, Foundation Apprenticeships and a bespoke cooking class, with the club as a real place to learn.' },
    { tag: 'Tackling Poverty', colour: 'orange', title: 'Nobody left out', body: 'Three breakfast clubs, Extra Time, our community food hub, Warm Hubs, free football at Summerhill, boot swaps, Festive Friends and free match tickets.' },
    { tag: 'Physical Wellbeing', colour: 'green', title: 'Active for life', body: 'Our self-sustaining Football Development Programme for 245+ children, plus Autism Football, Dougie’s Dash, Soccer Camps and Half-Time Heroes.' },
    { tag: 'Mental Wellbeing', colour: 'blue', title: 'Connected and supported', body: 'We host Andy’s Man Club, partner with QoS Third It, run Football Memories for people living with dementia, and are developing neurodivergent football and a sensory room.' },
    { tag: 'Community Facilities', colour: 'gold', title: 'Spaces for everyone', body: 'The KGV Sports Complex, Palmerston Park, the Queen of the South Arena and Lochmaben Community Centre: a world of sport for every single person.' },
  ],
  stats: [
    { value: '£982,999', label: 'Spent in our community' },
    { value: '35', label: 'School partners' },
    { value: '4,300+', label: 'Young people reached through schools' },
    { value: '25', label: 'Projects' },
    { value: '245+', label: 'Children in our Football Development Programme' },
    { value: '100+', label: 'Families at Extra Time every week' },
    { value: '19', label: 'Staff: 5 full-time, 14 part-time' },
    { value: '2', label: 'Community awards' },
  ],
  team: [
    { name: 'Ali', role: 'Football Programme Co-ordinator', image: I('ali.jpg') },
    // Placeholders, hidden from visitors until an editor fills them in and shows them.
    ...Array.from({ length: 3 }, () => ({ name: 'Staff name', role: 'Role', image: '', hidden: true })),
  ],
  vacancies: [
    // Closing date has passed, so this example starts hidden; editors can show it or add a new one.
    { title: 'Community Football Coach', hours: '15–20 hours a week', summary: 'Delivering breakfast clubs, afterschool clubs and sports sessions for ages 4–12. Morning work and after school, with camps during school holidays.', closing: '4th September', applyLabel: 'Apply by Email', applyUrl: 'mailto:community@qosfc.com?subject=Community%20Football%20Coach', hidden: true },
  ],
  funders: [
    { name: 'SPFL Trust', logo: '', url: '' },
    { name: 'SGN', logo: '', url: '' },
    { name: 'UCS', logo: I('ucs-logo.png'), url: '' },
    { name: 'Department for Work and Pensions', logo: '', url: '' },
  ],
  venues: [
    { name: 'Palmerston Park', what: 'Home of Queen of the South FC and the Trust office.', short: 'Trust office and matchday sessions.', colour: 'navy', image: I('palmerston-park-pitch.jpg') },
    { name: 'Queen of the South Arena', what: 'Indoor pitches for camps, clubs and school festivals.', short: 'Indoor camps, clubs and festivals.', colour: 'gold', image: I('queen-of-the-south-arena.jpg') },
    { name: 'KGV Sports Complex', what: 'Indoor tennis, a community gym, gymnastics, dance, badminton, hockey and pickleball.', short: 'Tennis, gym and indoor sport.', colour: 'green', image: I('kgv-indoor-tennis.jpg') },
    { name: 'Lochmaben Community Centre', what: 'Soft play, birthday parties and our lunch club.', short: 'Soft play, parties and lunch club.', colour: 'orange', image: I('lochmaben-community-centre.jpg') },
  ],
  products: [
    { name: 'October Camp (day place)', category: 'book', note: 'Queen of the South Arena · 10am – 3pm', price: '£XX' },
    { name: 'Saturday Club session', category: 'book', note: 'Ages 6–12, includes the match', price: '£8' },
    { name: 'Wednesday Club block', category: 'book', note: 'Term-time midweek sessions', price: '£XX' },
    { name: 'Tennis court hire', category: 'book', note: 'KGV · one hour', price: '£XX' },
    { name: 'Soft play party', category: 'party', note: 'Lochmaben Community Centre', price: 'From £XX', url: '/contact?topic=Parties' },
    { name: 'Trust training top', category: 'kit', note: 'Kids and adult sizes', price: '£XX', url: '/contact?topic=Programmes' },
    { name: 'Trust water bottle', category: 'kit', note: 'Navy with gold crest', price: '£XX', url: '/contact?topic=Programmes' },
    { name: 'Gift voucher', category: 'gift', note: 'Any amount, any programme', price: '£XX', url: '/contact?topic=Bookings' },
  ],
  gallery: [
    { category: 'camps', image: I('football-development-stand.jpg'), caption: 'Our Football Development Programme in the stand at Palmerston Park', size: 'l', shape: 'rect' },
    { category: 'community', image: I('engage-empower-evolve.jpg'), caption: 'Engage. Empower. Evolve.', size: 'tall', shape: 'archTop' },
    { category: 'tennis', image: I('kgv-indoor-tennis.jpg'), caption: 'Indoor tennis at the KGV Sports Complex', size: 's', shape: 'circle' },
    { category: 'matchday', image: '/img/match-paton.jpg', caption: 'Matchday at Palmerston Park', size: 's', shape: 'rect' },
    { category: 'schools', image: I('reading-challenge.jpg'), caption: 'The 442 Reading Challenge', size: 'tall', shape: 'rect' },
    { category: 'schools', image: I('schools-mascot.jpg'), caption: 'A school visit with the Queens mascot', size: 'wide', shape: 'rect' },
    { category: 'camps', image: I('camp-banner.jpg'), caption: 'Soccer camp', size: 's', shape: 'rect' },
    { category: 'saturday', image: I('team-photo-stadium.jpg'), caption: 'Team photo at Palmerston Park', size: 'wide', shape: 'rect' },
    { category: 'schools', image: I('kit-design.jpg'), caption: 'Kit design competition', size: 's', shape: 'circle' },
    { category: 'community', image: I('extra-time.jpg'), caption: 'Extra Time', size: 'tall', shape: 'archBottom' },
    { category: 'camps', image: I('camp-group.jpg'), caption: 'Soccer camp group', size: 'wide', shape: 'rect' },
    { category: 'community', image: I('qos-third-it.jpg'), caption: 'QoS Third It: we are in it together', size: 'tall', shape: 'rect' },
    { category: 'schools', image: I('school-visit.jpg'), caption: 'School partners', size: 's', shape: 'rect' },
    { category: 'community', image: I('youth-programme.jpg'), caption: 'Our youth programme', size: 's', shape: 'circle' },
    { category: 'community', image: I('community-group.jpg'), caption: 'Celebrating with a community group', size: 's', shape: 'rect' },
    { category: 'camps', image: '/img/trust_wednesdayclub.jpg', caption: 'Wednesday Club at the Queen of the South Arena', size: 'wide', shape: 'rect' },
  ],
};

// Revisions of the starting lists above (SEED) to bring into sites that already have content. Add a new entry, with
// a new key, each time the starting content of existing lists changes. "replace" lists are swapped for the new SEED
// only if nobody has edited them on that site; "append" lists gain new items whose title isn't there yet.
// Text fields need no entry: unedited fields always show the current default.
export const CONTENT_UPDATES = [
  {
    key: 'update:2026-10-strategy',
    replace: ['journey', 'programmes', 'stories', 'timeline', 'pillars', 'team', 'funders', 'venues', 'gallery'],
    append: ['news'],
  },
];
