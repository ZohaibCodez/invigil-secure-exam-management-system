import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, LineCapStyle, type RGB } from "pdf-lib";
import QRCode from "qrcode";
import type { AnswerData, QuestionData } from "@workspace/db";
import { LOGO_ON_DARK_PNG, LOGO_ON_DARK_SIZE } from "./brand-logo";

export type ReportInput = {
  examTitle: string; subject: string; startsAt: Date; endsAt: Date; passPercent: number;
  candidateName: string; candidateEmail: string;
  attemptId: string; score: number; totalMarks: number; submittedAt: Date | null; issuedAt: Date;
  voided: boolean; verificationToken: string; verificationUrl: string;
  questions: QuestionData[]; answers: AnswerData[];
};

// Brand palette (logo navy and orange) plus neutral greys.
const C = {
  navy: rgb(0.043, 0.102, 0.188), navySoft: rgb(0.925, 0.937, 0.957), orange: rgb(0.969, 0.376, 0.102),
  orangeSoft: rgb(0.996, 0.945, 0.918), green: rgb(0.133, 0.525, 0.369), greenSoft: rgb(0.906, 0.961, 0.937),
  ink: rgb(0.09, 0.13, 0.2), muted: rgb(0.42, 0.46, 0.53), faint: rgb(0.62, 0.65, 0.7),
  line: rgb(0.878, 0.894, 0.918), panel: rgb(0.969, 0.973, 0.98), white: rgb(1, 1, 1), track: rgb(0.906, 0.918, 0.937),
};
const W = 595, H = 842, M = 40, CW = W - M * 2;

// Standard PDF fonts are WinAnsi only: normalise punctuation, drop anything else.
const safe = (t: string) => t
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...")
  .replace(/[·•]/g, "-").replace(/[^\x20-\x7E -ÿ]/g, " ").replace(/\s+/g, " ").trim();

function wrap(text: string, font: PDFFont, size: number, max: number, maxLines = 99) {
  const words = safe(text).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= max) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    while (font.widthOfTextAtSize(cur, size) > max) { // hard-break very long tokens (URLs, IDs)
      let i = cur.length; while (i > 1 && font.widthOfTextAtSize(cur.slice(0, i), size) > max) i--;
      lines.push(cur.slice(0, i)); cur = cur.slice(i);
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1]!.replace(/\s*\S*$/, "") + "..."; }
  return lines;
}

/** Rounded rectangle; (x, y) is the bottom-left corner in PDF coordinates. */
function roundRect(page: PDFPage, x: number, y: number, w: number, h: number, r: number, opts: { fill?: RGB; stroke?: RGB; strokeWidth?: number }) {
  const p = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(p, { x, y: y + h, color: opts.fill, borderColor: opts.stroke, borderWidth: opts.stroke ? (opts.strokeWidth ?? 0.8) : 0 });
}

const fmt = (d: Date | null) => d
  ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d) + " PKT"
  : "Not recorded";
const TYPE = { single: "Single choice", multiple: "Multi-select", written: "Written" } as const;
const round1 = (n: number) => Math.round(n * 10) / 10;

