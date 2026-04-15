import { createDryRunBrokerAdapter } from './_dry-run-broker.mjs';

export const beenverifiedAdapter = createDryRunBrokerAdapter({
  name: 'beenverified',
  displayName: 'BeenVerified'
});

export default beenverifiedAdapter;
