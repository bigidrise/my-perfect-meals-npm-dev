import { useState } from "react";

export default function UltimateExperiencesPage() {
  // Core state
  const [situation, setSituation] = useState<"holiday" | "camping" | "tailgating" | null>(null);
  const [event, setEvent] = useState<string | null>(null);
  const [courses, setCourses] = useState(4);
  const [servings, setServings] = useState(5);
  const [prompt, setPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const holidays = [
    "Thanksgiving",
    "Christmas",
    "Kwanzaa",
    "Hanukkah",
    "Eid",
    "Passover",
    "New Year's",
  ];

  const generateExperience = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/experiences/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          situation,
          event,
          courses,
          servings,
          prompt,
        }),
      });

      const data = await res.json();
      setResults(data.courses || []);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  // 🔥 Pill button style (matches your system feel)
  const pillBase =
    "px-4 py-2 rounded-full border text-sm transition-all duration-200";

  const activePill =
    "bg-orange-500 text-black border-orange-500 shadow-md";

  const inactivePill =
    "bg-black text-white border-gray-700 hover:border-orange-400";

  return (
    <div className="min-h-screen bg-black text-white p-4 space-y-6">

      {/* 🔥 HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-orange-400">
          Ultimate Experiences
        </h1>
        <p className="text-sm text-gray-400">
          Build full meal experiences for holidays, trips, and special occasions
        </p>
      </div>

      {/* 🔥 EXPERIENCE TYPE */}
      <div>
        <h2 className="text-sm text-gray-400 mb-2">Experience Type</h2>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Holiday", value: "holiday" },
            { label: "Camping", value: "camping" },
            { label: "Tailgating", value: "tailgating" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setSituation(item.value as any);
                setEvent(null);
              }}
              className={`${pillBase} ${
                situation === item.value ? activePill : inactivePill
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🎄 HOLIDAY SELECTOR */}
      {situation === "holiday" && (
        <div>
          <h2 className="text-sm text-gray-400 mb-2">Holiday</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {holidays.map((h) => (
              <button
                key={h}
                onClick={() => setEvent(h)}
                className={`${pillBase} whitespace-nowrap ${
                  event === h ? activePill : inactivePill
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🍽 PROMPT INPUT */}
      <div>
        <h2 className="text-sm text-gray-400 mb-2">Describe your meal</h2>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. smoky grilled chicken, garlic rice, spicy vegetables..."
          className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-400"
        />
      </div>

      {/* ⚙️ CONTROLS */}
      <div className="flex flex-wrap gap-6 items-center">

        {/* 🍽 COURSES */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Courses</p>
          <div className="flex gap-2">
            {[3, 4, 5].map((c) => (
              <button
                key={c}
                onClick={() => setCourses(c)}
                className={`${pillBase} ${
                  courses === c ? activePill : inactivePill
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 👥 SERVINGS (STEPPER) */}
        <div>
          <p className="text-xs text-gray-400 mb-1">People</p>
          <div className="flex items-center gap-3 bg-black border border-gray-700 rounded-full px-3 py-1">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="text-orange-400 text-lg"
            >
              −
            </button>

            <span className="text-white text-sm">
              {servings}
            </span>

            <button
              onClick={() => setServings((s) => s + 1)}
              className="text-orange-400 text-lg"
            >
              +
            </button>
          </div>
        </div>

      </div>

      {/* 🚀 GENERATE BUTTON */}
      <button
        onClick={generateExperience}
        disabled={loading || !situation}
        className="w-full bg-orange-500 text-black py-3 rounded-lg font-semibold hover:bg-orange-400 transition"
      >
        {loading ? "Generating..." : "Generate Experience"}
      </button>

      {/* 🍽 RESULTS */}
      <div className="space-y-4">
        {results.map((course, idx) => (
          <div
            key={idx}
            className="border border-gray-800 rounded-lg p-3 bg-black"
          >
            <p className="text-xs text-orange-400 uppercase mb-1">
              {course.course}
            </p>

            {/* 🔥 REPLACE THIS WITH YOUR REAL MealCard */}
            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
              {JSON.stringify(course, null, 2)}
            </pre>
          </div>
        ))}
      </div>

    </div>
  );
}
