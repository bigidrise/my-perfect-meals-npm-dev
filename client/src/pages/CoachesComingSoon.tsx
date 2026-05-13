import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

type AvailabilityStatus = "available" | "unavailable";

type Coach = {
  id: string;
  name: string;
  title?: string;
  credentials?: string;
  image: string;
  bio: string;
  availabilityStatus: AvailabilityStatus;
  availableDate?: string;
  isFounder?: boolean;
  isCMCO?: boolean;
  isVeteran?: boolean;
  isPlaceholder?: boolean;
  lookupName?: string;
};

const FOUNDER_BIO =
  "I have spent over 25 years helping people transform their bodies, their health, and the way they live.\n\nMy background is built on real-world experience and discipline—from serving in the United States Air Force and working in critical care as an EMT, to competing as a professional bodybuilder and earning the Mr. USA title in 2002. I have also spent years in front of the camera, hosting a daily fitness segment where I taught practical, results-driven strategies to a broad audience.\n\nOver the years, I have worked with hundreds of clients, helping people lose significant weight, rebuild strength, and take control of their health in a way that fits their life.\n\nMy approach is simple: results come from consistency, not restriction. I do not believe in forcing people into rigid diets that do not match how they live. Instead, I focus on helping people make smarter decisions within the foods they already enjoy—so they can stay consistent, see results, and maintain them long term.\n\nThat philosophy is what led me to build My Perfect Meals—an AI-powered coaching system designed to guide real food decisions in real time. It is an extension of the same system I have used for years, now structured in a way that allows more people to experience it.\n\nMy goal is to help you build strength, move with confidence, and create a way of eating that works in the real world—not just for a few weeks, but for life.";

const MONICA_BIO =
  "Monica Brant is an internationally recognized fitness icon, world champion, coach, and motivational leader whose influence has shaped the fitness industry for more than three decades. Known worldwide for her authenticity, discipline, faith, and longevity in health and wellness, Monica has appeared on more than 130 magazine covers since first rising to prominence on the cover of Muscle & Fitness magazine in 1994.\n\nThroughout her legendary competitive career, she earned multiple top placements at the Olympia and Arnold Festival stages and captured three world championship titles, including the IFBB Fitness Olympia Championship in 1998 and two WBFF World Championships in 2010 and 2013, before finishing her final competition season with an overall victory in the United Kingdom in 2016.\n\nBeyond competition, Monica has continued to inspire people around the world through coaching, consulting, speaking engagements, and faith-driven wellness leadership focused on helping individuals strengthen themselves physically, mentally, and spiritually. From Spartan races and Masters track events to decades of hands-on coaching experience, Monica continues to lead by example with a lifestyle centered around resilience, purpose, and sustainable health.\n\nThrough My Perfect Meals, Monica brings her decades of experience, encouragement, and real-world fitness wisdom to help clients build confidence, consistency, strength, and a healthier relationship with both food and life.";

const DANIELLE_BIO =
  "Danielle Affatato is a certified nutrition and fitness coach whose practice is built on accountability, consistency, and real-life application.\n\nHer coaching philosophy centers on meeting clients where they are — helping them build sustainable habits, understand how to fuel their body, and develop the discipline that creates lasting change. Danielle works especially well with clients who have struggled with all-or-nothing thinking, helping them find structure that fits how they actually live.\n\nShe specializes in body composition, macro-based nutrition, and behavioral habit-building — combining practical meal guidance with the mindset coaching that keeps people consistent when motivation fades.\n\nAt My Perfect Meals, Danielle focuses on helping clients turn the AI-generated meal guidance into a daily practice that sticks.";

const CHEF_LOGO = "/icons/MPMFlameChefLogo.jpg";

