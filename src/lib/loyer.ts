// Loyers médians mensuels estimés en €/m²/mois, par code postal
// Sources : CLAMEUR, OLAP, observatoires locaux (données 2023-2024)
// Utilisé comme valeur par défaut dans le simulateur LMNP

const LOYER_MEDIAN_PAR_CP: Record<string, number> = {
  // Paris intra-muros
  '75001': 31, '75002': 30, '75003': 30, '75004': 31,
  '75005': 29, '75006': 32, '75007': 31, '75008': 32,
  '75009': 29, '75010': 26, '75011': 26, '75012': 25,
  '75013': 24, '75014': 26, '75015': 26, '75016': 28,
  '75017': 27, '75018': 25, '75019': 23, '75020': 23,

  // Hauts-de-Seine (92)
  '92100': 22, // Boulogne-Billancourt
  '92200': 19, // Neuilly-sur-Seine → loyer élevé mais petit surface = €/m² similaire
  '92110': 19, // Clichy
  '92120': 20, // Montrouge
  '92130': 21, // Issy-les-Moulineaux
  '92140': 20, // Clamart
  '92150': 18, // Suresnes
  '92160': 19, // Antony
  '92190': 18, // Meudon
  '92220': 16, // Bagneux
  '92230': 17, // Gennevilliers
  '92240': 18, // Malakoff
  '92250': 15, // La Garenne-Colombes
  '92260': 16, // Fontenay-aux-Roses
  '92270': 18, // Bois-Colombes
  '92300': 18, // Levallois-Perret
  '92320': 17, // Châtillon
  '92330': 17, // Sceaux
  '92340': 16, // Bourg-la-Reine
  '92350': 15, // Le Plessis-Robinson
  '92360': 16, // Meudon-la-Forêt
  '92370': 17, // Chaville
  '92380': 17, // Garches
  '92390': 17, // Villeneuve-la-Garenne
  '92400': 18, // Courbevoie
  '92410': 15, // Ville-d'Avray
  '92420': 16, // Vaucresson
  '92430': 14, // Marnes-la-Coquette
  '92500': 19, // Rueil-Malmaison
  '92600': 17, // Asnières-sur-Seine
  '92700': 16, // Colombes
  '92800': 16, // Puteaux

  // Seine-Saint-Denis (93)
  '93100': 16, // Montreuil
  '93110': 15, // Rosny-sous-Bois
  '93120': 14, // La Courneuve
  '93130': 14, // Noisy-le-Sec
  '93140': 16, // Bondy
  '93150': 13, // Le Blanc-Mesnil
  '93160': 14, // Noisy-le-Grand
  '93170': 13, // Bagnolet
  '93190': 13, // Livry-Gargan
  '93200': 14, // Saint-Denis
  '93210': 13, // Saint-Denis
  '93220': 14, // Gagny
  '93230': 13, // Romainville
  '93240': 14, // Stains
  '93250': 14, // Villemomble
  '93260': 13, // Les Lilas
  '93270': 13, // Sevran
  '93290': 13, // Tremblay-en-France
  '93300': 14, // Aubervilliers
  '93310': 14, // Le Pré-Saint-Gervais
  '93320': 14, // Les Pavillons-sous-Bois
  '93330': 14, // Neuilly-sur-Marne
  '93340': 14, // Le Raincy
  '93350': 14, // Le Bourget
  '93360': 13, // Neuilly-Plaisance
  '93370': 13, // Montfermeil
  '93380': 14, // Pierrefitte-sur-Seine
  '93390': 14, // Clichy-sous-Bois
  '93400': 13, // Saint-Ouen
  '93410': 13, // Vaujours
  '93420': 14, // Villepinte
  '93430': 14, // Villetaneuse
  '93440': 12, // Dugny
  '93450': 13, // Île-Saint-Denis
  '93460': 12, // Gournay-sur-Marne
  '93470': 12, // Coubron
  '93600': 14, // Aulnay-sous-Bois
  '93700': 14, // Drancy

  // Val-de-Marne (94)
  '94000': 17, // Créteil
  '94100': 19, // Saint-Maur-des-Fossés
  '94110': 18, // Arcueil
  '94120': 17, // Fontenay-sous-Bois
  '94130': 16, // Nogent-sur-Marne
  '94140': 18, // Alfortville
  '94150': 18, // Rungis
  '94160': 18, // Saint-Mandé
  '94170': 17, // Le Perreux-sur-Marne
  '94190': 18, // Villeneuve-Saint-Georges
  '94200': 19, // Ivry-sur-Seine
  '94210': 17, // La Varenne-Saint-Hilaire
  '94220': 18, // Charenton-le-Pont
  '94230': 17, // Cachan
  '94240': 17, // L'Haÿ-les-Roses
  '94250': 17, // Gentilly
  '94260': 17, // Fresnes
  '94270': 17, // Le Kremlin-Bicêtre
  '94290': 16, // Villeneuve-le-Roi
  '94300': 17, // Vincennes
  '94310': 15, // Orly
  '94320': 16, // Thiais
  '94340': 17, // Joinville-le-Pont
  '94350': 17, // Villiers-sur-Marne
  '94360': 16, // Bry-sur-Marne
  '94370': 15, // Sucy-en-Brie
  '94380': 16, // Bonneuil-sur-Marne
  '94390': 16, // Ormesson-sur-Marne
  '94400': 19, // Vitry-sur-Seine
  '94410': 16, // Saint-Maurice
  '94420': 15, // Le Plessis-Trévise
  '94430': 15, // Chennevières-sur-Marne
  '94440': 15, // Santeny
  '94450': 15, // Limeil-Brévannes
  '94460': 15, // Valenton
  '94470': 16, // Boissy-Saint-Léger
  '94480': 15, // Ablon-sur-Seine
  '94490': 15, // Villecresnes
  '94500': 17, // Champigny-sur-Marne
  '94510': 15, // La Queue-en-Brie
  '94520': 15, // Mandres-les-Roses
  '94550': 15, // Chevilly-Larue
  '94600': 18, // Choisy-le-Roi
  '94700': 17, // Maisons-Alfort
  '94800': 17, // Villejuif

  // Grandes villes de province
  '06000': 20, '06100': 19, '06200': 18, '06300': 17, // Nice et alentours
  '13001': 16, '13002': 15, '13003': 14, '13004': 15,
  '13005': 15, '13006': 16, '13007': 17, '13008': 16,
  '13009': 14, '13010': 14, '13011': 13, '13012': 13,
  '13013': 12, '13014': 12, '13015': 12, '13016': 12, // Marseille
  '31000': 14, '31100': 13, '31200': 13, '31300': 13,
  '31400': 13, '31500': 12, // Toulouse
  '33000': 16, '33100': 14, '33200': 15, '33300': 14,
  '33400': 13, '33500': 12, '33600': 12, '33700': 13, // Bordeaux
  '34000': 14, '34070': 13, '34080': 13, '34090': 14, // Montpellier
  '35000': 14, '35200': 13, // Rennes
  '38000': 14, '38100': 12, // Grenoble
  '44000': 15, '44100': 14, '44200': 13, '44300': 13, // Nantes
  '45000': 12, '45100': 11, // Orléans
  '49000': 12, '49100': 11, // Angers
  '51100': 11, // Reims
  '54000': 11, '54100': 10, // Nancy
  '57000': 11, // Metz
  '59000': 13, '59100': 12, '59200': 11, '59300': 12,
  '59400': 11, '59500': 11, '59600': 12, '59700': 11, // Lille et métropole
  '63000': 12, '63100': 11, // Clermont-Ferrand
  '67000': 14, '67100': 13, '67200': 12, '67300': 12, // Strasbourg
  '69001': 17, '69002': 17, '69003': 16, '69004': 15,
  '69005': 16, '69006': 18, '69007': 15, '69008': 14,
  '69009': 15, // Lyon
  '69100': 14, // Villeurbanne
  '69110': 13, // Sainte-Foy-lès-Lyon
  '69120': 13, // Vaulx-en-Velin
  '69130': 14, // Écully
  '69140': 13, // Rillieux-la-Pape
  '69150': 14, // Décines-Charpieu
  '69160': 13, // Tassin-la-Demi-Lune
  '69200': 13, // Vénissieux
  '69300': 14, // Caluire-et-Cuire
  '69310': 13, // Pierre-Bénite
  '69320': 12, // Feyzin
  '69330': 13, // Meyzieu
  '69340': 13, // Francheville
  '69350': 12, // La Mulatière
  '69360': 12, // Solaize
  '69370': 13, // Saint-Didier-au-Mont-d'Or
  '69380': 13, // Charly
  '69390': 13, // Vernaison
  '69400': 12, // Villefranche-sur-Saône
  '69500': 14, // Bron
  '69600': 14, // Oullins
  '69700': 12, // Givors
  '69800': 13, // Saint-Priest
  '76000': 13, '76100': 12, // Rouen
  '80000': 11, // Amiens
  '83000': 17, '83100': 15, '83200': 14, // Toulon et Var
  '87000': 11, // Limoges
}

/** Valeur de repli national si CP non trouvé */
const LOYER_NATIONAL_DEFAULT = 13 // €/m²/mois

/**
 * Retourne le loyer médian mensuel (€/m²/mois) pour un code postal.
 * Essaie le CP exact, puis le département (2 premiers chiffres × 1000 + suffix).
 */
export function getLoyerMedianM2(postalCode: string): number {
  if (LOYER_MEDIAN_PAR_CP[postalCode]) return LOYER_MEDIAN_PAR_CP[postalCode]

  // Fallback: chercher une autre entrée du même département (2 premiers chiffres)
  const dept = postalCode.slice(0, 2)
  const match = Object.entries(LOYER_MEDIAN_PAR_CP).find(([cp]) => cp.startsWith(dept))
  if (match) return match[1]

  return LOYER_NATIONAL_DEFAULT
}

/**
 * Estime le loyer mensuel brut pour une surface donnée et un code postal.
 */
export function estimateLoyer(surface: number, postalCode: string): number {
  return Math.round(surface * getLoyerMedianM2(postalCode))
}
