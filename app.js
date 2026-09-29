/* ── Lance Mon Job V6 — 13 étapes ── */

const STRIPE_LINKS = {
  starter: 'https://buy.stripe.com/eVq8wO7eE1on47xaaldnW01',
  pro:     'https://buy.stripe.com/3cIaEW0Qg2sreMb4Q1dnW02',
  max:     'https://buy.stripe.com/9B614m42s9UT8nNgyJdnW03'
};

const TOTAL_STEPS = 13;

// Échappement HTML pour prévenir le XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso){ return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function badgeCls(s){ return s==='Retenu'?'badge-retained':s==='Refusé'?'badge-rejected':'badge-pending'; }

// Options de durée selon le type de contrat
const DUREE_OPTIONS = {
  'Stage': ['1 mois','2 mois','3 mois','4 mois','5 mois','6 mois','7 mois','8 mois','9 mois','10 mois','11 mois','12 mois'],
  'Stage à l\'étranger': ['1 mois','2 mois','3 mois','4 mois','5 mois','6 mois','7 mois','8 mois','9 mois','10 mois','11 mois','12 mois'],
  'Alternance': [
    '1 an — 3 semaines entreprise / 1 semaine école',
    '2 ans — 3 semaines entreprise / 1 semaine école',
    '3 ans — 3 semaines entreprise / 1 semaine école',
    '1 an — 1 semaine entreprise / 1 semaine école',
    '2 ans — 1 semaine entreprise / 1 semaine école',
    '1 an — 2 semaines entreprise / 2 semaines école',
    '2 ans — 2 semaines entreprise / 2 semaines école',
    '1 an — 3 jours entreprise / 2 jours école',
    '2 ans — 3 jours entreprise / 2 jours école',
    '3 ans — 3 jours entreprise / 2 jours école',
  ],
  'Emploi (CDD)': ['3 mois','6 mois','9 mois','12 mois','18 mois','24 mois'],
  '1er Emploi (CDI / CDD)': ['3 mois','6 mois','9 mois','12 mois','18 mois','24 mois'],
  'Reconversion professionnelle': ['3 mois','6 mois','9 mois','12 mois','18 mois','24 mois'],
};

