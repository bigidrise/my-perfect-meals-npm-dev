import { useLocation } from "wouter";
import { ArrowLeft, Award, LifeBuoy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type Founder = {
  id: string;
  name: string;
  img: string;
  badge?: string;
};

const FOUNDERS: Founder[] = [
  {
    id: "1",
    name: "Coach Idrise",
    img: "/assets/founder-photo.png",
    badge: "Gold Founder",
  },
  { id: "2", name: "A. Believer", img: "/assets/MPMTransparentLogo.png" },
  {
    id: "3",
    name: "B. Believer",
    img: "/assets/MPMTransparentLogo.png",
    badge: "Top Supporter",
  },
  { id: "4", name: "C. Believer", img: "/assets/MPMTransparentLogo.png" },
];

export default function FoundersPage() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Fixed Black Glass Navigation Banner */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => setLocation("/dashboard")}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            About My Perfect Meals
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-6xl mx-auto px-4 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <section className="container mx-auto max-w-6xl px-4 md:px-6">
          {/* ABOUT MY PERFECT MEALS SECTION */}
          <div className="mb-10 p-6 rounded-2xl bg-black/50 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-4 drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
              About My Perfect Meals
            </h2>

            <p className="text-white/85 text-sm md:text-base leading-relaxed">
              My Perfect Meals was built for real people with real lives —
              people who love food, want to be healthier, and need a system that
              works in the real world, not the imaginary world most diet apps
              are based on.
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              After nearly{" "}
              <strong>40 years in the fitness and nutrition industry</strong>,
              and coaching clients since the early 2000s, I kept seeing the same
              struggles: cravings, stress eating, chaotic schedules, confusion
              about what to eat, and zero accountability. People didn’t need
              another diet —<strong> they needed real solutions</strong>.
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              Before building this company, I served as an{" "}
              <strong>Air Force medic</strong>, worked as a{" "}
              <strong>San Quentin correctional officer</strong>, performed as a{" "}
              <strong>professional bodybuilder</strong>, and later earned my
              bachelor’s degree in <strong>Business Administration</strong> with
              a concentration in <strong>Social Media Marketing</strong> and a
              minor in <strong>Generative AI</strong>. Everything I’ve learned
              about discipline, structure, psychology, and human behavior shaped
              what this app became.
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              My Perfect Meals was created to solve the problems I’ve watched
              people struggle with for decades — cravings, meal planning, social
              events, daily food decisions, and the constant feeling of starting
              over every Monday. This isn’t a diet app.{" "}
              <strong>
                It’s a food-lover’s lifestyle system, powered by Emotion AI,
                built to help you eat the foods you love in a smarter way
              </strong>
              .
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              My mission is simple:{" "}
              <strong>help real people succeed in the real world</strong>. If
              this app can help you feel more confident, more in control, and
              less stressed about food, then My Perfect Meals is doing exactly
              what it was created to do.
            </p>
          </div>

          {/* CONTACT US SECTION */}
          <div className="mb-10 p-6 rounded-2xl bg-black/50 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-4 drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
              Contact Us
            </h2>
            <p className="text-white/85 text-sm md:text-base leading-relaxed mb-4">
              Have questions, feedback, or need support? We'd love to hear from you.
            </p>
            <a
              href="mailto:support@myperfectmeals.com"
              className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-orange-600/80 hover:bg-orange-500/90 text-white font-medium transition-colors ring-1 ring-white/20"
            >
              <LifeBuoy className="h-5 w-5" />
              <span>support@myperfectmeals.com</span>
              <Mail className="h-4 w-4 opacity-60" />
            </a>
          </div>

          {/* FOUNDERS SECTION */}
          <div className="mb-8 p-6 rounded-2xl bg-black/50 ring-1 ring-white/10 backdrop-blur-md shadow-2xl text-center">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
              Meet Our Founders
            </h1>
            <p className="text-sm md:text-base text-white/80 mt-2">
              The early believers who helped build My Perfect Meals.
            </p>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {FOUNDERS.map((f) => (
              <article
                key={f.id}
                className="relative overflow-hidden rounded-2xl bg-black/55 ring-1 ring-white/10 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
                data-testid={`card-founder-${f.id}`}
              >
                <div className="aspect-[4/5] w-full overflow-hidden">
                  <img
                    src={f.img}
                    alt={f.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <h3 className="text-white font-medium truncate">{f.name}</h3>

                  {f.badge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 ring-1 ring-yellow-300/30 px-2.5 py-1 text-[11px] text-yellow-100">
                      <Award className="h-3.5 w-3.5" />
                      {f.badge}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="h-6" />
        </section>
      </div>
    </motion.div>
  );
}
