import React, { useState } from 'react'
import { login, register } from '../api.js'

function Blob({style, gradient}){
  return (
    <svg className="blob" style={style} width="500" height="500" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradient} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#5B8DEF" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gradient})`} d="M49.3,-57.7C63.6,-47.5,74.7,-31.7,76.1,-15.5C77.4,0.7,69.1,17.4,57.7,31.6C46.4,45.7,32,57.3,15.2,63.3C-1.6,69.3,-20.8,69.8,-35.3,61.9C-49.8,54,-59.7,37.7,-66.6,19.5C-73.5,1.3,-77.3,-18.8,-70.2,-34.7C-63.1,-50.6,-45.1,-62.3,-27.1,-70.1C-9.1,-77.9,9,-81.9,24.7,-76.1C40.4,-70.4,54.9,-54.9,49.3,-57.7Z" transform="translate(100 100)" />
    </svg>
  )
}

export default function Login({onAuth}){
  const [username,setUsername] = useState('demo')
  const [password,setPassword] = useState('demo123')
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')

  const doLogin = async ()=>{
    setLoading(true); setError('')
    try{
      // try login; if user doesn't exist, register on the fly
      try{
        const res = await login(username,password)
        onAuth(res)
      }catch(e){
        const res = await register(username,password)
        onAuth(res)
      }
    }catch(e){ setError('Unable to authenticate') }
    finally{ setLoading(false) }
  }

  return (
    <div className="login-wrap">
      <Blob style={{top:'-120px', left:'-120px'}} gradient="g1"/>
      <Blob style={{bottom:'-120px', right:'-120px', transform:'scale(1.2)'}} gradient="g2"/>
      <div className="login-card">
        <div className="center" style={{marginBottom:12}}>
          <div style={{width:34,height:34,borderRadius:'50%', background:'#111827', display:'grid',placeItems:'center', color:'white'}}>⦿</div>
        </div>
        <h1>Welcome back</h1>
        <p className="tiny">Sign in to your Personal Expense Tracker</p>
        <div className="spacer"></div>
        <label className="tiny">Username</label>
        <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" />
        <div className="spacer"></div>
        <label className="tiny">Password</label>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
        <div className="spacer"></div>
        <div className="center">
          <button className="btn" onClick={doLogin} disabled={loading}>{loading?'Loading...':'Login'}</button>
        </div>
        {error && <p style={{color:'#ef4444', marginTop:10}}>{error}</p>}
      </div>
    </div>
  )
}
