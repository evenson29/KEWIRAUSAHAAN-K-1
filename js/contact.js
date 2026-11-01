/* SticTech - Halaman Kontak (kontak.html) */
// Dependensi: js/config.js, js/app.js

(function () {
  'use strict';

  const form = $('#contact-form');

  document.addEventListener('DOMContentLoaded', () => {
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#contact-name').value.trim();
      const phone = $('#contact-phone').value.trim();
      const subject = $('#contact-subject').value;
      const message = $('#contact-message').value.trim();

      if (!name || !subject || !message) {
        showToast('Lengkapi data terlebih dahulu!', 'error');
        return;
      }

      let msg = 'Halo SticTech!\n\n';
      msg += 'Nama: ' + name + '\n';
      if (phone) msg += 'No. HP: ' + phone + '\n';
      msg += 'Subjek: ' + subject + '\n';
      msg += 'Pesan: ' + message + '\n';
      msg += '\nTerima kasih!';

      location.href = generateWhatsAppLink(SITE_CONFIG.whatsapp, msg);
      showToast('Mengarahkan ke WhatsApp...');
      form.reset();
    });
  });
})();
