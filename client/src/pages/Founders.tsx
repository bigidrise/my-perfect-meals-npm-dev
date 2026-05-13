import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

// ─────────────────────────────────────────────────────────────
// FOUNDING COACHES LIST
// To add a new founding coach, just add an entry here.
// photo: path under /assets/ — leave null if not yet available.
// credentials: short tag line (certifications, specialty, etc.)
// bio: leave null to show "Bio coming soon."
// ─────────────────────────────────────────────────────────────
const FOUNDING_COACHES: {
  name: string;
  title: string;
  credentials: string;
  photo: string | null;
  bio: string | null;
}[] = [
  {
    name: "Kristen Bogan",
    title: "Founding Coach",
    credentials: "CPT · Corrective Exercise · Strength & Recovery",
    photo: "/assets/kristen-bogan-2.jpg",
    bio: "As a dedicated personal trainer, Kristen specializes in helping clients build strength, lose weight, and recover safely and effectively from surgery or injury. Her approach is rooted in functional and lifestyle-based training focusing on movements that make everyday life easier, safer, and more enjoyable. With a background in muscle development and corrective exercise, she designs programs that improve mobility, stability, and overall body mechanics. Recovery and longevity are at the core of her philosophy empowering clients with the strength, confidence, and resilience to thrive in both the gym and everyday life.",
  },
  {
    name: "Danielle Affatato",
    title: "Founding Coach",
    credentials:
      "Certified Nutrition Coach · Macro Strategy · Habit-Based Coaching",
    photo: "/assets/danielle-affatato.jpg",
    bio: null,
  },

  // ── Add new founding coaches below this line ──
  // {
  //   name: "First Last",
  //   title: "Founding Coach",
  //   credentials: "Certifications · Specialty",
  //   photo: "/assets/their-photo.jpg",
  //   bio: "Their bio here.",
  // },
];

