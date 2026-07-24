/**
 * ExplanationView — renders one ExplanationModel (the fixed ten sections,
 * collapsible). Refused models render an alert banner and their refusal
 * sections; no result-shaped content is ever shown for them (spec §10.20).
 */

import type {
  ExplanationItem,
  ExplanationModel,
} from "@/features/vector-geometry-lab/explain";
import styles from "./explanation.module.css";

function ItemView({ item }: { readonly item: ExplanationItem }): React.JSX.Element {
  switch (item.kind) {
    case "text":
      return <li className={styles.textItem}>{item.text}</li>;
    case "formula":
      return (
        <li className={styles.formulaItem}>
          <code>{item.formula}</code>
          {item.note !== undefined && <span className={styles.note}> {item.note}</span>}
        </li>
      );
    case "key-value":
      return (
        <li className={styles.kvItem}>
          <span className={styles.kvKey}>{item.key}</span>
          <span className={styles.kvValue}>{item.value}</span>
        </li>
      );
  }
}

export function ExplanationView({
  model,
}: {
  readonly model: ExplanationModel;
}): React.JSX.Element {
  return (
    <article
      className={styles.model}
      data-testid={`explanation-${model.analysisId}`}
      data-status={model.status}
    >
      <header className={styles.modelHeader}>
        <h3>{model.title}</h3>
        <span
          className={
            model.status === "solved" ? styles.badgeSolved : styles.badgeRefused
          }
        >
          {model.status === "solved" ? "solved" : `refused (${model.refusal?.code ?? "?"})`}
        </span>
      </header>
      {model.status === "refused" && (
        <p role="alert" className={styles.refusalBanner}>
          {model.refusal?.message} — no result is displayed for refused inputs.
        </p>
      )}
      {model.sections.map((section) => (
        <details
          key={section.sectionId}
          className={styles.section}
          open={section.order <= 4 || model.status === "refused"}
          data-testid={`section-${section.sectionId}`}
        >
          <summary>
            {section.order}. {section.title}
            {section.items.length === 0 && <span className={styles.note}> (none)</span>}
          </summary>
          <ul className={styles.itemList}>
            {section.items.map((item, index) => (
              <ItemView key={`${section.sectionId}-${index}`} item={item} />
            ))}
          </ul>
        </details>
      ))}
    </article>
  );
}
