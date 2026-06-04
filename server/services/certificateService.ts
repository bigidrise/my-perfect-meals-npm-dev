import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

interface CertificateOptions {
  name: string;
  certType: string;
  certificateNumber: string;
  completedAt: Date;
}

function certTypeLabel(certType: string): string {
  if (certType === "affiliate_coaching") return "Business & Coaching Affiliate";
  return "Social & Referral Affiliate";
}

export function generateCertificatePDF(opts: CertificateOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      layout: "landscape",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 792;
    const H = 612;

    const NAVY  = "#0F1F3D";
    const GOLD  = "#C9A84C";
    const CREAM = "#F8F5EE";
    const BROWN = "#8B7355";
    const DARK  = "#0F1F3D";

    // ── BACKGROUND ──
    doc.rect(0, 0, W, H).fill(CREAM);

    // ── FRAME ──
    // Outer navy border
    doc.rect(0, 0, W, H).lineWidth(7).stroke(NAVY);
    // Gold inner borders
    doc.rect(11, 11, W - 22, H - 22).lineWidth(1.5).stroke(GOLD);
    doc.rect(15, 15, W - 30, H - 30).lineWidth(0.5).stroke(GOLD);

    // Corner diamond ornaments (drawn as rotated squares)
    const drawCornerDiamond = (cx: number, cy: number) => {
      doc.save();
      doc.translate(cx, cy);
      doc.rotate(45);
      doc.rect(-7, -7, 14, 14).fill(GOLD);
      doc.restore();
    };
    drawCornerDiamond(3.5, 3.5);
    drawCornerDiamond(W - 3.5, 3.5);
    drawCornerDiamond(3.5, H - 3.5);
    drawCornerDiamond(W - 3.5, H - 3.5);

    // ── NAVY HEADER ──
    doc.rect(0, 0, W, 68).fill(NAVY);

    // "MPM" in gold
    doc.fillColor(GOLD).font("Times-BoldItalic").fontSize(28)
      .text("MPM", 310, 20, { width: 60, align: "center" });

    // Gold separator line
    doc.moveTo(376, 18).lineTo(376, 54).lineWidth(0.8).stroke(`${GOLD}`);

    // "MY PERFECT MEALS"
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(14)
      .text("MY PERFECT MEALS", 384, 19, { characterSpacing: 2 });

    // "AI POWERED ADAPTIVE NUTRITION"
    doc.fillColor(GOLD).font("Helvetica").fontSize(7.5)
      .text("AI POWERED ADAPTIVE NUTRITION", 385, 40, { characterSpacing: 2.5 });

    // ── CERTIFIED PROFESSIONAL ──
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(30)
      .text("CERTIFIED PROFESSIONAL", 0, 84, {
        align: "center",
        width: W,
        characterSpacing: 4,
      });

    // Gold ornament rule
    const ruleY = 124;
    const ornamentX = W / 2;
    doc.moveTo(100, ruleY).lineTo(ornamentX - 16, ruleY).lineWidth(0.8).stroke(GOLD);
    doc.moveTo(ornamentX + 16, ruleY).lineTo(W - 100, ruleY).lineWidth(0.8).stroke(GOLD);
    doc.fillColor(GOLD).font("Helvetica").fontSize(10).text("✦", ornamentX - 8, ruleY - 7);

    // Cert type + CERTIFICATE OF COMPLETION
    const certTypeText = certTypeLabel(opts.certType).toUpperCase();
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(8)
      .text(`${certTypeText}   ·   CERTIFICATE OF COMPLETION`, 0, 132, {
        align: "center",
        width: W,
        characterSpacing: 2.5,
      });

    // "This certifies that"
    doc.fillColor(BROWN).font("Times-Italic").fontSize(11)
      .text("This certifies that", 0, 150, { align: "center", width: W });

    // ── RECIPIENT NAME (large, Times-Italic for elegance) ──
    doc.fillColor(NAVY).font("Times-BoldItalic").fontSize(42)
      .text(opts.name, 0, 166, { align: "center", width: W });

    // Gold name underline
    const nameWidth = Math.min(doc.widthOfString(opts.name) + 30, 460);
    const nameLineX = (W - nameWidth) / 2;
    const nameLineY = 222;
    doc.moveTo(nameLineX, nameLineY).lineTo(nameLineX + nameWidth, nameLineY)
      .lineWidth(0.8).stroke(GOLD);

    // "has successfully completed the"
    doc.fillColor(BROWN).font("Times-Italic").fontSize(11)
      .text("has successfully completed the", 0, 232, { align: "center", width: W });

    // Program name
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14)
      .text("My Perfect Meals Certification Program", 0, 250, { align: "center", width: W });

    // "and has demonstrated competency in:"
    doc.fillColor(BROWN).font("Times-Italic").fontSize(9.5)
      .text("and has demonstrated competency in:", 0, 271, { align: "center", width: W });

    // ── COMPETENCY LABELS (text-only row for PDF) ──
    const competencies = [
      "Adaptive Nutrition",
      "Protocol-Aware Nutrition",
      "Behavior Change Principles",
      "Lifestyle Integration",
      "Specialized Nutrition Systems",
      "MPM Platform Operations",
    ];
    const compColW = (W - 140) / 6;
    competencies.forEach((comp, i) => {
      const cx = 70 + i * compColW + compColW / 2;
      // Small gold circle
      doc.circle(cx, 295, 11).lineWidth(0.8).stroke(GOLD);
      // Label
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(5.5)
        .text(comp.toUpperCase(), cx - 28, 310, {
          width: 56,
          align: "center",
          characterSpacing: 0.3,
        });
    });

    // Description text
    doc.fillColor(BROWN).font("Times-Italic").fontSize(8.5)
      .text(
        "This certification recognizes the recipient's successful completion of all required coursework, practical exercises, case studies, and final assessments.",
        140, 332, { align: "center", width: W - 280, lineGap: 2 }
      );

    // ── DIVIDER ──
    doc.moveTo(70, 358).lineTo(W - 70, 358).lineWidth(0.4).stroke(`${GOLD}80`);

    // ── BOTTOM ROW: seal | cert# | signature | date ──

    // Gold seal (bottom left)
    const sealX = 100;
    const sealY = 410;
    const sealR = 36;
    doc.circle(sealX, sealY, sealR)
      .fillAndStroke("#B8960C", GOLD);
    doc.circle(sealX, sealY, sealR - 4)
      .lineWidth(0.5).stroke(`${NAVY}60`);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10)
      .text("MPM", sealX - 16, sealY - 14, { width: 32, align: "center" });
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(4.5)
      .text("MY PERFECT\nMEALS", sealX - 20, sealY - 1, { width: 40, align: "center" });
    doc.fillColor(NAVY).font("Helvetica").fontSize(7)
      .text("★  ★  ★", sealX - 16, sealY + 16, { width: 32, align: "center" });

    // Cert number (left column)
    const cnX = 158;
    const cnY = 380;
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7)
      .text("CERTIFICATION NUMBER", cnX, cnY, { characterSpacing: 1.5 });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text(opts.certificateNumber, cnX, cnY + 13);

    // Date issued (right column)
    const dtX = W - 170;
    const dateStr = opts.completedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7)
      .text("DATE ISSUED", dtX, cnY, { characterSpacing: 1.5 });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text(dateStr, dtX, cnY + 13);

    // ── SIGNATURE (center, large) ──
    const sigCenterX = W / 2;
    const sigPath = path.join(process.cwd(), "server", "assets", "cert-signature.png");
    if (fs.existsSync(sigPath)) {
      const sigW = 280;
      const sigH = 80;
      doc.image(sigPath, sigCenterX - sigW / 2, 362, {
        width: sigW,
        height: sigH,
        fit: [sigW, sigH],
      });
    }

    // Signature line
    doc.moveTo(sigCenterX - 115, 448)
      .lineTo(sigCenterX + 115, 448)
      .lineWidth(0.6)
      .stroke("#B8960C");

    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10)
      .text("IDRISE WARD-EL", 0, 454, { align: "center", width: W, characterSpacing: 1 });

    doc.fillColor(BROWN).font("Times-Italic").fontSize(9)
      .text("Founder & CEO  ·  My Perfect Meals", 0, 468, { align: "center", width: W });

    // ── NAVY FOOTER BANNER ──
    doc.rect(0, H - 30, W, 30).fill(NAVY);

    // Gold lines flanking footer text
    doc.moveTo(60, H - 15).lineTo(230, H - 15).lineWidth(0.6).stroke(GOLD);
    doc.moveTo(W - 230, H - 15).lineTo(W - 60, H - 15).lineWidth(0.6).stroke(GOLD);

    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(7.5)
      .text("AI POWERED ADAPTIVE NUTRITION BUILT FOR REAL LIFE", 0, H - 21, {
        align: "center",
        width: W,
        characterSpacing: 2.5,
      });

    doc.end();
  });
}
