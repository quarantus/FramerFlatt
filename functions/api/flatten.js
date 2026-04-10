import { JSDOM } from 'linkedom';
import { minify } from 'html-minifier-terser';
import fflate from 'fflate';

export async function onRequestPost({ request }) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const renames = JSON.parse(form.get('renames') || '{}');
    const splitMode = form.get('splitMode') || 'zip';

    if (!file) return new Response('No file', { status: 400 });

    console.log('Starting flatten, size:', file.size);
    const html = await file.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Your flattening logic here - same as before
    function isFramerWrapper(el) {
      if (el.tagName!== 'DIV') return false;
      const hasId = el.hasAttribute('id');
      const hasSemantic = ['role','aria-label','data-id','href','src'].some(a => el.hasAttribute(a));
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const children = [...el.children];
      return!hasId &&!hasSemantic &&!hasText && children.length <= 1;
    }

    function flatten(el) {
      [...el.children].forEach(flatten);
      if (isFramerWrapper(el) && el.children.length === 1) {
        const child = el.children[0];
        if (el.getAttribute('style')) child.setAttribute('style', (child.getAttribute('style') || '') + ';' + el.getAttribute('style'));
        el.replaceWith(child);
      }
    }

    [...doc.body.children].forEach(flatten);
    console.log('Flatten complete');

    // Rename blocks
    Object.entries(renames).forEach(([oldKey, newName]) => {
      doc.querySelectorAll(`[data-framer-name="${oldKey}"]`).forEach(el => {
        el.classList.add(newName.toLowerCase().replace(/\s+/g, '-'));
      });
    });

    let result = doc.documentElement.outerHTML;

    // Try minify, but don't crash if it fails
    try {
      result = await minify(result, { collapseWhitespace: true, removeComments: true });
      console.log('Minify complete');
    } catch (e) {
      console.log('Minify failed, using unminified:', e.message);
    }

    const originalSize = file.size;
    const newSize = new TextEncoder().encode(result).length;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(1) + '%';

    if (splitMode === 'inline') {
      return new Response(result, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': 'attachment; filename="index.html"',
          'X-Size-Reduction': reduction
        }
      });
    }

    // ZIP mode
    const files = { 'index.html': fflate.strToU8(result) };
    const zipped = fflate.zipSync(files);

    return new Response(zipped, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="site.zip"',
        'X-Size-Reduction': reduction
      }
    });

  } catch (err) {
    console.error('Flatten error:', err.stack || err.message);
    return new Response(`Flatten failed: ${err.message}`, { status: 500 });
  }
}