export async function buildReportPdf(d: ReportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const logo = await pdf.embedPng(Buffer.from(LOGO_ON_DARK_PNG, "base64"));
  const pct = d.totalMarks ? round1(d.score / d.totalMarks * 100) : 0;
  const passed = !d.voided && pct >= d.passPercent;
  const accent = d.voided ? C.muted : passed ? C.green : C.orange;

  const text = (page: PDFPage, t: string, x: number, y: number, size: number, font = sans, color = C.ink) =>
    page.drawText(safe(t), { x, y, size, font, color });
  const right = (page: PDFPage, t: string, xr: number, y: number, size: number, font = sans, color = C.ink) =>
    text(page, t, xr - font.widthOfTextAtSize(safe(t), size), y, size, font, color);

  // ---------- page scaffolding ----------
  let page = pdf.addPage([W, H]);
  let y = 0;
  const firstHeader = () => {
    page.drawRectangle({ x: 0, y: H - 112, width: W, height: 112, color: C.navy });
    page.drawRectangle({ x: 0, y: H - 116, width: W, height: 4, color: C.orange });
    const lh = 42, lw = lh * LOGO_ON_DARK_SIZE.width / LOGO_ON_DARK_SIZE.height;
    page.drawImage(logo, { x: M, y: H - 56 - lh / 2, width: lw, height: lh });
    right(page, "EXAMINATION RESULT REPORT", W - M, H - 48, 9.5, bold, C.white);
    right(page, "Verified record issued by Examora", W - M, H - 63, 8.5, sans, rgb(0.78, 0.81, 0.86));
    right(page, `Issued ${fmt(d.issuedAt)}`, W - M, H - 76, 8.5, sans, rgb(0.78, 0.81, 0.86));
    y = H - 150;
  };
  const contHeader = () => {
    page.drawRectangle({ x: 0, y: H - 46, width: W, height: 46, color: C.navy });
    page.drawRectangle({ x: 0, y: H - 49, width: W, height: 3, color: C.orange });
    const lh = 24, lw = lh * LOGO_ON_DARK_SIZE.width / LOGO_ON_DARK_SIZE.height;
    page.drawImage(logo, { x: M, y: H - 23 - lh / 2, width: lw, height: lh });
    right(page, wrap(`${d.examTitle} - ${d.candidateName}`, sans, 8.5, 300, 1)[0] ?? "", W - M, H - 27, 8.5, sans, rgb(0.78, 0.81, 0.86));
    y = H - 78;
  };
  const newPage = () => { page = pdf.addPage([W, H]); contHeader(); };
  const ensure = (need: number) => { if (y - need < 72) newPage(); };
  const section = (title: string) => {
    ensure(40);
    text(page, title, M, y, 12, bold);
    page.drawRectangle({ x: M, y: y - 8, width: 26, height: 2, color: C.orange });
    y -= 26;
  };

  firstHeader();

  // ---------- title ----------
  for (const l of wrap(d.examTitle, bold, 21, CW, 2)) { text(page, l, M, y, 21, bold); y -= 26; }
  text(page, `${d.subject || "Examination"}  -  Window ${fmt(d.startsAt)} to ${fmt(d.endsAt)}`, M, y + 4, 9, sans, C.muted);
  y -= 22;

  // ---------- details card ----------
  const cardH = 92;
  roundRect(page, M, y - cardH, CW, cardH, 10, { fill: C.panel, stroke: C.line });
  const cols = [M + 18, M + 18 + CW / 3, M + 18 + (CW * 2) / 3];
  const field = (label: string, value: string, x: number, top: number, font = sans) => {
    text(page, label.toUpperCase(), x, top, 7, bold, C.faint);
    const v = wrap(value, font, 9.5, CW / 3 - 26, 1)[0] ?? "";
    text(page, v, x, top - 14, 9.5, font, C.ink);
  };
  field("Candidate", d.candidateName, cols[0]!, y - 22, bold);
  field("Email", d.candidateEmail, cols[1]!, y - 22);
  field("Submitted", fmt(d.submittedAt), cols[2]!, y - 22);
  field("Pass threshold", `${d.passPercent}%`, cols[0]!, y - 60);
  field("Report issued", fmt(d.issuedAt), cols[1]!, y - 60);
  field("Report ID", d.verificationToken.slice(0, 12).toUpperCase(), cols[2]!, y - 60, mono);
  y -= cardH + 22;

  // ---------- score panel ----------
  const sH = 128;
  roundRect(page, M, y - sH, CW, sH, 12, { fill: C.white, stroke: C.line });
  page.drawRectangle({ x: M, y: y - sH + 12, width: 4, height: sH - 24, color: accent });
  // ring chart
  const cx = M + 82, cy = y - sH / 2, r = 40;
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: C.track, borderWidth: 10 });
  const frac = Math.max(0, Math.min(1, pct / 100));
  if (frac > 0) {
    if (frac >= 0.999) page.drawCircle({ x: cx, y: cy, size: r, borderColor: accent, borderWidth: 10 });
    else {
      const a = frac * 2 * Math.PI, ex = r * Math.sin(a), ey = -r * Math.cos(a);
      page.drawSvgPath(`M 0 ${-r} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`,
        { x: cx, y: cy, borderColor: accent, borderWidth: 10, borderLineCap: LineCapStyle.Round });
    }
  }
  const pctLabel = `${pct}%`;
  text(page, pctLabel, cx - bold.widthOfTextAtSize(pctLabel, 16) / 2, cy - 2, 16, bold);
  text(page, "SCORE", cx - bold.widthOfTextAtSize("SCORE", 6.5) / 2, cy - 14, 6.5, bold, C.faint);
  // score figures
  const sx = M + 160;
  text(page, "FINAL SCORE", sx, y - 34, 7.5, bold, C.faint);
  const big = `${round1(d.score)}`;
  text(page, big, sx, y - 74, 38, bold);
  text(page, `/ ${round1(d.totalMarks)} marks`, sx + bold.widthOfTextAtSize(big, 38) + 8, y - 72, 12, sans, C.muted);
  const answered = d.questions.filter(q => (d.answers.find(a => a.questionId === q.id)?.value ?? "").replace(/[\[\]"\s]/g, "") !== "").length;
  text(page, `${answered} of ${d.questions.length} questions answered`, sx, y - 96, 9, sans, C.muted);
  // outcome badge
  const badge = d.voided ? "VOIDED" : passed ? "PASS" : "BELOW PASS MARK";
  const bw = bold.widthOfTextAtSize(badge, 10) + 28, bx = W - M - 22 - bw, by = y - 54;
  roundRect(page, bx, by, bw, 26, 13, { fill: d.voided ? C.panel : passed ? C.greenSoft : C.orangeSoft });
  text(page, badge, bx + 14, by + 9, 10, bold, accent);
  right(page, d.voided ? "Voided by examination staff" : `Pass mark ${d.passPercent}%`, W - M - 22, by - 18, 8.5, sans, C.muted);
  y -= sH + 30;

  // ---------- performance by topic ----------
  const topics = new Map<string, { got: number; max: number }>();
  for (const q of d.questions) {
    const t = topics.get(q.category) ?? { got: 0, max: 0 };
    t.got += d.answers.find(a => a.questionId === q.id)?.score ?? 0; t.max += q.marks;
    topics.set(q.category, t);
  }
  if (topics.size) {
    section("Performance by topic");
    for (const [name, t] of topics) {
      ensure(22);
      const share = t.max ? t.got / t.max : 0;
      text(page, wrap(name, sans, 9.5, 150, 1)[0] ?? "", M, y, 9.5);
      roundRect(page, M + 165, y - 1, 250, 7, 3.5, { fill: C.track });
      if (share > 0) roundRect(page, M + 165, y - 1, Math.max(7, 250 * share), 7, 3.5, { fill: share >= d.passPercent / 100 ? C.green : C.orange });
      right(page, `${round1(t.got)} / ${round1(t.max)}  (${Math.round(share * 100)}%)`, W - M, y, 9, bold);
      y -= 20;
    }
    y -= 12;
  }

  // ---------- question breakdown ----------
  section("Question breakdown");
  const X = { n: M + 10, q: M + 36, type: M + 352, score: W - M - 10 };
  const tableHead = () => {
    roundRect(page, M, y - 8, CW, 22, 6, { fill: C.navySoft });
    text(page, "#", X.n, y, 7.5, bold, C.muted);
    text(page, "QUESTION", X.q, y, 7.5, bold, C.muted);
    text(page, "TYPE", X.type, y, 7.5, bold, C.muted);
    right(page, "SCORE", X.score, y, 7.5, bold, C.muted);
    y -= 24;
  };
  tableHead();
  d.questions.forEach((q, i) => {
    const ans = d.answers.find(a => a.questionId === q.id);
    const got = ans?.score ?? 0;
    const qLines = wrap(q.text, sans, 9, 300, 3);
    const fb = ans?.feedback ? wrap(`Feedback: ${ans.feedback}`, italic, 8, 300, 3) : [];
    const rowH = 14 + qLines.length * 12 + fb.length * 10.5 + (fb.length ? 4 : 0);
    if (y - rowH < 72) { newPage(); tableHead(); }
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - rowH + 10, width: CW, height: rowH, color: C.panel });
    text(page, String(i + 1).padStart(2, "0"), X.n, y - 2, 9, bold, C.faint);
    let ly = y - 2;
    for (const l of qLines) { text(page, l, X.q, ly, 9); ly -= 12; }
    for (const l of fb) { text(page, l, X.q, ly - 2, 8, italic, C.muted); ly -= 10.5; }
    text(page, TYPE[q.type], X.type, y - 2, 8.5, sans, C.muted);
    right(page, `${round1(got)} / ${q.marks}`, X.score, y - 2, 9.5, bold);
    const share = q.marks ? got / q.marks : 0;
    roundRect(page, X.score - 56, y - 13, 56, 4, 2, { fill: C.track });
    if (share > 0) roundRect(page, X.score - 56, y - 13, Math.max(4, 56 * share), 4, 2, { fill: share >= 0.999 ? C.green : share >= 0.5 ? C.navy : C.orange });
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.5, color: C.line });
  });
  y -= 18;

  // ---------- verification ----------
  ensure(128);
  const vH = 112;
  roundRect(page, M, y - vH, CW, vH, 12, { fill: C.orangeSoft, stroke: rgb(0.98, 0.82, 0.74) });
  const qr = await pdf.embedPng(await QRCode.toBuffer(d.verificationUrl, { width: 240, margin: 1, color: { dark: "#0B1A30", light: "#FFFFFF" } }));
  roundRect(page, M + 14, y - vH + 14, 84, 84, 8, { fill: C.white });
  page.drawImage(qr, { x: M + 18, y: y - vH + 18, width: 76, height: 76 });
  const vx = M + 116, vw = CW - 132;
  text(page, "Verify this report", vx, y - 26, 12, bold);
  let vy = y - 42;
  for (const l of wrap("Scan the QR code or open the link below. The public verification page confirms the examination, score and issue date, and shows only the candidate's initials.", sans, 8.5, vw, 3)) { text(page, l, vx, vy, 8.5, sans, C.muted); vy -= 11; }
  for (const l of wrap(d.verificationUrl, bold, 8, vw, 2)) { text(page, l, vx, vy - 3, 8, bold, C.orange); vy -= 10; }
  text(page, `ID ${d.verificationToken}`, vx, vy - 6, 6.5, mono, C.muted);
  y -= vH;

  // ---------- footers ----------
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 50 }, end: { x: W - M, y: 50 }, thickness: 0.5, color: C.line });
    p.drawText("Examora - Examination with confidence", { x: M, y: 36, size: 7.5, font: bold, color: C.muted });
    p.drawText(safe("Generated from server-recorded submission data. Any alteration invalidates this report."), { x: M, y: 25, size: 7, font: sans, color: C.faint });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: W - M - sans.widthOfTextAtSize(label, 7.5), y: 36, size: 7.5, font: sans, color: C.muted });
  });

  pdf.setTitle(safe(`Examora result - ${d.examTitle} - ${d.candidateName}`));
  pdf.setAuthor("Examora"); pdf.setProducer("Examora"); pdf.setCreator("Examora");
  pdf.setSubject("Verified examination result report");
  return pdf.save();
}
