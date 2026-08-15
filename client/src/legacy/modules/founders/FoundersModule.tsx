// Founders Module for My Perfect Meals (MPM)
// Style: black glass, rounded-2xl, subtle borders, shadow-2xl
// Stack: React + TypeScript, Tailwind, shadcn/ui, lucide-react

import React, { useEffect, useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Camera, Mic, UploadCloud, Check, Quote, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// --------------------------------------
// Types
// --------------------------------------
export type Cohort = "ALPHA" | "BETA";
export type MediaType = "none" | "image" | "audio" | "video";

export interface FounderTestimonial {
  id: string;
  userId: string;
  name: string;
  cohort: Cohort;
  quote: string;
  photoUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  isFeatured?: boolean;
  createdAt?: string;
}

// --------------------------------------
// Black glass helper
// --------------------------------------
export const GlassCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (
  <div className={`rounded-2xl border border-white/10 bg-black/50 shadow-2xl ${className}`}>{children}</div>
);

// --------------------------------------
// API calls (wired to real backend)
// --------------------------------------
async function fetchFounders(): Promise<FounderTestimonial[]> {
  const response = await fetch(apiUrl("/api/founders"));
  const data = await response.json();
  return data.testimonials || [];
}

async function createFounderConsent(params: {
  userId: string;
  cohort: Cohort;
  hasConsented: boolean;
}): Promise<{ success: boolean }> {
  return await apiRequest("/api/founders/consent", {
    method: "POST",
    body: JSON.stringify(params),
    headers: { "Content-Type": "application/json" },
  });
}

async function uploadToStorage(file: File): Promise<string> {
  // Create form data for file upload
  const formData = new FormData();
  formData.append("file", file);
  
  // Upload to your server's upload endpoint
  const response = await fetch(apiUrl("/api/uploads"), {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error("Upload failed");
  }
  
  const data = await response.json();
  return data.url; // Returns the public URL
}

async function submitFounderTestimonial(payload: {
  userId: string;
  name: string;
  cohort: Cohort;
  quote: string;
  photoUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
}): Promise<{ success: boolean }> {
  return await apiRequest("/api/founders", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

// --------------------------------------
// 1) Founders Section — public display
// --------------------------------------
export const FoundersSection: React.FC<{ title?: string; subtitle?: string }> = ({
  title = "Meet the Founders",
  subtitle = "The early believers who helped build My Perfect Meals.",
}) => {
  const [items, setItems] = useState<FounderTestimonial[] | null>(null);

  useEffect(() => {
    fetchFounders().then(setItems);
  }, []);

  return (
    <section className="container mx-auto px-4 py-8 md:py-12 text-white">
      <div className="mb-6 md:mb-10">
        <h2 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Sparkles className="w-6 h-6" /> {title}
        </h2>
        <p className="text-white/70 mt-2">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {(items ?? []).map((f) => (
          <GlassCard key={f.id} className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-white/10">
                <AvatarImage src={f.photoUrl} alt={f.name} />
                <AvatarFallback>{f.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">{f.name}</h3>
                  <Badge className="bg-white/10 border border-white/20 text-white">
                    {f.cohort === "ALPHA" ? "Alpha Founder" : "Beta Founder"}
                  </Badge>
                </div>
                <div className="text-xs text-white/60 mt-1">
                  {f.isFeatured && <span className="text-yellow-400">⭐ Featured</span>}
                </div>
              </div>
            </div>

            <blockquote className="mt-4 text-white/90 relative pl-6">
              <Quote className="w-4 h-4 absolute left-0 top-1 text-white/40" />
              {f.quote}
            </blockquote>

            {f.videoUrl && (
              <video className="mt-4 rounded-xl border border-white/10 w-full" controls src={f.videoUrl} />
            )}
            {f.audioUrl && (
              <audio className="mt-4 w-full" controls src={f.audioUrl} />
            )}
          </GlassCard>
        ))}
      </div>
    </section>
  );
};

// --------------------------------------
// 2) Submit Founder Testimonial — Week 3
// --------------------------------------
export const SubmitFounderTestimonial: React.FC<{ userId: string; defaultName: string; cohort: Cohort }> = ({ userId, defaultName, cohort }) => {
  const [name, setName] = useState(defaultName);
  const [quote, setQuote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("none");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    try {
      setUploading(true);
      setProgress(10);
      let photoUrl: string | undefined;
      let videoUrl: string | undefined;
      let audioUrl: string | undefined;

      if (photoFile) {
        setProgress(25);
        photoUrl = await uploadToStorage(photoFile);
      }

      if (mediaFile && mediaType !== "none") {
        setProgress(60);
        const mediaUrl = await uploadToStorage(mediaFile);
        if (mediaType === "video") videoUrl = mediaUrl;
        if (mediaType === "audio") audioUrl = mediaUrl;
      }

      setProgress(85);
      await submitFounderTestimonial({
        userId,
        name,
        cohort,
        quote,
        photoUrl,
        videoUrl,
        audioUrl,
      });
      setProgress(100);
      setDone(true);
    } catch (e) {
      console.error(e);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="container mx-auto px-4 py-8 text-white">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold">Founder Testimonial</h2>
        <p className="text-white/70 mt-2">Week 3 wrap-up — share your story and be featured permanently in My Perfect Meals.</p>
      </div>

      <GlassCard className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-white/70">Your Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 bg-transparent text-white border-white/20" />

            <div className="mt-4">
              <label className="text-sm text-white/70">Your Quote (2–3 sentences)</label>
              <Textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={5} className="mt-2 bg-transparent text-white border-white/20" placeholder="What changed for you while using MPM?" />
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/70">Profile Photo (required)</label>
              <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} className="mt-2 cursor-pointer" />
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/70">Optional Testimonial Media</label>
              <div className="flex items-center gap-4 mt-2">
                <select value={mediaType} onChange={(e) => setMediaType(e.target.value as MediaType)} className="bg-transparent border border-white/20 rounded-lg px-3 py-2">
                  <option value="none">None</option>
                  <option value="audio">Audio (MP3/M4A)</option>
                  <option value="video">Video (MP4/MOV)</option>
                </select>
                <Input type="file" accept={mediaType === "audio" ? "audio/*" : mediaType === "video" ? "video/*" : undefined} disabled={mediaType === "none"} onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)} className="cursor-pointer" />
              </div>
              <p className="text-xs text-white/50 mt-2">Tip: Keep videos under 60–90s. Say your name, your goal, and what MPM changed for you.</p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              {!done ? (
                <Button onClick={handleSubmit} disabled={uploading || !photoFile || !quote} className="bg-white/10 hover:bg-white/20 border border-white/20">
                  <UploadCloud className="w-4 h-4 mr-2" /> Submit
                </Button>
              ) : (
                <Badge className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"><Check className="w-3 h-3 mr-1" />Submitted</Badge>
              )}
              {uploading && <Progress value={progress} className="w-40" />}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm text-white/70">Preview</div>
            <GlassCard className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 ring-2 ring-white/10">
                  <AvatarImage src={photoFile ? URL.createObjectURL(photoFile) : undefined} />
                  <AvatarFallback>{name.slice(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">{name || "Your Name"}</h3>
                    <Badge className="bg-white/10 border border-white/20 text-white">
                      {cohort === "ALPHA" ? "Alpha Founder" : "Beta Founder"}
                    </Badge>
                  </div>
                </div>
              </div>
              <blockquote className="mt-4 text-white/90 relative pl-6">
                <Quote className="w-4 h-4 absolute left-0 top-1 text-white/40" />
                {quote || "Your 2–3 sentence story shows up here."}
              </blockquote>
            </GlassCard>
          </div>
        </div>
      </GlassCard>
    </section>
  );
};

// --------------------------------------
// 3) Onboarding End Slide — Consent + Reminder
// --------------------------------------
export const OnboardingEndSlide: React.FC<{ userId: string; cohort: Cohort; onFinish: () => void }> = ({ userId, cohort, onFinish }) => {
  const [hasConsented, setHasConsented] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAgree() {
    setSaving(true);
    await createFounderConsent({ userId, cohort, hasConsented });
    setSaving(false);
    setDone(true);
    onFinish();
  }

  return (
    <section className="container mx-auto px-4 py-8 text-white">
      <GlassCard className="p-6">
        <h2 className="text-xl md:text-2xl font-semibold">Be a Founder</h2>
        <p className="text-white/70 mt-2">
          You're part of the inner circle. At the end of Week 3, we'll invite you to submit a short quote and photo (optional audio/video) to be
          featured permanently in the <span className="font-semibold text-white">Founders</span> section.
        </p>

        <div className="flex items-center gap-3 mt-5">
          <Switch checked={hasConsented} onCheckedChange={setHasConsented} />
          <span className="text-white/80 text-sm">It's okay to email or message me at Week 3 with the submission link.</span>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleAgree} disabled={saving} className="bg-white/10 hover:bg-white/20 border border-white/20">
            I'm in — remind me at Week 3
          </Button>
          {done && <Badge className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"><Check className="w-3 h-3 mr-1" />Saved</Badge>}
        </div>
      </GlassCard>

      <div className="mt-6 text-sm text-white/60">
        You'll keep your lifetime tester rate. Submitting your story is optional, but featured Founders tend to inspire the next wave to succeed.
      </div>
    </section>
  );
};

export default FoundersSection;
