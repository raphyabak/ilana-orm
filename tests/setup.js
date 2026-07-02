// Prevent auto-loading ilana.config.js during tests — the config file
// references 'ilana/database/connection' (the published package name)
// which cannot resolve inside the package itself during test runs.
jest.mock('../database/connection', () => {
  const raw = (sql, bindings) => ({ _isRaw: true, sql, bindings });
  const mockKnex = () => ({
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
    decrement: jest.fn().mockResolvedValue(1),
    clone: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ 'count(*)': 0 }]),
  });

  return {
    configure: jest.fn(),
    connection: jest.fn().mockReturnValue({ raw }),
    table: jest.fn().mockReturnValue(mockKnex()),
    raw,
    getInstance: jest.fn().mockReturnValue({ raw }),
    getDefaultConnection: jest.fn().mockReturnValue('default'),
    hasConnection: jest.fn().mockReturnValue(false),
    getCurrentTransaction: jest.fn().mockReturnValue(null),
    enableLogging: jest.fn(),
    disableLogging: jest.fn(),
    _logging: false,
    default: { configure: jest.fn() },
  };
});
