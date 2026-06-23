/**
 * ESX Classifier — Intelligent classification of Xactimate work into service lines
 * and company assignments for the SRH System.
 *
 * Classification rules based on line item descriptions, codes, and historical patterns.
 * Returns a suggestion with confidence score (0-100).
 */

const PAINT_KEYWORDS = [
  'paint', 'interior', 'exterior', 'stain', 'primer', 'coating', 'brushing', 'rolling',
  'spray', 'cabinet', 'trim', 'wall', 'deck', 'fence', 'epoxy', 'garage floor'
];

const DRYWALL_KEYWORDS = [
  'drywall', 'gypsum', 'sheetrock', 'mudding', 'taping', 'joint compound', 'finishing',
  'repair', 'patch', 'hang', 'installation'
];

const INSULATION_KEYWORDS = [
  'insulation', 'insulate', 'fiberglass', 'foam', 'batt', 'blanket', 'blown-in',
  'weatherization', 'r-value'
];

const WATER_MITIGATION_KEYWORDS = [
  'water mitigation', 'water removal', 'water extraction', 'moisture', 'water damage',
  'flood', 'leak', 'dehumidifier', 'air mover', 'dry', 'drying', 'extraction',
  'mitigation'
];

const MOLD_KEYWORDS = [
  'mold', 'mould', 'mold remediation', 'mold removal', 'remediation', 'antifungal',
  'mold testing', 'microbial'
];

const AIR_SAMPLE_KEYWORDS = [
  'air sample', 'air quality', 'air testing', 'sample', 'lab', 'testing', 'baseline',
  'clearance'
];

const RECONSTRUCTION_KEYWORDS = [
  'reconstruction', 'rebuild', 'remodel', 'renovation', 'restoration', 'rebuild',
  'flooring', 'tile', 'carpet', 'hardwood', 'cabinetry'
];

function scoreMatch(text, keywords) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let matches = 0;
  let totalWeight = 0;
  keywords.forEach(kw => {
    if (lower.includes(kw.toLowerCase())) {
      matches++;
      totalWeight += kw.length; // longer matches weighted higher
    }
  });
  return matches > 0 ? Math.min(100, (matches / keywords.length) * 100 + (totalWeight / 50)) : 0;
}

/**
 * Classify a parsed ESX work item into a company and service line.
 * @param {object} esxItem - Parsed ESX line item with description, code, etc.
 * @returns {object} Classification with { suggestedCompany, suggestedSubcontractor, serviceLine, laborCategory, confidenceScore }
 */
export function classifyESXWorkOrder(esxItem) {
  const description = esxItem.description || '';
  const code = esxItem.code || '';
  const combinedText = `${description} ${code}`;

  // Score each classification
  const paintScore = scoreMatch(combinedText, PAINT_KEYWORDS);
  const drywallScore = scoreMatch(combinedText, DRYWALL_KEYWORDS);
  const insulationScore = scoreMatch(combinedText, INSULATION_KEYWORDS);
  const waterScore = scoreMatch(combinedText, WATER_MITIGATION_KEYWORDS);
  const moldScore = scoreMatch(combinedText, MOLD_KEYWORDS);
  const airSampleScore = scoreMatch(combinedText, AIR_SAMPLE_KEYWORDS);
  const reconstructionScore = scoreMatch(combinedText, RECONSTRUCTION_KEYWORDS);

  // Find highest scoring classification
  const scores = [
    { serviceLine: 'interior_painting', company: 'Grand Strand Custom Painting', score: paintScore },
    { serviceLine: 'drywall', company: 'Grand Strand Custom Painting', score: drywallScore },
    { serviceLine: 'insulation', company: 'Grand Strand Custom Painting', score: insulationScore },
    { serviceLine: 'water_mitigation', company: 'Destination Home', score: waterScore },
    { serviceLine: 'mold_mitigation', company: 'Destination Home', score: moldScore },
    { serviceLine: 'air_sample_testing', company: 'Destination Home', score: airSampleScore },
    { serviceLine: 'reconstruction', company: 'Destination Home', score: reconstructionScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  const topMatch = scores[0];

  // If confidence is below 40%, mark as needs_review
  const confidenceScore = Math.round(topMatch.score);
  const needsReview = confidenceScore < 40;

  return {
    serviceLine: topMatch.serviceLine,
    suggestedCompany: topMatch.company,
    suggestedSubcontractor: null, // Can be set by reviewers
    laborCategory: esxItem.laborCategory || null,
    confidenceScore,
    needsReview,
    allScores: scores, // For transparency
  };
}

/**
 * Classify multiple ESX items at once.
 */
export function classifyESXBatch(esxItems) {
  return esxItems.map(item => ({
    ...item,
    classification: classifyESXWorkOrder(item),
  }));
}