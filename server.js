const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const SECRET = process.env.JWT_SECRET || 'residential-development-secret';
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run(`CREATE TABLE IF NOT EXISTS towers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`);
  db.run(`CREATE TABLE IF NOT EXISTS apartments (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL, tower_id INTEGER NOT NULL, UNIQUE(number,tower_id), FOREIGN KEY(tower_id) REFERENCES towers(id) ON DELETE CASCADE)`);
  db.run(`CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, plate TEXT NOT NULL UNIQUE, brand TEXT NOT NULL, color TEXT NOT NULL, observations TEXT DEFAULT '')`);
  db.run(`CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', apartment_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE)`);
});

const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user; next();
  });
};
const value = x => typeof x === 'string' ? x.trim() : x;
const definitions = {
  towers: { table: 'towers', fields: ['name'], required: ['name'] },
  apartments: { table: 'apartments', fields: ['number', 'tower_id'], required: ['number', 'tower_id'] },
  vehicles: { table: 'vehicles', fields: ['plate', 'brand', 'color', 'observations'], required: ['plate', 'brand', 'color'] },
  news: { table: 'news', fields: ['title', 'description', 'apartment_id'], required: ['title'] }
};

app.post('/api/login', (req, res) => {
  if (req.body.username === 'admin' && req.body.password === '123456') {
    return res.json({ success: true, token: jwt.sign({ username: 'admin' }, SECRET, { expiresIn: '24h' }) });
  }
  res.status(401).json({ success: false, message: 'Credenciales inválidas' });
});
app.get('/api/towers', auth, (req,res) => db.all('SELECT * FROM towers ORDER BY name', (e,r) => e ? res.status(500).json({error:e.message}) : res.json(r)));
app.get('/api/apartments', auth, (req,res) => db.all('SELECT a.*,t.name tower_name FROM apartments a JOIN towers t ON t.id=a.tower_id ORDER BY t.name,a.number', (e,r) => e ? res.status(500).json({error:e.message}) : res.json(r)));
app.get('/api/vehicles', auth, (req,res) => { const p = value(req.query.plate || '').toUpperCase(); db.all(`SELECT * FROM vehicles ${p ? 'WHERE plate LIKE ?' : ''} ORDER BY plate`, p ? [`%${p}%`] : [], (e,r) => e ? res.status(500).json({error:e.message}) : res.json(r)); });
app.get('/api/news', auth, (req,res) => db.all('SELECT n.*,a.number apartment_number,t.name tower_name FROM news n LEFT JOIN apartments a ON a.id=n.apartment_id LEFT JOIN towers t ON t.id=a.tower_id ORDER BY n.created_at DESC', (e,r) => e ? res.status(500).json({error:e.message}) : res.json(r)));

for (const [name, def] of Object.entries(definitions)) {
  const route = '/api/' + name;
  app.post(route, auth, (req,res) => {
    const data = {...req.body}; if (name === 'vehicles') data.plate = value(data.plate).toUpperCase();
    if (def.required.some(f => !data[f] && data[f] !== 0)) return res.status(400).json({error:'Campos obligatorios incompletos'});
    const vals = def.fields.map(f => value(data[f]) ?? null);
    db.run(`INSERT INTO ${def.table} (${def.fields.join(',')}) VALUES (${def.fields.map(()=>'?')})`, vals, function(e) {
      if (e) return res.status(e.message.includes('UNIQUE') ? 400 : 500).json({error: e.message.includes('UNIQUE') ? 'El registro ya existe' : e.message});
      res.status(201).json({id:this.lastID, ...data});
    });
  });
  app.put(route+'/:id', auth, (req,res) => {
    const data = {...req.body}; if (name === 'vehicles') data.plate = value(data.plate).toUpperCase();
    if (def.required.some(f => !data[f] && data[f] !== 0)) return res.status(400).json({error:'Campos obligatorios incompletos'});
    const vals = def.fields.map(f => value(data[f]) ?? null);
    db.run(`UPDATE ${def.table} SET ${def.fields.map(f=>f+'=?').join(',')} WHERE id=?`, [...vals, req.params.id], function(e) {
      if (e) return res.status(e.message.includes('UNIQUE') ? 400 : 500).json({error:e.message});
      res.json({success:true});
    });
  });
  app.delete(route+'/:id', auth, (req,res) => db.run(`DELETE FROM ${def.table} WHERE id=?`, req.params.id, function(e) { if(e) return res.status(500).json({error:e.message}); res.json({success:true}); }));
}
app.get('*', (req,res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
