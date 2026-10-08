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
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Membuat record & QR…';
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
    $('#downloadQr').download = `QR-${data.document.id}-ARU.svg`;
    $('#openVerify').href = data.document.verificationUrl;
    $('#finalizeId').value = data.document.id;
    document.querySelector('#finalizeForm [name="adminKey"]').value = adminKey;
    $('#recordCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
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
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Menghitung SHA-256 & mengunci…';
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}/finalize`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: form
    });
    const data = await parseJson(res);
    const d = data.document;
    const box = $('#finalResult');
    box.hidden = false;
    box.className = 'result success-result';
    box.innerHTML = `<div class="result-icon">✓</div><div><strong>Dokumen berhasil difinalisasi & dikunci.</strong><p>SHA-256 resmi:</p><code>${d.sha256}</code><div class="actions"><a class="button" href="/verify/${encodeURIComponent(id)}" target="_blank">Buka Halaman Verifikasi</a><a class="button ghost" href="/check">Tes di Hash Checker</a></div></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});
