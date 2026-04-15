import { createDryRunBrokerAdapter } from './_dry-run-broker.mjs';

export const spokeoAdapter = createDryRunBrokerAdapter({
  name: 'spokeo',
  displayName: 'Spokeo'
});

export default spokeoAdapter;
