<?php
/**
 * SticTech - Backend API (PHP + SQLite)
 * ------------------------------------------------------------------
 * Menggantikan Supabase. Satu file ini melayani:
 *  - CRUD 6 tabel: produk, pesanan, proses_kerja, transaksi, galeri, proyeksi
 *  - Login admin berbasis sesi PHP (tabel users, password ter-hash)
 *  - Setup akun admin pertama (hanya saat tabel users masih kosong)
 *
 * Database SQLite dibuat otomatis di data/stictech.sqlite saat pertama
 * kali API dipanggil, lengkap dengan skema + data awal (seed).
 * Folder data/ dilindungi .htaccess agar file database tidak bisa
 * diunduh langsung dari browser.
 *
 * Aturan akses (meniru RLS Supabase sebelumnya):
 *  - Publik boleh MEMBACA: produk, proses_kerja, galeri
 *  - Publik boleh MEMBUAT pesanan (harga & total diisi ulang di server
 *    dari tabel produk, status dipaksa 'diterima')
 *  - Semua operasi lain wajib login admin
 */

declare(strict_types=1);

/* ---------------- Konfigurasi ---------------- */

const DB_DIR  = __DIR__ . '/data';
const DB_FILE = DB_DIR . '/stictech.sqlite';

const TABLES = [
    'produk'       => ['id', 'nama', 'deskripsi', 'harga', 'gambar_url', 'created_at', 'updated_at'],
    'pesanan'      => ['id', 'nama_pemesan', 'whatsapp', 'produk_id', 'produk_nama', 'jumlah', 'harga_satuan', 'total_harga', 'metode_bayar', 'catatan', 'status', 'created_at', 'updated_at'],
    'proses_kerja' => ['id', 'urutan', 'judul', 'deskripsi', 'gambar', 'warna', 'created_at', 'updated_at'],
    'transaksi'    => ['id', 'keterangan', 'jenis', 'nominal', 'created_at', 'updated_at'],
    'galeri'       => ['id', 'src', 'judul', 'kategori', 'created_at', 'updated_at'],
    'proyeksi'     => ['id', 'equip', 'material', 'promo', 'prod_cost', 'dist_cost', 'ad_cost', 'units_day', 'price', 'days', 'created_at', 'updated_at'],
];

const PUBLIC_READ = ['produk', 'proses_kerja', 'galeri'];

const INT_COLS = ['harga', 'jumlah', 'harga_satuan', 'total_harga', 'urutan', 'nominal',
    'equip', 'material', 'promo', 'prod_cost', 'dist_cost', 'ad_cost', 'units_day', 'price', 'days'];

const ORDER_STATUSES = ['diterima', 'dicetak', 'selesai', 'diambil'];
const PAYMENT_METHODS = ['bayar_di_tempat', 'transfer'];

/* ---------------- Sesi ---------------- */

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => $isHttps,
]);
session_start();

/* ---------------- Utilitas ---------------- */

function out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function fail(string $message, int $code = 400): void
{
    out(['error' => $message], $code);
}

function bodyJson(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function isAdmin(): bool
{
    return !empty($_SESSION['uid']);
}

function requireAdmin(): void
{
    if (!isAdmin()) fail('Wajib login admin.', 401);
}

/** Samakan format timestamp klien (ISO) ke format SQLite 'Y-m-d H:i:s' (UTC). */
function normTimestamp($value)
{
    if (!is_string($value) || trim($value) === '') return $value;
    $ts = strtotime($value);
    return $ts === false ? $value : gmdate('Y-m-d H:i:s', $ts);
}

/* ---------------- Koneksi + skema ---------------- */

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    if (!is_dir(DB_DIR)) {
        mkdir(DB_DIR, 0775, true);
    }
    // Perlindungan cadangan bila file .htaccess di folder data terhapus
    $guard = DB_DIR . '/.htaccess';
    if (!file_exists($guard)) {
        file_put_contents($guard, "Require all denied\nDeny from all\n");
    }

    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA foreign_keys = ON');

    initSchema($pdo);
    return $pdo;
}

