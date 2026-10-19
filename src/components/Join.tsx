import { useState, type PointerEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLink, Reveal, SectionTag, ScrambleHeading, SuitGlyph, SUIT_FOR, useMagnetic } from "./ui";
import { CardBack } from "./DealScene";
import { COLOR_HEX, SOCIAL_LINKS, type GColor } from "../data/content";
import { cn } from "../utils/cn";

const PERKS = [
  { color: "gblue" as GColor, text: "Weekly hands-on sessions - no lecture slides, ever" },
  { color: "gred" as GColor, text: "Mentor reviews on your projects and pull requests" },
  { color: "gyellow" as GColor, text: "First dibs on Open Source October issues, swag drops and DevFest" },
  { color: "ggreen" as GColor, text: "A direct line into the pan-India GDG community" },
];

const YEARS = ["1st year", "2nd year", "3rd year", "4th year"];
const YEAR_COLORS: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PreviewCard({ name, year }: { name: string; year: string }) {
  const reduced = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const color = YEAR_COLORS[Math.max(0, YEARS.indexOf(year))];
  const hex = COLOR_HEX[color];
  const ready = name.trim().length >= 2;

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((event.clientY - box.top) / box.height - 0.5) * -14,
      y: ((event.clientX - box.left) / box.width - 0.5) * 14,
    });
  };

  return (
    <div
      className="w-[170px] shrink-0 [perspective:900px]"
      onPointerMove={onPointerMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      aria-hidden="true"
    >
      <motion.div
        className="crew-card relative aspect-[5/7]"
        animate={{ rotateY: ready ? 0 : 180, rotateX: tilt.x, rotateZ: ready ? -4 + tilt.y * 0.2 : -4, y: ready ? -6 : 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 16 }}
      >
        <div className="deal-face absolute inset-0 flex flex-col justify-between overflow-hidden border-[3px] border-ink bg-bg p-4 shadow-[6px_6px_0_var(--color-ink)]">
          <span className="absolute inset-x-0 top-0 h-2" style={{ background: hex }} />
          <span className="mt-1 flex flex-col items-start leading-none" style={{ color: hex }}>
            <span className="font-display text-sm font-extrabold text-ink">{initialsOf(name) || "—"}</span>
            <SuitGlyph suit={SUIT_FOR[color]} size={11} />
          </span>
          <span className="pointer-events-none absolute -right-6 -bottom-6 opacity-10" style={{ color: hex }}>
            <SuitGlyph suit={SUIT_FOR[color]} size={130} />
          </span>
          <div className="relative">
            <p className="font-mono text-[9px] font-semibold tracking-[0.2em] text-muted uppercase">Member · {year}</p>
            <p className="mt-1 font-display text-lg leading-tight font-extrabold break-words text-ink">{name.trim() || "Your name"}</p>
          </div>
        </div>
        <CardBack />
      </motion.div>
    </div>
  );
}

interface FormErrors {
  name?: string;
  email?: string;
}

