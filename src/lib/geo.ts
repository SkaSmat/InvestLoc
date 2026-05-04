interface GeoCommune {
  code: string
  nom: string
}

/**
 * Résout un code postal en code INSEE via geo.api.gouv.fr.
 * En cas de plusieurs communes (ex: 75000 → plusieurs arrondissements),
 * tente un match approximatif sur le nom de ville, sinon retourne le premier.
 */
export async function getCodeInsee(codePostal: string, city: string): Promise<string> {
  const url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(codePostal)}&fields=code,nom&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`geo.api.gouv.fr error: ${res.status}`)

  const communes: GeoCommune[] = await res.json()
  if (communes.length === 0) {
    throw new Error(`Aucune commune trouvée pour le code postal ${codePostal}`)
  }

  const cityNorm = city.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')
  const match = communes.find((c) => {
    const nom = c.nom.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')
    return nom.includes(cityNorm) || cityNorm.includes(nom)
  })

  return match ? match.code : communes[0].code
}
