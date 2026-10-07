import { useState } from 'react';
import './generated-parts.css';

/** Each part remains a separate alpha asset with an independent transform origin. */
export default function GeneratedPartView({ name, src }: { name: string; src: string }) {
  const [moving, setMoving] = useState(false);
  const id = src.split('/').at(-1)?.replace('.png', '') ?? name;
  return <figure className="hdw-generated-part" data-component-id={id} data-motion={moving}>
    <div className="hdw-generated-part-stage"><img src={src} alt={`${name} — standalone component`} loading="lazy" decoding="async" /></div>
    <figcaption><strong>{name}</strong><span>Representative hardware illustration</span>
      <div><button onClick={() => setMoving(v => !v)} aria-pressed={moving}>{moving ? 'Stop motion preview' : 'Preview part motion'}</button>
        <a href={src} target="_blank" rel="noreferrer">View full resolution ↗</a><a href={src} download>Download PNG</a></div>
    </figcaption>
  </figure>;
}
