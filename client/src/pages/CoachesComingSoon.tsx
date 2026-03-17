import { useState } from "react";
import { useLocation } from "wouter";
import { Users, ArrowLeft } from "lucide-react";
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

export default function MeetYourCoach() {
  const [, setLocation] = useLocation();
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);

  const coaches: Coach[] = [
    {
      id: "idris",
      name: "Coach Idris",
      image: "/images/founder-idris.png", // use your real image path
      bio: "Founder of My Perfect Meals. Performance nutrition coach focused on real-world sustainable eating and long-term results.",
      available: true,
      isFounder: true,
    },
  ];

  const sortedCoaches = [
    ...coaches.filter((c) => c.isFounder),
    ...coaches.filter((c) => !c.isFounder),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white px-4 py-6">

      {/* HEADER */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          onClick={() => setLocation("/dashboard")}
          className="bg-white/10 border border-white/20 text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <h1 className="text-xl font-bold">Meet Your Coach</h1>
      </div>

      {/* COACH LIST */}
      <div className="space-y-4">
        {sortedCoaches.map((coach) => (
          <div
            key={coach.id}
            onClick={() => setSelectedCoach(coach)}
            className="bg-black/70 border border-white/10 rounded-2xl p-4 cursor-pointer"
          >
            <div className="relative">
              <img
                src={coach.image}
                className="w-full h-40 object-cover rounded-xl mb-3"
              />

              {coach.isFounder && (
                <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-lg">
                  Founder
                </div>
              )}
            </div>

            <h2 className="font-semibold text-lg">{coach.name}</h2>

            <p className="text-sm text-white/60 mt-1">
              {coach.available
                ? "Available now"
                : `Available ${coach.availableDate}`}
            </p>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {selectedCoach && (
        <div className="fixed inset-0 bg-black/70 flex items-end">
          <div className="bg-black/95 w-full p-5 rounded-t-3xl border-t border-white/10">

            <img
              src={selectedCoach.image}
              className="w-full h-48 object-cover rounded-xl mb-4"
            />

            <h2 className="text-lg font-bold mb-2">
              {selectedCoach.name}
            </h2>

            {selectedCoach.isFounder && (
              <p className="text-orange-400 text-sm mb-2">
                Founder Coach
              </p>
            )}

            <p className="text-sm text-white/80 mb-4">
              {selectedCoach.bio}
            </p>

            {selectedCoach.available ? (
              <p className="text-green-400 text-sm mb-3">
                You will be contacted within 24 hours.
              </p>
            ) : (
              <p className="text-yellow-400 text-sm mb-3">
                Available {selectedCoach.availableDate}. You can reserve now.
              </p>
            )}

            {/* 🔥 PILL BUTTONS */}
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-full"
                onClick={() =>
                  setLocation(`/pricing?coach=${selectedCoach.id}`)
                }
              >
                Hire Coach
              </Button>

              <Button
                className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-full"
                onClick={() => setSelectedCoach(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}