import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles, LogIn, X, ArrowLeft, UserPlus, Stethoscope, User } from "lucide-react";
import { bustImageCache } from "@/utils/imageCache";
import { startGuestSession, endGuestSession } from "@/lib/guestMode";
import { motion, AnimatePresence } from "framer-motion";
import { getAuthToken } from "@/lib/auth";

const SHOW_CAROUSEL = false;

const APPLE_REVIEW_MODE = false;

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

type ModalStep = "choose" | "account-type";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>("choose");

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

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      setLocation("/dashboard");
    }
  }, [setLocation]);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const goTo = (i: number) =>
    setIndex((prev) => (i + slides.length) % slides.length);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

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

  useEffect(() => {
    if (!SHOW_CAROUSEL) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const openModal = () => {
    localStorage.removeItem("appleReviewFullAccess");
    setModalStep("choose");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalStep("choose");
  };

  const exploreAsGuest = () => {
    localStorage.removeItem("appleReviewFullAccess");
    startGuestSession();
    setLocation("/guest-builder");
  };

  const handleSignIn = () => {
    closeModal();
    setLocation("/auth");
  };

  const handleRegularSignUp = () => {
    closeModal();
    setLocation("/consumer-welcome");
  };

  const handleProfessionalSignUp = () => {
    closeModal();
    setLocation("/procare-welcome");
  };

  const renderModal = () => (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <motion.div
            key={modalStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm mx-6"
          >
            <div className="relative rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
              {modalStep === "choose" && (
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 active:scale-[0.98] transition-transform"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-white/60" />
                </button>
              )}

              {modalStep === "account-type" && (
                <button
                  onClick={() => setModalStep("choose")}
                  className="absolute top-4 left-4 p-1.5 rounded-full bg-white/10 active:scale-[0.98] transition-transform"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4 text-white/60" />
                </button>
              )}

              {modalStep === "account-type" && (
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 active:scale-[0.98] transition-transform"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-white/60" />
                </button>
              )}

              {modalStep === "choose" ? (
                <div className="space-y-5 pt-2">
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white mb-1">Welcome</h2>
                    <p className="text-white/50 text-sm">How would you like to start?</p>
                  </div>

                  <button
                    onClick={handleSignIn}
                    className="w-full p-4 rounded-xl bg-white/5 border border-white/10 active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-500/20">
                        <LogIn className="h-5 w-5 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-base">Sign In</h3>
                        <p className="text-white/50 text-sm mt-0.5">I already have an account</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setModalStep("account-type")}
                    className="w-full p-4 rounded-xl bg-white/5 border border-white/10 active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/20">
                        <UserPlus className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-base">Create Account</h3>
                        <p className="text-white/50 text-sm mt-0.5">I'm new here</p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-5 pt-2">
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white mb-1">Create Account</h2>
                    <p className="text-white/50 text-sm">What type of account?</p>
                  </div>

                  <button
                    onClick={handleRegularSignUp}
                    className="w-full p-4 rounded-xl bg-white/5 border border-white/10 active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-lime-500/20 border border-lime-500/20">
                        <User className="h-5 w-5 text-lime-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-base">Regular Sign Up</h3>
                        <p className="text-white/50 text-sm mt-0.5">Personal meal planning</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleProfessionalSignUp}
                    className="w-full p-4 rounded-xl bg-white/5 border border-white/10 active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/20">
                        <Stethoscope className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-base">Professional Sign Up</h3>
                        <p className="text-white/50 text-sm mt-0.5">Trainer, coach, or physician</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!SHOW_CAROUSEL) {
    return (
      <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
        {renderModal()}

        <div className="mb-8">
          <img
            src="/assets/MPMFlameChefLogo.png"
            alt="My Perfect Meals Logo"
            className="h-40 w-auto mx-auto"
          />
        </div>

        <h1 className="text-2xl md:text-2xl font-bold text-center mb-3">
          My Perfect Meals
        </h1>

        <p className="text-md md:text-xl text-white/80 text-center mb-6 max-w-md">
          Healthy Meal Planning
        </p>

        <div className="mb-12 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-black via-orange-600 to-black rounded-2xl border border-orange-400/30 shadow-lg">
            <div className="w-2 h-2 bg-orange-400 rounded-2xl animate-pulse"></div>
            <span className="text-white font-semibold text-sm">
              Powered by Emotion AI
            </span>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <Button
            data-testid="button-signin"
            onClick={openModal}
            className="w-full h-14 text-md font-medium rounded-2xl
            bg-gradient-to-r from-black to-black rounded-2xl border border-orange-400/30
                     text-white shadow-lg
                     transition-all duration-200 flex items-center justify-center gap-2"
          >
            <LogIn className="h-5 w-5" />
            Sign In / Create Account
          </Button>

          <Button
            data-testid="button-explore-guest"
            onClick={exploreAsGuest}
            className="w-full h-14 text-md font-medium rounded-2xl
            bg-gradient-to-r from-black via-lime-600 to-black
                     text-white shadow-lg border border-lime-400/30
                     transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Sparkles className="h-5 w-5" />
            Visit App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-neutral-700 via-black to-black text-white flex flex-col items-center overflow-x-hidden">
      {renderModal()}

      <header className="w-full max-w-xl text-center pt-8 px-4">
        <p className="text-sm tracking-widest uppercase text-neutral-300">
          Welcome to
        </p>

        <h1 className="text-2xl font-bold mt-1">My Perfect Meals</h1>

        <p className="text-base text-neutral-300 mt-2">
          Healthy Meals. Every Time. Everywhere.
        </p>

        <p className="text-sm text-neutral-400 mt-2">
          The{" "}
          <span className="font-semibold">
            First-Generation Smart Nutrition App
          </span>{" "}
          you can depend on.
        </p>

        <p className="text-sm text-neutral-400 mt-2">
          Meals created specifically for you and your lifestyle.
        </p>
      </header>

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

          <button
            aria-label="Previous slide"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur px-2 py-2 rounded-full border border-white/10 active:scale-[0.98] transition-transform"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Next slide"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur px-2 py-2 rounded-full border border-white/10 active:scale-[0.98] transition-transform"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </section>

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
                : "bg-white/50"
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

      <div className="w-full max-w-xl grid grid-cols-1 gap-3 mt-4 px-4 pb-16">
        <Button
          variant="outline"
          onClick={openModal}
          className="h-12 text-base font-semibold rounded-xl border-white/80 bg-white/5 text-white active:scale-[0.98] transition-transform"
        >
          Sign In
        </Button>
      </div>

      <p className="text-xs text-neutral-400 mb-8 px-6 text-center">
        Swipe on mobile • Click arrows on desktop • Auto-advances every 5s
      </p>
    </div>
  );
}