export default function Join() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [year, setYear] = useState(YEARS[0]);
  const [errors, setErrors] = useState<FormErrors>({});
  /* effect 6: short magnetic pull on the primary CTA (fine pointers only) */
  const magnet = useMagnetic<HTMLSpanElement>(0.22, 36);

  const submit = () => {
    const next: FormErrors = {};
    if (name.trim().length < 2) {
      next.name = "Name required";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Valid email required";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }

    const params = new URLSearchParams({
      mode: "signup",
      name: name.trim(),
      email: email.trim(),
      year: String(YEARS.indexOf(year) + 1),
    });
    location.hash = `#/login?${params}`;
  };

  const inputCls =
    "w-full border-[3px] border-ink bg-bg px-4 py-3.5 font-mono text-sm text-ink placeholder:text-muted transition-colors duration-300 focus:bg-panel focus:outline-none";

  return (
    <section id="join" data-wash="green" className="wash-section relative scroll-mt-20 overflow-hidden border-b-[3px] border-ink">
      <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* pitch */}
          <div>
            <SectionTag index="07" label="Join the crew" color="ggreen" />
            <ScrambleHeading
              text="Open a PR on your future"
              className="mt-6 text-h2 heading-shadow heading-shadow-yellow"
            />
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink/80">
              No gatekeeping, no "you need to know X first". If you're curious enough to show up on a Friday
              evening, you're our kind of person. Drop your details and the crew will pull you in before the
              next drop.
            </p>

            <ul className="mt-9 space-y-4">
              {PERKS.map((p, i) => (
                <Reveal key={p.text} delay={i * 0.06}>
                  <li className="flex items-start gap-3.5 text-sm text-ink/85">
                    <span
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 border-2 border-ink"
                      style={{ background: COLOR_HEX[p.color] }}
                      aria-hidden="true"
                    />
                    {p.text}
                  </li>
                </Reveal>
              ))}
            </ul>

            <div className="mt-10 hidden items-center gap-6 lg:flex">
              <PreviewCard name={name} year={year} />
              <div>
                <p className="font-mono text-xs font-semibold tracking-[0.25em] text-muted uppercase">Your card, live</p>
                <p className="mt-2 max-w-[14rem] text-sm leading-relaxed text-ink/80">
                  Type your name and pick your year. Your member card deals itself as you go.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              {SOCIAL_LINKS.map((link) => (
                <ArrowLink
                  key={link.label}
                  ghost
                  color={link.color}
                  onClick={() => window.open(link.href, "_blank", "noopener")}
                >
                  {link.label}
                </ArrowLink>
              ))}
            </div>
          </div>

          {/* form */}
          <Reveal delay={0.15}>
            <div className="relative border-[3px] border-ink bg-bg p-7 shadow-hard sm:p-9">
              <div className="flex items-center justify-between border-b-[3px] border-ink pb-5">
                <p className="font-mono text-xs text-muted">join --crew=you</p>
                <span className="flex gap-1.5">
                  <span className="h-3 w-3 border-2 border-ink bg-gblue" aria-hidden="true" />
                  <span className="h-3 w-3 border-2 border-ink bg-gred" aria-hidden="true" />
                  <span className="h-3 w-3 border-2 border-ink bg-gyellow" aria-hidden="true" />
                  <span className="h-3 w-3 border-2 border-ink bg-ggreen" aria-hidden="true" />
                </span>
              </div>

              <form
                className="flex flex-col gap-5 pt-7"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div>
                  <label htmlFor="join-name" className="mb-2 block text-sm font-semibold text-ink">
                    Full name
                  </label>
                  <input
                    id="join-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((er) => ({ ...er, name: undefined }));
                    }}
                    placeholder="Your full name"
                    className={cn(inputCls, errors.name && "border-gred")}
                  />
                  {errors.name && <p className="mt-1.5 font-mono text-[11px] font-bold text-ink">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="join-email" className="mb-2 block text-sm font-semibold text-ink">
                    Campus email
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
                  {errors.email && <p className="mt-1.5 font-mono text-[11px] font-bold text-ink">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="join-year" className="mb-2 block text-sm font-semibold text-ink">
                    Year
                  </label>
                  <select id="join-year" value={year} onChange={(e) => setYear(e.target.value)} className={cn(inputCls, "appearance-none")}>
                    {YEARS.map((y) => (
                      <option key={y} value={y} className="bg-panel">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <span
                  ref={magnet.ref}
                  className="block w-full"
                  style={
                    magnet.offset.x || magnet.offset.y
                      ? { transform: `translate3d(${magnet.offset.x}px, ${magnet.offset.y}px, 0)` }
                      : undefined
                  }
                >
                  <button
                    type="submit"
                    className="hard-button group mt-2 flex w-full items-center justify-center gap-3 bg-gyellow px-6 py-4 font-display text-base font-extrabold text-ink"
                  >
                    Create your account
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </span>
                <p className="text-center text-[11px] font-semibold text-muted">
                  already a member? <a href="#/login" className="link-draw font-bold text-ink">log in</a>
                </p>
              </form>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
