// Edge runtime entry point — no auto-loading of ilana.config.js.
// Use this when running in Cloudflare Workers, Deno, Bun, or Next.js edge routes.
// You must call Database.configure(config) explicitly before using any models.
//
// import { Model, Database } from 'ilana-orm/edge';
// Database.configure({ default: 'pg', connections: { pg: { ... } } });

'use strict';
global.__ILANA_EDGE__ = true;
module.exports = require('./index.js');
