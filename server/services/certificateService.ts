import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

interface CertificateOptions {
  name: string;
  certType: string;
  certificateNumber: string;
  completedAt: Date;
}

// Template image: 2000 × 1545 px — almost exactly matches landscape LETTER (792 × 612).
// The template already has everything baked in: logo, borders, seal, real signature,
// competency icons, all fixed text. We overlay ONLY the three dynamic fields:
//   1. Recipient name
//   2. Certification number
//   3. Date issued
// We first paint a cream rectangle over each placeholder, then render the real value.

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

    // ── TEMPLATE BACKGROUND ──
    const tplPath = path.join(process.cwd(), "server", "assets", "cert-template-professional.png");
    if (fs.existsSync(tplPath)) {
      doc.image(tplPath, 0, 0, { width: W, height: H });
    } else {
      // Fallback: plain cream background so the PDF is never blank
      doc.rect(0, 0, W, H).fill("#F7F2E7");
      doc.fillColor("#CC0000").font("Helvetica-Bold").fontSize(14)
        .text("Certificate template not found — contact support.", 50, 280, { width: W - 100 });
    }

    const CREAM = "#F7F2E7";
    const NAVY  = "#0F1F3D";

    // ── OVERLAY 1: RECIPIENT NAME ──
    // Covers the faded placeholder at ~30–43 % height, centered.
    const nameY1 = H * 0.30;
    const nameY2 = H * 0.43;
    const nameH  = nameY2 - nameY1;
    const nameX  = W * 0.13;
    const nameW  = W * 0.74;
    doc.rect(nameX, nameY1, nameW, nameH).fill(CREAM);

    // Render name — Times-BoldItalic is the most elegant built-in PDFKit script-style font.
    doc.fillColor(NAVY).font("Times-BoldItalic").fontSize(46);
    const textH = 46 * 1.2;
    const nameCenterY = nameY1 + (nameH - textH) / 2;
    doc.text(opts.name, nameX, nameCenterY, {
      width: nameW,
      align: "center",
      lineBreak: false,
    });

    // ── OVERLAY 2: CERTIFICATION NUMBER ──
    // Covers "MPCP-2026-0001" at ~71 % height, left column.
    const fieldY  = H * 0.710;
    const fieldH  = H * 0.060;
    const cnX     = W * 0.150;
    const cnW     = W * 0.195;
    doc.rect(cnX, fieldY, cnW, fieldH).fill(CREAM);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(12)
      .text(opts.certificateNumber, cnX, fieldY + 4, {
        width: cnW,
        align: "left",
        lineBreak: false,
      });

    // ── OVERLAY 3: DATE ISSUED ──
    // Covers "May 30, 2026" at ~71 % height, right column.
    const dateStr = opts.completedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const dtRight = W * 0.91;
    const dtW     = W * 0.185;
    const dtX     = dtRight - dtW;
    doc.rect(dtX, fieldY, dtW, fieldH).fill(CREAM);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(12)
      .text(dateStr, dtX, fieldY + 4, {
        width: dtW,
        align: "right",
        lineBreak: false,
      });

    doc.end();
  });
}
