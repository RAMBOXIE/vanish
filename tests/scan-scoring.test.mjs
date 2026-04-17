import test from 'node:test';
import assert from 'node:assert/strict';

import {
  brokerConfidence,
  classifyLikelihood,
  riskTier,
  calculatePrivacyScore,
  overallRiskLevel,
  CATEGORY_RISK
} from '../src/scanner/scoring.mjs';

test('privacy score is in 0-100 range', () => {
  const exposures = [
    { likelihood: 'likely', category: 'people-search' },
    { likelihood: 'possible', category: 'financial' },
    { likelihood: 'unlikely', category: 'social-media' }
  ];
  const score = calculatePrivacyScore(exposures);
  assert.ok(score >= 0 && score <= 100, `Score ${score} out of range`);
});

test('all-likely high-risk exposures score near ceiling', () => {
  const exposures = Array(50).fill(null).map(() => ({
    likelihood: 'likely',
    category: 'people-search'
  }));
  const score = calculatePrivacyScore(exposures);
  assert.ok(score >= 80, `Score ${score} should be >= 80 for all-likely people-search`);
});

test('all-unlikely low-risk exposures score near floor', () => {
  const exposures = Array(50).fill(null).map(() => ({
    likelihood: 'unlikely',
    category: 'property'
  }));
  const score = calculatePrivacyScore(exposures);
  assert.ok(score <= 10, `Score ${score} should be <= 10 for all-unlikely property`);
});

test('empty exposures returns 0', () => {
  assert.equal(calculatePrivacyScore([]), 0);
  assert.equal(calculatePrivacyScore(null), 0);
});

test('likelihood classification thresholds', () => {
  assert.equal(classifyLikelihood(0.65), 'likely');
  assert.equal(classifyLikelihood(0.90), 'likely');
  assert.equal(classifyLikelihood(0.64), 'possible');
  assert.equal(classifyLikelihood(0.40), 'possible');
  assert.equal(classifyLikelihood(0.39), 'unlikely');
  assert.equal(classifyLikelihood(0.0), 'unlikely');
});

test('risk tier matrix produces valid combinations', () => {
  assert.equal(riskTier('likely', 0.95), 'critical');
  assert.equal(riskTier('likely', 0.75), 'critical');
  assert.equal(riskTier('likely', 0.50), 'high');
  assert.equal(riskTier('likely', 0.30), 'low');
  assert.equal(riskTier('possible', 0.75), 'moderate');
  assert.equal(riskTier('possible', 0.30), 'low');
  assert.equal(riskTier('unlikely', 0.95), 'low');
});

test('overall risk level mapping', () => {
  assert.equal(overallRiskLevel(100), 'critical');
  assert.equal(overallRiskLevel(75), 'critical');
  assert.equal(overallRiskLevel(74), 'high');
  assert.equal(overallRiskLevel(50), 'high');
  assert.equal(overallRiskLevel(49), 'moderate');
  assert.equal(overallRiskLevel(25), 'moderate');
  assert.equal(overallRiskLevel(24), 'low');
  assert.equal(overallRiskLevel(0), 'low');
});

test('category risk values are ordered correctly', () => {
  assert.ok(CATEGORY_RISK['people-search'] > CATEGORY_RISK['background-check']);
  assert.ok(CATEGORY_RISK['background-check'] > CATEGORY_RISK['financial']);
  assert.ok(CATEGORY_RISK['financial'] > CATEGORY_RISK['social-media']);
  assert.ok(CATEGORY_RISK['social-media'] > CATEGORY_RISK['property']);
});

test('broker confidence returns value between 0 and 1', () => {
  const broker = {
    category: 'people-search',
    jurisdiction: 'US',
    optOutMethod: 'form',
    dataTypes: ['name', 'email', 'phone'],
    _identityJurisdiction: 'US'
  };
  const stats = { 'people-search': 70, _max: 70 };
  const conf = brokerConfidence(broker, ['name', 'email'], stats);
  assert.ok(conf >= 0 && conf <= 1, `Confidence ${conf} out of range`);
});
