export type GColor = "gblue" | "gred" | "gyellow" | "ggreen";

/* The Google four: blue · red · yellow · green */
export const COLOR_HEX: Record<GColor, string> = {
  gblue: "#4285F4",
  gred: "#EA4335",
  gyellow: "#FBBC05",
  ggreen: "#34A853",
};

/* ------------------------------------------------------------------ */
/*  HACKTOBER — the flagship event                                     */
/* ------------------------------------------------------------------ */

export const HACKTOBER = {
  name: "HACKTOBER",
  edition: "Edition 03 · 2026",
  dates: "Oct 3 – 4, 2026",
  startISO: "2026-10-03T09:00:00+05:30",
  endISO: "2026-10-04T18:00:00+05:30",
  venue: "Innovation Lab · Block C · PSIT Kanpur",
  tagline: "48 hours. 4 tracks. One campus-wide commit history.",
  intro:
    "Our flagship hackathon. Two days of caffeine, pull requests and whiteboard arguments — teams of up to four ship a working build from scratch and demo it to a panel of mentors, alumni and industry folks. First-timers get a dedicated lane and a mentor on speed-dial.",
  chips: ["36 hrs of hacking", "4 tracks", "Team ≤ 4", "₹25K prize pool", "Beginner lane"],
  tracks: [
    {
      color: "gblue" as GColor,
      title: "Web",
      desc: "Full-stack apps, PWA experiments, anything that ships a URL by demo time.",
      tools: ["React", "Next.js", "Firebase"],
      detail: "Mentored by the web lead — bring a laptop, leave with a deployed URL.",
    },
    {
      color: "ggreen" as GColor,
      title: "AI / ML",
      desc: "LLM apps, vision hacks, fine-tunes and smart agents with a real use case.",
      tools: ["Vertex AI", "TensorFlow", "LangChain"],
      detail: "GPU slots reserved for the weekend. Pitch a problem, not a model.",
    },
    {
      color: "gyellow" as GColor,
      title: "Mobile",
      desc: "Android-first builds, Kotlin Multiplatform, offline-ready campus tools.",
      tools: ["Kotlin", "Compose", "Flutter"],
      detail: "Device lab open all night — test on real phones, not emulators.",
    },
    {
      color: "gred" as GColor,
      title: "Open Source",
      desc: "Fix, extend or document a real OSS repo — merged PRs count as a build.",
      tools: ["Git", "GitHub", "Good First Issues"],
      detail: "Curated issue list drops at kickoff. A merged PR wins the track.",
    },
  ],
  timeline: [
    { day: "Day 01", color: "gblue" as GColor, time: "09:00", label: "Check-in + opening keynote", note: "Team badges, Wi-Fi keys, ground rules" },
    { day: "Day 01", color: "gblue" as GColor, time: "11:00", label: "Hacking begins", note: "Track mentors assigned per team" },
    { day: "Day 01", color: "gblue" as GColor, time: "16:00", label: "Mentor office hours", note: "15-min slots, bring your blockers" },
    { day: "Day 01", color: "gblue" as GColor, time: "22:00", label: "Midnight snacks + lightning talks", note: "5-minute talks by the crew" },
    { day: "Day 02", color: "gred" as GColor, time: "10:00", label: "Code-freeze warning", note: "Two hours to wrap the build" },
    { day: "Day 02", color: "gred" as GColor, time: "14:00", label: "Demo hour", note: "3-min pitch + live demo per team" },
    { day: "Day 02", color: "gred" as GColor, time: "16:30", label: "Judging", note: "Build quality · impact · craft" },
    { day: "Day 02", color: "gred" as GColor, time: "18:00", label: "Awards + swag drop", note: "Trophies, goodies, stickers for all" },
  ],
  prizes: [
    { color: "gyellow" as GColor, rank: "Winners", reward: "₹10,000 + swag box + 6-month mentorship", detail: "Judged on build quality, impact and the live demo — no slide decks." },
    { color: "gblue" as GColor, rank: "Runners-up", reward: "₹5,000 + swag box + resume review", detail: "One spot decided by the mentor vote — the team that helped others most." },
    { color: "ggreen" as GColor, rank: "Best first-timer build", reward: "Goodies + feature on the campus board", detail: "Exclusive to teams where nobody has shipped an event build before." },
    { color: "gred" as GColor, rank: "Every finisher", reward: "Certificate + sticker pack + bragging rights", detail: "Demo something that runs and you walk away with the full kit." },
  ],
};

/* ------------------------------------------------------------------ */
/*  Campus board — pinned notices                                      */
/* ------------------------------------------------------------------ */

