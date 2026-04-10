import { parseHTML } from 'linkedom';
import * as fflate from 'fflate';

export async function onRequestPost({ request }) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const renames = JSON.parse(form.get('renames') || '{}');
    const splitMode = form.get('splitMode') || 'zip';

    if (!file) return new Response('No file received', { status: 400 });

    const html = await file.text();
    const { document } = parseHTML(html);

    function flatten(el) {
      const children = Array.from(el.children);
      for (const c of children) flatten(c);
      if (el.tagName === 'DIV' && el.children.length === 1 &&!el.id &&!el.getAttribute('data-framer-name')) {
        const child = el.children[0];
        if (el.getAttribute('style')) {
          child.setAttribute('style', (child.getAttribute('style') || '') + ';' + el.getAttribute('style'));
        }
        el.replaceWith(child);
      }
    }

    Array.from(document.body.children).forEach(flatten);

    Object.entries(renames).forEach(([oldKey, newName]) => {
      document.querySelectorAll(`[data-framer-name="${oldKey}"]`).forEach(el => {
        el.classList.add(newName.toLowerCase().replace(/\s+/g, '-'));
      });
    });

    let result = '<!DOCTYPE html>' + document.documentElement.outerHTML;
    result = result.replace(/>\s+</g, '><').replace(/<!--.*?-->/g, '');

    const newSize = new TextEncoder().encode(result).length;
    const reduction = ((1 - newSize / file.size) * 100).toFixed(1) + '%';

    if (splitMode === 'inline') {
      return new Response(result, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': 'attachment; filename="index.html"',
          'X-Size-Reduction': reduction
        }
      });
    }

    const zipped = fflate.zipSync({ 'index.html': fflate.strToU8(result) });

    return new Response(zipped, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="site.zip"',
        'X-Size-Reduction': reduction
      }
    });

  } catch (err) {
    return new Response(`FATAL: ${err.message}\nStack: ${err.stack}`, { status: 500 });
  }
}
