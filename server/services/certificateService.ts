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
    const ORANGE = "#EA580C";
    const DARK = "#111827";
    const GRAY = "#6B7280";
    const LIGHT = "#9CA3AF";
    const RULE = "#E5E7EB";

    // White background
    doc.rect(0, 0, W, H).fill("#FFFFFF");

    // Outer decorative border
    doc.rect(14, 14, W - 28, H - 28).lineWidth(2).stroke(ORANGE);
    doc.rect(20, 20, W - 40, H - 40).lineWidth(0.5).stroke("#FED7AA");

    // Orange header
    doc.rect(0, 0, W, 88).fill(ORANGE);

    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(26)
      .text("MY PERFECT MEALS", 0, 22, { align: "center", width: W, characterSpacing: 3 });

    doc.fillColor("white").font("Helvetica").fontSize(10)
      .text("Business Success Certification Program", 0, 58, { align: "center", width: W });

    // Certificate of Completion title
    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(18)
      .text("CERTIFICATE OF COMPLETION", 0, 108, { align: "center", width: W, characterSpacing: 2 });

    // Thin divider
    doc.moveTo(80, 136).lineTo(W - 80, 136).lineWidth(0.5).stroke(RULE);

    // This certifies that
    doc.fillColor(LIGHT).font("Helvetica").fontSize(11)
      .text("This certifies that", 0, 152, { align: "center", width: W });

    // Recipient name
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(36)
      .text(opts.name, 0, 174, { align: "center", width: W });

    // Name underline
    const nameTextWidth = Math.min(doc.widthOfString(opts.name), 500);
    const nameLineX = (W - nameTextWidth) / 2;
    doc.moveTo(nameLineX, 222).lineTo(nameLineX + nameTextWidth, 222)
      .lineWidth(0.8).stroke("#D1D5DB");

    // Completion description
    doc.fillColor(LIGHT).font("Helvetica").fontSize(11)
      .text("has successfully completed the", 0, 234, { align: "center", width: W });

    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(14)
      .text(certTypeLabel(opts.certType), 0, 256, { align: "center", width: W });

    doc.fillColor(GRAY).font("Helvetica").fontSize(11)
      .text("My Perfect Meals Business Success Certification", 0, 278, { align: "center", width: W });

    // Divider
    doc.moveTo(80, 320).lineTo(W - 80, 320).lineWidth(0.5).stroke(RULE);

    // Certificate number + date
    const infoY = 336;
    const leftX = 130;
    const rightX = 510;

    doc.fillColor(LIGHT).font("Helvetica-Bold").fontSize(8)
      .text("CERTIFICATE NUMBER", leftX, infoY, { characterSpacing: 1 });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(12)
      .text(opts.certificateNumber, leftX, infoY + 14);

    const dateStr = opts.completedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.fillColor(LIGHT).font("Helvetica-Bold").fontSize(8)
      .text("DATE ISSUED", rightX, infoY, { characterSpacing: 1 });
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(12)
      .text(dateStr, rightX, infoY + 14);

    // Signature section
    const sigY = 430;
    const sigCenterX = W / 2;

    // Signature image if exists
    const sigPath = path.join(process.cwd(), "server", "assets", "cert-signature.png");
    if (fs.existsSync(sigPath)) {
      doc.image(sigPath, sigCenterX - 70, sigY - 44, { width: 140, height: 40, fit: [140, 40] });
    }

    // Signature line
    doc.moveTo(sigCenterX - 110, sigY).lineTo(sigCenterX + 110, sigY)
      .lineWidth(0.5).stroke("#D1D5DB");

    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text("Coach Idrise Ward-EL", 0, sigY + 8, { align: "center", width: W });

    doc.fillColor(LIGHT).font("Helvetica").fontSize(9)
      .text("Founder & CEO  ·  My Perfect Meals", 0, sigY + 24, { align: "center", width: W });

    doc.end();
  });
}
