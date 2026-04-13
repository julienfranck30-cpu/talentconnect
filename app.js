/* ── TalentConnect — app.js ── */

const STORAGE_KEY = 'tc_candidatures';
const ADMIN_USER  = 'admin';
const ADMIN_PASS  = 'admin123';
const TOTAL_STEPS = 6;

function loadData(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } }
function saveData(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
function fmtDate(iso){ return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function badgeCls(s){ return s==='Retenu'?'badge-retained':s==='Refusé'?'badge-rejected':'badge-pending'; }

/* ════════════════════════════════════
   FORMULAIRE MULTI-ÉTAPES (formulaire.html)
════════════════════════════════════ */
if(document.getElementById('step-1')){

  let currentStep = 1;
  let formData = { rayon: '100 km', plan: 'pro' };

  // Progress bar
  function setProgress(step){
    const pct = ((step-1)/(TOTAL_STEPS))*100;
    document.getElementById('progress-bar').style.width = pct + '%';
  }
  setProgress(1);

  // Chip sélection unique
  window.selectChip = function(el, group){
    document.querySelectorAll(`#chips-${group} .chip`).forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected');
    if(group==='poste') formData.poste = el.textContent;
    if(group==='rayon') formData.rayon = el.textContent;
    if(group==='contrat') formData.contrat = el.textContent;
  };

  // Chip multi-sélection
  window.toggleChip = function(el){
    el.classList.toggle('selected');
  };

  function getSelectedChips(containerId){
    return Array.from(document.querySelectorAll(`#${containerId} .chip.selected`)).map(c=>c.textContent);
  }

  // Navigation
  window.nextStep = function(from){
    const err = document.getElementById(`err-${from}`);
    err.textContent = '';

    if(from===1){
      const prenom = document.getElementById('s1-prenom').value.trim();
      const nom    = document.getElementById('s1-nom').value.trim();
      const tel    = document.getElementById('s1-tel').value.trim();
      const email  = document.getElementById('s1-email').value.trim();
      if(!prenom||!nom){ err.textContent='Prénom et nom obligatoires.'; return; }
      if(!email||!email.includes('@')){ err.textContent='Email invalide.'; return; }
      if(!tel){ err.textContent='Numéro de téléphone obligatoire.'; return; }
      formData.prenom=prenom; formData.nom=nom; formData.tel=tel; formData.email=email;
    }

    if(from===2){
      const custom = document.getElementById('s2-poste-custom').value.trim();
      if(custom) formData.poste = custom;
      if(!formData.poste){ err.textContent='Sélectionne ou précise un poste.'; return; }
    }

    if(from===3){
      const secteurs = getSelectedChips('chips-secteur');
      if(secteurs.length===0){ err.textContent='Sélectionne au moins un secteur.'; return; }
      formData.secteurs = secteurs;
    }

    if(from===4){
      const ville = document.getElementById('s4-ville').value.trim();
      if(!ville){ err.textContent='Indique une ville ou région.'; return; }
      formData.ville = ville;
      formData.rayon = formData.rayon || '100 km';
      formData.contrats = getSelectedChips('chips-contrat');
    }

    if(from===5){
      const cv = document.getElementById('cv-input').files[0];
      formData.cv = cv ? cv.name : null;
      formData.message = document.getElementById('s5-msg').value.trim();
    }

    if(from===6){ submitCampagne(); return; }

    goToStep(from+1);
  };

  window.prevStep = function(from){
    if(from>1) goToStep(from-1);
  };

  function goToStep(n){
    document.getElementById(`step-${currentStep}`).classList.remove('active');
    currentStep = n;
    const panel = document.getElementById(`step-${n}`);
    if(panel){ panel.classList.add('active'); }
    setProgress(n);
    if(n===6) buildRecap();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function buildRecap(){
    const r = document.getElementById('recap-card');
    r.innerHTML = `
      <strong>Candidat :</strong> ${formData.prenom} ${formData.nom}<br>
      <strong>Email :</strong> ${formData.email}<br>
      <strong>Poste visé :</strong> ${formData.poste||'—'}<br>
      <strong>Secteurs :</strong> ${(formData.secteurs||[]).join(', ')||'—'}<br>
      <strong>Zone :</strong> ${formData.ville||'—'} · ${formData.rayon}<br>
      <strong>Contrats :</strong> ${(formData.contrats||[]).join(', ')||'Non précisé'}<br>
      <strong>CV :</strong> ${formData.cv||'Non joint'}
    `;
  }

  window.selectPlan = function(el, plan){
    document.querySelectorAll('.price-card').forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected');
    formData.plan = plan;
  };
  // Sélection pro par défaut
  document.querySelectorAll('.price-card').forEach(c=>{
    if(c.querySelector('.plan-badge')?.textContent==='Pro') c.classList.add('selected');
  });

  // Upload CV
  document.getElementById('cv-input')?.addEventListener('change', function(){
    const file = this.files[0];
    if(file){
      document.getElementById('upload-zone').classList.add('has-file');
      document.getElementById('upload-label').textContent = '✓ ' + file.name;
    }
  });

  window.submitCampagne = function(){
    const err = document.getElementById('err-6');
    err.textContent = '';
    if(!document.getElementById('f-rgpd').checked){
      err.textContent = 'Vous devez accepter la politique de données (RGPD).';
      return;
    }

    const plans = { starter:'29€ – 50 candidatures', pro:'59€ – 150 candidatures', max:'99€ – 300 candidatures' };
    const data = loadData();
    data.push({
      id: Date.now(),
      nom: formData.prenom + ' ' + formData.nom,
      email: formData.email,
      tel: formData.tel,
      poste: formData.poste,
      secteurs: (formData.secteurs||[]).join(', '),
      ville: formData.ville,
      rayon: formData.rayon,
      contrats: (formData.contrats||[]).join(', '),
      cv: formData.cv,
      plan: plans[formData.plan]||formData.plan,
      message: formData.message,
      statut: 'En attente',
      date: new Date().toISOString()
    });
    saveData(data);

    // Affiche succès
    document.getElementById(`step-6`).classList.remove('active');
    document.getElementById('step-success').classList.add('active');
    document.getElementById('success-msg').textContent =
      `Merci ${formData.prenom} ! Ta campagne "${plans[formData.plan]}" est en cours de traitement.`;
    document.getElementById('progress-bar').style.width = '100%';
    window.scrollTo({top:0,behavior:'smooth'});
  };
}

/* ════════════════════════════════════
   ADMIN (admin.html)
════════════════════════════════════ */
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

  window.clearAll = function(){
    if(confirm('Effacer toutes les candidatures ?')){ saveData([]); renderDash(); }
  };

  function showDash(){
    document.getElementById('login-screen').style.display='none';
    document.getElementById('dashboard-screen').style.display='block';
    renderDash();
  }

  function renderDash(){
    const data = loadData();
    const total   = data.length;
    const attente = data.filter(c=>c.statut==='En attente').length;
    const retenus = data.filter(c=>c.statut==='Retenu').length;

    document.getElementById('stats-row').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-val">${total}</div></div>
      <div class="stat-card"><div class="stat-label">En attente</div><div class="stat-val">${attente}</div></div>
      <div class="stat-card"><div class="stat-label">Retenus</div><div class="stat-val">${retenus}</div></div>`;

    if(!data.length){
      document.getElementById('table-wrap').style.display='none';
      document.getElementById('empty-state').style.display='block';
      return;
    }
    document.getElementById('table-wrap').style.display='block';
    document.getElementById('empty-state').style.display='none';

    document.getElementById('table-body').innerHTML = data.map(c=>`
      <tr onclick="openDetail(${c.id})">
        <td><strong>${c.nom}</strong><br><span style="font-size:11px;color:#777770">${c.email}</span></td>
        <td>${c.poste||'—'}</td>
        <td style="color:#777770;font-size:11px">${c.secteurs||'—'}</td>
        <td style="color:#777770">${c.ville||'—'}</td>
        <td><span style="font-size:11px;color:#8B5CF6;font-weight:600">${c.plan||'—'}</span></td>
        <td style="color:#777770">${fmtDate(c.date)}</td>
        <td><span class="badge ${badgeCls(c.statut)}">${c.statut}</span></td>
      </tr>`).join('');
  }

  window.openDetail = function(id){
    const c = loadData().find(x=>x.id===id);
    if(!c) return;
    currentId = id;
    document.getElementById('m-nom').textContent   = c.nom;
    document.getElementById('m-poste').textContent = c.poste||'—';
    document.getElementById('m-msg').textContent   = c.message||'(aucun message)';
    document.getElementById('m-fields').innerHTML = `
      <div class="modal-field"><span class="field-key">Email</span><span class="field-val">${c.email}</span></div>
      <div class="modal-field"><span class="field-key">Téléphone</span><span class="field-val">${c.tel||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Secteurs</span><span class="field-val">${c.secteurs||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Zone</span><span class="field-val">${c.ville||'—'} · ${c.rayon||''}</span></div>
      <div class="modal-field"><span class="field-key">Contrats</span><span class="field-val">${c.contrats||'—'}</span></div>
      <div class="modal-field"><span class="field-key">CV</span><span class="field-val">${c.cv||'Non joint'}</span></div>
      <div class="modal-field"><span class="field-key">Offre</span><span class="field-val" style="color:#8B5CF6">${c.plan||'—'}</span></div>
      <div class="modal-field"><span class="field-key">Statut</span><span class="field-val"><span class="badge ${badgeCls(c.statut)}">${c.statut}</span></span></div>`;
    document.getElementById('modal-overlay').classList.add('open');
  };

  window.closeModal = function(){ document.getElementById('modal-overlay').classList.remove('open'); currentId=null; };

  window.setStatut = function(statut){
    if(!currentId) return;
    const data = loadData();
    const idx = data.findIndex(x=>x.id===currentId);
    if(idx!==-1){ data[idx].statut=statut; saveData(data); }
    closeModal(); renderDash();
  };
}
