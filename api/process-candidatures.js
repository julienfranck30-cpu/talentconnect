// api/process-candidatures.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const HUNTER_KEY      = process.env.HUNTER_API_KEY;
const BREVO_KEY       = process.env.BREVO_API_KEY;
const GEMINI_KEY      = process.env.GEMINI_API_KEY;

const PLAN_VOLUMES = { '29€': 50, '59€': 150, '99€': 300 };

function getPlanVolume(plan) {
  for (const [key, vol] of Object.entries(PLAN_VOLUMES)) {
    if (plan && plan.includes(key)) return vol;
  }
  return 50;
}

const FALLBACK_EMAILS = ['rh', 'recrutement', 'contact', 'jobs', 'carriere'];

const DOMAINES_PAR_SECTEUR = {
  'Distribution / Négoce': [
    { name: 'Sysco France', domain: 'sysco.fr' },
    { name: 'Metro France', domain: 'metro.fr' },
    { name: 'Pomona', domain: 'pomona.fr' },
    { name: 'Transgourmet', domain: 'transgourmet.fr' },
    { name: 'Pro à Pro', domain: 'proapro.fr' },
    { name: 'Brake France', domain: 'brake.fr' },
    { name: 'Promocash', domain: 'promocash.fr' },
    { name: 'Agrial', domain: 'agrial.fr' },
    { name: 'Euralis', domain: 'euralis.fr' },
    { name: 'Vivescia', domain: 'vivescia.com' },
    { name: 'Axéréal', domain: 'axereal.com' },
    { name: 'InVivo', domain: 'invivo-group.com' },
    { name: 'Soufflet', domain: 'soufflet.com' },
    { name: 'Limagrain', domain: 'limagrain.com' },
    { name: 'Biocoop', domain: 'biocoop.fr' },
    { name: 'Leclerc', domain: 'e.leclerc' },
    { name: 'Intermarché', domain: 'intermarche.com' },
    { name: 'Lidl France', domain: 'lidl.fr' },
    { name: 'Aldi France', domain: 'aldi.fr' },
    { name: 'Picard', domain: 'picard.fr' },
    { name: 'Labeyrie', domain: 'labeyrie.fr' },
    { name: 'Nicolas', domain: 'nicolas.com' },
    { name: 'Maïsadour', domain: 'maisadour.com' },
    { name: 'Arterris', domain: 'arterris.fr' },
    { name: 'Terrena', domain: 'terrena.fr' },
  ],
  'Industrie': [
    { name: 'Schneider Electric', domain: 'se.com' },
    { name: 'Saint-Gobain', domain: 'saint-gobain.com' },
    { name: 'Faurecia', domain: 'faurecia.com' },
    { name: 'Legrand', domain: 'legrand.fr' },
    { name: 'Plastic Omnium', domain: 'plasticomnium.com' },
    { name: 'Safran', domain: 'safran-group.com' },
    { name: 'Thales', domain: 'thalesgroup.com' },
    { name: 'Airbus', domain: 'airbus.com' },
    { name: 'Michelin', domain: 'michelin.fr' },
    { name: 'Valeo', domain: 'valeo.com' },
    { name: 'ArcelorMittal', domain: 'arcelormittal.com' },
    { name: 'Alstom', domain: 'alstom.com' },
    { name: 'Nexans', domain: 'nexans.com' },
    { name: 'Daher', domain: 'daher.com' },
    { name: 'Dassault Aviation', domain: 'dassault-aviation.com' },
    { name: 'Naval Group', domain: 'naval-group.com' },
    { name: 'Sika', domain: 'sika.fr' },
    { name: 'Lafarge', domain: 'lafarge.fr' },
    { name: 'Imerys', domain: 'imerys.com' },
    { name: 'Vallourec', domain: 'vallourec.com' },
    { name: 'Bosch France', domain: 'bosch.fr' },
    { name: 'Siemens France', domain: 'siemens.fr' },
    { name: 'SKF France', domain: 'skf.com' },
    { name: 'Forvia', domain: 'forvia.com' },
    { name: 'Constellium', domain: 'constellium.com' },
  ],
  'Automobile': [
    { name: 'Renault', domain: 'renault.fr' },
    { name: 'Stellantis', domain: 'stellantis.com' },
    { name: 'Norauto', domain: 'norauto.fr' },
    { name: 'Midas', domain: 'midas.fr' },
    { name: 'Speedy', domain: 'speedy.fr' },
    { name: 'Feu Vert', domain: 'feu-vert.fr' },
    { name: 'Euromaster', domain: 'euromaster.fr' },
    { name: 'Dekra', domain: 'dekra.fr' },
    { name: 'ALD Automotive', domain: 'aldautomotive.fr' },
    { name: 'Arval', domain: 'arval.fr' },
    { name: 'Toyota France', domain: 'toyota.fr' },
    { name: 'BMW France', domain: 'bmw.fr' },
    { name: 'Mercedes France', domain: 'mercedes-benz.fr' },
    { name: 'Peugeot', domain: 'peugeot.fr' },
    { name: 'Citroën', domain: 'citroen.fr' },
    { name: 'Dacia', domain: 'dacia.fr' },
    { name: 'Carglass', domain: 'carglass.fr' },
    { name: 'Autosphere', domain: 'autosphere.fr' },
    { name: 'Emil Frey', domain: 'emil-frey.fr' },
    { name: 'Aramis Auto', domain: 'aramisauto.com' },
    { name: 'Ford France', domain: 'ford.fr' },
    { name: 'Volkswagen France', domain: 'volkswagen.fr' },
    { name: 'Audi France', domain: 'audi.fr' },
    { name: 'DS Automobiles', domain: 'ds-automobiles.fr' },
    { name: 'Profil Plus', domain: 'profil-plus.fr' },
  ],
  'BTP / Construction': [
    { name: 'Vinci Construction', domain: 'vinci-construction.fr' },
    { name: 'Bouygues Construction', domain: 'bouygues-construction.com' },
    { name: 'Eiffage', domain: 'eiffage.com' },
    { name: 'NGE', domain: 'nge.fr' },
    { name: 'Colas', domain: 'colas.fr' },
    { name: 'Eurovia', domain: 'eurovia.com' },
    { name: 'Apave', domain: 'apave.com' },
    { name: 'Bureau Veritas', domain: 'bureauveritas.fr' },
    { name: 'Socotec', domain: 'socotec.fr' },
    { name: 'Egis', domain: 'egis.fr' },
    { name: 'Nexity', domain: 'nexity.fr' },
    { name: 'Bouygues Immobilier', domain: 'bouygues-immobilier.com' },
    { name: 'Fayat', domain: 'fayat.com' },
    { name: 'GSE', domain: 'gse.fr' },
    { name: 'Altarea', domain: 'altarea.com' },
    { name: 'Soprema', domain: 'soprema.fr' },
    { name: 'Mapei', domain: 'mapei.fr' },
    { name: 'Wienerberger', domain: 'wienerberger.fr' },
    { name: 'Razel-Bec', domain: 'razel-bec.com' },
    { name: 'Kaufman & Broad', domain: 'ketb.com' },
    { name: 'Icade', domain: 'icade.fr' },
    { name: 'CDC Habitat', domain: 'cdchabitat.fr' },
    { name: 'Parexgroup', domain: 'parexgroup.com' },
    { name: 'Demathieu Bard', domain: 'demathieu-bard.fr' },
    { name: 'Léon Grosse', domain: 'leon-grosse.fr' },
  ],
  'Logistique / Transport': [
    { name: 'Geodis', domain: 'geodis.com' },
    { name: 'XPO Logistics', domain: 'xpo.com' },
    { name: 'DB Schenker', domain: 'dbschenker.com' },
    { name: 'Kuehne Nagel', domain: 'kuehne-nagel.com' },
    { name: 'ID Logistics', domain: 'id-logistics.com' },
    { name: 'DHL France', domain: 'dhl.fr' },
    { name: 'Chronopost', domain: 'chronopost.fr' },
    { name: 'Mondial Relay', domain: 'mondialrelay.fr' },
    { name: 'FM Logistic', domain: 'fmlogistic.com' },
    { name: 'Bolloré Logistics', domain: 'bollore-logistics.com' },
    { name: 'CMA CGM', domain: 'cma-cgm.com' },
    { name: 'Transdev', domain: 'transdev.com' },
    { name: 'Keolis', domain: 'keolis.com' },
    { name: 'Heppner', domain: 'heppner.com' },
    { name: 'Dachser', domain: 'dachser.fr' },
    { name: 'Stef', domain: 'stef.com' },
    { name: 'Jungheinrich', domain: 'jungheinrich.fr' },
    { name: 'Manitou', domain: 'manitou.com' },
    { name: 'Vanderlande', domain: 'vanderlande.com' },
    { name: 'TNT France', domain: 'tnt.fr' },
    { name: 'Gefco', domain: 'gefco.net' },
    { name: 'Rhenus', domain: 'rhenus.fr' },
    { name: 'Fenwick', domain: 'fenwick.fr' },
    { name: 'Novatrans', domain: 'novatrans.fr' },
    { name: 'Swisslog', domain: 'swisslog.com' },
  ],
  'Agroalimentaire': [
    { name: 'Danone', domain: 'danone.com' },
    { name: 'Lactalis', domain: 'lactalis.fr' },
    { name: 'Bigard', domain: 'bigard.fr' },
    { name: 'Savencia', domain: 'savencia.com' },
    { name: 'Bonduelle', domain: 'bonduelle.fr' },
    { name: 'Fleury Michon', domain: 'fleurymichon.fr' },
    { name: 'Cooperl', domain: 'cooperl.com' },
    { name: 'Bel', domain: 'groupe-bel.com' },
    { name: 'Sodiaal', domain: 'sodiaal.fr' },
    { name: 'Materne', domain: 'materne.fr' },
    { name: 'Andros', domain: 'andros.fr' },
    { name: 'McCain', domain: 'mccain.fr' },
    { name: 'Lindt', domain: 'lindt.fr' },
    { name: 'Ferrero France', domain: 'ferrero.fr' },
    { name: 'Mars France', domain: 'mars.com' },
    { name: 'Mondelez', domain: 'mondelezinternational.com' },
    { name: 'Haribo', domain: 'haribo.fr' },
    { name: 'Elle & Vire', domain: 'elle-vire.com' },
    { name: 'Entremont', domain: 'entremont.com' },
    { name: 'Elivia', domain: 'elivia.fr' },
    { name: 'Cofigeo', domain: 'cofigeo.fr' },
    { name: 'Lamb Weston', domain: 'lambweston.com' },
    { name: 'Candia', domain: 'candia.fr' },
    { name: 'Yoplait', domain: 'yoplait.fr' },
    { name: 'Panzani', domain: 'panzani.fr' },
  ],
  'Retail / Commerce': [
    { name: 'Carrefour', domain: 'carrefour.fr' },
    { name: 'Leroy Merlin', domain: 'leroymerlin.fr' },
    { name: 'Decathlon', domain: 'decathlon.fr' },
    { name: 'Fnac Darty', domain: 'fnacdarty.com' },
    { name: 'Maisons du Monde', domain: 'maisonsdumonde.com' },
    { name: 'Zara France', domain: 'zara.com' },
    { name: 'H&M France', domain: 'hm.com' },
    { name: 'Kiabi', domain: 'kiabi.com' },
    { name: 'La Redoute', domain: 'laredoute.fr' },
    { name: 'Ikea France', domain: 'ikea.com' },
    { name: 'Castorama', domain: 'castorama.fr' },
    { name: 'Brico Dépôt', domain: 'bricodepot.fr' },
    { name: 'Darty', domain: 'darty.com' },
    { name: 'Boulanger', domain: 'boulanger.com' },
    { name: 'Sephora', domain: 'sephora.fr' },
    { name: 'Yves Rocher', domain: 'yves-rocher.fr' },
    { name: "L'Occitane", domain: 'loccitane.com' },
    { name: 'Cultura', domain: 'cultura.com' },
    { name: 'Jules', domain: 'jules.com' },
    { name: 'Optic 2000', domain: 'optic2000.com' },
    { name: 'Krys', domain: 'krys.com' },
    { name: 'Afflelou', domain: 'afflelou.com' },
    { name: 'But', domain: 'but.fr' },
    { name: 'Conforama', domain: 'conforama.fr' },
    { name: 'King Jouet', domain: 'king-jouet.com' },
  ],
  'Services B2B': [
    { name: 'Sodexo', domain: 'sodexo.com' },
    { name: 'Edenred', domain: 'edenred.fr' },
    { name: 'Manpower', domain: 'manpower.fr' },
    { name: 'Adecco', domain: 'adecco.fr' },
    { name: 'Randstad', domain: 'randstad.fr' },
    { name: 'Synergie', domain: 'synergie.fr' },
    { name: 'Proman', domain: 'proman.fr' },
    { name: 'Samsic', domain: 'samsic.fr' },
    { name: 'Elior', domain: 'elior.com' },
    { name: 'Atalian', domain: 'atalian.fr' },
    { name: 'Onet', domain: 'onet.fr' },
    { name: 'Veolia', domain: 'veolia.fr' },
    { name: 'Engie', domain: 'engie.fr' },
    { name: 'TotalEnergies', domain: 'totalenergies.fr' },
    { name: 'EDF', domain: 'edf.fr' },
    { name: 'Dalkia', domain: 'dalkia.fr' },
    { name: 'Spie', domain: 'spie.com' },
    { name: 'Axians', domain: 'axians.fr' },
    { name: 'Securitas', domain: 'securitas.fr' },
    { name: 'Prosegur', domain: 'prosegur.fr' },
    { name: 'Ortec', domain: 'ortec.fr' },
    { name: 'ISS France', domain: 'issworld.com' },
    { name: 'Compass Group', domain: 'compass-group.fr' },
    { name: 'Derichebourg', domain: 'derichebourg.com' },
    { name: 'Bouygues Energies', domain: 'bouygues-es.com' },
  ],
  'Tech / Numérique': [
    { name: 'Capgemini', domain: 'capgemini.com' },
    { name: 'Sopra Steria', domain: 'soprasteria.com' },
    { name: 'Atos', domain: 'atos.net' },
    { name: 'CGI', domain: 'cgi.com' },
    { name: 'Wavestone', domain: 'wavestone.com' },
    { name: 'Accenture France', domain: 'accenture.com' },
    { name: 'IBM France', domain: 'ibm.com' },
    { name: 'SAP France', domain: 'sap.com' },
    { name: 'Microsoft France', domain: 'microsoft.com' },
    { name: 'Dassault Systèmes', domain: 'dassault-systemes.com' },
    { name: 'OVHcloud', domain: 'ovhcloud.com' },
    { name: 'Devoteam', domain: 'devoteam.com' },
    { name: 'Alten', domain: 'alten.fr' },
    { name: 'Cegid', domain: 'cegid.com' },
    { name: 'Generix Group', domain: 'generixgroup.com' },
    { name: 'Ivalua', domain: 'ivalua.com' },
    { name: 'Inetum', domain: 'inetum.com' },
    { name: 'Econocom', domain: 'econocom.com' },
    { name: 'Aubay', domain: 'aubay.com' },
    { name: 'Axway', domain: 'axway.com' },
    { name: 'Criteo', domain: 'criteo.com' },
    { name: 'Talend', domain: 'talend.com' },
    { name: 'Sage France', domain: 'sage.com' },
    { name: 'SCC France', domain: 'scc.com' },
    { name: 'Berger-Levrault', domain: 'berger-levrault.com' },
  ],
  'Santé / Pharma': [
    { name: 'Sanofi', domain: 'sanofi.com' },
    { name: 'Pierre Fabre', domain: 'pierre-fabre.com' },
    { name: 'Ipsen', domain: 'ipsen.com' },
    { name: 'Servier', domain: 'servier.fr' },
    { name: 'Biomérieux', domain: 'biomerieux.fr' },
    { name: 'Boiron', domain: 'boiron.fr' },
    { name: 'Urgo', domain: 'urgo.fr' },
    { name: 'Coloplast', domain: 'coloplast.fr' },
    { name: 'Baxter', domain: 'baxter.fr' },
    { name: 'Roche France', domain: 'roche.fr' },
    { name: 'Novartis France', domain: 'novartis.fr' },
    { name: 'Pfizer France', domain: 'pfizer.fr' },
    { name: 'AstraZeneca France', domain: 'astrazeneca.fr' },
    { name: 'Abbvie France', domain: 'abbvie.fr' },
    { name: 'Gilead France', domain: 'gilead.fr' },
    { name: 'Takeda France', domain: 'takeda.com' },
    { name: 'UCB Pharma', domain: 'ucb.com' },
    { name: 'Arkopharma', domain: 'arkopharma.fr' },
    { name: 'Weleda', domain: 'weleda.fr' },
    { name: 'Cooper', domain: 'cooper.fr' },
    { name: 'Biocodex', domain: 'biocodex.fr' },
    { name: 'Fresenius', domain: 'fresenius.fr' },
    { name: 'B. Braun', domain: 'bbraun.fr' },
    { name: 'Hartmann', domain: 'hartmann.fr' },
    { name: 'Guerbet', domain: 'guerbet.com' },
  ],
  'Finance / Banque': [
    { name: 'BNP Paribas', domain: 'bnpparibas.fr' },
    { name: 'Société Générale', domain: 'societegenerale.fr' },
    { name: 'Crédit Agricole', domain: 'credit-agricole.fr' },
    { name: 'Crédit Mutuel', domain: 'creditmutuel.fr' },
    { name: 'La Banque Postale', domain: 'labanquepostale.fr' },
    { name: "Caisse d'Épargne", domain: 'caisse-epargne.fr' },
    { name: 'Banque Populaire', domain: 'banquepopulaire.fr' },
    { name: 'AXA France', domain: 'axa.fr' },
    { name: 'Allianz France', domain: 'allianz.fr' },
    { name: 'Groupama', domain: 'groupama.fr' },
    { name: 'Natixis', domain: 'natixis.com' },
    { name: 'Amundi', domain: 'amundi.fr' },
    { name: 'Malakoff Humanis', domain: 'malakoffhumanis.fr' },
    { name: 'Generali France', domain: 'generali.fr' },
    { name: 'Maif', domain: 'maif.fr' },
    { name: 'Macif', domain: 'macif.fr' },
    { name: 'BPCE', domain: 'bpce.fr' },
    { name: 'LCL', domain: 'lcl.fr' },
    { name: 'CIC', domain: 'cic.fr' },
    { name: 'Boursorama', domain: 'boursorama.com' },
    { name: 'ING Direct', domain: 'ing.fr' },
    { name: 'April', domain: 'april.fr' },
    { name: 'Covéa', domain: 'covea.fr' },
    { name: 'Fortuneo', domain: 'fortuneo.fr' },
    { name: 'Crédit du Nord', domain: 'credit-du-nord.fr' },
  ],
  'Immobilier': [
    { name: 'Nexity', domain: 'nexity.fr' },
    { name: 'Orpi', domain: 'orpi.com' },
    { name: 'Century 21', domain: 'century21.fr' },
    { name: 'Era Immobilier', domain: 'era-immobilier.fr' },
    { name: 'Guy Hoquet', domain: 'guy-hoquet.com' },
    { name: 'Laforêt', domain: 'laforet.com' },
    { name: 'Foncia', domain: 'foncia.com' },
    { name: 'Citya', domain: 'citya.com' },
    { name: 'Icade', domain: 'icade.fr' },
    { name: 'Altarea', domain: 'altarea.com' },
    { name: 'Unibail-Rodamco', domain: 'urw.com' },
    { name: 'Klepierre', domain: 'klepierre.com' },
    { name: 'Gecina', domain: 'gecina.fr' },
    { name: 'Covivio', domain: 'covivio.eu' },
    { name: 'Primonial', domain: 'primonial.fr' },
    { name: 'Vinci Immobilier', domain: 'vinci-immobilier.com' },
    { name: 'Kaufman & Broad', domain: 'ketb.com' },
    { name: 'Bouygues Immobilier', domain: 'bouygues-immobilier.com' },
    { name: 'Cogedim', domain: 'cogedim.com' },
    { name: 'Eiffage Immobilier', domain: 'eiffage-immobilier.com' },
    { name: 'Bassac', domain: 'bassac.fr' },
    { name: 'Perial', domain: 'perial.com' },
    { name: 'Sergic', domain: 'sergic.fr' },
    { name: 'Sogeprom', domain: 'sogeprom.fr' },
    { name: 'CDC Habitat', domain: 'cdchabitat.fr' },
  ],
  'Hôtellerie / Restauration': [
    { name: 'Accor', domain: 'accor.com' },
    { name: 'Louvre Hotels', domain: 'louvrehotels.com' },
    { name: 'B&B Hotels', domain: 'hotel-bb.com' },
    { name: 'Marriott France', domain: 'marriott.fr' },
    { name: 'Hilton France', domain: 'hilton.com' },
    { name: "McDonald's France", domain: 'mcdonalds.fr' },
    { name: 'Burger King France', domain: 'burgerking.fr' },
    { name: 'KFC France', domain: 'kfc.fr' },
    { name: "Domino's Pizza", domain: 'dominos.fr' },
    { name: 'Flunch', domain: 'flunch.fr' },
    { name: 'Courtepaille', domain: 'courtepaille.com' },
    { name: 'Groupe Flo', domain: 'groupeflo.fr' },
    { name: 'Areas', domain: 'areas.com' },
    { name: 'Newrest', domain: 'newrest.eu' },
    { name: 'Api Restauration', domain: 'api-restauration.com' },
    { name: 'Elior', domain: 'elior.com' },
    { name: 'Ibis', domain: 'ibis.com' },
    { name: 'Novotel', domain: 'novotel.com' },
    { name: 'Mercure', domain: 'mercure.com' },
    { name: 'Hyatt France', domain: 'hyatt.com' },
  ],
  'Éducation / Formation': [
    { name: 'Groupe IGS', domain: 'groupe-igs.fr' },
    { name: 'Groupe INSEEC', domain: 'inseec.com' },
    { name: 'KEDGE Business School', domain: 'kedge.edu' },
    { name: 'SKEMA', domain: 'skema.edu' },
    { name: 'EDHEC', domain: 'edhec.edu' },
    { name: 'EM Lyon', domain: 'emlyon.com' },
    { name: 'Cesi', domain: 'cesi.fr' },
    { name: 'Afpa', domain: 'afpa.fr' },
    { name: 'OpenClassrooms', domain: 'openclassrooms.com' },
    { name: 'Cegos', domain: 'cegos.fr' },
  ],
  'Énergie / Environnement': [
    { name: 'EDF', domain: 'edf.fr' },
    { name: 'Engie', domain: 'engie.fr' },
    { name: 'TotalEnergies', domain: 'totalenergies.fr' },
    { name: 'Veolia', domain: 'veolia.fr' },
    { name: 'Suez', domain: 'suez.com' },
    { name: 'Enedis', domain: 'enedis.fr' },
    { name: 'Voltalia', domain: 'voltalia.com' },
    { name: 'Neoen', domain: 'neoen.com' },
    { name: 'Paprec', domain: 'paprec.com' },
    { name: 'Dalkia', domain: 'dalkia.fr' },
  ],
  'Ressources Humaines': [
    { name: 'Manpower', domain: 'manpower.fr' },
    { name: 'Adecco', domain: 'adecco.fr' },
    { name: 'Randstad', domain: 'randstad.fr' },
    { name: 'Michael Page', domain: 'michaelpage.fr' },
    { name: 'Hays France', domain: 'hays.fr' },
    { name: 'Fed Group', domain: 'fedgroup.fr' },
    { name: 'Expectra', domain: 'expectra.fr' },
    { name: 'Synergie', domain: 'synergie.fr' },
    { name: 'Proman', domain: 'proman.fr' },
    { name: 'Groupe Crit', domain: 'groupecrit.fr' },
  ],
  'Conseil / Audit': [
    { name: 'Deloitte France', domain: 'deloitte.fr' },
    { name: 'PwC France', domain: 'pwc.fr' },
    { name: 'KPMG France', domain: 'kpmg.fr' },
    { name: 'EY France', domain: 'ey.com' },
    { name: 'McKinsey France', domain: 'mckinsey.com' },
    { name: 'BCG France', domain: 'bcg.com' },
    { name: 'Mazars', domain: 'mazars.fr' },
    { name: 'Grant Thornton', domain: 'grantthornton.fr' },
    { name: 'Wavestone', domain: 'wavestone.com' },
    { name: 'Sia Partners', domain: 'sia-partners.com' },
  ],
};