/* ════════════════════════════
   FORMULAIRE
════════════════════════════ */
if(document.getElementById('step-1')){

  let currentStep = 1;
  let formData = { rayon: '100 km', plan: 'pro', genre: 'N' };

  function setProgress(step){
    document.getElementById('progress-bar').style.width = ((step-1)/TOTAL_STEPS*100) + '%';
  }
  setProgress(1);

  window.selectQual = function(el, group){
    el.closest('.qualification-list, .step-panel').querySelectorAll('.qual-chip').forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected');
    const val = el.dataset.value || el.textContent.trim();
    formData[group] = val;

    // Si on sélectionne un contrat, prépare les options de durée
    if(group === 'contrat') buildDureeOptions(val);
  };

  window.selectChip = function(el, group){
    document.querySelectorAll(`#chips-${group} .chip`).forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected');
    if(group==='poste') formData.poste = el.textContent.trim();
    if(group==='rayon') formData.rayon = el.textContent.trim();
  };

  window.toggleChip = function(el){ el.classList.toggle('selected'); };

  window.autoTab = function(el, nextId){
    if(el.value.length >= el.maxLength){
      document.getElementById(nextId)?.focus();
    }
  };

  function getSelectedChips(id){
    return Array.from(document.querySelectorAll(`#${id} .chip.selected`)).map(c=>c.textContent.trim());
  }

  function parseDate(jour, mois, annee){
    if(!jour && !mois && !annee) return null;
    return `${jour.padStart(2,'0')}/${mois.padStart(2,'0')}/${annee}`;
  }

  function buildDureeOptions(contrat) {
    const container = document.getElementById('duree-chips');
    const title = document.getElementById('duree-title');
    const sub = document.getElementById('duree-sub');
    const options = DUREE_OPTIONS[contrat] || [];

    // Adapte le titre selon le contrat
    if(contrat.toLowerCase().includes('alternance')) {
      title.textContent = 'Durée et rythme de ton alternance';
      sub.textContent = 'Sélectionne la durée et le rythme de ta future alternance.';
    } else if(contrat.toLowerCase().includes('stage')) {
      title.textContent = 'Durée de ton stage';
      sub.textContent = 'Sélectionne la durée souhaitée pour ton stage.';
    } else if(contrat.toLowerCase().includes('cdd') || contrat.toLowerCase().includes('1er emploi')) {
      title.textContent = 'Durée souhaitée du contrat';
      sub.textContent = 'Précise la durée minimale souhaitée.';
    } else {
      title.textContent = 'Durée souhaitée';
      sub.textContent = 'Optionnel — précise si tu as une préférence.';
    }

    if(options.length === 0) {
      container.innerHTML = '<p style="color:#888;font-size:14px">Pas de durée spécifique pour ce type de contrat.</p>';
      return;
    }

    container.innerHTML = options.map(opt =>
      `<div class="duree-chip" onclick="selectDuree(this)">${opt}</div>`
    ).join('');
  }

  window.selectDuree = function(el) {
    document.querySelectorAll('.duree-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    formData.duree_contrat = el.textContent.trim();
    document.getElementById('s7-duree-custom').value = '';
  };

  function getStepForField(field) {
    const map = {
      's8-ville': 's8-ville',
      's9-jour': 's9-jour',
    };
    return map[field] || field;
  }

  window.nextStep = function(from){
    const err = document.getElementById(`err-${from}`);
    if(err) err.textContent = '';

    if(from===2){
      const prenom = document.getElementById('s2-prenom').value.trim();
      const nom    = document.getElementById('s2-nom').value.trim();
      const tel    = document.getElementById('s2-tel').value.trim();
      const email  = document.getElementById('s2-email').value.trim();
      if(!prenom||!nom){ err.textContent='Prénom et nom obligatoires.'; return; }
      if(!email||!email.includes('@')){ err.textContent='Email invalide.'; return; }
      if(!tel){ err.textContent='Téléphone obligatoire.'; return; }
      formData.prenom=prenom; formData.nom=nom; formData.tel=tel; formData.email=email;
    }
    if(from===3){
      if(!formData.situation){ err.textContent='Sélectionne une option.'; return; }
    }
    if(from===4){
      const custom = document.getElementById('s4-poste-custom').value.trim();
      if(custom) formData.poste = custom;
      if(!formData.poste){ err.textContent='Sélectionne ou précise un poste.'; return; }
    }
    if(from===5){
      const s = getSelectedChips('chips-secteur');
      if(!s.length){ err.textContent='Sélectionne au moins un secteur.'; return; }
      formData.secteurs = s.join(', ');
    }
    if(from===6){
      if(!formData.contrat){ err.textContent='Sélectionne un type de contrat.'; return; }
      // Build duree options for next step
      buildDureeOptions(formData.contrat);
    }
    if(from===7){
      // Durée — optionnel sauf pour stage et alternance
      const custom = document.getElementById('s7-duree-custom').value.trim();
      if(custom) {
        formData.duree_contrat = custom;
      }
      const contrat = formData.contrat || '';
      if((contrat.toLowerCase().includes('stage') || contrat.toLowerCase().includes('alternance')) && !formData.duree_contrat) {
        err.textContent = 'Précise la durée de ton ' + (contrat.toLowerCase().includes('stage') ? 'stage' : 'alternance') + '.';
        return;
      }
    }
    if(from===8){
      const ville = document.getElementById('s8-ville').value.trim();
      if(!ville){ err.textContent='Indique une ville ou région.'; return; }
      formData.ville = ville;
    }
    if(from===9){
      const j = document.getElementById('s9-jour').value.trim();
      const m = document.getElementById('s9-mois').value.trim();
      const a = document.getElementById('s9-annee').value.trim();
      if(!j||!m||!a){ err.textContent='Indique une date complète.'; return; }
      formData.dispo_tot = parseDate(j, m, a);
    }
    if(from===10){
      const j = document.getElementById('s10-jour').value.trim();
      const m = document.getElementById('s10-mois').value.trim();
      const a = document.getElementById('s10-annee').value.trim();
      if(j && m && a) formData.dispo_tard = parseDate(j, m, a);
    }
    if(from===11){
      const cv = document.getElementById('cv-input').files[0];
      formData.cv = cv ? cv.name : null;
      formData.message = document.getElementById('s11-msg').value.trim();
      formData.offres_publiees = document.getElementById('f-offres-publiees')?.checked || false;
    }
    if(from===13){ submitCampagne(); return; }
    goToStep(from+1);
  };

  window.prevStep = function(from){ if(from>1) goToStep(from-1); };

  function goToStep(n){
    document.getElementById(`step-${currentStep}`).classList.remove('active');
    currentStep = n;
    document.getElementById(`step-${n}`)?.classList.add('active');
    setProgress(n);
    if(n===13) buildRecap();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function buildRecap(){
    const genreLabel = formData.genre === 'M' ? 'Masculin' : formData.genre === 'F' ? 'Féminin' : 'Non précisé';
    document.getElementById('recap-card').innerHTML = `
      <strong>Candidat :</strong> ${escapeHtml(formData.prenom)} ${escapeHtml(formData.nom)}<br>
      <strong>Genre :</strong> ${genreLabel}<br>
      <strong>Email :</strong> ${escapeHtml(formData.email)}<br>
      <strong>Poste visé :</strong> ${escapeHtml(formData.poste)||'—'}<br>
      <strong>Secteurs :</strong> ${escapeHtml(formData.secteurs)||'—'}<br>
      <strong>Contrat :</strong> ${escapeHtml(formData.contrat)||'—'}<br>
      ${formData.duree_contrat ? `<strong>Durée :</strong> ${escapeHtml(formData.duree_contrat)}<br>` : ''}
      <strong>Zone :</strong> ${escapeHtml(formData.ville)||'—'} · ${escapeHtml(formData.rayon)}<br>
      <strong>Disponible à partir du :</strong> ${escapeHtml(formData.dispo_tot)||'—'}<br>
      ${formData.dispo_tard ? `<strong>Au plus tard :</strong> ${escapeHtml(formData.dispo_tard)}<br>` : ''}
      <strong>CV :</strong> ${escapeHtml(formData.cv)||'Non joint'}`;
  }

  window.selectPlan = function(el, plan){
    document.querySelectorAll('.price-card').forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected');
    formData.plan = plan;
  };
  document.querySelectorAll('.price-card').forEach(c=>{
    if(c.querySelector('.plan-badge')?.textContent==='Pro') c.classList.add('selected');
  });

  document.getElementById('cv-input')?.addEventListener('change', function(){
    if(this.files[0]){
      document.getElementById('upload-zone').classList.add('has-file');
      document.getElementById('upload-label').textContent = '✓ ' + this.files[0].name;
      formData.cvFile = this.files[0];
    }
  });

  async function uploadCV(file) {
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const res = await fetch('/api/upload-cv', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) return null;
      if (data.cvTexte) formData.cvTexte = data.cvTexte;
      return data.url;
    } catch(e) {
      console.error('Upload CV exception:', e.message);
      return null;
    }
  }

  window.submitCampagne = async function(){
    const err = document.getElementById('err-13');
    err.textContent = '';
    if(!document.getElementById('f-rgpd').checked){
      err.textContent = 'Vous devez accepter la politique de données (RGPD).';
      return;
    }
    if(!document.getElementById('f-retractation').checked){
      err.textContent = 'Vous devez demander l\'exécution immédiate et renoncer au droit de rétractation pour lancer la campagne (art. L221-28).';
      return;
    }

    const btn = document.querySelector('#step-13 .btn-primary-lg');
    btn.disabled = true;

    if(formData.cvFile) {
      btn.textContent = 'Upload du CV...';
      const cvUrl = await uploadCV(formData.cvFile);
      if(cvUrl) formData.cvUrl = cvUrl;
    }

    btn.textContent = 'Enregistrement...';

    const plans = {
      starter: { label: '29€ – 50 candidatures', price: 29 },
      pro:     { label: '59€ – 150 candidatures', price: 59 },
      max:     { label: '99€ – 300 candidatures', price: 99 }
    };
    const planInfo = plans[formData.plan] || plans.pro;

    try {
      const resp = await fetch('/api/candidatures-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom:           formData.prenom + ' ' + formData.nom,
          email:         formData.email,
          tel:           formData.tel,
          genre:         formData.genre || 'N',
          poste:         formData.poste,
          secteurs:      formData.secteurs,
          ville:         formData.ville,
          rayon:         formData.rayon,
          contrats:      formData.contrat,
          duree_contrat: formData.duree_contrat || null,
          cv:            formData.cv,
          cv_url:        formData.cvUrl || null,
          cv_texte:      formData.cvTexte || null,
          plan:          planInfo.label,
          message:       formData.message,
          offres_publiees: formData.offres_publiees || false,
          statut:        'En attente paiement',
          dispo_tot:     formData.dispo_tot || null,
          dispo_tard:    formData.dispo_tard || null,
          situation:     formData.situation || null,
        })
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Erreur serveur');

      document.getElementById('step-13').classList.remove('active');
      document.getElementById('step-success').classList.add('active');
      document.getElementById('success-msg').textContent =
        `Merci ${formData.prenom} ! Ta campagne "${planInfo.label}" est enregistrée.`;
      document.getElementById('progress-bar').style.width = '100%';

      const stripeUrl = STRIPE_LINKS[formData.plan];
      const emailParam = encodeURIComponent(formData.email);
      const refParam = encodeURIComponent(result.id || '');
      const finalUrl = `${stripeUrl}?prefilled_email=${emailParam}&client_reference_id=${refParam}`;

      document.getElementById('payment-btn-wrap').innerHTML = `
        <a href="${escapeHtml(finalUrl)}" class="btn-primary-lg" style="display:inline-block;text-decoration:none">
          💳 &nbsp;Payer ${planInfo.price}€ maintenant →
        </a>
        <p style="font-size:11px;color:#555550;margin-top:10px">Paiement sécurisé · Stripe · CB, Apple Pay, Google Pay</p>`;

      window.scrollTo({top:0,behavior:'smooth'});

    } catch(e) {
      console.error('Supabase insert error:', e.message);
      err.textContent = 'Erreur : ' + (e.message || 'Réessaie.');
      btn.textContent = 'Payer et lancer ma campagne →';
      btn.disabled = false;
    }
  };
}


