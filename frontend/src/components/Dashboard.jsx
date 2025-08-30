import React, { useEffect, useMemo, useState } from 'react'
import { addTransaction, delTransaction, getCategories, getTransactions, monthlyReport, spendingByCategory } from '../api.js'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, Scatter, ScatterChart, ZAxis } from 'recharts'

function Icon({children}){ return <span className="icon" aria-hidden>{children}</span> }

function Header({onLogout}){
  return (
    <div className="topbar card">
      <div style={{fontWeight:700}}>Personal Expense Tracker</div>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <div className="search">
          <Icon>🔎</Icon>
          <input placeholder="Search" />
        </div>
        <div className="bell" title="Notifications">🔔<span className="dot" /></div>
      </div>
      <button className="btn" onClick={onLogout}>Logout</button>
    </div>
  )
}

function Sidebar(){
  const [active,setActive] = useState('dashboard')
  const Item = ({id, label, icon})=> (
    <button className={active===id?'active':''} onClick={()=>setActive(id)}><Icon>{icon}</Icon>{label}</button>
  )
  return (
    <aside className="sidebar">
      <div className="brand">Hoolly</div>
      <div className="user"><div className="avatar" /> <div>Hooolly</div></div>
      <div className="nav">
        <Item id="dashboard" label="Dashboard" icon="📊"/>
        <Item id="transactions" label="Transactions" icon="🔁"/>
        <Item id="budgets" label="Budgets" icon="🧭"/>
        <Item id="reports" label="Reports" icon="📈"/>
      </div>
      <div style={{marginTop:18}}>
        <button className="btn" style={{width:'100%'}}>Shoett</button>
      </div>
    </aside>
  )
}

function BigWavyCard({data}){
  // Mimic the abstract multi-colored area + lines
  return (
    <div className="card" style={{position:'relative', height:340}}>
      <h3 style={{margin:'4px 0 12px'}}>Personal Expense Tracker</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{left:0,right:0,top:10,bottom:0}}>
          <defs>
            <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.9}/>
              <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="grad2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3AAE35" stopOpacity={0.85}/>
              <stop offset="100%" stopColor="#3AAE35" stopOpacity={0.15}/>
            </linearGradient>
            <linearGradient id="grad3" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9}/>
              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.2}/>
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f3f4f6"/>
          <XAxis dataKey="m" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="a" stroke="#5B8DEF" fill="url(#grad1)" />
          <Area type="monotone" dataKey="b" stroke="#3AAE35" fill="url(#grad2)" />
          <Line type="monotone" dataKey="c" stroke="#0f172a" dot={{r:4}} strokeWidth={2}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function SpendingBubble({data}){
  // Bubble-ish abstract
  return (
    <div className="card" style={{height:260}}>
      <h3 style={{margin:'6px 0 12px'}}>Spending</h3>
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart>
          <XAxis dataKey="x" type="number" hide />
          <YAxis dataKey="y" type="number" hide />
          <ZAxis dataKey="z" range={[60, 300]} />
          <Tooltip />
          <Scatter data={data} fill="#5B8DEF" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function LineBarCard({line, bars}){
  return (
    <div className="card" style={{height:260}}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={bars}>
          <CartesianGrid vertical={false} stroke="#f3f4f6"/>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="v" radius={[8,8,0,0]}/>
          <Line data={line} type="monotone" dataKey="v" stroke="#3AAE35" dot={{r:4}} strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AddTxForm({categories, onAdd}){
  const [form, setForm] = useState({title:'Coffee', amount:3.5, type:'expense', occurred_on:new Date().toISOString().slice(0,10), category_id: categories[0]?.id})
  return (
    <div className="card">
      <h3>Add Transaction</h3>
      <div className="grid-2">
        <input className="input" placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
        <input className="input" placeholder="Amount" type="number" value={form.amount} onChange={e=>setForm({...form,amount:parseFloat(e.target.value)})}/>
        <select className="input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select className="input" value={form.category_id} onChange={e=>setForm({...form,category_id:parseInt(e.target.value)})}>
          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" type="date" value={form.occurred_on} onChange={e=>setForm({...form,occurred_on:e.target.value})}/>
        <button className="btn" onClick={()=>onAdd(form)}>Add</button>
      </div>
    </div>
  )
}

function Transactions({items, onDelete}){
  return (
    <div className="card">
      <h3>Recent Transactions</h3>
      <table>
        <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Type</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          {items.map(tx=> (
            <tr key={tx.id}>
              <td>{tx.occurred_on}</td>
              <td>{tx.title}</td>
              <td><span className="pill" style={{background:tx.color||'#111827'}}>{tx.category||'—'}</span></td>
              <td>{tx.type}</td>
              <td>${Number(tx.amount).toFixed(2)}</td>
              <td><button onClick={()=>onDelete(tx.id)}>🗑️</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Dashboard({user, onLogout}){
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [monthly, setMonthly] = useState([])
  const [spending, setSpending] = useState([])

  const bigData = useMemo(()=>{
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return months.map((m,i)=>({m, a: Math.round(30+Math.random()*70), b: Math.round(10+Math.random()*90), c: Math.round(10+Math.random()*100)}))
  }, [])

  const bubbleData = useMemo(()=> Array.from({length:6}).map(()=>({x:Math.random()*100,y:Math.random()*100,z:Math.random()*100})), [])

  const barData = useMemo(()=> ['Fo','Cs','Hi','Sp','St','Or','Ct','Sp','Ti'].map((name)=>({name, v: Math.round(10+Math.random()*90)})), [])

  async function refresh(){
    try{
      const [cats, txs, mon, byc] = await Promise.all([getCategories(), getTransactions(), monthlyReport(), spendingByCategory()])
      setCategories(cats); setTransactions(txs); setMonthly(mon); setSpending(byc);
    }catch(e){
      // If API is not running yet, keep demo data so UI is interactive
      if(categories.length===0){
        setCategories([{id:1,name:'Food',color:'#3AAE35'}])
        setTransactions([
          {id:1, title:'Demo Coffee', amount:3.5, type:'expense', occurred_on: new Date().toISOString().slice(0,10), category:'Food', color:'#3AAE35'}
        ])
      }
    }
  }

  useEffect(()=>{ refresh() }, [])

  async function onAdd(form){
    try{
      const tx = await addTransaction(form);
      setTransactions([tx, ...transactions])
    }catch(e){
      // demo mode: push locally
      const tx = { id:Date.now(), ...form, category: categories.find(c=>c.id==form.category_id)?.name, color: categories.find(c=>c.id==form.category_id)?.color }
      setTransactions([tx, ...transactions])
    }
  }

  async function onDelete(id){
    try{ await delTransaction(id) }catch(e){}
    setTransactions(transactions.filter(t=>t.id!==id))
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Header onLogout={onLogout} />
        <div className="grid">
          <BigWavyCard data={bigData} />
          <div className="grid-2">
            <SpendingBubble data={bubbleData} />
            <LineBarCard line={bigData} bars={barData} />
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
          <AddTxForm categories={categories} onAdd={onAdd} />
          <Transactions items={transactions} onDelete={onDelete} />
        </div>
      </main>
    </div>
  )
}
