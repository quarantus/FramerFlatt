import { parseHTML } from 'linkedom';
import * as fflate from 'fflate';

export const config = { api: { bodyParser: false }, maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method!== 'POST') return res.status(405).end();
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  const body = Buffer.concat(buffers).toString('utf8');
  const html = body.split('name="file"')[1].split('\r\n\r\n')[1].split('\r\n----')[0];
  const renames = JSON.parse(body.split('name="renames"')[1]?.split('\r\n\r\n')[1]?.split('\r\n----')[0] || '{}');
  const splitMode = body.split('name="splitMode"')[1]?.split('\r\n\r\n')[1]?.split('\r\n----')[0] || 'zip';

  const { document } = parseHTML(html);

  function isFramerWrapper(el) {
    if (el.tagName!== 'DIV') return false;
    const hasId = el.hasAttribute('id');
    const hasSemantic = ['role','aria-label','data-id','href','src','data-framer-name'].some(a => el.hasAttribute(a));
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    return!hasId &&!hasSemantic &&!hasText && el.children.length <= 1;
  }

  function flatten(el) {
    [...el.children].forEach(flatten);
    if (isFramerWrapper(el) && el.children.length === 1) {
      const child = el.children[0];
      if (el.getAttribute('style')) child.setAttribute('style', (child.getAttribute('style') || '') + ';' + el.getAttribute('style'));
      el.replaceWith(child);
    }
  }

  [...document.body.children].forEach(flatten);

  Object.entries(renames).forEach(([oldKey, newName]) => {
    document.querySelectorAll(`[data-framer-name="${oldKey}"]`).forEach(el => {
      el.classList.add(newName.toLowerCase().replace(/\s+/g, '-'));
    });
  });

  let result = '<!DOCTYPE html>' + document.documentElement.outerHTML;
  result = result.replace(/>\s+</g, '><').replace(/<!--[\s\S]*?-->/g, '');

  const newSize = Buffer.byteLength(result, 'utf8');
  const reduction = ((1 - newSize / html.length) * 100).toFixed(1) + '%';

  if (splitMode === 'inline') {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
    res.setHeader('X-Size-Reduction', reduction);
    return res.send(result);
  }

  const zipped = fflate.zipSync({ 'index.html': fflate.strToU8(result) });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="site.zip"');
  res.setHeader('X-Size-Reduction', reduction);
  res.send(Buffer.from(zipped));
}