const coaches: Coach[] = [
  {
    id: "idrise",
    name: "Coach Idrise (Nutrition Coach & Behavior Change Coach)",
    title: "Founder",
    credentials: "NASM-CPT · WFS · CNC · BCS",
    image: "/assets/idrise-coach.png",
    bio: FOUNDER_BIO,
    availabilityStatus: "available",
    isFounder: true,
    lookupName: "Idrise",
  },
  {
    id: "monica",
    name: "Monica Brant (Body Composition & Elite Performance)",
    title: "Elite Coach",
    credentials: "IFBB Fitness World Champion · 30+ Years Coaching",
    image: "/assets/monica-brant-coach.png",
    bio: MONICA_BIO,
    availabilityStatus: "available",
    isVeteran: true,
    lookupName: "Monica",
  },
  {
    id: "kristen",
    name: "Kristen Bogan (Performance & Nutrition)",
    title: "Founding Coach",
    credentials: "CPT · Corrective Exercise · Strength & Recovery",
    image: "/assets/kristen-bogan-2.jpg",
    bio: "I help clients build strength, lose weight, and recover safely from injury or surgery through structured, real-world training.\n\nMy approach is rooted in functional movement and lifestyle-based coaching—focusing on improving how your body moves so everyday life feels easier, safer, and more controlled.\n\nWith a background in muscle development and corrective exercise, I design programs that enhance mobility, stability, and overall body mechanics. Whether your goal is to move without pain, build confidence in your strength, or simply feel better day to day, everything is built to support how you live.\n\nRecovery and longevity are at the core of my philosophy. My goal is to help you develop the strength, confidence, and resilience to perform at your best—both in and out of the gym.",
    availabilityStatus: "available",
    lookupName: "Kristen",
  },
  {
    id: "danielle",
    name: "Danielle Affatato (Nutrition & Habit Coaching)",
    title: "Nutrition Coach",
    credentials: "Certified Nutrition Coach · Macro Strategy · Habit-Based Coaching",
    image: "/assets/danielle-affatato.jpg",
    bio: DANIELLE_BIO,
    availabilityStatus: "available",
    lookupName: "Danielle",
  },
  {
    id: "placeholder-3",
    name: "Coming Soon",
    image: CHEF_LOGO,
    bio: "",
    availabilityStatus: "unavailable",
    isPlaceholder: true,
  },
  {
    id: "placeholder-4",
    name: "Coming Soon",
    image: CHEF_LOGO,
    bio: "",
    availabilityStatus: "unavailable",
    isPlaceholder: true,
  },
];

const DEFAULT_AGREED = {
  conduct: false,
  expectations: false,
  nonMedical: false,
  conversationPrivacy: false,
};

