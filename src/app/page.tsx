import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.title}>Boekhouding. Simpel.</h1>
        <p className={styles.subtitle}>
          Importeer je bankafschrift, facturen worden automatisch uitgelezen.
          <br />
          Klaar.
        </p>
        <Link href="/register" className={styles.ctaPrimary}>
          Gratis proberen
        </Link>
        <p className={styles.loginLink}>
          Al een account?{" "}
          <Link href="/login" className={styles.loginAnchor}>
            Inloggen
          </Link>
        </p>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.featuresGrid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Bankimport met AI</h3>
            <p className={styles.cardText}>
              Upload je CSV van ING, Rabobank, ABN AMRO of Bunq. AI
              categoriseert automatisch.
            </p>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              Facturen automatisch uitgelezen
            </h3>
            <p className={styles.cardText}>
              Facturen komen binnen via e-mail. OCR leest bedrag, datum en BTW
              uit.
            </p>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>BTW-klaar</h3>
            <p className={styles.cardText}>
              Btw-verlegd, EU/niet-EU, 0/9/21% &mdash; alles automatisch goed
              ingedeeld voor je aangifte.
            </p>
          </div>
        </div>
      </section>

      {/* Hoe het werkt */}
      <section className={styles.steps}>
        <h2 className={styles.sectionTitle}>Hoe het werkt</h2>
        <div className={styles.stepsRow}>
          <div className={styles.step}>
            <span className={styles.stepNumber}>1</span>
            <h3 className={styles.stepTitle}>Importeer</h3>
            <p className={styles.stepText}>
              Upload je bankafschrift of stuur facturen via e-mail
            </p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>2</span>
            <h3 className={styles.stepTitle}>Controleer</h3>
            <p className={styles.stepText}>
              AI categoriseert alles. Jij keurt goed met één klik
            </p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>3</span>
            <h3 className={styles.stepTitle}>Klaar</h3>
            <p className={styles.stepText}>
              BTW-aangifte overzicht staat klaar. Geen gedoe
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className={styles.footerCta}>
        <h2 className={styles.footerTitle}>Begin vandaag met Centjes</h2>
        <Link href="/register" className={styles.ctaPrimary}>
          Gratis proberen
        </Link>
        <p className={styles.loginLink}>
          Al een account?{" "}
          <Link href="/login" className={styles.loginAnchor}>
            Inloggen
          </Link>
        </p>
      </section>
    </div>
  );
}
