import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetClose,
} from "@/components/ui/sheet";

type AvailabilityStatus = "available" | "unavailable";

type Coach = {
  id: string;
  name: string;
  image: string;
  bio: string;
  availabilityStatus: AvailabilityStatus;
  availableDate?: string;
  isFounder?: boolean;
  isPlaceholder?: boolean;
};

const FOUNDER_BIO =
  "I've spent over 25 years working in performance nutrition, body composition, and structured meal design. My background combines competitive athletics, clinical awareness, and real-world coaching experience. My Perfect Meals was built to remove confusion, eliminate food stress, and help people eat confidently without restriction.";

const CHEF_LOGO = "/assets/MPMFlameChefLogo.png";

const coaches: Coach[] = [
  {
    id: "idrise",
    name: "Founder–Coach Idrise",
    image: "/assets/founder-photo.jpg",
    bio: FOUNDER_BIO,
    availabilityStatus: "available",
    isFounder: true,
  },
  { id: "placeholder-1", name: "Coming Soon", image: CHEF_LOGO, bio: "", availabilityStatus: "unavailable", isPlaceholder: true },
  { id: "placeholder-2", name: "Coming Soon", image: CHEF_LOGO, bio: "", availabilityStatus: "unavailable", isPlaceholder: true },
  { id: "placeholder-3", name: "Coming Soon", image: CHEF_LOGO, bio: "", availabilityStatus: "unavailable", isPlaceholder: true },
  { id: "placeholder-4", name: "Coming Soon", image: CHEF_LOGO, bio: "", availabilityStatus: "unavailable", isPlaceholder: true },
  { id: "placeholder-5", name: "Coming Soon", image: CHEF_LOGO, bio: "", availabilityStatus: "unavailable", isPlaceholder: true },
];

const DEFAULT_AGREED = { conduct: false, expectations: false, nonMedical: false };

export default function MeetYourCoach() {
  const [, setLocation] = useLocation();
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [agreed, setAgreed] = useState(DEFAULT_AGREED);

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
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          onClick={() => setLocation("/dashboard")}
          className="bg-white/10 border border-white/20 text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Meet Your Coach</h1>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-2">
        {coaches.map((coach) => (
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
            </div>

            <div className="p-2">
              <p className="font-semibold text-xs leading-tight truncate">{coach.name}</p>
              {!coach.isPlaceholder && (
                <p className={`text-[10px] mt-0.5 ${coach.availabilityStatus === "available" ? "text-green-400" : "text-white/50"}`}>
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
          className="bg-zinc-950 border-t border-white/10 text-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[92vh] overflow-y-auto"
        >
          {selectedCoach && (
            <>
              {/* Coach photo */}
              <img
                src={selectedCoach.image}
                alt={selectedCoach.name}
                className="w-full h-52 object-cover object-top rounded-xl mb-4"
              />

              {/* Name + badge */}
              <h2 className="text-xl font-bold">{selectedCoach.name}</h2>
              {selectedCoach.isFounder && (
                <p className="text-orange-400 text-sm font-medium mt-1">Founder</p>
              )}

              {/* Bio */}
              <p className="text-sm text-white/80 leading-relaxed mt-3 mb-3">
                {selectedCoach.bio}
              </p>

              {/* Availability */}
              {selectedCoach.availabilityStatus === "available" ? (
                <p className="text-green-400 text-sm mb-5">
                  You will be contacted within 24 hours.
                </p>
              ) : (
                <p className="text-white/60 text-sm mb-5">
                  {selectedCoach.availableDate
                    ? `Coach will return on ${selectedCoach.availableDate}. Your plan will begin once they activate your program.`
                    : "This coach is currently unavailable."}
                </p>
              )}

              {/* Agreements */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 space-y-4">
                <p className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-1">
                  Please read and agree to continue
                </p>

                {/* Conduct */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed.conduct}
                    onChange={() => toggleAgreed("conduct")}
                    className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className="text-sm text-white/80 leading-snug">
                    <span className="text-white font-medium">Conduct Agreement — </span>
                    All communication must remain professional and within the platform.
                  </span>
                </label>

                {/* Expectations */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed.expectations}
                    onChange={() => toggleAgreed("expectations")}
                    className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className="text-sm text-white/80 leading-snug">
                    <span className="text-white font-medium">Coaching Expectations — </span>
                    I understand this is a structured coaching system and I am responsible for following guidance.
                  </span>
                </label>

                {/* Non-medical */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed.nonMedical}
                    onChange={() => toggleAgreed("nonMedical")}
                    className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className="text-sm text-white/80 leading-snug">
                    <span className="text-white font-medium">Non-Medical Disclaimer — </span>
                    I understand this is not medical diagnosis or treatment.
                  </span>
                </label>
              </div>

              {/* Gate hint */}
              {!allChecked && (
                <p className="text-xs text-white/40 text-center mb-3">
                  Check all boxes above to continue
                </p>
              )}

              {/* Continue button */}
              <Button
                disabled={!allChecked}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full font-semibold mb-3"
                onClick={() => setLocation(`/pricing?coach=${selectedCoach.id}`)}
              >
                Continue to Pricing
              </Button>

              {/* Close */}
              <SheetClose asChild>
                <Button className="w-full bg-white/10 hover:bg-white/20 text-white rounded-full">
                  Close
                </Button>
              </SheetClose>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