export default function MeetYourCoach() {
  const [, setLocation] = useLocation();
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [agreed, setAgreed] = useState(DEFAULT_AGREED);

  const [liveCoaches, setLiveCoaches] = useState<Coach[]>(coaches);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/professionals/providers"), {
          headers: { ...getAuthHeaders() },
          credentials: "include",
        });
        if (!res.ok) return;
        const json: { providers: Array<{
          firstName?: string;
          lastName?: string;
          professionalRole?: string;
          availabilityStatus?: string;
          backAt?: string | null;
        }> } = await res.json();
        const data = json.providers ?? [];

        const applyLiveStatus = (
          c: Coach,
          provider: { availabilityStatus?: string; backAt?: string | null },
        ): Coach => {
          const liveStatus = provider.availabilityStatus;
          return {
            ...c,
            availabilityStatus: liveStatus === "available" ? "available" : "unavailable",
            availableDate:
              (liveStatus === "busy" || liveStatus === "away") && provider.backAt
                ? new Date(provider.backAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : undefined,
          };
        };

        setLiveCoaches((prev) =>
          prev.map((c) => {
            if (!c.lookupName || c.isPlaceholder) return c;
            const match = data.find(
              (p) => p.firstName?.toLowerCase() === c.lookupName!.toLowerCase(),
            );
            if (match) return applyLiveStatus(c, match);
            return c;
          }),
        );
      } catch {}
    })();
  }, []);

  const allChecked = Object.values(agreed).every(Boolean);

  const handleCardTap = (coach: Coach) => {
    if (coach.isPlaceholder) return;
    setAgreed(DEFAULT_AGREED);
    setSelectedCoach(coach);
  };

  const handleSheetClose = (open: boolean) => {
    if (!open) {
      setAgreed(DEFAULT_AGREED);
      setSelectedCoach(null);
    }
  };

  const toggleAgreed = (key: keyof typeof agreed) => {
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white px-4 pb-6"
      style={{ paddingTop: "max(24px, env(safe-area-inset-top))" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          onClick={() => setLocation("/dashboard")}
          className="bg-white/10 border border-white/20 text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Professional Team</h1>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-2 gap-3">
        {liveCoaches.map((coach) => (
          <div
            key={coach.id}
            onClick={() => handleCardTap(coach)}
            className={`bg-black/70 border border-white/10 rounded-2xl overflow-hidden transition-transform ${
              coach.isPlaceholder
                ? "opacity-50 cursor-default"
                : "cursor-pointer active:scale-95"
            }`}
          >
            {/* Square image with overlay */}
            <div className="relative w-full">
              <img
                src={coach.image}
                alt={coach.name}
                className={`w-full aspect-square object-cover ${
                  coach.isPlaceholder ? "object-center p-4" : "object-top"
                }`}
              />
              {!coach.isPlaceholder && (
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
                  Tap to view
                </div>
              )}
              {coach.isFounder && (
                <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow">
                  Founder
                </div>
              )}
              {coach.isVeteran && (
                <div className="absolute top-1.5 left-1.5 bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow">
                  30+ Yrs
                </div>
              )}
              {coach.isCMCO && (
                <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[9px] px-1.5 py-1 rounded-lg font-semibold shadow leading-tight max-w-[80%]">
                  Chief Medical Officer
                </div>
              )}
            </div>

            <div className="p-2.5">
              <p className="font-semibold text-sm leading-tight line-clamp-2">
                {coach.name}
              </p>
              {coach.credentials && (
                <p className="text-[10px] text-white/60 mt-0.5 leading-tight">
                  {coach.credentials}
                </p>
              )}
              {!coach.isPlaceholder && (
                <p
                  className={`text-[11px] mt-1 ${coach.availabilityStatus === "available" ? "text-green-400" : "text-white/50"}`}
                >
                  {coach.availabilityStatus === "available"
                    ? "Available now"
                    : coach.availableDate
                      ? `Returns ${coach.availableDate}`
                      : "Unavailable"}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Sheet */}
      <Sheet open={!!selectedCoach} onOpenChange={handleSheetClose}>
        <SheetContent
          side="bottom"
          className="bg-zinc-950 border-t border-white/10 text-white rounded-t-3xl max-h-[92vh] overflow-y-auto p-0"
        >
          {selectedCoach && (
            <div
              className="max-w-lg mx-auto px-5 pb-8"
              style={{ paddingTop: "max(24px, env(safe-area-inset-top))" }}
            >
              {/* Photo */}
              <div
                className="w-full bg-black/40 rounded-xl mb-4 overflow-hidden flex items-center justify-center"
                style={{ minHeight: "320px", maxHeight: "420px" }}
              >
                <img
                  src={selectedCoach.image}
                  alt={selectedCoach.name}
                  className="w-full h-full object-contain"
                  style={{ maxHeight: "420px" }}
                />
              </div>

              {/* Name + badge */}
              <h2 className="text-xl font-bold">{selectedCoach.name}</h2>
              {selectedCoach.isFounder && (
                <p className="text-orange-400 text-sm font-medium mt-1">
                  Founder
                </p>
              )}
              {selectedCoach.isVeteran && (
                <p className="text-amber-400 text-sm font-medium mt-1">
                  Elite Coach · 30+ Years Experience
                </p>
              )}
              {selectedCoach.isCMCO && (
                <p className="text-blue-400 text-sm font-medium mt-1">
                  Chief Medical Officer
                </p>
              )}
              {selectedCoach.credentials && (
                <p className="text-white/60 text-xs mt-1 leading-relaxed">
                  {selectedCoach.credentials}
                </p>
              )}

              {/* Bio */}
              <div className="text-sm text-white/80 leading-relaxed mt-3 mb-3 space-y-3">
                {selectedCoach.bio.split("\n\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>

              {/* Availability */}
              {selectedCoach.availabilityStatus === "available" ? (
                <p className="text-green-400 text-sm mb-5">
                  You will be contacted within 24 hours.
                </p>
              ) : (
                <p className="text-white/60 text-sm mb-5">
                  {selectedCoach.availableDate
                    ? `Returns ${selectedCoach.availableDate}. Your plan will begin once they activate your program.`
                    : "This professional is currently unavailable."}
                </p>
              )}

              {/* Agreements */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 space-y-4">
                <p className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-1">
                  Please read and agree to continue
                </p>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed.conduct}
                    onChange={() => toggleAgreed("conduct")}
                    className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className="text-sm text-white/80 leading-snug">
                    <span className="text-white font-medium">
                      Conduct Agreement —{" "}
                    </span>
                    All communication must remain professional and within the
                    platform.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed.expectations}
                    onChange={() => toggleAgreed("expectations")}
                    className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className="text-sm text-white/80 leading-snug">
                    <span className="text-white font-medium">
                      Coaching Expectations —{" "}
                    </span>
                    I understand this is a structured coaching system and I am
                    responsible for following guidance.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed.nonMedical}
                    onChange={() => toggleAgreed("nonMedical")}
                    className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className="text-sm text-white/80 leading-snug">
                    <span className="text-white font-medium">
                      Non-Medical Disclaimer —{" "}
                    </span>
                    I understand this is not medical diagnosis or treatment.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed.conversationPrivacy}
                    onChange={() => toggleAgreed("conversationPrivacy")}
                    className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className="text-sm text-white/80 leading-snug">
                    <span className="text-white font-medium">
                      Conversation Privacy —{" "}
                    </span>
                    I understand that My Perfect Meals does not record, store,
                    or provide transcripts of coach-client conversations.
                    Communication is private between me and my coach, and it is
                    my responsibility to save any information I wish to keep.
                  </span>
                </label>
              </div>

              {!allChecked && (
                <p className="text-xs text-white/40 text-center mb-3">
                  Check all boxes above to continue
                </p>
              )}

              <Button
                disabled={!allChecked}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full font-semibold mb-3"
                onClick={() =>
                  setLocation(`/pricing?coach=${selectedCoach.id}`)
                }
              >
                Continue to Pricing
              </Button>

              <SheetClose asChild>
                <Button className="w-full bg-white/10 hover:bg-white/20 text-white rounded-full">
                  Close
                </Button>
              </SheetClose>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
