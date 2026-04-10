import { parseHTML } from 'linkedom';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method!== 'PUT') return res.status(405).end('Method Not Allowed');

  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  const body = Buffer.concat(buffers).toString('utf8');
  const boundary = body.split('\r\n')[0];
  const parts = body.split(boundary);
  const filePart = parts.find(p => p.includes('name="file"'));
  if (!filePart) return res.status(400).send('No file');

  const html = filePart.split('\r\n\r\n')[1].split('\r\n--')[0];

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
  res.status(200).json({ blocks });
}
