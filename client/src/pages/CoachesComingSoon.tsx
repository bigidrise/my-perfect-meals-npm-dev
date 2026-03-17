import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Coach = {
  id: string;
  name: string;
  image: string;
  bio: string;
  available: boolean;
  availableDate?: string;
  isFounder?: boolean;
};

const FOUNDER_BIO =
  "I've spent over 25 years working in performance nutrition, body composition, and structured meal design. My background combines competitive athletics, clinical awareness, and real-world coaching experience. My Perfect Meals was built to remove confusion, eliminate food stress, and help people eat confidently without restriction.";

const coaches: Coach[] = [
  {
    id: "idrise",
    name: "Coach Idrise",
    image: "/assets/founder-photo.jpg",
    bio: FOUNDER_BIO,
    available: true,
    isFounder: true,
  },
];

export default function MeetYourCoach() {
  const [, setLocation] = useLocation();
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);

  const sortedCoaches = [
    ...coaches.filter((c) => c.isFounder),
    ...coaches.filter((c) => !c.isFounder),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white px-4 py-6">

      <div className="flex items-center gap-3 mb-6">
        <Button
          onClick={() => setLocation("/dashboard")}
          className="bg-white/10 border border-white/20 text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Meet Your Coach</h1>
      </div>

      <div className="space-y-4">
        {sortedCoaches.map((coach) => (
          <div
            key={coach.id}
            onClick={() => setSelectedCoach(coach)}
            className="bg-black/70 border border-white/10 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="relative">
              <img
                src={coach.image}
                alt={coach.name}
                className="w-full h-48 object-cover rounded-xl mb-3"
              />
              {coach.isFounder && (
                <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-lg">
                  Founder
                </div>
              )}
            </div>

            <h2 className="font-semibold text-lg">{coach.name}</h2>
            <p className="text-sm text-white/60 mt-1">
              {coach.available ? "Available now" : `Available ${coach.availableDate}`}
            </p>
          </div>
        ))}
      </div>

      {selectedCoach && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end z-50"
          onClick={() => setSelectedCoach(null)}
        >
          <div
            className="bg-black/95 w-full p-5 rounded-t-3xl border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedCoach.image}
              alt={selectedCoach.name}
              className="w-full h-52 object-cover rounded-xl mb-4"
            />

            <h2 className="text-xl font-bold">{selectedCoach.name}</h2>

            {selectedCoach.isFounder && (
              <p className="text-orange-400 text-sm font-medium mt-1 mb-2">
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
                onClick={() => alert("End relationship flow coming next")}
              >
                End
              </Button>
            </div>

            <Button
              className="w-full bg-white/10 hover:bg-white/20 text-white rounded-full"
              onClick={() => setSelectedCoach(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
