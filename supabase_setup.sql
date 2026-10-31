-- SticTech Supabase Setup (Final - Aman & Produksi)
-- Jalankan di SQL Editor Supabase (https://app.supabase.com). File ini idempoten.
-- Catatan: anon key sengaja publik; data dilindungi oleh RLS (Row Level Security).

-- ============================================================
-- 1. MIGRASI AMAN UNTUK DATABASE LAMA (jika sudah ada)
-- ============================================================

-- Tabel admin_creds dihapus (login sekarang pakai Supabase Auth, tidak ada password plaintext di DB)
drop table if exists public.admin_creds;

-- Rename kolom proyeksi dari camelCase lama (prodcost/unitsday/adcost) ke snake_case
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='proyeksi' and column_name='prodcost') then
    execute 'alter table proyeksi rename column prodcost to prod_cost';
  end if;
  if exists (select 1 from information_schema.columns where table_name='proyeksi' and column_name='unitsday') then
    execute 'alter table proyeksi rename column unitsday to units_day';
  end if;
  if exists (select 1 from information_schema.columns where table_name='proyeksi' and column_name='adcost') then
    execute 'alter table proyeksi rename column adcost to ad_cost';
  end if;
end $$;

-- Tambah updated_at pada tabel yang belum punya
do $$
declare r record;
begin
  for r in
    select table_name
    from information_schema.tables
    where table_schema='public'
      and table_name in ('produk','pesanan','proses_kerja','transaksi','galeri','proyeksi')
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name=r.table_name and column_name='updated_at'
    ) then
      execute format('alter table %i add column updated_at timestamptz default now()', r.table_name);
    end if;
  end loop;
end $$;

-- ============================================================
-- 2. SKEMA AKHIR
-- ============================================================

