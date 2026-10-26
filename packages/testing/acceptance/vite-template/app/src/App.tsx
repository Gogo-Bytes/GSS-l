import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import Child from './Child'
import styles from './App.gss'

const Detail = lazy(() => import('./Detail'))

export default function App() {
  const [count, setCount] = useState(0)
  return <BrowserRouter><main>
    <Child className={styles.title} />
    <nav aria-label="Pages"><Link to="/">Home</Link> <Link to="/details/42">Open detail</Link></nav>
    <button onClick={() => setCount(count + 1)}>Count {count}</button>
    <Suspense fallback={<p>Loading</p>}><Routes>
      <Route path="/" element={<section data-testid="home"><h2>Home route</h2><div data-testid="asset" className={styles.art} /></section>} />
      <Route path="/details/:id" element={<Detail />} />
    </Routes></Suspense>
  </main></BrowserRouter>
}
