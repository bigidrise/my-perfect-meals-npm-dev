export function toCSV(lines: {canonical: string, amount: number, unit: string, group: string}[]) {
  const hdr = "Group,Item,Amount,Unit\n";
  return hdr + lines.map(l => [l.group, l.canonical, l.amount, l.unit].join(",")).join("\n");
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; 
  a.download = filename; 
  a.click();
  URL.revokeObjectURL(url);
}