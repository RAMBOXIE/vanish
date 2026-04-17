// Privacy scoring algorithm — pure functions, no side effects.

export const CATEGORY_RISK = Object.freeze({
  'people-search':       0.95,
  'background-check':    0.85,
  'identity-resolution': 0.80,
  'public-records':      0.75,
  'phone-lookup':        0.70,
  'email-data':          0.65,
  'marketing-data':      0.60,
  'reputation':          0.55,
  'location-data':       0.50,
  'financial':           0.45,
  'social-media':        0.40,
  'property':            0.35
});

const WEIGHTS = Object.freeze({
  dataTypeCoverage:   0.35,
  categoryRisk:       0.25,
  jurisdictionMatch:  0.20,
  brokerReach:        0.10,
  optOutComplexity:   0.10
});

const OPTOUT_COMPLEXITY = Object.freeze({
  form:    0.6,
  email:   0.7,
  api:     0.5,
  account: 0.8,
  mail:    0.9
});

const LIKELIHOOD_WEIGHT = Object.freeze({
  likely:   1.0,
  possible: 0.5,
  unlikely: 0.1
});

const REMOVAL_DIFFICULTY = Object.freeze({
  form:    'easy',
  api:     'easy',
  email:   'moderate',
  account: 'hard',
  mail:    'hard'
});

/**
 * Calculate per-broker confidence score (0.0–1.0).
 */
export function brokerConfidence(broker, identityDataTypes, categoryStats) {
  const brokerTypes = broker.dataTypes || [];
  const dCov = dataTypeCoverage(brokerTypes, identityDataTypes);
  const cRisk = CATEGORY_RISK[broker.category] || 0.5;
  const jMatch = broker.jurisdiction === (broker._identityJurisdiction || 'US') ? 1.0 : 0.3;
  const maxCat = categoryStats._max || 1;
  const bReach = (categoryStats[broker.category] || 1) / maxCat;
  const oCmplx = OPTOUT_COMPLEXITY[broker.optOutMethod] || 0.5;

  return (
    WEIGHTS.dataTypeCoverage  * dCov +
    WEIGHTS.categoryRisk      * cRisk +
    WEIGHTS.jurisdictionMatch * jMatch +
    WEIGHTS.brokerReach       * bReach +
    WEIGHTS.optOutComplexity  * oCmplx
  );
}

/**
 * Classify confidence into likelihood bucket.
 */
export function classifyLikelihood(confidence) {
  if (confidence >= 0.65) return 'likely';
  if (confidence >= 0.40) return 'possible';
  return 'unlikely';
}

/**
 * Determine risk tier from likelihood + category risk.
 */
export function riskTier(likelihood, categoryRiskValue) {
  if (likelihood === 'likely'   && categoryRiskValue >= 0.75) return 'critical';
  if (likelihood === 'likely'   && categoryRiskValue >= 0.50) return 'high';
  if (likelihood === 'possible' && categoryRiskValue >= 0.50) return 'moderate';
  return 'low';
}

/**
 * Calculate global privacy score (0–100). Higher = more exposed.
 */
export function calculatePrivacyScore(exposures) {
  if (!exposures || exposures.length === 0) return 0;

  let weightedSum = 0;
  for (const exp of exposures) {
    const lw = LIKELIHOOD_WEIGHT[exp.likelihood] || 0;
    const cr = CATEGORY_RISK[exp.category] || 0.5;
    weightedSum += lw * cr;
  }

  const maxPossible = exposures.length * 1.0;
  const raw = (weightedSum / maxPossible) * 100;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Map score to overall risk level.
 */
export function overallRiskLevel(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

/**
 * Map optOutMethod to human-friendly removal difficulty.
 */
export function removalDifficulty(optOutMethod) {
  return REMOVAL_DIFFICULTY[optOutMethod] || 'moderate';
}

// --- Internal helpers ---

function dataTypeCoverage(brokerTypes, identityTypes) {
  if (identityTypes.length === 0) return 0;
  if (brokerTypes.length === 0) return 0.3; // unknown = moderate-low assumption
  const overlap = identityTypes.filter(t => brokerTypes.includes(t));
  // Reward absolute match count, capped at 4 (typical full profile depth).
  // 0 matches = 0, 1 = 0.25, 2 = 0.5, 3 = 0.75, 4+ = 1.0
  // This way, providing MORE identity data = MORE exposure (intuitive direction).
  return Math.min(1.0, overlap.length / 4);
}
