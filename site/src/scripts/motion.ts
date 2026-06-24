// "The Scan" — scroll-driven motion for getcatalog.app.
// Progressive enhancement: the page is fully visible and usable without this.
// Reduced motion → no GSAP, no smooth scroll, everything shown instantly.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The CSS fallback hides `.reveal` only under `.js`; reveal everything now so
// nothing can stay hidden whether or not we go on to drive GSAP.
const showAll = () =>
  document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => el.classList.add("is-in"));

if (reduce) {
  showAll();
} else {
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("enhanced");
  showAll();

  // Smooth scroll, wired into ScrollTrigger's update loop.
  const lenis = new Lenis({ duration: 1.05 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const EASE = "power3.out";

  // ---- Hero boot: the window "scans" awake ----
  const hero = document.querySelector<HTMLElement>("[data-scan]");
  if (hero) {
    const win = hero.querySelector(".aw");
    const rows = hero.querySelectorAll(".aw-row");
    const pills = hero.querySelectorAll(".aw-pill");
    const line = hero.querySelector(".scan-line");

    // Owl fades + scales in, then the wordmark text slides in.
    const owl = document.querySelector(".wordmark .owlmark");
    gsap.set(owl, { opacity: 0, scale: 0.85, transformOrigin: "left center" });
    gsap.set(".wordmark .wm-img", { opacity: 0, x: -8 });

    const tl = gsap.timeline({ defaults: { ease: EASE } });
    tl.to(owl, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" })
      .to(".wordmark .wm-img", { opacity: 1, x: 0, duration: 0.4 }, "-=0.25")
      // fromTo (not from): the start state is also pre-set in CSS under .anim so
      // a cold load never flashes these before GSAP runs. from() would read the
      // CSS-hidden value as the END and never reveal them.
      .fromTo(".hero-copy h1", { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.2")
      .fromTo(".hero-copy .lede", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.45")
      .fromTo(".hero-copy .hero-cta", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, "-=0.4")
      .fromTo(win, { y: 34, opacity: 0, scale: 0.985 }, { y: 0, opacity: 1, scale: 1, duration: 0.8 }, "-=0.65");

    if (line) {
      tl.set(line, { opacity: 1, top: "0%" }, "-=0.25")
        .to(line, { top: "100%", duration: 0.85, ease: "power2.inOut" }, "<")
        .from(rows, { opacity: 0, x: -12, stagger: 0.06, duration: 0.4 }, "<0.08")
        .to(line, { opacity: 0, duration: 0.3 }, ">-0.15");
    }
    tl.from(pills, { opacity: 0, scale: 0.8, stagger: 0.12, duration: 0.4 }, ">-0.2");

    // Count the pill numbers up, landing as the pills settle.
    hero.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count || "0");
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 0.7, ease: "power1.out", delay: Math.max(0, tl.duration() - 0.5),
        onUpdate: () => { el.textContent = String(Math.round(obj.v)); },
      });
    });
  }

  // ---- Scroll parallax: window + glow drift as the hero leaves ----
  const heroSt = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } as const;
  gsap.to(".hero-window", { yPercent: 12, ease: "none", scrollTrigger: heroSt });
  gsap.to(".hero-glow", { yPercent: 34, ease: "none", scrollTrigger: heroSt });

  // ---- Nav: hidden over the hero, slides in once scrolled past ----
  const nav = document.querySelector("[data-nav]");
  if (nav) {
    // .nav-armed (set pre-paint in head) hides it over the hero; reveal once past.
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (self) => nav.classList.toggle("nav--shown", self.scroll() > window.innerHeight * 0.85),
    });
  }

  // ---- The Story: pinned scroll-narrative on desktop; autoplay-on-enter on mobile
  //      (pin + scrub is unreliable on touch, so phones play it through once). ----
  const story = document.querySelector<HTMLElement>("[data-story]");
  if (story) {
    const isMobile = window.innerWidth < 900;
    const w1 = story.querySelectorAll(".sline:not(.sline-dim) .sletter");
    const w2 = story.querySelectorAll(".sline-dim .sletter");
    const rows = gsap.utils.toArray<HTMLElement>(story.querySelectorAll(".pkg"));
    const list = story.querySelector(".story-list");
    const numEl = story.querySelector(".story-num");
    const forgotten = story.querySelectorAll(".pkg--forgotten");
    const massDim = rows.filter(
      (r) => !r.classList.contains("pkg--keep") && !r.classList.contains("pkg--cve") && !r.classList.contains("pkg--forgotten"),
    );
    const counter = { v: 0 };
    // Mobile counts higher so the pile visibly keeps filling up.
    const countTarget = isMobile ? 600 : 347;

    gsap.set(w1, { opacity: 0 });
    gsap.set(w2, { opacity: 0 });
    gsap.set(rows, { opacity: 0, y: 10 });
    gsap.set(list, { "--pkg-fs": "17px" });

    // Positions below are fractions of the (≈1.0) timeline; stagger uses
    // `amount` (total spread) so row count never balloons the duration.
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: isMobile
        ? { trigger: story, start: "top 72%", toggleActions: "play none none none" }
        : {
            trigger: story, start: "top top", end: "+=240%", scrub: 0.6,
            pin: ".story-stage", anticipatePin: 1,
            onUpdate: (self) => story.classList.toggle("story--alerts", self.progress > 0.5),
          },
    });
    tl.to(rows, { opacity: 1, y: 0, duration: 0.45, stagger: { amount: 0.42 } }, 0);            // flood starts first
    tl.to(list, { "--pkg-fs": "9.5px", duration: 0.5 }, 0);                                     // shrink to fit hundreds
    tl.to(counter, { v: countTarget, duration: isMobile ? 0.95 : 0.5, onUpdate: () => { if (numEl) numEl.textContent = String(Math.round(counter.v)); } }, 0);
    tl.to(w1, { opacity: 1, duration: 0.34, stagger: { amount: 0.42 } }, 0.18);                 // then the line builds, letter by letter
    tl.to(".story-risk", { opacity: 1, duration: 0.12 }, 0.5);                                  // risk count appears
    tl.to(forgotten, { opacity: 0, duration: 0.16, stagger: { amount: 0.08 } }, 0.5);           // some are forgotten
    tl.to(massDim, { opacity: 0.14, duration: 0.2 }, 0.72);                                     // the mass dims away
    tl.to(w2, { opacity: 1, duration: 0.3, stagger: { amount: 0.3 } }, 0.7);                    // "...a handful." builds letter by letter

    if (isMobile) {
      tl.call(() => story.classList.add("story--alerts"), undefined, 0.5);
      tl.timeScale(0.45); // stretch the ~1s narrative to ~2.2s so it reads on a phone
    }
  }

  // ---- How it works: pinned step-reveal on desktop; autoplay-on-enter on mobile ----
  const how = document.querySelector<HTMLElement>("[data-how]");
  if (how) {
    const isMobile = window.innerWidth < 900;
    const howSteps = how.querySelectorAll(".how-step");
    gsap.set(howSteps, { opacity: 0, y: 30 });
    const htl = gsap.timeline({
      scrollTrigger: isMobile
        ? { trigger: how, start: "top 70%", toggleActions: "play none none none" }
        : { trigger: how, start: "top top", end: "+=150%", scrub: 0.5, pin: ".how-stage", anticipatePin: 1 },
    });
    howSteps.forEach((s, i) => htl.to(s, { opacity: 1, y: 0, ease: "power3.out", duration: 0.25 }, 0.18 + i * 0.26));
    if (isMobile) htl.timeScale(0.7);
  }

  // ---- Catalog demo: type a name query; non-matching rows drop per keystroke.
  //      Pinned-scrub on desktop; autoplay-on-enter on mobile. ----
  const cat = document.querySelector<HTMLElement>("[data-catalog-demo]");
  if (cat) {
    const isMobile = window.innerWidth < 900;
    const qEl = cat.querySelector("[data-sd-query]");
    const countEl = cat.querySelector("[data-sd-count]");
    const rows = gsap.utils.toArray<HTMLElement>(cat.querySelectorAll(".sd-row"));
    const query = "git";
    // type the query over the first half of the progress, then hold the result
    const apply = (progress: number) => {
      const typed = query.slice(0, Math.round(Math.min(1, progress / 0.5) * query.length));
      if (qEl) qEl.textContent = typed;
      let shown = 0;
      rows.forEach((row) => {
        const match = !typed || (row.dataset.name || "").toLowerCase().includes(typed);
        row.classList.toggle("is-hidden", !match);
        if (match) shown++;
      });
      if (countEl) countEl.textContent = String(shown);
    };
    if (isMobile) {
      const p = { v: 0 };
      gsap.to(p, {
        v: 1, duration: 2.6, ease: "none",
        scrollTrigger: { trigger: cat, start: "top 65%", toggleActions: "play none none none" },
        onUpdate: () => apply(p.v),
      });
    } else {
      ScrollTrigger.create({
        trigger: cat, start: "top top", end: "+=130%", scrub: 0.4,
        pin: cat.querySelector(".demo-stage"), anticipatePin: 1,
        onUpdate: (self) => apply(self.progress),
      });
    }
  }

  // ---- Describe demo: empty -> press -> loading -> filled.
  //      Pinned-scrub on desktop; autoplay-on-enter on mobile. ----
  const dd = document.querySelector<HTMLElement>("[data-describe-demo]");
  if (dd) {
    const isMobile = window.innerWidth < 900;
    const btn = dd.querySelector("[data-dd-btn]");
    const empty = dd.querySelector("[data-dd-empty]");
    const spinner = dd.querySelector("[data-dd-spinner]");
    const desc = dd.querySelector("[data-dd-desc]");
    const tags = dd.querySelectorAll("[data-dd-tag]");
    gsap.set(dd.querySelector("[data-dd-filled]"), { opacity: 1 });
    gsap.set(desc, { opacity: 0, y: 10 });
    gsap.set(tags, { opacity: 0, y: 8 });
    const dtl = gsap.timeline({
      scrollTrigger: isMobile
        ? { trigger: dd, start: "top 68%", toggleActions: "play none none none" }
        : { trigger: dd, start: "top top", end: "+=160%", scrub: 0.5, pin: dd.querySelector(".demo-stage"), anticipatePin: 1 },
    });
    dtl.to(btn, { scale: 0.94, duration: 0.05 }, 0.26).to(btn, { scale: 1, duration: 0.05 }, 0.32);
    dtl.to(empty, { opacity: 0, duration: 0.08 }, 0.3);
    dtl.to(spinner, { opacity: 1, duration: 0.08 }, 0.33);
    dtl.to(spinner, { opacity: 0, duration: 0.08 }, 0.56);
    dtl.to(desc, { opacity: 1, y: 0, duration: 0.18 }, 0.58);
    dtl.to(tags, { opacity: 1, y: 0, duration: 0.16, stagger: { amount: 0.12 } }, 0.66);
    if (isMobile) dtl.timeScale(0.55);
  }

  // Generic rise for content sections: how-it-works, feature splits, audits, faq, footer.
  gsap.utils.toArray<HTMLElement>(".r-up").forEach((el) => {
    gsap.from(el, {
      y: 28, opacity: 0, duration: 0.6, ease: EASE,
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  // Fonts/late layout can shift trigger positions; recompute once settled.
  window.addEventListener("load", () => ScrollTrigger.refresh());
}