export interface Notice {
  color: GColor;
  title: string;
  body: string;
  pinnedBy: string;
  date: string;
  link?: { label: string; target: string };
}

export const NOTICES: Notice[] = [
  {
    color: "gyellow",
    title: "HACKTOBER registrations: OPEN",
    body: "Oct 3–4 · Innovation Lab, Block C. Teams up to 4, solo entries matched on day one. Beginner lane included.",
    pinnedBy: "Events lead",
    date: "Sep 12",
    link: { label: "See event brief", target: "hacktober" },
  },
  {
    color: "gblue",
    title: "Weekly dev meetup",
    body: "Every Friday, 5 PM, Block C lab. Bring a laptop and exactly one bug you can't figure out.",
    pinnedBy: "Chapter lead",
    date: "every Fri",
  },
  {
    color: "ggreen",
    title: "First PR? We got you",
    body: "Drop your repo in #hacktober-help on Discord. A mentor reviews it within 24 hours, promise.",
    pinnedBy: "OSS lead",
    date: "always on",
  },
  {
    color: "gred",
    title: "DevFest watch party recap",
    body: "200+ attendees, 3 watch-along sessions, one very loud keynote reaction. Swag drop for top 50 contributors.",
    pinnedBy: "Community",
    date: "Dec 14",
    link: { label: "See the log", target: "events" },
  },
  {
    color: "gblue",
    title: "Design track portfolio reviews",
    body: "DM the design lead with your Figma link. Two slots open every week, first come first served.",
    pinnedBy: "Design lead",
    date: "weekly",
  },
];

export const UPCOMING = [
  { date: "Oct 03", label: "HACKTOBER kickoff", color: "gyellow" as GColor },
  { date: "Oct 24", label: "Cloud Study Jam #2", color: "gblue" as GColor },
  { date: "Nov 07", label: "Android office hours", color: "ggreen" as GColor },
  { date: "Dec 14", label: "DevFest watch party", color: "gred" as GColor },
];

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

export const STATS = [
  { value: 250, suffix: "+", label: "Active members", color: "gblue" as GColor },
  { value: 18, suffix: "", label: "Events hosted", color: "gred" as GColor },
  { value: 40, suffix: "+", label: "Projects shipped", color: "gyellow" as GColor },
  { value: 12, suffix: "", label: "Mentors on deck", color: "ggreen" as GColor },
];

/* ------------------------------------------------------------------ */
/*  About pillars                                                      */
/* ------------------------------------------------------------------ */

export const PILLARS = [
  {
    index: "01",
    color: "gblue" as GColor,
    title: "Learn",
    body: "Study jams, bootcamps and zero-to-hero tracks. We run hands-on sessions on web, Android, cloud and GenAI — no slide-deck lectures, you ship something every single session.",
  },
  {
    index: "02",
    color: "gred" as GColor,
    title: "Connect",
    body: "Weekly dev meetups, DevFest watch parties and campus collabs. The point is simple: the person stuck on the same bug as you sits two rows away. We fix that.",
  },
  {
    index: "03",
    color: "gyellow" as GColor,
    title: "Build",
    body: "HACKTOBER, semester sprints and open-source Fridays. Real builds, real deadlines, real code reviews from mentors who have shipped for a living.",
  },
  {
    index: "04",
    color: "ggreen" as GColor,
    title: "Grow",
    body: "Mentorship circles, mock interviews, portfolio reviews and referrals into the wider developer community across India. Your first dev job starts here.",
  },
];

/* ------------------------------------------------------------------ */
/*  Domains — stacked cards                                            */
/* ------------------------------------------------------------------ */

export interface Domain {
  color: GColor;
  title: string;
  blurb: string;
  tools: string[];
  detail: string;
  icon: "web" | "android" | "cloud" | "ai" | "design" | "oss";
}

