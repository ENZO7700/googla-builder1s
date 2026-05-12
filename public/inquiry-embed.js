(function () {
  'use strict';
  var SUPABASE_URL = 'https://lmuervovjnpadapfwwmh.supabase.co';
  var ENDPOINT = SUPABASE_URL + '/functions/v1/inquiries-submit';

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') el.setAttribute('style', attrs[k]);
      else if (k === 'class') el.className = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function renderField(field) {
    var id = 'inq_' + field.key;
    var label = h('label', { for: id, style: 'display:block;font-size:13px;margin:8px 0 4px;font-weight:500' }, [field.label + (field.required ? ' *' : '')]);
    var input;
    var baseStyle = 'width:100%;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box';
    if (field.type === 'textarea') {
      input = h('textarea', { id: id, name: field.key, rows: '4', style: baseStyle, placeholder: field.placeholder || '' }, []);
    } else if (field.type === 'select') {
      input = h('select', { id: id, name: field.key, style: baseStyle }, (field.options || []).map(function (o) {
        return h('option', { value: o }, [o]);
      }));
    } else {
      input = h('input', { id: id, name: field.key, type: field.type || 'text', style: baseStyle, placeholder: field.placeholder || '' }, []);
    }
    if (field.required) input.setAttribute('required', 'required');
    return h('div', null, [label, input]);
  }

  function mount(container, opts) {
    var siteId = opts.siteId || container.getAttribute('data-site-id');
    var formSlug = opts.formSlug || container.getAttribute('data-form-slug') || 'default';
    var fields = opts.fields || [
      { key: 'name', label: 'Meno', type: 'text', required: true },
      { key: 'email', label: 'E-mail', type: 'email', required: true },
      { key: 'phone', label: 'Telefón', type: 'tel' },
      { key: 'message', label: 'Správa', type: 'textarea', required: true }
    ];

    if (!siteId) { console.error('[inquiry-embed] data-site-id is required'); return; }

    var form = h('form', { style: 'max-width:520px;font-family:system-ui,-apple-system,sans-serif;color:#18181b' }, []);
    fields.forEach(function (f) { form.appendChild(renderField(f)); });

    var honeypot = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', style: 'position:absolute;left:-9999px;opacity:0' }, []);
    form.appendChild(honeypot);

    var btn = h('button', { type: 'submit', style: 'margin-top:14px;padding:10px 18px;background:#18181b;color:#fff;border:0;border-radius:8px;font-size:14px;cursor:pointer;font-weight:500' }, ['Odoslať']);
    var status = h('div', { style: 'margin-top:10px;font-size:13px' }, []);
    form.appendChild(btn);
    form.appendChild(status);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      btn.setAttribute('disabled', 'true');
      status.textContent = 'Odosielam...';
      status.style.color = '#71717a';

      var fd = new FormData(form);
      var payload = {};
      fd.forEach(function (v, k) { payload[k] = v; });

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          form_slug: formSlug,
          payload: payload,
          source_url: window.location.href,
          website: payload.website || ''
        })
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        if (res.ok) {
          status.style.color = '#16a34a';
          status.textContent = (res.j && res.j.message) || 'Ďakujeme, ozveme sa.';
          form.reset();
        } else {
          status.style.color = '#dc2626';
          status.textContent = (res.j && res.j.error) || 'Chyba pri odosielaní.';
        }
      }).catch(function () {
        status.style.color = '#dc2626';
        status.textContent = 'Sieťová chyba.';
      }).finally(function () {
        btn.removeAttribute('disabled');
      });
    });

    container.innerHTML = '';
    container.appendChild(form);
  }

  window.LovableInquiry = { mount: mount };

  document.querySelectorAll('[data-lovable-inquiry]').forEach(function (el) {
    mount(el, {});
  });
})();
