import { LOGO_BASE64 } from "../assets/logo"
import { ASSOCIATION_NAME, BRANCH_LABEL } from "../config"

function headerHtml() {
  return `
    <div style="display:flex; align-items:center; gap:12px; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 16px;">
      <img src="${LOGO_BASE64}" style="width:60px; height:60px; object-fit:contain;" />
      <div>
        <div style="font-weight:bold; font-size:16px;">${ASSOCIATION_NAME}</div>
        <div style="font-size:12px; color:#555;">${BRANCH_LABEL}</div>
      </div>
    </div>
  `
}

function tableHtml(rows) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  const headerCells = columns.map((c) => `<th>${c}</th>`).join("")
  const bodyRows = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${r[c] ?? "-"}</td>`).join("")}</tr>`)
    .join("")
  return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
}

const baseStyle = `
  <style>
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: center; }
    th { background: #f0fdf4; }
    .section { page-break-inside: avoid; margin-bottom: 24px; }
  </style>
`

export function printReport({ title, subtitleLines, rows }) {
  const root = document.getElementById("print-root")
  if (!root) return
  const today = new Date().toLocaleDateString("ar-TN")
  const subtitleHtml = (subtitleLines || [])
    .map((line) => `<p style="margin:0 0 4px 0; font-size:13px; color:#555;">${line}</p>`)
    .join("")

  root.innerHTML = `
    ${baseStyle}
    <div style="direction: rtl; font-family: sans-serif; padding: 20px;">
      ${headerHtml()}
      <h2 style="margin:0 0 4px 0;">${title}</h2>
      ${subtitleHtml}
      <p style="font-size:11px; color:#888; margin-bottom:12px;">تاريخ الإصدار: ${today}</p>
      ${tableHtml(rows)}
    </div>
  `
  setTimeout(() => window.print(), 100)
}

export function printMultiSection({ title, sections }) {
  const root = document.getElementById("print-root")
  if (!root) return
  const today = new Date().toLocaleDateString("ar-TN")

  const sectionsHtml = sections
    .map(
      (s) => `
        <div class="section">
          <h3 style="margin:0 0 6px 0; color:#047857;">${s.heading}</h3>
          ${(s.subtitleLines || [])
            .map((l) => `<p style="margin:0 0 4px 0; font-size:12px; color:#555;">${l}</p>`)
            .join("")}
          ${tableHtml(s.rows)}
        </div>
      `
    )
    .join("")

  root.innerHTML = `
    ${baseStyle}
    <div style="direction: rtl; font-family: sans-serif; padding: 20px;">
      ${headerHtml()}
      <h2 style="margin:0 0 4px 0;">${title}</h2>
      <p style="font-size:11px; color:#888; margin-bottom:16px;">تاريخ الإصدار: ${today}</p>
      ${sectionsHtml}
    </div>
  `
  setTimeout(() => window.print(), 100)
}

function receiptRow(label, value) {
  return `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #ddd; font-size:14px;">
      <span style="color:#555;">${label}</span>
      <span style="font-weight:bold;">${value}</span>
    </div>
  `
}

export function printReceipt({ studentName, className, monthText, amount, date, note, receiptNo, duplicateCount }) {
  const root = document.getElementById("print-root")
  if (!root) return
  const today = new Date().toLocaleDateString("ar-TN")
  const isDuplicate = duplicateCount && duplicateCount > 1

  root.innerHTML = `
    ${baseStyle}
    <div style="direction: rtl; font-family: sans-serif; padding: 24px; display:flex; justify-content:center;">
      <div style="width:100%; max-width:460px; border:2px solid #047857; border-radius:10px; padding:24px; position:relative;">
        ${isDuplicate ? `<div style="text-align:center; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:8px; padding:6px; font-size:13px; font-weight:bold; margin-bottom:10px;">⚠️ نسخة مكررة — طُبع هذا الوصل ${duplicateCount} مرات</div>` : ""}
        ${headerHtml()}
        <h2 style="text-align:center; margin: 4px 0 2px 0; color:#047857;">وصل دفع اشتراك</h2>
        ${receiptNo ? `<p style="text-align:center; font-size:11px; color:#888; margin:0 0 12px 0;">رقم الوصل: ${receiptNo}</p>` : `<p style="margin:0 0 12px 0;"></p>`}
        <div style="margin-bottom: 8px;">
          ${receiptRow("اسم الطالب", studentName)}
          ${receiptRow("القسم", className || "-")}
          ${receiptRow("الشهر", monthText)}
          ${receiptRow("المبلغ المدفوع", `${amount} د.ت`)}
          ${receiptRow("تاريخ الدفع", date)}
          ${receiptRow("طريقة الدفع", "نقداً")}
          ${note ? receiptRow("ملاحظة", note) : ""}
        </div>
        <p style="font-size:11px; color:#888; margin-top:12px;">تاريخ الإصدار: ${today}</p>
        <div style="display:flex; justify-content:space-between; margin-top:48px;">
          <div style="text-align:center; width:45%;">
            <p style="border-top:1px solid #333; padding-top:4px; font-size:12px; margin:0;">إمضاء المسؤول</p>
          </div>
          <div style="text-align:center; width:45%;">
            <p style="border-top:1px solid #333; padding-top:4px; font-size:12px; margin:0;">إمضاء ولي الأمر</p>
          </div>
        </div>
      </div>
    </div>
  `
  setTimeout(() => window.print(), 100)
}

