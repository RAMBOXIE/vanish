import {
  brokerConfidence,
  classifyLikelihood,
  riskTier,
  removalDifficulty,
  CATEGORY_RISK
} from './scoring.mjs';

// Default data types per category (fallback when broker has no explicit dataTypes).
const CATEGORY_DEFAULT_DATA_TYPES = Object.freeze({
  'people-search':       ['name', 'address', 'phone', 'email', 'age', 'relatives'],
  'background-check':    ['name', 'address', 'phone', 'email', 'court-records', 'employment'],
  'phone-lookup':        ['name', 'phone', 'address'],
  'public-records':      ['name', 'address', 'property', 'court-records'],
  'marketing-data':      ['name', 'email', 'address', 'phone'],
  'financial':           ['name', 'address', 'financial'],
  'location-data':       ['name', 'address', 'location-history'],
  'email-data':          ['name', 'email'],
  'social-media':        ['name', 'username', 'email', 'social-profiles', 'photos'],
  'reputation':          ['name', 'social-profiles', 'court-records'],
  'identity-resolution': ['name', 'email', 'phone', 'address', 'social-profiles', 'username'],
  'property':            ['name', 'address', 'property']
});

/**
 * Derive data type tokens from user-provided identity fields.
 */
export function identityFields(identity) {
  const fields = [];
  if (identity.fullName)                             fields.push('name');
  if (identity.emails?.length > 0)                   fields.push('email');
  if (identity.phones?.length > 0)                   fields.push('phone');
  if (identity.usernames?.length > 0)                fields.push('username');
  if (identity.city || identity.state || identity.address) fields.push('address');
  if (identity.dob)                                  fields.push('dob');
  if (identity.age)                                  fields.push('age');
  return fields;
}

/**
 * Build category stats from broker list for reach calculation.
 */
export function buildCategoryStats(brokers) {
  const stats = {};
  for (const b of brokers) {
    const cat = b.category || 'unknown';
    stats[cat] = (stats[cat] || 0) + 1;
  }
  stats._max = Math.max(1, ...Object.values(stats));
  return stats;
}

/**
 * Build a single broker's exposure profile.
 * @param {string} brokerName
 * @param {Object} brokerEntry - from broker-catalog.json
 * @param {Object} identity - user identity
 * @param {string[]} idFields - pre-computed identity fields
 * @param {Object} categoryStats - from buildCategoryStats
 * @returns {Object} ExposureEntry
 */
export function buildExposureProfile(brokerName, brokerEntry, identity, idFields, categoryStats) {
  const dataTypes = brokerEntry.dataTypes || CATEGORY_DEFAULT_DATA_TYPES[brokerEntry.category] || ['name'];
  const categoryRiskValue = CATEGORY_RISK[brokerEntry.category] || 0.5;

  const enrichedBroker = {
    ...brokerEntry,
    dataTypes,
    _identityJurisdiction: identity.jurisdiction || 'US'
  };

  const confidence = brokerConfidence(enrichedBroker, idFields, categoryStats);
  const likelihood = classifyLikelihood(confidence);
  const tier = riskTier(likelihood, categoryRiskValue);

  // Determine which user data types this broker likely has
  const exposedTypes = idFields.filter(t => dataTypes.includes(t));

  // Generate human-readable reason
  const reason = buildReason(brokerEntry, likelihood, exposedTypes, identity.jurisdiction);

  return {
    broker: brokerName,
    displayName: brokerEntry.displayName,
    category: brokerEntry.category,
    likelihood,
    confidence: Math.round(confidence * 100) / 100,
    riskTier: tier,
    reason,
    dataTypesExposed: exposedTypes,
    optOutUrl: brokerEntry.optOutUrl || null,
    optOutMethod: brokerEntry.optOutMethod || 'form',
    removalDifficulty: removalDifficulty(brokerEntry.optOutMethod)
  };
}

function buildReason(broker, likelihood, exposedTypes, jurisdiction) {
  const category = broker.category || 'data broker';
  const typeStr = exposedTypes.length > 0
    ? exposedTypes.join(', ')
    : 'general personal data';

  if (likelihood === 'likely') {
    return `${capitalize(category)} broker with ${typeStr} coverage in ${jurisdiction || 'US'} jurisdiction`;
  }
  if (likelihood === 'possible') {
    return `${capitalize(category)} broker; may have ${typeStr} records`;
  }
  return `${capitalize(category)} broker; low probability of holding your data`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
