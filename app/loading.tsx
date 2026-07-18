export default function Loading() {
  return (
    <div className="page" role="status" aria-label="Loading page">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-copy" />
      <div className="skeleton-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <div className="skeleton skeleton-media" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-short" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading SCU content…</span>
    </div>
  );
}
