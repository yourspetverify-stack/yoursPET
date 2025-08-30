import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

app.use(cors());
app.use(express.json());

// Helper: auth middleware
const auth = async (req,res,next)=>{
  const header = req.headers.authorization||'';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token) return res.status(401).json({error:'No token'});
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  }catch(e){
    res.status(401).json({error:'Invalid token'});
  }
};

// Auth routes
app.post('/api/auth/register', async (req,res)=>{
  const {username, password} = req.body;
  if(!username || !password) return res.status(400).json({error:'Missing'});
  const hash = await bcrypt.hash(password, 10);
  try{
    const [r] = await pool.execute('INSERT INTO users (username, password_hash) VALUES (?,?)',[username,hash]);
    const token = jwt.sign({id:r.insertId, username}, JWT_SECRET, {expiresIn:'7d'});
    res.json({token, user:{id:r.insertId, username}});
  }catch(e){
    res.status(400).json({error:'Username taken'});
  }
});

app.post('/api/auth/login', async (req,res)=>{
  const {username, password} = req.body;
  const [rows] = await pool.execute('SELECT * FROM users WHERE username=?',[username]);
  const user = rows[0];
  if(!user) return res.status(401).json({error:'Invalid'});
  const ok = await bcrypt.compare(password, user.password_hash);
  if(!ok) return res.status(401).json({error:'Invalid'});
  const token = jwt.sign({id:user.id, username:user.username}, JWT_SECRET, {expiresIn:'7d'});
  res.json({token, user:{id:user.id, username:user.username}});
});

// Categories
app.get('/api/categories', auth, async (req,res)=>{
  const [rows] = await pool.execute('SELECT * FROM categories ORDER BY name');
  res.json(rows);
});

// Transactions CRUD
app.get('/api/transactions', auth, async (req,res)=>{
  const [rows] = await pool.execute('SELECT t.*, c.name as category, c.color FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE t.user_id=? ORDER BY occurred_on DESC, id DESC',[req.user.id]);
  res.json(rows);
});

app.post('/api/transactions', auth, async (req,res)=>{
  const {title, amount, type='expense', occurred_on, category_id=null} = req.body;
  const [r] = await pool.execute('INSERT INTO transactions (user_id, title, amount, type, occurred_on, category_id) VALUES (?,?,?,?,?,?)',[req.user.id, title, amount, type, occurred_on, category_id]);
  const [rows] = await pool.execute('SELECT t.*, c.name as category, c.color FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE t.id=?',[r.insertId]);
  res.json(rows[0]);
});

app.delete('/api/transactions/:id', auth, async (req,res)=>{
  await pool.execute('DELETE FROM transactions WHERE id=? AND user_id=?',[req.params.id, req.user.id]);
  res.json({ok:true});
});

// Reports summary
app.get('/api/reports/monthly', auth, async (req,res)=>{
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(occurred_on,'%Y-%m') as ym,
            SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expenses,
            SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income
     FROM transactions WHERE user_id=?
     GROUP BY ym ORDER BY ym`, [req.user.id]);
  res.json(rows);
});

app.get('/api/reports/spending-by-category', auth, async (req,res)=>{
  const [rows] = await pool.execute(
    `SELECT c.name, c.color, SUM(t.amount) as total
     FROM transactions t
     LEFT JOIN categories c ON c.id=t.category_id
     WHERE t.user_id=? AND t.type='expense'
     GROUP BY c.id, c.name, c.color
     ORDER BY total DESC`, [req.user.id]);
  res.json(rows);
});

app.listen(PORT, ()=> console.log('API on http://localhost:'+PORT));
