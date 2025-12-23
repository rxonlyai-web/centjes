import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Boekhouding. Simpel.</h1>
        <p className={styles.subtitle}>
          De moderne boekhoudtool voor ZZP&apos;ers en VOF&apos;s.
          <br />
          Minder saai, meer inzicht.
        </p>
        
        <div className={styles.ctas}>
          <Link href="/login" className={styles.primary}>
            Inloggen
          </Link>
          <Link href="/register" className={styles.secondary}>
            Registreren
          </Link>
        </div>
      </main>
    </div>
  );
}
