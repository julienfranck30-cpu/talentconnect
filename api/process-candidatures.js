// api/process-candidatures.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const HUNTER_KEY      = process.env.HUNTER_API_KEY;
const BREVO_KEY       = process.env.BREVO_API_KEY;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;

const PLAN_VOLUMES = { '29€': 50, '59€': 150, '99€': 300 };

function getPlanVolume(plan) {
  for (const [key, vol] of Object.entries(PLAN_VOLUMES)) {
    if (plan && plan.includes(key)) return vol;
  }
  return 50;
}

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
    { name: 'Sodexo', domain: 'sodexo.com' },
    { name: 'Elior', domain: 'elior.com' },
    { name: 'Dupont Restauration', domain: 'dupont-restauration.fr' },
    { name: 'Ibis', domain: 'ibis.com' },
    { name: 'Novotel', domain: 'novotel.com' },
    { name: 'Mercure', domain: 'mercure.com' },
    { name: 'Hyatt France', domain: 'hyatt.com' },
    { name: 'Quick', domain: 'quick.fr' },
    { name: 'Pizza Hut France', domain: 'pizzahut.fr' },
    { name: 'Hippopotamus', domain: 'hippopotamus.fr' },
  ],
  'Éducation / Formation': [
    { name: 'Groupe IGS', domain: 'groupe-igs.fr' },
    { name: 'Groupe INSEEC', domain: 'inseec.com' },
    { name: 'KEDGE Business School', domain: 'kedge.edu' },
    { name: 'SKEMA', domain: 'skema.edu' },
    { name: 'EDHEC', domain: 'edhec.edu' },
    { name: 'EM Lyon', domain: 'emlyon.com' },
    { name: 'Grenoble École de Management', domain: 'grenoble-em.com' },
    { name: 'Cesi', domain: 'cesi.fr' },
    { name: 'Afpa', domain: 'afpa.fr' },
    { name: 'OpenClassrooms', domain: 'openclassrooms.com' },
    { name: 'Studi', domain: 'studi.fr' },
    { name: 'Cegos', domain: 'cegos.fr' },
    { name: 'Demos', domain: 'demos.fr' },
    { name: 'Comundi', domain: 'comundi.fr' },
    { name: 'EFE Formation', domain: 'efe.fr' },
    { name: 'Pigier', domain: 'pigier.com' },
    { name: 'Abilways', domain: 'abilways.fr' },
    { name: 'ISM', domain: 'ism.fr' },
    { name: 'Formaposte', domain: 'formaposte.fr' },
    { name: 'Groupe Sup de Co', domain: 'supdeco.fr' },
    { name: 'HEC Paris', domain: 'hec.edu' },
    { name: 'ESSEC', domain: 'essec.edu' },
    { name: 'ESCP', domain: 'escp.eu' },
    { name: 'CCI Formation', domain: 'cci.fr' },
    { name: 'Ionis Education', domain: 'ionis-education-group.com' },
  ],
  'Médias / Communication': [
    { name: 'TF1 Group', domain: 'tf1.fr' },
    { name: 'France Télévisions', domain: 'francetelevisions.fr' },
    { name: 'M6 Group', domain: 'm6.fr' },
    { name: 'Canal+', domain: 'canalplus.com' },
    { name: 'Radio France', domain: 'radiofrance.fr' },
    { name: 'RTL Group', domain: 'rtl.fr' },
    { name: 'Le Monde', domain: 'lemonde.fr' },
    { name: 'Le Figaro', domain: 'lefigaro.fr' },
    { name: 'Publicis', domain: 'publicisgroupe.com' },
    { name: 'Havas', domain: 'havas.com' },
    { name: 'BETC', domain: 'betc.com' },
    { name: 'Ogilvy France', domain: 'ogilvy.com' },
    { name: 'McCann France', domain: 'mccann.fr' },
    { name: 'DDB Paris', domain: 'ddb.fr' },
    { name: 'TBWA France', domain: 'tbwa.fr' },
    { name: 'Kantar France', domain: 'kantar.com' },
    { name: 'Ipsos France', domain: 'ipsos.fr' },
    { name: 'Nielsen France', domain: 'nielsen.com' },
    { name: 'Médiamétrie', domain: 'mediametrie.fr' },
    { name: 'Prisma Media', domain: 'prismamedia.com' },
    { name: 'Europe 1', domain: 'europe1.fr' },
    { name: 'Libération', domain: 'liberation.fr' },
    { name: 'Leo Burnett', domain: 'leoburnett.fr' },
    { name: 'Grey Paris', domain: 'grey.com' },
    { name: "L'Express", domain: 'lexpress.fr' },
  ],
  'Énergie / Environnement': [
    { name: 'EDF', domain: 'edf.fr' },
    { name: 'Engie', domain: 'engie.fr' },
    { name: 'TotalEnergies', domain: 'totalenergies.fr' },
    { name: 'Veolia', domain: 'veolia.fr' },
    { name: 'Suez', domain: 'suez.com' },
    { name: 'Enedis', domain: 'enedis.fr' },
    { name: 'GRTgaz', domain: 'grtgaz.com' },
    { name: 'GRDF', domain: 'grdf.fr' },
    { name: 'RTE', domain: 'rte-france.com' },
    { name: 'Voltalia', domain: 'voltalia.com' },
    { name: 'Neoen', domain: 'neoen.com' },
    { name: 'Akuo Energy', domain: 'akuo.energy' },
    { name: 'Boralex', domain: 'boralex.com' },
    { name: 'Engie Green', domain: 'engie-green.fr' },
    { name: 'EDF Renouvelables', domain: 'edf-renouvelables.com' },
    { name: 'Paprec', domain: 'paprec.com' },
    { name: 'Séché Environnement', domain: 'groupe-seche.com' },
    { name: 'Saur', domain: 'saur.fr' },
    { name: 'Dalkia', domain: 'dalkia.fr' },
    { name: 'Idex', domain: 'idex.fr' },
    { name: 'Storengy', domain: 'storengy.com' },
    { name: 'Valorem', domain: 'valorem.fr' },
    { name: 'Vattenfall France', domain: 'vattenfall.fr' },
    { name: 'Lyonnaise des Eaux', domain: 'lyonnaise-des-eaux.fr' },
    { name: 'Veolia Eau', domain: 'veolia.fr' },
  ],
  'Ressources Humaines': [
    { name: 'Manpower', domain: 'manpower.fr' },
    { name: 'Adecco', domain: 'adecco.fr' },
    { name: 'Randstad', domain: 'randstad.fr' },
    { name: 'Michael Page', domain: 'michaelpage.fr' },
    { name: 'Robert Half', domain: 'roberthalf.fr' },
    { name: 'Hays France', domain: 'hays.fr' },
    { name: 'Page Personnel', domain: 'pagepersonnel.fr' },
    { name: 'Fed Group', domain: 'fedgroup.fr' },
    { name: 'Expectra', domain: 'expectra.fr' },
    { name: 'Korn Ferry', domain: 'kornferry.com' },
    { name: 'Spencer Stuart', domain: 'spencerstuart.com' },
    { name: 'Altedia', domain: 'altedia.fr' },
    { name: 'BPI Group', domain: 'bpigroup.fr' },
    { name: 'Cegos', domain: 'cegos.fr' },
    { name: 'Mercer France', domain: 'mercer.fr' },
    { name: 'Aon Hewitt', domain: 'aon.fr' },
    { name: 'Adequat', domain: 'adequat-emploi.com' },
    { name: 'Synergie', domain: 'synergie.fr' },
    { name: 'Proman', domain: 'proman.fr' },
    { name: 'Groupe Crit', domain: 'groupecrit.fr' },
    { name: 'Ayming', domain: 'ayming.fr' },
    { name: 'Towers Watson', domain: 'willistowerswatson.com' },
    { name: 'Egon Zehnder', domain: 'egonzehnder.com' },
    { name: 'Odgers Berndtson', domain: 'odgersberndtson.com' },
    { name: 'Badenoch & Clark', domain: 'badenochandclark.fr' },
  ],
  'Conseil / Audit': [
    { name: 'Deloitte France', domain: 'deloitte.fr' },
    { name: 'PwC France', domain: 'pwc.fr' },
    { name: 'KPMG France', domain: 'kpmg.fr' },
    { name: 'EY France', domain: 'ey.com' },
    { name: 'McKinsey France', domain: 'mckinsey.com' },
    { name: 'BCG France', domain: 'bcg.com' },
    { name: 'Bain France', domain: 'bain.com' },
    { name: 'Roland Berger', domain: 'rolandberger.com' },
    { name: 'Oliver Wyman', domain: 'oliverwyman.com' },
    { name: 'AT Kearney', domain: 'kearney.com' },
    { name: 'Mazars', domain: 'mazars.fr' },
    { name: 'Grant Thornton', domain: 'grantthornton.fr' },
    { name: 'BDO France', domain: 'bdo.fr' },
    { name: 'Accuracy', domain: 'accuracy.com' },
    { name: 'Eight Advisory', domain: 'eight-advisory.com' },
    { name: 'Sia Partners', domain: 'sia-partners.com' },
    { name: 'Colombus Consulting', domain: 'colombus-consulting.com' },
    { name: 'Onepoint', domain: 'groupeonepoint.com' },
    { name: 'Wavestone', domain: 'wavestone.com' },
    { name: 'Kurt Salmon', domain: 'kurtsalmon.com' },
    { name: 'Devoteam', domain: 'devoteam.com' },
    { name: 'Solucom', domain: 'solucom.fr' },
    { name: 'Ailancy', domain: 'ailancy.com' },
    { name: 'Advolis', domain: 'advolis.com' },
    { name: 'Vertuo Conseil', domain: 'vertuo-conseil.fr' },
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
    if (data.data && data.data.emails) {
      return data.data.emails
        .filter(e => e.confidence > 70)
        .map(e => ({
          email: e.value,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim()
        }));
    }
  } catch(e) {
    console.error('Hunter error:', e.message);
  }
  return [];
}

