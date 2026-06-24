import { CheckCircle, XCircle } from "@phosphor-icons/react";
import type { Dep } from "../types";

export function DependencyView({ deps, onlyMissing = false }: { deps: Dep[]; onlyMissing?: boolean }) {
  const shown = onlyMissing ? deps.filter((d) => !d.present) : deps;

  if (onlyMissing && shown.length === 0) {
    return (
      <div className="doctor-clear">
        <CheckCircle weight="fill" size={34} className="dep-ok" />
        <span className="big">All set</span>
        <span>Every tool catalog uses is installed.</span>
      </div>
    );
  }

  return (
    <>
      <p className="doctor-intro">
        {onlyMissing
          ? "Tools catalog uses that aren't installed — installing them widens coverage:"
          : "catalog shells these tools to catalogue and check your software. Missing ones just limit coverage — nothing breaks."}
      </p>
      <div className="dep-list">
        {shown.map((d) => (
          <div key={d.name} className={`dep-row ${d.present ? "" : "missing"}`}>
            {d.present
              ? <CheckCircle weight="fill" size={18} className="dep-ok" />
              : <XCircle weight="fill" size={18} className="dep-miss" />}
            <div className="dep-main">
              <div className="dep-name"><span className="mono">{d.name}</span> <span className="dep-powers">{d.powers}</span></div>
              {!d.present && <div className="dep-install">install: <span className="mono">{d.install}</span></div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
