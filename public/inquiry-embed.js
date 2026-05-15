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
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  var INPUT_STYLE = 'width:100%;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box;background:#fff';

  function renderField(field, ctx) {
    var id = 'inq_' + field.key;
    var t = field.type || 'text';
    var label = h('label', { for: id, style: 'display:block;font-size:13px;margin:8px 0 4px;font-weight:500' },
      [field.label + (field.required ? ' *' : '')]);
    var input;

    if (t === 'textarea') {
      input = h('textarea', { id: id, name: field.key, rows: '4', style: INPUT_STYLE, placeholder: field.placeholder || '' }, []);
    } else if (t === 'select') {
      var opts = (field.options || []).map(function (o) { return h('option', { value: o }, [o]); });
      opts.unshift(h('option', { value: '' }, ['—']));
      input = h('select', { id: id, name: field.key, style: INPUT_STYLE }, opts);
    } else if (t === 'checkbox') {
      input = h('input', { id: id, name: field.key, type: 'checkbox', style: 'margin-right:6px' }, []);
      label = h('label', { for: id, style: 'display:flex;align-items:center;font-size:13px;margin:8px 0 4px' },
        [input, field.label + (field.required ? ' *' : '')]);
      return h('div', null, [label]);
    } else if (t === 'file') {
      var attrs = { id: id, name: field.key, type: 'file', style: 'font-size:13px' };
      if (field.accept) attrs.accept = field.accept;
      input = h('input', attrs, []);
      var status = h('div', { style: 'font-size:11px;color:#71717a;margin-top:4px' }, []);
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) { delete ctx.fileRefs[field.key]; status.textContent = ''; return; }
        var maxMb = Number(field.maxSize) > 0 ? Number(field.maxSize) : 5;
        if (f.size > maxMb * 1024 * 1024) {
          status.style.color = '#dc2626';
          status.textContent = 'Súbor presahuje ' + maxMb + ' MB';
          input.value = '';
          delete ctx.fileRefs[field.key];
          return;
        }
        status.style.color = '#71717a';
        status.textContent = 'Nahrávam…';
        ctx.uploads++;
        ctx.updateBtn();

        var fd = new FormData();
        fd.append('siteId', ctx.siteId);
        fd.append('formSlug', ctx.formSlug);
        fd.append('fieldKey', field.key);
        fd.append('file', f);
        fetch(ENDPOINT + '?action=upload', { method: 'POST', body: fd })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (res.ok && res.j && res.j.ok) {
              ctx.fileRefs[field.key] = { path: res.j.path, name: res.j.name, size: res.j.size, mime: res.j.mime };
              status.style.color = '#16a34a';
              status.textContent = '✓ ' + res.j.name;
            } else {
              status.style.color = '#dc2626';
              status.textContent = (res.j && res.j.error) || 'Chyba pri nahrávaní.';
              input.value = '';
              delete ctx.fileRefs[field.key];
            }
          })
          .catch(function () {
            status.style.color = '#dc2626';
            status.textContent = 'Sieťová chyba.';
            input.value = '';
            delete ctx.fileRefs[field.key];
          })
          .finally(function () { ctx.uploads--; ctx.updateBtn(); });
      });
      return h('div', null, [label, input, status]);
    } else {
      input = h('input', { id: id, name: field.key, type: t, style: INPUT_STYLE, placeholder: field.placeholder || '' }, []);
    }
    if (field.required) input.setAttribute('required', 'required');
    return h('div', null, [label, input]);
  }

  function buildForm(container, schema, opts) {
    var siteId = opts.siteId;
    var formSlug = opts.formSlug;
    var fields = (schema && schema.fields) || [];
    var successMsg = (schema && schema.success_message) || 'Ďakujeme, ozveme sa.';

    var ctx = { siteId: siteId, formSlug: formSlug, fileRefs: {}, uploads: 0, updateBtn: function () {} };

    var form = h('form', { style: 'max-width:520px;font-family:system-ui,-apple-system,sans-serif;color:#18181b' }, []);
    if (schema && schema.name) {
      form.appendChild(h('div', { style: 'font-weight:600;font-size:16px;margin-bottom:8px' }, [schema.name]));
    }
    fields.forEach(function (f) { form.appendChild(renderField(f, ctx)); });

    var honeypot = h('input', { type: 'text', name: 'hp', tabindex: '-1', autocomplete: 'off',
      style: 'position:absolute;left:-9999px;opacity:0;height:0;width:0' }, []);
    form.appendChild(honeypot);

    var btn = h('button', { type: 'submit', style: 'margin-top:14px;padding:10px 18px;background:#18181b;color:#fff;border:0;border-radius:8px;font-size:14px;cursor:pointer;font-weight:500' }, ['Odoslať']);
    var status = h('div', { style: 'margin-top:10px;font-size:13px' }, []);
    form.appendChild(btn);
    form.appendChild(status);

    ctx.updateBtn = function () {
      if (ctx.uploads > 0) btn.setAttribute('disabled', 'true');
      else btn.removeAttribute('disabled');
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (ctx.uploads > 0) return;
      btn.setAttribute('disabled', 'true');
      status.style.color = '#71717a';
      status.textContent = 'Odosielam...';

      var fd = new FormData(form);
      var payload = {};
      var hp = '';
      fd.forEach(function (v, k) {
        if (k === 'hp') { hp = String(v); return; }
        // Skip file inputs — we attach refs separately
        var field = fields.find ? fields.find(function (f) { return f.key === k; }) : null;
        if (field && field.type === 'file') return;
        payload[k] = v;
      });
      fields.forEach(function (f) {
        if (f.type === 'checkbox') payload[f.key] = !!(payload[f.key]);
        if (f.type === 'file') {
          if (ctx.fileRefs[f.key]) payload[f.key] = ctx.fileRefs[f.key];
          else if (f.required) payload[f.key] = null;
        }
      });

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: siteId,
          formSlug: formSlug,
          payload: payload,
          sourceUrl: window.location.href,
          hp: hp
        })
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          status.style.color = '#16a34a';
          status.textContent = successMsg;
          form.reset();
          ctx.fileRefs = {};
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

  function mount(container, opts) {
    opts = opts || {};
    var siteId = opts.siteId || container.getAttribute('data-site-id') || container.getAttribute('data-site');
    var formSlug = opts.formSlug || container.getAttribute('data-form-slug') || container.getAttribute('data-lvb-form') || 'default';
    if (!siteId) { console.error('[inquiry-embed] data-site-id is required'); return; }

    container.innerHTML = '<div style="font:13px system-ui;color:#71717a">Načítavam formulár…</div>';

    fetch(ENDPOINT + '?siteId=' + encodeURIComponent(siteId) + '&slug=' + encodeURIComponent(formSlug), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
      .then(function (r) { return r.json(); })
      .then(function (schema) { buildForm(container, schema, { siteId: siteId, formSlug: formSlug }); })
      .catch(function (err) {
        console.error('[inquiry-embed] schema load failed', err);
        container.innerHTML = '<div style="font:13px system-ui;color:#dc2626">Nepodarilo sa načítať formulár.</div>';
      });
  }

  window.LovableInquiry = { mount: mount };

  document.querySelectorAll('[data-lovable-inquiry], [data-lvb-form]').forEach(function (el) {
    mount(el, {});
  });
})();
