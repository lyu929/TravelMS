const PDFDocument = require('pdfkit');
const path = require('node:path');
const categories = {
  FLIGHT: 'Airfare',
  LODGING: 'Accommodation',
  FOOD: 'Food & drinks',
  TRANSPORT: 'Transport',
  OTHER: 'Other',
};
const statuses = { GENERATED: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved' };
const money = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(amount || 0),
  );
const clean = (value) =>
  String(value ?? '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-');

function reportPdf(report, snapshot, reviews = []) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      bufferPages: true,
      info: {
        Title: `Waypoint expense report ${report.report_id}`,
        Author: 'Waypoint',
        Subject: 'Saved travel expense report',
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.registerFont('Body', path.join(__dirname, '..', 'assets', 'fonts', 'WaypointSans.ttf'));
    doc.font('Body');
    const green = '#29483b',
      muted = '#67736c',
      ink = '#273b32',
      width = doc.page.width - 88,
      bottom = doc.page.height - 66;
    const text = (value, x, y, options = {}) =>
      doc.fillColor(ink).fontSize(10).text(clean(value), x, y, options);
    let y = 44;
    function page() {
      doc.addPage();
      y = 60;
    }
    function room(height) {
      if (y + height > bottom) page();
    }
    function heading(title) {
      room(48);
      doc.fillColor(green).fontSize(14).text(title, 44, y);
      y += 28;
    }
    function pair(label, value) {
      const content = clean(value || '-');
      const height = Math.max(
        20,
        doc.fontSize(10).heightOfString(content, { width: width - 122 }) + 8,
      );
      room(height);
      doc.fillColor(muted).fontSize(9).text(label, 44, y, { width: 110 });
      text(content, 166, y, { width: width - 122 });
      y += height;
    }
    doc.roundedRect(44, y, width, 108, 8).fill('#edf2ec');
    doc
      .fillColor(green)
      .fontSize(24)
      .text('waypoint.', 62, y + 14);
    doc
      .fillColor(ink)
      .fontSize(15)
      .text('Expense report', 62, y + 52);
    doc
      .fillColor(muted)
      .fontSize(9)
      .text(
        `REPORT ${String(report.report_id).padStart(4, '0')}  |  ${statuses[report.report_status] || report.report_status}`,
        62,
        y + 80,
      );
    doc
      .fillColor(muted)
      .fontSize(7)
      .text(
        'Trip and expenses saved at creation.\nReport approval status is current.',
        doc.page.width - 260,
        y + 72,
        { width: 198, align: 'right' },
      );
    y += 133;
    const trip = snapshot?.trip || {};
    heading('Journey details');
    pair('Destination', trip.destination || 'Archived journey');
    pair('Travel dates', trip.start_date ? `${trip.start_date} to ${trip.end_date}` : '-');
    pair('Purpose', trip.purpose);
    pair('Generated', report.generated_at);
    pair('Report status', statuses[report.report_status] || report.report_status);
    pair('Approved', report.approved_at || 'Awaiting report approval');
    y += 12;
    heading('Spending summary');
    const expenses = snapshot?.expenses || [];
    const totals = new Map(Object.keys(categories).map((k) => [k, 0]));
    for (const expense of expenses)
      totals.set(
        expense.category,
        (totals.get(expense.category) || 0) + Math.round(Number(expense.amount) * 100),
      );
    for (const [category, cents] of totals)
      if (cents) pair(categories[category] || category, money(cents / 100));
    pair('Saved total', money(report.total_expenses));
    pair('Budget at creation', money(trip.estimated_budget));
    y += 12;
    heading('Expense details');
    const columns = [44, 117, 209, 453];
    function tableHeader() {
      room(27);
      doc.rect(44, y - 3, width, 25).fill('#edf2ec');
      ['Date', 'Category', 'Description / receipt', 'USD'].forEach((label, index) =>
        text(label, columns[index] + (index === 0 ? 6 : 0), y, {
          width: index === 2 ? 233 : index === 3 ? 93 : 90,
          align: index === 3 ? 'right' : 'left',
        }),
      );
      y += 30;
    }
    tableHeader();
    if (!expenses.length) {
      text('No expenses were recorded when this report was created.', 44, y, { width });
      y += 35;
    }
    for (const expense of expenses) {
      const receipt = expense.receipt_name
        ? `Receipt: ${expense.receipt_name}`
        : expense.receipt_url
          ? 'Receipt link recorded'
          : '';
      const description = clean([expense.description || '-', receipt].filter(Boolean).join('\n'));
      const height = Math.max(31, doc.fontSize(9).heightOfString(description, { width: 230 }) + 16);
      if (y + height > bottom) {
        page();
        tableHeader();
      }
      text(expense.expense_date, 50, y, { width: 66 });
      text(categories[expense.category] || expense.category, 117, y, { width: 87 });
      doc.fontSize(9).text(description, 209, y, { width: 230 });
      text(Number(expense.amount).toFixed(2), 453, y, { width: 98, align: 'right' });
      y += height;
      doc
        .moveTo(44, y - 7)
        .lineTo(doc.page.width - 44, y - 7)
        .strokeColor('#e1e7df')
        .lineWidth(0.5)
        .stroke();
    }
    y += 12;
    heading('Trip review at report creation');
    if (!reviews.length) {
      text('No trip review was recorded before this report was generated.', 44, y, { width });
      y += 30;
    }
    for (const review of reviews) {
      pair(
        review.to_status === 'APPROVED'
          ? 'Trip approved'
          : review.to_status === 'REJECTED'
            ? 'Revision requested'
            : 'Trip status',
        `${review.actor_name} | ${review.to_status} | ${review.created_at} UTC`,
      );
      if (review.comment) pair('Comment', review.comment);
    }
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      // Footer sits below the body margin; prevent PDFKit from adding a blank page.
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .fillColor(muted)
        .fontSize(8)
        .text(`Waypoint | USD | Page ${index + 1} of ${range.count}`, 44, doc.page.height - 40, {
          width,
          align: 'right',
          lineBreak: false,
        });
      doc.page.margins.bottom = savedBottom;
    }
    doc.end();
  });
}
module.exports = { reportPdf };
