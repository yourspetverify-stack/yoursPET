const API = import.meta.env.VITE_API || 'http://localhost:5050';
let token = localStorage.getItem('token') || '';

export function setToken(t){ token=t; localStorage.setItem('token', t); }
function headers(){ return token ? {'Authorization':'Bearer '+token, 'Content-Type':'application/json'} : {'Content-Type':'application/json'}; }

export async function login(username,password){
  const r = await fetch(API+'/api/auth/login',{method:'POST', headers: {'Content-Type':'application/json'}, body:JSON.stringify({username,password})});
  if(!r.ok) throw new Error('Login failed');
  return r.json();
}
export async function register(username,password){
  const r = await fetch(API+'/api/auth/register',{method:'POST', headers: {'Content-Type':'application/json'}, body:JSON.stringify({username,password})});
  if(!r.ok) throw new Error('Register failed');
  return r.json();
}
export async function getCategories(){
  const r = await fetch(API+'/api/categories',{headers:headers()});
  return r.json();
}
export async function getTransactions(){
  const r = await fetch(API+'/api/transactions',{headers:headers()});
  return r.json();
}
export async function addTransaction(tx){
  const r = await fetch(API+'/api/transactions',{method:'POST', headers:headers(), body:JSON.stringify(tx)});
  return r.json();
}
export async function delTransaction(id){
  const r = await fetch(API+'/api/transactions/'+id,{method:'DELETE', headers:headers()});
  return r.json();
}
export async function monthlyReport(){
  const r = await fetch(API+'/api/reports/monthly',{headers:headers()});
  return r.json();
}
export async function spendingByCategory(){
  const r = await fetch(API+'/api/reports/spending-by-category',{headers:headers()});
  return r.json();
}
