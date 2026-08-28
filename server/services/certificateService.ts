import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

interface CertificateOptions {
  name: string;
  certType: string;
  certificateNumber: string;
  completedAt: Date;
}

const CERTIFICATE_TEMPLATES: Record<
  string,
  { fileName: string; nameTopPct: number; nameHeightPct: number }
> = {
  mpm_specialist: {
    fileName: "cert-template-specialist.png",
    nameTopPct: 0.3,
    nameHeightPct: 0.13,
  },
  default: {
    fileName: "cert-template-professional.png",
    nameTopPct: 0.3,
    nameHeightPct: 0.13,
  },
};

// Template image: 2000 × 1545 px — almost exactly landscape LETTER (792 × 612).
// New template: bottom cert-number and date areas are BLANK.
// Only the recipient name area has a faded ghost placeholder that needs covering.
//
// Bottom section layout (left → right):
//   [Gold Seal ~3–18%] | [CERT NUMBER ~19–36%] | [Signature center] | [DATE ~67–86%]

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

    const CREAM = "#F7F2E7";
    const NAVY  = "#0F1F3D";
    const GOLD  = "#C4973A";

    // ── TEMPLATE BACKGROUND ──
    const template =
      CERTIFICATE_TEMPLATES[opts.certType] ?? CERTIFICATE_TEMPLATES.default;
    const tplPath = path.join(
      process.cwd(),
      "server",
      "assets",
      template.fileName,
    );
    if (fs.existsSync(tplPath)) {
      doc.image(tplPath, 0, 0, { width: W, height: H });
    } else {
      doc.rect(0, 0, W, H).fill(CREAM);
      doc.fillColor("#CC0000").font("Helvetica-Bold").fontSize(14)
        .text("Certificate template missing — contact support.", 50, 280, { width: W - 100 });
    }

    // ── OVERLAY 1: RECIPIENT NAME ──
    // Cover the faded ghost placeholder, render name in elegant italic script.
    const nameTopPct = template.nameTopPct;
    const nameHeightPct = template.nameHeightPct;
    const nameX = W * 0.13;
    const nameW = W * 0.74;
    const nameY = H * nameTopPct;
    const nameH = H * nameHeightPct;

    doc.rect(nameX, nameY, nameW, nameH).fill(CREAM);

    doc.fillColor(NAVY).font("Times-BoldItalic").fontSize(44);
    const lineH = 44 * 1.2;
    const nameCenterY = nameY + (nameH - lineH) / 2;
    doc.text(opts.name, nameX, nameCenterY, {
      width: nameW,
      align: "center",
      lineBreak: false,
    });

    // ── OVERLAY 2: CERTIFICATION NUMBER ──
    // Bottom-left column, right of seal. Template is blank — no cover needed.
    const fieldLabelY = H * 0.74;
    const fieldValueY = H * 0.78;
    const cnX = W * 0.19;
    const cnW = W * 0.17;

    // Label
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(6)
      .text("CERTIFICATION NUMBER", cnX, fieldLabelY, {
        width: cnW,
        align: "left",
        characterSpacing: 0.8,
        lineBreak: false,
      });

    // Value
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11)
      .text(opts.certificateNumber, cnX, fieldValueY, {
        width: cnW,
        align: "left",
        lineBreak: false,
      });

    // ── OVERLAY 3: DATE ISSUED ──
    // Bottom-right column. Template is blank — no cover needed.
    const dateStr = opts.completedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const dtW = W * 0.16;
    const dtX = W * 0.62; // moved toward center (right:22% equivalent)

    // Label
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(6)
      .text("DATE ISSUED", dtX, fieldLabelY, {
        width: dtW,
        align: "right",
        characterSpacing: 0.8,
        lineBreak: false,
      });

    // Value
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11)
      .text(dateStr, dtX, fieldValueY, {
        width: dtW,
        align: "right",
        lineBreak: false,
      });

    doc.end();
  });
}
