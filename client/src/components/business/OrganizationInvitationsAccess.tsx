import { useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, FileSpreadsheet, Loader2, Mail, QrCode, RefreshCw, Send, Upload, UserPlus, Users } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Population = "client" | "professional";
type EntryMode = "one" | "paste" | "csv";
type InvitationContext = "standard" | "pilot";

interface Recipient {
  email: string;
  firstName?: string;
  lastName?: string;
}

interface ReviewResult {
  counts: { total: number; valid: number; duplicates: number; existingMembers: number; invalid: number };
  valid: Array<Recipient & { row: number; displayName: string | null }>;
  duplicates: Array<{ row: number; email: string; reason: string }>;
  existingMembers: Array<{ row: number; email: string; reason: string }>;
  invalid: Array<{ row: number; email: string; reason: string }>;
  capacity: number;
  availableCapacity: number;
  overCapacity: number;
}

interface InvitationSummary {
  id: string;
  email: string;
  status?: string;
  expiresAt: string;
  role?: string;
  token?: string;
}

interface Props {
  businessId: string;
  businessName: string;
  pilot: {
    id: string;
    professionalCapacity: number;
    clientCapacity: number;
    durationDays: number;
  } | null;
  isDesktop: boolean;
  teamInvitations: InvitationSummary[];
  patientInvitations: InvitationSummary[];
  onRefresh: () => void;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): Recipient[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/\s+/g, ""));
  const emailIndex = headers.indexOf("email");
  if (emailIndex < 0) throw new Error("CSV must include an Email column.");
  const firstIndex = headers.indexOf("firstname");
  const lastIndex = headers.indexOf("lastname");
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return {
      email: cells[emailIndex] ?? "",
      firstName: firstIndex >= 0 ? cells[firstIndex] : undefined,
      lastName: lastIndex >= 0 ? cells[lastIndex] : undefined,
    };
  });
}

