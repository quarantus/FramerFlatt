import { parseHTML } from 'linkedom';

export async function onRequestPut({ request }) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file) return new Response('No file', { status: 400 });

    const html = await file.text();
    const { document } = parseHTML(html);

    const blocks = [];
    document.querySelectorAll('[data-framer-name]').forEach(el => {
      const name = el.getAttribute('data-framer-name');
      if (name &&!blocks.find(b => b.oldKey === name)) {
        blocks.push({
          oldKey: name,
          suggestedName: name.replace(/([A-Z])/g, ' $1').trim(),
          preview: el.textContent.slice(0, 30).trim() || '<empty>'
        });
      }
    });

    return Response.json({ blocks });
  } catch (e) {
    return new Response(`Analyze failed: ${e.message}`, { status: 500 });
  }
}
