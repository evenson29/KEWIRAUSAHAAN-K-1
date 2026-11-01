/* SticTech - Halaman Beranda (index.html) */
// Dependensi: js/config.js, js/app.js

(function () {
  'use strict';

  let productsCache = [];
  let productsLoaded = false;

  const productGrid = $('#product-grid');
  const orderSelect = $('#order-product');
  const orderTotal = $('#order-total');
  const orderForm = $('#order-form');
  const processGrid = $('#process-grid');

  const productImageHtml = (p) => {
    if (p.gambar_url) {
      return (
        '<img src="' + escapeAttr(p.gambar_url) + '" alt="' + escapeAttr(p.nama) +
        '" loading="lazy" decoding="async" width="260" height="260" ' +
        'style="width:100%;height:100%;object-fit:cover">'
      );
    }
    return (
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(0,0,0,0.3)">'
      + '<svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">'
      + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>'
      + '<path d="m21 15-5-5L5 21"/></svg>'
      + '<span class="text-xs mt-2">Gambar</span></div>'
    );
  };

  const renderProducts = async () => {
    if (!productGrid || !orderSelect) return;
    productsCache = await DB.get('produk');
    productsLoaded = true;
    productGrid.innerHTML = '';
    orderSelect.innerHTML = '<option value="">-- Pilih Stiker --</option>';

    if (productsCache.length === 0) {
      productGrid.innerHTML =
        '<div class="col-span-full text-center py-20 text-[#888888]">'
        + '<svg class="w-16 h-16 mx-auto mb-4 text-[#00ADB5]/40" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">'
        + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>'
        + '<path d="m21 15-5-5L5 21"/></svg>'
        + '<p class="text-lg">Belum ada produk</p>'
        + '<p class="text-sm mt-1">Produk akan ditambahkan oleh admin.</p>'
        + '</div>';
      return;
    }

    productsCache.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'product-card p-4 space-y-3 reveal w-full';
      card.style.animationDelay = idx * 0.1 + 's';
      card.innerHTML =
        '<div class="aspect-square rounded-xl flex items-center justify-center overflow-hidden" '
        + 'style="background:rgba(0,0,0,0.04);border:1px solid rgba(0,173,181,0.1)">'
        + productImageHtml(p) + '</div>'
        + '<div class="px-1"><h3 class="font-bold text-sm text-[#00838F]">' + escapeHtml(p.nama) + '</h3>'
        + '<p class="text-xs mt-1 text-muted">' + escapeHtml(p.deskripsi || '') + '</p></div>'
        + '<div class="flex items-center justify-between px-1 pt-1">'
        + '<p class="text-base font-extrabold text-[#2D2D2D]">' + formatRupiah(p.harga) + '</p>'
        + '<button type="button" class="btn-primary btn-sm text-xs py-1.5 px-3" '
        + 'onclick="scrollToOrder(\'' + escapeAttr(p.id) + '\')">Pesan</button>'
        + '</div>';
      productGrid.appendChild(card);
      orderSelect.innerHTML +=
        '<option value="' + escapeAttr(p.id) + '">' + escapeHtml(p.nama) +
        ' - ' + formatRupiah(p.harga) + '</option>';
    });
  };

  const renderProcessGrid = async () => {
    if (!processGrid) return;
    const steps = (await DB.get('proses_kerja')).sort((a, b) => a.urutan - b.urutan);
    processGrid.innerHTML = '';
    if (steps.length === 0) return;
    const cols = steps.length <= 2 ? 'grid-cols-1 sm:grid-cols-2'
      : steps.length <= 4 ? 'grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    processGrid.className = 'grid gap-6 ' + cols;

    const icons = [
      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
      'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L4.939 4.939m7.061 7.061l-2.879-2.879M12 12l2.879-2.879',
      'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    ];
    const bgColors = [
      'rgba(0,173,181,0.08)', 'rgba(0,173,181,0.06)', 'rgba(0,173,181,0.1)', 'rgba(0,173,181,0.05)',
    ];

    steps.forEach((s, i) => {
      const icon = icons[i % icons.length];
      const bg = bgColors[i % bgColors.length];
      const item = document.createElement('div');
      item.className = 'text-center space-y-4 reveal';
      item.style.cssText =
        'background:' + bg + ';backdrop-filter:blur(16px);border:1px solid rgba(0,0,0,0.08);'
        + 'border-radius:1rem;padding:1.75rem;transition:all 0.35s cubic-bezier(0.4,0,0.2,1);';
      item.innerHTML =
        '<div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" '
        + 'style="background:linear-gradient(135deg,rgba(0,173,181,0.15),rgba(0,173,181,0.1));'
        + 'border:1px solid rgba(0,0,0,0.08);">'
        + '<svg class="w-8 h-8 text-[#2D2D2D]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' + icon + '</svg>'
        + '</div>'
        + '<div class="aspect-video rounded-xl overflow-hidden" style="background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.06);">'
        + (s.gambar
          ? '<img src="' + escapeAttr(s.gambar) + '" alt="' + escapeHtml(s.judul) + '" loading="lazy" decoding="async" '
          + 'class="w-full h-full object-cover">'
          : '<div class="flex flex-col items-center justify-center w-full h-full" style="color:rgba(0,0,0,0.2)">'
          + '<svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">'
          + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>'
          + '<path d="m21 15-5-5L5 21"/></svg></div>')
        + '</div>'
        + '<div>'
        + '<span class="text-xs mb-2 inline-block px-3 py-1 rounded-full font-semibold" '
        + 'style="background:rgba(0,173,181,0.12);color:#00838F;border:1px solid rgba(0,173,181,0.2);">Langkah ' + s.urutan + '</span>'
        + '<h3 class="font-bold text-[#2D2D2D] text-lg">' + escapeHtml(s.judul) + '</h3>'
        + '<p class="text-sm mt-1" style="color:rgba(0,0,0,0.6)">' + escapeHtml(s.deskripsi || '') + '</p>'
        + '</div>';
      processGrid.appendChild(item);
    });
  };

  const updateOrderPrice = async () => {
    if (!orderSelect || !orderTotal) return;
    const productId = orderSelect.value;
    const qtyInput = $('#order-qty');
    const qty = parseInt(qtyInput ? qtyInput.value : 1) || 0;
    let total = 0;
    let product = null;
    if (productsLoaded) {
      product = productsCache.find((p) => p.id === productId);
    }
    if (!product && productId) {
      product = await DB.getById('produk', productId);
    }
    if (product) total = product.harga * qty;
    orderTotal.textContent = formatRupiah(total);
    return product;
  };

  const scrollToOrder = async (productId) => {
    const sel = $('#order-product');
    if (sel) sel.value = productId;
    await updateOrderPrice();
    const section = $('#pesan');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  };

  const processOrderData = async () => {
    const name = $('#order-name').value.trim();
    const wa = $('#order-wa').value.trim();
    const productId = $('#order-product').value;
    const qtyValue = parseInt($('#order-qty').value) || 0;
    const payment = $('#order-payment').value;
    let notes = $('#order-notes').value.trim();
    const designFileInput = $('#order-design');

    if (!name || !wa || !productId || qtyValue <= 0) {
      showToast('Lengkapi nama, WhatsApp, produk, dan jumlah!', 'error');
      return null;
    }

    let product = productsCache.find((p) => p.id === productId);
    if (!product) {
      product = await DB.getById('produk', productId);
    }

    if (!product) {
      showToast('Produk tidak ditemukan.', 'error');
      return null;
    }

    // Process design image if uploaded
    if (designFileInput && designFileInput.files && designFileInput.files[0]) {
      try {
        const compressed = await compressImage(designFileInput.files[0], { maxWidth: 1000, quality: 0.85 });
        if (compressed) {
          notes += (notes ? '\n' : '') + '[Lampiran Gambar Desain Ada]';
        }
      } catch (err) {
        console.warn('Gagal memproses gambar desain:', err);
      }
    }

    return {
      nama_pemesan: name,
      whatsapp: wa,
      produk_id: product.id,
      produk_nama: product.nama,
      jumlah: qtyValue,
      harga_satuan: product.harga,
      total_harga: product.harga * qtyValue,
      metode_bayar: payment,
      catatan: notes,
      status: 'diterima',
    };
  };

  const bindOrderForm = () => {
    if (!orderForm) return;

    const sel = $('#order-product');
    const qty = $('#order-qty');
    const waBtn = $('#btn-order-wa');

    if (sel) sel.addEventListener('change', updateOrderPrice);
    if (qty) {
      qty.addEventListener('change', updateOrderPrice);
      qty.addEventListener('input', updateOrderPrice);
    }
    if (waBtn) {
      waBtn.addEventListener('click', orderViaWhatsApp);
    }

    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = orderForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }

      const order = await processOrderData();
      if (!order) {
        if (btn) { btn.disabled = false; btn.textContent = 'Pesan via Website'; }
        return;
      }

      try {
        await DB.add('pesanan', order);
        orderForm.reset();
        if (orderTotal) orderTotal.textContent = 'Rp 0';
        showToast('Pesanan berhasil dikirim! Mengarahkan ke WhatsApp...');

        const waMsg = 'Halo SticTech! Saya sudah memesan melalui website.\n\n'
          + 'Nama: ' + order.nama_pemesan + '\n'
          + 'Produk: ' + order.produk_nama + '\n'
          + 'Jumlah: ' + order.jumlah + ' pcs\n'
          + 'Total: ' + formatRupiah(order.total_harga) + '\n'
          + 'Pembayaran: ' + (PAYMENT_LABEL[order.metode_bayar] || order.metode_bayar) + '\n'
          + (order.catatan ? 'Catatan: ' + order.catatan + '\n' : '')
          + '\nTerima kasih!';

        setTimeout(() => {
          location.href = generateWhatsAppLink(SITE_CONFIG.whatsapp, waMsg);
        }, 1000);
      } catch (err) {
        showToast(err.message || 'Gagal mengirim pesanan.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Pesan via Website'; }
      }
    });
  };

  const orderViaWhatsApp = async () => {
    const order = await processOrderData();
    if (!order) return;

    try {
      await DB.add('pesanan', order);
      orderForm.reset();
      if (orderTotal) orderTotal.textContent = 'Rp 0';
      showToast('Mengarahkan ke WhatsApp...');

      let msg = 'Halo SticTech! Saya ingin memesan stiker.\n\n';
      msg += 'Nama: ' + order.nama_pemesan + '\n';
      msg += 'Produk: ' + order.produk_nama + '\n';
      msg += 'Jumlah: ' + order.jumlah + ' pcs\n';
      msg += 'Total: ' + formatRupiah(order.total_harga) + '\n';
      msg += 'Pembayaran: ' + (PAYMENT_LABEL[order.metode_bayar] || order.metode_bayar) + '\n';
      if (order.catatan) msg += 'Catatan: ' + order.catatan + '\n';
      msg += '\nKirim file desain (jika ada) ke chat ini. Terima kasih!';

      location.href = generateWhatsAppLink(SITE_CONFIG.whatsapp, msg);
    } catch (err) {
      showToast(err.message || 'Gagal memproses pesanan.', 'error');
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await renderProducts();
    await renderProcessGrid();
    bindOrderForm();
    window.scrollToOrder = scrollToOrder;
    window.orderViaWhatsApp = orderViaWhatsApp;
    window.updateOrderPrice = updateOrderPrice;
  });
})();
