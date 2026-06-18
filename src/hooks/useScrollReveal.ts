import { useEffect } from "react";

/**
 * useScrollReveal - Intersection Observer based scroll animations
 * Adds 'revealed' class when elements enter viewport
 * 
 * Usage: Add 'scroll-reveal' class to any element you want to animate on scroll.
 * Optionally add 'scroll-reveal-delay-N' for staggered timing.
 * Parent can have 'scroll-stagger' to auto-stagger children.
 */
export function useScrollReveal(threshold = 0.15) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target); // Only animate once
          }
        });
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    const elements = document.querySelectorAll(".scroll-reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [threshold]);
}

/**
 * useCountUp - Animates a number from 0 to target when element is in view
 */
export function useCountUp(
  targetRef: React.RefObject<HTMLElement | null>,
  end: number,
  duration: number = 2000
) {
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(el, end, duration);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [targetRef, end, duration]);
}

function animateCount(el: HTMLElement, end: number, duration: number) {
  const start = performance.now();
  const suffix = el.dataset.suffix || "";
  const prefix = el.dataset.prefix || "";

  function update(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * end);

    if (end >= 1000) {
      el.textContent = prefix + current.toLocaleString() + suffix;
    } else {
      el.textContent = prefix + current + suffix;
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
