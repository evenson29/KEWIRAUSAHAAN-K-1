/* SticTech - Panel Admin (admin.html) */
// Dependensi: js/config.js, js/app.js

(function () {
  'use strict';

  /* ---------- Elemen ---------- */
  const el = (id) => $(id);
  const loginSection = el('login-section');
  const dashboardSection = el('dashboard-section');

  let currentTab = 'orders';
  let isLoggedIn = false;

  /* ---------- Auth ---------- */
  const updateAuthUI = async () => {
    const session = await Auth.getSession();
    isLoggedIn = !!session;
    if (isLoggedIn) {
      loginSection.classList.add('hidden');
      dashboardSection.classList.remove('hidden');
      await showDashboard();
    } else {
      loginSection.classList.remove('hidden');
      dashboardSection.classList.add('hidden');
    }
  };

  const doLogin = async (e) => {
    e.preventDefault();
    const btn = el('login-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Masuk...'; }
    try {
      await Auth.signIn(el('login-user').value, el('login-pass').value);
      showToast('Login berhasil!');
    } catch (err) {
      showToast(err.message || 'Login gagal. Periksa email dan password.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
      await updateAuthUI();
    }
  };

  const doLogout = async () => {
    await Auth.signOut();
    isLoggedIn = false;
    updateAuthUI();
    showToast('Berhasil keluar.', 'info');
  };

  /* ---------- Statistik ---------- */
  const updateStats = async () => {
    const orders = await DB.get('pesanan');
    const txs = await DB.get('transaksi');
    const newOrders = orders.filter((o) => o.status === 'diterima').length;
    const income = txs
      .filter((t) => t.jenis === 'pemasukan')
      .reduce((s, t) => s + (t.nominal || 0), 0);
    const expense = txs
      .filter((t) => t.jenis === 'pengeluaran')
      .reduce((s, t) => s + (t.nominal || 0), 0);

    setText('stat-orders', newOrders);
    setText('stat-income', formatRupiah(income));
    setText('stat-expense', formatRupiah(expense));
    setText('stat-profit', formatRupiah(income - expense));
  };

  const setText = (id, val) => {
    const e = el(id);
    if (e) e.textContent = val;
  };

  /* ---------- Tabs ---------- */
  const switchTab = async (tab) => {
    currentTab = tab;
    $$('[data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    ['orders', 'finance', 'products', 'process', 'projection', 'galeri'].forEach((t) => {
      const p = el('tab-' + t);
      if (p) p.classList.toggle('hidden', t !== tab);
    });
    if (tab === 'orders') { await renderOrders(); await updateStats(); }
    else if (tab === 'finance') { await renderFinance(); await updateStats(); }
    else if (tab === 'products') await renderProducts();
    else if (tab === 'process') await renderProcessSteps();
    else if (tab === 'projection') { await loadProjection(); calcProjection(); }
    else if (tab === 'galeri') await renderGaleriAdmin();
  };

  const showDashboard = async () => {
    await renderOrders();
    await renderFinance();
    await renderProducts();
    await renderProcessSteps();
    await loadProjection();
    await updateStats();
    switchTab('orders');
    el('dashboard-section').querySelectorAll('.reveal').forEach((node) => {
      // observed by initSite reveal
    });
  };

  /* ---------- Helper render ---------- */
  const statusBadge = (status) => {
    const cls = {
      diterima: 'badge-yellow', dicetak: 'badge-blue', selesai: 'badge-green', diambil: 'badge-purple',
    }[status] || 'badge-gray';
    return '<span class="badge ' + cls + '">' + escapeHtml(STATUS_LABEL[status] || status) + '</span>';
  };

  const paymentBadge = (metode) => {
    const cls = metode === 'bayar_di_tempat' ? 'badge-yellow' : 'badge-blue';
    return '<span class="badge ' + cls + '">' + escapeHtml(PAYMENT_LABEL[metode] || metode) + '</span>';
  };

  /* ---------- Pesanan ---------- */
  const renderOrders = async () => {
    const orders = await DB.get('pesanan');
    const search = (el('search-order') && el('search-order').value.toLowerCase()) || '';
    const status = (el('filter-status') && el('filter-status').value) || 'semua';
    let filtered = orders.filter((o) => {
      const hay = ((o.nama_pemesan || '') + ' ' + (o.produk_nama || '') + ' ' + (o.whatsapp || '')).toLowerCase();
      return hay.includes(search);
    });
    if (status !== 'semua') filtered = filtered.filter((o) => o.status === status);

    const tbody = el('orders-table');
    const empty = el('orders-empty');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    tbody.innerHTML = filtered.map((o) => {
      const created = o.created_at ? formatDate(o.created_at) : '-';
      const actions = '<div class="flex gap-1 flex-wrap">';
      if (o.status !== 'diambil') {
        const next = NEXT_STATUS[o.status];
        if (next) {
          actions += '<button onclick="updateOrderStatus(\'' + escapeAttr(o.id) + '\',\'' + escapeAttr(next) + '\')" '
            + 'class="btn-success btn-sm">' + escapeHtml(getNextLabel(o.status)) + '</button>';
        }
      }
      actions += '<button onclick="orderDetail(\'' + escapeAttr(o.id) + '\')" class="btn-secondary btn-sm">Detail</button>';
      actions += '<button onclick="confirmDeleteOrder(\'' + escapeAttr(o.id) + '\')" class="btn-danger btn-sm">Hapus</button>';
      actions += '<a href="' + escapeAttr(generateWhatsAppLink(o.whatsapp || SITE_CONFIG.whatsapp, 'Halo SticTech, saya ingin menanyakan status pesanan saya.')) + '" '
        + 'class="btn-primary btn-sm text-xs" target="_blank" rel="noopener">WA Pelanggan</a>';
      actions += '</div>';

      return (
        '<tr>'
        + '<td class="font-medium text-[#2D2D2D]">' + escapeHtml(o.nama_pemesan || '')
        + '<br><span class="text-xs text-[#555555]">' + escapeHtml(o.whatsapp || '') + '</span>'
        + '<br><span class="text-xs text-[#555555]">' + escapeHtml(created) + '</span></td>'
        + '<td>' + escapeHtml(o.produk_nama || '-') + '</td>'
        + '<td>' + (o.jumlah || 0) + ' pcs</td>'
        + '<td class="font-bold text-[#2D2D2D]">' + formatRupiah(o.total_harga || 0) + '</td>'
        + '<td>' + paymentBadge(o.metode_bayar) + '</td>'
        + '<td>' + statusBadge(o.status) + '</td>'
        + '<td>' + actions + '</td>'
        + '</tr>'
      );
    }).join('');
  };

  const getNextLabel = (status) => ({ diterima: 'Cetak', dicetak: 'Selesai', selesai: 'Diambil' }[status] || '');

  const updateOrderStatus = async (id, newStatus) => {
    await DB.update('pesanan', id, { status: newStatus });
    await renderOrders();
    await updateStats();
    showToast('Status diperbarui ke: ' + (STATUS_LABEL[newStatus] || newStatus));
  };

  const orderDetail = async (id) => {
    const o = await DB.getById('pesanan', id);
    if (!o) { showToast('Pesanan tidak ditemukan.', 'error'); return; }
    const body =
      '<div class="space-y-3 text-sm">'
      + '<div class="grid grid-cols-2 gap-2"><div><span class="text-[#555555] text-xs block">ID</span>'
      + '<span class="font-mono text-xs">' + escapeHtml(o.id) + '</span></div>'
      + '<div><span class="text-[#555555] text-xs block">Tanggal</span>'
      + '<span>' + escapeHtml(o.created_at ? formatDate(o.created_at) : '-') + '</span></div></div>'
      + '<div><span class="text-[#555555] text-xs block">Nama</span><span class="font-medium block">'
      + escapeHtml(o.nama_pemesan || '') + '</span></div>'
      + '<div><span class="text-[#555555] text-xs block">WhatsApp</span>'
      + '<a href="' + escapeAttr(generateWhatsAppLink(o.whatsapp || SITE_CONFIG.whatsapp, 'Halo SticTech, saya ingin menanyakan pesanan.')) + '" '
      + 'class="text-[#059669] hover:underline block">' + escapeHtml(o.whatsapp || '-') + '</a></div>'
      + '<div><span class="text-[#555555] text-xs block">Produk</span><span class="block">' + escapeHtml(o.produk_nama || '-') + '</span></div>'
      + '<div><span class="text-[#555555] text-xs block">Jumlah</span><span class="block">' + (o.jumlah || 0) + ' pcs</span></div>'
      + '<div><span class="text-[#555555] text-xs block">Total</span><span class="font-bold block">' + formatRupiah(o.total_harga || 0) + '</span></div>'
      + '<div><span class="text-[#555555] text-xs block">Pembayaran</span><span class="block">' + escapeHtml(PAYMENT_LABEL[o.metode_bayar] || o.metode_bayar) + '</span></div>'
      + '<div><span class="text-[#555555] text-xs block">Status</span><span class="block">' + statusBadge(o.status) + '</span></div>'
      + '<div><span class="text-[#555555] text-xs block">Catatan</span><span class="block whitespace-pre-wrap">' + escapeHtml(o.catatan || '-') + '</span></div>'
      + '</div>';
    await openModal('Detail Pesanan #' + escapeHtml(o.id), body);
  };

  const confirmDeleteOrder = async (id) => {
    if (!confirm('Hapus pesanan ini?')) return;
    await DB.remove('pesanan', id);
    await renderOrders();
    await updateStats();
    showToast('Pesanan dihapus.', 'info');
  };

  /* ---------- Keuangan ---------- */
  const addTransaction = async (e) => {
    e.preventDefault();
    await DB.add('transaksi', {
      keterangan: el('tx-desc').value.trim(),
      jenis: el('tx-type').value,
      nominal: parseInt(el('tx-amount').value) || 0,
    });
    el('tx-desc').value = '';
    el('tx-amount').value = '';
    await renderFinance();
    await updateStats();
    showToast('Transaksi tersimpan!');
  };

  const renderFinance = async () => {
    const txs = await DB.get('transaksi');
    const tbody = el('finance-table');
    const empty = el('finance-empty');
    if (!tbody) return;
    if (txs.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    tbody.innerHTML = txs.map((t) => {
      const isIn = t.jenis === 'pemasukan';
      const cls = isIn ? 'badge-green' : 'badge-red';
      const color = isIn ? 'text-[#059669]' : 'text-[#DC2626]';
      const sign = isIn ? '+' : '-';
      return (
        '<tr>'
        + '<td class="text-[#555555]">' + escapeHtml(t.created_at ? formatDate(t.created_at) : '-') + '</td>'
        + '<td>' + escapeHtml(t.keterangan || '') + '</td>'
        + '<td><span class="badge ' + cls + '">' + escapeHtml(t.jenis) + '</span></td>'
        + '<td class="font-bold ' + color + '">' + sign + ' ' + formatRupiah(t.nominal || 0) + '</td>'
        + '<td><button onclick="confirmDeleteTx(\'' + escapeAttr(t.id) + '\')" class="btn-danger btn-sm">Hapus</button></td>'
        + '</tr>'
      );
    }).join('');
  };

  const confirmDeleteTx = async (id) => {
    if (!confirm('Hapus transaksi ini?')) return;
    await DB.remove('transaksi', id);
    await renderFinance();
    await updateStats();
    showToast('Transaksi dihapus.', 'info');
  };

  const downloadExcel = async () => {
    const txs = await DB.get('transaksi');
    if (txs.length === 0) { showToast('Belum ada transaksi untuk di-download.', 'error'); return; }
    const income = txs.filter((t) => t.jenis === 'pemasukan').reduce((s, t) => s + (t.nominal || 0), 0);
    const expense = txs.filter((t) => t.jenis === 'pengeluaran').reduce((s, t) => s + (t.nominal || 0), 0);
    const rows = [
      ['LAPORAN KEUANGAN STICTECH'],
      ['Tanggal Download', new Date().toLocaleDateString('id-ID')],
      [],
      ['Tanggal', 'Keterangan', 'Jenis', 'Nominal (Rp)'],
    ];
    txs.forEach((t) => {
      rows.push([
        formatDate(t.created_at),
        t.keterangan,
        t.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        t.jenis === 'pemasukan' ? (t.nominal || 0) : -(t.nominal || 0),
      ]);
    });
    rows.push([]);
    rows.push(['', 'Total Pemasukan', '', income]);
    rows.push(['', 'Total Pengeluaran', '', -expense]);
    rows.push(['', 'LABA / RUGI', '', income - expense]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Keuangan');
    XLSX.writeFile(wb, 'Laporan_Keuangan_SticTech_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    showToast('Laporan Excel berhasil di-download!');
  };

  /* ---------- Produk ---------- */
  const addProduct = async (e) => {
    e.preventDefault();
    const imageFile = el('prod-image').files[0];
    let gambarUrl = '';
    if (imageFile) gambarUrl = await compressImage(imageFile, { maxWidth: 1000, quality: 0.85 });
    await DB.add('produk', {
      nama: el('prod-name').value.trim(),
      deskripsi: el('prod-desc').value.trim(),
      harga: parseInt(el('prod-price').value) || 0,
      gambar_url: gambarUrl,
    });
    el('prod-name').value = '';
    el('prod-desc').value = '';
    el('prod-price').value = '';
    el('prod-image').value = '';
    await renderProducts();
    showToast('Produk ditambahkan!');
  };

  const renderProducts = async () => {
    const products = await DB.get('produk');
    const tbody = el('products-table');
    if (!tbody) return;
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:3rem 1rem">Belum ada produk. Tambahkan produk pertama lewat form di atas.</td></tr>';
      return;
    }
    tbody.innerHTML = products.map((p) => {
      const imgCell = p.gambar_url
        ? '<img src="' + escapeAttr(p.gambar_url) + '" alt="' + escapeHtml(p.nama) + '" loading="lazy" decoding="async" width="48" height="48" '
        + 'class="w-12 h-12 rounded-lg object-cover border border-[#E0E0E0]">'
        : '<div class="w-12 h-12 rounded-lg bg-[#F5F5F5] border border-[#E0E0E0] flex items-center justify-center text-[#888888] text-xs">-</div>';
      return (
        '<tr>'
        + '<td>' + imgCell + '</td>'
        + '<td class="font-medium text-[#2D2D2D]">' + escapeHtml(p.nama) + '</td>'
        + '<td class="text-[#555555]">' + escapeHtml(p.deskripsi || '') + '</td>'
        + '<td class="font-bold text-[#2D2D2D]">' + formatRupiah(p.harga) + '</td>'
        + '<td><div class="flex gap-1">'
        + '<button onclick="editProduct(\'' + escapeAttr(p.id) + '\')" class="btn-secondary btn-sm">Edit</button>'
        + '<button onclick="confirmDeleteProduct(\'' + escapeAttr(p.id) + '\')" class="btn-danger btn-sm">Hapus</button>'
        + '</div></td></tr>'
      );
    }).join('');
  };

  const editProduct = async (id) => {
    const p = await DB.getById('produk', id);
    if (!p) return;
    const body =
      '<div class="space-y-3">'
      + '<input type="text" id="edit-name" class="input-dark" value="' + escapeAttr(p.nama) + '" placeholder="Nama">'
      + '<input type="text" id="edit-desc" class="input-dark" value="' + escapeAttr(p.deskripsi || '') + '" placeholder="Deskripsi">'
      + '<input type="number" id="edit-price" class="input-dark" value="' + escapeAttr(p.harga) + '" placeholder="Harga">'
      + '<input type="file" id="edit-image" accept="image/*" class="input-dark text-sm">'
      + '</div>';
    await openModal('Edit Produk', body, async () => {
      const imageFile = el('edit-image').files[0];
      const updates = {
        nama: el('edit-name').value.trim(),
        deskripsi: el('edit-desc').value.trim(),
        harga: parseInt(el('edit-price').value) || 0,
      };
      if (imageFile) updates.gambar_url = await compressImage(imageFile, { maxWidth: 1000, quality: 0.85 });
      await DB.update('produk', id, updates);
      await renderProducts();
      showToast('Produk diperbarui!');
    });
  };

  const confirmDeleteProduct = async (id) => {
    if (!confirm('Hapus produk ini?')) return;
    await DB.remove('produk', id);
    await renderProducts();
    showToast('Produk dihapus.', 'info');
  };

  /* ---------- Proses Kerja ---------- */
  const renderProcessSteps = async () => {
    const steps = await DB.get('proses_kerja');
    const countEl = el('process-count');
    const emptyEl = el('process-empty');
    if (countEl) countEl.textContent = steps.length + ' langkah aktif';

    if (steps.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      el('process-steps-form').innerHTML = '';
      el('process-table').innerHTML = '';
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    const sorted = steps.slice().sort((a, b) => a.urutan - b.urutan);
    const form = el('process-steps-form');
    form.innerHTML = sorted.map((s) => {
      return (
        '<div class="p-4 rounded-xl bg-[#F5F5F5] border border-[#E0E0E0] space-y-3 relative">'
        + '<button onclick="moveProcess(\'' + escapeAttr(s.id) + '\',-1)" class="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#00ADB5]/10 border border-[#00ADB5]/20 flex items-center justify-center text-[#00838F] text-xs" title="Naik">&#8593;</button>'
        + '<button onclick="moveProcess(\'' + escapeAttr(s.id) + '\',1)" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#00ADB5]/10 border border-[#00ADB5]/20 flex items-center justify-center text-[#00838F] text-xs" title="Turun">&#8595;</button>'
        + '<button onclick="confirmDeleteProcessStep(\'' + escapeAttr(s.id) + '\')" class="absolute top-2 right-10 w-6 h-6 rounded-full bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center justify-center text-[#DC2626] text-xs" title="Hapus">&#10005;</button>'
        + '<div class="flex items-center gap-2">'
        + '<span class="w-8 h-8 rounded-full bg-[#00ADB5]/15 border border-[#E0E0E0] flex items-center justify-center text-[#888888] font-bold text-sm shrink-0">' + s.urutan + '</span>'
        + '<input type="text" id="step-title-' + escapeAttr(s.id) + '" class="input-dark flex-1 text-sm" value="' + escapeAttr(s.judul || '') + '" placeholder="Judul langkah">'
        + '</div>'
        + '<textarea id="step-desc-' + escapeAttr(s.id) + '" class="input-dark text-sm" rows="2" placeholder="Deskripsi langkah...">' + escapeAttr(s.deskripsi || '') + '</textarea>'
        + '<div class="grid grid-cols-2 gap-3">'
        + '<div><label class="block text-xs text-[#555555] mb-1">Foto</label><input type="file" id="step-img-' + escapeAttr(s.id) + '" accept="image/*" class="input-dark text-xs"></div>'
        + '<div><label class="block text-xs text-[#555555] mb-1">Warna</label>'
        + '<select id="step-color-' + escapeAttr(s.id) + '" class="select-dark text-sm">'
        + DEFAULT_COLORS.map((c) => '<option value="' + c + '" ' + (s.warna === c ? 'selected' : '') + '>' + c + '</option>').join('')
        + '</select></div></div>'
        + (s.gambar ? '<img src="' + escapeAttr(s.gambar) + '" class="w-full h-20 object-cover rounded-lg border border-[#E0E0E0]">' : '')
        + '</div>'
      );
    }).join('');

    const tbody = el('process-table');
    tbody.innerHTML = sorted.map((s) => {
      const imgCell = s.gambar
        ? '<img src="' + escapeAttr(s.gambar) + '" alt="' + escapeHtml(s.judul) + '" class="w-10 h-10 rounded-lg object-cover border border-[#E0E0E0]">'
        : '<div class="w-10 h-10 rounded-lg bg-[#F5F5F5] border border-[#E0E0E0] flex items-center justify-center text-[#888888] text-xs">-</div>';
      const badgeCls = badgeFor(s.warna);
      return (
        '<tr>'
        + '<td>' + imgCell + '</td>'
        + '<td class="text-center font-bold text-[#888888]">' + s.urutan + '</td>'
        + '<td class="font-medium text-[#2D2D2D]">' + escapeHtml(s.judul) + '</td>'
        + '<td class="text-[#555555] text-sm max-w-[200px] truncate">' + escapeHtml(s.deskripsi || '') + '</td>'
        + '<td><span class="badge ' + badgeCls + '">' + escapeHtml(s.warna) + '</span></td>'
        + '<td><button onclick="confirmDeleteProcessStep(\'' + escapeAttr(s.id) + '\')" class="btn-danger btn-sm">Hapus</button></td>'
        + '</tr>'
      );
    }).join('');
  };

  const moveProcess = async (id, dir) => {
    const steps = await DB.get('proses_kerja');
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const a = steps[idx];
    const b = steps[target];
    const ta = a.urutan;
    a.urutan = b.urutan;
    b.urutan = ta;
    await DB.update('proses_kerja', a.id, { urutan: a.urutan });
    await DB.update('proses_kerja', b.id, { urutan: b.urutan });
    await renderProcessSteps();
  };

  const addProcessStep = async () => {
    const steps = await DB.get('proses_kerja');
    const maxUrut = steps.length ? Math.max(...steps.map((s) => s.urutan || 0)) : 0;
    const color = DEFAULT_COLORS[steps.length % DEFAULT_COLORS.length];
    await DB.add('proses_kerja', {
      urutan: maxUrut + 1,
      judul: 'Langkah ' + (maxUrut + 1),
      deskripsi: 'Deskripsi langkah ke-' + (maxUrut + 1),
      gambar: '',
      warna: color,
    });
    await renderProcessSteps();
    showToast('Langkah baru ditambahkan!');
  };

  const saveProcessSteps = async () => {
    const steps = await DB.get('proses_kerja');
    for (const s of steps) {
      const titleEl = el('step-title-' + s.id);
      const descEl = el('step-desc-' + s.id);
      const colorEl = el('step-color-' + s.id);
      const imgEl = el('step-img-' + s.id);
      if (titleEl) s.judul = titleEl.value.trim();
      if (descEl) s.deskripsi = descEl.value.trim();
      if (colorEl) s.warna = colorEl.value;
      if (imgEl && imgEl.files[0]) s.gambar = await compressImage(imgEl.files[0], { maxWidth: 800, quality: 0.85 });
      await DB.update('proses_kerja', s.id, { judul: s.judul, deskripsi: s.deskripsi, warna: s.warna, gambar: s.gambar });
    }
    await renderProcessSteps();
    showToast('Proses kerja tersimpan!');
  };

  const confirmDeleteProcessStep = async (id) => {
    if (!confirm('Hapus langkah ini?')) return;
    await DB.remove('proses_kerja', id);
    await renderProcessSteps();
    showToast('Langkah dihapus.', 'info');
  };

  /* ---------- Galeri Admin ---------- */
  const renderGaleriAdmin = async () => {
    const items = await DB.get('galeri');
    const tbody = el('galeri-table');
    if (!tbody) return;
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:3rem 1rem">Belum ada foto di galeri. Tambahkan foto pertama lewat form di atas.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((i) => (
      '<tr>'
      + '<td><img src="' + escapeAttr(i.src) + '" alt="' + escapeHtml(i.judul) + '" loading="lazy" decoding="async" width="40" height="40" '
      + 'class="w-10 h-10 rounded object-cover border border-[#E0E0E0]"></td>'
      + '<td class="font-medium text-[#2D2D2D]">' + escapeHtml(i.judul) + '</td>'
      + '<td class="text-[#555555] text-sm">' + escapeHtml(i.kategori || '-') + '</td>'
      + '<td><div class="flex gap-1">'
      + '<button onclick="editGaleri(\'' + escapeAttr(i.id) + '\')" class="btn-secondary btn-sm">Edit</button>'
      + '<button onclick="confirmDeleteGaleri(\'' + escapeAttr(i.id) + '\')" class="btn-danger btn-sm">Hapus</button>'
      + '</div></td></tr>'
    )).join('');
  };

  const addGaleri = async (e) => {
    e.preventDefault();
    const imageFile = el('galeri-image').files[0];
    if (!imageFile) { showToast('Pilih gambar terlebih dahulu.', 'error'); return; }
    const src = await compressImage(imageFile, { maxWidth: 1000, quality: 0.85 });
    await DB.add('galeri', {
      src,
      judul: el('galeri-judul').value.trim(),
      kategori: el('galeri-kategori').value,
    });
    el('galeri-judul').value = '';
    el('galeri-image').value = '';
    await renderGaleriAdmin();
    showToast('Galeri ditambahkan!');
  };

  const editGaleri = async (id) => {
    const i = await DB.getById('galeri', id);
    if (!i) return;
    const body =
      '<div class="space-y-3">'
      + '<input type="text" id="edit-g-judul" class="input-dark" value="' + escapeAttr(i.judul) + '" placeholder="Judul">'
      + '<select id="edit-g-kategori" class="select-dark">'
      + '<option value="logo" ' + (i.kategori === 'logo' ? 'selected' : '') + '>Logo</option>'
      + '<option value="karakter" ' + (i.kategori === 'karakter' ? 'selected' : '') + '>Karakter</option>'
      + '<option value="text" ' + (i.kategori === 'text' ? 'selected' : '') + '>Text</option>'
      + '<option value="custom" ' + (i.kategori === 'custom' ? 'selected' : '') + '>Custom</option>'
      + '</select>'
      + '<input type="file" id="edit-g-image" accept="image/*" class="input-dark text-sm">'
      + '</div>';
    await openModal('Edit Galeri', body, async () => {
      const updates = {
        judul: el('edit-g-judul').value.trim(),
        kategori: el('edit-g-kategori').value,
      };
      const f = el('edit-g-image').files[0];
      if (f) updates.src = await compressImage(f, { maxWidth: 1000, quality: 0.85 });
      await DB.update('galeri', id, updates);
      await renderGaleriAdmin();
      showToast('Galeri diperbarui!');
    });
  };

  const confirmDeleteGaleri = async (id) => {
    if (!confirm('Hapus dari galeri?')) return;
    await DB.remove('galeri', id);
    await renderGaleriAdmin();
    showToast('Galeri dihapus.', 'info');
  };

  /* ---------- Proyeksi ---------- */
  const loadProjection = async () => {
    const data = await DB.get('proyeksi');
    const defaults = {
      equip: 5000000,
      material: 1000000,
      promo: 500000,
      prod_cost: 500000,
      dist_cost: 200000,
      ad_cost: 300000,
      units_day: 50,
      price: 1000,
      days: 25,
    };
    const map = {
      equip: 'proj-equip',
      material: 'proj-material',
      promo: 'proj-promo',
      prod_cost: 'proj-prod-cost',
      dist_cost: 'proj-dist-cost',
      ad_cost: 'proj-ad-cost',
      units_day: 'proj-units-day',
      price: 'proj-price',
      days: 'proj-days',
    };
    if (data.length > 0) {
      const p = data[0];
      Object.entries(map).forEach(([key, id]) => {
        const e = el(id);
        if (e) {
          // Dukung snake_case (standar DB) maupun legacy camelCase
          const val = p[key] !== undefined
            ? p[key]
            : (key === 'prod_cost' ? p.prodCost : key === 'dist_cost' ? p.distCost : key === 'ad_cost' ? p.adCost : key === 'units_day' ? p.unitsDay : undefined);
          e.value = val !== undefined ? val : defaults[key];
        }
      });
    } else {
      Object.entries(map).forEach(([key, id]) => {
        const e = el(id);
        if (e) e.value = defaults[key];
      });
    }
    calcProjection();
  };

  const saveProjection = async () => {
    const data = {
      equip: parseInt(el('proj-equip').value) || 0,
      material: parseInt(el('proj-material').value) || 0,
      promo: parseInt(el('proj-promo').value) || 0,
      prod_cost: parseInt(el('proj-prod-cost').value) || 0,
      dist_cost: parseInt(el('proj-dist-cost').value) || 0,
      ad_cost: parseInt(el('proj-ad-cost').value) || 0,
      units_day: parseInt(el('proj-units-day').value) || 0,
      price: parseInt(el('proj-price').value) || 0,
      days: parseInt(el('proj-days').value) || 0,
    };
    const existing = await DB.get('proyeksi');
    if (existing.length > 0) await DB.update('proyeksi', existing[0].id, data);
    else await DB.add('proyeksi', data);
    calcProjection();
    showToast('Proyeksi keuangan tersimpan!');
  };

  const calcProjection = () => {
    const g = (id) => parseInt(el(id).value) || 0;
    const equip = g('proj-equip');
    const material = g('proj-material');
    const promo = g('proj-promo');
    const prodCost = g('proj-prod-cost');
    const distCost = g('proj-dist-cost');
    const adCost = g('proj-ad-cost');
    const unitsDay = g('proj-units-day');
    const price = g('proj-price');
    const days = g('proj-days');

    const totalModal = equip + material + promo;
    const totalOpex = prodCost + distCost + adCost;
    const incDay = unitsDay * price;
    const incMonth = incDay * days;
    const incYear = incMonth * 12;
    const profit = incMonth - totalOpex;
    const profitYear = profit * 12;
    const costPerUnit = Math.round(price * 0.4);
    const margin = price - costPerUnit;
    const bep = margin > 0 ? Math.ceil(totalOpex / margin) : 0;

    setText('proj-total-modal', formatRupiah(totalModal));
    setText('proj-total-opex', formatRupiah(totalOpex));
    setText('proj-inc-day', formatRupiah(incDay));
    setText('proj-inc-month', formatRupiah(incMonth));
    setText('proj-inc-year', formatRupiah(incYear));
    setText('proj-income', formatRupiah(incMonth));
    setText('proj-expense', '- ' + formatRupiah(totalOpex));
    setText('proj-profit', formatRupiah(profit));
    setText('proj-profit-year', formatRupiah(profitYear));
    setText('be-opex', formatRupiah(totalOpex));
    setText('be-price', formatRupiah(price));
    setText('be-cost-unit', formatRupiah(costPerUnit));
    setText('be-margin', formatRupiah(margin));
    setText('be-result', bep.toLocaleString('id-ID'));

    const statusEl = el('be-status');
    if (statusEl) {
      if (unitsDay * days >= bep) {
        statusEl.className = 'mt-4 px-4 py-2 rounded-full text-sm font-semibold badge-green';
        statusEl.textContent = 'Di atas BEP = LABA';
      } else {
        statusEl.className = 'mt-4 px-4 py-2 rounded-full text-sm font-semibold badge-red';
        statusEl.textContent = 'Di bawah BEP = RUGI';
      }
    }
  };

  const downloadProyeksi = async () => {
    await saveProjection();
    const g = (id) => parseInt(el(id).value) || 0;
    const equip = g('proj-equip');
    const material = g('proj-material');
    const promo = g('proj-promo');
    const prodCost = g('proj-prod-cost');
    const distCost = g('proj-dist-cost');
    const adCost = g('proj-ad-cost');
    const unitsDay = g('proj-units-day');
    const price = g('proj-price');
    const days = g('proj-days');
    const totalModal = equip + material + promo;
    const totalOpex = prodCost + distCost + adCost;
    const incMonth = unitsDay * price * days;
    const profit = incMonth - totalOpex;
    const costPerUnit = Math.round(price * 0.4);
    const margin = price - costPerUnit;
    const bep = margin > 0 ? Math.ceil(totalOpex / margin) : 0;

    const rows = [
      ['PROYEKSI KEUANGAN STICTECH'],
      ['Tanggal', new Date().toLocaleDateString('id-ID')],
      [],
      ['ESTIMASI MODAL AWAL', ''],
      ['Kategori', 'Nominal (Rp)'],
      ['Peralatan', equip],
      ['Bahan Baku', material],
      ['Promosi', promo],
      ['Total Modal', totalModal],
      [],
      ['BIAYA OPERASIONAL BULANAN', ''],
      ['Kategori', 'Nominal (Rp)'],
      ['Produksi', prodCost],
      ['Distribusi', distCost],
      ['Iklan/Promosi', adCost],
      ['Total Operasional/Bulan', totalOpex],
      [],
      ['ESTIMASI PENDAPATAN', ''],
      ['Stiker Terjual/Hari', unitsDay],
      ['Harga Jual', price],
      ['Hari Kerja/Bulan', days],
      ['Pendapatan/Hari', unitsDay * price],
      ['Pendapatan/Bulan', incMonth],
      ['Pendapatan/Tahun', incMonth * 12],
      [],
      ['PROYEKSI LABA RUGI', ''],
      ['Pendapatan Bulanan', incMonth],
      ['(-) Biaya Operasional', totalOpex],
      ['Laba Bersih/Bulan', profit],
      ['Laba Bersih/Tahun', profit * 12],
      [],
      ['BREAK EVEN POINT', ''],
      ['Biaya Operasional/Bulan', totalOpex],
      ['Harga Jual/Unit', price],
      ['Biaya Bahan/Unit (est. 40%)', costPerUnit],
      ['Margin/Unit', margin],
      ['BEP (stiker/bulan)', bep],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Proyeksi Keuangan');
    XLSX.writeFile(wb, 'Proyeksi_Keuangan_SticTech_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    showToast('Proyeksi keuangan berhasil di-download!');
  };

  /* ---------- Expose global (untuk onclick HTML) ---------- */
  window.doLogin = doLogin;
  window.doLogout = doLogout;
  window.switchTab = switchTab;
  window.showDashboard = showDashboard;
  window.updateStats = updateStats;
  window.renderOrders = renderOrders;
  window.updateOrderStatus = updateOrderStatus;
  window.confirmDeleteOrder = confirmDeleteOrder;
  window.orderDetail = orderDetail;
  window.addTransaction = addTransaction;
  window.renderFinance = renderFinance;
  window.confirmDeleteTx = confirmDeleteTx;
  window.downloadExcel = downloadExcel;
  window.addProduct = addProduct;
  window.renderProducts = renderProducts;
  window.editProduct = editProduct;
  window.confirmDeleteProduct = confirmDeleteProduct;
  window.renderProcessSteps = renderProcessSteps;
  window.moveProcess = moveProcess;
  window.addProcessStep = addProcessStep;
  window.saveProcessSteps = saveProcessSteps;
  window.confirmDeleteProcessStep = confirmDeleteProcessStep;
  window.renderGaleriAdmin = renderGaleriAdmin;
  window.addGaleri = addGaleri;
  window.editGaleri = editGaleri;
  window.confirmDeleteGaleri = confirmDeleteGaleri;
  window.loadProjection = loadProjection;
  window.saveProjection = saveProjection;
  window.calcProjection = calcProjection;
  window.downloadProyeksi = downloadProyeksi;

  document.addEventListener('DOMContentLoaded', () => {
    el('login-form')?.addEventListener('submit', doLogin);
    el('logout-btn')?.addEventListener('click', doLogout);
    el('add-transaction')?.addEventListener('submit', addTransaction);
    el('add-product')?.addEventListener('submit', addProduct);
    el('add-galeri')?.addEventListener('submit', addGaleri);
    el('save-projection')?.addEventListener('click', saveProjection);
    el('proj-form')?.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', calcProjection);
    });
    updateAuthUI();
  });
})();
