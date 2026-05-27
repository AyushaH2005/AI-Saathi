// Extract all visible text from the page — replaces OCR, more accurate
export const EXTRACT_CONTENT = `
(function() {
  function getVisibleText() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName.toLowerCase();
        if (['script','style','noscript','meta','head'].indexOf(tag) !== -1) return NodeFilter.FILTER_REJECT;
        var s = window.getComputedStyle(p);
        if (s.display === 'none' || s.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        var t = node.textContent.trim();
        if (t.length > 1) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_REJECT;
      }
    });
    var texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode.textContent.trim());
    return texts.join('\\n');
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'page_content',
    title: document.title || '',
    url: window.location.href,
    text: getVisibleText().slice(0, 8000)
  }));
})();
`;

// Floating AI button injected on every page
export const INJECT_FAB = `
(function() {
  if (document.getElementById('ai-saathi-fab')) return;
  var fab = document.createElement('div');
  fab.id = 'ai-saathi-fab';
  fab.innerHTML = '\\uD83E\\uDD16';
  fab.style.cssText = 'position:fixed;bottom:24px;right:16px;width:52px;height:52px;border-radius:26px;background:#2563eb;color:white;font-size:26px;display:flex;align-items:center;justify-content:center;z-index:99999;box-shadow:0 4px 12px rgba(37,99,235,0.4);cursor:pointer;';
  fab.onclick = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'fab_pressed' }));
  };
  document.body.appendChild(fab);
})();
`;

// Highlight scam elements on the page
export const INJECT_SCAM_SCAN = `
(function() {
  document.querySelectorAll('.ai-saathi-warn').forEach(function(e) { e.remove(); });
  var allText = document.body.innerText.toLowerCase();
  var flags = [];
  var urgency = ['urgent','immediately','act now','expire','verify now','last chance','your account will be'];
  urgency.forEach(function(w) { if (allText.indexOf(w) !== -1) flags.push(w); });
  if (location.protocol !== 'https:' && document.querySelector('input[type="password"]')) {
    flags.push('Password field on insecure HTTP page');
  }
  if (flags.length > 0) {
    var b = document.createElement('div');
    b.className = 'ai-saathi-warn';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:10px 16px;z-index:99998;font:14px sans-serif;line-height:1.4;';
    b.innerHTML = '<strong>Warning — ' + flags.length + ' suspicious sign(s):</strong><br>' + flags.map(function(f) { return '\\u2022 ' + f; }).join('<br>');
    document.body.appendChild(b);
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scam_result', count: flags.length, flags: flags }));
})();
`;

// Add numbered markers to form fields (guide mode)
export const INJECT_GUIDE = `
(function() {
  document.querySelectorAll('.ai-saathi-step').forEach(function(e) { e.remove(); });
  var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),select,textarea');
  inputs.forEach(function(input, i) {
    input.style.outline = '3px solid #16a34a';
    input.style.outlineOffset = '2px';
    var rect = input.getBoundingClientRect();
    var m = document.createElement('div');
    m.className = 'ai-saathi-step';
    m.style.cssText = 'position:fixed;top:' + (rect.top - 14) + 'px;left:' + (rect.left - 18) + 'px;width:22px;height:22px;border-radius:11px;background:#16a34a;color:white;font:bold 12px sans-serif;display:flex;align-items:center;justify-content:center;z-index:99997;pointer-events:none;';
    m.textContent = (i + 1);
    document.body.appendChild(m);
  });
})();
`;

// Get all form fields with selectors, types, and labels
export const INJECT_GET_FORM_FIELDS = `
(function() {
  var fields = [];
  var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]),select,textarea');
  inputs.forEach(function(el) {
    var label = '';
    var id = el.id;
    var name = el.getAttribute('name');
    var placeholder = el.getAttribute('placeholder') || '';
    var type = el.getAttribute('type') || el.tagName.toLowerCase();

    // Try to find associated label
    if (id) {
      var lbl = document.querySelector('label[for="' + id + '"]');
      if (lbl) label = lbl.textContent.trim();
    }
    if (!label && name) {
      var lbl2 = document.querySelector('label[for="' + name + '"]');
      if (lbl2) label = lbl2.textContent.trim();
    }
    if (!label) {
      var parent = el.closest('label');
      if (parent) label = parent.textContent.trim();
    }
    if (!label) label = placeholder;

    var selector = '';
    if (id) selector = '#' + id;
    else if (name) selector = '[name="' + name + '"]';
    else if (placeholder) selector = type + '[placeholder="' + placeholder + '"]';
    else selector = type + ':nth-of-type(' + (Array.from(el.parentNode.children).indexOf(el) + 1) + ')';

    fields.push({
      selector: selector,
      label: label || type,
      type: type === 'select' || type === 'textarea' ? 'text' : type,
      value: el.value || ''
    });
  });
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'form_fields',
    fields: fields
  }));
})();
`;

// Fill a specific form field by selector
export function INJECT_FORM_FILL(selector: string, value: string) {
  return `
(function() {
  var el = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!el) return;
  var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter && el.tagName === 'INPUT') {
    nativeSetter.call(el, '${value.replace(/'/g, "\\'")}');
  } else {
    el.value = '${value.replace(/'/g, "\\'")}';
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.style.outline = '3px solid #2563eb';
  el.style.outlineOffset = '2px';
  setTimeout(function() { el.style.outline = ''; el.style.outlineOffset = ''; }, 3000);
})();
`;
}

// Click an element by selector
export function INJECT_CLICK(selector: string) {
  return `
(function() {
  var el = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.outline = '3px solid #f59e0b';
  el.style.outlineOffset = '2px';
  setTimeout(function() { el.click(); el.style.outline = ''; el.style.outlineOffset = ''; }, 500);
})();
`;
}

// Show warning banner
export function INJECT_WARNING(message: string, severity: string) {
  const bg = severity === 'high' ? '#dc2626' : '#f59e0b';
  return `
(function() {
  var old = document.getElementById('ai-saathi-warn-banner');
  if (old) old.remove();
  var b = document.createElement('div');
  b.id = 'ai-saathi-warn-banner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:${bg};color:white;padding:12px 16px;z-index:99998;font:14px sans-serif;line-height:1.4;cursor:pointer;';
  b.innerHTML = '<strong>AI Saathi Warning</strong><br>${message.replace(/'/g, "\\'")}';
  b.onclick = function() { b.remove(); };
  document.body.appendChild(b);
  setTimeout(function() { if (b.parentNode) b.remove(); }, 15000);
})();
`;
}

// Remove all injected elements
export const INJECT_CLEANUP = `
(function() {
  document.querySelectorAll('.ai-saathi-warn,.ai-saathi-step,#ai-saathi-fab,#ai-saathi-warn-banner').forEach(function(e) { e.remove(); });
  document.querySelectorAll('input,select,textarea').forEach(function(el) { el.style.outline = ''; el.style.outlineOffset = ''; });
})();
`;
