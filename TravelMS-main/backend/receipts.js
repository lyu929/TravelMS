const multer = require('multer');
const sharp = require('sharp');
const crypto = require('node:crypto');
const { PDFDocument, PDFDict, PDFArray, PDFName } = require('pdf-lib');
const v = require('./validation');
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const receiptColumns =
  'r.receipt_id,r.file_name AS receipt_name,r.media_type AS receipt_type,r.byte_size AS receipt_size';

async function validateReceipt(file) {
  if (!file?.buffer?.length) v.fail(400, 'Choose a PNG, JPEG or PDF receipt.');
  if (file.buffer.length > MAX_RECEIPT_BYTES) v.fail(413, 'Receipts must be 5 MB or smaller.');
  const name = file.originalname.replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(-100);
  const extension = name.split('.').pop().toLowerCase();
  let content, mediaType;
  if (['png', 'jpg', 'jpeg'].includes(extension)) {
    const expected = extension === 'png' ? 'image/png' : 'image/jpeg';
    if (file.mimetype !== expected) v.fail(400, 'Receipt type does not match its file extension.');
    try {
      const image = sharp(file.buffer, { limitInputPixels: 20000000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (metadata.format !== (extension === 'png' ? 'png' : 'jpeg')) throw new Error('type');
      // Decode and re-encode to discard metadata and any trailing injected content.
      content = await (extension === 'png' ? image.png() : image.jpeg({ quality: 90 })).toBuffer();
      mediaType = expected;
    } catch {
      v.fail(400, 'This image could not be read. Choose a valid PNG or JPEG.');
    }
  } else if (extension === 'pdf') {
    if (file.mimetype !== 'application/pdf' || file.buffer.subarray(0, 5).toString() !== '%PDF-')
      v.fail(400, 'Choose a valid PDF receipt.');
    try {
      const pdf = await PDFDocument.load(file.buffer, { updateMetadata: false });
      if (!pdf.getPageCount() || pdf.getPageCount() > 50) throw new Error('pages');
      const forbidden = new Set(['JS', 'AA', 'OpenAction', 'EmbeddedFiles', 'RichMedia', 'XFA']);
      const visited = new Set();
      function check(object) {
        if (!object || visited.has(object)) return;
        visited.add(object);
        if (object instanceof PDFDict) {
          for (const key of object.keys()) {
            if (forbidden.has(key.decodeText())) throw new Error('active');
            check(object.get(key));
          }
          const action = object.get(PDFName.of('S'));
          if (
            action instanceof PDFName &&
            ['JavaScript', 'Launch', 'SubmitForm', 'ImportData', 'GoToR'].includes(
              action.decodeText(),
            )
          )
            throw new Error('active');
        } else if (object instanceof PDFArray) for (const value of object.asArray()) check(value);
        else if (object.dict) check(object.dict);
      }
      check(pdf.catalog);
      for (const [, object] of pdf.context.enumerateIndirectObjects()) check(object);
      content = Buffer.from(await pdf.save());
      mediaType = 'application/pdf';
    } catch {
      v.fail(
        400,
        'Choose a readable PDF with up to 50 pages, without passwords, scripts or attachments.',
      );
    }
  } else v.fail(400, 'Only PNG, JPEG and PDF receipts are supported.');
  if (content.length > MAX_RECEIPT_BYTES)
    v.fail(413, 'The processed receipt exceeds 5 MB. Choose a smaller file.');
  return {
    name,
    mediaType,
    content,
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

function mountReceipts(app, pool, { auth, route, transaction, tripAccess }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 0, parts: 1 },
  }).single('receipt');
  async function expenseAccess(c, req, lock = false) {
    const [[expense]] = await c.query(
      'SELECT * FROM expenses WHERE expense_id=?' + (lock ? ' FOR UPDATE' : ''),
      [v.id(req.params.id)],
    );
    if (!expense) v.fail(404, 'Expense not found.');
    await tripAccess(c, req, expense.trip_id, lock);
    return expense;
  }
  const beforeUpload = (req, res, next) => expenseAccess(pool, req).then(() => next(), next);
  const parseUpload = (req, res, next) =>
    upload(req, res, (error) => {
      if (error)
        return next(
          new v.HttpError(
            error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
            error.code === 'LIMIT_FILE_SIZE'
              ? 'Receipts must be 5 MB or smaller.'
              : 'Upload one receipt file without extra form fields.',
          ),
        );
      next();
    });
  app.put(
    '/api/expenses/:id/receipt',
    auth,
    beforeUpload,
    parseUpload,
    route(async (req, res) => {
      const file = await validateReceipt(req.file);
      const saved = await transaction(pool, async (c) => {
        const expense = await expenseAccess(c, req, true);
        await c.query(
          `INSERT INTO expense_receipts (expense_id,file_name,media_type,byte_size,sha256,content) VALUES (?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),media_type=VALUES(media_type),byte_size=VALUES(byte_size),sha256=VALUES(sha256),content=VALUES(content),created_at=UTC_TIMESTAMP()`,
          [
            expense.expense_id,
            file.name,
            file.mediaType,
            file.content.length,
            file.sha256,
            file.content,
          ],
        );
        const [[receipt]] = await c.query(
          'SELECT ' + receiptColumns + ' FROM expense_receipts r WHERE expense_id=?',
          [expense.expense_id],
        );
        return receipt;
      });
      res.json(saved);
    }),
  );
  app.get(
    '/api/expenses/:id/receipt',
    auth,
    route(async (req, res) => {
      const receipt = await transaction(pool, async (c) => {
        const expense = await expenseAccess(c, req, true);
        const [[file]] = await c.query('SELECT * FROM expense_receipts WHERE expense_id=?', [
          expense.expense_id,
        ]);
        if (!file) v.fail(404, 'No receipt has been attached to this expense.');
        return file;
      });
      res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'; sandbox");
      res.type(receipt.media_type).attachment(receipt.file_name);
      if (req.query.download !== '1')
        res.set(
          'Content-Disposition',
          res.get('Content-Disposition').replace(/^attachment/, 'inline'),
        );
      res.send(receipt.content);
    }),
  );
  app.delete(
    '/api/expenses/:id/receipt',
    auth,
    route(async (req, res) => {
      await transaction(pool, async (c) => {
        const expense = await expenseAccess(c, req, true);
        const [result] = await c.query('DELETE FROM expense_receipts WHERE expense_id=?', [
          expense.expense_id,
        ]);
        if (!result.affectedRows) v.fail(404, 'Receipt not found.');
      });
      res.json({ success: true });
    }),
  );
}
module.exports = { mountReceipts, receiptColumns, validateReceipt, MAX_RECEIPT_BYTES };