function initSchema(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS produk (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  deskripsi TEXT,
  harga INTEGER NOT NULL CHECK (harga >= 0),
  gambar_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pesanan (
  id TEXT PRIMARY KEY,
  nama_pemesan TEXT NOT NULL,
  whatsapp TEXT,
  produk_id TEXT,
  produk_nama TEXT,
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  harga_satuan INTEGER NOT NULL CHECK (harga_satuan >= 0),
  total_harga INTEGER NOT NULL CHECK (total_harga >= 0),
  metode_bayar TEXT NOT NULL CHECK (metode_bayar IN ('bayar_di_tempat','transfer')),
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'diterima' CHECK (status IN ('diterima','dicetak','selesai','diambil')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS proses_kerja (
  id TEXT PRIMARY KEY,
  urutan INTEGER NOT NULL,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  gambar TEXT,
  warna TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS transaksi (
  id TEXT PRIMARY KEY,
  keterangan TEXT,
  jenis TEXT NOT NULL CHECK (jenis IN ('pemasukan','pengeluaran')),
  nominal INTEGER NOT NULL CHECK (nominal >= 0),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS galeri (
  id TEXT PRIMARY KEY,
  src TEXT NOT NULL,
  judul TEXT NOT NULL,
  kategori TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS proyeksi (
  id TEXT PRIMARY KEY,
  equip INTEGER, material INTEGER, promo INTEGER,
  prod_cost INTEGER, dist_cost INTEGER, ad_cost INTEGER,
  units_day INTEGER, price INTEGER, days INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pesanan_status ON pesanan(status);
CREATE INDEX IF NOT EXISTS idx_proses_urutan ON proses_kerja(urutan);
SQL);

    seed($pdo);
}

function seed(PDO $pdo): void
{
    $produk = $pdo->prepare('INSERT OR IGNORE INTO produk (id, nama, deskripsi, harga, gambar_url) VALUES (?, ?, ?, ?, ?)');
    foreach ([
        ['seed-produk-1', 'Stiker Vinyl Custom', 'Stiker vinyl anti air untuk laptop, motor, atau barang pribadi', 1000, 'assets/stiker1.jpeg'],
        ['seed-produk-2', 'Stiker Logo Kustom', 'Stiker vinyl dengan logo sesuai desain Anda', 1500, 'assets/stiker2.jpeg'],
        ['seed-produk-3', 'Stiker Karakter', 'Stiker vinyl karakter lucu untuk pelengkap gaya', 1200, 'assets/stiker3.jpeg'],
        ['seed-produk-4', 'Stiker Brand UMKM', 'Stiker vinyl branding untuk usaha mikro kecil', 1300, 'assets/stiker4.jpeg'],
    ] as $row) $produk->execute($row);

    $proses = $pdo->prepare('INSERT OR IGNORE INTO proses_kerja (id, urutan, judul, deskripsi, gambar, warna) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ([
        ['seed-proses-1', 1, 'Desain', 'Desain stiker dibuat sesuai permintaan pelanggan', '', 'teal'],
        ['seed-proses-2', 2, 'Cetak', 'Dicetak menggunakan mesin berkualitas pada bahan vinyl', '', 'amber'],
        ['seed-proses-3', 3, 'Potong & Finishing', 'Dipotong rapi dan diberikan finishing agar tahan lama', '', 'green'],
        ['seed-proses-4', 4, 'Siap Kirim', 'Stiker dikemas rapi dan siap diambil atau dikirim', '', 'yellow'],
    ] as $row) $proses->execute($row);

    $galeri = $pdo->prepare('INSERT OR IGNORE INTO galeri (id, src, judul, kategori) VALUES (?, ?, ?, ?)');
    foreach ([
        ['seed-galeri-1', 'assets/stiker1.jpeg', 'Stiker Logo Toko', 'logo'],
        ['seed-galeri-2', 'assets/stiker2.jpeg', 'Stiker Karakter Lucu', 'karakter'],
        ['seed-galeri-3', 'assets/stiker3.jpeg', 'Stiker Nama Custom', 'text'],
        ['seed-galeri-4', 'assets/stiker4.jpeg', 'Stiker Brand UMKM', 'custom'],
    ] as $row) $galeri->execute($row);

    $pdo->prepare('INSERT OR IGNORE INTO proyeksi (id, equip, material, promo, prod_cost, dist_cost, ad_cost, units_day, price, days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute(['seed-proyeksi-1', 5000000, 1000000, 500000, 500000, 200000, 300000, 50, 1000, 25]);
}

/* ---------------- Aksi auth ---------------- */

$action = $_GET['action'] ?? null;

try {
    if ($action === 'ping') {
        out(['ok' => true, 'mode' => 'api']);
    }

    if ($action === 'session') {
        $count = (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
        out([
            'user'       => isAdmin() ? ['email' => $_SESSION['email'] ?? ''] : null,
            'needsSetup' => $count === 0,
        ]);
    }

    if ($action === 'setup') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Metode tidak diizinkan.', 405);
        $pdo = db();
        $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if ($count > 0) fail('Akun admin sudah ada. Silakan login.', 403);

        $in = bodyJson();
        $email = strtolower(trim((string) ($in['email'] ?? '')));
        $password = (string) ($in['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Format email tidak valid.');
        if (strlen($password) < 8) fail('Password minimal 8 karakter.');

        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
        $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT)]);

        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $pdo->lastInsertId();
        $_SESSION['email'] = $email;
        out(['user' => ['email' => $email]]);
    }

    if ($action === 'login') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Metode tidak diizinkan.', 405);
        $in = bodyJson();
        $email = strtolower(trim((string) ($in['email'] ?? '')));
        $password = (string) ($in['password'] ?? '');

        $stmt = db()->prepare('SELECT id, email, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            fail('Email atau password salah.', 401);
        }

        session_regenerate_id(true);
        $_SESSION['uid'] = (int) $user['id'];
        $_SESSION['email'] = $user['email'];
        out(['user' => ['email' => $user['email']]]);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', (bool) $p['secure'], (bool) $p['httponly']);
        }
        session_destroy();
        out(['ok' => true]);
    }

    /* ---------------- CRUD tabel ---------------- */

    $table = $_GET['table'] ?? null;
    if ($table === null) fail('Parameter action/table tidak dikenal.', 404);
    if (!isset(TABLES[$table])) fail('Tabel tidak dikenal.', 404);

    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];
    $op = $_GET['op'] ?? null;
    $cols = TABLES[$table];

    if ($method === 'GET') {
        if (!in_array($table, PUBLIC_READ, true)) requireAdmin();
        $rows = $pdo->query("SELECT * FROM \"$table\" ORDER BY created_at ASC")->fetchAll();
        out($rows);
    }

    if ($method === 'POST' && $op === null) {
        // INSERT
        $in = bodyJson();

        if ($table === 'pesanan' && !isAdmin()) {
            // Jalur publik: harga diisi ulang dari tabel produk (pengganti trigger fill_order)
            $produkId = (string) ($in['produk_id'] ?? '');
            $stmt = $pdo->prepare('SELECT id, nama, harga FROM produk WHERE id = ?');
            $stmt->execute([$produkId]);
            $produk = $stmt->fetch();
            if (!$produk) fail('Produk tidak ditemukan.', 422);

            $jumlah = (int) ($in['jumlah'] ?? 0);
            if ($jumlah < 1) fail('Jumlah minimal 1.', 422);
            $metode = (string) ($in['metode_bayar'] ?? '');
            if (!in_array($metode, PAYMENT_METHODS, true)) fail('Metode bayar tidak valid.', 422);
            if (trim((string) ($in['nama_pemesan'] ?? '')) === '') fail('Nama pemesan wajib diisi.', 422);

            $in['produk_nama']  = $produk['nama'];
            $in['harga_satuan'] = (int) $produk['harga'];
            $in['total_harga']  = (int) $produk['harga'] * $jumlah;
            $in['jumlah']       = $jumlah;
            $in['status']       = 'diterima';
        } else {
            requireAdmin();
            if ($table === 'pesanan') {
                $status = (string) ($in['status'] ?? 'diterima');
                if (!in_array($status, ORDER_STATUSES, true)) fail('Status tidak valid.', 422);
            }
            if ($table === 'transaksi') {
                $jenis = (string) ($in['jenis'] ?? '');
                if (!in_array($jenis, ['pemasukan', 'pengeluaran'], true)) fail('Jenis transaksi tidak valid.', 422);
            }
        }

        $data = [];
        foreach ($cols as $c) {
            if ($c === 'updated_at') continue;
            if (array_key_exists($c, $in)) {
                $v = $in[$c];
                if (in_array($c, INT_COLS, true)) $v = (int) $v;
                if ($c === 'created_at') $v = normTimestamp($v);
                $data[$c] = $v;
            }
        }
        if (empty($data['id'])) {
            $data = ['id' => 'id-' . bin2hex(random_bytes(8))] + $data;
        }

        $names = array_keys($data);
        $sql = "INSERT INTO \"$table\" (" . implode(', ', $names) . ') VALUES (' . implode(', ', array_fill(0, count($names), '?')) . ')';
        $pdo->prepare($sql)->execute(array_values($data));

        $stmt = $pdo->prepare("SELECT * FROM \"$table\" WHERE id = ?");
        $stmt->execute([$data['id']]);
        out($stmt->fetch() ?: $data, 201);
    }

    if ($method === 'POST' && $op === 'update') {
        requireAdmin();
        $id = (string) ($_GET['id'] ?? '');
        if ($id === '') fail('Parameter id wajib ada.');

        $in = bodyJson();
        if ($table === 'pesanan' && isset($in['status']) && !in_array((string) $in['status'], ORDER_STATUSES, true)) {
            fail('Status tidak valid.', 422);
        }

        $sets = [];
        $vals = [];
        foreach ($cols as $c) {
            if ($c === 'id' || $c === 'created_at' || $c === 'updated_at') continue;
            if (array_key_exists($c, $in)) {
                $v = $in[$c];
                if (in_array($c, INT_COLS, true)) $v = (int) $v;
                $sets[] = "$c = ?";
                $vals[] = $v;
            }
        }
        if (!$sets) fail('Tidak ada kolom yang diperbarui.');
        $sets[] = "updated_at = datetime('now')";
        $vals[] = $id;

        $pdo->prepare("UPDATE \"$table\" SET " . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);

        $stmt = $pdo->prepare("SELECT * FROM \"$table\" WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) fail('Data tidak ditemukan.', 404);
        out($row);
    }

    if ($method === 'POST' && $op === 'delete') {
        requireAdmin();
        $id = (string) ($_GET['id'] ?? '');
        if ($id === '') fail('Parameter id wajib ada.');
        $pdo->prepare("DELETE FROM \"$table\" WHERE id = ?")->execute([$id]);
        out(['ok' => true]);
    }

    fail('Permintaan tidak dikenal.', 404);
} catch (PDOException $e) {
    fail('Kesalahan database: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    fail('Kesalahan server: ' . $e->getMessage(), 500);
}
