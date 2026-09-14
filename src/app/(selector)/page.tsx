import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="title">
        <p className="eyebrow">Football · Fútbol · Rankings</p>
        <h1 id="title">Rango 90</h1>
        <p className="lead">Elige idioma / Choose a language</p>
        <div className="language-choices">
          <Link className="primary language-choice" href="/es/">
            Español
          </Link>
          <Link className="secondary language-choice" href="/en/">
            English
          </Link>
        </div>
      </section>
      <footer>The competition starts with a ranking.</footer>
    </main>
  );
}
