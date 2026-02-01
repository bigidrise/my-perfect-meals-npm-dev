import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Home, Mic, Save, Download, Trash2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const MOTIVATION_QUOTES = [
  "The secret to change? Start before you're ready.",
  "You can't pour from an empty cup — fuel yourself first.",
  "Excuses burn zero calories. Action does.",
  "Progress doesn't demand perfection — only persistence.",
  "Invest in your health like it's your most valuable asset — because it is.",
  "Momentum is built, not found. Keep building.",
  "Healthy choices compound faster than bad ones — stack them daily.",
  "Healthy isn't a look — it's a lifestyle you build daily.",
  "Don't rush the process; greatness grows in silence.",
  "When your habits align with your goals, success becomes automatic.",
  "The hardest reps are the ones that reshape you.",
  "You have the power to reset any moment — just begin again.",
  "Your body follows where your mind leads. Think strong.",
  "One day, your discipline will be your inspiration.",
  "Feed your focus, and your results will follow.",
  "Your plate is your blueprint for progress.",
  "You don't need a new start — just the next step.",
  "Consistency turns effort into transformation.",
  "Stay loyal to your routine, even when no one's watching.",
  "Every bite can move you closer to balance or further away — choose wisely.",
  "One meal at a time, you're changing your life.",
  "Discipline beats motivation. Show up for you today.",
  "Your goals aren't on pause — neither is your progress.",
  "Small wins stack up. Celebrate each one.",
  "Don't aim for perfect. Aim for consistent.",
  "The strongest change starts in the kitchen.",
  "Progress, not perfection, is what creates lasting change.",
  "Health is built daily — keep stacking those good choices.",
  "Your body thanks you for every healthy step forward.",
  "Stay driven, even when it feels slow. Growth takes time.",
  "Every choice you make is a vote for the life you want.",
  "Peace of mind comes from knowing you're doing your best.",
  "Consistency today builds confidence tomorrow.",
  "Focus on what you can control — one decision at a time.",
  "Energy and health are gifts you create for yourself.",
  "Family and health are the true measures of wealth.",
  "Strong habits lead to a strong body and mind.",
  "Keep going — your future self will thank you.",
  "Don't let setbacks define you. Bounce back stronger.",
  "Discipline today creates freedom tomorrow.",
  "Celebrate progress — every step forward matters.",
  "Your mindset fuels your journey. Stay positive.",
  "The path to health is built with daily choices.",
  "Stay focused, stay patient, stay consistent.",
  "Life is better when you feel your best — keep pushing.",
];

interface JournalEntry {
  id: string;
  date: string;
  timestamp: number;
  content: string;
}

