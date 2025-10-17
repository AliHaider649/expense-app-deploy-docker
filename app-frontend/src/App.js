
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token')||'');
  const [view, setView] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');

  useEffect(()=>{ if (token) fetchExpenses(); }, [token]);

  const api = axios.create({ baseURL: API, headers: { Authorization: token ? `Bearer ${token}` : '' } });

  async function register() {
    try { await api.post('/api/auth/register', { username, password }); alert('Registered — please login'); setView('login'); }
    catch(e){ alert(e.response?.data?.error || e.message); }
  }
  async function login() {
    try { const r = await api.post('/api/auth/login', { username, password }); localStorage.setItem('token', r.data.token); setToken(r.data.token); setView('dashboard'); }
    catch(e){ alert(e.response?.data?.error || e.message); }
  }
  async function fetchExpenses() {
    try { const r = await api.get('/api/expenses'); setExpenses(r.data); }
    catch(e){ console.error(e); }
  }
  async function addExpense() {
    try { await api.post('/api/expenses', { title, amount, category }); setTitle(''); setAmount(''); setCategory(''); fetchExpenses(); }
    catch(e){ alert(e.response?.data?.error || e.message); }
  }
  async function logout() { localStorage.removeItem('token'); setToken(''); setView('login'); }

  if (!token && view==='login') return (
    <div style={{padding:20}}>
      <h2>Login</h2>
      <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} /><br/>
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /><br/>
      <button onClick={login}>Login</button> <button onClick={()=>setView('register')}>Register</button>
    </div>
  );
  if (!token && view==='register') return (
    <div style={{padding:20}}>
      <h2>Register</h2>
      <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} /><br/>
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /><br/>
      <button onClick={register}>Register</button> <button onClick={()=>setView('login')}>Back</button>
    </div>
  );

  return (
    <div style={{padding:20}}>
      <h1>Expense Tracker</h1>
      <button onClick={logout}>Logout</button>
      <h2>Add Expense</h2>
      <input placeholder="title" value={title} onChange={e=>setTitle(e.target.value)} /> <br/>
      <input placeholder="amount" value={amount} onChange={e=>setAmount(e.target.value)} /> <br/>
      <input placeholder="category" value={category} onChange={e=>setCategory(e.target.value)} /> <br/>
      <button onClick={addExpense}>Add</button>
      <h2>Your Expenses</h2>
      <ul>{expenses.map(ex => <li key={ex.id}>{ex.title} - ${ex.amount} ({ex.category})</li>)}</ul>
    </div>
  );
}

export default App;