export default function Founder() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pt-0 pb-24">
      {/* Safe Area Header with Title */}
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/10 backdrop-blur-none border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              onClick={() => setLocation("/dashboard")}
              className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>

            <h1 className="text-lg font-bold text-white">Founders</h1>
          </div>
        </div>
      </MobileHeaderGuard>

      {/* Main Content */}
      <div
        className="max-w-5xl mx-auto px-4 text-white space-y-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* FOUNDER HERO */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-36 h-48 overflow-hidden rounded-xl ring-1 ring-white/20 shadow-lg">
              <img
                src="/assets/founder-photo.jpg"
                alt="Coach Idrise"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-4 text-center md:text-left">
              <h1 className="text-3xl font-bold">Coach Idrise</h1>

              <p className="text-orange-400 font-medium">
                CEO / Founder & Lead Coach
              </p>

              <p className="text-white/60 text-xs mt-0.5 mb-1">
                IFBB Professional · Mr. USA 2002 · 30+ Years Coaching
              </p>

              <p className="text-white/80 text-sm leading-relaxed max-w-xl">
                I've spent over 30 years working in performance nutrition, body
                composition, and structured meal design starting long before it
                was a business, because this is just how I've always lived. My
                background combines elite competitive athletics, clinical
                awareness from my time as an ICU Medic in the U.S. Air Force,
                and decades of real-world coaching experience. My Perfect Meals
                was built to remove confusion, eliminate food stress, and help
                people eat confidently without restriction.
              </p>

              <Button
                size="sm"
                className="mt-4 bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors shadow-md hover:shadow-lg"
                onClick={() => setLocation("/apply-guidance")}
              >
                Work Directly With Coach Idrise
              </Button>
            </div>
          </div>
        </section>

        {/* EXECUTIVE LEADERSHIP */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-6">
            Executive Leadership
          </h2>

          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-sm ring-1 ring-white/20 overflow-hidden shrink-0">
              Photo
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white">
                Monica Brant
              </h3>

              <p className="text-orange-400 text-sm font-medium">
                Chief Growth & Partnerships Officer
              </p>

              <p className="text-white/70 text-sm mt-1">
                Fitness Icon · World Champion · Global Wellness Leader
              </p>

              <p className="text-white/70 text-sm leading-relaxed mt-4">
                Monica Brant has been a global force in the fitness industry
                since the early 1990s, recognized for her leadership,
                discipline, faith, and lasting influence across health and
                wellness. An international fitness icon and cover model with
                more than 130 magazine covers spanning over three decades,
                Monica rose to prominence following her breakthrough appearance
                on the cover of Muscle & Fitness magazine in 1994 and went on
                to become one of the most recognized women in fitness worldwide
                through magazine features, interviews, competitions, and
                speaking engagements. Throughout her career, she earned multiple
                top placements at both the Olympia and Arnold Festival stages
                and captured three world championship titles, including the
                Fitness Olympia championship in 1998 and two WBFF World
                Championships in 2010 and 2013, before concluding her
                competitive career with an overall victory in the United Kingdom
                in 2016. Beyond competition, Monica continues to inspire
                audiences around the world through coaching, consulting,
                speaking, and faith-driven wellness initiatives focused on
                helping others grow physically, mentally, and spiritually.
              </p>
            </div>
          </div>
        </section>

        {/* PROFESSIONAL BACKGROUND */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-6">
            Professional Background
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white/85">
            <div>✔ IFBB Professional Bodybuilder</div>
            <div>✔ Mr. USA 2002</div>
            <div>✔ NASM Certified Personal Trainer</div>
            <div>✔ NASM Certified Women's Fitness Specialist</div>
            <div>✔ NASM Certified Nutrition Coach</div>
            <div>✔ NASM Behavior Change Specialist</div>
            <div>✔ NASM Online Coaching Specialist</div>
            <div>✔ Former ICU Medic & EMT-I – United States Air Force</div>
          </div>
        </section>

        {/* PHILOSOPHY */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-4">
            The Philosophy Behind My Perfect Meals
          </h2>

          <p className="text-white/80 text-sm leading-relaxed">
            My Perfect Meals was created for food lovers who are tired of
            starting over. Instead of restriction, the system focuses on
            intelligent structure. Meals are designed to work in real life at
            restaurants, at home, while traveling, during busy seasons, and
            through changing goals. The objective is not short-term dieting. It
            is long-term confidence with food.
          </p>
        </section>

        {/* MEDICAL COMPLIANCE */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-6">
            Medical Compliance
          </h2>

          <div className="flex items-center gap-6">
            <img
              src="/assets/dr-lindsey.jpg"
              alt="Dr. Lindsey Prescher, MD"
              className="w-24 h-24 rounded-full object-cover object-top ring-1 ring-white/20"
            />

            <div>
              <h3 className="text-xl font-semibold text-white">
                Dr. Lindsey Prescher, MD
              </h3>

              <p className="text-orange-400 text-sm font-medium">
                Chief Medical Compliance Officer
              </p>

              <p className="text-white/70 text-sm mt-1">
                Cardiothoracic Surgeon DO FASC FACC Ret. CDR USN MC
              </p>
            </div>
          </div>
        </section>

        {/* LEGAL ADVISORY */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-6">Legal Advisory</h2>

          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-sm ring-1 ring-white/20">
              Photo
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white">TBA</h3>

              <p className="text-orange-400 text-sm font-medium">
                Legal Counsel
              </p>

              <p className="text-white/70 text-sm mt-1">
                Legal Advisory & Regulatory Guidance
              </p>
            </div>
          </div>
        </section>

        {/* FOUNDING COACHES */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-2">
            Founding Coaches
          </h2>

          <p className="text-white/50 text-sm mb-8">
            These are the coaches who signed on to build this with us before
            the platform was proven, before the audience was there. That means
            something.
          </p>

          <div className="space-y-10">
            {FOUNDING_COACHES.map((coach, i) => (
              <div key={coach.name}>
                {i > 0 && (
                  <div className="border-t border-white/10 mb-10" />
                )}

                <div className="flex items-center gap-5 mb-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-orange-400/60 shadow-lg shrink-0 bg-white/10">
                    {coach.photo && (
                      <img
                        src={coach.photo}
                        alt={coach.name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          (
                            e.target as HTMLImageElement
                          ).style.display = "none";
                        }}
                      />
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {coach.name}
                    </h3>

                    <p className="text-orange-400 text-sm font-medium">
                      {coach.title}
                    </p>

                    <p className="text-white/60 text-xs mt-0.5">
                      {coach.credentials}
                    </p>
                  </div>
                </div>

                {coach.bio ? (
                  <p className="text-white/70 text-sm leading-relaxed">
                    {coach.bio}
                  </p>
                ) : (
                  <p className="text-white/40 text-sm leading-relaxed italic">
                    Bio and credentials coming soon.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CONTACT */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl text-center">
          <h2 className="text-2xl font-semibold mb-2">
            Contact & Support
          </h2>

          <p className="text-white/60 text-sm mb-6">
            Questions, bugs, or feedback email us anytime. We read everything.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:support@myperfectmeals.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-orange-600 text-white font-medium transition-colors ring-1 ring-white/20"
            >
              support@myperfectmeals.com
            </a>

            <a
              href="mailto:support@myperfectmeals.com?subject=My Perfect Meals Feedback"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/10 text-white font-medium transition-colors ring-1 ring-white/20 hover:bg-white/20"
            >
              Send Feedback
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}