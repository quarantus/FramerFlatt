import { parseHTML } from 'linkedom';
export async function onRequestPut({ request }) {
  const file = await request.formData().then(f => f.get('file'));
  const { document } = parseHTML(await file.text());
  const blocks = [];
  document.querySelectorAll('div[class*="framer-"], section, [data-framer-name]').forEach((el, i) => {
    const name = el.getAttribute('data-framer-name') || el.querySelector('h1,h2,h3')?.textContent?.slice(0,30) || `block-${i}`;
    const oldKey = el.id || [...el.classList][0];
    if (oldKey) blocks.push({ oldKey, suggestedName: name.toLowerCase().replace(/\s+/g,'-').slice(0,20), preview: el.textContent.trim().slice(0,50) });
  });
  return Response.json({ blocks: blocks.slice(0,50) });
}
