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
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
