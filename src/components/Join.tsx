import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLink, Reveal, SectionTag, ScrambleHeading } from "./ui";
import { COLOR_HEX, type GColor } from "../data/content";
import { cn } from "../utils/cn";

const TRACKS: { label: string; color: GColor }[] = [
  { label: "Web", color: "gblue" },
  { label: "Android", color: "ggreen" },
  { label: "Cloud", color: "gyellow" },
  { label: "AI / ML", color: "gred" },
  { label: "UI/UX", color: "gblue" },
  { label: "Open Source", color: "ggreen" },
];

const PERKS = [
  { color: "gblue" as GColor, text: "Weekly hands-on sessions — no lecture slides, ever" },
  { color: "gred" as GColor, text: "Mentor reviews on your projects and pull requests" },
  { color: "gyellow" as GColor, text: "First dibs on HACKTOBER teams, swag drops and DevFest" },
  { color: "ggreen" as GColor, text: "A direct line into the pan-India GDG community" },
];

const YEARS = ["1st year", "2nd year", "3rd year", "4th year"];

interface FormErrors {
  name?: string;
  email?: string;
  tracks?: string;
}

export default function Join() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [year, setYear] = useState(YEARS[0]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const toggleTrack = (label: string) => {
    setTracks((t) => (t.includes(label) ? t.filter((x) => x !== label) : [...t, label]));
    setErrors((e) => ({ ...e, tracks: undefined }));
  };

  const submit = () => {
    const next: FormErrors = {};
    if (name.trim().length < 2) next.name = "// name required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "// valid email required";
    if (tracks.length === 0) next.tracks = "// pick at least one track";
    setErrors(next);
    if (Object.keys(next).length === 0) setSubmitted(true);
  };

  const reset = () => {
    setName("");
    setEmail("");
    setYear(YEARS[0]);
    setTracks([]);
    setErrors({});
    setSubmitted(false);
  };

  const inputCls =
    "w-full border border-line bg-bg px-4 py-3.5 font-mono text-sm text-ink placeholder:text-muted/60 transition-colors duration-300 focus:border-gyellow focus:outline-none";

  return (
    <section id="join" className="relative scroll-mt-20 overflow-hidden border-t border-line">
      <div className="pointer-events-none absolute bottom-0 -left-40 h-[460px] w-[460px] rounded-full bg-ggreen/[0.06] blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* pitch */}
          <div>
            <SectionTag index="07" label="Join the crew" color="ggreen" />
            <ScrambleHeading
              text="OPEN A PR ON YOUR FUTURE"
              className="mt-6 font-display text-4xl leading-[1.1] font-black tracking-tight uppercase sm:text-5xl xl:text-6xl"
            />
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              No gatekeeping, no "you need to know X first". If you're curious enough to show up on a Friday
              evening, you're our kind of person. Drop your details and the crew will pull you in before the
              next drop.
            </p>

            <ul className="mt-9 space-y-4">
              {PERKS.map((p, i) => (
                <Reveal key={p.text} delay={i * 0.06}>
                  <li className="flex items-start gap-3.5 text-sm text-ink/85">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0" style={{ background: COLOR_HEX[p.color] }} />
                    {p.text}
                  </li>
                </Reveal>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-4">
              <ArrowLink ghost color="gblue" onClick={() => window.open("https://gdg.community.dev", "_blank", "noopener")}>
                gdg.community.dev
              </ArrowLink>
              <ArrowLink ghost color="gred" onClick={() => window.open("https://instagram.com", "_blank", "noopener")}>
                Instagram
              </ArrowLink>
            </div>
          </div>

          {/* form */}
          <Reveal delay={0.15}>
            <div className="relative border border-line bg-panel p-7 sm:p-9">
              <div className="flex items-center justify-between border-b border-line pb-5">
                <p className="font-mono text-[11px] tracking-[0.25em] text-muted uppercase">join --crew=you</p>
                <span className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-gblue" />
                  <span className="h-2 w-2 rounded-full bg-gred" />
                  <span className="h-2 w-2 rounded-full bg-gyellow" />
                  <span className="h-2 w-2 rounded-full bg-ggreen" />
                </span>
              </div>

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="flex min-h-[420px] flex-col items-center justify-center py-10 text-center"
                  >
                    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                      <motion.circle
                        cx="36" cy="36" r="32" stroke={COLOR_HEX.ggreen} strokeWidth="3"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                      />
                      <motion.path
                        d="M22 37.5 32 47l18-20" stroke={COLOR_HEX.ggreen} strokeWidth="4" strokeLinecap="square"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
                      />
                    </svg>
                    <p className="mt-6 font-display text-2xl font-black uppercase">
                      You're in the queue, {name.trim().split(" ")[0]}
                    </p>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
                      Watch <span className="text-ink">{email}</span> — the crew sends onboarding before the
                      next meetup. Meanwhile, the board is yours to explore.
                    </p>
                    <button
                      type="button"
                      onClick={reset}
                      className="link-slide mt-8 font-mono text-[11px] tracking-[0.2em] text-gyellow uppercase"
                    >
                      submit another response
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col gap-5 pt-7"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit();
                    }}
                  >
                    <div>
                      <label htmlFor="join-name" className="mb-2 block font-mono text-[10px] tracking-[0.25em] text-muted uppercase">
                        full name
                      </label>
                      <input
                        id="join-name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setErrors((er) => ({ ...er, name: undefined }));
                        }}
                        placeholder="Ada Lovelace"
                        className={cn(inputCls, errors.name && "border-gred")}
                      />
                      {errors.name && <p className="mt-1.5 font-mono text-[11px] text-gred">{errors.name}</p>}
                    </div>

                    <div>
                      <label htmlFor="join-email" className="mb-2 block font-mono text-[10px] tracking-[0.25em] text-muted uppercase">
                        campus email
                      </label>
                      <input
                        id="join-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setErrors((er) => ({ ...er, email: undefined }));
                        }}
                        placeholder="you@psit.ac.in"
                        className={cn(inputCls, errors.email && "border-gred")}
                      />
                      {errors.email && <p className="mt-1.5 font-mono text-[11px] text-gred">{errors.email}</p>}
                    </div>

                    <div>
                      <label htmlFor="join-year" className="mb-2 block font-mono text-[10px] tracking-[0.25em] text-muted uppercase">
                        year
                      </label>
                      <select id="join-year" value={year} onChange={(e) => setYear(e.target.value)} className={cn(inputCls, "appearance-none")}>
                        {YEARS.map((y) => (
                          <option key={y} value={y} className="bg-panel">
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="mb-2.5 font-mono text-[10px] tracking-[0.25em] text-muted uppercase">
                        tracks you vibe with
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {TRACKS.map((t) => {
                          const active = tracks.includes(t.label);
                          const hex = COLOR_HEX[t.color];
                          return (
                            <button
                              key={t.label}
                              type="button"
                              onClick={() => toggleTrack(t.label)}
                              className={cn(
                                "border px-3.5 py-2 font-mono text-[11px] tracking-[0.12em] uppercase transition-all duration-300",
                                active ? "text-bg" : "border-line2 text-muted hover:border-ink hover:text-ink"
                              )}
                              style={active ? { background: hex, borderColor: hex } : undefined}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                      {errors.tracks && <p className="mt-1.5 font-mono text-[11px] text-gred">{errors.tracks}</p>}
                    </div>

                    <button
                      type="submit"
                      className="group mt-2 flex items-center justify-center gap-3 bg-gyellow px-6 py-4 font-mono text-xs font-bold tracking-[0.22em] text-bg uppercase transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-12px_rgba(251,188,5,0.45)]"
                    >
                      request to join
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="transition-transform duration-300 group-hover:translate-x-1.5">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                    <p className="text-center font-mono text-[10px] tracking-widest text-muted/70 uppercase">
                      no spam · one onboarding mail · unsubscribe anytime
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
