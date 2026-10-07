import { GENERATED_DEVICE_ART } from './generated-assets';
import { useEffect, useState, lazy, Suspense, type CSSProperties } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { CATEGORIES, DEVICES, FEATURES, STUDIO_PATH, devicePath, findDevice, relatedDevices, searchDevices, type Category, type Device, type DeviceStatus } from "./catalogue";
import "./studio.css";
import LabPage from "./labs/LabPage";
import { LABS, findLab } from "./labs/data";
import { ADVANCED_LABS, findAdvancedLab } from "./advanced/data";
const AdvancedLabPage = lazy(() => import("./advanced/AdvancedLabPage"));
const availableLab = (id: string) => findLab(id) ?? findAdvancedLab(id);

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return <span className={`hdw-status hdw-status-${status}`}><span aria-hidden="true" />{status === "upcoming" ? "Upcoming" : status === "beta" ? "Beta" : "Available"}</span>;
}

export function DeviceThumbnail({ device, eager = false }: { device: Device; eager?: boolean }) {
  const lab = findLab(device.id);
  const advanced = findAdvancedLab(device.id);
  return <img src={(lab && GENERATED_DEVICE_ART[lab.number]?.external) || (advanced && GENERATED_DEVICE_ART[advanced.number]?.external) || (advanced ? `/device-labs/advanced/${String(advanced.number).padStart(3,"0")}-device.webp` : lab ? `/device-labs/${String(lab.number).padStart(2,"0")}-external.webp` : device.thumbnail)} alt={`${device.name} equipment illustration`} width={720} height={440} loading={eager ? "eager" : "lazy"} decoding="async" />;
}

export function DeviceCard({ device, category }: { device: Device; category?: Category }) {
  const label = category?.name ?? device.categories.map(id => CATEGORIES.find(item => item.id === id)?.name).join(" · ");
  return <Link to={devicePath(device)} className="hdw-device-card">
    <div className="hdw-card-art"><DeviceThumbnail device={device} /><DeviceStatusBadge status={availableLab(device.id) ? "available" : device.status} /></div>
    <div className="hdw-card-copy"><span className="hdw-eyebrow">{label}</span><h3>{device.name}</h3><p>{device.shortDescription}</p><span className="hdw-card-link">{availableLab(device.id) ? "Learn how it works" : "Preview this device"} <span aria-hidden="true">↗</span></span></div>
  </Link>;
}

function StudioHero() {
  return <section className="hdw-hero">
    <div className="hdw-hero-copy"><span className="hdw-eyebrow hdw-kicker">INSIDE THE DIGITAL WORLD</span><h1>How Devices<br /><span>Work</span></h1><p className="hdw-lead">Discover what happens inside the digital systems that shape medicine, aviation, robotics, communication and everyday life.</p><p className="hdw-support">Explore sensors, signals, processors, communication links, control systems and digital logic inside real-world devices.</p><div className="hdw-actions"><a href="#devices" className="btn-primary">Explore Devices <span aria-hidden="true">↓</span></a><a href="#categories" className="btn-ghost">Browse Categories</a></div><span className="hdw-hero-note"><span aria-hidden="true">●</span> {LABS.length + ADVANCED_LABS.length} interactive device guides · Explore the systems inside</span></div>
    <div className="hdw-hero-visual"><img src="/devices/studio-collection.svg" alt="MRI scanner, flight instruments, ECG monitor, robotic arm and contactless payment equipment" width={1100} height={680} /><div className="hdw-visual-caption"><span className="hdw-caption-dot" /><span>Real systems.<br /><strong>Remarkable digital stories.</strong></span></div></div>
  </section>;
}

