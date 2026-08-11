import { useLocation, useSearch } from "wouter";
import { Building2, Users, CreditCard, Zap, CheckCircle2, ArrowRight } from "lucide-react";

export default function BusinessStart() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  // Pass through any source/referral params so analytics can track which link was shared
  const params = new URLSearchParams(search);
  const source = params.get("source") || params.get("ref") || null;

  function handleGetStarted() {
    const target = new URLSearchParams();
    target.set("role", "business");
    target.set("mode", "signup");
    if (source) target.set("source", source);
    setLocation(`/auth?${target.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-black text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-orange-400" />
          <span className="font-bold text-lg tracking-tight">My Perfect Meals</span>
          <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/25">
            For Organizations
          </span>
        </div>
        <button
          onClick={() => setLocation("/auth?mode=login")}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Sign in
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-2xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs font-semibold mb-8">
          <Zap className="w-3.5 h-3.5" />
          Get your team live in minutes
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5 tracking-tight">
          Nutrition intelligence{" "}
          <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
            for your whole organization
          </span>
        </h1>

        <p className="text-lg text-white/70 mb-10 max-w-xl leading-relaxed">
          Create your organization account, choose member seats, complete checkout, and your
          entire team gets personalized nutrition guidance — live the same day.
        </p>

        {/* Steps */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-left">
          {[
            {
              icon: <Building2 className="w-5 h-5 text-orange-400" />,
              step: "1",
              title: "Create your account",
              desc: "Set up your organization profile in under two minutes.",
            },
            {
              icon: <Users className="w-5 h-5 text-orange-400" />,
              step: "2",
              title: "Choose your seats",
              desc: "Pick how many members you're covering — scale up anytime.",
            },
            {
              icon: <CreditCard className="w-5 h-5 text-orange-400" />,
              step: "3",
              title: "Pay & go live",
              desc: "Secure checkout, then share invite links with your team instantly.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-300">
                  {item.step}
                </div>
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">{item.title}</p>
                <p className="text-xs text-white/55 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* What's included */}
        <div className="w-full rounded-2xl bg-white/4 border border-white/10 p-6 mb-10 text-left">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
            What your team gets
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Personalized meal plans for every member",
              "AI nutrition coach available 24/7",
              "Performance & recovery nutrition",
              "Dietary restriction & allergy support",
              "Admin dashboard to manage your roster",
              "Scales from 5 to 500+ members",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/75">
                <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <button
          onClick={handleGetStarted}
          className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 active:scale-[0.98] text-white font-bold text-base transition-all shadow-lg shadow-orange-500/25"
        >
          Create your organization account
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="mt-4 text-xs text-white/35">
          No commitment until checkout. Setup takes under 2 minutes.
        </p>
      </main>

      {/* Footer */}
      <footer className="px-6 py-5 border-t border-white/8 text-center text-xs text-white/30">
        © {new Date().getFullYear()} My Perfect Meals · Built for gyms, clinics &amp; teams
      </footer>
    </div>
  );
}
