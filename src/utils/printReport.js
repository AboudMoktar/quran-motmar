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