async function findCompanies(secteur, limit) {
  const liste = DOMAINES_PAR_SECTEUR[secteur] || [];
  return liste.slice(0, limit);
}

async function searchEmails(domain) {
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_KEY}&limit=3&type=personal`
    );
    const data = await res.json();
    if (data.data && data.data.emails && data.data.emails.length > 0) {
      const filtered = data.data.emails
        .filter(e => e.confidence > 70)
        .map(e => ({
          email: e.value,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim()
        }));
      if (filtered.length > 0) return filtered;
    }
  } catch(e) {
    console.error('Hunter error:', e.message);
  }
  console.log(`Hunter: 0 résultat pour ${domain} — utilisation fallback générique`);
  return FALLBACK_EMAILS.slice(0, 2).map(prefix => ({
    email: `${prefix}@${domain}`,
    name: ''
  }));
}

async function generateLettre(candidat, company, secteur, contactName) {
  try {
    const prenom = contactName ? contactName.split(' ')[0] : null;
    const salutation = prenom ? `Madame, Monsieur ${prenom},` : 'Madame, Monsieur,';
    const contrat = candidat.contrats || 'CDI';
    const isAlternance = contrat.toLowerCase().includes('alternance');
    const isStage = contrat.toLowerCase().includes('stage');
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const cvContext = candidat.cv_texte
      ? `\nCONTENU DU CV DU CANDIDAT (utilise ces infos pour personnaliser) :\n${candidat.cv_texte}\n`
      : '';

    let contratInfo = '';
    if (isAlternance) {
      contratInfo = `Le coût de cette alternance serait réduit pour votre société grâce au plan d'aide à l'apprentissage. Votre OPCO prendra en charge tout ou partie des frais de scolarité ainsi qu'une part de mon salaire à hauteur de 5 000€.`;
    } else if (isStage) {
      contratInfo = `Je recherche un stage de fin d'études dans le cadre de ma formation.`;
    }

    const prompt = `Tu es expert en rédaction de lettres de motivation professionnelles en français. Génère une lettre complète en remplissant ce modèle avec les informations réelles du candidat.

MODÈLE À UTILISER (remplace tous les crochets [] par du contenu réel) :
---
${candidat.nom}
${candidat.tel || ''}
${candidat.email || ''}

À l'attention du Responsable du Recrutement
${company}

À ${candidat.ville || 'Lyon'}, le ${today}

Objet : Candidature spontanée – ${contrat} – ${candidat.poste}

${salutation}

C'est avec un grand intérêt que je suis l'évolution de ${company}, notamment pour [citer un aspect concret de l'entreprise lié au secteur ${secteur}]. Souhaitant mettre mes compétences au service d'une structure reconnue dans le secteur ${secteur}, je vous adresse ma candidature spontanée pour un poste de ${candidat.poste}.

Actuellement [situation actuelle tirée du CV : formation / poste / diplôme], j'ai développé une expertise en [Compétence 1 tirée du CV] et [Compétence 2 tirée du CV]. Mon parcours m'a permis de cultiver une grande capacité d'adaptation et un sens de l'initiative que je souhaite mobiliser au sein de vos équipes.

Intégrer ${company} représente pour moi l'opportunité de contribuer à vos futurs succès, qu'il s'agisse de [citer une mission concrète adaptée au secteur ${secteur}]. [Qualité personnelle tirée du CV], je suis prêt(e) à m'investir pleinement dans les missions que vous pourriez me confier.${contratInfo ? '\n\n' + contratInfo : ''}

Je serais ravi(e) de vous exposer plus en détail mes motivations lors d'un entretien à votre convenance.

Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

${candidat.nom}
${candidat.tel || ''}
---

INFORMATIONS DU CANDIDAT :
- Nom : ${candidat.nom}
- Poste visé : ${candidat.poste}
- Contrat : ${contrat}
- Ville : ${candidat.ville}
- Message : ${candidat.message || 'Non renseigné'}
${cvContext}
RÈGLES STRICTES :
- Remplace TOUS les crochets [] par du contenu réel et pertinent
- Utilise les infos du CV pour les compétences, la formation, la situation actuelle
- Ne laisse aucun crochet dans la réponse finale
- Réponds UNIQUEMENT avec la lettre complète, rien d'autre avant ou après`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
      })
    });
    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data).slice(0, 300));
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch(e) {
    console.error('Gemini error:', e.message);
    return null;
  }
}

