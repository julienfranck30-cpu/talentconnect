// api/upload-cv.js
const cloudinary = require('cloudinary').v2;
const { IncomingForm } = require('formidable');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const form = new IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ erreur: 'Erreur parsing' });

    const fichier = files.cv?.[0] || files.cv;
    if (!fichier) return res.status(400).json({ erreur: 'Aucun fichier trouvé' });

    const nomFichier = fichier.originalFilename || fichier.name || '';
    if (!nomFichier.endsWith('.pdf')) {
      return res.status(400).json({ erreur: 'PDF uniquement' });
    }

    try {
      const result = await cloudinary.uploader.upload(fichier.filepath || fichier.path, {
        folder: 'talentconnect/cvs',
        resource_type: 'raw',
        public_id: `cv_${Date.now()}`,
      });
      return res.status(200).json({ url: result.secure_url });
    } catch (e) {
      return res.status(500).json({ erreur: 'Échec upload Cloudinary' });
    }
  });
}