async function generateLettre(candidat, company, secteur, contactName) {
  try {
    const prenom = contactName ? contactName.split(' ')[0] : null;
    const salutation = prenom ? `Bonjour ${prenom},` : 'Madame, Monsieur,';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Écris un email de candidature spontanée professionnel en français, dans le style suivant :

EXEMPLE DE STYLE :
"Bonjour monsieur Billau, Étudiant en Master 2 Achat et Approvisionnement à l'ECEMA Lyon, je suis à la recherche d'une alternance de 2 ans au rythme de 1 semaine de cours / 3 semaines en entreprise. Fort d'une expérience significative dans la gestion des achats et des stocks, je suis convaincu que mes compétences en digitalisation des processus, négociation avec les fournisseurs et optimisation des coûts pourraient être un atout pour votre entreprise. Mon parcours m'a permis de développer une approche rigoureuse et proactive face aux défis logistiques. Je suis persuadé que ma contribution pourrait soutenir [Entreprise] dans l'optimisation de ses processus d'approvisionnement. Je serais ravi de vous rencontrer pour discuter plus en détail de ma candidature. Vous trouverez mon CV en pièce jointe. Au plaisir de discuter avec vous prochainement."

INFORMATIONS DU CANDIDAT :
- Nom : ${candidat.nom}
- Poste visé : ${candidat.poste}
- Formation : Master Achats & Approvisionnements, ECEMA Lyon
- Secteurs : ${candidat.secteurs}
- Zone : ${candidat.ville}
- Type de contrat : ${candidat.contrats || 'CDI'}
- Message personnel : ${candidat.message || 'Non renseigné'}

ENTREPRISE CIBLÉE : ${company}
SECTEUR : ${secteur}
SALUTATION : ${salutation}

INSTRUCTIONS :
- Commence par "${salutation}"
- Présente la formation et le type de contrat
- Mentionne 2-3 compétences clés adaptées au secteur de ${company}
- Montre comment le candidat peut apporter de la valeur à ${company} spécifiquement
- Propose un entretien et mentionne le CV en pièce jointe
- Termine par une formule chaleureuse
- 150-200 mots maximum
- Réponds uniquement avec le corps du message, sans objet ni signature séparée`
        }]
      })
    });
    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch(e) {
    console.error('Claude error:', e.message);
    return null;
  }
}

async function sendCandidature(to, toName, company, secteur, candidat) {
  const lettre = await generateLettre(candidat, company, secteur, toName);

  const corps = lettre || `Madame, Monsieur,\n\nÉtudiant en Master Achats & Approvisionnements à l'ECEMA Lyon, je me permets de vous adresser ma candidature spontanée pour un poste de ${candidat.poste} au sein de ${company}.\n\nFort de mon expérience dans le secteur ${candidat.secteurs}, je serais ravi de contribuer au développement de votre entreprise.\n\nJe reste disponible pour un entretien.\n\nCordialement,`;

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.7;font-size:15px">
      ${corps.replace(/\n/g, '<br/>')}
      <br/><br/>
      <strong>${candidat.nom}</strong><br/>
      ${candidat.email}<br/>
      ${candidat.tel || ''}
    </div>`;

  // Télécharge le CV depuis Cloudinary et convertit en base64
  let attachments = [];
  if (candidat.cv_url) {
    try {
      const cvRes = await fetch(candidat.cv_url);
      const cvBuffer = await cvRes.arrayBuffer();
      const cvBase64 = Buffer.from(cvBuffer).toString('base64');
      const cvNom = candidat.cv || 'CV.pdf';
      attachments = [{
        content: cvBase64,
        name: cvNom,
        type: 'application/pdf'
      }];
    } catch(e) {
      console.error('CV download error:', e.message);
    }
  }

  try {
    const body = {
      sender: { name: candidat.nom, email: 'julienfranck30@gmail.com' },
      // ⚠️ MODE TEST — remplace par: to: [{ email: to, name: toName || company }]
      to: [{ email: 'julienfranck30@gmail.com', name: 'TEST' }],
      replyTo: { email: candidat.email, name: candidat.nom },
      subject: `Candidature spontanée – ${candidat.poste} | ${candidat.nom}`,
      htmlContent,
    };

    if (attachments.length > 0) {
      body.attachment = attachments;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY
      },
      body: JSON.stringify(body),
    });
    return res.ok;
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

    await sb.from('candidatures')
      .update({ statut: "En cours d'envoi" })
      .eq('id', candidat.id);

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
