import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function transactionApiPlugin() {
  const txFile = path.resolve('transactions/user_transactions.json');
  return {
    name: 'transaction-api',
    configureServer(server) {
      server.middlewares.use('/api/transactions', (req, res) => {
        if (req.method === 'GET') {
          try {
            const data = fs.existsSync(txFile) ? JSON.parse(fs.readFileSync(txFile, 'utf-8')) : [];
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch { res.end('[]'); }
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const tx = JSON.parse(body);
              const existing = fs.existsSync(txFile) ? JSON.parse(fs.readFileSync(txFile, 'utf-8')) : [];
              existing.unshift({ ...tx, id: Date.now() });
              fs.writeFileSync(txFile, JSON.stringify(existing, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, count: existing.length }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }
        if (req.method === 'DELETE') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { id } = JSON.parse(body);
              const existing = fs.existsSync(txFile) ? JSON.parse(fs.readFileSync(txFile, 'utf-8')) : [];
              const filtered = existing.filter(t => t.id !== id);
              fs.writeFileSync(txFile, JSON.stringify(filtered, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, count: filtered.length }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end('Method not allowed');
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), transactionApiPlugin()],
  base: '/Dashboard/'
})
