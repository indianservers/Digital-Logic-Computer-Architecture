import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Toggle } from "../../design-system/ui";
import { Icon } from "../../design-system/icons";
import { searchStudios } from "../../data/curriculum";
import { usePrefs } from "../../store/prefs";
import "./numbers.css";
const HERO: Record<string, [
    string,
    string,
    string,
    string
]> = {
    convert: ["Convert between decimal, binary, octal, and hexadecimal", "Numbers can be represented in different bases. Each position has a place value (a power of the base), and grouping bits makes conversion between bases simple: 3 bits for octal and 4 bits for hexadecimal.", "1010", "A"],
    math: ["Binary add, subtract, multiply, divide", "Work with binary numbers using the same arithmetic rules as decimal, but with only 0 and 1. Addition uses carries, subtraction uses borrows, multiplication uses shifted partial products, and division uses repeated subtraction or long division.", "1011 + 0110", "10001"],
    signed: ["Represent positive and negative numbers in binary", "In signed binary representations, the most significant bit (MSB) indicates the sign: 0 for positive, 1 for negative. Two’s complement forms negative numbers by inverting all bits and adding 1.", "+13", "−13"],
    fixed: ["Scale values with a fixed binary point", "Fixed-point representation uses a fixed number of fractional bits. A value is stored as an integer and interpreted with Value = Integer × 2⁻ᶠʳᵃᶜᵗⁱᵒⁿᵃˡ ᵇⁱᵗˢ. This is often written in Q format, such as Q4.4 (4 integer bits, 4 fractional bits).", "Q4.4", "13.625"],
    ieee: ["Split a floating-point value into sign, exponent, and fraction", "A floating-point number in IEEE-754 is represented by a sign bit, a biased exponent, and a fraction (mantissa). This representation lets computers express a very wide range of real numbers, from very small to very large.", "32", "64"],
    codes: ["Map values into standard digital codes", "The same value can be represented using different digital codes, each designed for a specific purpose. Explore BCD, Gray code, Excess-3, and ASCII to see how numbers and characters are encoded in binary.", "59", "0101 1001"],
    parity: ["Detect transmission errors with redundancy", "We add extra bits (parity, checksums, or CRC) to detect errors that can happen when data is stored or transmitted. The receiver recomputes the check; if it doesn’t match, an error is detected.", "1011001", "1010001"],
    hamming: ["Locate and correct a single-bit error", "Hamming code adds parity bits at specific positions so a single-bit error can be detected and corrected. Parity checks form a syndrome that reveals the error position, which we then flip to recover the original data.", "7,4", "1"]
};
const STEPS: Record<string, string[]> = { convert: ["Enter a number", "Explore representations", "Look at place values", "Try different numbers"], math: ["Enter two numbers", "Choose an operation", "Look at the steps", "Try different values"], signed: ["Enter a number", "Explore representations", "Compare the patterns", "Check the range"], fixed: ["Set the fixed-point format", "Enter a value", "Explore the visualization", "Try different settings"], ieee: ["Enter a decimal value", "Explore the fields", "Understand the exponent", "Try special cases"], codes: ["Enter a value", "Explore code representations", "Compare in the table", "Try different inputs"], parity: ["Explore parity and checksums", "Simulate transmission errors", "Learn CRC intuition", "Try your own examples"], hamming: ["Enter a data word", "Explore error detection", "Find the error position", "Correct the word"] };
export function NumbersChrome({ tab, tabs, onTab, onReset, guide, takeaways, what, why, notice, children }: {
    tab: string;
    tabs: {
        id: string;
        label: string;
    }[];
    onTab: (id: string) => void;
    onReset: () => void;
    guide: string[];
    takeaways: string[];
    what: string;
    why: string;
    notice: string;
    children: ReactNode;
}) {
    const { prefs, update } = usePrefs();
    const navigate = useNavigate();
    const hero = HERO[tab]!;
    return <div className="ns-page"><header className="ns-nav"><Link className="ns-brand" to="/"><svg className="ns-planet" width="40" height="34" viewBox="0 0 44 34" aria-hidden="true"><defs><linearGradient id="ns-planet-fill" x2="1" y2="1"><stop stopColor="#6fd5ff"/><stop offset="1" stopColor="#0868ff"/></linearGradient></defs><circle cx="23" cy="16" r="12" fill="url(#ns-planet-fill)"/><ellipse cx="22" cy="18" rx="21" ry="5" transform="rotate(-24 22 18)" stroke="#5cbaff" strokeWidth="2.5" fill="none"/><path d="M15 9q6-5 10-2" stroke="#a6eaff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>Math Universe</Link><nav><Link to="/"><Icon name="home"/>Home</Link><Link to="/studios" className="selected"><Icon name="project"/>Studios</Link><Link to="/practice"><Icon name="practice"/>Practice</Link><Link to="/learn"><Icon name="path"/>Progress</Link></nav><div className="ns-search"><Icon name="search"/><input aria-label="Search topics" placeholder="Search topics, e.g. two’s complement" onKeyDown={event => { if (event.key === 'Enter') {
        const hit = searchStudios(event.currentTarget.value).find(item => item.active);
        if (hit)
            navigate(hit.path);
    } }}/></div><span className="ns-practice">Practice {prefs.challenges.length} / 11</span><Toggle on={prefs.explain} onChange={explain => update({ explain })} label="Explain"/><span className="ns-offline">● Offline Ready</span><Icon name="bell"/><span className="ns-avatar">S</span></header><div className="ns-body"><div className="ns-crumb"><Link to="/">Home</Link>　›　<Link to="/studios">Studios</Link>　›　<b>Number Systems</b></div><div className="ns-heading"><span className="ns-heading-icon"><Icon name="book" size={36}/></span><div><h1>Number Systems &amp; Data Representation</h1><p>Change a digit, a bit, or a code and every related representation updates immediately.</p></div><div className="ns-actions"><Toggle on={prefs.explain} onChange={explain => update({ explain })} label="Explain"/><button onClick={onReset}><Icon name="reset"/>Reset</button><Link to="/"><Icon name="back"/>Back to Path</Link></div></div><div className="ns-layout"><main><div className="ns-tabs" role="tablist" aria-label="Number systems labs">{tabs.map((t, i) => <button role="tab" aria-selected={tab === t.id} key={t.id} onClick={() => onTab(t.id)} className={tab === t.id ? 'active' : ''}><TabIcon index={i}/>{t.label}</button>)}</div><section className="ns-hero"><span className="ns-bulb"><Bulb /></span><div><h2>{hero[0]}</h2><p>{hero[1]}</p></div><HeroArt tab={tab} left={hero[2]} right={hero[3]}/></section>{prefs.explain && <section className="ns-explain">{[["⚙", "What changed", what], ["?", "Why", why], ["◉", "Notice", notice]].map(([icon, title, body]) => <div key={title}><span className="ns-explain-icon">{icon}</span><div><h3>{title}</h3><p>{body}</p></div></div>)}</section>}{children}</main><aside className="ns-guide"><section className="ns-card"><h2><Icon name="book"/>Studio Guide</h2><ol>{guide.map((step, i) => <li key={step}><span>{i + 1}</span><div><b>{STEPS[tab]?.[i]}</b><p>{step}</p></div></li>)}</ol></section><section className="ns-card ns-takeaways"><h2><Bulb />Key Takeaways</h2><ul>{takeaways.map(item => <li key={item}><span>✓</span>{item}</li>)}</ul></section><section className="ns-card ns-quote"><span>❝</span><div><i>{tab === 'hamming' ? "The purpose of computing is insight, not numbers." : "Numbers are the language in which the universe is written."}</i><small>— {tab === 'hamming' ? "Richard Hamming" : "Galileo"}</small></div></section></aside></div></div></div>;
}
function Bulb() { return <svg width="34" height="40" viewBox="0 0 32 40" fill="none" aria-hidden="true"><path d="M8 18a9 9 0 1 1 16 0c-3 4-3 5-3 8H11c0-3 0-4-3-8" fill="currentColor"/><path d="M12 30h8M13 34h6M16 1v3M1 12h4M27 12h4M4 3l4 4M28 3l-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>; }
function TabIcon({ index }: {
    index: number;
}) {
    const paths = [<><path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5v5"/></>, <path d="M12 4v16M4 12h16"/>, <path d="M12 3v11M7 8h10M5 19h14"/>, <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>, <><path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6M12 6v6l4 2"/></>, <path d="m7 6-5 6 5 6M17 6l5 6-5 6M14 3l-4 18"/>, <><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM12 3v18M3 11h18"/></>, <><circle cx="12" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/><path d="M12 6v6M4 18v-6h16v6"/></>];
    return <svg className="ns-tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[index]}</svg>;
}
function HeroArt({ tab, left, right }: {
    tab: string;
    left: string;
    right: string;
}) {
    const captions: Record<string, [
        string,
        string
    ]> = { convert: ['(base 2)', '(base 16)'], math: ['(11) + (6)', '(17)'], signed: ['00001101', '11110011'], fixed: ['8 bits total', 'represented exactly'], ieee: ['bits (single)', 'bits (double)'], codes: ['(decimal)', '(BCD)'], hamming: ['Hamming code', 'Error corrected'], parity: ['Sent', 'Received'] };
    return <div className={`ns-hero-art ${tab === 'parity' ? 'ns-art-parity' : ''}`}><div><b>{left}</b><small>{captions[tab]?.[0]}</small></div>{tab === 'parity' ? <span className="ns-channel"><strong>ϟ</strong>Channel<small>(with noise)</small></span> : <span>{tab === 'math' ? '→' : '⇄'}</span>}<div><b>{right}</b><small>{captions[tab]?.[1]}</small></div></div>;
}
