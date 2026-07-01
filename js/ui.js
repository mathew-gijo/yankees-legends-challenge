// Tiny DOM helpers — no framework, no build step.

export const $ = (sel, root = document) => root.querySelector(sel);

/** Create an element. el('div.card', {onclick}, [children|string]) */
export function el(spec, props = {}, children = []) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k in node && k !== 'list') node[k] = v;
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

/** Replace the #app view with animation. */
export function mount(...nodes) {
  const app = $('#app');
  app.innerHTML = '';
  const view = el('div.view.stack');
  nodes.forEach((n) => n && view.appendChild(n));
  app.appendChild(view);
  app.scrollTop = 0;
}

let toastTimer;
export function toast(msg, ms = 1800) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div.toast', { text: msg });
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

export function crest() {
  return el('div.crest', { html: '<span>NY</span>' });
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];
