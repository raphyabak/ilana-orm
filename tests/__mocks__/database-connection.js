// Stub for 'ilana/database/connection' used by ilana.config.js in tests.
// ilana.config.js does require('ilana/database/connection').default — so we
// export both a default property and the configure method directly.
const stub = {
  configure: () => {},
  connection: () => ({}),
  table: () => ({}),
  raw: (sql, b) => ({ _isRaw: true, sql, bindings: b }),
  getInstance: () => ({}),
  enableLogging: () => {},
  disableLogging: () => {},
};

stub.default = stub;
module.exports = stub;
