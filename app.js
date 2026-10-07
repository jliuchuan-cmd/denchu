(() => {
  const $ = (sel) => document.querySelector(sel);
  const DEFAULT_CENTER = [35.6812, 139.7671, 17]; // 東京駅
  const ERA_BASE = { ad: 0, showa: 1925, heisei: 1988, reiwa: 2018 };
  const ERA_LABEL = { showa: '昭和', heisei: '平成', reiwa: '令和' };

  // 製造年の年代ごとのマーカー色
  const BANDS = [
    { max: 1969, color: '#7b1fa2', label: '〜1969' },
    { max: 1979, color: '#d32f2f', label: '1970年代' },
    { max: 1989, color: '#f57c00', label: '1980年代' },
    { max: 1999, color: '#fbc02d', label: '1990年代' },
    { max: 2009, color: '#7cb342', label: '2000年代' },
    { max: Infinity, color: '#2e7d32', label: '2010年〜' },
  ];
  const UNKNOWN_COLOR = '#9e9e9e';

  let map;
  let poles = [];
  let editing = null; // 編集中の電柱（新規時は {lat, lng} のみ）
  let pendingPhoto; // undefined: 変更なし / null: なし / string: 新しい写真
  let lastPos = null;

  const colorFor = (year) => (year ? BANDS.find((b) => year <= b.max).color : UNKNOWN_COLOR);

  function toAD(era, n) {
    n = parseInt(n, 10);
    if (!n) return null;
    return era === 'ad' ? n : ERA_BASE[era] + n;
  }

  function yearLabel(year) {
    if (!year) return '製造年不明';
    let wa = '';
    if (year >= 2019) wa = `令和${year - 2018 === 1 ? '元' : year - 2018}年`;
    else if (year >= 1989) wa = `平成${year - 1988 === 1 ? '元' : year - 1988}年`;
    else if (year >= 1926) wa = `昭和${year - 1925 === 1 ? '元' : year - 1925}年`;
    return `${year}年` + (wa ? `（${wa}）` : '');
  }

  // 長さ-強度（例: 13-500）。片方だけの場合は不明側を「?」で表示
  const specLabel = (p) => (p.height || p.strength ? `${p.height || '?'}-${p.strength || '?'}` : '');
  const toNum = (v) => parseInt(v, 10) || null;

  const gmapsUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;

  function el(tag, props = {}, ...children) {
    const e = document.createElement(tag);
    Object.assign(e, props);
    for (const c of children) if (c != null) e.append(c);
    return e;
  }

  // ---------- 地図 ----------

  function popupFor(p) {
    const box = el('div', { className: 'popup' },
      el('b', { textContent: yearLabel(p.year) }),
      specLabel(p) ? el('div', { textContent: specLabel(p) }) : null,
      p.number ? el('div', { textContent: p.number }) : null,
      p.owner ? el('div', { textContent: p.owner }) : null,
      p.memo ? el('div', { textContent: p.memo }) : null,
      p.photo ? el('img', { src: p.photo }) : null,
    );
    box.append(el('button', { textContent: '編集', onclick: () => openForm(p) }));
    return box;
  }

  function drawPole(p) {
    map.upsert(p.id, p.lat, p.lng, colorFor(p.year), popupFor(p));
  }

  function renderLegend() {
    const lg = $('#legend');
    lg.replaceChildren(
      ...BANDS.map((b) => el('div', {}, el('span', { className: 'dot', style: `background:${b.color}` }), b.label)),
      el('div', {}, el('span', { className: 'dot', style: `background:${UNKNOWN_COLOR}` }), '不明'),
    );
  }

  function updateCount() {
    $('#count').textContent = poles.length;
  }

  function locate(pan = true) {
    if (!navigator.geolocation) {
      alert('この端末では位置情報が使えません');
      return Promise.reject();
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
          map.showMe(lastPos.lat, lastPos.lng);
          if (pan) map.panTo(lastPos.lat, lastPos.lng, 18);
          resolve(lastPos);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    });
  }

  // ---------- 登録フォーム ----------

  const form = $('#form-pole');

  function updateYearPreview() {
    const y = toAD(form.era.value, form.yearInput.value);
    $('#year-ad').textContent = y && form.era.value !== 'ad' ? `= ${y}年` : '';
  }

  function openForm(p) {
    editing = p;
    pendingPhoto = undefined;
    const isNew = !p.id;
    $('#form-title').textContent = isNew ? '電柱を登録' : '電柱を編集';
    $('#form-coords').textContent = `緯度 ${p.lat.toFixed(6)} / 経度 ${p.lng.toFixed(6)}`;
    form.reset();
    form.era.value = p.era && p.era !== 'ad' ? p.era : 'ad';
    form.yearInput.value = p.year ? (form.era.value === 'ad' ? p.year : p.year - ERA_BASE[form.era.value]) : '';
    form.height.value = p.height || '';
    form.strength.value = p.strength || '';
    form.number.value = p.number || '';
    form.owner.value = p.owner || '';
    form.memo.value = p.memo || '';
    const prev = $('#photo-preview');
    prev.hidden = !p.photo;
    prev.src = p.photo || '';
    $('#btn-delete').hidden = isNew;
    updateYearPreview();
    $('#dlg-pole').showModal();
    if (isNew) form.yearInput.focus();
  }

  function resizeImage(file, maxSize = 800) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  form.era.addEventListener('change', updateYearPreview);
  form.yearInput.addEventListener('input', updateYearPreview);

  form.photo.addEventListener('change', async () => {
    const f = form.photo.files[0];
    if (!f) return;
    pendingPhoto = await resizeImage(f);
    const prev = $('#photo-preview');
    prev.src = pendingPhoto;
    prev.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const year = toAD(form.era.value, form.yearInput.value);
    if (year && (year < 1900 || year > new Date().getFullYear() + 1)) {
      alert(`製造年 ${year} は範囲外です。西暦/和暦の選択を確認してください。`);
      return;
    }
    const now = new Date().toISOString();
    const p = {
      ...editing,
      id: editing.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
      year,
      era: form.era.value,
      height: toNum(form.height.value),
      strength: toNum(form.strength.value),
      number: form.number.value.trim(),
      owner: form.owner.value,
      memo: form.memo.value.trim(),
      createdAt: editing.createdAt || now,
      updatedAt: now,
    };
    if (pendingPhoto !== undefined) p.photo = pendingPhoto;
    await PoleDB.put(p);
    const i = poles.findIndex((x) => x.id === p.id);
    if (i >= 0) poles[i] = p; else poles.push(p);
    drawPole(p);
    updateCount();
    $('#dlg-pole').close();
    if ($('#dlg-list').open) renderList();
  });

  $('#btn-cancel').addEventListener('click', () => $('#dlg-pole').close());

  $('#btn-delete').addEventListener('click', async () => {
    if (!editing?.id || !confirm('この電柱の記録を削除しますか？')) return;
    await PoleDB.remove(editing.id);
    poles = poles.filter((x) => x.id !== editing.id);
    map.remove(editing.id);
    updateCount();
    $('#dlg-pole').close();
    if ($('#dlg-list').open) renderList();
  });

  // ---------- 一覧・出力 ----------

  function sortedPoles() {
    const mode = $('#sort').value;
    const arr = [...poles];
    const y = (p, missing) => p.year || missing;
    if (mode === 'old-year') arr.sort((a, b) => y(a, 9999) - y(b, 9999));
    else if (mode === 'new-year') arr.sort((a, b) => y(b, 0) - y(a, 0));
    else arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return arr;
  }

  function renderList() {
    const list = $('#pole-list');
    const years = poles.map((p) => p.year).filter(Boolean);
    $('#stats').textContent = poles.length
      ? `${poles.length}本` + (years.length
        ? ` / 最古 ${Math.min(...years)}年・最新 ${Math.max(...years)}年・平均 ${Math.round(years.reduce((a, b) => a + b, 0) / years.length)}年`
        : '') + (years.length < poles.length ? ` / 製造年不明 ${poles.length - years.length}本` : '')
      : 'まだ登録がありません。地図をタップして登録してください。';
    list.replaceChildren(...sortedPoles().map((p) => el('li', {},
      el('span', { className: 'dot', style: `background:${colorFor(p.year)}` }),
      p.photo ? el('img', { src: p.photo, alt: '' }) : null,
      el('div', { className: 'info' },
        el('b', { textContent: yearLabel(p.year) }),
        el('div', { textContent: [specLabel(p), p.number, p.owner, p.memo].filter(Boolean).join(' / ') || '—' }),
      ),
      el('div', { className: 'acts' },
        el('button', {
          textContent: '地図',
          onclick: () => { $('#dlg-list').close(); map.panTo(p.lat, p.lng, 19); map.openPopup(p.id); },
        }),
        el('a', { textContent: 'Gマップ', href: gmapsUrl(p), target: '_blank', rel: 'noopener' }),
        el('button', { textContent: '編集', onclick: () => openForm(p) }),
      ),
    )));
  }

  function download(name, content, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([content], { type })), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  function toCsv() {
    const q = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['ID', '緯度', '経度', '製造年', '長さ(m)', '強度', '電柱番号', '種別', 'メモ', '写真', '登録日時', 'GoogleマップURL'];
    const rows = sortedPoles().map((p) => [
      p.id, p.lat.toFixed(7), p.lng.toFixed(7), p.year || '', p.height || '', p.strength || '', p.number, p.owner, p.memo,
      p.photo ? 'あり' : '', p.createdAt, gmapsUrl(p),
    ]);
    // 先頭のBOMで Excel でも文字化けしない
    return '﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
  }

  $('#btn-list').addEventListener('click', () => { renderList(); $('#dlg-list').showModal(); });
  $('#sort').addEventListener('change', renderList);
  $('#btn-export-csv').addEventListener('click', () => download(`denchu-${stamp()}.csv`, toCsv(), 'text/csv'));
  $('#btn-export-json').addEventListener('click', () =>
    download(`denchu-${stamp()}.json`, JSON.stringify({ version: 1, poles }, null, 1), 'application/json'));

  $('#file-import').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const incoming = (Array.isArray(data) ? data : data.poles || [])
        .filter((p) => p && p.id && Number.isFinite(p.lat) && Number.isFinite(p.lng));
      for (const p of incoming) {
        await PoleDB.put(p);
        const i = poles.findIndex((x) => x.id === p.id);
        if (i >= 0) poles[i] = p; else poles.push(p);
        drawPole(p);
      }
      updateCount();
      renderList();
      alert(`${incoming.length}件を読み込みました`);
    } catch (err) {
      alert('読み込みに失敗しました: ' + err.message);
    }
  });

  // ---------- 設定 ----------

  const settingsForm = $('#form-settings');
  $('#btn-settings').addEventListener('click', () => {
    settingsForm.apiKey.value = localStorage.getItem('gmapsKey') || '';
    $('#dlg-settings').showModal();
  });
  settingsForm.addEventListener('submit', () => {
    localStorage.setItem('gmapsKey', settingsForm.apiKey.value.trim());
    location.reload();
  });

  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close()));

  // ---------- 起動 ----------

  async function start() {
    let key = '';
    try { key = localStorage.getItem('gmapsKey') || ''; } catch { /* プライベートモード等 */ }
    const mapEl = $('#map');
    const onPick = (lat, lng) => openForm({ lat, lng });

    map = key ? MapAdapter.googleAdapter(key) : MapAdapter.leafletAdapter();
    try {
      await map.init(mapEl, DEFAULT_CENTER, onPick);
    } catch (err) {
      if (!key) {
        alert('地図を読み込めませんでした。通信環境を確認して再読込してください。');
        return;
      }
      alert(`Google マップを読み込めませんでした（${err.message}）。\nOpenStreetMap で表示します。設定のAPIキーを確認してください。`);
      mapEl.replaceChildren();
      map = MapAdapter.leafletAdapter();
      await map.init(mapEl, DEFAULT_CENTER, onPick);
    }
    window.gm_authFailure = () =>
      alert('Google Maps APIキーが無効か、Maps JavaScript API が有効になっていません。設定を確認してください。');

    renderLegend();
    poles = await PoleDB.all();
    poles.forEach(drawPole);
    updateCount();

    locate(true).catch(() => {});
  }

  $('#btn-locate').addEventListener('click', () =>
    locate(true).catch(() => alert('現在地を取得できませんでした')));

  $('#btn-add-here').addEventListener('click', async () => {
    try {
      const pos = await locate(true);
      openForm({ lat: pos.lat, lng: pos.lng });
    } catch {
      alert('現在地を取得できませんでした。地図をタップして位置を指定してください。');
    }
  });

  start();
})();
