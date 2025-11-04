// src/components/FooterBar/FooterBar.tsx
export default function FooterBar({ linkedin, twitter }: { linkedin: string; twitter: string }) {
  return (
    <footer className="wl-footer">
      <span className="wl-footer-copy">© {new Date().getFullYear()} Permanent Thematic Watchlist</span>
      <ul className="wl-social">
        <li><a className="wl-social-link" href={linkedin} target="_blank" rel="noreferrer"><span className="wl-social-ico">in</span> LinkedIn</a></li>
        <li><a className="wl-social-link" href={twitter}  target="_blank" rel="noreferrer"><span className="wl-social-ico">𝕏</span> X (Twitter)</a></li>
      </ul>
    </footer>
  );
}
