const $ = (s) => document.querySelector(s);

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

function fmtSize(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '—';
  const units = ['B','KB','MB','GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i ? 2 : 0)} ${units[i]}`;
}

$('#checkFile').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  $('#fileHint').textContent = file ? `${file.name} • ${fmtSize(file.size)}` : 'Pilih file resmi/yang Anda terima. File pengecekan tidak disimpan permanen.';
});

$('#checkForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const btn = $('#checkButton');
  const result = $('#checkResult');
  btn.disabled = true;
  btn.textContent = 'Upload sementara → hitung hash → hapus…';
  result.hidden = true;

  try {
    const res = await fetch('/api/check-file', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Pengecekan gagal.');

    result.hidden = false;
    const tempStatus = data.temporaryUploadDeleted
      ? '<span class="temp-deleted">✓ File pengecekan sudah dihapus dari server</span>'
      : '<span class="temp-warning">Status penghapusan file tidak diketahui</span>';

    if (!data.found) {
      result.className = 'card elevated result-card not-found';
      result.innerHTML = `
        <div class="result-status-icon">?</div>
        <div class="eyebrow">HASH NOT FOUND</div>
        <h2>Dokumen tidak ditemukan di registry.</h2>
        <p>SHA-256 file ini tidak cocok dengan dokumen final mana pun yang saat ini terdaftar.</p>
        <div class="hashbox"><span>SHA-256 FILE YANG DICEK</span><code>${esc(data.hash)}</code></div>
        <div class="checked-file"><b>${esc(data.uploadedFile?.name)}</b><span>${fmtSize(data.uploadedFile?.size)}</span></div>
        ${tempStatus}`;
    } else {
      const cards = data.documents.map(d => `
        <article class="match-doc ${d.status === 'REVOKED' ? 'revoked-doc' : ''}">
          <div class="match-head"><span class="badge ${d.status === 'FINAL' ? 'ok' : d.status === 'REVOKED' ? 'bad' : 'warn'}">${esc(d.status)}</span><strong>${esc(d.title)}</strong></div>
          <div class="meta compact-meta">
            <div><span>Document ID</span><strong>${esc(d.id)}</strong></div>
            <div><span>Nomor Dokumen</span><strong>${esc(d.documentNumber || '—')}</strong></div>
            <div><span>Penerbit</span><strong>${esc(d.issuer || '—')}</strong></div>
            <div><span>Finalisasi</span><strong>${esc(fmtDate(d.finalizedAt))}</strong></div>
            <div><span>File Resmi</span><strong>${esc(d.file?.originalName || '—')}</strong></div>
            <div><span>Ukuran</span><strong>${esc(fmtSize(d.file?.size))}</strong></div>
          </div>
          ${d.status === 'REVOKED' ? `<div class="notice bad"><b>Dokumen dicabut.</b> ${esc(d.revokeReason || '')}</div>` : ''}
          <div class="actions"><a class="button" href="/verify/${encodeURIComponent(d.id)}">Buka Verifikasi</a><a class="button ghost" href="/files/${encodeURIComponent(d.id)}">Download File Resmi</a></div>
        </article>`).join('');

      result.className = 'card elevated result-card found';
      result.innerHTML = `
        <div class="result-status-icon good">✓</div>
        <div class="eyebrow">HASH MATCH FOUND</div>
        <h2>Dokumen terdaftar di QRsign.</h2>
        <p>Hash file yang Anda unggah sama persis dengan ${data.matchedCount} record di registry.</p>
        <div class="hashbox"><span>SHA-256 YANG DITEMUKAN</span><code>${esc(data.hash)}</code></div>
        ${tempStatus}
        <div class="matches">${cards}</div>`;
    }
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    result.hidden = false;
    result.className = 'card elevated result-card not-found';
    result.innerHTML = `<div class="notice bad"><strong>Pengecekan gagal.</strong><div>${esc(err.message)}</div></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hitung Hash & Cari di Registry';
  }
});
