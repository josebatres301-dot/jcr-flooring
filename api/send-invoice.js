const nodemailer  = require('nodemailer');
const { google }  = require('googleapis');
const { buildPDF } = require('./_buildPdf');
// Native fetch is available in Node 18+ (Vercel default runtime)

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
    const emailMessage = body.emailMessage || '';

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
      allReceiptUrls.map(async (url, i) => {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        } catch (e) {
          console.error(`[send-invoice] receipt[${i}] fetch failed:`, e.message);
          return null; // skip this image; still send the email
        }
      })
    );

    // 5. Build subject + body text
    const subject = invoiceList.map(d => d.invoiceNum).join(' + ');
    const defaultMsg = invoiceList.length === 1
      ? `Please find attached invoice ${invoiceList[0].invoiceNum} for ${invoiceList[0].address}.`
      : `Please find attached ${invoiceList.length} invoices: ${subject}.\n\nAddresses:\n${invoiceList.map(d=>`• ${d.invoiceNum}: ${d.address}`).join('\n')}`;
    const bodyText = (emailMessage ? emailMessage + '\n\n' : '') + defaultMsg + '\n\nThank you for your business. — JCR Flooring LLC';

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
    console.error('[send-invoice] fatal:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
