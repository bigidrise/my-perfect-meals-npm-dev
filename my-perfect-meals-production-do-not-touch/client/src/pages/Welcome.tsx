import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { bustImageCache } from "@/utils/imageCache";
import { setAuthToken } from "@/lib/auth";

// 🚩 FEATURE FLAG: Set to true to show carousel, false for simple layout
const SHOW_CAROUSEL = false;

const slides = [
  {
    id: 1,
    image: bustImageCache("/assets/MacroCounterImage_1756489833897.png"),
    title: "Stay on Track",
    subtitle: "Effortless tracking that keeps your meals balanced.",
  },
  {
    id: 2,
    image: bustImageCache("/assets/slide2_1756485962360.png"),
    title: "Got Food, Don't Know What to Make?",
    subtitle:
      "Tell me what's in your fridge — I'll give you delicious meal choices",
  },
  {
    id: 3,
    image: bustImageCache("/assets/slide31.png"),
    title: "Dining Out? No Problem.",
    subtitle: "Let your nutrition coach  Choiceconcierge order for you.",
  },
  {
    id: 4,
    image: bustImageCache("/assets/CravingImage_1756490064349.png"),
    title: "Got a Craving? Its All Good!",
    subtitle: "Enjoy your desserts and favorites without the guilt.",
  },
  {
    id: 5,
    image: bustImageCache("/assets/skids_hub_1200x1800.jpg"),
    title: "Kid Loved. Parent Approved.",
    subtitle: "Smart, balanced meals designed to fuel happy, healthy kids.",
  },
] as const;

