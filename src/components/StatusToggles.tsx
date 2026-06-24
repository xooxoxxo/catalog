/** Status filter panel — multi-toggle vertical list inside an IconPopover. */
export function StatusToggles({
  outdated,
  needsEnrichment,
  showHidden,
  hiddenCount,
  onChange,
}: {
  outdated: boolean;
  needsEnrichment: boolean;
  showHidden: boolean;
  hiddenCount: number;
  onChange: (patch: {
    outdated?: boolean;
    needsEnrichment?: boolean;
    showHidden?: boolean;
  }) => void;
}) {
  return (
    <div className="pop-list">
      <div className={`opt ${outdated ? "sel" : ""}`} onClick={() => onChange({ outdated: !outdated })}>
        <span className="cb" />Outdated
      </div>
      <div className={`opt ${needsEnrichment ? "sel" : ""}`} onClick={() => onChange({ needsEnrichment: !needsEnrichment })}>
        <span className="cb" />Needs enrichment
      </div>
      <div className={`opt ${showHidden ? "sel" : ""}`} onClick={() => onChange({ showHidden: !showHidden })}>
        <span className="cb" />Hidden{hiddenCount ? <span className="ct mono">{hiddenCount}</span> : null}
      </div>
    </div>
  );
}
