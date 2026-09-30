export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return response.status(503).json({
      configured: false,
      message: '게시판 연결 준비 중입니다. 운영자에게 문의해 주세요.',
    });
  }

  return response.status(200).json({ configured: true, url, publishableKey });
}
