const { getGoogleAccessToken, getJoinConfig } = require('./join-core.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const config = getJoinConfig();
  if (!config.configured) return res.status(503).json({ ok: false, code: 'not_configured' });

  try {
    const accessToken = await getGoogleAccessToken(config);
    const range = `'${config.sheetName.replaceAll("'", "''")}'!A1:A1`;
    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return res.status(502).json({ ok: false, code: 'sheet_access_failed' });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(502).json({ ok: false, code: String(error?.code || 'unknown') });
  }
};
