/* ── TalentConnect V5 — 12 étapes ── */

const SUPABASE_URL = 'https://ihhqwukfkztwdhxfvsvf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AKWSkS_jE-R1PnMWSI408g_5QqV8iPJ';

const STRIPE_LINKS = {
  starter: 'https://buy.stripe.com/eVq8wO7eE1on47xaaldnW01',
  pro:     'https://buy.stripe.com/3cIaEW0Qg2sreMb4Q1dnW02',
  max:     'https://buy.stripe.com/9B614m42s9UT8nNgyJdnW03'
};

let sb;
function getClient(){
  if(!sb) sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return sb;
}

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const TOTAL_STEPS = 12;

function fmtDate(iso){ return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function badgeCls(s){ return s==='Retenu'?'badge-retained':s==='Refusé'?'badge-rejected':'badge-pending'; }

/* ════════════════════════════
   FORMULAIRE (formulaire.html)
════════════════════════════ */
if(document.getElementById('step-1')){

  let currentStep = 1;
  let formData = { rayon: '100 km', plan: 'pro', genre: 'N' };

  function setProgress(step){
    document.getElementById('progress-bar').style.width = ((step-1)/TOTAL_STEPS*100) + '%';
  }
  setProgress(1);

  // Sélection unique pour qualification et genre
  window.selectQual = function(el, group){
    el.closest('.qualification-list, .step-panel').querySelectorAll('.qual-chip').forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected');
    const val = el.dataset.value || el.textContent.trim();
    formData[group] = val;
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

  window.nextStep = function(from){
    const err = document.getElementById(`err-${from}`);
    if(err) err.textContent = '';

    if(from===1){
      // genre déjà sélectionné par défaut
    }
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
    }
    if(from===7){
      const ville = document.getElementById('s7-ville').value.trim();
      if(!ville){ err.textContent='Indique une ville ou région.'; return; }
      formData.ville = ville;
    }
    if(from===8){
      const j = document.getElementById('s8-jour').value.trim();
      const m = document.getElementById('s8-mois').value.trim();
      const a = document.getElementById('s8-annee').value.trim();
      if(!j||!m||!a){ err.textContent='Indique une date complète.'; return; }
      formData.dispo_tot = parseDate(j, m, a);
    }
    if(from===9){
      const j = document.getElementById('s9-jour').value.trim();
      const m = document.getElementById('s9-mois').value.trim();
      const a = document.getElementById('s9-annee').value.trim();
      // Optionnel
      if(j && m && a) formData.dispo_tard = parseDate(j, m, a);
    }
    if(from===10){
      const cv = document.getElementById('cv-input').files[0];
      formData.cv = cv ? cv.name : null;
      formData.message = document.getElementById('s10-msg').value.trim();
    }
    if(from===11){
      // page accroche — pas de validation
    }
    if(from===12){ submitCampagne(); return; }
    goToStep(from+1);
  };

  window.prevStep = function(from){ if(from>1) goToStep(from-1); };

  function goToStep(n){
    document.getElementById(`step-${currentStep}`).classList.remove('active');
    currentStep = n;
    document.getElementById(`step-${n}`)?.classList.add('active');
    setProgress(n);
    if(n===12) buildRecap();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function buildRecap(){
    const genreLabel = formData.genre === 'M' ? 'Masculin' : formData.genre === 'F' ? 'Féminin' : 'Non précisé';
    document.getElementById('recap-card').innerHTML = `
      <strong>Candidat :</strong> ${formData.prenom} ${formData.nom}<br>
      <strong>Genre :</strong> ${genreLabel}<br>
      <strong>Email :</strong> ${formData.email}<br>
      <strong>Poste visé :</strong> ${formData.poste||'—'}<br>
      <strong>Secteurs :</strong> ${formData.secteurs||'—'}<br>
      <strong>Contrat :</strong> ${formData.contrat||'—'}<br>
      <strong>Zone :</strong> ${formData.ville||'—'} · ${formData.rayon}<br>
      <strong>Disponible à partir du :</strong> ${formData.dispo_tot||'—'}<br>
      ${formData.dispo_tard ? `<strong>Au plus tard :</strong> ${formData.dispo_tard}<br>` : ''}
      <strong>CV :</strong> ${formData.cv||'Non joint'}`;
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
    const err = document.getElementById('err-12');
    err.textContent = '';
    if(!document.getElementById('f-rgpd').checked){
      err.textContent = 'Vous devez accepter la politique de données (RGPD).';
      return;
    }

    const btn = document.querySelector('#step-12 .btn-primary-lg');
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
      const { data, error } = await getClient().from('candidatures').insert([{
        nom:        formData.prenom + ' ' + formData.nom,
        email:      formData.email,
        tel:        formData.tel,
        genre:      formData.genre || 'N',
        poste:      formData.poste,
        secteurs:   formData.secteurs,
        ville:      formData.ville,
        rayon:      formData.rayon,
        contrats:   formData.contrat,
        cv:         formData.cv,
        cv_url:     formData.cvUrl || null,
        cv_texte:   formData.cvTexte || null,
        plan:       planInfo.label,
        message:    formData.message,
        statut:     'En attente paiement',
        dispo_tot:  formData.dispo_tot || null,
        dispo_tard: formData.dispo_tard || null,
        situation:  formData.situation || null,
      }]).select();

      if(error) throw error;

      // Envoie email de confirmation au candidat
      try {
        await fetch('/api/confirm-candidature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:    formData.email,
            prenom:   formData.prenom,
            nom:      formData.nom,
            poste:    formData.poste,
            secteurs: formData.secteurs,
            contrat:  formData.contrat,
            plan:     planInfo.label,
            dispo_tot: formData.dispo_tot || null
          })
        });
      } catch(e) {
        console.warn('Email confirmation non envoyé:', e.message);
      }
      document.getElementById('step-success').classList.add('active');
      document.getElementById('success-msg').textContent =
        `Merci ${formData.prenom} ! Ta campagne "${planInfo.label}" est enregistrée.`;
      document.getElementById('progress-bar').style.width = '100%';

      const stripeUrl = STRIPE_LINKS[formData.plan];
      const emailParam = encodeURIComponent(formData.email);
      const finalUrl = `${stripeUrl}?prefilled_email=${emailParam}`;

      document.getElementById('payment-btn-wrap').innerHTML = `
        <a href="${finalUrl}" class="btn-primary-lg" style="display:inline-block;text-decoration:none">
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

/* ════════════════════════════
   ADMIN (admin.html)
════════════════════════════ */
if(document.getElementById('login-screen')){

  let currentId = null;

  if(sessionStorage.getItem('tc_admin')==='1') showDash();

  window.doLogin = function(){
    const u = document.getElementById('l-user').value;
    const p = document.getElementById('l-pass').value;
    if(u===ADMIN_USER && p===ADMIN_PASS){
      sessionStorage.setItem('tc_admin','1');
      showDash();
    } else {
      const e = document.getElementById('l-err');
      e.textContent = 'Identifiants incorrects';
      e.style.display = 'block';
    }
  };

  window.doLogout = function(){
    sessionStorage.removeItem('tc_admin');
    document.getElementById('dashboard-screen').style.display='none';
    document.getElementById('login-screen').style.display='flex';
  };

  window.clearAll = async function(){
    if(!confirm('Effacer toutes les candidatures ?')) return;
    await getClient().from('candidatures').delete().neq('id', 0);
    renderDash();
  };

  async function showDash(){
    document.getElementById('login-screen').style.display='none';
    document.getElementById('dashboard-screen').style.display='block';
    await renderDash();
  }

  async function renderDash(){
    document.getElementById('table-body').innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:#555550;padding:2rem">Chargement...</td></tr>';

    const { data, error } = await getClient()
      .from('candidatures').select('*').order('created_at', { ascending: false });

    if(error){
      document.getElementById('table-body').innerHTML =
        `<tr><td colspan="7" style="color:#F87171;padding:1rem">Erreur : ${error.message}</td></tr>`;
      return;
    }

    const total   = data.length;
    const attente = data.filter(c=>c.statut==='En attente'||c.statut==='En attente paiement').length;
    const payes   = data.filter(c=>c.statut==='Payé').length;

    document.getElementById('stats-row').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-val">${total}</div></div>
      <div class="stat-card"><div class="stat-label">En attente</div><div class="stat-val">${attente}</div></div>
      <div class="stat-card"><div class="stat-label">Payés</div><div class="stat-val" style="color:#34D399">${payes}</div></div>`;

    if(!data.length){
      document.getElementById('table-wrap').style.display='none';
      document.getElementById('empty-state').style.display='block';
      return;
    }
    document.getElementById('table-wrap').style.display='block';
    document.getElementById('empty-state').style.display='none';

    document.getElementById('table-body').innerHTML = data.map(c=>`
      <tr onclick="openDetail('${c.id}')">
        <td><strong>${c.nom}</strong><br><span style="font-size:11px;color:#777770">${c.email}</span></td>
        <td>${c.poste||'—'}</td>
        <td style="color:#777770;font-size:11px">${c.secteurs||'—'}</td>
        <td style="color:#777770">${c.ville||'—'}</td>
        <td><span style="font-size:11px;color:#8B5CF6;font-weight:600">${c.plan||'—'}</span></td>
        <td style="color:#777770">${fmtDate(c.created_at)}</td>
        <td><span class="badge ${badgeCls(c.statut)}">${c.statut}</span></td>
      </tr>`).join('');
  }

  window.openDetail = async function(id){
    const { data } = await getClient().from('candidatures').select('*').eq('id', id).single();
    if(!data) return;
    currentId = id;
    const genreLabel = data.genre === 'M' ? 'Masculin' : data.genre === 'F' ? 'Féminin' : 'Non précisé';
    document.getElementById('m-nom').textContent   = data.nom;
    document.getElementById('m-poste').textContent = data.poste||'—';
    document.getElementById('m-msg').textContent   = data.message||'(aucun message)';
    document.getElementById('m-fields').innerHTML = `
      <div class="modal-field"><span class="field-key">Email</span><span class="field-val">${data.email}</span></div>
      <div class="modal-field"><span class="field-key">Téléphone</span><span class="field-val">${data.tel||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Genre</span><span class="field-val">${genreLabel}</span></div>
      <div class="modal-field"><span class="field-key">Situation</span><span class="field-val">${data.situation||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Secteurs</span><span class="field-val">${data.secteurs||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Contrat</span><span class="field-val">${data.contrats||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Zone</span><span class="field-val">${data.ville||'—'} · ${data.rayon||''}</span></div>
      <div class="modal-field"><span class="field-key">Dispo à partir du</span><span class="field-val">${data.dispo_tot||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Dispo au plus tard</span><span class="field-val">${data.dispo_tard||'—'}</span></div>
      <div class="modal-field"><span class="field-key">CV</span><span class="field-val">${data.cv||'Non joint'}</span></div>
      <div class="modal-field"><span class="field-key">Offre</span><span class="field-val" style="color:#8B5CF6">${data.plan||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Statut</span><span class="field-val"><span class="badge ${badgeCls(data.statut)}">${data.statut}</span></span></div>`;
    document.getElementById('modal-overlay').classList.add('open');
  };

  window.closeModal = function(){
    document.getElementById('modal-overlay').classList.remove('open');
    currentId = null;
  };

  window.setStatut = async function(statut){
    if(!currentId) return;
    await getClient().from('candidatures').update({ statut }).eq('id', currentId);
    closeModal();
    renderDash();
  };
}
