/* SticTech - Inti aplikasi (DB, Auth, UI utilitas) */
// Muat terlebih dahulu: js/config.js

(function () {
  'use strict';

  /* ---------- DOM util ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (unsafe) => {
    if (unsafe == null) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const escapeAttr = (unsafe) => String(unsafe == null ? '' : unsafe).replace(/"/g, '&quot;');

  const isFiniteNumber = (n) => Number.isFinite(Number(n));

  const formatRupiah = (n) => {
    if (!isFiniteNumber(n)) return 'Rp 0';
    return 'Rp ' + Number(n).toLocaleString('id-ID');
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '-';
    }
  };

  const showToast = (msg, type = 'success') => {
    let container = $('#toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      container.style.position = 'fixed';
      container.style.bottom = '2rem';
      container.style.right = '2rem';
      container.style.zIndex = '2100';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '0.5rem';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  };

  const genId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const compressImage = (file, { maxWidth = 1000, quality = 0.85 } = {}) =>
    new Promise((resolve) => {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        resolve('');
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(fileToBase64(file));
      };
      img.src = url;
    });

  const generateWhatsAppLink = (phone, msg) => {
    const num = String(phone).replace(/[^0-9]/g, '');
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
  };

  /* ---------- Supabase ---------- */
  let supabaseClient = null;

  const initSupabase = () => {
    const { url, anonKey } = window.SUPABASE_CONFIG || {};
    const ready =
      url &&
      anonKey &&
      url !== 'YOUR_SUPABASE_URL' &&
      anonKey !== 'YOUR_ANON_KEY' &&
      url.startsWith('http') &&
      typeof window.supabase !== 'undefined';
    if (!ready) return false;
    if (supabaseClient) return true;
    try {
      supabaseClient = window.supabase.createClient(url, anonKey);
      return true;
    } catch (e) {
      console.warn('Supabase init failed:', e);
      return false;
    }
  };

  const isSupabaseReady = () => supabaseClient !== null;

  const DB = {
    mode: () => (isSupabaseReady() ? 'supabase' : 'localstorage'),

    async get(key) {
      if (isSupabaseReady()) {
        try {
          const { data, error } = await supabaseClient
            .from(key)
            .select('*')
            .order('created_at', { ascending: true });
          if (error) throw error;
          return data || [];
        } catch (e) {
          console.warn('Supabase get failed, fallback localStorage:', e.message);
        }
      }
      try {
        return JSON.parse(localStorage.getItem('stictech_' + key)) || [];
      } catch (e) {
        return [];
      }
    },

    async add(key, item) {
      item = { ...item, id: item.id || genId(), created_at: item.created_at || new Date().toISOString() };
      if (isSupabaseReady()) {
        try {
          const { data, error } = await supabaseClient.from(key).insert(item).select();
          if (error) throw error;
          return data[0] || item;
        } catch (e) {
          throw new Error('Gagal menyimpan ke server: ' + e.message);
        }
      }
      const items = this.getSync(key);
      items.push(item);
      this.setSync(key, items);
      return item;
    },

    async update(key, id, updates) {
      if (isSupabaseReady()) {
        try {
          const { data, error } = await supabaseClient.from(key).update(updates).eq('id', id).select();
          if (error) throw error;
          return data[0] || null;
        } catch (e) {
          throw new Error('Gagal memperbarui server: ' + e.message);
        }
      }
      const items = this.getSync(key);
      const idx = items.findIndex((i) => i.id === id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...updates };
        this.setSync(key, items);
        return items[idx];
      }
      return null;
    },

    async remove(key, id) {
      if (isSupabaseReady()) {
        try {
          const { error } = await supabaseClient.from(key).delete().eq('id', id);
          if (error) throw error;
          return;
        } catch (e) {
          throw new Error('Gagal menghapus server: ' + e.message);
        }
      }
      const items = this.getSync(key).filter((i) => i.id !== id);
      this.setSync(key, items);
    },

    async getById(key, id) {
      if (isSupabaseReady()) {
        try {
          const { data, error } = await supabaseClient.from(key).select('*').eq('id', id).single();
          if (error) throw error;
          return data;
        } catch (e) {
          // fallthrough to local
        }
      }
      return this.getSync(key).find((i) => i.id === id);
    },

    getSync(key) {
      try {
        return JSON.parse(localStorage.getItem('stictech_' + key)) || [];
      } catch (e) {
        return [];
      }
    },
    setSync(key, val) {
      localStorage.setItem('stictech_' + key, JSON.stringify(val));
    },
  };

  /* ---------- Auth ---------- */
  const Auth = {
    async signIn(email, password) {
      if (!initSupabase()) throw new Error('Supabase belum siap. Periksa koneksi dan konfigurasi.');
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      return data.user;
    },
    async signOut() {
      if (isSupabaseReady()) await supabaseClient.auth.signOut();
    },
    async getSession() {
      if (!initSupabase()) return null;
      const { data } = await supabaseClient.auth.getSession();
      return data.session;
    },
    onAuthStateChange(callback) {
      if (!initSupabase()) return () => {};
      return supabaseClient.auth.onAuthStateChange(callback);
    },
  };

  /* ---------- UI global ---------- */
  const toggleMobileNav = () => {
    const nav = $('.nav-mobile');
    const hamburger = $('.hamburger');
    const open = nav && !nav.classList.contains('open');
    if (nav) nav.classList.toggle('open');
    if (hamburger) {
      hamburger.classList.toggle('active');
      hamburger.setAttribute('aria-expanded', String(open));
    }
  };

  const closeMobileNav = () => {
    const nav = $('.nav-mobile');
    const hamburger = $('.hamburger');
    if (nav) nav.classList.remove('open');
    if (hamburger) {
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  };

  const initParticles = (containerId = 'particles', count = 25) => {
    const c = $(containerId);
    if (!c || c.children.length > 0) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      c.style.display = 'none';
      return;
    }
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.width = p.style.height = Math.random() * 3 + 1 + 'px';
      p.style.animationDuration = Math.random() * 15 + 10 + 's';
      p.style.animationDelay = Math.random() * 10 + 's';
      p.style.opacity = Math.random() * 0.4 + 0.1;
      c.appendChild(p);
    }
  };

  const initNavbar = () => {
    const nav = $('#navbar');
    const btn = $('#backToTop');
    const hamb = $('.hamburger');
    let lastScrollY = 0;

    if (hamb) {
      hamb.addEventListener('click', toggleMobileNav);
    }

    const onScroll = () => {
      const y = window.scrollY;
      if (nav) {
        if (y > 50) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
        if (y > lastScrollY && y > 100) nav.classList.add('nav-hidden');
        else nav.classList.remove('nav-hidden');
      }
      if (btn) {
        if (y > 400) btn.classList.add('visible');
        else btn.classList.remove('visible');
      }
      lastScrollY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Tutup menu mobile saat klik link / luar / Escape
    $$('.nav-link').forEach((el) => {
      el.addEventListener('click', () => closeMobileNav());
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMobileNav();
    });
    document.addEventListener('click', (e) => {
      const nav = $('.nav-mobile');
      const hamb = $('.hamburger');
      if (nav && nav.classList.contains('open') && !nav.contains(e.target) && !hamb.contains(e.target)) {
        closeMobileNav();
      }
    });
  };

  const setupImageErrorFallback = () => {
    document.addEventListener(
      'error',
      (e) => {
        if (e.target.tagName === 'IMG') {
          const wrap = e.target.parentElement;
          if (wrap && wrap.classList.contains('gallery-item')) {
            wrap.style.display = 'none';
          } else {
            e.target.style.display = 'none';
            const next = e.target.nextElementSibling;
            if (next && next.style) next.style.display = 'inline';
          }
        }
      },
      true
    );
  };

  const initReveal = (root = document) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('revealed');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );
    $$('.reveal', root).forEach((el) => observer.observe(el));
    return observer;
  };

  let isSiteInitialized = false;
  const initSite = () => {
    if (isSiteInitialized) return;
    isSiteInitialized = true;
    initSupabase();
    initParticles('particles', 25);
    initNavbar();
    setupImageErrorFallback();
    initReveal();
    // Tahun dinamis di footer
    $$('[data-year]').forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  };

  document.addEventListener('DOMContentLoaded', initSite);

  /* ---------- Modal ---------- */
  let modalResolve = null;
  const openModal = (title, bodyHtml, onSave) => {
    const el = $('#edit-modal');
    const titleEl = $('#modal-title');
    const bodyEl = $('#modal-body');
    if (!el || !titleEl || !bodyEl) return;
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    modalResolve = null;
    return new Promise((resolve) => {
      modalResolve = (value) => {
        resolve(value);
        closeModal();
      };
      const saveBtn = $('#modal-save');
      const closeBtn = $('#modal-close');
      const backdropClick = (e) => {
        if (e.target === el) {
          closeModal();
          resolve(null);
        }
      };
      const key = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          resolve(null);
        }
      };
      el.addEventListener('click', backdropClick, { once: true });
      window.addEventListener('keydown', key, { once: true });
      const cleanup = () => {
        el.removeEventListener('click', backdropClick);
        window.removeEventListener('keydown', key);
      };
      const doSave = async () => {
        el.classList.add('saving');
        try {
          if (onSave) await onSave();
          cleanup();
          closeModal();
          resolve(true);
        } catch (err) {
          el.classList.remove('saving');
          showToast(err.message || 'Terjadi kesalahan.', 'error');
        }
      };
      if (saveBtn) {
        saveBtn.replaceWith(saveBtn.cloneNode(true));
        $('#modal-save').addEventListener('click', doSave);
      }
      if (closeBtn) {
        closeBtn.replaceWith(closeBtn.cloneNode(true));
        $('#modal-close').addEventListener('click', () => {
          cleanup();
          closeModal();
          resolve(null);
        });
      }
    });
  };

  const closeModal = () => {
    const el = $('#edit-modal');
    if (el) {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      el.classList.remove('saving');
    }
    modalResolve = null;
  };

  const saveModal = () => {
    if (modalResolve) modalResolve(true);
    closeModal();
  };

  /* expose */
  const badgeFor = (key) => {
    // Satu-satunya pemetaan warna label: kategori galeri + nama warna langkah
    // proses (termasuk nilai lama di database) -> kelas badge palet SticTech.
    const m = {
      logo: 'badge-teal', karakter: 'badge-amber', text: 'badge-green', custom: 'badge-yellow',
      teal: 'badge-teal', blue: 'badge-blue', indigo: 'badge-indigo', purple: 'badge-purple',
      amber: 'badge-amber', yellow: 'badge-yellow', green: 'badge-green', pink: 'badge-pink', red: 'badge-red',
    };
    return m[key] || 'badge-gray';
  };

  window.badgeFor = badgeFor;
  window.escapeHtml = escapeHtml;
  window.escapeAttr = escapeAttr;
  window.formatRupiah = formatRupiah;
  window.formatDate = formatDate;
  window.showToast = showToast;
  window.genId = genId;
  window.fileToBase64 = fileToBase64;
  window.compressImage = compressImage;
  window.generateWhatsAppLink = generateWhatsAppLink;
  window.toggleMobileNav = toggleMobileNav;
  window.closeMobileNav = closeMobileNav;
  window.initSite = initSite;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.saveModal = saveModal;
  window.DB = DB;
  window.Auth = Auth;
  window.isSupabaseReady = isSupabaseReady;
  window.initSupabase = initSupabase;
})();