async function sendCandidature(to, toName, company, secteur, candidat) {
  const lettre = await generateLettre(candidat, company, secteur, toName);

  const contrat = candidat.contrats || 'CDI';
  const corps = lettre || `Madame, Monsieur,\n\nJe me permets de vous adresser ma candidature spontanée pour un poste de ${candidat.poste} au sein de ${company}.\n\nJe reste disponible pour un entretien.\n\nCordialement,\n${candidat.nom}\n${candidat.tel || ''}`;

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#333;line-height:1.8;font-size:15px">
      ${corps.replace(/\n/g, '<br/>')}
    </div>`;

  let attachments = [];
  if (candidat.cv_url) {
    try {
      const cvRes = await fetch(candidat.cv_url);
      if (cvRes.ok) {
        const cvBuffer = await cvRes.arrayBuffer();
        if (cvBuffer.byteLength > 0) {
          const cvBase64 = Buffer.from(cvBuffer).toString('base64');
          const cvNom = candidat.cv || 'CV.pdf';
          attachments = [{ content: cvBase64, name: cvNom, type: 'application/pdf' }];
          console.log(`CV chargé: ${cvNom} (${cvBuffer.byteLength} bytes)`);
        } else {
          console.error('CV vide — byteLength = 0');
        }
      } else {
        console.error(`CV fetch failed: HTTP ${cvRes.status}`);
      }
    } catch(e) {
      console.error('CV download error:', e.message);
    }
  }

  try {
    const body = {
      sender: { name: 'TalentConnect', email: 'julienfranck30@gmail.com' },
      // ⚠️ MODE TEST — pour production remplacer par: to: [{ email: to, name: toName || company }],
      to: [{ email: 'julienfranck30@gmail.com', name: 'TEST' }],
      replyTo: { email: candidat.email, name: candidat.nom },
      subject: `Candidature spontanée – ${candidat.poste} | ${candidat.nom} → ${company}`,
      htmlContent,
    };

    if (attachments.length > 0) {
      body.attachment = attachments;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Brevo error ${res.status}: ${errText}`);
      return false;
    }
    return true;
  } catch(e) {
    console.error('Brevo error:', e.message);
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SECRET);

  const { data: candidatures, error } = await sb
    .from('candidatures')
    .select('*')
    .eq('statut', 'Payé')
    .order('created_at', { ascending: true })
    .limit(3);

  if (error) {
    console.error('Supabase error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!candidatures?.length) {
    console.log('Aucune candidature à traiter');
    return res.status(200).json({ processed: 0 });
  }

  let totalProcessed = 0;

  for (const candidat of candidatures) {
    const volume = getPlanVolume(candidat.plan);
    const secteurs = candidat.secteurs
      ? candidat.secteurs.split(',').map(s => s.trim())
      : [];

    console.log(`Traitement de ${candidat.nom} — ${volume} envois`);

    await sb.from('candidatures').update({ statut: "En cours d'envoi" }).eq('id', candidat.id);

    let totalSent = 0;

    for (const secteur of secteurs) {
      if (totalSent >= volume) break;
      const companies = await findCompanies(secteur, Math.min(volume - totalSent, 10));

      for (const company of companies) {
        if (totalSent >= volume) break;
        const contacts = await searchEmails(company.domain);
        for (const contact of contacts) {
          if (totalSent >= volume) break;
          const sent = await sendCandidature(contact.email, contact.name, company.name, secteur, candidat);
          if (sent) {
            totalSent++;
            console.log(`Envoyé à ${contact.email} (${company.name}) — total: ${totalSent}`);
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }

    await sb.from('candidatures').update({
      statut: 'Envoyé',
      message: (candidat.message || '') + `\n\n[AUTO] ${totalSent} candidatures envoyées le ${new Date().toLocaleDateString('fr-FR')}`
    }).eq('id', candidat.id);

    console.log(`Terminé: ${totalSent}/${volume} pour ${candidat.nom}`);
    totalProcessed++;
  }

  return res.status(200).json({ processed: totalProcessed });
};
