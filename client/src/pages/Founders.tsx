import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Founder() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-950 pt-16 pb-24">
      {/* Main Content */}
      <div
        className="max-w-5xl mx-auto px-4 text-white space-y-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* FOUNDER HERO */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Refined smaller image */}
            <div className="w-36 h-48 overflow-hidden rounded-xl ring-1 ring-white/20 shadow-lg">
              <img
                src="/assets/founder-photo.png"
                alt="Coach Idrise"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-4 text-center md:text-left">
              <h1 className="text-3xl font-bold">
                Coach Idrise
              </h1>
              <p className="text-orange-400 font-medium">
                Founder & Lead Coach
              </p>
              <p className="text-white/80 text-sm leading-relaxed max-w-xl">
                I’ve spent over two decades working in performance nutrition, body composition, and structured meal design. My background combines competitive athletics, clinical awareness, and real-world coaching experience. My Perfect Meals was built to remove confusion, eliminate food stress, and help people eat confidently without restriction.
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

        {/* PROFESSIONAL BACKGROUND */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-6">
            Professional Background
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white/85">
            <div>✔ NASM Certified Personal Trainer</div>
            <div>✔ NASM Certified Women’s Fitness Specialist</div>
            <div>✔ NASM Certified Nutrition Coach</div>
            <div>✔ NASM Behavior Change Specialist</div>
            <div>✔ NASM Online Coaching Specialist</div>
            <div>✔ Former Professional Bodybuilder</div>
            <div>✔ Former ICU Medic & EMT-I – United States Air Force</div>
          </div>
        </section>

        {/* PHILOSOPHY */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
          <h2 className="text-2xl font-semibold mb-4">
            The Philosophy Behind My Perfect Meals
          </h2>
          <p className="text-white/80 text-sm leading-relaxed">
            My Perfect Meals was created for food lovers who are tired of starting over. Instead of restriction, the system focuses on intelligent structure. Meals are designed to work in real life — at restaurants, at home, while traveling, during busy seasons, and through changing goals. The objective is not short-term dieting. It is long-term confidence with food.
          </p>
        </section>

        {/* CONTACT */}
        <section className="bg-black/60 rounded-2xl p-8 ring-1 ring-white/10 backdrop-blur-md shadow-2xl text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Contact
          </h2>
          <a
            href="mailto:support@myperfectmeals.com"
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-orange-600 text-white font-medium transition-colors ring-1 ring-white/20"
          >
            support@myperfectmeals.com
          </a>
        </section>
      </div>
    </div>
  );
}
