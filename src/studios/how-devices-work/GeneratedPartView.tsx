import { useState } from 'react';
import './generated-parts.css';
import type {PartImage} from './part-images';

/** Shared component imagery, source credits, and an intact full-resolution download. */
export default function GeneratedPartView({ name, src, art }: { name: string; src: string; art?:PartImage }) {
  const [moving, setMoving] = useState(false);
  const id = src.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? name;
  return <figure className="hdw-generated-part" data-component-id={id} data-motion={moving}>
    <div className="hdw-generated-part-stage"><img src={art?.preview??src} alt={art?.caption??`${name} — representative standalone component`} loading="lazy" decoding="async" /></div>
    <figcaption><strong>{name}</strong><span>{art?.caption??'Representative hardware illustration'}</span>
      <div><button onClick={() => setMoving(v => !v)} aria-pressed={moving}>{moving ? 'Stop motion preview' : 'Preview part motion'}</button>
        <a href={src} target="_blank" rel="noreferrer">View full resolution ↗</a><a href={src} download>Download image</a></div>
      {art?.sourceUrl&&<div className="hdw-image-credit"><span>Image: {art.attribution}</span><a href={art.sourceUrl} target="_blank" rel="noreferrer">Wikimedia Commons source ↗</a>{art.licenseUrl?<a href={art.licenseUrl} target="_blank" rel="noreferrer">{art.license}</a>:<span>{art.license}</span>}</div>}
    </figcaption>
  </figure>;
}
