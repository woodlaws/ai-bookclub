import { getJoinConfig } from './join-core.mjs';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: '허용되지 않은 요청입니다.' });
  const config = getJoinConfig();
  return res.status(200).json({
    ok: true,
    configured: config.configured,
    privacy: {
      operatorName: config.operatorName,
      retentionPeriod: config.retentionPeriod,
    },
  });
}
