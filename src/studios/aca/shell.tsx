import { Link } from "react-router-dom";
import { ACA_CATEGORIES, ACA_HOME, type AcaCategoryId } from "../../data/acaLabs";
import { AcaIcon } from "./icons";

export function AcaNav({ current }: { current?: AcaCategoryId | "home" }) {
  return (
    <nav className="aca-nav" aria-label="Advanced Computer Architecture">
      <Link to={ACA_HOME} className={current === "home" ? "on" : ""} aria-current={current === "home" ? "page" : undefined}>
        <AcaIcon name="studio" /> Studio Home
      </Link>
      {ACA_CATEGORIES.map((category) => (
        <Link key={category.id} to={`${ACA_HOME}#${category.id}`} className={current === category.id ? "on" : ""}>
          <AcaIcon name={category.id} /> {category.menu}
        </Link>
      ))}
    </nav>
  );
}
