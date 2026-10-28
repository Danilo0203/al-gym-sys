function parseCommandConfirmations(body, query = {}) {
  const parse = (text) => Object.fromEntries(String(text || "").split(/[&\r\n]+/).flatMap((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [] : [[part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim()]];
  }));
  const lines = String(body || "").split(/\r?\n/).filter((line) => /^ID=\d+&/i.test(line.trim()));
  const records = lines.length ? lines.map(parse) : [parse(body)];
  return records.map((record) => {
    const rawId = query.ID ?? query.id ?? record.id;
    const returnCode = String(query.Return ?? query.RETURN ?? record.return ?? "").trim();
    if (!/^\d+$/.test(String(rawId || "")) || !/^-?\d+$/.test(returnCode)) return null;
    const id = Number(rawId);
    return Number.isSafeInteger(id) && id > 0 ? { id, returnCode } : null;
  }).filter(Boolean);
}
module.exports = { parseCommandConfirmations };
