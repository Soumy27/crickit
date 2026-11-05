"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useLanguage } from "@/lib/i18n/use-language";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis, driven by GSAP's clock so the scroll and every scrubbed timeline step
 * on the same frame. Landing page only: nobody scoring a match wants their
 * scroll eased, and unmounting here hands the app back the native one.
 */
export function SmoothScroll() {
  const { chosen } = useLanguage();
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    // A phone bar showing and hiding must not re-measure every pinned scene.
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const instance = new Lenis({ autoRaf: false, anchors: true, lerp: 0.1 });
    lenis.current = instance;
    instance.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      instance.destroy();
      lenis.current = null;
    };
  }, []);

  // The language picker is a full-screen sheet; the page must hold still under it.
  useEffect(() => {
    if (chosen) lenis.current?.start();
    else lenis.current?.stop();
  }, [chosen]);

  return null;
}