function StudioStats() {
  return <div className="hdw-stats" aria-label="Studio overview">{[[String(DEVICES.length), "Unique devices"], ["6", "Major categories"], [String(LABS.length+ADVANCED_LABS.length), "Learning pages"], [String(DEVICES.length-LABS.length-ADVANCED_LABS.length), "Upcoming devices"]].map(([value,label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

function CategoryNavigator() {
  return <nav id="categories" className="hdw-categories" aria-label="Device categories">{CATEGORIES.map((category, index) => <Link key={category.id} to={`${STUDIO_PATH}#hdw-${category.id}`} style={{ "--hdw-accent": category.accent } as CSSProperties}><span className="hdw-category-number">0{index + 1}</span><strong>{category.name}</strong><span>{DEVICES.filter(device => device.categories.includes(category.id)).length} devices <span aria-hidden="true">↗</span></span></Link>)}</nav>;
}

function CategorySection({ category }: { category: Category }) {
  const [expanded, setExpanded] = useState(false);
  const devices = DEVICES.filter(device => device.categories.includes(category.id));
  // Include imaging and monitoring equipment in the first curated medical selection.
  const highlights = category.id === "medical" ? ["digital-thermometer", "ecg", "mri-scanner", "ct-scanner", "ultrasound-scanner", "pulse-oximeter", "digital-blood-pressure-monitor", "ventilator"] : category.id === "everyday" ? ["tv-remote", "smartphone", "nfc-payment-system", "digital-camera", "wi-fi-router", "television", "bluetooth-headphones", "smartwatch"] : category.id === "marine" ? ["marine-radar", "sonar", "fish-finder", "depth-sounder", "gps-chartplotter", "electronic-compass", "marine-autopilot", "ais"] : [];
  const curated = highlights.length ? highlights.map(slug => devices.find(device => device.slug === slug)).filter((item): item is Device => Boolean(item)) : devices.slice(0, 8);
  return <section id={`hdw-${category.id}`} className="hdw-section" style={{ "--hdw-accent": category.accent } as CSSProperties}><header className="hdw-section-head"><div><span className="hdw-eyebrow">{category.tagline}</span><h2>{category.name} <span className="hdw-count">{devices.length}</span></h2><p>{category.description}</p></div><span className="hdw-section-label">EXPLORE THE COLLECTION</span></header><div id={`hdw-grid-${category.id}`} className="hdw-grid">{(expanded ? devices : curated).map(device => <DeviceCard key={device.id} device={device} category={category} />)}</div><button className="hdw-show-more" type="button" aria-expanded={expanded} aria-controls={`hdw-grid-${category.id}`} onClick={() => setExpanded(value => !value)}>{expanded ? "Show curated selection" : `View All ${category.name} Devices (${devices.length})`} <span aria-hidden="true">{expanded ? "−" : "+"}</span></button></section>;
}

function StudioBreadcrumb({ device }: { device?: Device }) {
  const category = CATEGORIES.find(item => item.id === device?.category);
  return <nav className="hdw-breadcrumb" aria-label="Studio breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><Link to="/studios">Digital Logic Architecture</Link><span aria-hidden="true">/</span>{device ? <><Link to={STUDIO_PATH}>How Devices Work</Link><span aria-hidden="true">/</span><Link to={`${STUDIO_PATH}#hdw-${category?.id}`}>{category?.name}</Link><span aria-hidden="true">/</span><span aria-current="page">{device.name}</span></> : <span aria-current="page">How Devices Work</span>}</nav>;
}

export function HowDevicesWorkStudio() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const results = searchDevices(query);
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);
  function setQuery(value: string) { setParams(value ? { q: value } : {}, { replace: true, preventScrollReset: true }); }
  return <div className="hdw-studio"><StudioBreadcrumb /><StudioHero /><StudioStats /><CategoryNavigator /><section id="devices" className="hdw-search-section"><div><span className="hdw-eyebrow">FIND YOUR NEXT DISCOVERY</span><h2>One device. A whole world inside.</h2></div><label className="hdw-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search devices" placeholder="Search devices..." value={query} onChange={event => setQuery(event.target.value)} />{query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button> : <span className="hdw-search-hint">Name, category or technology</span>}</label></section>{query.trim() ? <section className="hdw-section"><header className="hdw-section-head"><div><h2>Search results</h2><p role="status">{results.length} {results.length === 1 ? "device" : "devices"} matching “{query}”</p></div><button className="btn-ghost" type="button" onClick={() => setQuery("")}>Clear Search</button></header>{results.length ? <div className="hdw-grid">{results.map(device => <DeviceCard key={device.id} device={device} />)}</div> : <div className="hdw-empty"><h3>No devices found</h3><p>Try another device name, category or technology.</p><button className="btn-primary" onClick={() => setQuery("")}>Clear Search</button></div>}</section> : CATEGORIES.map(category => <CategorySection key={category.id} category={category} />)}<footer className="hdw-footer"><strong>Every signal has a story.</strong><p>Explore the collection today. Choose a device and explore its components, signal path and operating principles.</p><Link to="/studios">← Back to all Studios</Link></footer></div>;
}

function SignalFlowPreview({ device }: { device: Device }) {
  return <section className="hdw-flow-section"><header><span className="hdw-eyebrow">FROM INPUT TO INSIGHT</span><h2>Preview the signal journey</h2><p>A conceptual view of the major stages inside {device.name}.</p></header><ol className="hdw-flow">{device.signalFlow.map((step, index) => <li key={`${index}-${step}`}><span className="hdw-flow-number">0{index + 1}</span><strong>{step}</strong>{index < device.signalFlow.length - 1 ? <span className="hdw-flow-arrow" aria-hidden="true">→</span> : null}</li>)}</ol><span className="hdw-small-note">Conceptual preview · the interactive signal explorer is coming soon</span></section>;
}

function UpcomingLabPanel() {
  return <section className="hdw-lab-panel"><div><span className="hdw-eyebrow">A LOOK AT WHAT’S NEXT</span><h2>Device Guide Coming Soon</h2><p>This learning page will allow you to open the device, trace signals, inspect digital data and interact with its major subsystems.</p></div><div className="hdw-lab-preview"><span className="hdw-preview-tag">PREVIEW · COMING SOON</span><div className="hdw-preview-tools">{["Open Device", "Trace Signal", "Circuit View", "Digital View", "Waveforms"].map(label => <span key={label}>{label}</span>)}</div><div className="hdw-preview-circuit" aria-hidden="true"><span>SENSE</span><i /><span>PROCESS</span><i /><span>RESPOND</span></div><p>Your future workspace for discovering the system inside.</p></div></section>;
}

export function DevicePage() {
  const { category, slug } = useParams();
  const device = findDevice(category, slug);
  const location = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);
  if (!device) return <div className="hdw-studio"><StudioBreadcrumb /><section className="hdw-empty"><h1>Device not found</h1><p>This device isn’t in the collection yet.</p><Link to={STUDIO_PATH} className="btn-primary">Back to How Devices Work</Link></section></div>;
  const lab = findLab(device.id);
  if (lab) return <LabPage key={lab.number} lab={lab} />;
  const advanced = findAdvancedLab(device.id);
  if (advanced) return <Suspense fallback={<div className="hdw-empty">Loading device lab…</div>}><AdvancedLabPage key={advanced.number} lab={advanced} /></Suspense>;
  return <div className="hdw-studio"><StudioBreadcrumb device={device} /><Link className="hdw-back" to={STUDIO_PATH}>← Back to How Devices Work</Link><section className="hdw-device-hero"><div><span className="hdw-eyebrow">{device.categories.map(id => CATEGORIES.find(item => item.id === id)?.name).join(" · ")}</span><h1>{device.name}</h1><DeviceStatusBadge status={device.status} /><p className="hdw-lead">{device.shortDescription}</p><span className="hdw-hero-note">UPCOMING DEVICE · INSIDE THE DIGITAL WORLD</span></div><div className="hdw-device-hero-art"><DeviceThumbnail device={device} eager /></div></section><section className="hdw-overview"><span className="hdw-eyebrow">THE SYSTEM BEHIND THE SURFACE</span><h2>How This Device Works</h2><p>{device.longDescription}</p></section><SignalFlowPreview device={device} /><section className="hdw-section"><header className="hdw-section-head"><div><span className="hdw-eyebrow">BUILD YOUR UNDERSTANDING</span><h2>What You Will Explore</h2></div></header><div className="hdw-feature-grid">{device.futureFeatures.map((id, index) => <article className="hdw-feature" key={id}><span className="hdw-feature-number">0{index + 1}</span><span className="hdw-coming">Coming Soon</span><h3>{FEATURES[id].title}</h3><p>{FEATURES[id].description}</p></article>)}</div></section><UpcomingLabPanel /><section className="hdw-section"><header className="hdw-section-head"><div><span className="hdw-eyebrow">KEEP YOUR CURIOSITY GOING</span><h2>Related devices</h2></div><Link to={`${STUDIO_PATH}#hdw-${device.category}`} className="btn-ghost">Browse category →</Link></header><div className="hdw-grid">{relatedDevices(device).map(item => <DeviceCard key={item.id} device={item} />)}</div></section><footer className="hdw-footer"><Link to={STUDIO_PATH}>← Back to How Devices Work</Link></footer></div>;
}

export default HowDevicesWorkStudio;