-- 1. Tabel PRODUK
create table if not exists produk (
  id text primary key,
  nama text not null,
  deskripsi text,
  harga int not null check (harga >= 0),
  gambar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Tabel PESANAN
create table if not exists pesanan (
  id text primary key,
  nama_pemesan text not null,
  whatsapp text,
  produk_id text,
  produk_nama text,
  jumlah int not null check (jumlah > 0),
  harga_satuan int not null check (harga_satuan >= 0),
  total_harga int not null check (total_harga >= 0),
  metode_bayar text not null check (metode_bayar in ('bayar_di_tempat','transfer')),
  catatan text,
  status text not null check (status in ('diterima','dicetak','selesai','diambil')) default 'diterima',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Tabel PROSES_KERJA
create table if not exists proses_kerja (
  id text primary key,
  urutan int not null,
  judul text not null,
  deskripsi text,
  gambar text,
  warna text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Tabel TRANSAKSI (Keuangan)
create table if not exists transaksi (
  id text primary key,
  keterangan text,
  jenis text not null check (jenis in ('pemasukan','pengeluaran')),
  nominal int not null check (nominal >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Tabel GALERI
create table if not exists galeri (
  id text primary key,
  src text not null,
  judul text not null,
  kategori text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Tabel PROYEKSI (snake_case)
create table if not exists proyeksi (
  id text primary key,
  equip int,
  material int,
  promo int,
  prod_cost int,
  dist_cost int,
  ad_cost int,
  units_day int,
  price int,
  days int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table produk enable row level security;
alter table pesanan enable row level security;
alter table proses_kerja enable row level security;
alter table transaksi enable row level security;
alter table galeri enable row level security;
alter table proyeksi enable row level security;

-- Publik: baca katalog/proses/galeri
drop policy if exists public_read_produk on produk;
create policy public_read_produk on produk for select to anon using (true);

drop policy if exists public_read_proses on proses_kerja;
create policy public_read_proses on proses_kerja for select to anon using (true);

drop policy if exists public_read_galeri on galeri;
create policy public_read_galeri on galeri for select to anon using (true);

-- Publik: tambah pesanan saja (hanya status diterima, produk harus ada)
drop policy if exists anon_insert_pesanan on pesanan;
create policy anon_insert_pesanan on pesanan
  for insert to anon
  with check (
    status = 'diterima'
    and jumlah > 0
    and harga_satuan >= 0
    and total_harga >= 0
    and exists (select 1 from produk p where p.id = pesanan.produk_id)
  );

-- Admin (authenticated): CRUD penuh semua tabel
drop policy if exists admin_all_produk on produk;
create policy admin_all_produk on produk for all to authenticated using (true) with check (true);

drop policy if exists admin_all_pesanan on pesanan;
create policy admin_all_pesanan on pesanan for all to authenticated using (true) with check (true);

drop policy if exists admin_all_proses on proses_kerja;
create policy admin_all_proses on proses_kerja for all to authenticated using (true) with check (true);

drop policy if exists admin_all_transaksi on transaksi;
create policy admin_all_transaksi on transaksi for all to authenticated using (true) with check (true);

drop policy if exists admin_all_galeri on galeri;
create policy admin_all_galeri on galeri for all to authenticated using (true) with check (true);

drop policy if exists admin_all_proyeksi on proyeksi;
create policy admin_all_proyeksi on proyeksi for all to authenticated using (true) with check (true);

-- ============================================================
-- 4. TRIGGER updated_at + isi otomatis pesanan
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare r record;
begin
  for r in
    select table_name
    from information_schema.tables
    where table_schema='public'
      and table_name in ('produk','pesanan','proses_kerja','transaksi','galeri','proyeksi')
  loop
    execute format($$
      drop trigger if exists set_updated_at_%1$i on %1$i;
      create trigger set_updated_at_%1$i
        before update on %1$i
        for each row
        execute function set_updated_at();
    $$, r.table_name);
  end loop;
end $$;

-- Saat pesanan baru dimasukkan (anon), isi harga_satuan/produk_nama/total_harga dari produk
create or replace function fill_order()
returns trigger
language plpgsql
as $$
declare p record;
begin
  select * into p from produk where id = new.produk_id limit 1;
  if not found then
    raise exception 'Produk tidak ditemukan: %', new.produk_id;
  end if;
  new.harga_satuan := p.harga;
  new.produk_nama := p.nama;
  new.total_harga := p.harga * new.jumlah;
  new.status := 'diterima';
  return new;
end;
$$;

drop trigger if exists fill_order_trigger on pesanan;
create trigger fill_order_trigger
  before insert on pesanan
  for each row
  execute function fill_order();

-- ============================================================
-- 5. INDEX
-- ============================================================

create index if not exists idx_pesanan_status on pesanan(status);
create index if not exists idx_pesanan_created_at on pesanan(created_at desc);
create index if not exists idx_pesanan_produk on pesanan(produk_id);
create index if not exists idx_transaksi_created_at on transaksi(created_at desc);
create index if not exists idx_galeri_created_at on galeri(created_at desc);
create index if not exists idx_proses_urutan on proses_kerja(urutan);

-- ============================================================
-- 6. SEED DATA (idempoten, tidak duplikasi)
-- ============================================================

insert into produk (id, nama, deskripsi, harga, gambar_url, created_at, updated_at) values
  ('seed-produk-1', 'Stiker Vinyl Custom', 'Stiker vinyl anti air untuk laptop, motor, atau barang pribadi', 1000, 'assets/stiker1.jpeg', now(), now()),
  ('seed-produk-2', 'Stiker Logo Kustom', 'Stiker vinyl dengan logo sesuai desain Anda', 1500, 'assets/stiker2.jpeg', now(), now()),
  ('seed-produk-3', 'Stiker Karakter', 'Stiker vinyl karakter lucu untuk pelengkap gaya', 1200, 'assets/stiker3.jpeg', now(), now()),
  ('seed-produk-4', 'Stiker Brand UMKM', 'Stiker vinyl branding untuk usaha mikro kecil', 1300, 'assets/stiker4.jpeg', now(), now())
on conflict (id) do update set
  nama = excluded.nama,
  deskripsi = excluded.deskripsi,
  harga = excluded.harga,
  gambar_url = excluded.gambar_url,
  updated_at = now();

insert into proses_kerja (id, urutan, judul, deskripsi, gambar, warna, created_at, updated_at) values
  ('seed-proses-1', 1, 'Desain', 'Desain stiker dibuat sesuai permintaan pelanggan', '', 'blue', now(), now()),
  ('seed-proses-2', 2, 'Cetak', 'Dicetak menggunakan mesin berkualitas pada bahan vinyl', '', 'indigo', now(), now()),
  ('seed-proses-3', 3, 'Potong & Finishing', 'Dipotong rapi dan diberikan finishing agar tahan lama', '', 'purple', now(), now()),
  ('seed-proses-4', 4, 'Siap Kirim', 'Stiker dikemas rapi dan siap diambil atau dikirim', '', 'amber', now(), now())
on conflict (id) do update set
  urutan = excluded.urutan,
  judul = excluded.judul,
  deskripsi = excluded.deskripsi,
  warna = excluded.warna,
  updated_at = now();

insert into galeri (id, src, judul, kategori, created_at, updated_at) values
  ('seed-galeri-1', 'assets/stiker1.jpeg', 'Stiker Logo Toko', 'logo', now(), now()),
  ('seed-galeri-2', 'assets/stiker2.jpeg', 'Stiker Karakter Lucu', 'karakter', now(), now()),
  ('seed-galeri-3', 'assets/stiker3.jpeg', 'Stiker Nama Custom', 'text', now(), now()),
  ('seed-galeri-4', 'assets/stiker4.jpeg', 'Stiker Brand UMKM', 'custom', now(), now())
on conflict (id) do update set
  src = excluded.src,
  judul = excluded.judul,
  kategori = excluded.kategori,
  updated_at = now();

insert into proyeksi (id, equip, material, promo, prod_cost, dist_cost, ad_cost, units_day, price, days, created_at, updated_at) values
  ('seed-proyeksi-1', 5000000, 1000000, 500000, 500000, 200000, 300000, 50, 1000, 25, now(), now())
on conflict (id) do update set
  equip = excluded.equip,
  material = excluded.material,
  promo = excluded.promo,
  prod_cost = excluded.prod_cost,
  dist_cost = excluded.dist_cost,
  ad_cost = excluded.ad_cost,
  units_day = excluded.units_day,
  price = excluded.price,
  days = excluded.days,
  updated_at = now();

-- Selesai. Langkah berikutnya:
-- 1. Buat 1 user admin di Authentication -> Users (email + password, auto-confirm).
-- 2. Matikan "Enable email signups" di Authentication -> Settings.
-- 3. Login di /admin.html dengan email admin tersebut.
