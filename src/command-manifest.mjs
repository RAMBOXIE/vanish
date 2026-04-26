export const TIER_ORDER = ['core', 'specialist', 'labs', 'internal'];

export const TIER_METADATA = {
  core: {
    heading: 'Core',
    description: 'stable, in hero'
  },
  specialist: {
    heading: 'Specialist',
    description: 'stable, narrower scope'
  },
  labs: {
    heading: 'Labs / Research',
    description: 'experimental, low-evidence, or UX layers'
  },
  internal: {
    heading: 'Internal helpers',
    description: 'plumbing and lower-level tools'
  }
};

export const EVIDENCE_METADATA = {
  A: 'result is locally verifiable',
  B: 'action is provable, result needs follow-up confirmation',
  C: 'classification, triage, or user self-confirmation',
  D: 'research probe or experimental claim'
};

export const PROMISE_TYPES = [
  'risk-discovery',
  'removal-request',
  'future-exposure-reduction',
  'outcome-check',
  'evidence-output',
  'local-hygiene',
  'research-probe',
  'experimental-capability',
  'ux-layer',
  'internal-helper'
];

export const BINARY_ALIASES = [
  {
    binary: 'vanish-scan',
    command: 'scan'
  }
];

export const COMMAND_MANIFEST = [
  {
    id: 'scan',
    script: 'scan-demo.mjs',
    tier: 'core',
    evidence: 'C',
    promiseType: 'risk-discovery',
    description: 'Scan 210 brokers for your privacy exposure (0-100 score)',
    example: 'vanish scan --name "John Doe" --email "j@x.com"'
  },
  {
    id: 'ai-scan',
    script: 'ai-scan.mjs',
    tier: 'core',
    evidence: 'C',
    promiseType: 'risk-discovery',
    description: 'Check which LLM companies train on your data (30 platforms)',
    example: 'vanish ai-scan --linkedin --twitter --chatgpt'
  },
  {
    id: 'ai-opt-out',
    script: 'ai-opt-out.mjs',
    tier: 'core',
    evidence: 'B',
    promiseType: 'future-exposure-reduction',
    description: 'Browser-assisted AI training opt-out (26 platforms with walkthroughs)',
    example: 'vanish ai-opt-out --chatgpt --linkedin --cursor'
  },
  {
    id: 'face-scan',
    script: 'face-scan.mjs',
    tier: 'core',
    evidence: 'C',
    promiseType: 'risk-discovery',
    description: 'Check if your face appears on PimEyes, FaceCheck, FindClone, etc. (8 services)',
    example: 'vanish face-scan --pimeyes --facecheck --findclone'
  },
  {
    id: 'face-opt-out',
    script: 'face-opt-out.mjs',
    tier: 'core',
    evidence: 'B',
    promiseType: 'removal-request',
    description: 'Request removal from face-search services + Clearview AI (8 services)',
    example: 'vanish face-opt-out --pimeyes --clearview'
  },
  {
    id: 'opt-out',
    script: 'opt-out.mjs',
    tier: 'core',
    evidence: 'B',
    promiseType: 'removal-request',
    description: 'Browser-assisted opt-out for 58 supported brokers',
    example: 'vanish opt-out --broker spokeo --email you@example.com'
  },
  {
    id: 'verify',
    script: 'verify.mjs',
    tier: 'core',
    evidence: 'A',
    promiseType: 'outcome-check',
    description: 'Check whether past opt-out submissions actually removed your data',
    example: 'vanish verify --all'
  },
  {
    id: 'report',
    script: 'generate-proof-report.mjs',
    tier: 'core',
    evidence: 'A',
    promiseType: 'evidence-output',
    description: 'Generate a Markdown proof report from execution JSON',
    example: 'vanish report ./path/to/result.json'
  },
  {
    id: 'takedown',
    script: 'takedown.mjs',
    tier: 'specialist',
    evidence: 'B',
    promiseType: 'removal-request',
    description: 'Remove leaked/NCII content - DMCA + StopNCII + Google intimate-imagery form',
    example: 'vanish takedown --stopncii'
  },
  {
    id: 'dataset-check',
    script: 'dataset-check.mjs',
    tier: 'specialist',
    evidence: 'B',
    promiseType: 'risk-discovery',
    description: 'Check if your content is in Common Crawl / LAION / Pile / C4 / etc.',
    example: 'vanish dataset-check --url https://your-site.com --all'
  },
  {
    id: 'third-party-ai',
    script: 'third-party-ai.mjs',
    tier: 'specialist',
    evidence: 'B',
    promiseType: 'future-exposure-reduction',
    description: 'Generate objection letters for AI tools others use on you',
    example: 'vanish third-party-ai --zoom --otter --jurisdiction EU'
  },
  {
    id: 'clean-ai-history',
    script: 'clean-ai-history.mjs',
    tier: 'specialist',
    evidence: 'B',
    promiseType: 'local-hygiene',
    description: 'Discover where AI tools store your history + exact delete commands',
    example: 'vanish clean-ai-history --cursor --chatgpt --claude'
  },
  {
    id: 'llm-memory-check',
    script: 'llm-memory-check.mjs',
    tier: 'labs',
    evidence: 'D',
    promiseType: 'research-probe',
    description: 'Probe whether GPT-4 / Claude seem to have memorized your personal info',
    example: 'vanish llm-memory-check --name "Your Name" --email "you@ex.com"'
  },
  {
    id: 'b1-live',
    script: 'b1-live.mjs',
    tier: 'labs',
    evidence: 'D',
    promiseType: 'experimental-capability',
    description: 'Submit live opt-out requests to configured endpoints',
    example: 'vanish b1-live run --live --brokers spokeo,peekyou'
  },
  {
    id: 'wizard',
    script: 'wizard-demo.mjs',
    tier: 'labs',
    evidence: 'C',
    promiseType: 'ux-layer',
    description: 'Full interactive wizard (scan -> review -> cleanup)',
    example: 'vanish wizard'
  },
  {
    id: 'dashboard',
    script: 'build-dashboard-data.mjs',
    tier: 'labs',
    evidence: 'C',
    promiseType: 'ux-layer',
    description: 'Build dashboard JSON from persisted queue state',
    example: 'vanish dashboard data/queue-state.json'
  },
  {
    id: 'cleanup',
    script: 'vanish.mjs',
    tier: 'internal',
    evidence: 'C',
    promiseType: 'internal-helper',
    description: 'Low-level opt-out workflow (dry-run by default)',
    example: 'vanish cleanup --manual --preset spokeo'
  },
  {
    id: 'b1-demo',
    script: 'b1-demo.mjs',
    tier: 'internal',
    evidence: 'D',
    promiseType: 'internal-helper',
    description: 'Run the B1 live-submission demo harness',
    example: 'vanish b1-demo'
  },
  {
    id: 'queue',
    script: 'queue-cli.mjs',
    tier: 'internal',
    evidence: 'A',
    promiseType: 'internal-helper',
    description: 'Manage retry / manual-review / dead-letter queues',
    example: 'vanish queue list'
  },
  {
    id: 'dashboard:watch',
    script: 'dashboard-watch.mjs',
    tier: 'internal',
    evidence: 'C',
    promiseType: 'internal-helper',
    description: 'Auto-refresh dashboard data from persisted queue state',
    example: 'vanish dashboard:watch'
  }
];

export const COMMAND_MANIFEST_BY_ID = Object.fromEntries(
  COMMAND_MANIFEST.map((command) => [command.id, command])
);

export const SUBCOMMANDS = Object.fromEntries(
  COMMAND_MANIFEST.map(({ id, script }) => [id, script])
);

export function commandsForTier(tier) {
  return COMMAND_MANIFEST.filter((command) => command.tier === tier);
}