function miniReceiptRow(label, value) {
  return `
    <div style="display:flex; justify-content:space-between; padding:1.5px 0; border-bottom:1px dashed #ddd; font-size:8.5px;">
      <span style="color:#555;">${label}</span>
      <span style="font-weight:bold;">${value}</span>
    </div>
  `
}

// Prints a batch of pre-issued receipts, 8 per A4 page (2 columns x 4 rows),
// each with a dashed cutting border and a blank line for the payment
// date/signature to be filled in by hand when the student actually pays
// during the month. Cards are laid out in the same order the receipt
// numbers were assigned (class, then name), and since the grid runs inside
// an RTL container the browser places card 1 at the top-right and fills
// right-to-left, top-to-bottom — so numbers increment correctly as read.
export function printReceiptsGrid({ monthText, receipts }) {
  const root = document.getElementById("print-root")
  if (!root || receipts.length === 0) return

  const PER_PAGE = 8

  const cardHtml = (r) => {
    const isPaid = !!r.paidDate
    const dateValue = isPaid
      ? `<span style="color:#047857;">${r.paidDate} ✓</span>`
      : "............."
    return `
    <div style="border:1.5px dashed #047857; border-radius:6px; padding:6px 8px; display:flex; flex-direction:column; overflow:hidden;">
      <div style="display:flex; align-items:center; gap:4px; border-bottom:1px solid #047857; padding-bottom:2px; margin-bottom:3px;">
        <img src="${LOGO_BASE64}" style="width:18px; height:18px; object-fit:contain; flex-shrink:0;" />
        <div style="font-size:6.5px; line-height:1.15; overflow:hidden;">
          <div style="font-weight:bold;">${ASSOCIATION_NAME}</div>
          <div style="color:#555;">${BRANCH_LABEL}</div>
        </div>
      </div>
      <p style="text-align:center; font-weight:bold; color:#047857; margin:0 0 1px 0; font-size:10px;">وصل دفع اشتراك — ${monthText}</p>
      <p style="text-align:center; font-size:7.5px; color:#888; margin:0 0 3px 0;">رقم الوصل: ${r.receiptNo}</p>
      ${miniReceiptRow("اسم الطالب", r.studentName)}
      ${miniReceiptRow("القسم", r.className || "-")}
      ${miniReceiptRow("المبلغ المستحق", `${r.amount} د.ت`)}
      ${miniReceiptRow("تاريخ الدفع", dateValue)}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; gap:3px;">
        <span style="border-top:1px solid #333; padding-top:1px; font-size:6.5px; width:38%; text-align:center;">إمضاء المسؤول</span>
        <span style="border:1px dashed #999; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:4.8px; color:#999; text-align:center; line-height:1; flex-shrink:0;">ختم<br/>الجمعية</span>
        <span style="border-top:1px solid #333; padding-top:1px; font-size:6.5px; width:38%; text-align:center;">إمضاء ولي الأمر</span>
      </div>
    </div>
  `
  }

  const pages = []
  for (let i = 0; i < receipts.length; i += PER_PAGE) pages.push(receipts.slice(i, i + PER_PAGE))

  const pagesHtml = pages
    .map(
      (page, idx) => `
        <div style="display:grid; grid-template-columns:1fr 1fr; grid-template-rows:repeat(4, 1fr); gap:4mm; width:190mm; height:270mm; box-sizing:border-box; ${idx < pages.length - 1 ? "page-break-after:always;" : ""}">
          ${page.map(cardHtml).join("")}
        </div>
      `
    )
    .join("")

  root.innerHTML = `
    <style>
      @page { size: A4; margin: 10mm; }
    </style>
    <div style="direction: rtl; font-family: sans-serif;">
      ${pagesHtml}
    </div>
  `
  setTimeout(() => window.print(), 100)
}
