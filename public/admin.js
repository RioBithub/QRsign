const $ = (s) => document.querySelector(s);

async function parseJson(res) {
  let body = {};
  try { body = await res.json(); } catch {}
  if (!res.ok) throw new Error(body.message || 'Request gagal.');
  return body;
}

$('#createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const adminKey = form.get('adminKey');
  const payload = Object.fromEntries(form.entries());
  delete payload.adminKey;

  const btn = e.currentTarget.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Membuat…';
  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(payload)
    });
    const data = await parseJson(res);
    $('#emptyRecord').hidden = true;
    $('#recordResult').hidden = false;
    $('#qrImage').src = data.qrUrl;
    $('#docId').textContent = data.document.id;
    $('#verifyLink').href = data.document.verificationUrl;
    $('#verifyLink').textContent = data.document.verificationUrl;
    $('#downloadQr').href = data.qrUrl;
    $('#finalizeId').value = data.document.id;
    document.querySelector('#finalizeForm [name="adminKey"]').value = adminKey;
    $('#recordCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buat ID & QR';
  }
});

$('#finalizeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const id = String(form.get('id') || '').trim();
  const adminKey = form.get('adminKey');
  form.delete('id');
  form.delete('adminKey');

  const btn = e.currentTarget.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Menghitung hash & mengunci…';
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}/finalize`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: form
    });
    const data = await parseJson(res);
    const box = $('#finalResult');
    box.hidden = false;
    box.innerHTML = `<strong>Berhasil difinalisasi.</strong><br>SHA-256: <code>${data.document.sha256}</code><br><a href="/verify/${encodeURIComponent(id)}" target="_blank">Buka halaman verifikasi</a>`;
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Finalisasi Dokumen';
  }
});
