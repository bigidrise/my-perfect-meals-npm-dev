import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { useOrgBranding } from "@/hooks/useOrgBranding";

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
  const { supportEmail, supportUrl, appName } = useOrgBranding();

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
          <h2 className="text-2xl font-semibold mb-6">Founder &amp; Chief Executive Officer</h2>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-36 h-48 overflow-hidden rounded-xl ring-1 ring-white/20 shadow-lg">
              <img
                src="/assets/founder-photo.jpg"
                alt="Coach Idrise"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-4 text-center md:text-left">
              <h1 className="text-xl font-bold">Idrise Ward-EL</h1>

              <p className="text-orange-400 font-medium">
                CEO, Founder & Lead Coach
              </p>

              <p className="text-white/60 text-xs mt-0.5 mb-1">
                IFBB Professional · Mr. USA 2002 · 30+ Years Coaching
              </p>

              <p className="text-white/80 text-sm leading-relaxed max-w-xl">
                Coach Idrise is the Founder and CEO of My Perfect Meals, an
                adaptive AI nutrition and wellness platform built to help people
                make better food decisions and develop healthier habits for
                life.
              </p>

              <p className="text-white/80 text-sm leading-relaxed max-w-xl">
                With more than 30 years of experience in nutrition, body
                composition, fitness, and behavior-change coaching, Idrise has
                worked with people across a wide range of health, lifestyle, and
                performance goals.
              </p>

              <p className="text-white/80 text-sm leading-relaxed max-w-xl">
                His background combines healthcare experience as a U.S. Air
                Force ICU Medic and EMT, decades of hands-on coaching, and elite
                athletics as a former IFBB Professional Bodybuilder and Mr. USA.
              </p>

              <p className="text-white/80 text-sm leading-relaxed max-w-xl">
                Today, he brings that experience together with modern artificial
                intelligence to develop My Perfect Meals—using personalized
                nutrition, practical coaching, and behavior-change strategies
                to help make healthy eating easier to understand, easier to
                follow, and more sustainable in everyday life.
              </p>

          
            </div>
          </div>
        </section>

        {/* EXECUTIVE LEADERSHIP */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-6">
            Executive Leadership
          </h2>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden ring-1 ring-white/20 shadow-lg shrink-0 bg-white/10">
              <img
                src="/assets/amber-tischio.png"
                alt="Amber Tischio"
                className="w-full h-full object-cover object-top"
                onError={(e) => {
                  console.error("Failed to load Amber image");
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            <div className="text-center sm:text-left">
              <h3 className="text-xl font-semibold text-white">
                Amber Tischio
              </h3>

              <p className="text-orange-400 text-sm font-medium">
                Strategic Growth Director
              </p>

              <p className="text-white/70 text-sm leading-relaxed mt-4">
                Amber Tischio is a healthcare growth executive with a master’s
                degree in Clinical Psychology and expertise spanning behavioral
                health, functional medicine, sales leadership, clinical
                operations, and business strategy. She has built and led
                high-performing teams, developed revenue and patient-conversion
                systems, strengthened clinical operations, and helped scale
                healthcare organizations to multiple six figures in monthly
                revenue. Her background in psychology shapes a distinctly
                different approach to both sales and customer experience—one
                centered on understanding human behavior, building trust,
                identifying what people actually need, and creating an
                experience that naturally moves them toward action. Rather than
                treating sales, service, and retention as separate functions,
                Amber views the entire customer journey as one connected
                experience. She currently serves as Director of Strategic Growth
                for My Perfect Meals, bringing together her experience in human
                behavior, healthcare, leadership, customer experience, and
                scalable growth strategy.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 my-8" />

          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden ring-1 ring-white/20 shadow-lg shrink-0 bg-white/10">
              <img
                src="/assets/monica-brant.jpg"
                alt="Monica Brant"
                className="w-full h-full object-cover object-top"
                onError={(e) => {
                  console.error("Failed to load Monica image");
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white">
                Monica Brant
              </h3>

              <p className="text-orange-400 text-sm font-medium">
                Director of Business Development
              </p>

              <p className="text-white/70 text-sm leading-relaxed mt-4">
                Monica Brant is the Director of Business Development for My
                Perfect Meals, helping build relationships, identify new
                opportunities, and expand the platform&apos;s reach across
                health, wellness, fitness, and community organizations.
              </p>

              <p className="text-white/70 text-sm leading-relaxed mt-4">
                A three-time world fitness champion, including the 1998 Fitness
                Olympia title, Monica has been a recognized leader in the
                international fitness industry for more than three decades. Her
                career includes more than 130 magazine covers, global
                appearances, competitions, speaking engagements, and decades of
                involvement in health and wellness.
              </p>

              <p className="text-white/70 text-sm leading-relaxed mt-4">
                Today, Monica brings her extensive relationships, industry
                experience, and global reputation to My Perfect Meals, focusing
                on business development, strategic opportunities, and
                partnerships that can bring the platform to more people and
                organizations.
              </p>
            </div>
          </div>
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
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-orange-600 text-white font-medium transition-colors ring-1 ring-white/20"
            >
              {supportEmail}
            </a>

            <a
              href={`${supportUrl}${supportUrl?.startsWith("mailto:") ? `?subject=${appName} Feedback` : ""}`}
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