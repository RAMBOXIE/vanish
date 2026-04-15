import { createDryRunBrokerAdapter } from './_dry-run-broker.mjs';

export const whitepagesAdapter = createDryRunBrokerAdapter({
  name: 'whitepages',
  displayName: 'Whitepages'
});

export default whitepagesAdapter;
