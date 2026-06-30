import { useLocation } from "wouter";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Users,
  Stethoscope,
  FlaskConical,
  ChevronRight,
  CheckCircle2,
  Clock,
  Briefcase,
  Star,
  Lock,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const WHO_ITS_FOR = [
  "Personal trainers",
  "Nutrition coaches",
  "Physicians & NPs",
  "Registered dietitians",
  "Business partners",
  "Referral partners",
  "Wellness coaches",
  "White-label teams",
];

const courses = [
  {
    number: "01",
    title: "Platform Foundations",
    description:
      "Every feature, every builder, and the adaptive nutrition engine — so you can explain the platform confidently to anyone.",
    icon: BookOpen,
    badge: "Required — All",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    time: "45–60 min",
    locked: false,
  },
  {
    number: "02",
    title: "Marketing & Brand Standards",
    description:
      "Approved messaging, FTC/FDA awareness, and how to represent My Perfect Meals accurately across every channel.",
    icon: TrendingUp,
    badge: "Required — All",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    time: "30–40 min",
    locked: false,
  },
  {
    number: "03",
    title: "Business Growth",
    description:
      "Referral economics, building a program around MPM, and how to onboard your team — for partners and organizations.",
    icon: Briefcase,
    badge: "Required — Partners",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    time: "40–50 min",
    locked: false,
  },
  {
    number: "04",
    title: "ProCare & Client Care",
    description:
      "The full coaching workflow — client records, biometrics, care notes, check-ins, and the professional tools inside ProCare.",
    icon: Users,
    badge: "Required — Professionals",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    time: "50–60 min",
    locked: false,
  },
  {
    number: "05",
    title: "Adaptive Nutrition Science",
    description:
      "The science behind personalization — macro targeting, clinical protocols, performance nutrition, and why MPM behaves differently from generic AI tools.",
    icon: Stethoscope,
    badge: "Advanced / Elective",
    badgeColor: "bg-white/10 text-white/60 border-white/15",
    time: "45–60 min",
    locked: false,
  },
  {
    number: "06",
    title: "Clinical Protocols",
    description:
      "Physician-assigned protocols, oncology support, GLP-1, and renal/cardiac nutrition — for licensed clinicians.",
    icon: FlaskConical,
    badge: "Coming Soon",
    badgeColor: "bg-white/5 text-white/40 border-white/10",
    time: "TBD",
    locked: true,
  },
];

const CERTIFICATES = [
  {
    name: "Platform Certificate",
    courses: "Course 1",
    icon: "🎓",
  },
  {
    name: "Referral Partner Certificate",
    courses: "Courses 1–2",
    icon: "🤝",
  },
  {
    name: "Business Certificate",
    courses: "Courses 1–3",
    icon: "🏢",
  },
  {
    name: "ProCare Certificate",
    courses: "Courses 1–2 + 4",
    icon: "⚕️",
  },
  {
    name: "Advanced Certificate",
    courses: "Courses 1–2 + 4–5",
    icon: "⭐",
  },
];

export default function AcademyLandingPage() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Business Center
          </button>
          <h1 className="text-lg font-bold text-white">Academy</h1>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >

        {/* ── HERO ─────────────────────────────────────────────── */}
        <motion.div
          className="text-center py-4 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-orange-500/15 border border-orange-500/25">
              <GraduationCap className="h-10 w-10 text-orange-400" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              My Perfect Meals Academy
            </h2>
            <p className="text-orange-400 text-sm font-medium mt-1">
              Professional certification for everyone who represents MPM
            </p>
          </div>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">
            The Academy teaches professionals and partners how to understand, use, explain, and represent My Perfect Meals — so they can deliver real results for the people they serve.
          </p>
        </motion.div>

        {/* ── WHO IT'S FOR ─────────────────────────────────────── */}
        <motion.div
          className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-sm font-bold text-white">Who this is for</h3>
          <div className="flex flex-wrap gap-2">
            {WHO_ITS_FOR.map((role) => (
              <span
                key={role}
                className="px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-xs text-white/70 font-medium"
              >
                {role}
              </span>
            ))}
          </div>
          <p className="text-xs text-white/50 leading-relaxed pt-1">
            This is not just affiliate training. The Academy is the standard onboarding for anyone who represents My Perfect Meals professionally — coaches, providers, business partners, referral partners, and future white-label organizations.
          </p>
        </motion.div>

        {/* ── COURSES ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-widest px-1">
            Curriculum — 6 Courses
          </h3>

          {courses.map((course, i) => {
            const Icon = course.icon;
            return (
              <motion.div
                key={course.number}
                className={`p-4 rounded-2xl border ${
                  course.locked
                    ? "bg-white/3 border-white/8 opacity-60"
                    : "bg-white/5 border-white/10"
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: course.locked ? 0.6 : 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.05 }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {course.locked ? (
                      <div className="p-2 rounded-xl bg-white/5">
                        <Lock className="h-4 w-4 text-white/30" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-orange-500/15">
                        <Icon className="h-4 w-4 text-orange-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-white/30">{course.number}</span>
                      <span className="text-sm font-semibold text-white leading-snug">
                        {course.title}
                      </span>
                    </div>
                    <p className="text-xs text-white/55 leading-relaxed">
                      {course.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${course.badgeColor}`}
                      >
                        {course.badge}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-white/35">
                        <Clock className="h-3 w-3" />
                        {course.time}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── CERTIFICATES ─────────────────────────────────────── */}
        <motion.div
          className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <h3 className="text-sm font-bold text-white">Certificates Offered</h3>
          <p className="text-xs text-white/50 leading-relaxed">
            One Academy. Multiple certificates — issued based on the courses your role requires.
          </p>
          <div className="space-y-2 pt-1">
            {CERTIFICATES.map((cert) => (
              <div
                key={cert.name}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-white/8 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{cert.icon}</span>
                  <span className="text-xs font-semibold text-white">{cert.name}</span>
                </div>
                <span className="text-xs text-white/40 text-right flex-shrink-0">
                  {cert.courses}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── PHILOSOPHY ───────────────────────────────────────── */}
        <motion.div
          className="p-5 rounded-2xl bg-orange-500/8 border border-orange-500/20 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white">The purpose</h3>
          </div>
          <div className="space-y-2">
            {[
              "The Academy exists to make you successful — not to make certification hard.",
              "Every module teaches something you will use with a client, a partner, or a patient.",
              "After you earn your certificate, everything stays accessible. Come back to any lesson anytime — no re-test, no penalty.",
              "As the platform grows, new lessons will be added. Your certification grows with it.",
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/70 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <button
            onClick={() => setLocation("/business-center/affiliate")}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-orange-600 active:bg-orange-700 active:scale-[0.98] transition-all duration-150 font-semibold text-white text-sm shadow-lg shadow-orange-900/30"
          >
            <GraduationCap className="h-5 w-5" />
            Start Certification
            <ChevronRight className="h-4 w-4 opacity-70" />
          </button>
          <p className="text-center text-white/30 text-xs">
            Already certified? Your progress and certificates are saved automatically.
          </p>
        </motion.div>

      </div>
    </motion.div>
  );
}
