'use client';
export default function Error({reset}:{reset:()=>void}){return <main id="main" className="error-page"><h1>We couldn’t open this view.</h1><p>Your saved records remain in the database. Retry to reconnect.</p><button className="button primary" onClick={reset}>Try again</button></main>;}