function parsePastedEmails(text: string): Recipient[] {
  return text
    .split(/[\n,;]+/)
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

export default function OrganizationInvitationsAccess({
  businessId,
  businessName,
  pilot,
  isDesktop,
  teamInvitations,
  patientInvitations,
  onRefresh,
}: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [population, setPopulation] = useState<Population>("client");
  const [invitationContext, setInvitationContext] = useState<InvitationContext>("standard");
  const [mode, setMode] = useState<EntryMode>("one");
  const [role, setRole] = useState("client");
  const [accessDurationDays, setAccessDurationDays] = useState<7 | 14 | 30>(30);
  const [singleEmail, setSingleEmail] = useState("");
  const [singleFirstName, setSingleFirstName] = useState("");
  const [singleLastName, setSingleLastName] = useState("");
  const [pasted, setPasted] = useState("");
  const [csvRecipients, setCsvRecipients] = useState<Recipient[]>([]);
  const [csvName, setCsvName] = useState("");
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [resendingToken, setResendingToken] = useState<string | null>(null);

  const invitations = population === "client" ? patientInvitations : teamInvitations;
  const recipients = useMemo(() => {
    if (mode === "one") {
      return singleEmail.trim()
        ? [{ email: singleEmail, firstName: singleFirstName, lastName: singleLastName }]
        : [];
    }
    return mode === "paste" ? parsePastedEmails(pasted) : csvRecipients;
  }, [csvRecipients, mode, pasted, singleEmail, singleFirstName, singleLastName]);

  const selectPopulation = (next: Population) => {
    setPopulation(next);
    setRole(next === "client" ? "client" : "staff");
    setReview(null);
  };
  const usePilotContext = invitationContext === "pilot" && Boolean(pilot);

  const reviewRecipients = async () => {
    if (!usePilotContext) {
      const seen = new Set<string>();
      const valid: ReviewResult["valid"] = [];
      const duplicates: ReviewResult["duplicates"] = [];
      const invalid: ReviewResult["invalid"] = [];
      recipients.forEach((recipient, index) => {
        const email = recipient.email.trim().toLowerCase();
        const row = index + 1;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          invalid.push({ row, email, reason: "Valid email required." });
          return;
        }
        if (seen.has(email)) {
          duplicates.push({ row, email, reason: "Duplicate in this batch." });
          return;
        }
        seen.add(email);
        const displayName = [recipient.firstName, recipient.lastName].filter(Boolean).join(" ").trim() || null;
        valid.push({ ...recipient, email, row, displayName });
      });
      setReview({
        counts: {
          total: recipients.length,
          valid: valid.length,
          duplicates: duplicates.length,
          existingMembers: 0,
          invalid: invalid.length,
        },
        valid,
        duplicates,
        existingMembers: [],
        invalid,
        capacity: valid.length,
        availableCapacity: valid.length,
        overCapacity: 0,
      });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/business/pilots/${pilot!.id}/invitations/batch-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          recipients,
          populationType: population,
          participantRole: population === "client" ? "client" : role,
          trialDays: accessDurationDays,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not review recipients.");
      setReview(data);
    } catch (error) {
      toast({ title: "Review failed", description: error instanceof Error ? error.message : "Could not review recipients.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const sendInvitations = async () => {
    if (!review || review.counts.invalid || review.counts.duplicates || review.counts.existingMembers || review.overCapacity) return;
    setBusy(true);
    try {
      if (!usePilotContext) {
        let sent = 0;
        const failed: string[] = [];
        for (const recipient of review.valid) {
          const response = await fetch("/api/business/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            credentials: "include",
            body: JSON.stringify({
              email: recipient.email,
              recipientName: recipient.displayName,
              invitationType: population === "client" ? "client" : "team_member",
              role: population === "client" ? "staff" : role === "provider" ? "physician" : role,
              trialDays: accessDurationDays,
              programName: "My Perfect Meals Complimentary Access",
              sendEmail: true,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) sent += 1;
          else failed.push(`${recipient.email}: ${data.error || "Could not send invitation."}`);
        }
        toast({
          title: failed.length ? "Some invitations need attention" : "Invitations sent",
          description: failed.length ? `${sent} sent. ${failed[0]}` : `${sent} sent.`,
          variant: failed.length ? "destructive" : "default",
        });
        if (sent === 0) return;
        setReview(null);
        setSingleEmail("");
        setSingleFirstName("");
        setSingleLastName("");
        setPasted("");
        setCsvRecipients([]);
        setCsvName("");
        onRefresh();
        return;
      }
      const response = await fetch(`/api/business/pilots/${pilot!.id}/invitations/batch-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          recipients: review.valid,
          populationType: population,
          participantRole: population === "client" ? "client" : role,
          trialDays: accessDurationDays,
        }),
      });
      const data = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(data.error || "Could not send invitations.");
      toast({
        title: data.counts?.failed ? "Some invitations need attention" : "Invitations sent",
        description: `${data.counts?.sent ?? 0} sent${data.counts?.failed ? `, ${data.counts.failed} failed` : ""}.`,
        variant: data.counts?.failed ? "destructive" : "default",
      });
      setReview(null);
      setSingleEmail("");
      setSingleFirstName("");
      setSingleLastName("");
      setPasted("");
      setCsvRecipients([]);
      setCsvName("");
      onRefresh();
    } catch (error) {
      toast({ title: "Send failed", description: error instanceof Error ? error.message : "Could not send invitations.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const createShareLink = async () => {
    if (!pilot || !usePilotContext) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/clinic-pilot/links/${pilot.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ businessId, capacity: pilot.clientCapacity, accessDurationDays }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create patient link.");
      const link = `${window.location.origin}${data.joinPath}`;
      setShareLink(link);
      setQrDataUrl(await QRCode.toDataURL(link, { width: 420, margin: 2 }));
      await navigator.clipboard.writeText(link);
      toast({ title: "Patient link copied" });
    } catch (error) {
      toast({ title: "Link unavailable", description: error instanceof Error ? error.message : "Could not create patient link.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const resendInvitation = async (invitation: InvitationSummary) => {
    if (!invitation.token) {
      toast({ title: "Resend unavailable", description: "This invitation does not have a standard organization resend token.", variant: "destructive" });
      return;
    }
    setResendingToken(invitation.token);
    try {
      const response = await fetch(`/api/business/invitations/${invitation.token}/resend`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not resend this invitation.");
      toast({ title: "Invitation resent", description: "The email provider accepted the resend." });
      onRefresh();
    } catch (error) {
      toast({
        title: "Resend failed",
        description: error instanceof Error ? error.message : "Could not resend this invitation.",
        variant: "destructive",
      });
    } finally {
      setResendingToken(null);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(["Email,First Name,Last Name\npatient@example.com,Jamie,Smith\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "my-perfect-meals-invitation-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCsv = async (file: File) => {
    try {
      setCsvRecipients(parseCsv(await file.text()));
      setCsvName(file.name);
      setReview(null);
    } catch (error) {
      toast({ title: "CSV could not be read", description: error instanceof Error ? error.message : "Invalid CSV.", variant: "destructive" });
    }
  };

  return (
    <>
      <Card className="border border-white/10 !bg-black/70 p-4 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Organization control center</p>
            <h2 className="mt-1 text-lg font-bold">Invitations &amp; Access</h2>
            <p className="mt-1 text-sm text-white/60">
              Invite patients or team members, review recipients, and track access for {businessName}.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-500">
            Open Invitations &amp; Access
          </button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto border border-orange-500/25 bg-gray-950 text-white">
          <DialogHeader>
            <DialogTitle>Invitations &amp; Access — {businessName}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1">
                <button onClick={() => selectPopulation("client")} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${population === "client" ? "bg-orange-600" : "text-white/60"}`}>
                  Patients
                </button>
                <button onClick={() => selectPopulation("professional")} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${population === "professional" ? "bg-orange-600" : "text-white/60"}`}>
                  Team / Providers
                </button>
              </div>

              {pilot && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Invitation context</p>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-1">
                    <button
                      type="button"
                      onClick={() => { setInvitationContext("standard"); setReview(null); }}
                      className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${invitationContext === "standard" ? "bg-white text-black" : "text-white/60"}`}
                    >
                      Standard Organization
                    </button>
                    <button
                      type="button"
                      onClick={() => { setInvitationContext("pilot"); setReview(null); }}
                      className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${invitationContext === "pilot" ? "bg-blue-600 text-white" : "text-white/60"}`}
                    >
                      Pilot Program
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-white/50">
                    {invitationContext === "pilot"
                      ? "Uses pilot participant records, capacity, and reporting."
                      : "Uses the normal paid-organization invitation path."}
                  </p>
                </div>
              )}

              {population === "professional" && (
                <select value={role} onChange={(event) => { setRole(event.target.value); setReview(null); }} className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2.5 text-sm">
                  <option value="staff">Staff</option>
                  <option value="coach">Coach</option>
                  <option value="provider">Provider</option>
                  <option value="nurse">Nurse</option>
                </select>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Complimentary access</p>
                <div className="flex gap-2">
                  {([7, 14, 30] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => { setAccessDurationDays(days); setReview(null); }}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${accessDurationDays === days ? "bg-orange-600 text-white" : "bg-white/10 text-white/70"}`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/50">
                  Begins when each {population === "client" ? "patient accepts or enrolls" : "team member accepts"}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setMode("one"); setReview(null); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "one" ? "bg-white text-black" : "bg-white/10"}`}><UserPlus className="mr-1 inline h-3.5 w-3.5" />Invite One</button>
                {isDesktop ? (
                  <>
                    <button onClick={() => { setMode("paste"); setReview(null); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "paste" ? "bg-white text-black" : "bg-white/10"}`}><Mail className="mr-1 inline h-3.5 w-3.5" />Paste Emails</button>
                    <button onClick={() => { setMode("csv"); setReview(null); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mode === "csv" ? "bg-white text-black" : "bg-white/10"}`}><FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />Upload CSV</button>
                  </>
                ) : (
                  <span className="rounded-full bg-blue-500/10 px-3 py-1.5 text-xs text-blue-200">Bulk invitations — desktop recommended</span>
                )}
              </div>

              {mode === "one" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={singleEmail} onChange={(event) => { setSingleEmail(event.target.value); setReview(null); }} type="email" placeholder="Email address" className="sm:col-span-2 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm" />
                  <input value={singleFirstName} onChange={(event) => setSingleFirstName(event.target.value)} placeholder="First name (optional)" className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm" />
                  <input value={singleLastName} onChange={(event) => setSingleLastName(event.target.value)} placeholder="Last name (optional)" className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm" />
                </div>
              )}
              {mode === "paste" && isDesktop && (
                <textarea value={pasted} onChange={(event) => { setPasted(event.target.value); setReview(null); }} rows={8} placeholder={"Paste email addresses separated by commas or new lines"} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm" />
              )}
              {mode === "csv" && isDesktop && (
                <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-5 text-center">
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => event.target.files?.[0] && handleCsv(event.target.files[0])} />
                  <Upload className="mx-auto h-7 w-7 text-orange-300" />
                  <p className="mt-2 text-sm text-white/70">{csvName || "Choose a completed CSV file"}</p>
                  <div className="mt-3 flex justify-center gap-2">
                    <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold">Choose CSV</button>
                    <button onClick={downloadTemplate} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold"><Download className="mr-1 inline h-3.5 w-3.5" />Download Template</button>
                  </div>
                </div>
              )}

              {!review ? (
                <button disabled={busy || recipients.length === 0} onClick={reviewRecipients} className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold disabled:opacity-40">
                  Review {recipients.length || ""} Recipient{recipients.length === 1 ? "" : "s"}
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-white/15 bg-white/5 p-4">
                  <h3 className="font-semibold">Review recipients</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(review.counts).map(([label, count]) => (
                      <div key={label} className="rounded-lg bg-black/30 p-2 text-center"><p className="text-lg font-bold">{count}</p><p className="text-xs capitalize text-white/50">{label}</p></div>
                    ))}
                  </div>
                  <p className="text-xs text-white/60">
                    Access: {accessDurationDays} days per recipient
                    {usePilotContext ? ` · ${review.availableCapacity} pilot spaces available` : " · Standard organization invitation"}
                  </p>
                  {(review.duplicates.length > 0 || review.existingMembers.length > 0 || review.invalid.length > 0 || review.overCapacity > 0) && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                      Resolve {review.duplicates.length} duplicate/pending, {review.existingMembers.length} existing member, {review.invalid.length} invalid, and {review.overCapacity} over-capacity recipient(s) before sending.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setReview(null)} className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold">Edit</button>
                    <button disabled={busy || review.counts.invalid > 0 || review.counts.duplicates > 0 || review.counts.existingMembers > 0 || review.overCapacity > 0} onClick={sendInvitations} className="flex-1 rounded-xl bg-orange-600 py-3 text-sm font-semibold disabled:opacity-40"><Send className="mr-1 inline h-4 w-4" />Send Invitations</button>
                  </div>
                </div>
              )}

              {population === "client" && pilot && usePilotContext && (
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4">
                  <h3 className="font-semibold">Immediate patient access</h3>
                  <p className="mt-1 text-xs text-white/60">Create a secure clinic link for texting, handouts, or an in-person QR scan. Each enrollee receives {accessDurationDays} days.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={busy} onClick={createShareLink} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold"><Copy className="mr-1 inline h-3.5 w-3.5" />Copy Patient Link</button>
                    {qrDataUrl && <button onClick={() => setQrDataUrl(qrDataUrl)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold"><QrCode className="mr-1 inline h-3.5 w-3.5" />Show QR Code</button>}
                  </div>
                  {shareLink && <p className="mt-2 break-all text-[11px] text-blue-200/70">{shareLink.replace(/#token=.*/, "#token=••••••••")}</p>}
                  {qrDataUrl && <img src={qrDataUrl} alt="Secure patient enrollment QR code" className="mx-auto mt-4 w-52 rounded-xl bg-white p-3" />}
                </div>
              )}
            </section>

            <aside className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold"><Users className="mr-1.5 inline h-4 w-4" />Invitation status</h3>
                <span className="text-xs text-white/40">{invitations.length} total</span>
              </div>
              {invitations.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/45">No invitations yet.</div>
              ) : invitations.slice(0, 50).map((invitation) => (
                <div key={invitation.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <div className="mt-1 flex justify-between text-xs text-white/45">
                    <span className="capitalize">{(invitation.status || "pending").replace(/_/g, " ")}</span>
                    <span>{new Date(invitation.expiresAt).toLocaleDateString()}</span>
                  </div>
                  {invitation.token && ["pending", "expired", "delivery_failed"].includes(invitation.status || "pending") && (
                    <button
                      type="button"
                      onClick={() => resendInvitation(invitation)}
                      disabled={resendingToken === invitation.token}
                      className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40"
                    >
                      {resendingToken === invitation.token
                        ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                        : <RefreshCw className="mr-1 inline h-3.5 w-3.5" />}
                      Resend Email
                    </button>
                  )}
                </div>
              ))}
            </aside>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}