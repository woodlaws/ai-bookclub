const SITE_URL='https://aibookclub.vercel.app';
const xmlEscape=(value)=>String(value).replace(/[<>&'\"]/g,(char)=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[char]));

export default async function handler(_request,response){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
  response.setHeader('Content-Type','application/xml; charset=utf-8');
  response.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=3600');
  if(!url||!key)return response.status(503).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  try{
    const [postsResponse,reviewsResponse]=await Promise.all([
      fetch(`${url}/rest/v1/community_posts?select=id,kind,updated_at&visibility=eq.public&order=updated_at.desc`,{headers}),
      fetch(`${url}/rest/v1/community_reviews?select=id,updated_at&public_consent=eq.true&approval_status=eq.approved&order=updated_at.desc`,{headers})
    ]);
    if(!postsResponse.ok||!reviewsResponse.ok)throw new Error('public feed unavailable');
    const posts=await postsResponse.json(),reviews=await reviewsResponse.json();
    const urls=[...posts.map(p=>({loc:`${SITE_URL}/community/${p.kind==='notice'?'notices':'resources'}?id=${encodeURIComponent(p.id)}`,lastmod:p.updated_at})),...reviews.map(r=>({loc:`${SITE_URL}/community/reviews?id=${encodeURIComponent(r.id)}`,lastmod:r.updated_at}))];
    const body=urls.map(item=>`  <url><loc>${xmlEscape(item.loc)}</loc><lastmod>${xmlEscape(new Date(item.lastmod).toISOString())}</lastmod></url>`).join('\n');
    return response.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
  }catch{return response.status(503).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');}
}
