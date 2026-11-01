// SticTech - Konfigurasi pusat
// Ganti SITE_URL dengan domain InfinityFree Anda (untuk canonical/sitemap/OG).
const SITE_CONFIG = {
  name: 'SticTech.',
  tagline: 'Stiker Vinyl Anti Air Premium',
  whatsapp: '6281237057696',
  whatsappLink: 'https://wa.me/6281237057696',
  instagram: 'https://instagram.com/sticktech.meisyaprinting',
  instagramHandle: '@sticktech.meisyaprinting',
  address: 'Depan Kampus FAPERTA Unimor',
  city: 'Kabupaten Timor Tengah Utara, NTT',
  hours: 'Senin - Sabtu: 08.00 - 17.00 WITA',
  mapEmbed: 'https://www.google.com/maps?q=Universitas%20Timor%20Kefamenanu&z=16&output=embed',
  year: new Date().getFullYear(),
  siteUrl: 'https://DOMAIN-ANDA.infinityfreeapp.com', // ganti dengan domain asli
};

const SUPABASE_CONFIG = {
  url: 'https://qghprfbdnlgxckjsbgvf.supabase.co',
  anonKey: 'sb_publishable_0-Ex062jRWQ40E52zRAThg_GnP--1vW',
};

const STATUS_ORDER = ['diterima', 'dicetak', 'selesai', 'diambil'];
const NEXT_STATUS = { diterima: 'dicetak', dicetak: 'selesai', selesai: 'diambil' };
const STATUS_LABEL = {
  diterima: 'Diterima',
  dicetak: 'Dicetak',
  selesai: 'Selesai',
  diambil: 'Diambil',
};
const PAYMENT_LABEL = {
  bayar_di_tempat: 'Bayar di Tempat (COD)',
  transfer: 'Transfer Bank / QRIS',
};
const DEFAULT_COLORS = ['teal', 'amber', 'green', 'yellow', 'red']; // palet resmi; warna lama (blue/indigo/purple/pink) tetap terbaca lewat badgeFor

window.SITE_CONFIG = SITE_CONFIG;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.STATUS_ORDER = STATUS_ORDER;
window.NEXT_STATUS = NEXT_STATUS;
window.STATUS_LABEL = STATUS_LABEL;
window.PAYMENT_LABEL = PAYMENT_LABEL;
window.DEFAULT_COLORS = DEFAULT_COLORS;
