// api/upload-cv.js
const { createClient } = require('@supabase/supabase-js');
const { IncomingForm } = require('formidable');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

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
      const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);
      const fileBuffer = fs.readFileSync(fichier.filepath || fichier.path);
      const fileName = `cv_${Date.now()}.pdf`;

      // Upload vers Supabase Storage
      const { data, error } = await sb.storage
        .from('cvs')
        .upload(fileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (error) {
        console.error('Supabase storage error:', error.message);
        return res.status(500).json({ erreur: 'Échec upload: ' + error.message });
      }

      const { data: urlData } = sb.storage.from('cvs').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Extraction du texte du PDF
      let cvTexte = '';
      try {
        const parsed = await pdfParse(fileBuffer);
        cvTexte = parsed.text
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 3000);
        console.log('CV texte extrait:', cvTexte.slice(0, 100) + '...');
      } catch(e) {
        console.error('PDF parse error:', e.message);
        cvTexte = '';
      }

      console.log('CV uploadé Supabase Storage:', publicUrl);
      return res.status(200).json({ url: publicUrl, cvTexte });

    } catch (e) {
      console.error('Upload error:', e.message);
      return res.status(500).json({ erreur: 'Erreur: ' + e.message });
    }
  });
}
