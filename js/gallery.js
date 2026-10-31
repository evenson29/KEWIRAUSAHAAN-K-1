/* SticTech - Halaman Galeri (galeri.html) */
// Dependensi: js/config.js, js/app.js

(function () {
  'use strict';

  const grid = $('#gallery-grid');
  const empty = $('#empty-gallery');
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightbox-img');

  let currentFilter = 'semua';

  const demoGallery = [
    { id: 'demo-1', src: 'assets/stiker1.jpeg', judul: 'Stiker Logo Toko', kategori: 'logo' },
    { id: 'demo-2', src: 'assets/stiker2.jpeg', judul: 'Stiker Karakter Lucu', kategori: 'karakter' },
    { id: 'demo-3', src: 'assets/stiker3.jpeg', judul: 'Stiker Nama Custom', kategori: 'text' },
    { id: 'demo-4', src: 'assets/stiker4.jpeg', judul: 'Stiker Brand UMKM', kategori: 'custom' },
  ];

  const renderGallery = async () => {
    if (!grid || !empty) return;
    const dbItems = await DB.get('galeri');
    const items = dbItems.length > 0 ? dbItems : demoGallery;
    const filtered = currentFilter === 'semua'
      ? items
      : items.filter((i) => i.kategori === currentFilter);

    grid.innerHTML = '';
    if (filtered.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    filtered.forEach((item, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'gallery-item reveal';
      wrap.style.animationDelay = idx * 0.08 + 's';
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('aria-label', escapeHtml(item.judul));
      wrap.innerHTML =
        '<img src="' + escapeAttr(item.src) + '" alt="' + escapeHtml(item.judul) + '" '
        + 'loading="lazy" decoding="async" width="300" height="300" '
        + 'class="w-full h-full object-cover">'
        + '<div class="gallery-overlay"><div>'
        + '<p class="font-semibold text-white text-sm">' + escapeHtml(item.judul) + '</p>'
        + '<span class="badge ' + badgeFor(item.kategori || 'custom') + ' text-xs mt-1">'
        + escapeHtml(item.kategori || '') + '</span></div></div>';
      const open = () => {
        if (lightboxImg) lightboxImg.src = escapeAttr(item.src);
        if (lightbox) {
          lightbox.classList.remove('hidden');
          lightbox.setAttribute('aria-hidden', 'false');
        }
      };
      wrap.addEventListener('click', open);
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') open();
      });
      grid.appendChild(wrap);
    });

    setTimeout(() => {
      grid.querySelectorAll('.reveal:not(.revealed)').forEach((el) => {
        // observed by initSite reveal
      });
    }, 100);
  };

  const badgeFor = (k) => {
    const m = { logo: 'badge-blue', karakter: 'badge-purple', text: 'badge-indigo', custom: 'badge-yellow' };
    return m[k] || 'badge-gray';
  };

  const filterGallery = async (cat) => {
    currentFilter = cat;
    $$('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.filter === cat);
    });
    await renderGallery();
  };

  const closeLightbox = () => {
    if (lightbox) {
      lightbox.classList.add('hidden');
      lightbox.setAttribute('aria-hidden', 'true');
      if (lightboxImg) lightboxImg.src = '';
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await renderGallery();
    // Tombol filter sudah ada di HTML dengan onclick; tetapkan handler global
    window.filterGallery = filterGallery;
    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
      });
      lightbox.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
      });
    }
    window.closeLightbox = closeLightbox;
    window.openLightbox = (src) => {
      if (lightboxImg) lightboxImg.src = escapeAttr(src);
      if (lightbox) {
        lightbox.classList.remove('hidden');
        lightbox.setAttribute('aria-hidden', 'false');
      }
    };
  });
})();
