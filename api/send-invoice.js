const PDFDocument = require('pdfkit');
const nodemailer  = require('nodemailer');
const { google }  = require('googleapis');
const fetch       = require('node-fetch').default;

// ─── Layout constants ────────────────────────────────────────────────────────
const W  = 612;          // Letter width (pts)
const M  = 40;           // Left/right margin
const CW = W - 2 * M;   // Content width: 532

// Column widths mirror the web design (1.2fr 2.2fr 0.5fr 1fr 1fr / 5.9fr)
const COLS    = [108, 198, 45, 90, 91];
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

    // Left: company info
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
       .text('JCR Flooring LLC', M, y + 16, { lineBreak: false });
    doc.fillColor('#93c5fd').font('Helvetica').fontSize(10)
       .text('Jose Cigarroa', M, y + 34, { lineBreak: false });
    doc.text('3517 N Park Pl · Wichita, KS 67204', M, y + 47, { lineBreak: false });

    // Right: INVOICE title
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22)
       .text('INVOICE', M, y + 12, { width: CW, align: 'right', lineBreak: false });

    // Invoice # row
    doc.fillColor('#60a5fa').font('Helvetica-Bold').fontSize(8)
       .text('INVOICE #', M, y + 48, { width: CW - 72, align: 'right', lineBreak: false });
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
       .text(data.invoiceNum, W - M - 68, y + 46, { width: 68, align: 'right', lineBreak: false });

    // Date row
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
    const BX_H = 56;
    const BX_W = (CW - 10) / 2;

    // Bill To
    doc.rect(M, BX_Y, BX_W, BX_H).fillAndStroke(GLT, GMED);
    doc.fillColor(ACC).font('Helvetica-Bold').fontSize(8)
       .text('BILL TO', M + 10, BX_Y + 10, { lineBreak: false });
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
       .text(data.builderCompany || '', M + 10, BX_Y + 24, { width: BX_W - 20, lineBreak: false });

    // Job Site
    const BX2 = M + BX_W + 10;
    doc.rect(BX2, BX_Y, BX_W, BX_H).fillAndStroke(GLT, GMED);
    doc.fillColor(ACC).font('Helvetica-Bold').fontSize(8)
       .text('JOB SITE', BX2 + 10, BX_Y + 10, { lineBreak: false });
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
       .text(data.address || '', BX2 + 10, BX_Y + 24, { width: BX_W - 20, lineBreak: false });
    if (data.city) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
         .text(data.city, BX2 + 10, BX_Y + 38, { width: BX_W - 20, lineBreak: false });
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
          doc.fillColor(color).font(font).fontSize(9)
             .text(val, cx2 + 5, y + 7, { width: COLS[i] - 10, align, lineBreak: false });
          cx2 += COLS[i];
        });

        // Row divider
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

// ─── Vercel handler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Normalize: support both {invoices:[...]} bundle and legacy single-invoice format
    const invoiceList = body.invoices
      ? body.invoices
      : [body]; // legacy single-invoice

    const builderEmail = body.builderEmail || invoiceList[0]?.builderEmail;

    // 1. Generate a PDF for each invoice
    const pdfBuffers = await Promise.all(invoiceList.map(data => buildPDF(data)));

    // 2. Gmail OAuth2 access token
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
    );
    oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    const { token } = await oAuth2Client.getAccessToken();

    // 3. Nodemailer transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type:         'OAuth2',
        user:         process.env.GMAIL_FROM,
        clientId:     process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken:  token,
      },
    });

    // 4. Fetch receipt images from Firebase Storage URLs
    const allReceiptUrls = invoiceList.flatMap(d => d.receiptUrls || []);
    const receiptBuffers = await Promise.all(
      allReceiptUrls.map(url =>
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`Receipt fetch failed: ${r.status}`); return r.buffer(); })
          .catch(() => null)  // skip failed fetches rather than aborting the send
      )
    );

    // 5. Build subject + body text
    const subject = invoiceList.map(d => d.invoiceNum).join(' + ');
    const bodyText = invoiceList.length === 1
      ? `Please find attached invoice ${invoiceList[0].invoiceNum} for ${invoiceList[0].address}. Thank you for your business. — JCR Flooring LLC`
      : `Please find attached ${invoiceList.length} invoices: ${subject}.\n\nAddresses:\n${invoiceList.map(d=>`• ${d.invoiceNum}: ${d.address}`).join('\n')}\n\nThank you for your business. — JCR Flooring LLC`;

    // 6. Build attachment list: PDFs first, then receipt images
    const pdfAttachments = invoiceList.map((data, i) => ({
      filename:    `${data.invoiceNum}.pdf`,
      content:     pdfBuffers[i],
      contentType: 'application/pdf',
    }));
    const imgAttachments = receiptBuffers
      .map((buf, i) => {
        if (!buf) return null;
        const url = allReceiptUrls[i];
        const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return { filename: `Receipt-${i + 1}.${ext}`, content: buf, contentType: mime };
      })
      .filter(Boolean);

    // 7. Send one email with all attachments
    await transporter.sendMail({
      from:    `JCR Flooring LLC <${process.env.GMAIL_FROM}>`,
      to:      builderEmail,
      subject,
      text:    bodyText,
      attachments: [...pdfAttachments, ...imgAttachments],
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-invoice]', err);
    return res.status(500).json({ error: err.message });
  }
};
