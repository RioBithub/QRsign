const $ = (s) => document.querySelector(s);
const id = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
let officialHash = null;

function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

function setStatus(doc) {
  const badge = $('#statusBadge');
  const txt = $('#statusText');
  badge.className = 'badge';
  if (doc.status === 'FINAL') {
    badge.classList.add('ok');
    badge.textContent = 'VALID';
    txt.textContent = 'Record final ditemukan dan hash resmi tersedia.';
  } else if (doc.status === 'REVOKED') {
    badge.classList.add('bad');
    badge.textContent = 'REVOKED';
    txt.textContent = 'Dokumen ini telah dicabut.';
  } else {
    badge.classList.add('warn');
    badge.textContent = 'DRAFT';
    txt.textContent = 'Record ditemukan, tetapi belum difinalisasi.';
  }
}

async function load() {
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Dokumen tidak ditemukan.');
    const d = data.document;
    $('#loadingCard').hidden = true;
    $('#docCard').hidden = false;
    setStatus(d);
    $('#title').textContent = d.title;
    $('#id').textContent = d.id;
    $('#number').textContent = d.documentNumber || '—';
    $('#issuer').textContent = d.issuer || '—';
    $('#finalized').textContent = fmtDate(d.finalizedAt);
    $('#description').textContent = d.description || '';

    if (d.status === 'FINAL') {
      officialHash = String(d.sha256 || '').toLowerCase();
      $('#finalPanel').hidden = false;
      $('#hash').textContent = officialHash;
      $('#officialFile').href = `/files/${encodeURIComponent(d.id)}`;
    } else if (d.status === 'REVOKED') {
      $('#revokedPanel').hidden = false;
      $('#revokeReason').textContent = d.revokeReason || '';
      if (d.sha256 && d.file) {
        officialHash = d.sha256.toLowerCase();
        $('#finalPanel').hidden = false;
        $('#hash').textContent = officialHash;
        $('#officialFile').href = `/files/${encodeURIComponent(d.id)}`;
      }
    } else {
      $('#draftPanel').hidden = false;
    }
  } catch (err) {
    $('#loadingCard').innerHTML = `<div class="notice bad"><strong>Verifikasi gagal.</strong><div>${err.message}</div></div>`;
  }
}

async function sha256Browser(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

$('#candidateFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file || !officialHash) return;
  const out = $('#compareResult');
  out.hidden = false;
  out.className = 'compare';
  out.textContent = 'Menghitung SHA-256 file lokal…';
  try {
    const hash = await sha256Browser(file);
    const same = hash === officialHash;
    out.classList.add(same ? 'match' : 'mismatch');
    out.innerHTML = same
      ? `<strong>COCOK — file identik dengan file resmi.</strong><br><code>${hash}</code>`
      : `<strong>TIDAK COCOK — file berbeda dari file resmi.</strong><br>Hash file Anda: <code>${hash}</code>`;
  } catch {
    out.classList.add('mismatch');
    out.textContent = 'Browser gagal menghitung hash file.';
  }
});

load();
