import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import Lenis from "lenis";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Stats from "./components/Stats";
import NoticeBoard from "./components/NoticeBoard";
import About from "./components/About";
import Hacktober from "./components/Hacktober";
import Events from "./components/Events";
import Domains from "./components/Domains";
import Crew from "./components/Crew";
import Join from "./components/Join";
import Footer from "./components/Footer";
import Cursor from "./components/Cursor";
import GDGoCIntro from "./components/intro/GDGoCIntro";
import { setLenis } from "./lib/scroll";

export default function App() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    setLenis(lenis);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  /* effect 4: each section picks up its tint wash as it enters view */
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main > section"));
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }
      },
      { rootMargin: "-20% 0px -20% 0px" }
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-bg font-body text-ink">
        {/* No page-wide starfield here: the universe belongs to the hero
           alone (it owns and pauses the canvas), and the sections below
           are the paper world. A full-page copy would paint 61 MB of
           bitmap under opaque backgrounds for nothing. */}
        <Nav />
        <main>
          <Hero />
          <Stats />
          <NoticeBoard />
          <About />
          <Hacktober />
          <Events />
          <Domains />
          <Crew />
          <Join />
        </main>
        <Footer />
        <Cursor />
        <div className="noise-overlay" aria-hidden="true" />
        <GDGoCIntro />
      </div>
    </MotionConfig>
  );
}
