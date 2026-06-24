export function SkeletonRows({ n = 8 }: { n?: number }) {
  return (
    <div className="skeletons">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="sk-row">
          <span className="sk sk-star" />
          <span className="sk sk-name" />
          <span className="sk sk-src" />
          <span className="sk sk-ver" />
          <span className="sk sk-desc" />
        </div>
      ))}
    </div>
  );
}
