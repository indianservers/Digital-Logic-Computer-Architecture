import './generated-parts.css';
import type {PartImage} from './part-images';
import { HardwareIdentityPanel } from './HardwareIdentityPanel';

/** Shared component imagery, source credits, and an intact full-resolution download. */
export default function GeneratedPartView({ name, src, art }: { name: string; src: string; art?:PartImage }) {
  const id = src.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? name;
  return <figure className="hdw-generated-part" data-component-id={id}>
    <div className="hdw-generated-part-stage"><img src={art?.preview??src} alt={art?.caption??`${name} — representative standalone component`} loading="lazy" decoding="async" /></div>
    <figcaption><strong>{name}</strong><span>{art?.caption??'Representative hardware illustration'}</span>
      <div>
        <a href={src} target="_blank" rel="noreferrer">View full resolution ↗</a><a href={src} download>Download image</a></div>
      {art?.sourceUrl&&<div className="hdw-image-credit"><span>Image: {art.attribution}</span><a href={art.sourceUrl} target="_blank" rel="noreferrer">Wikimedia Commons source ↗</a>{art.licenseUrl?<a href={art.licenseUrl} target="_blank" rel="noreferrer">{art.license}</a>:<span>{art.license}</span>}</div>}
      {!art?.sourceUrl&&<div className="hdw-image-credit">Source: local educational illustration · creator and license not supplied in image metadata.</div>}
    </figcaption>
    <HardwareIdentityPanel art={art}/>
  </figure>;
}
