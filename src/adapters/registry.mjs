import { spokeoAdapter } from './brokers/spokeo.mjs';
import { whitepagesAdapter } from './brokers/whitepages.mjs';
import { beenverifiedAdapter } from './brokers/beenverified.mjs';

const brokerAdapters = new Map([
  [spokeoAdapter.name, spokeoAdapter],
  [whitepagesAdapter.name, whitepagesAdapter],
  [beenverifiedAdapter.name, beenverifiedAdapter]
]);

export function listBrokerAdapters() {
  return Array.from(brokerAdapters.keys());
}

export function getBrokerAdapter(name) {
  const adapter = brokerAdapters.get(name);
  if (!adapter) {
    throw new Error(`Unknown broker adapter: ${name}`);
  }
  return adapter;
}

export function getBrokerAdapters(names = listBrokerAdapters()) {
  return names.map(getBrokerAdapter);
}

export const registry = {
  brokers: Object.fromEntries(brokerAdapters)
};
