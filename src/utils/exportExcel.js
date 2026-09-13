import * as XLSX from "xlsx"

export function exportExcel(filename, rows, headerLines = []) {
  if (!rows || rows.length === 0) return
  const ws = headerLines.length > 0
    ? XLSX.utils.aoa_to_sheet(headerLines.map((l) => [l]))
    : XLSX.utils.json_to_sheet(rows)

  if (headerLines.length > 0) {
    XLSX.utils.sheet_add_json(ws, rows, { origin: -1 })
  }

  const wb = XLSX.utils.book_new()
  wb.Workbook = { Views: [{ RTL: true }] }
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportExcelMultiSheet(filename, sheets) {
  const wb = XLSX.utils.book_new()
  wb.Workbook = { Views: [{ RTL: true }] }

  sheets.forEach((sheet) => {
    if (!sheet.rows || sheet.rows.length === 0) return
    const ws = sheet.headerLines && sheet.headerLines.length > 0
      ? XLSX.utils.aoa_to_sheet(sheet.headerLines.map((l) => [l]))
      : XLSX.utils.json_to_sheet(sheet.rows)

    if (sheet.headerLines && sheet.headerLines.length > 0) {
      XLSX.utils.sheet_add_json(ws, sheet.rows, { origin: -1 })
    }

    const safeName = sheet.name.slice(0, 31).replace(/[\\/*?:[\]]/g, "-")
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  })

  XLSX.writeFile(wb, `${filename}.xlsx`)
}
