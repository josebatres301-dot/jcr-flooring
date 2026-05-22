const PDFDocument = require('pdfkit');

// ─── Layout constants ────────────────────────────────────────────────────────
const W  = 612;
const M  = 40;
const CW = W - 2 * M;   // 532

// ITEMS col widened to 140 (was 108) to prevent long labels from clipping.
// DESCRIPTION shrunk by 32 to compensate. Sum: 140+166+45+90+91 = 532.
const COLS    = [140, 166, 45, 90, 91];
const HEADERS = ['ITEMS', 'DESCRIPTION', 'QTY', 'PRICE', 'AMOUNT'];

// ─── Colors ──────────────────────────────────────────────────────────────────
const NAVY  = '#0f2d5e';
const BLUE  = '#1565c0';
const ACC   = '#2563eb';
const LBLUE = '#dbeafe';
const MUTED = '#64748b';
const DARK  = '#0f172a';
const GLT   = '#f8fafc';
const GMED  = '#e2e8f0';

const money = n =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── PDF generation ───────────────────────────────────────────────────────────
function buildPDF(data) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 0, size: 'LETTER' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = 0;

    // ── Top accent line ──────────────────────────────────────────────────────
    doc.rect(0, y, W, 4).fill(ACC);
    y += 4;

    // ── Navy header ──────────────────────────────────────────────────────────
    const HDR_H = 96;
    doc.rect(0, y, W, HDR_H).fill(NAVY);

    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
       .text('JCR Flooring LLC', M, y + 16, { lineBreak: false });
    doc.fillColor('#93c5fd').font('Helvetica').fontSize(10)
       .text('Jose Cigarroa', M, y + 34, { lineBreak: false });
    doc.text('3517 N Park Pl · Wichita, KS 67204', M, y + 47, { lineBreak: false });

    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22)
       .text('INVOICE', M, y + 12, { width: CW, align: 'right', lineBreak: false });

    doc.fillColor('#60a5fa').font('Helvetica-Bold').fontSize(8)
       .text('INVOICE #', M, y + 48, { width: CW - 72, align: 'right', lineBreak: false });
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
       .text(data.invoiceNum, W - M - 68, y + 46, { width: 68, align: 'right', lineBreak: false });

    doc.fillColor('#60a5fa').font('Helvetica-Bold').fontSize(8)
       .text('DATE', M, y + 64, { width: CW - 72, align: 'right', lineBreak: false });
    doc.fillColor('#ffffff').font('Helvetica').fontSize(10)
       .text(data.date, W - M - 68, y + 62, { width: 68, align: 'right', lineBreak: false });

    y += HDR_H;

    // ── Blue amount banner ───────────────────────────────────────────────────
    const BNR_H = 52;
    doc.rect(0, y, W, BNR_H).fill(BLUE);
    doc.fillColor('#93c5fd').font('Helvetica-Bold').fontSize(8)
       .text('AMOUNT DUE', M, y + 10, { lineBreak: false });
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24)
       .text(money(data.amount), M, y + 20, { lineBreak: false });
    y += BNR_H;

    // ── Bill To / Job Site boxes ─────────────────────────────────────────────
    const BX_Y = y + 12;
    const BX_H = 64;
    const BX_W = (CW - 10) / 2;

    doc.rect(M, BX_Y, BX_W, BX_H).fillAndStroke(GLT, GMED);
    doc.fillColor(ACC).font('Helvetica-Bold').fontSize(8)
       .text('BILL TO', M + 10, BX_Y + 10, { lineBreak: false });
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
       .text(data.builderCompany || '', M + 10, BX_Y + 24, { width: BX_W - 20, lineBreak: false });

    const BX2 = M + BX_W + 10;
    doc.rect(BX2, BX_Y, BX_W, BX_H).fillAndStroke(GLT, GMED);
    doc.fillColor(ACC).font('Helvetica-Bold').fontSize(8)
       .text('JOB SITE', BX2 + 10, BX_Y + 10, { lineBreak: false });
    const streetOnly = (data.address || '').split(' · ')[0];
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
       .text(streetOnly, BX2 + 10, BX_Y + 24, { width: BX_W - 20, lineBreak: false });
    if (data.city) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
         .text(data.city, BX2 + 10, BX_Y + 40, { width: BX_W - 20, lineBreak: false });
    }

    y = BX_Y + BX_H + 14;

    // ── Line items table ─────────────────────────────────────────────────────
    const TBL_HDR_H = 22;
    const ROW_H     = 22;

    // Header row
    doc.rect(M, y, CW, TBL_HDR_H).fill(NAVY);
    let cx = M;
    HEADERS.forEach((h, i) => {
      const align = i >= 2 ? 'right' : 'left';
      doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(8)
         .text(h, cx + 5, y + 7, { width: COLS[i] - 10, align, lineBreak: false });
      cx += COLS[i];
    });
    y += TBL_HDR_H;

    // Data rows
    const items = Array.isArray(data.lineItems) ? data.lineItems : [];
    if (items.length === 0) {
      doc.rect(M, y, CW, ROW_H).fill('#ffffff');
      doc.fillColor(MUTED).font('Helvetica').fontSize(10)
         .text('No line items', M, y + 6, { width: CW, align: 'center', lineBreak: false });
      y += ROW_H;
    } else {
      items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f0f7ff';
        doc.rect(M, y, CW, ROW_H).fill(bg);

        const cells = [
          item.itemLabel || item.item || item.desc || '',
          item.detail    || '',
          String(item.displayQty ?? item.qty ?? ''),
          money(item.unitPrice  ?? item.price  ?? 0),
          money(item.amount     ?? 0),
        ];

        let cx2 = M;
        cells.forEach((val, i) => {
          const align = i >= 2 ? 'right' : 'left';
          const color  = (i === 0 || i === 4) ? DARK  : MUTED;
          const font   = (i === 0 || i === 4) ? 'Helvetica-Bold' : 'Helvetica';

          // Shrink-to-fit for ITEMS column only — never wrap, never grow row height
          let cellSize = 9;
          if (i === 0) {
            const maxW = COLS[0] - 10;
            let sz = 9;
            while (sz > 7 && doc.font('Helvetica-Bold').fontSize(sz).widthOfString(val) > maxW) {
              sz--;
            }
            cellSize = sz;
          }

          doc.fillColor(color).font(font).fontSize(cellSize)
             .text(val, cx2 + 5, y + 7, { width: COLS[i] - 10, align, lineBreak: false });
          cx2 += COLS[i];
        });

        doc.strokeColor(GMED).lineWidth(0.5)
           .moveTo(M, y + ROW_H).lineTo(M + CW, y + ROW_H).stroke();
        y += ROW_H;
      });
    }

    // ── Notes ────────────────────────────────────────────────────────────────
    if (data.notes) {
      y += 8;
      doc.strokeColor(GMED).lineWidth(0.5)
         .moveTo(M, y).lineTo(M + CW, y).stroke();
      y += 8;
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9)
         .text('NOTES: ', M, y, { continued: true });
      doc.font('Helvetica').text(data.notes);
      y = doc.y + 8;
    }

    // ── Total Due box ────────────────────────────────────────────────────────
    y += 12;
    const TOT_W = 220;
    const TOT_H = 34;
    const TOT_X = M + CW - TOT_W;
    doc.rect(TOT_X, y, TOT_W, TOT_H).fill(NAVY);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
       .text('TOTAL DUE', TOT_X + 12, y + 10, { lineBreak: false });
    doc.fillColor(LBLUE).font('Helvetica-Bold').fontSize(14)
       .text(money(data.amount), TOT_X + 12, y + 8, { width: TOT_W - 24, align: 'right', lineBreak: false });
    y += TOT_H + 16;

    // ── Footer ───────────────────────────────────────────────────────────────
    const FOOT_Y = Math.max(y + 10, 726);
    doc.strokeColor(LBLUE).lineWidth(2)
       .moveTo(M, FOOT_Y).lineTo(M + CW, FOOT_Y).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
       .text('Thank you for your business. Please remit payment upon receipt.', M, FOOT_Y + 10, { lineBreak: false });
    doc.text('jcrflooringllc@gmail.com · JCR Flooring LLC · Wichita, KS 67204', M, FOOT_Y + 22, { lineBreak: false });

    // ── Bottom accent line ───────────────────────────────────────────────────
    doc.rect(0, 788, W, 4).fill(ACC);

    doc.end();
  });
}

module.exports = { buildPDF };
