/**
 * Plesk Node.js entry point
 *
 * Plesk's Node.js extension expects a file (typically app.js) at the
 * document root. This file bootstraps the production server.
 *
 * Before first run:
 *   1. npm install
 *   2. npm run build
 *   3. npm run db:push
 *   4. npm run db:seed   (optional – initial data)
 *
 * Environment variables are read from .env in the project root.
 */
process.env.NODE_ENV = 'production';

// Plesk's phusion-passenger provides the port via process.env.PORT,
// so we let it override the default.
import('./server/dist/index.js');