export const DOMAINS: Domain[] = [
  {
    color: "gblue",
    title: "Web",
    blurb: "Fast interfaces, honest performance budgets and deploys on Fridays anyway. The web track ships a public URL for everything it touches.",
    tools: ["React", "Next.js", "TypeScript", "Firebase"],
    detail: "Meets Fridays 5 PM · lead: Dev Patel · open to every year",
    icon: "web",
  },
  {
    color: "ggreen",
    title: "Android & Mobile",
    blurb: "Kotlin-first, Compose-everywhere. From campus utility apps to offline-ready tools that survive hostel Wi-Fi.",
    tools: ["Kotlin", "Jetpack Compose", "Flutter"],
    detail: "Device lab in Block C · monthly build-alongs · Kotlin from zero",
    icon: "android",
  },
  {
    color: "gyellow",
    title: "Cloud & Infra",
    blurb: "GCP study jams, Firebase backends and Docker nights. Learn to ship, scale and not cry at a billing dashboard.",
    tools: ["Google Cloud", "Firebase", "Docker"],
    detail: "Skill-badge sprints every month · free lab credits for members",
    icon: "cloud",
  },
  {
    color: "gred",
    title: "AI / ML & GenAI",
    blurb: "LLM apps, vision experiments and fine-tuning labs. Less hype, more working demos that solve campus problems.",
    tools: ["Vertex AI", "TensorFlow", "LangChain"],
    detail: "GPU hours booked for members · paper-reading circle, biweekly",
    icon: "ai",
  },
  {
    color: "gblue",
    title: "UI/UX & Design",
    blurb: "Design systems, Figma workflows and portfolio reviews. Developers who design, designers who ship.",
    tools: ["Figma", "Design systems", "Prototyping"],
    detail: "Two portfolio review slots weekly · DM the design lead",
    icon: "design",
  },
  {
    color: "ggreen",
    title: "Open Source",
    blurb: "First-PR nights, good-first-issue hunts and GSoC prep. Your commit history is your resume — we help you start it.",
    tools: ["Git", "GitHub", "GSoC"],
    detail: "PR reviews within 24h · GSoC prep circle starts January",
    icon: "oss",
  },
];

/* ------------------------------------------------------------------ */
/*  Past events log                                                    */
/* ------------------------------------------------------------------ */

export interface PastEvent {
  title: string;
  tag: string;
  color: GColor;
  date: string;
  turnout: string;
  note: string;
  detail: string;
  image: string;
}

export const EVENTS: PastEvent[] = [
  {
    title: "Git & GitHub Bootcamp",
    tag: "Workshop",
    color: "gblue",
    date: "Aug 22, 2026",
    turnout: "120 devs",
    note: "From git init to a merged PR in three hours. Branches, conflicts, rebases — demystified live.",
    detail: "Outcome: 74 first commits pushed before the session ended.",
    image:
      "https://images.pexels.com/photos/16070143/pexels-photo-16070143.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "GenAI Study Jam",
    tag: "Study Jam",
    color: "gred",
    date: "Jul 18, 2026",
    turnout: "90 devs",
    note: "Prompting, RAG and a live Vertex AI walkthrough — everyone left with a working chatbot.",
    detail: "Outcome: 61 skill badges claimed in one sitting.",
    image:
      "https://images.pexels.com/photos/29627312/pexels-photo-29627312.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "First-PR Night",
    tag: "Open Source",
    color: "ggreen",
    date: "Feb 06, 2026",
    turnout: "60 devs",
    note: "Mentors on speed-dial, zero judgement. Squashing the fear of the green button.",
    detail: "Outcome: 41 pull requests merged before midnight.",
    image:
      "https://images.pexels.com/photos/5380607/pexels-photo-5380607.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "DevFest Watch Party",
    tag: "Community",
    color: "gyellow",
    date: "Dec 14, 2025",
    turnout: "200 devs",
    note: "Keynotes on the big screen, live reactions, swag drop for the top contributors of the semester.",
    detail: "Outcome: biggest room we've ever filled — auditorium at capacity.",
    image:
      "https://images.pexels.com/photos/8199151/pexels-photo-8199151.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "Cloud Study Jam",
    tag: "Study Jam",
    color: "gblue",
    date: "Nov 08, 2025",
    turnout: "75 devs",
    note: "GCP skill badges, Firebase backends and one gloriously over-engineered hello-world.",
    detail: "Outcome: 48 badges, 3 Firebase apps deployed to production.",
    image:
      "https://images.pexels.com/photos/19895774/pexels-photo-19895774.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "Android Dev 101",
    tag: "Workshop",
    color: "ggreen",
    date: "Sep 27, 2025",
    turnout: "85 devs",
    note: "Kotlin basics to a working Compose UI — the 'hello campus' app is still on half our phones.",
    detail: "Outcome: 85 APKs sideloaded by 7 PM the same day.",
    image:
      "https://images.pexels.com/photos/6804068/pexels-photo-6804068.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
];

export const MARQUEE_WORDS = [
  "OPEN SOURCE",
  "ANDROID",
  "WEB",
  "CLOUD",
  "GENAI",
  "HACKTOBER",
  "DEVFEST",
  "UI/UX",
  "STUDY JAMS",
];
