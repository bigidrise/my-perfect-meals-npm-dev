import React from "react";
import { DollarSign, Clock, TrendingUp, ChevronRight, ArrowLeft, CheckCircle2 } from "lucide-react";

function BeforeCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <p className="text-xs text-white/50 leading-relaxed">{body}</p>
    </div>
  );
}

function AfterCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-5 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 space-y-2">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <p className="text-xs text-white/65 leading-relaxed">{body}</p>
    </div>
  );
}

function AckBefore() {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
      <div className="w-5 h-5 rounded-md border-2 border-white/20 flex-shrink-0 mt-0.5" />
      <span className="text-xs text-white/45 leading-relaxed">
        I understand the 30% commission structure and the 24-month commission window.
      </span>
    </div>
  );
}

function AckAfter() {
  return (
    <div className="p-4 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 flex items-start gap-3">
      <div className="w-5 h-5 rounded-md border-2 border-white/25 flex-shrink-0 mt-0.5" />
      <span className="text-xs text-white/70 leading-relaxed">
        I understand the 30% commission structure and the 24-month commission window.
      </span>
    </div>
  );
}

function BeforeColumn() {
  return (
    <div className="flex flex-col h-full min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white">
      {/* Label */}
      <div className="bg-red-500/80 text-white text-xs font-bold text-center py-1.5 tracking-wide uppercase">
        Before — via-orange-600 + bg-white/5
      </div>

      {/* Fake header */}
      <div className="bg-black/40 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </div>
        <div>
          <p className="text-sm font-bold">Affiliate Program</p>
          <p className="text-xs text-white/40">How it works — read before you apply</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
        {/* Hero */}
        <div className="text-center py-2 space-y-1">
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">My Perfect Meals</p>
          <h1 className="text-xl font-black leading-tight">Affiliate Program Overview</h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Understand the economics before you activate. No surprises, no fine print buried at the end.
          </p>
        </div>

        {/* Cards */}
        <BeforeCard
          title="Commission Structure"
          body="Earn a percentage of qualifying subscription payments for every active customer you refer. Commission rate: 30%. Period: 24 months per customer."
        />
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Direct Revenue</p>
              <p className="text-xs text-white/50 leading-relaxed">Revenue from coaching, training, or consulting. Typically where professionals earn the most.</p>
            </div>
          </div>
        </div>
        <BeforeCard
          title="Why 24 Months?"
          body="Most affiliate and sales commission programs pay once, or for one year at most. Our 24-month structure rewards you for bringing quality customers."
        />

        {/* Timeline week-by-week */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <p className="text-xs font-bold text-white">Partnership Timeline</p>
          {["Week 1–2: Initial consultation and scoping", "Week 3–4: Brand integration and white-label setup", "Week 5–6: Technical build and QA testing", "Week 7–8: Soft launch with your founding members"].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] text-orange-400 font-bold">{i + 1}</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>

        {/* Acknowledgment */}
        <div className="p-4 rounded-2xl bg-black/40 border border-orange-500/30 space-y-3">
          <h2 className="text-sm font-bold text-white">Before You Continue</h2>
          <p className="text-xs text-white/40">Confirm that you have read and understood the following. All three are required.</p>
          <div className="space-y-2">
            <AckBefore />
            <AckBefore />
          </div>
        </div>

        {/* CTA */}
        <div
          className="w-full p-4 rounded-2xl font-bold text-sm flex items-center justify-between"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}
        >
          <span>Choose Your Affiliate Path</span>
          <ChevronRight className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AfterColumn() {
  return (
    <div className="flex flex-col h-full min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 text-white">
      {/* Label */}
      <div className="bg-green-600/80 text-white text-xs font-bold text-center py-1.5 tracking-wide uppercase">
        After — via-orange-900/60 + bg-black/50
      </div>

      {/* Fake header */}
      <div className="bg-black/55 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </div>
        <div>
          <p className="text-sm font-bold">Affiliate Program</p>
          <p className="text-xs text-white/55">How it works — read before you apply</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
        {/* Hero */}
        <div className="text-center py-2 space-y-1">
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">My Perfect Meals</p>
          <h1 className="text-xl font-black leading-tight">Affiliate Program Overview</h1>
          <p className="text-sm text-white/65 leading-relaxed">
            Understand the economics before you activate. No surprises, no fine print buried at the end.
          </p>
        </div>

        {/* Cards */}
        <AfterCard
          title="Commission Structure"
          body="Earn a percentage of qualifying subscription payments for every active customer you refer. Commission rate: 30%. Period: 24 months per customer."
        />
        <div className="p-4 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Direct Revenue</p>
              <p className="text-xs text-white/65 leading-relaxed">Revenue from coaching, training, or consulting. Typically where professionals earn the most.</p>
            </div>
          </div>
        </div>
        <AfterCard
          title="Why 24 Months?"
          body="Most affiliate and sales commission programs pay once, or for one year at most. Our 24-month structure rewards you for bringing quality customers."
        />

        {/* Timeline week-by-week */}
        <div className="p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 space-y-3">
          <p className="text-xs font-bold text-white">Partnership Timeline</p>
          {["Week 1–2: Initial consultation and scoping", "Week 3–4: Brand integration and white-label setup", "Week 5–6: Technical build and QA testing", "Week 7–8: Soft launch with your founding members"].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] text-orange-400 font-bold">{i + 1}</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>

        {/* Acknowledgment */}
        <div className="p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-orange-500/30 space-y-3">
          <h2 className="text-sm font-bold text-white">Before You Continue</h2>
          <p className="text-xs text-white/55">Confirm that you have read and understood the following. All three are required.</p>
          <div className="space-y-2">
            <AckAfter />
            <AckAfter />
          </div>
        </div>

        {/* CTA */}
        <div
          className="w-full p-4 rounded-2xl font-bold text-sm flex items-center justify-between"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.30)" }}
        >
          <span>Choose Your Affiliate Path</span>
          <ChevronRight className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function BusinessCenterShellPreview() {
  return (
    <div className="flex h-screen bg-black">
      {/* Before */}
      <div className="flex-1 overflow-hidden border-r border-white/20">
        <BeforeColumn />
      </div>
      {/* After */}
      <div className="flex-1 overflow-hidden">
        <AfterColumn />
      </div>
    </div>
  );
}