export default function Welcome() {
  const [, setLocation] = useLocation();

  // ROUTE SAFETY — update if your paths differ
  const LOGIN_ROUTE = "/auth";

  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const autoTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const goTo = (i: number) =>
    setIndex((prev) => (i + slides.length) % slides.length);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  // Auto-advance (paused on hover/touch/hidden tab; disabled if reduced-motion)
  useEffect(() => {
    if (!SHOW_CAROUSEL || prefersReducedMotion) return;

    const start = () => {
      stop();
      autoTimer.current = window.setInterval(() => {
        setIndex((i) => (i + 1) % slides.length);
      }, 5000);
    };
    const stop = () => {
      if (autoTimer.current) {
        clearInterval(autoTimer.current);
        autoTimer.current = null;
      }
    };

    start();

    const el = containerRef.current;
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (el) {
      const pause = () => stop();
      const resume = () => start();
      el.addEventListener("mouseenter", pause);
      el.addEventListener("mouseleave", resume);
      el.addEventListener("touchstart", pause, { passive: true });
      el.addEventListener("touchend", resume);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        el.removeEventListener("mouseenter", pause);
        el.removeEventListener("mouseleave", resume);
        el.removeEventListener("touchstart", pause as any);
        el.removeEventListener("touchend", resume);
        document.removeEventListener("visibilitychange", onVisibility);
        stop();
      };
    }

    return () => {
      stop();
    };
  }, [prefersReducedMotion]);

  // Keyboard arrows (only if carousel is shown)
  useEffect(() => {
    if (!SHOW_CAROUSEL) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Touch swipe (only if carousel is shown)
  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (!SHOW_CAROUSEL) return;
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (!SHOW_CAROUSEL) return;
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    if (!SHOW_CAROUSEL) return;
    const threshold = 40;
    if (touchDeltaX.current > threshold) prev();
    else if (touchDeltaX.current < -threshold) next();
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  const signIn = () => {
    // Route to auth page for sign-in
    setLocation("/auth");
  };

  const createAccount = () => {
    // Route to auth page for account creation
    setLocation("/auth");
  };

  const testerQuickAccess = () => {
    // Auto-login as tester - bypass sign in (for testing only)
    const testUser = {
      id: "tester-123",
      email: "tester@myperfectmeals.com",
      name: "Tester",
      entitlements: ["premium", "ultimate"], // Give testers full access
      planLookupKey: "mpm_ultimate_monthly",
    };
    
    // Set auth token so AuthContext recognizes this as a real logged-in user
    setAuthToken("tester-token-123");
    
    localStorage.setItem("mpm_current_user", JSON.stringify(testUser));
    localStorage.setItem("userId", testUser.id);
    localStorage.setItem("isAuthenticated", "true");

    // Clear coachMode to ensure WelcomeGate shows
    localStorage.removeItem("coachMode");

    // After test login, go to root which will show WelcomeGate
    console.log("🧪 Tester logged in - redirecting to WelcomeGate");
    setLocation("/");
  };

  // 🎨 SIMPLE LAYOUT (Option 2 - Minimal Plus without trust indicator)
  if (!SHOW_CAROUSEL) {
    return (
      <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/assets/MPMFlameChefLogo.png"
            alt="My Perfect Meals Logo"
            className="h-40 w-auto mx-auto"
          />
        </div>

        {/* Business Name */}
        <h1 className="text-2xl md:text-2xl font-bold text-center mb-3">
          My Perfect Meals
        </h1>

        {/* Value Proposition */}
        <p className="text-md md:text-xl text-white/80 text-center mb-6 max-w-md">
          Healthy Meal Planning
        </p>

        {/* Emotion AI Badge - Styled to be visible */}
        <div className="mb-12 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-black via-orange-600 to-black rounded-2xl border border-orange-400/30 shadow-lg">
            <div className="w-2 h-2 bg-orange-400 rounded-2xl animate-pulse"></div>
            <span className="text-white font-semibold text-sm">
              Powered by Emotion AI
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-sm space-y-4">
          <Button
            data-testid="button-signin"
            onClick={signIn}
            className="w-full h-14 text-md font-medium rounded-2xl
                     bg-white/10 hover:bg-white/20 backdrop-blur-md
                     border border-white/20 text-white
                     transition-all duration-200"
          >
            Sign In
          </Button>

          <Button
            data-testid="button-createaccount"
            onClick={createAccount}
            className="w-full h-14 text-md font-medium rounded-2xl
            bg-gradient-to-r from-black via-orange-600 to-black rounded-2xl border border-orange-400/30
                     text-white shadow-lg
                     transition-all duration-200"
          >
            Create Account
          </Button>
        </div>

        {/* Forgot Password Link */}
        <button
          data-testid="link-forgotpassword"
          onClick={() => setLocation("/forgot-password")}
          className="mt-8 text-sm text-white/60 hover:text-white/90 underline transition-colors"
        >
          Forgot Password?
        </button>

        {/* Tester Quick Access - DEV ONLY */}
        {import.meta.env.DEV && (
          <div className="mt-8 pt-8 border-t border-white/10 space-y-3">
            <Button
              data-testid="button-tester-access"
              onClick={testerQuickAccess}
              className="w-full h-12 text-base font-semibold rounded-xl
              bg-gradient-to-r from-black via-orange-600 to-black rounded-2xl border border-orange-400/30
                       text-white shadow-lg
                       transition-all duration-200"
            >
              🧪 Testers - Quick Access to App
            </Button>

            <Button
              data-testid="button-onboarding-direct"
              onClick={() => {
                console.log(
                  "🔧 Dev: Setting up test user and navigating to onboarding",
                );

                // Set up minimal test user to bypass auth guards
                const testUser = {
                  id: "onboarding-tester-" + Date.now(),
                  email: "onboarding@test.com",
                  name: "Onboarding Tester",
                };
                localStorage.setItem(
                  "mpm_current_user",
                  JSON.stringify(testUser),
                );
                localStorage.setItem("userId", testUser.id);
                localStorage.setItem("isAuthenticated", "true");

                // Small delay to ensure localStorage is written
                setTimeout(() => {
                  console.log("🔧 Dev: Auth set, now navigating to /onboarding");
                  setLocation("/onboarding");
                }, 50);
              }}
              className="w-full h-12 text-base font-semibold rounded-xl
                       bg-blue-600/80 hover:bg-blue-500
                       text-white shadow-lg
                       transition-all duration-200"
            >
              📋 Go to Onboarding (Dev/Test)
            </Button>

            <p className="text-xs text-white/50 text-center mt-2">
              For testing only - bypasses sign in
            </p>
          </div>
        )}
      </div>
    );
  }

  // 🎠 CAROUSEL LAYOUT (Original - Flagged off by default)
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-neutral-700 via-black to-black text-white flex flex-col items-center overflow-x-hidden">
      <header className="w-full max-w-xl text-center pt-8 px-4">
        <p className="text-sm tracking-widest uppercase text-neutral-300">
          Welcome to
        </p>

        <h1 className="text-2xl font-bold mt-1">My Perfect Meals</h1>

        {/* Tagline (kept, tightened punctuation) */}
        <p className="text-base text-neutral-300 mt-2">
          Healthy Meals. Every Time. Everywhere.
        </p>

        {/* Core identity line (new) */}
        <p className="text-sm text-neutral-400 mt-2">
          The{" "}
          <span className="font-semibold">
            First-Generation Smart Nutrition App
          </span>{" "}
          you can depend on.
        </p>

        {/* Personalization line */}
        <p className="text-sm text-neutral-400 mt-2">
          Meals created specifically for you and your lifestyle.
        </p>
      </header>

      {/* Carousel */}
      <section className="w-full flex justify-center mt-8 px-4">
        <div
          ref={containerRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Feature highlights"
          className="relative w-4/5 sm:w-3/4 md:w-2/3 aspect-[2/3] overflow-hidden rounded-2xl shadow-2xl border border-white/10"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {slides.map((s, i) => (
            <div
              key={s.id}
              className="absolute inset-0 transition-transform duration-500 ease-out will-change-transform"
              style={{ transform: `translateX(${(i - index) * 100}%)` }}
              aria-hidden={i !== index}
            >
              <img
                src={s.image}
                alt={s.title}
                className="h-full w-full object-cover object-center select-none pointer-events-none"
                draggable={false}
                loading={i === 0 ? "eager" : "lazy"}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 md:p-6">
                <h3 className="text-xl md:text-2xl font-bold drop-shadow">
                  {s.title}
                </h3>
                <p className="text-sm md:text-base text-neutral-200">
                  {s.subtitle}
                </p>
              </div>
            </div>
          ))}

          {/* Prev / Next */}
          <button
            aria-label="Previous slide"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 backdrop-blur px-2 py-2 rounded-full border border-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Next slide"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 backdrop-blur px-2 py-2 rounded-full border border-white/10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Dots */}
      <div
        className="flex items-center justify-center gap-2 mt-6"
        aria-label="Slide navigation"
      >
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            className={`transition-all rounded-full ${
              i === index
                ? "scale-110 bg-white"
                : "bg-white/50 hover:bg-white/70"
            }`}
            style={{
              width: "10px",
              height: "10px",
              minWidth: "10px",
              minHeight: "10px",
            }}
          />
        ))}
      </div>

      {/* CTAs */}
      <div className="w-full max-w-xl grid grid-cols-1 gap-3 mt-4 px-4 pb-16">
        <Button
          variant="outline"
          onClick={signIn}
          className="h-12 text-base font-semibold rounded-xl border-white/80 bg-white/5 hover:bg-white/50 text-white"
        >
          Sign in
        </Button>
        <Button
          variant="secondary"
          onClick={createAccount}
          className="h-12 text-base font-semibold rounded-xl bg-emerald-800 hover:bg-emerald-500 text-white"
        >
          Create Account
        </Button>
      </div>

      <p className="text-xs text-neutral-400 mb-8 px-6 text-center">
        Swipe on mobile • Click arrows on desktop • Auto-advances every 5s
      </p>
    </div>
  );
}
