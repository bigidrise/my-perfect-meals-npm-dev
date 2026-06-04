interface VisualCertificateProps {
  recipientName: string;
  certType: string;
  certificateNumber: string;
  completedAt: string;
}

function certTypeLabel(certType: string): string {
  if (certType === "affiliate_coaching") return "Business & Coaching Affiliate";
  return "Social & Referral Affiliate";
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function VisualCertificate({
  recipientName,
  certType,
  certificateNumber,
  completedAt,
}: VisualCertificateProps) {
  const label = certTypeLabel(certType);
  const dateStr = formatDate(completedAt);
  const sigUrl = "/api/certifications/assets/signature";

  return (
    <div className="overflow-x-auto w-full print:overflow-visible">
      {/* Certificate board — fixed landscape dimensions, scrollable on mobile */}
      <div
        className="relative bg-white mx-auto print:mx-0"
        style={{ width: 760, minWidth: 760, aspectRatio: "11 / 8.5" }}
      >
        {/* Outer orange border */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ border: "2px solid #EA580C", margin: 10 }}
        />
        {/* Inner peach border */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ border: "0.5px solid #FED7AA", margin: 15 }}
        />

        {/* Orange header bar */}
        <div
          className="absolute top-0 left-0 right-0 flex flex-col items-center justify-center"
          style={{ height: 80, background: "#EA580C" }}
        >
          <p
            className="text-white font-bold tracking-widest uppercase"
            style={{ fontSize: 20, letterSpacing: "0.18em" }}
          >
            MY PERFECT MEALS
          </p>
          <p className="text-white/80 mt-1" style={{ fontSize: 9 }}>
            Business Success Certification Program
          </p>
        </div>

        {/* Body */}
        <div
          className="absolute left-0 right-0 flex flex-col items-center"
          style={{ top: 90 }}
        >
          {/* Title */}
          <p
            className="font-bold tracking-widest uppercase text-center"
            style={{ color: "#EA580C", fontSize: 14, letterSpacing: "0.2em", marginTop: 14 }}
          >
            CERTIFICATE OF COMPLETION
          </p>

          {/* Thin rule */}
          <div
            className="self-stretch"
            style={{ height: 0.5, background: "#E5E7EB", margin: "10px 60px 0" }}
          />

          {/* This certifies that */}
          <p
            className="mt-3 text-center"
            style={{ color: "#9CA3AF", fontSize: 10 }}
          >
            This certifies that
          </p>

          {/* Recipient name */}
          <p
            className="font-bold text-center mt-1"
            style={{ color: "#111827", fontSize: 30, lineHeight: 1.15 }}
          >
            {recipientName}
          </p>

          {/* Name underline */}
          <div
            style={{
              height: 0.8,
              background: "#D1D5DB",
              width: Math.min(recipientName.length * 14, 420),
              marginTop: 4,
            }}
          />

          {/* Completion description */}
          <p
            className="mt-3 text-center"
            style={{ color: "#9CA3AF", fontSize: 10 }}
          >
            has successfully completed the
          </p>

          <p
            className="font-bold text-center mt-1"
            style={{ color: "#EA580C", fontSize: 13 }}
          >
            {label}
          </p>

          <p
            className="text-center mt-0.5"
            style={{ color: "#6B7280", fontSize: 10 }}
          >
            My Perfect Meals Business Success Certification
          </p>

          {/* Divider */}
          <div
            className="self-stretch"
            style={{ height: 0.5, background: "#E5E7EB", margin: "14px 60px 0" }}
          />

          {/* Cert number + date row */}
          <div
            className="flex w-full justify-between"
            style={{ padding: "10px 90px 0" }}
          >
            <div>
              <p
                className="font-bold uppercase tracking-widest"
                style={{ color: "#9CA3AF", fontSize: 7 }}
              >
                Certificate Number
              </p>
              <p
                className="font-bold font-mono mt-0.5"
                style={{ color: "#111827", fontSize: 11 }}
              >
                {certificateNumber}
              </p>
            </div>
            <div className="text-right">
              <p
                className="font-bold uppercase tracking-widest"
                style={{ color: "#9CA3AF", fontSize: 7 }}
              >
                Date Issued
              </p>
              <p
                className="font-bold mt-0.5"
                style={{ color: "#111827", fontSize: 11 }}
              >
                {dateStr}
              </p>
            </div>
          </div>

          {/* Signature zone */}
          <div
            className="flex flex-col items-center"
            style={{ marginTop: 20 }}
          >
            <img
              src={sigUrl}
              alt="Signature"
              style={{ height: 38, objectFit: "contain", marginBottom: 0 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div
              style={{ width: 220, height: 0.5, background: "#D1D5DB" }}
            />
            <p
              className="font-bold text-center mt-1"
              style={{ color: "#111827", fontSize: 10 }}
            >
              Coach Idrise Ward-EL
            </p>
            <p
              className="text-center"
              style={{ color: "#9CA3AF", fontSize: 8.5, marginTop: 1 }}
            >
              Founder &amp; CEO &nbsp;·&nbsp; My Perfect Meals
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
