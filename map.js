// 地図アダプタ。Google Maps（APIキーあり）と OpenStreetMap/Leaflet（キーなし）を
// 同じインターフェースで扱う:
//   init(el, center, onPick)       地図を表示。地図クリックで onPick(lat, lng)
//   upsert(id, lat, lng, color, popupEl)  マーカーを追加・更新
//   remove(id)                     マーカー削除
//   panTo(lat, lng, zoom)          表示位置の移動
//   showMe(lat, lng)               現在地マーカー
//   openPopup(id)                  マーカーの吹き出しを開く
const MapAdapter = (() => {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('script load failed: ' + src));
      document.head.appendChild(s);
    });
  }

  function loadCss(href) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  function googleAdapter(apiKey) {
    let map, info, me;
    const markers = new Map();
    const popups = new Map();

    const icon = (color) => ({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#333',
      strokeWeight: 1,
    });

    return {
      name: 'google',
      async init(el, center, onPick) {
        await new Promise((resolve, reject) => {
          window.__gmReady = resolve;
          // キー不正などの認証エラー時に Google Maps が呼ぶグローバル関数
          window.gm_authFailure = () => reject(new Error('Google Maps の認証に失敗しました'));
          loadScript(
            'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) +
            '&callback=__gmReady&language=ja&region=JP&loading=async'
          ).catch(reject);
        });
        map = new google.maps.Map(el, {
          center: { lat: center[0], lng: center[1] },
          zoom: center[2],
          clickableIcons: false,
          gestureHandling: 'greedy',
          mapTypeControl: true,
          streetViewControl: true,
        });
        info = new google.maps.InfoWindow();
        map.addListener('click', (e) => onPick(e.latLng.lat(), e.latLng.lng()));
      },
      upsert(id, lat, lng, color, popupEl) {
        let m = markers.get(id);
        if (!m) {
          m = new google.maps.Marker({ map, zIndex: 1 });
          m.addListener('click', () => this.openPopup(id));
          markers.set(id, m);
        }
        m.setPosition({ lat, lng });
        m.setIcon(icon(color));
        popups.set(id, popupEl);
      },
      remove(id) {
        const m = markers.get(id);
        if (m) m.setMap(null);
        markers.delete(id);
        popups.delete(id);
        info.close();
      },
      openPopup(id) {
        const m = markers.get(id);
        if (!m) return;
        info.setContent(popups.get(id));
        info.open({ map, anchor: m });
      },
      panTo(lat, lng, zoom) {
        map.panTo({ lat, lng });
        if (zoom) map.setZoom(zoom);
      },
      showMe(lat, lng) {
        if (!me) {
          me = new google.maps.Marker({
            map,
            clickable: false,
            zIndex: 0,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
          });
        }
        me.setPosition({ lat, lng });
      },
    };
  }

  function leafletAdapter() {
    let map, me;
    const markers = new Map();

    return {
      name: 'leaflet',
      async init(el, center, onPick) {
        loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        map = L.map(el).setView([center[0], center[1]], center[2]);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        map.on('click', (e) => onPick(e.latlng.lat, e.latlng.lng));
      },
      upsert(id, lat, lng, color, popupEl) {
        let m = markers.get(id);
        if (!m) {
          m = L.circleMarker([lat, lng], { radius: 8, weight: 1, color: '#333', fillOpacity: 1 }).addTo(map);
          markers.set(id, m);
        }
        m.setLatLng([lat, lng]);
        m.setStyle({ fillColor: color });
        m.unbindPopup().bindPopup(popupEl);
      },
      remove(id) {
        const m = markers.get(id);
        if (m) m.remove();
        markers.delete(id);
      },
      openPopup(id) {
        const m = markers.get(id);
        if (m) m.openPopup();
      },
      panTo(lat, lng, zoom) {
        map.setView([lat, lng], zoom || map.getZoom());
      },
      showMe(lat, lng) {
        if (!me) {
          me = L.circleMarker([lat, lng], { radius: 7, weight: 2, color: '#fff', fillColor: '#1a73e8', fillOpacity: 1, interactive: false }).addTo(map).bringToBack();
        }
        me.setLatLng([lat, lng]);
      },
    };
  }

  return { googleAdapter, leafletAdapter };
})();
