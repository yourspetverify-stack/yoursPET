import React, { useEffect, useMemo, useState } from 'react'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import { setToken } from './api.js'

export default function App(){
  const [user, setUser] = useState(()=>{
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null
  })

  useEffect(()=>{
    if(!user){ setToken(''); return }
    setToken(localStorage.getItem('token')||'')
  },[user])

  if(!user) return <Login onAuth={(payload)=>{
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(payload.user));
    setToken(payload.token);
    setUser(payload.user);
  }}/>

  return <Dashboard user={user} onLogout={()=>{
    localStorage.removeItem('user'); localStorage.removeItem('token'); setUser(null);
  }}/>
}