export default function GetInspiration() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [quote, setQuote] = useState("");
  const [currentEntry, setCurrentEntry] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const isListeningRef = useRef(false);

  // Load daily quote
  useEffect(() => {
    const today = new Date().toDateString();
    const storedQuote = localStorage.getItem("dailyQuote");
    const storedDate = localStorage.getItem("quoteDate");

    let finalQuote = "";

    if (storedQuote && storedDate === today) {
      finalQuote = storedQuote;
    } else {
      finalQuote =
        MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
      localStorage.setItem("dailyQuote", finalQuote);
      localStorage.setItem("quoteDate", today);
    }

    setQuote(finalQuote);

    // Dispatch "opened" event (500ms setTimeout)
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "get-inspiration-opened", event: "opened" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, []);

  // Load journal entries and setup voice recognition
  useEffect(() => {
    const stored = localStorage.getItem("dailyJournalEntries");
    if (stored) {
      try {
        setEntries(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load journal entries:", error);
      }
    }

    // Initialize Web Speech API
    let recognitionInstance: any = null;
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = "en-US";

      recognitionInstance.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join("");
        setCurrentEntry(transcript);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);

        if (event.error === "network") {
          console.log("Network error - auto-retrying...");
          setTimeout(() => {
            if (isListeningRef.current) {
              try {
                recognitionInstance.start();
              } catch (e) {
                console.log("Could not restart recognition:", e);
                setIsListening(false);
                isListeningRef.current = false;
              }
            }
          }, 1000);
        } else if (event.error === "not-allowed") {
          setIsListening(false);
          isListeningRef.current = false;
          toast({
            title: "Microphone access denied",
            description:
              "Please allow microphone access in your browser settings.",
            variant: "destructive",
          });
        } else if (event.error === "no-speech") {
          console.log("No speech detected, continuing...");
        } else {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognitionInstance.onend = () => {
        if (isListeningRef.current) {
          try {
            recognitionInstance.start();
          } catch (e) {
            setIsListening(false);
            isListeningRef.current = false;
          }
        }
      };

      setRecognition(recognitionInstance);
    }

    return () => {
      if (recognitionInstance) {
        try {
          recognitionInstance.stop();
        } catch (e) {
          // Already stopped
        }
      }
    };
  }, []);

  const getNewQuote = () => {
    // Dispatch "interacted" event
    const interactedEvent = new CustomEvent("walkthrough:event", {
      detail: { testId: "get-inspiration-interacted", event: "interacted" },
    });
    window.dispatchEvent(interactedEvent);

    const newQuote =
      MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
    setQuote(newQuote);
    localStorage.setItem("dailyQuote", newQuote);
    localStorage.setItem("quoteDate", new Date().toDateString());

    // Dispatch "completed" event after quote changes
    setTimeout(() => {
      const completedEvent = new CustomEvent("walkthrough:event", {
        detail: { testId: "get-inspiration-completed", event: "completed" },
      });
      window.dispatchEvent(completedEvent);
    }, 300);
  };

  const toggleListening = () => {
    if (!recognition) {
      toast({
        title: "Voice input not supported",
        description:
          "Your browser doesn't support voice input. Please type your entry.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      try {
        recognition.start();
        setIsListening(true);
        isListeningRef.current = true;
        toast({
          title: "Listening...",
          description:
            "Speak your thoughts and they'll appear in the text area.",
        });
      } catch (e) {
        console.error("Failed to start recognition:", e);
        toast({
          title: "Could not start voice input",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const saveEntry = () => {
    if (!currentEntry.trim()) {
      toast({
        title: "Empty entry",
        description: "Please write something before saving.",
        variant: "destructive",
      });
      return;
    }

    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: Date.now(),
      content: currentEntry,
    };

    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);
    localStorage.setItem("dailyJournalEntries", JSON.stringify(updatedEntries));
    setCurrentEntry("");

    toast({
      title: "Entry saved!",
      description: "Your journal entry has been saved successfully.",
    });

    // Dispatch "completed" event after journal entry saved
    setTimeout(() => {
      const completedEvent = new CustomEvent("walkthrough:event", {
        detail: { testId: "get-inspiration-completed", event: "completed" },
      });
      window.dispatchEvent(completedEvent);
    }, 300);
  };

  const deleteEntry = (id: string) => {
    const updatedEntries = entries.filter((entry) => entry.id !== id);
    setEntries(updatedEntries);
    localStorage.setItem("dailyJournalEntries", JSON.stringify(updatedEntries));

    toast({
      title: "Entry deleted",
      description: "Your journal entry has been removed.",
    });
  };

  const exportJournal = () => {
    if (entries.length === 0) {
      toast({
        title: "No entries to export",
        description: "Save some journal entries first!",
        variant: "destructive",
      });
      return;
    }

    const content = entries
      .map((entry) => `${entry.date}\n${"=".repeat(50)}\n${entry.content}\n\n`)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-journal-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Journal exported!",
      description: "Your journal has been downloaded as a text file.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Title */}
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Get Inspiration</span>
          </h1>

          <div className="ml-auto" />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-4xl mx-auto px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Daily Motivation Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6 mb-8"
        >
          <div className="text-center mb-4">
            <p className="text-lg text-semi-bold text-white">
              Inspirational Quotes to start your day
            </p>
          </div>

          {/* Quote Display */}
          <div
            data-testid="inspire-quote-display"
            className="bg-black/20 backdrop-blur-sm border border-white/30 rounded-xl p-6 mb-4 hover:bg-black/30 hover:border-orange-400/50 transition-all duration-300"
          >
            <p className="italic text-md text-white font-medium leading-relaxed text-center">
              "{quote}"
            </p>
          </div>

          {/* Get New Inspiration Button */}
          <button
            data-testid="inspire-new-quote-button"
            onClick={getNewQuote}
            className="bg-gradient-to-br from-black/90 via-orange-600 to-black/90 text-white p-4 rounded-xl shadow-2xl hover:shadow-2xl transform transition-all duration-200 w-full border-2 border-orange-300/0 hover:border-orange-300/90"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-2xl">🔄</span>
              <h3 className="font-semibold text-md">Get New Inspiration</h3>
            </div>
            <p className="text-xs opacity-90">
              Fresh motivation when you need it
            </p>
          </button>
        </motion.div>

        {/* Daily Health Journal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6 mb-8"
        >
          <div className="text-center mb-6">
            <div className="text-2xl mb-3">🧠</div>
            <h2 className="text-lg font-bold text-white mb-2">
              Daily Health Journal
            </h2>
            <p className="text-white/90 italic text-sm">
              "Free your mind, and the rest will follow."
            </p>
          </div>

          {/* Text Area */}
          <textarea
            data-testid="inspire-journal-input"
            value={currentEntry}
            onChange={(e) => setCurrentEntry(e.target.value)}
            placeholder="Speak or type your thoughts..."
            className="w-full h-48 bg-black/40 text-white rounded-xl border border-white/20 p-4 resize-none focus:outline-none focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/20 transition-all mb-4"
          />

          {/* Action Buttons */}
          <div className="flex gap-3 mb-4">
            <Button
              data-wt="journal-voice-input"
              onClick={toggleListening}
              className={`flex-1 ${
                isListening
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gradient-to-br from-black/90 via-orange-600 to-black/90"
              } text-white border-2 ${
                isListening ? "border-red-400" : "border-orange-300/40"
              } hover:border-orange-300/90 transition-all`}
              data-testid="button-mic"
            >
              <Mic
                className={`w-5 h-5 mr-2 ${isListening ? "animate-pulse" : ""}`}
              />
              {isListening ? "Stop Recording" : "Voice Input"}
            </Button>

            <Button
              data-testid="inspire-save-entry"
              onClick={saveEntry}
              className="flex-1 bg-gradient-to-br from-black/90 via-orange-600 to-black/90 text-white border-2 border-orange-300/40 hover:border-orange-300/90 transition-all"
            >
              <Save className="w-5 h-5 mr-2" />
              Save Entry
            </Button>
          </div>

          {/* Export Button */}
          {entries.length > 0 && (
            <Button
              onClick={exportJournal}
              className="w-full bg-gradient-to-br from-black/90 via-orange-600 to-black/90 text-white border-2 border-orange-300/40 hover:border-orange-300/90 transition-all"
              data-testid="button-export-journal"
            >
              <Download className="w-5 h-5 mr-2" />
              Export Journal as Text File
            </Button>
          )}
        </motion.div>

        {/* Journal Entries List */}
        {entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6"
          >
            <h2 className="text-xl font-semibold text-white mb-4">
              Past Entries
            </h2>
            <div data-testid="inspire-entries-list" className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-xl p-4 hover:bg-black/40 transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-orange-400 text-sm font-medium">
                      {entry.date}
                    </span>
                    <Button
                      onClick={() => deleteEntry(entry.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      data-testid={`button-delete-${entry.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-white/90 whitespace-pre-wrap">
                    {entry.content}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
