import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/contexts/PageTitleContext";
import {
  CheckCircle2,
  Circle,
  Play,
  ChevronRight,
  ArrowLeft,
  Lock,
} from "lucide-react";

const STORAGE_KEY = "mpm.protraining.progress";

const BC_GRADIENT = "bg-gradient-to-br from-black/60 via-orange-600 to-black/80";

interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  questions: Question[];
}

interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
}

const LESSONS: Lesson[] = [
  {
    id: "inviting-clients",
    title: "Lesson 1 — Inviting Clients",
    description: "Learn how to send invitations, manage pending requests, and connect clients to your ProCare studio.",
    videoUrl: null,
    questions: [
      {
        id: 1,
        text: "When you want to add a new client to your ProCare studio, what is the first step?",
        options: [
          "Create a folder for them first",
          "Send them an invite from the client management screen",
          "Ask them to create their account and then contact you",
          "Enter their information manually into the dashboard",
        ],
        correctIndex: 1,
      },
      {
        id: 2,
        text: "A client receives your ProCare invitation. What do they need to do to accept it?",
        options: [
          "Call you to confirm",
          "Log into My Perfect Meals and accept the connection request",
          "Nothing — they are automatically added to your studio",
          "Create a new account before they can accept",
        ],
        correctIndex: 1,
      },
      {
        id: 3,
        text: "You sent a client invitation three days ago and they haven't accepted yet. What should you do?",
        options: [
          "Delete the invite and create a new one",
          "The invite expires after 24 hours, so you must resend",
          "Check the pending invites section and follow up with your client directly",
          "Wait — invitations cannot be resent",
        ],
        correctIndex: 2,
      },
      {
        id: 4,
        text: "A client tells you they never received your invitation. What is the most likely reason?",
        options: [
          "They are not eligible for ProCare",
          "They entered the wrong email address, or they need to check their spam folder",
          "You do not have permission to invite that client",
          "The invitation system only works on desktop",
        ],
        correctIndex: 1,
      },
      {
        id: 5,
        text: "When a client accepts your invitation, where do they appear?",
        options: [
          "In your general contacts list",
          "In your ProCare client dashboard under active clients",
          "In a waiting room requiring your manual approval",
          "They receive access to your studio automatically",
        ],
        correctIndex: 1,
      },
      {
        id: 6,
        text: "Can a client be connected to more than one coach in ProCare?",
        options: [
          "No — each client can only have one coach",
          "Yes — a client can be part of a care team with multiple professionals",
          "Only if the client pays for a premium plan",
          "Only physicians can have shared clients",
        ],
        correctIndex: 1,
      },
      {
        id: 7,
        text: "What information do you need to send a client invitation?",
        options: [
          "Their full name, date of birth, and health conditions",
          "Their My Perfect Meals account email address",
          "Their phone number and zip code",
          "Their subscription plan details",
        ],
        correctIndex: 1,
      },
      {
        id: 8,
        text: "A client says they accepted your invite but you cannot see them in your dashboard. What is the most appropriate next step?",
        options: [
          "Have them delete their account and start over",
          "Refresh your dashboard and check the active clients list — processing may take a moment",
          "Submit a support ticket immediately",
          "Send a second invitation",
        ],
        correctIndex: 1,
      },
      {
        id: 9,
        text: "What is the purpose of the ProCare client connection?",
        options: [
          "It gives you access to the client's payment information",
          "It allows you to view the client's nutrition data, biometrics, and meal logs within your studio",
          "It automatically assigns the client a meal plan",
          "It locks the client to only use your recommended meals",
        ],
        correctIndex: 1,
      },
      {
        id: 10,
        text: "A client wants to stop working with you. What happens to their account when the connection is removed?",
        options: [
          "Their account is deleted",
          "They lose all their meal history",
          "Their personal account remains fully intact — only the coach connection is removed",
          "They must create a new account to continue using the app",
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    id: "folders",
    title: "Lesson 2 — Client Folders",
    description: "Learn how to organize clients using folders so your studio stays clean and efficient as you grow.",
    videoUrl: null,
    questions: [
      {
        id: 11,
        text: "What is the primary purpose of client folders in ProCare?",
        options: [
          "To restrict which features clients can access",
          "To organize clients into groups based on program, goal, or any category you choose",
          "To archive inactive clients permanently",
          "To set billing rates for different client tiers",
        ],
        correctIndex: 1,
      },
      {
        id: 12,
        text: "How do you create a new folder in your ProCare studio?",
        options: [
          "Folders are created automatically when you invite a client",
          "Navigate to the folder management section and create a named folder",
          "Contact support to request a new folder",
          "Folders are set by the platform and cannot be customized",
        ],
        correctIndex: 1,
      },
      {
        id: 13,
        text: "You are working with 12 clients — 4 doing fat loss, 4 building muscle, and 4 in maintenance. What is the best way to use folders?",
        options: [
          "Put all 12 in one folder labeled \"All Clients\"",
          "Create three folders — Fat Loss, Muscle Gain, and Maintenance — and assign clients accordingly",
          "Do not use folders until you have more than 20 clients",
          "Folders are only for archiving, not organizing active clients",
        ],
        correctIndex: 1,
      },
      {
        id: 14,
        text: "Can one client appear in more than one folder?",
        options: [
          "No — each client can only be in one folder at a time",
          "Yes — clients can be assigned to multiple folders",
          "Only if you have a premium studio account",
          "Only physicians can place clients in multiple folders",
        ],
        correctIndex: 0,
      },
      {
        id: 15,
        text: "You want to quickly review all clients currently in your \"Fat Loss\" program. What do you do?",
        options: [
          "Search for each client individually by name",
          "Open the Fat Loss folder and view all clients assigned to it",
          "Export a spreadsheet of all clients and filter manually",
          "Ask each client to check in individually",
        ],
        correctIndex: 1,
      },
      {
        id: 16,
        text: "What should you name folders to make your studio most efficient?",
        options: [
          "Folder 1, Folder 2, Folder 3 — keep it simple",
          "Use names that reflect what that group of clients has in common — goal, program, or status",
          "Use client last names as folder names",
          "Folders should always be named after the coach managing that group",
        ],
        correctIndex: 1,
      },
      {
        id: 17,
        text: "A client's program changes from fat loss to maintenance. What do you do in ProCare?",
        options: [
          "Delete them and re-invite them under the new program",
          "Move them from the Fat Loss folder to the Maintenance folder",
          "Create a duplicate client profile under the new program",
          "Folders cannot be changed once a client is assigned",
        ],
        correctIndex: 1,
      },
      {
        id: 18,
        text: "What is the benefit of using folders when managing clients across multiple businesses?",
        options: [
          "There is no benefit — folders are only useful for solo coaches",
          "You can create separate folders for each business to keep client groups clearly separated",
          "You must create a separate ProCare account for each business",
          "Location-based folders require approval from My Perfect Meals",
        ],
        correctIndex: 1,
      },
      {
        id: 19,
        text: "You create a folder called \"VIP Clients.\" A new client joins. Where do they appear by default?",
        options: [
          "They appear in the VIP Clients folder automatically",
          "They appear in your main client list and must be manually assigned to a folder",
          "They are placed in the most recently created folder",
          "They appear in a \"New Clients\" folder that is generated automatically",
        ],
        correctIndex: 1,
      },
      {
        id: 20,
        text: "Why is folder organization important as your client base grows?",
        options: [
          "It reduces the monthly cost of your ProCare subscription",
          "It keeps your studio manageable and ensures you can find client information quickly",
          "It is required by My Perfect Meals for studios with more than 10 clients",
          "It automatically generates reports for each client group",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "client-dashboard",
    title: "Lesson 3 — Client Dashboard",
    description: "Learn how to read client data, write provider notes, and coach from real information in your ProCare dashboard.",
    videoUrl: null,
    questions: [
      {
        id: 21,
        text: "When you open a client's profile in your ProCare studio, what information is available to you?",
        options: [
          "Only the client's name and email address",
          "The client's meal logs, macro tracking, biometrics, and notes",
          "The client's payment history and subscription plan",
          "The client's login activity and session times",
        ],
        correctIndex: 1,
      },
      {
        id: 22,
        text: "A client's protein intake has been significantly below their target for five days. Where would you see this in ProCare?",
        options: [
          "In the client's personal settings",
          "In the macro tracking and meal log section of their dashboard",
          "You would need to ask the client directly — this data is not visible to coaches",
          "In the billing section of their account",
        ],
        correctIndex: 1,
      },
      {
        id: 23,
        text: "What is the purpose of Provider Notes in the client dashboard?",
        options: [
          "Notes are visible to the client and used for motivation messages",
          "Notes are private records only visible to the coach for tracking observations and history",
          "Notes are automatically generated by the platform based on client data",
          "Notes are required by law and must be submitted to a central system",
        ],
        correctIndex: 1,
      },
      {
        id: 24,
        text: "A client reports low energy this week. You want to make a note before your next check-in. What do you do?",
        options: [
          "Send the client a message asking them to log it themselves",
          "Open their profile in ProCare, go to Provider Notes, and record your observation",
          "Create a separate document outside the platform to track this",
          "Flag their account with the support team",
        ],
        correctIndex: 1,
      },
      {
        id: 25,
        text: "Which of the following is NOT something you can view in a client's ProCare dashboard?",
        options: [
          "Recent meal logs",
          "Biometric entries such as weight and body measurements",
          "The client's credit card number",
          "Macro targets and daily nutrition data",
        ],
        correctIndex: 2,
      },
      {
        id: 26,
        text: "You notice a client has not logged a single meal in 10 days. What is the appropriate response?",
        options: [
          "Remove them from your studio for inactivity",
          "Use this as a signal to reach out and check in — consistency gaps are coaching opportunities",
          "Lower their macro targets automatically",
          "Reassign them to a different folder and wait",
        ],
        correctIndex: 1,
      },
      {
        id: 27,
        text: "A client's weight has increased for three consecutive weeks despite being on a fat loss protocol. What does the dashboard allow you to do?",
        options: [
          "Automatically adjust the client's meal plan",
          "Review their macro logs alongside their weight trend to identify patterns and adjust your approach",
          "Submit a platform flag to alert My Perfect Meals support",
          "Nothing — weight changes are outside the scope of ProCare",
        ],
        correctIndex: 1,
      },
      {
        id: 28,
        text: "You want to check which clients have been consistently hitting their protein targets this week. How do you do this?",
        options: [
          "Ask each client to screenshot their stats and send them to you",
          "Open each client's dashboard individually and review their macro logs",
          "Export all data to a spreadsheet — ProCare does not show this in the studio",
          "Contact My Perfect Meals support for a weekly report",
        ],
        correctIndex: 1,
      },
      {
        id: 29,
        text: "Why is it important to review a client's data in the dashboard before every coaching session?",
        options: [
          "It is required by My Perfect Meals policy",
          "It allows you to coach from real data rather than memory or client self-reporting alone",
          "The dashboard resets after each session, so you must review it immediately",
          "Reviewing the dashboard earns you points toward your coaching tier",
        ],
        correctIndex: 1,
      },
      {
        id: 30,
        text: "A client just completed their first week. What is the correct sequence before writing a note?",
        options: [
          "Check biometrics → write note → review meals",
          "Open the client dashboard → review meal logs and macro data → review biometrics → write your Provider Note",
          "Write the note first, then check the data to confirm it",
          "Ask the client to send you a summary before opening the dashboard",
        ],
        correctIndex: 1,
      },
    ],
  },
];

type LessonProgress = { [lessonId: string]: "not_started" | "watching" | "questions" | "done" };

function loadProgress(): LessonProgress {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveProgress(p: LessonProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

type View = "overview" | "lesson";

export default function ProcareTraining() {
  usePageTitle("ProCare Training");
  const [, setLocation] = useLocation();
  const { refreshUser } = useAuth();

  const [view, setView] = useState<View>("overview");
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [lessonView, setLessonView] = useState<"video" | "questions" | "review">("video");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [progress, setProgress] = useState<LessonProgress>(loadProgress);
  const [completing, setCompleting] = useState(false);

  const allLessonsDone = LESSONS.every((l) => progress[l.id] === "done");

  const updateProgress = (lessonId: string, status: LessonProgress[string]) => {
    const updated = { ...progress, [lessonId]: status };
    setProgress(updated);
    saveProgress(updated);
  };

  const startLesson = (index: number) => {
    setActiveLessonIndex(index);
    setLessonView("video");
    setAnswers({});
    setSubmitted(false);
    setView("lesson");
  };

  const handleAnswer = (qIndex: number, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }));
  };

  const handleSubmitLesson = () => {
    setSubmitted(true);
    const lesson = LESSONS[activeLessonIndex];
    updateProgress(lesson.id, "done");
    setLessonView("review");
  };

  const handleCompleteTraining = async () => {
    setCompleting(true);
    try {
      await apiRequest("POST", "/api/pro/training/complete");
      await refreshUser();
      localStorage.removeItem(STORAGE_KEY);
      setLocation("/pro-launchpad");
    } catch {
      setCompleting(false);
    }
  };

  const activeLesson = LESSONS[activeLessonIndex];
  const answeredAll = activeLesson
    ? activeLesson.questions.every((_, i) => answers[i] !== undefined)
    : false;

  if (view === "lesson") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="px-4 pt-8 pb-4">
            <button
              onClick={() => setView("overview")}
              className="flex items-center gap-1.5 text-white/50 text-sm mb-4 active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Training
            </button>
            <h2 className="text-lg font-bold text-white">{activeLesson.title}</h2>
            <p className="text-white/55 text-sm mt-1">{activeLesson.description}</p>
          </div>

          {lessonView === "video" && (
            <div className="px-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden mb-6">
                {activeLesson.videoUrl ? (
                  <iframe
                    src={activeLesson.videoUrl}
                    className="w-full aspect-video"
                    allowFullScreen
                    title={activeLesson.title}
                  />
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-black/40">
                    <div className="w-16 h-16 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                      <Play className="w-7 h-7 text-orange-400 ml-1" />
                    </div>
                    <p className="text-white/40 text-sm">Video coming soon</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setLessonView("questions")}
                className="w-full py-3 bg-orange-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                Continue to Questions
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {(lessonView === "questions" || lessonView === "review") && (
            <div className="px-4 space-y-5">
              {activeLesson.questions.map((q, qi) => (
                <div key={q.id} className="rounded-2xl bg-white/5 border border-white/8 p-4">
                  <p className="text-sm font-medium text-white mb-3 leading-relaxed">
                    {qi + 1}. {q.text}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const selected = answers[qi] === oi;
                      const isCorrect = oi === q.correctIndex;
                      const showResult = submitted;

                      let borderColor = "border-white/10 bg-white/3";
                      if (showResult && isCorrect) borderColor = "border-green-500/50 bg-green-900/20";
                      else if (showResult && selected && !isCorrect) borderColor = "border-red-500/40 bg-red-900/15";
                      else if (selected) borderColor = "border-orange-500/50 bg-orange-900/15";

                      return (
                        <button
                          key={oi}
                          onClick={() => handleAnswer(qi, oi)}
                          disabled={submitted}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all active:scale-[0.99] ${borderColor}`}
                        >
                          <span className={showResult && isCorrect ? "text-green-300" : showResult && selected && !isCorrect ? "text-red-300" : "text-white/80"}>
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
          {lessonView === "questions" && !submitted && (
            <button
              onClick={handleSubmitLesson}
              disabled={!answeredAll}
              className="w-full h-14 bg-orange-600 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all"
            >
              {answeredAll ? "Complete Lesson" : `Answer All ${activeLesson.questions.length} Questions`}
            </button>
          )}
          {lessonView === "review" && (
            <div className="space-y-2">
              {activeLessonIndex < LESSONS.length - 1 ? (
                <button
                  onClick={() => startLesson(activeLessonIndex + 1)}
                  className="w-full h-14 bg-orange-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  Next Lesson
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : allLessonsDone ? (
                <button
                  onClick={handleCompleteTraining}
                  disabled={completing}
                  className="w-full h-14 bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  {completing ? "Completing..." : "Unlock My Studio"}
                  {!completing && <ChevronRight className="w-5 h-5" />}
                </button>
              ) : null}
              <button
                onClick={() => setView("overview")}
                className="w-full py-2 bg-white/8 text-white/60 text-sm font-medium rounded-xl active:scale-[0.98] transition-transform"
              >
                Back to Training Overview
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${BC_GRADIENT} text-white flex flex-col`}>
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-28">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setLocation("/pro-launchpad")}
            className="flex items-center gap-1.5 text-white/50 text-sm mb-6 active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Launchpad
          </button>

          <h1 className="text-2xl font-bold mb-1">ProCare Training</h1>
          <p className="text-white/60 text-sm mb-6">
            Three lessons on how to use your ProCare Studio. Complete all three to unlock your studio.
          </p>

          <div className="space-y-3">
            {LESSONS.map((lesson, i) => {
              const done = progress[lesson.id] === "done";
              const prevDone = i === 0 || progress[LESSONS[i - 1].id] === "done";
              const locked = !prevDone;

              return (
                <div
                  key={lesson.id}
                  className={`rounded-2xl border p-4 ${
                    locked
                      ? "border-white/8 bg-white/3 opacity-50"
                      : done
                        ? "border-green-500/20 bg-green-900/10"
                        : "border-orange-500/20 bg-white/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {locked ? (
                        <Lock className="w-5 h-5 text-white/25" />
                      ) : done ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-orange-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${locked ? "text-white/40" : "text-white"}`}>
                        {lesson.title}
                      </p>
                      <p className={`text-xs mt-0.5 leading-relaxed ${locked ? "text-white/25" : "text-white/55"}`}>
                        {lesson.description}
                      </p>
                      {!locked && (
                        <button
                          onClick={() => startLesson(i)}
                          className="mt-3 px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl flex items-center gap-2 active:scale-[0.98] transition-transform"
                        >
                          {done ? "Review" : "Start Lesson"}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {allLessonsDone && (
            <div className="mt-6">
              <button
                onClick={handleCompleteTraining}
                disabled={completing}
                className="w-full h-14 bg-orange-600 disabled:opacity-60 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                {completing ? "Completing..." : "Complete Training & Unlock Studio"}
                {!completing && <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
