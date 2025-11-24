import Globe from "@/components/Globe/Globe";

export default function Home() {
  return (
    <main>
      <div className="globe-main-container">
        <Globe />
      </div>

      <header className="title-overlay">
        <h1 className="title">3D Earth Renderer</h1>
        <p className="subtitle">
          Interactive 3D real-time globe visualization.
        </p>
      </header>

      <footer className="footer">
        <div className="footer-author">
          <p className="footer-author-text">
            © 2025 by{" "}
            <span className="footer-highlight">Martí Castell Guerrero</span>.{" "}
            All rights reserved.
          </p>
        </div>

        <div className="footer-stack">
          <div className="footer-stack-list">
            <span className="footer-highlight">Tech Stack:</span>
            <span>Next.js</span>
            <span className="footer-separator">•</span>
            <span>Three.js</span>
            <span className="footer-separator">•</span>
            <span>WebGL</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
