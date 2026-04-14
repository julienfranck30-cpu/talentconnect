// api/upload-cv.js — Upload CV vers Cloudinary
// Appelé depuis le formulaire étape 5

const CLOUDINARY_CLOUD = 'dxtmmcr9f';
const CLOUDINARY_KEY   = '867226763343835';
const CLOUDINARY_SECRET = 's47bMwq-FH8Rc5Mj655-QUkNgr8';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Parse multipart form data
    const boundary = req.headers['content-type'].split('boundary=')[1];
    const parts = parseMultipart(buffer, boundary);
    const filePart = parts.find(p => p.filename);

    if (!filePart) return res.status(400).json({ error: 'No file found' });
    if (!filePart.filename.endsWith('.pdf')) {
      return res.status(400).json({ error: 'PDF only' });
    }

    // Upload vers Cloudinary
    const timestamp = Math.round(Date.now() / 1000);
    const signature = await generateSignature({ timestamp, folder: 'talentconnect/cvs' }, CLOUDINARY_SECRET);

    const formData = new FormData();
    formData.append('file', new Blob([filePart.data], { type: 'application/pdf' }), filePart.filename);
    formData.append('api_key', CLOUDINARY_KEY);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', 'talentconnect/cvs');
    formData.append('resource_type', 'raw');

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`,
      { method: 'POST', body: formData }
    );

    const result = await uploadRes.json();
    if (result.error) throw new Error(result.error.message);

    return res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id
    });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from('--' + boundary);
  let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;

  while (start < buffer.length) {
    const end = buffer.indexOf(boundaryBuffer, start);
    if (end === -1) break;
    const part = buffer.slice(start, end - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = end + boundaryBuffer.length + 2; continue; }

    const headers = part.slice(0, headerEnd).toString();
    const data = part.slice(headerEnd + 4);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const nameMatch = headers.match(/name="([^"]+)"/);

    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      data
    });
    start = end + boundaryBuffer.length + 2;
  }
  return parts;
}

async function generateSignature(params, secret) {
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + secret;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
