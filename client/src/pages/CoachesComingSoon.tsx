import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetClose,
} from "@/components/ui/sheet";

type Coach = {
  id: string;
  name: string;
  image: string;
  bio: string;
  available: boolean;
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
    available: true,
    isFounder: true,
  },
  {
    id: "placeholder-1",
    name: "Coming Soon",
    image: CHEF_LOGO,
    bio: "",
    available: false,
    isPlaceholder: true,
  },
  {
    id: "placeholder-2",
    name: "Coming Soon",
    image: CHEF_LOGO,
    bio: "",
    available: false,
    isPlaceholder: true,
  },
  {
    id: "placeholder-3",
    name: "Coming Soon",
    image: CHEF_LOGO,
    bio: "",
    available: false,
    isPlaceholder: true,
  },
  {
    id: "placeholder-4",
    name: "Coming Soon",
    image: CHEF_LOGO,
    bio: "",
    available: false,
    isPlaceholder: true,
  },
  {
    id: "placeholder-5",
    name: "Coming Soon",
    image: CHEF_LOGO,
    bio: "",
    available: false,
    isPlaceholder: true,
  },
];

export default function MeetYourCoach() {
  const [, setLocation] = useLocation();
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);

  const handleCardTap = (coach: Coach) => {
    if (!coach.isPlaceholder) {
      setSelectedCoach(coach);
    }
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
                : "cursor-pointer active:scale-[0.97]"
            }`}
          >
            {/* Square image */}
            <div className="relative w-full">
              <img
                src={coach.image}
                alt={coach.name}
                className={`w-full aspect-square object-cover ${
                  coach.isPlaceholder ? "object-center p-4" : "object-top"
                }`}
              />
              {coach.isFounder && (
                <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow">
                  Founder
                </div>
              )}
            </div>

            <div className="p-2">
              <p className="font-semibold text-xs leading-tight truncate">{coach.name}</p>
              {!coach.isPlaceholder && (
                <p className="text-[10px] text-green-400 mt-0.5">Available</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Sheet */}
      <Sheet
        open={!!selectedCoach}
        onOpenChange={(open) => { if (!open) setSelectedCoach(null); }}
      >
        <SheetContent
          side="bottom"
          className="bg-zinc-950 border-t border-white/10 text-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[90vh] overflow-y-auto"
        >
          {selectedCoach && (
            <>
              <img
                src={selectedCoach.image}
                alt={selectedCoach.name}
                className="w-full h-56 object-cover object-top rounded-xl mb-4"
              />

              <h2 className="text-xl font-bold">{selectedCoach.name}</h2>

              {selectedCoach.isFounder && (
                <p className="text-orange-400 text-sm font-medium mt-1 mb-3">
                  Founder
                </p>
              )}

              <p className="text-sm text-white/80 leading-relaxed mb-3">
                {selectedCoach.bio}
              </p>

              <p className="text-green-400 text-sm mb-5">
                You will be contacted within 24 hours.
              </p>

              <div className="flex gap-3 mb-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-full font-semibold"
                  onClick={() => setLocation(`/pricing?coach=${selectedCoach.id}`)}
                >
                  Hire Coach
                </Button>

                <Button
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold"
                  onClick={() => alert("End relationship coming soon")}
                >
                  End
                </Button>
              </div>

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
