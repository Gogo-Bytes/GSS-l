import { Links, Meta, Outlet, Scripts, ScrollRestoration, Link } from 'react-router';
import { useState } from 'react';
import stylesheetHref from 'virtual:gss.css?url';
import './app.css';

export const links = () => [{ rel: 'stylesheet', href: stylesheetHref }];

export function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head><meta charSet="utf-8" /><Meta /><Links /></head>
    <body>{children}<ScrollRestoration /><Scripts /></body></html>;
}

export default function App() {
  const [count, setCount] = useState(0);
  return <main><nav><Link to="/">Home</Link> <Link to="/details/42">Detail</Link></nav>
    <button onClick={() => setCount(count + 1)}>Count {count}</button><Outlet /></main>;
}
