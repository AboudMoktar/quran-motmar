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

export function printReceipt({ studentName, className, monthText, amount, date, note, receiptNo }) {
  const root = document.getElementById("print-root")
  if (!root) return
  const today = new Date().toLocaleDateString("ar-TN")

  root.innerHTML = `
    ${baseStyle}
    <div style="direction: rtl; font-family: sans-serif; padding: 24px; display:flex; justify-content:center;">
      <div style="width:100%; max-width:460px; border:2px solid #047857; border-radius:10px; padding:24px;">
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
