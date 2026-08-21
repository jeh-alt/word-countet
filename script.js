/* ==========================================================================
   Wordly — Word Counter
   Vanilla JS, no dependencies. All text processing happens locally.
   ========================================================================== */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     Word / text analysis
     ------------------------------------------------------------------ */

  const WORDS_PER_MINUTE = 200;

  function analyzeText(raw) {
    const text = raw || "";

    const trimmed = text.trim();
    const words = trimmed.length ? trimmed.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;

    const charCount = text.length;
    const charCountNoSpace = text.replace(/\s/g, "").length;

    // Sentences: split on ./!/? followed by space or end, ignore empty fragments.
    const sentenceMatches = trimmed.length
      ? trimmed
          .split(/[.!?]+(?:\s+|$)/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const sentenceCount = sentenceMatches.length;

    // Paragraphs: split on blank lines (one or more newlines), ignore empty blocks.
    const paragraphMatches = trimmed.length
      ? trimmed.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)
      : [];
    const paragraphCount = paragraphMatches.length;

    const readingMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)) : 0;

    return {
      wordCount,
      charCount,
      charCountNoSpace,
      sentenceCount,
      paragraphCount,
      readingMinutes,
    };
  }

  /* ------------------------------------------------------------------
     Animated number counters
     ------------------------------------------------------------------ */

  const animatedEls = new Map(); // element -> { current, raf }

  function animateValue(el, from, to, suffix, duration) {
    if (prefersReducedMotion || duration <= 0) {
      el.textContent = suffix ? `${to}${suffix}` : String(to);
      return;
    }

    const existing = animatedEls.get(el);
    if (existing && existing.raf) cancelAnimationFrame(existing.raf);

    const start = performance.now();
    const diff = to - from;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + diff * eased);
      el.textContent = suffix ? `${value}${suffix}` : String(value);

      if (progress < 1) {
        const raf = requestAnimationFrame(tick);
        animatedEls.set(el, { current: value, raf });
      } else {
        animatedEls.set(el, { current: to, raf: null });
      }
    }

    const raf = requestAnimationFrame(tick);
    animatedEls.set(el, { current: from, raf });
  }

  function updateStat(el, newValue, suffixEl) {
    const from = Number(el.dataset.target || 0);
    if (from === newValue) return; // no-op, avoid redundant animation
    el.dataset.target = String(newValue);

    if (suffixEl) {
      // Preserve trailing unit markup (e.g. "m" for minutes) by rebuilding it.
      const unitHtml = suffixEl.outerHTML;
      animateValue(el, from, newValue, "", 260);
      // Re-append the unit span after animation completes (or immediately if reduced motion)
      const reAppend = () => {
        if (!el.querySelector(".stat__unit")) {
          el.insertAdjacentHTML("beforeend", unitHtml);
        }
      };
      if (prefersReducedMotion) {
        reAppend();
      } else {
        setTimeout(reAppend, 270);
      }
    } else {
      animateValue(el, from, newValue, "", 260);
    }
  }

  /* ------------------------------------------------------------------
     Tool wiring
     ------------------------------------------------------------------ */

  const editor = document.getElementById("editor");
  const liveStatus = document.getElementById("liveStatus");

  const statWords = document.getElementById("statWords");
  const statChars = document.getElementById("statChars");
  const statCharsNoSpace = document.getElementById("statCharsNoSpace");
  const statSentences = document.getElementById("statSentences");
  const statParagraphs = document.getElementById("statParagraphs");
  const statReadTime = document.getElementById("statReadTime");
  const readTimeUnit = statReadTime ? statReadTime.querySelector(".stat__unit") : null;

  const sampleBtn = document.getElementById("sampleBtn");
  const pasteBtn = document.getElementById("pasteBtn");
  const copyBtn = document.getElementById("copyBtn");
  const clearBtn = document.getElementById("clearBtn");

  const SAMPLE_TEXT =
    "Good writing starts with clarity. Before you worry about style, make sure every sentence says exactly what you mean.\n\n" +
    "Word counters are useful because limits force decisions. A tighter word count means cutting filler, combining ideas, and choosing sharper language. That process usually makes writing better, not worse.\n\n" +
    "Whether you're drafting an essay, a product description, or a social caption, keeping an eye on your word count, character count, and reading time helps you stay within the space you actually have.";

  let statusTimeout = null;

  function announce(message) {
    if (!liveStatus) return;
    liveStatus.textContent = message;
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      liveStatus.textContent = "";
    }, 2000);
  }

  function refreshStats() {
    if (!editor) return;
    const stats = analyzeText(editor.value);

    if (statWords) updateStat(statWords, stats.wordCount);
    if (statChars) updateStat(statChars, stats.charCount);
    if (statCharsNoSpace) updateStat(statCharsNoSpace, stats.charCountNoSpace);
    if (statSentences) updateStat(statSentences, stats.sentenceCount);
    if (statParagraphs) updateStat(statParagraphs, stats.paragraphCount);
    if (statReadTime) updateStat(statReadTime, stats.readingMinutes, readTimeUnit);
  }

  function flashButton(btn, label) {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.classList.add("is-confirmed");
    btn.querySelector("span")
      ? (btn.querySelector("span").textContent = label)
      : (btn.textContent = label);
    setTimeout(() => {
      btn.classList.remove("is-confirmed");
      btn.innerHTML = original;
    }, 1400);
  }

  if (editor) {
    editor.addEventListener("input", refreshStats);
    refreshStats();
  }

  if (sampleBtn) {
    sampleBtn.addEventListener("click", () => {
      editor.value = SAMPLE_TEXT;
      editor.focus();
      refreshStats();
      announce("Sample text inserted.");
    });
  }

  if (pasteBtn) {
    pasteBtn.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const start = editor.selectionStart ?? editor.value.length;
          const end = editor.selectionEnd ?? editor.value.length;
          editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
          refreshStats();
          editor.focus();
          announce("Text pasted from clipboard.");
        }
      } catch (err) {
        editor.focus();
        announce("Clipboard access wasn't available. Paste manually with your keyboard shortcut.");
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      if (!editor.value) {
        announce("Nothing to copy yet.");
        return;
      }
      try {
        await navigator.clipboard.writeText(editor.value);
        announce("Text copied to clipboard.");
        flashButton(copyBtn, "Copied");
      } catch (err) {
        editor.select();
        announce("Select the text and use your keyboard shortcut to copy.");
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (!editor.value) return;
      editor.value = "";
      refreshStats();
      editor.focus();
      announce("Editor cleared.");
      flashButton(clearBtn, "Cleared");
    });
  }

  /* ------------------------------------------------------------------
     Sticky nav — glass treatment on scroll
     ------------------------------------------------------------------ */

  const nav = document.getElementById("siteNav");
  if (nav) {
    let lastState = false;
    const onScroll = () => {
      const scrolled = window.scrollY > 12;
      if (scrolled !== lastState) {
        nav.classList.toggle("is-scrolled", scrolled);
        lastState = scrolled;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */

  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Open menu" : "Close menu");
      mobileMenu.classList.toggle("is-open", !isOpen);
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open menu");
        mobileMenu.classList.remove("is-open");
      });
    });
  }

  /* ------------------------------------------------------------------
     FAQ accordion
     ------------------------------------------------------------------ */

  const faqTriggers = document.querySelectorAll(".faq-item__trigger");
  faqTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const isOpen = trigger.getAttribute("aria-expanded") === "true";

      // Close all others for a single-open accordion feel.
      faqTriggers.forEach((t) => {
        if (t !== trigger) t.setAttribute("aria-expanded", "false");
      });

      trigger.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  /* ------------------------------------------------------------------
     Scroll reveal via IntersectionObserver
     ------------------------------------------------------------------ */

  const revealEls = document.querySelectorAll("[data-reveal]");

  if (revealEls.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
      );
      revealEls.forEach((el) => observer.observe(el));
    }
  }

  /* ------------------------------------------------------------------
     Subtle cursor-reactive atmosphere (desktop only)
     ------------------------------------------------------------------ */

  const glowOne = document.querySelector(".atmosphere__glow--one");
  const glowTwo = document.querySelector(".atmosphere__glow--two");
  const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (supportsHover && !prefersReducedMotion && glowOne && glowTwo) {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = null;

    window.addEventListener(
      "mousemove",
      (e) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 2;
        targetY = (e.clientY / window.innerHeight - 0.5) * 2;
        if (!rafId) rafId = requestAnimationFrame(loop);
      },
      { passive: true }
    );

    function loop() {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      glowOne.style.transform = `translate(${currentX * 24}px, ${currentY * 18}px)`;
      glowTwo.style.transform = `translate(${currentX * -20}px, ${currentY * -14}px)`;

      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        rafId = requestAnimationFrame(loop);
      } else {
        rafId = null;
      }
    }
  }

  /* ------------------------------------------------------------------
     Footer year
     ------------------------------------------------------------------ */

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
