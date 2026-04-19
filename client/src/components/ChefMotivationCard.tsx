import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChefHat, Star } from "lucide-react";

const MOTIVATION_QUOTES = [
  "The secret to change? Start before you’re ready.",
  "You can’t pour from an empty cup — fuel yourself first.",
    "Excuses burn zero calories. Action does.",
    "Progress doesn’t demand perfection — only persistence.",
    "Invest in your health like it’s your most valuable asset — because it is.",
    "Momentum is built, not found. Keep building.",
    "Healthy choices compound faster than bad ones — stack them daily.",
  "Healthy isn’t a look — it’s a lifestyle you build daily.",
    "Don’t rush the process; greatness grows in silence.",
    "When your habits align with your goals, success becomes automatic.",
    "The hardest reps are the ones that reshape you.",
    "You have the power to reset any moment — just begin again.",
    "Your body follows where your mind leads. Think strong.",
    "One day, your discipline will be your inspiration.",
  "Feed your focus, and your results will follow.",
    "Your plate is your blueprint for progress.",
    "You don’t need a new start — just the next step.",
    "Consistency turns effort into transformation.",
    "Stay loyal to your routine, even when no one’s watching.",
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
  "Don’t let setbacks define you. Bounce back stronger.",
  "Discipline today creates freedom tomorrow.",
  "Celebrate progress — every step forward matters.",
  "Your mindset fuels your journey. Stay positive.",
  "The path to health is built with daily choices.",
  "Stay focused, stay patient, stay consistent.",
  "Life is better when you feel your best — keep pushing."
];


const ChefMotivationCard: React.FC = () => {
  const [quote, setQuote] = useState("");

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
  }, []);

  return (
    <div className="bg-gradient-to-r from-black via-cyan-800 to-black rounded-xl shadow-2xl shadow-black/80 p-6 text-white relative overflow-hidden hover:shadow-2xl hover:shadow-black/90 transform transition-all duration-200">
      {/* Decorative animated stars */}
      <div className="absolute top-2 left-4 text-yellow-200 text-xl animate-pulse">
        ✨
      </div>
      <div
        className="absolute top-3 right-6 text-yellow-200 text-xl animate-pulse"
        style={{ animationDelay: "0.5s" }}
      >
        ✨
      </div>
      <div
        className="absolute bottom-2 left-6 text-yellow-200 text-xl animate-pulse"
        style={{ animationDelay: "1s" }}
      >
        ✨
      </div>
      <div
        className="absolute bottom-3 right-4 text-yellow-200 text-xl animate-pulse"
        style={{ animationDelay: "1.5s" }}
      >
        ✨
      </div>

      <div className="text-center mb-4 relative">
        <div className="text-3xl mb-2">💪 ✨ 💪</div>
        <h2 className="text-2xl font-bold mb-2">
          Daily Motivation 
        </h2>
        <p className="text-base opacity-90 text-white">
          Inspirational Quotes to start your day
        </p>
      </div>

      {/* Glassmorphism content for the daily quote */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/30 rounded-xl p-6 mb-4 hover:bg-black/30 hover:border-1 transition-all duration-300 cursor-pointer relative border-2 border-orange-300/0 hover:border-emerald-500/90">
        <div className="text-center">
          <p className="italic text-xl text-white font-medium leading-relaxed">
            "{quote}"
          </p>
        </div>
      </div> 

      {/* Glass button */}
      <button
        onClick={() => {
          // Generate a new quote immediately
          const newQuote =
            MOTIVATION_QUOTES[
              Math.floor(Math.random() * MOTIVATION_QUOTES.length)
            ];
          setQuote(newQuote);
          localStorage.setItem("dailyQuote", newQuote);
          localStorage.setItem("quoteDate", new Date().toDateString());
        }}
        className="bg-gradient-to-br from-black/90 via-orange-800 to-black/90 text-white p-4 rounded-xl shadow-2xl shadow-black/80 hover:shadow-2xl hover:shadow-black/90 transform transition-all duration-200 text-center w-full relative border-2 border-orange-300/0 hover:border-orange-300/90"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">🔄</span>
          <h3 className="font-semibold text-lg">Get New Inspiration</h3>
        </div>
        <p className="text-xs opacity-90">Fresh motivation when you need it</p>
      </button>
    </div>
  );
};

export default ChefMotivationCard;
