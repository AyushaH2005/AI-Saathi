export function computeSimilarity(textA, textB) {
  if (!textA || !textB) return 0
  if (textA === textB) return 1

  const wordsA = tokenize(textA)
  const wordsB = tokenize(textB)

  if (wordsA.length < 5 || wordsB.length < 5) return 0

  const bigramsA = getBigrams(wordsA)
  const bigramsB = getBigrams(wordsB)

  const setA = new Set(bigramsA)
  const setB = new Set(bigramsB)

  let intersection = 0
  for (const b of setA) {
    if (setB.has(b)) intersection++
  }

  return (2 * intersection) / (setA.size + setB.size)
}

export function isSimilarEnough(textA, textB, threshold = 0.9) {
  return computeSimilarity(textA, textB) >= threshold
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
}

function getBigrams(words) {
  const bigrams = []
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + ' ' + words[i + 1])
  }
  return bigrams
}
