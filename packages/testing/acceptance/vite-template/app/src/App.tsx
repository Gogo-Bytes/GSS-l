import { lazy, Suspense, useState } from 'react'
import Child from './Child'
import styles from './App.gss'

const Detail = lazy(() => import('./Detail'))

export default function App() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  return <main>
    <Child className={styles.title} />
    <div data-testid="asset" className={styles.art} />
    <button onClick={() => setCount(count + 1)}>Count {count}</button>
    <button onClick={() => setOpen(true)}>Open detail</button>
    <Suspense fallback={<p>Loading</p>}>{open && <Detail />}</Suspense>
  </main>
}
