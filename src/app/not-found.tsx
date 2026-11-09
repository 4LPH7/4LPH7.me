import Link from "next/link";

export default function NotFound() {
  return <main id="main" className="site-shell resume-page not-found-page"><h1>Page not<br /><span>found.</span></h1><p className="hero-copy">That address doesn’t point to a published page.</p><Link className="btn btn-inverse" href="/">Return home</Link></main>;
}
