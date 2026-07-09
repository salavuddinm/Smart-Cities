import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { db } from './db/init.js';
import './db/seed.js';
import incidentsRouter from './routes/incidents.js';
import alertsRouter from './routes/alerts.js';
import configRouter from './routes/config.js';
import intelligenceRouter from './routes/intelligence.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', module: 'EP01-Public Safety Intelligence' }));

// Minimal demo auth: looks up a user by username, no password check (replace with real auth/RBAC in production)
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  const user = db.prepare(
    `SELECT u.user_id, u.username, u.full_name, r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.username=?`
  ).get(username);
  if (!user) return res.status(401).json({ error: 'Unknown user' });
  res.json(user);
});

app.get('/api/users', (req, res) => {
  res.json(db.prepare(`SELECT u.user_id, u.username, u.full_name, r.role_name FROM users u JOIN roles r ON r.role_id=u.role_id`).all());
});

app.use('/api/incidents', incidentsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/config', configRouter);
app.use('/api', intelligenceRouter); // gis, dashboard, reports, audit, notifications

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`PSI API listening on :${PORT}`));
