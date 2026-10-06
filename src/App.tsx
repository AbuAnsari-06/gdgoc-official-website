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

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-bg font-body text-ink">
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
        <div className="noise-overlay" aria-hidden="true" />
      </div>
    </MotionConfig>
  );
}
