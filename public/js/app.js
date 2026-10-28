(function () {
  const CATEGORIES = [
    { id: 'Elektronik', icon: '💻', name: 'Elektronik' },
    { id: 'Tas & Dompet', icon: '👜', name: 'Tas & Dompet' },
    { id: 'Kunci', icon: '🔑', name: 'Kunci' },
    { id: 'Dokumen', icon: '🪪', name: 'Dokumen' },
    { id: 'Aksesori', icon: '⌚', name: 'Aksesori' },
    { id: 'Lainnya', icon: '📦', name: 'Lainnya' }
  ];

  const CITIES = [
    'Jakarta Selatan', 'Jakarta Pusat', 'Bandung', 'Surabaya',
    'Yogyakarta', 'Semarang', 'Malang', 'Depok', 'Tangerang', 'Medan'
  ];

  function escapeHTML(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-body').innerHTML = html;
    overlay.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  // Deteksi jika pengguna tak sengaja menulis No HP / NIK di deskripsi publik
  function containsSensitivePII(text) {
    const phoneRegex = /(\+62|62|0)8[1-9][0-9]{7,10}/;
    const nikRegex = /\b\d{16}\b/;
    return phoneRegex.test(text) || nikRegex.test(text);
  }

  function renderHeaderAuth() {
    const user = TemuBalikAPI.getCurrentUser();
    const container = document.getElementById('auth-nav-container');
    const modLink = document.getElementById('nav-mod-link');

    if (user && user.role === 'moderator') {
      modLink.classList.remove('hidden');
    } else {
      modLink.classList.add('hidden');
    }

    if (!user) {
      container.innerHTML = `<a href="#/masuk" class="btn btn--outline btn--sm">Masuk</a>`;
    } else {
      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="text-sm">Halo, <strong>${escapeHTML(user.display_name)}</strong></span>
          <button id="logout-btn" class="btn btn--outline btn--sm">Keluar</button>
        </div>
      `;
      document.getElementById('logout-btn').onclick = () => {
        TemuBalikAPI.clearSession();
        renderHeaderAuth();
        showToast('Berhasil keluar dari akun');
        window.location.hash = '#/';
      };
    }
  }

  function renderReportCard(r) {
    const typeBadge = r.type === 'lost'
      ? '<span class="badge badge--lost">HILANG</span>'
      : '<span class="badge badge--found">DITEMUKAN</span>';
    const statusBadge = r.status === 'resolved'
      ? '<span class="badge badge--resolved">DIKEMBALIKAN</span>'
      : '';

    return `
      <article class="report-card">
        <img src="${escapeHTML(r.image_url || 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=600&auto=format&fit=crop&q=60')}" alt="${escapeHTML(r.title)}" class="report-card__img" />
        <div class="report-card__body">
          <div class="report-card__meta">
            <div style="display:flex;gap:6px;">${typeBadge} ${statusBadge}</div>
            <span class="text-sm text-muted">${escapeHTML(r.category)}</span>
          </div>
          <h3 class="report-card__title">
            <a href="#/laporan/${r.id}" style="color:inherit;">${escapeHTML(r.title)}</a>
          </h3>
          <p class="report-card__desc">${escapeHTML(r.public_description)}</p>
          <div class="report-card__footer">
            <span>📍 ${escapeHTML(r.area_label)}, ${escapeHTML(r.city)}</span>
            <span>📅 ${escapeHTML(r.incident_date)}</span>
          </div>
        </div>
      </article>
    `;
  }

  // 1. Halaman Beranda (/)
  async function renderHome(root) {
    const { reports } = await TemuBalikAPI.getReports({ limit: 6 });

    root.innerHTML = `
      <section class="hero">
        <div class="container">
          <h1 class="hero__title">Kehilangan sesuatu? Mari temukan kembali.</h1>
          <p class="hero__subtitle">
            Temukan laporan barang hilang dan ditemukan di sekitar wilayahmu. Buat laporan dengan mudah dan hubungi pelapor melalui proses yang lebih aman.
          </p>

          <form id="hero-search-form" class="search-bar">
            <input type="text" id="hero-q" class="input" placeholder="Cari nama barang, ciri umum, atau lokasi..." />
            <select id="hero-city" class="select">
              <option value="">Semua Kota/Kabupaten</option>
              ${CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <button type="submit" class="btn btn--primary">Cari Barang</button>
          </form>

          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;">
            <a href="#/buat-laporan?type=lost" class="btn btn--primary">Saya Kehilangan Barang</a>
            <a href="#/buat-laporan?type=found" class="btn btn--outline">Saya Menemukan Barang</a>
          </div>
        </div>
      </section>

      <section class="container mt-4">
        <h2>Kategori Populer</h2>
        <div class="category-grid">
          ${CATEGORIES.map(cat => `
            <a href="#/cari?category=${encodeURIComponent(cat.id)}" class="category-card">
              <div style="font-size:1.8rem;">${cat.icon}</div>
              <div style="font-weight:700;margin-top:6px;color:var(--text);">${cat.name}</div>
            </a>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2>Laporan Terbaru</h2>
          <a href="#/cari" class="btn btn--outline btn--sm">Lihat Semua &rarr;</a>
        </div>
        <div class="reports-grid">
          ${reports.map(renderReportCard).join('')}
        </div>

        <div class="panel mt-4" style="margin-top:40px;background:#EFF6FF;border-color:#BFDBFE;">
          <h3>Cara Kerja Aman di TemuBalik</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:12px;">
            <div><strong>1. Cari / Lapor</strong><p class="text-sm text-muted">Gunakan area umum, simpan ciri rahasia barang untuk verifikasi.</p></div>
            <div><strong>2. Relay Kontak Aman</strong><p class="text-sm text-muted">Nomor HP &amp; email tidak diumbar ke publik.</p></div>
            <div><strong>3. Verifikasi Klaim</strong><p class="text-sm text-muted">Pengklaim wajib menjawab detail yang tidak dipublikasikan.</p></div>
            <div><strong>4. Serah Terima Aman</strong><p class="text-sm text-muted">Bertemu di pos keamanan resmi atau ruang publik ramai.</p></div>
          </div>
        </div>
      </section>
    `;

    document.getElementById('hero-search-form').onsubmit = (e) => {
      e.preventDefault();
      const q = document.getElementById('hero-q').value.trim();
      const city = document.getElementById('hero-city').value;
      window.location.hash = `#/cari?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`;
    };
  }

  // 2. Halaman Jelajahi & Filter (/cari, /laporan/hilang, /laporan/ditemukan)
  async function renderExplore(root, forcedType = '', queryParams = {}) {
    const activeType = forcedType || queryParams.type || '';
    const q = queryParams.q || '';
    const category = queryParams.category || '';
    const city = queryParams.city || '';

    const { reports } = await TemuBalikAPI.getReports({ type: activeType, q, category, city });

    root.innerHTML = `
      <div class="container">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div>
            <h1>Jelajahi Laporan</h1>
            <p class="text-muted text-sm">Filter berdasarkan status, kategori, dan wilayah kota/kabupaten.</p>
          </div>
          <div class="segmented">
            <button class="segmented__btn ${activeType === '' ? 'active' : ''}" data-type="">Semua</button>
            <button class="segmented__btn ${activeType === 'lost' ? 'active' : ''}" data-type="lost">Hilang</button>
            <button class="segmented__btn ${activeType === 'found' ? 'active' : ''}" data-type="found">Ditemukan</button>
          </div>
        </div>

        <form id="filter-form" class="panel mb-4" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
          <input type="text" id="f-q" class="input" placeholder="Kata kunci..." value="${escapeHTML(q)}" />
          <select id="f-category" class="select">
            <option value="">Semua Kategori</option>
            ${CATEGORIES.map(c => `<option value="${c.id}" ${category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
          <select id="f-city" class="select">
            <option value="">Semua Kota</option>
            ${CITIES.map(c => `<option value="${c}" ${city === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <button type="submit" class="btn btn--primary">Terapkan Filter</button>
        </form>

        ${reports.length === 0 ? `
          <div class="panel" style="text-align:center;padding:48px 20px;">
            <h3>Belum ada laporan yang cocok</h3>
            <p class="text-muted text-sm mt-2">Coba gunakan kata kunci lain atau buat laporan baru jika barangmu belum terdaftar.</p>
            <a href="#/buat-laporan" class="btn btn--primary mt-4">+ Buat Laporan Sekarang</a>
          </div>
        ` : `
          <div class="reports-grid">
            ${reports.map(renderReportCard).join('')}
          </div>
        `}
      </div>
    `;

    root.querySelectorAll('.segmented__btn').forEach(btn => {
      btn.onclick = () => {
        const t = btn.getAttribute('data-type');
        window.location.hash = t === 'lost' ? '#/laporan/hilang' : t === 'found' ? '#/laporan/ditemukan' : '#/cari';
      };
    });

    document.getElementById('filter-form').onsubmit = (e) => {
      e.preventDefault();
      const params = new URLSearchParams({
        type: activeType,
        q: document.getElementById('f-q').value.trim(),
        category: document.getElementById('f-category').value,
        city: document.getElementById('f-city').value
      });
      window.location.hash = `#/cari?${params.toString()}`;
    };
  }

  // 3. Halaman Detail Laporan (/laporan/:id)
  async function renderDetail(root, id) {
    try {
      const { report } = await TemuBalikAPI.getReportById(id);
      const user = TemuBalikAPI.getCurrentUser();
      const isOwner = user && user.id === report.owner_id;

      root.innerHTML = `
        <div class="container" style="max-width:860px;">
          <a href="#/cari" class="text-sm">&larr; Kembali ke daftar laporan</a>
          <div class="panel mt-2">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <div>
                <span class="badge ${report.type === 'lost' ? 'badge--lost' : 'badge--found'}">
                  ${report.type === 'lost' ? 'BARANG HILANG' : 'BARANG DITEMUKAN'}
                </span>
                <span class="badge ${report.status === 'resolved' ? 'badge--resolved' : 'badge--pending'}">
                  Status: ${report.status.toUpperCase()}
                </span>
              </div>
              <span class="text-sm text-muted">ID Laporan: ${escapeHTML(report.id)}</span>
            </div>

            <h1 class="mt-2">${escapeHTML(report.title)}</h1>
            <p class="text-muted text-sm">
              Kategori: <strong>${escapeHTML(report.category)}</strong> &bull;
              Lokasi Umum: <strong>${escapeHTML(report.area_label)}, ${escapeHTML(report.city)}</strong> &bull;
              Tanggal: <strong>${escapeHTML(report.incident_date)}</strong>
            </p>

            <img src="${escapeHTML(report.image_url || 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=800&auto=format&fit=crop&q=60')}"
                 alt="${escapeHTML(report.title)}"
                 style="width:100%;max-height:380px;object-fit:cover;border-radius:12px;margin:18px 0;" />

            <h3>Deskripsi Publik</h3>
            <p class="mt-2" style="white-space:pre-line;">${escapeHTML(report.public_description)}</p>

            ${report.private_verification_notes ? `
              <div class="alert alert--warning mt-4">
                <strong>🔒 Catatan Verifikasi Rahasia (Hanya terlihat oleh Anda / Moderator):</strong>
                <p>${escapeHTML(report.private_verification_notes)}</p>
              </div>
            ` : `
              <div class="alert alert--info mt-4">
                🔒 <strong>Perlindungan Klaim Palsu:</strong> Ciri khusus barang ini disembunyikan dari publik dan hanya digunakan untuk memverifikasi klaim kepemilikan.
              </div>
            `}

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${report.status !== 'resolved' && !isOwner ? `
                  <a href="#/klaim/${report.id}" class="btn btn--primary">
                    ${report.type === 'found' ? 'Ajukan Klaim Kepemilikan' : 'Saya Menemukan Barang Ini'}
                  </a>
                ` : ''}
                ${isOwner && report.status !== 'resolved' ? `
                  <button id="btn-resolve" class="btn btn--accent">✓ Tandai Sudah Dikembalikan</button>
                ` : ''}
              </div>
              <button id="btn-flag" class="btn btn--outline btn--sm text-danger">🚩 Laporkan Penyalahgunaan</button>
            </div>
          </div>
        </div>
      `;

      const resolveBtn = document.getElementById('btn-resolve');
      if (resolveBtn) {
        resolveBtn.onclick = async () => {
          await TemuBalikAPI.updateReportStatus(report.id, 'resolved');
          showToast('Laporan ditandai selesai / dikembalikan!');
          renderDetail(root, id);
        };
      }

      document.getElementById('btn-flag').onclick = () => {
        openModal(`
          <h3>Laporkan Penyalahgunaan</h3>
          <p class="text-sm text-muted mt-2">Laporkan jika unggahan ini memuat spam, penipuan meminta biaya/OTP, atau menampilkan data pribadi sensitif.</p>
          <form id="flag-form" class="mt-4">
            <div class="form-group">
              <label class="form-label">Alasan Pelaporan</label>
              <textarea id="flag-reason" class="textarea" rows="3" required placeholder="Contoh: Meminta transfer uang tebusan..."></textarea>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" class="btn btn--outline" id="cancel-modal">Batal</button>
              <button type="submit" class="btn btn--danger">Kirim Laporan</button>
            </div>
          </form>
        `);
        document.getElementById('cancel-modal').onclick = closeModal;
        document.getElementById('flag-form').onsubmit = async (e) => {
          e.preventDefault();
          const reason = document.getElementById('flag-reason').value.trim();
          await TemuBalikAPI.flagReport(report.id, reason);
          closeModal();
          showToast('Laporan dikirim ke antrean moderator.');
        };
      };
    } catch (err) {
      root.innerHTML = `<div class="container"><div class="alert alert--danger">${escapeHTML(err.message)}</div></div>`;
    }
  }

  // 4. Halaman Buat Laporan (/buat-laporan) dengan Validasi & Pratinjau
  function renderCreateReport(root, queryParams = {}) {
    const user = TemuBalikAPI.getCurrentUser();
    if (!user) {
      window.location.hash = '#/masuk';
      showToast('Silakan masuk terlebih dahulu untuk membuat laporan.');
      return;
    }

    const initialType = queryParams.type === 'found' ? 'found' : 'lost';

    root.innerHTML = `
      <div class="container" style="max-width:740px;">
        <h1>Buat Laporan Baru</h1>
        <p class="text-muted text-sm mb-4">Pisahkan informasi umum dan ciri khusus rahasia agar barang kembali ke tangan yang tepat.</p>

        <form id="create-report-form" class="panel">
          <div class="form-group">
            <label class="form-label">Jenis Laporan</label>
            <select id="r-type" class="select">
              <option value="lost" ${initialType === 'lost' ? 'selected' : ''}>Barang Hilang (Saya kehilangan barang)</option>
              <option value="found" ${initialType === 'found' ? 'selected' : ''}>Barang Ditemukan (Saya menemukan barang)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Nama Barang / Judul Laporan (5–100 karakter) *</label>
            <input type="text" id="r-title" class="input" minlength="5" maxlength="100" required placeholder="Contoh: Dompet Kulit Cokelat di Sekitar Stasiun Tebet" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">Kategori *</label>
              <select id="r-category" class="select" required>
                ${CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tanggal Kejadian / Ditemukan *</label>
              <input type="date" id="r-date" class="input" max="${new Date().toISOString().split('T')[0]}" required />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">Kota / Kabupaten *</label>
              <select id="r-city" class="select" required>
                ${CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Area Umum (Jangan tulis alamat rumah) *</label>
              <input type="text" id="r-area" class="input" required placeholder="Contoh: Halte TransJakarta / Gerbang Kampus" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Deskripsi Publik (20–1.000 karakter) *</label>
            <textarea id="r-public-desc" class="textarea" rows="4" minlength="20" maxlength="1000" required
              placeholder="Jelaskan ciri umum yang aman diketahui publik. Jangan tulis nomor seri lengkap, isi dompet, atau nomor HP Anda di sini."></textarea>
            <div id="pii-warning" class="alert alert--danger mt-2 hidden">
              ⚠️ Terdeteksi pola Nomor Telepon atau NIK 16 digit pada deskripsi publik! Demi keamanan, hapus nomor pribadi dari deskripsi publik.
            </div>
          </div>

          <div class="form-group" style="background:#FFFBEB;padding:14px;border-radius:10px;border:1px solid #FDE68A;">
            <label class="form-label">🔒 Ciri Khusus untuk Verifikasi Pemilik (Privat / Tidak Dipublikasikan) *</label>
            <textarea id="r-private-notes" class="textarea" rows="3" required
              placeholder="Contoh: Ada gantungan kunci inisial R, stiker kucing di bagian dalam, atau 4 digit terakhir nomor seri."></textarea>
            <div class="form-hint">Field ini TIDAK PERNAH dikirim ke pengunjung umum dan hanya digunakan untuk memvalidasi pengklaim.</div>
          </div>

          <div class="form-group mt-4">
            <label class="form-label">URL Foto Barang (Opsional - Metadata EXIF/GPS otomatis diabaikan)</label>
            <input type="url" id="r-image" class="input" placeholder="https://..." />
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
            <button type="button" id="btn-preview" class="btn btn--outline">Pratinjau Laporan</button>
            <button type="submit" class="btn btn--primary">Terbitkan Laporan</button>
          </div>
        </form>
      </div>
    `;

    const descInput = document.getElementById('r-public-desc');
    const piiWarning = document.getElementById('pii-warning');
    descInput.oninput = () => {
      piiWarning.classList.toggle('hidden', !containsSensitivePII(descInput.value));
    };

    const getFormData = () => ({
      type: document.getElementById('r-type').value,
      title: document.getElementById('r-title').value.trim(),
      category: document.getElementById('r-category').value,
      incident_date: document.getElementById('r-date').value,
      city: document.getElementById('r-city').value,
      area_label: document.getElementById('r-area').value.trim(),
      public_description: document.getElementById('r-public-desc').value.trim(),
      private_verification_notes: document.getElementById('r-private-notes').value.trim(),
      image_url: document.getElementById('r-image').value.trim()
    });

    document.getElementById('btn-preview').onclick = () => {
      const d = getFormData();
      openModal(`
        <h3>Pratinjau Tampilan Publik</h3>
        <p class="text-sm text-muted">Beginilah laporan Anda terlihat oleh publik (catatan rahasia disembunyikan):</p>
        <div class="panel mt-4">
          <span class="badge ${d.type === 'lost' ? 'badge--lost' : 'badge--found'}">${d.type.toUpperCase()}</span>
          <h4 class="mt-2">${escapeHTML(d.title || '(Judul belum diisi)')}</h4>
          <p class="text-sm text-muted">${escapeHTML(d.area_label)}, ${escapeHTML(d.city)} &bull; ${escapeHTML(d.incident_date)}</p>
          <p class="mt-2 text-sm">${escapeHTML(d.public_description || '(Deskripsi belum diisi)')}</p>
        </div>
        <div style="text-align:right;margin-top:16px;">
          <button class="btn btn--primary" id="close-preview">Tutup Pratinjau</button>
        </div>
      `);
      document.getElementById('close-preview').onclick = closeModal;
    };

    document.getElementById('create-report-form').onsubmit = async (e) => {
      e.preventDefault();
      const payload = getFormData();
      if (containsSensitivePII(payload.public_description)) {
        showToast('Mohon hapus nomor telepon/NIK dari deskripsi publik.');
        return;
      }
      try {
        const { report } = await TemuBalikAPI.createReport(payload);
        showToast('Laporan berhasil diterbitkan!');
        window.location.hash = `#/laporan/${report.id}`;
      } catch (err) {
        showToast(err.message);
      }
    };
  }

  // 5. Halaman Klaim (/klaim/:id)
  async function renderClaimPage(root, reportId) {
    const user = TemuBalikAPI.getCurrentUser();
    if (!user) {
      window.location.hash = '#/masuk';
      showToast('Silakan masuk untuk mengajukan klaim.');
      return;
    }

    const { report } = await TemuBalikAPI.getReportById(reportId);

    root.innerHTML = `
      <div class="container" style="max-width:640px;">
        <div class="panel">
          <h2>Ajukan Klaim / Hubungi Pelapor</h2>
          <p class="text-sm text-muted mt-2">Laporan: <strong>${escapeHTML(report.title)}</strong></p>
          <div class="alert alert--info mt-4">
            Sebutkan ciri khusus barang yang <strong>tidak tertulis di deskripsi publik</strong> (misal: isi tas, gantungan kunci, warna casing dalam, atau stiker khusus) agar pelapor dapat memverifikasi Anda.
          </div>
          <form id="claim-form" class="mt-4">
            <div class="form-group">
              <label class="form-label">Bukti Ciri Khusus &amp; Pesan Verifikasi *</label>
              <textarea id="claim-msg" class="textarea" rows="4" required
                placeholder="Jelaskan ciri spesifik barang dan usulan lokasi publik yang aman untuk serah terima..."></textarea>
            </div>
            <button type="submit" class="btn btn--primary">Kirim Klaim Aman</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('claim-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await TemuBalikAPI.submitClaim(reportId, document.getElementById('claim-msg').value.trim());
        showToast('Klaim berhasil dikirim! Pantau statusnya di Dashboard.');
        window.location.hash = '#/dashboard';
      } catch (err) {
        showToast(err.message);
      }
    };
  }

  // 6. Halaman Dashboard (/dashboard)
  async function renderDashboard(root) {
    const user = TemuBalikAPI.getCurrentUser();
    if (!user) {
      window.location.hash = '#/masuk';
      return;
    }

    const { myReports, incomingClaims, myClaims } = await TemuBalikAPI.getMyDashboard();

    root.innerHTML = `
      <div class="container">
        <h1>Dashboard Saya</h1>
        <p class="text-muted text-sm mb-4">Kelola laporan milik Anda dan verifikasi klaim yang masuk.</p>

        <div class="panel mb-4">
          <h3>Klaim Masuk pada Laporan Anda (${incomingClaims.length})</h3>
          ${incomingClaims.length === 0 ? `<p class="text-sm text-muted mt-2">Belum ada klaim yang masuk.</p>` : `
            <div class="mt-4" style="display:grid;gap:12px;">
              ${incomingClaims.map(c => `
                <div style="border:1px solid var(--border);border-radius:10px;padding:14px;">
                  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;">
                    <strong>Laporan: ${escapeHTML(c.report_title)}</strong>
                    <span class="badge badge--pending">${escapeHTML(c.verification_status.toUpperCase())}</span>
                  </div>
                  <p class="text-sm mt-2"><strong>Pengklaim (${escapeHTML(c.claimant_name)}):</strong> "${escapeHTML(c.message)}"</p>
                  <p class="text-sm text-muted mt-2">🔒 <em>Catatan Rahasia Anda: ${escapeHTML(c.private_verification_notes)}</em></p>
                  ${c.verification_status === 'pending' ? `
                    <div style="display:flex;gap:8px;margin-top:10px;">
                      <button class="btn btn--accent btn--sm verify-claim-btn" data-id="${c.id}" data-status="approved">Setujui Klaim</button>
                      <button class="btn btn--danger btn--sm verify-claim-btn" data-id="${c.id}" data-status="rejected">Tolak</button>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <h3 class="mb-4">Laporan Milik Saya (${myReports.length})</h3>
        <div class="reports-grid">
          ${myReports.map(renderReportCard).join('')}
        </div>
      </div>
    `;

    root.querySelectorAll('.verify-claim-btn').forEach(btn => {
      btn.onclick = async () => {
        await TemuBalikAPI.verifyClaim(btn.dataset.id, btn.dataset.status);
        showToast(`Status klaim diperbarui menjadi ${btn.dataset.status}`);
        renderDashboard(root);
      };
    });
  }

  // 7. Halaman Moderasi (/admin/moderasi)
  async function renderModeration(root) {
    try {
      const { queue, logs } = await TemuBalikAPI.getModerationQueue();
      root.innerHTML = `
        <div class="container">
          <h1>Panel Moderasi &amp; Audit</h1>
          <p class="text-muted text-sm mb-4">Tinjau laporan yang ditandai pengguna dan catat alasan tindakan untuk audit.</p>

          <div class="panel mb-4">
            <h3>Antrean Tinjauan (${queue.length})</h3>
            ${queue.length === 0 ? `<p class="text-sm text-muted mt-2">Tidak ada laporan mencurigakan saat ini.</p>` : `
              <div class="mt-4" style="display:grid;gap:12px;">
                ${queue.map(r => `
                  <div style="border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div>
                      <strong>${escapeHTML(r.title)}</strong> <span class="badge badge--pending">${escapeHTML(r.status)}</span>
                      <p class="text-sm text-muted">${escapeHTML(r.public_description)}</p>
                    </div>
                    <div style="display:flex;gap:8px;">
                      <button class="btn btn--accent btn--sm mod-act-btn" data-id="${r.id}" data-act="approve">Setujui Aktif</button>
                      <button class="btn btn--danger btn--sm mod-act-btn" data-id="${r.id}" data-act="hide">Sembunyikan</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="panel">
            <h3>Log Audit Moderator Terbaru</h3>
            <ul class="mt-2 text-sm text-muted" style="list-style:inside;">
              ${logs.map(l => `<li>[${escapeHTML(l.created_at)}] Aksi: <strong>${escapeHTML(l.action)}</strong> pada laporan #${escapeHTML(l.report_id)} — Alasan: ${escapeHTML(l.reason)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;

      root.querySelectorAll('.mod-act-btn').forEach(btn => {
        btn.onclick = async () => {
          const reason = prompt('Masukkan alasan tindakan moderasi (wajib untuk log audit):', 'Peninjauan standar pedoman keamanan');
          if (!reason) return;
          await TemuBalikAPI.moderateReport(btn.dataset.id, btn.dataset.act, reason);
          showToast('Tindakan moderasi berhasil dicatat.');
          renderModeration(root);
        };
      });
    } catch (err) {
      root.innerHTML = `<div class="container"><div class="alert alert--danger">${escapeHTML(err.message)}</div></div>`;
    }
  }

  // 8. Halaman Login (/masuk) & Registrasi (/daftar)
  function renderAuth(root, isRegister = false) {
    root.innerHTML = `
      <div class="container" style="max-width:440px;">
        <div class="panel">
          <h2>${isRegister ? 'Daftar Akun TemuBalik' : 'Masuk ke TemuBalik'}</h2>
          <p class="text-sm text-muted mt-2">
            Gunakan akun demo cepat: <code>budi@contoh.id</code> (User) atau <code>mod@temubalik.id</code> (Moderator), kata sandi: <code>password123</code>
          </p>
          <form id="auth-form" class="mt-4">
            ${isRegister ? `
              <div class="form-group">
                <label class="form-label">Nama Tampilan</label>
                <input type="text" id="a-name" class="input" required placeholder="Nama Anda" />
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="a-email" class="input" required value="${isRegister ? '' : 'budi@contoh.id'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Kata Sandi</label>
              <input type="password" id="a-pass" class="input" required value="password123" />
            </div>
            <button type="submit" class="btn btn--primary" style="width:100%;">
              ${isRegister ? 'Buat Akun' : 'Masuk'}
            </button>
          </form>
          <p class="text-sm text-muted mt-4" style="text-align:center;">
            ${isRegister
              ? 'Sudah punya akun? <a href="#/masuk">Masuk di sini</a>'
              : 'Belum punya akun? <a href="#/daftar">Daftar sekarang</a>'}
          </p>
        </div>
      </div>
    `;

    document.getElementById('auth-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const email = document.getElementById('a-email').value.trim();
        const pass = document.getElementById('a-pass').value;
        const res = isRegister
          ? await TemuBalikAPI.register(document.getElementById('a-name').value.trim(), email, pass)
          : await TemuBalikAPI.login(email, pass);

        TemuBalikAPI.setSession(res.token, res.user);
        renderHeaderAuth();
        showToast(`Selamat datang, ${res.user.display_name}!`);
        window.location.hash = '#/dashboard';
      } catch (err) {
        showToast(err.message);
      }
    };
  }

  // 9. Halaman Panduan Keamanan (/panduan-keamanan)
  function renderSafetyGuide(root) {
    root.innerHTML = `
      <div class="container" style="max-width:800px;">
        <div class="panel">
          <h1>Panduan Klaim &amp; Serah Terima Aman</h1>
          <p class="text-muted mt-2">Prinsip perlindungan pengguna TemuBalik sesuai Bagian 10 <code>design.md</code>.</p>
          <div class="mt-4" style="display:grid;gap:16px;">
            <div class="alert alert--info">
              <strong>1. Jangan Bagikan Detail Rahasia di Publik</strong>
              <p>Simpan nomor seri, isi dompet, atau ciri unik di kolom Verifikasi Rahasia agar tidak disalahgunakan pengklaim palsu.</p>
            </div>
            <div class="alert alert--warning">
              <strong>2. Tolak Permintaan OTP, PIN, atau Biaya Tebusan</strong>
              <p>TemuBalik gratis dan tidak pernah memungut biaya klaim. Jangan pernah memberikan kode OTP kepada siapa pun.</p>
            </div>
            <div class="alert alert--info">
              <strong>3. Serah Terima di Tempat Publik / Pos Resmi</strong>
              <p>Hindari bertemu sendirian di tempat sepi. Gunakan pos satpam kampus/stasiun, kantor polisi, atau area ramai.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Router Utama
  function handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    const queryParams = Object.fromEntries(new URLSearchParams(queryString || ''));
    const root = document.getElementById('app-content');

    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-route') === path);
    });

    if (path === '/') return renderHome(root);
    if (path === '/cari') return renderExplore(root, '', queryParams);
    if (path === '/laporan/hilang') return renderExplore(root, 'lost', queryParams);
    if (path === '/laporan/ditemukan') return renderExplore(root, 'found', queryParams);
    if (path.startsWith('/laporan/')) return renderDetail(root, path.split('/')[2]);
    if (path === '/buat-laporan') return renderCreateReport(root, queryParams);
    if (path.startsWith('/klaim/')) return renderClaimPage(root, path.split('/')[2]);
    if (path === '/dashboard') return renderDashboard(root);
    if (path === '/admin/moderasi') return renderModeration(root);
    if (path === '/masuk') return renderAuth(root, false);
    if (path === '/daftar') return renderAuth(root, true);
    if (path === '/panduan-keamanan') return renderSafetyGuide(root);

    renderHome(root);
  }

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('DOMContentLoaded', () => {
    renderHeaderAuth();
    handleRoute();

    document.getElementById('mobile-menu-btn').onclick = () => {
      document.getElementById('main-nav').classList.toggle('open');
    };
  });
})();