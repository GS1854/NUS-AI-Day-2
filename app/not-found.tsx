import Link from 'next/link';

export default function NotFound() {
  return <main className="login-shell"><section className="login-panel"><p className="eyebrow">404</p><h1>That page is not here.</h1><Link className="primary-button" href="/">Return to tasks</Link></section></main>;
}
