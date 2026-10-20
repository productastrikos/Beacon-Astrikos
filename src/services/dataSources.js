import { SOURCE_DEFS } from '../data/demo/sources';

/**
 * Data-source adapters. A real adapter would
 * live behind a backend service and implement the DataSourceAdapter contract in
 * services/contracts.js. Credentials/API keys must stay server-side.
 */
export const DATA_SOURCE_ADAPTERS = SOURCE_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  async checkConnection() {
    return {
      status: def.status,
      checkedAt: new Date().toISOString(),
      detail: def.error,
    };
  },
  async fetchLatest() {
    return { records: [], receivedAt: new Date().toISOString() };
  },
}));
