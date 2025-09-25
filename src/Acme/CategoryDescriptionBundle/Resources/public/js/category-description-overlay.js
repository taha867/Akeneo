(function () {
  if (window.__acmeCatDescLoaded__) return;
  window.__acmeCatDescLoaded__ = true;

  const LOG = (...a) => console.log('[acme]', ...a);
  const WARN = (...a) => console.warn('[acme]', ...a);
  const ROUTE_RE = /#\/enrich\/product-category-tree\/(\d+)\/edit/;

  LOG('category-description-overlay loaded');

  // ---- state ---------------------------------------------------------------
  const drafts = new Map();        // categoryId -> description text
  let isTyping = false;
  let currentId = null;
  let lastHash = location.hash;

  // ---- helpers -------------------------------------------------------------
  const getUiLocale = () => document.documentElement.getAttribute('lang') || 'en_US';
  const getRouteCategoryId = () => {
    const m = location.hash.match(ROUTE_RE);
    return m ? parseInt(m[1], 10) : null;
  };

  function findPropertiesContainer() {
    const sels = [
      '[data-drop-zone="properties"]',               // Akeneo drop zone
      '[role="tabpanel"] [data-drop-zone="properties"]',
      '[role="tabpanel"] .sc-eCFVrV',
      '.sc-eCFVrV',
      '[role="tabpanel"] .sc-gmCRdq',
      '.sc-gmCRdq',
      '.AknColumn',
      '#container',
      'main'
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    const tl = document.querySelector('[role="tablist"]');
    return tl?.parentElement?.nextElementSibling || null;
  }

  // Wait until the real properties container exists & is connected
  function waitForPropertiesContainer(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();

      const check = () => {
        const el = findPropertiesContainer();
        if (el && el.isConnected) {
          mo.disconnect();
          return resolve(el);
        }
        if (performance.now() - t0 >= timeoutMs) {
          mo.disconnect();
          return reject(new Error('container timeout'));
        }
        requestAnimationFrame(check);
      };

      // Also observe DOM mutations in case React mounts asynchronously
      const mo = new MutationObserver(() => {
        const el = findPropertiesContainer();
        if (el && el.isConnected) {
          mo.disconnect();
          resolve(el);
        }
      });
      mo.observe(document.documentElement, { subtree: true, childList: true });

      check();

      // Safety: stop observing slightly after timeout
      setTimeout(() => mo.disconnect(), timeoutMs + 200);
    });
  }

  // Wait until the properties area is actually rendered with fields
  async function waitUntilPropertiesReady(container, timeoutMs = 12000) {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      const ready = () => {
        if (!container || !container.isConnected) return false;
        // visible-ish and has known fields (code or label inputs)
        const hasFields = container.querySelector('input[name^="pim_category[label]"]') || container.querySelector('input[name="code"]');
        const visible = !!(container.offsetParent || container.getClientRects().length);
        return !!(hasFields && visible);
      };

      const tick = () => {
        if (ready()) return resolve();
        if (performance.now() - t0 >= timeoutMs) return reject(new Error('properties not ready'));
        requestAnimationFrame(tick);
      };

      const mo = new MutationObserver(() => { if (ready()) { mo.disconnect(); resolve(); } });
      mo.observe(container, { subtree: true, childList: true });
      tick();
      setTimeout(() => mo.disconnect(), timeoutMs + 200);
    });
  }

  // ---- API -----------------------------------------------------------------
  async function fetchDescription(id) {
    const res = await fetch(`/acme/category-description/${id}?locale=${encodeURIComponent(getUiLocale())}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('GET description failed');
    const j = await res.json();
    return j.description || '';
  }

  async function saveDescription(id, value) {
    const locale = getUiLocale();
    const res = await fetch(`/acme/category-description/${id}?locale=${encodeURIComponent(locale)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ description: value, locale }),
    });
    if (!res.ok) throw new Error('PUT description failed');
  }

  async function fetchImageUrl(id) {
    const res = await fetch(`/acme/category-image/${id}?locale=${encodeURIComponent(getUiLocale())}`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const j = await res.json();
    return j.url || null;
  }

  async function uploadImage(id, file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/acme/category-image/${id}/upload?locale=${encodeURIComponent(getUiLocale())}`, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error('Upload failed');
    const j = await res.json();
    return j.url || null;
  }

  // ---- UI ------------------------------------------------------------------
  function buildCard(id) {
    const card = document.createElement('div');
    card.id = 'acme-description-card';
    card.dataset.categoryId = String(id);
    Object.assign(card.style, {
      border: '1px solid #e3e6eb',
      borderRadius: '6px',
      padding: '16px',
      marginTop: '16px',
      background: '#fff',
    });

    const title = document.createElement('h3');
    title.textContent = 'Category description';
    Object.assign(title.style, { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' });
    card.appendChild(title);

    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-acme', 'textarea');
    textarea.rows = 5;
    textarea.style.width = '100%';
    textarea.placeholder = 'Write a description for this category…';
    textarea.addEventListener('input', () => {
      textarea.dataset.userEdited = '1';
      drafts.set(id, textarea.value);
      const status = card.querySelector('[data-acme="status"]');
      if (status && !status.dataset.savedOnce) status.textContent = 'Not saved';
    });
    textarea.addEventListener('focus', () => { isTyping = true; });
    textarea.addEventListener('blur', () => { isTyping = false; });
    card.appendChild(textarea);

    const actions = document.createElement('div');
    Object.assign(actions.style, { marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' });
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save description';
    saveBtn.className = 'AknButton AknButton--apply';
    const status = document.createElement('span');
    status.setAttribute('data-acme', 'status');
    Object.assign(status.style, { fontSize: '12px', color: '#6b7280' });
    status.textContent = 'Not saved';
    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        status.textContent = 'Saving…';
        await saveDescription(id, textarea.value);
        status.textContent = 'Saved ✔';
        status.dataset.savedOnce = '1';
        delete textarea.dataset.userEdited;
        drafts.set(id, textarea.value);
      } catch (e) {
        console.error(e);
        status.textContent = 'Error while saving';
      } finally {
        saveBtn.disabled = false;
      }
    });
    actions.appendChild(saveBtn);
    actions.appendChild(status);
    card.appendChild(actions);

    const imgTitle = document.createElement('h3');
    imgTitle.textContent = 'Category image';
    Object.assign(imgTitle.style, { margin: '16px 0 8px 0', fontSize: '14px', fontWeight: '600' });
    card.appendChild(imgTitle);

    const preview = document.createElement('img');
    preview.setAttribute('data-acme', 'image-preview');
    Object.assign(preview.style, {
      display: 'block',
      maxWidth: '280px',
      maxHeight: '200px',
      objectFit: 'contain',
      border: '1px solid #e3e6eb',
      borderRadius: '6px',
      padding: '6px',
      background: '#fafafa',
      marginBottom: '8px',
      visibility: 'hidden',
    });
    card.appendChild(preview);

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '8px', alignItems: 'center' });
    const file = document.createElement('input');
    file.type = 'file'; file.accept = 'image/*'; file.style.flex = '1 1 auto';
    const upBtn = document.createElement('button');
    upBtn.type = 'button'; upBtn.textContent = 'Upload image'; upBtn.className = 'AknButton AknButton--apply';
    const info = document.createElement('span');
    Object.assign(info.style, { fontSize: '12px', color: '#6b7280' });
    upBtn.addEventListener('click', async () => {
      if (!file.files || !file.files[0]) { info.textContent = 'Pick a file first'; return; }
      try {
        upBtn.disabled = true; info.textContent = 'Uploading…';
        const url = await uploadImage(id, file.files[0]);
        if (url) { if (preview.src !== url) preview.src = url; preview.style.visibility = 'visible'; info.textContent = 'Uploaded ✔'; }
        else { info.textContent = 'Upload failed'; }
      } catch (e) { console.error(e); info.textContent = 'Upload error'; }
      finally { upBtn.disabled = false; }
    });
    row.appendChild(file); row.appendChild(upBtn); row.appendChild(info);
    card.appendChild(row);

    return card;
  }

  function setTextareaValueFromDraft(card, id) {
    const ta = card.querySelector('[data-acme="textarea"]');
    const draft = drafts.get(id);
    if (!ta.dataset.userEdited && typeof draft === 'string' && ta.value !== draft) ta.value = draft;
  }

  // ---- mounting ------------------------------------------------------------
  async function mountForCurrentRoute() {
    const id = getRouteCategoryId();
    if (!id) return;

    let card = document.querySelector('#acme-description-card');
    if (!card || card.dataset.categoryId !== String(id)) {
      if (card) card.remove();
      card = buildCard(id);
    }

    try {
      const container = await waitForPropertiesContainer(8000);
      try { await waitUntilPropertiesReady(container, 12000); } catch (_) {}
      if (card.parentElement !== container) {
        container.appendChild(card);
        LOG('card inserted into properties container');
      }
    } catch (e) {
      WARN('properties container not found in time:', e.message);
      setTimeout(mountForCurrentRoute, 400);
      return;
    }

    // Fetch description and image immediately after card insertion
    if (currentId !== id) {
      currentId = id;
      try {
        const [serverText, imgUrl] = await Promise.all([
          fetchDescription(id).catch(() => ''),
          fetchImageUrl(id).catch(() => null),
        ]);
        if (!drafts.has(id)) drafts.set(id, serverText || '');
        setTextareaValueFromDraft(card, id);
        const preview = card.querySelector('[data-acme="image-preview"]');
        if (imgUrl) { preview.src = imgUrl; preview.style.visibility = 'visible'; }
        else { preview.removeAttribute('src'); preview.style.visibility = 'hidden'; }
      } catch (_) { /* ignore */ }
    } else {
      setTextareaValueFromDraft(card, id);
    }
  }

  // Run a few times on first paint, then heartbeat
  function boot() {
    mountForCurrentRoute();
    setTimeout(mountForCurrentRoute, 120);
    setTimeout(mountForCurrentRoute, 400);
    setTimeout(mountForCurrentRoute, 1000);
    setTimeout(mountForCurrentRoute, 2000);
  }

  boot();

  window.addEventListener('hashchange', () => {
    lastHash = location.hash;
    currentId = null;
    mountForCurrentRoute();
    setTimeout(mountForCurrentRoute, 150);
  });

  // Heartbeat: handle React re-renders and late container mounts
  setInterval(() => {
    if (isTyping) return;

    // Detect hash drift (some navigations may not emit hashchange reliably)
    if (location.hash !== lastHash) {
      lastHash = location.hash;
      currentId = null;
      mountForCurrentRoute();
      return;
    }

    const id = getRouteCategoryId();
    if (!id) return;

    let card = document.querySelector('#acme-description-card');
    const container = findPropertiesContainer();
    // If the card disappeared due to a container swap, rebuild & hydrate
    if (!card && container) {
      currentId = null;
      mountForCurrentRoute();
      return;
    }
    if (card && container && card.parentElement !== container) {
      container.appendChild(card);
      LOG('card re-attached to properties container');
    }

    // Ensure image preview is hydrated if it was not set on first paint
    if (card) {
      const preview = card.querySelector('[data-acme="image-preview"]');
      if (preview && (!preview.getAttribute('src') || preview.style.visibility !== 'visible')) {
        fetchImageUrl(id).then((url) => {
          if (url) {
            if (preview.getAttribute('src') !== url) preview.setAttribute('src', url);
            preview.style.visibility = 'visible';
          }
        }).catch(() => {});
      }
    }
  }, 300);
})();
