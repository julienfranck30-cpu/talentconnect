// api/upload-cv.js
const { createClient } = require('@supabase/supabase-js');
const { IncomingForm } = require('formidable');
const crypto = require('crypto');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const form = new IncomingForm({ keepExtensions: true, maxFileSize: MAX_FILE_SIZE });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      if (/maxFileSize/i.test(err.message || '')) {
        return res.status(400).json({ erreur: 'Fichier trop volumineux (5 Mo max)' });
      }
      return res.status(500).json({ erreur: 'Erreur parsing' });
    }

    const fichier = files.cv?.[0] || files.cv;
    if (!fichier) return res.status(400).json({ erreur: 'Aucun fichier trouvé' });

    const nomFichier = fichier.originalFilename || fichier.name || '';
    if (!nomFichier.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ erreur: 'PDF uniquement' });
    }

    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);
      const fileBuffer = fs.readFileSync(fichier.filepath || fichier.path);

      if (fileBuffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return res.status(400).json({ erreur: 'Le fichier n\'est pas un PDF valide' });
      }

      const fileName = `cv_${crypto.randomUUID()}.pdf`;

      // Upload vers Supabase Storage (bucket privé — servi ensuite via URL signée)
      const { error } = await sb.storage
        .from('cvs')
        .upload(fileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (error) {
        console.error('Supabase storage error:', error.message);
        return res.status(500).json({ erreur: 'Échec upload: ' + error.message });
      }

      // Le formulaire stocke cette valeur telle quelle dans candidatures.cv_url ;
      // on y met le chemin (pas une URL), résolu en URL signée à la demande côté cron.
      const cvPath = fileName;

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

      console.log('CV uploadé Supabase Storage:', cvPath);
      return res.status(200).json({ url: cvPath, cvTexte });

    } catch (e) {
      console.error('Upload error:', e.message);
      return res.status(500).json({ erreur: 'Erreur: ' + e.message });
    }
  });
}
