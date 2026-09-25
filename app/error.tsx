'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="login-shell"><section className="login-panel"><p className="eyebrow">ERROR</p><h1>Something went wrong.</h1><button className="primary-button" onClick={reset}>Try again</button></section></main>;
}
