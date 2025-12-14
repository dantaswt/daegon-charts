export function parseCsvRow(text) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }

  result.push(current.trim());
  return result;
}
