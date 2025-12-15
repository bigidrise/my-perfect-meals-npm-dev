import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { PlayCircle, ArrowLeft, Home } from "lucide-react";

type Tutorial = {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbUrl?: string;
  category?: "Onboarding" | "Features" | "Nutrition" | "GLP-1" | "Hormones" | "Other";
  order?: number;
};

// Alpha Testing 3-week structure
const SEED: Tutorial[] = [
  {
    id: "dashboard-tutorial",
    title: "Dashboard Tutorial",
    description: "How To Navigate and use the Dashboard",
    videoUrl: "https://player.vimeo.com/video/1130394906?badge=0&autopause=0&player_id=0&app_id=58479",
    category: "Features",
    order: 1,
  },
  {
    id: "meal-builder-macros-weekly-menu",
    title: "Macro Calculator, Weekly Menu Builder Tutorial",
    description: "How To Use Macro Calculator & Weekly Menu Builder",
    videoUrl: "https://player.vimeo.com/video/1130401827?badge=0&autopause=0&player_id=0&app_id=58479",
    category: "Features",
    order: 2,
  },
  {
    id: "Coming Soon",
    title: "Advanced Tools & Feedback Loop",
    description: "Put everything together and help us fine-tune before Beta.",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Features",
    order: 3,
  },
  {
    id: "Coming Soon",
    title: "Advanced Tools & Feedback Loop",
    description: "Put everything together and help us fine-tune before Beta.",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Features",
    order: 3,
  },
  {
    id: "Coming Soon",
    title: "Advanced Tools & Feedback Loop",
    description: "Put everything together and help us fine-tune before Beta.",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Features",
    order: 3,
  },
  {
    id: "Coming Soon",
    title: "Advanced Tools & Feedback Loop",
    description: "Put everything together and help us fine-tune before Beta.",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Features",
    order: 3,
  },
  {
    id: "Coming Soon",
    title: "Advanced Tools & Feedback Loop",
    description: "Put everything together and help us fine-tune before Beta.",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Features",
    order: 3,
  },
  {
    id: "Coming Soon",
    title: "Advanced Tools & Feedback Loop",
    description: "Put everything together and help us fine-tune before Beta.",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Features",
    order: 3,
  },
];

function toEmbed(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") {
      const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : url;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
    return url;
  } catch {
    return url;
  }
}

export default function TutorialHub() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Tutorial Hub | My Perfect Meals";
  }, []);

  const tutorials = useMemo(() => {
    return [...SEED].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, []);

  const active = tutorials.find((t) => t.id === activeId) ?? null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 p-4"
    >
      <div className="max-w-6xl mx-auto">
        {/* Dashboard button at the top */}
        <div className="fixed top-4 left-4 z-50">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl font-medium px-4 py-2 text-sm text-white bg-black/30 hover:bg-black/50 border border-white/20 backdrop-blur-sm transition-colors shadow-lg"
            data-testid="link-back-dashboard"
          >
            <Home className="h-4 w-4" />
            
          </Link>
        </div>

        {/* Header card - matching green dashboard style */}
        <header className="bg-gradient-to-br from-black via-black-500 to-black border border-emerald-300/30 text-white rounded-2xl shadow-xl p-6 mt-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold">📚 Tutorial Hub</h1>
            <p className="text-white/95 mt-2 text-sm">
              How-to videos for using your My Perfect Meals app
            </p>
          </div>
        </header>

        {/* Video cards - green theme - stacked vertically */}
        <section className="mt-6 space-y-4">
          {tutorials.map((t) => (
            <article
              key={t.id}
              className="bg-gradient-to-br from-black via-black-500 to-black border border-emerald-300/30 text-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow"
              data-testid={`card-tutorial-${t.id}`}
            >
              <div className="aspect-video bg-black/20 relative group">
                {t.thumbUrl ? (
                  <img
                    src={t.thumbUrl}
                    alt={t.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/80 text-sm">
                    <PlayCircle className="h-16 w-16 opacity-50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs text-white/90 font-medium">
                  {t.category ?? "Tutorial"}
                </div>
                <h3 className="mt-1 font-semibold leading-snug text-lg">
                  {t.title}
                </h3>
                {t.description && (
                  <p className="text-white/95 text-sm mt-2 line-clamp-2">
                    {t.description}
                  </p>
                )}
                <button
                  onClick={() => setActiveId(t.id)}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl font-medium px-4 py-2 text-sm text-white bg-emerald-700 hover:bg-emerald-800 shadow-md transition-colors w-full"
                  data-testid={`button-watch-${t.id}`}
                >
                  <PlayCircle className="h-4 w-4" />
                  Watch
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>

      {/* Modal - green aesthetic */}
      {active && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <button
            aria-label="Close"
            onClick={() => setActiveId(null)}
            className="absolute inset-0"
            data-testid="button-close-backdrop"
          />
          <div className="w-full max-w-4xl relative z-10">
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 border border-emerald-300/30 text-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="aspect-video">
                <iframe
                  src={active.videoUrl}
                  title={active.title}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/90 font-medium">
                    {active.category ?? "Tutorial"}
                  </div>
                  <h3 className="font-semibold text-lg">{active.title}</h3>
                </div>
                <button
                  onClick={() => setActiveId(null)}
                  className="inline-flex items-center justify-center rounded-xl font-medium px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
                  data-testid="button-close-modal"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
