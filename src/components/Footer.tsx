import { GdgMark, Marquee } from "./ui";
import { scrollToId, scrollToTop } from "../lib/scroll";

const NAV = [
  { id: "board", label: "Campus board" },
  { id: "about", label: "What we do" },
  { id: "hacktober", label: "Open Source October" },
  { id: "events", label: "Event log" },
  { id: "domains", label: "Domains" },
  { id: "crew", label: "The crew" },
  { id: "join", label: "Join" },
];

const EXTERNALS = [
  { label: "gdg.community.dev", href: "https://gdg.community.dev" },
  { label: "Instagram", href: "https://instagram.com" },
  { label: "GitHub", href: "https://github.com" },
  { label: "Discord", href: "https://discord.com" },
];

export default function Footer() {
  return (
    <footer className="relative border-t-[3px] border-ink bg-bg">
      {/* big marquee */}
      <div className="border-b-[3px] border-ink bg-panel py-8">
        <Marquee duration={38} mask={false}>
          {[0, 1].map((k) => (
            <span key={k} className="flex items-center">
              <span className="px-6 font-display text-6xl font-extrabold tracking-tight whitespace-nowrap sm:text-8xl">
                GDGoC PSIT
              </span>
              <span className="flex gap-2 px-6">
                <span className="h-4 w-4 border-2 border-ink bg-gblue" aria-hidden="true" />
                <span className="h-4 w-4 border-2 border-ink bg-gred" aria-hidden="true" />
                <span className="h-4 w-4 border-2 border-ink bg-gyellow" aria-hidden="true" />
                <span className="h-4 w-4 border-2 border-ink bg-ggreen" aria-hidden="true" />
              </span>
            </span>
          ))}
        </Marquee>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <GdgMark size={28} />
              <span className="font-display text-lg font-extrabold">
                GDGoC<span className="text-gblue">·</span>PSIT
              </span>
              <span className="font-mono text-sm text-muted" aria-hidden="true">
                &lt;/&gt;
              </span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink/80">
              Google Developer Groups on Campus — PSIT, Kanpur. A student-run chapter where people learn
              together, build loudly and ship open source.
            </p>
            <button type="button" onClick={scrollToTop} className="hard-button group mt-8 inline-flex items-center gap-3 bg-bg px-5 py-3 font-display text-[15px] font-bold text-ink">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform duration-300 group-hover:-translate-y-1" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
              Back to top
            </button>
          </div>

          <div>
            <p className="font-mono text-xs text-muted">// navigate</p>
            <ul className="mt-5 space-y-3">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => scrollToId(n.id)} className="link-draw text-sm font-semibold text-ink">
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs text-muted">// find us</p>
            <ul className="mt-5 space-y-3">
              {EXTERNALS.map((e) => (
                <li key={e.label}>
                  <a
                    href={e.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-sm font-semibold text-ink"
                  >
                    <span className="link-draw">{e.label}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true">
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-8 font-mono text-xs leading-relaxed text-muted">
              PSIT Campus · NH-2, Bhauti
              <br />
              Kanpur, Uttar Pradesh, India
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t-[3px] border-ink pt-6 sm:flex-row sm:items-center">
          <p className="font-mono text-xs text-muted">
            © 2026 GDGoC PSIT · Built by the crew with React, Three.js & Framer Motion
          </p>
          <p className="font-mono text-xs text-muted">
            A student chapter doing cool stuff — not an official Google product.
          </p>
        </div>
      </div>

      {/* four-colour baseline */}
      <div className="grid h-2 grid-cols-4">
        <span className="bg-gblue" />
        <span className="bg-gred" />
        <span className="bg-gyellow" />
        <span className="bg-ggreen" />
      </div>
    </footer>
  );
}
