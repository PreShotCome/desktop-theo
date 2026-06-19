function BrainSection(): JSX.Element {
  return (
    <div className="section">
      <span className="tag">Placeholder</span>
      <div className="placeholder">
        <h2>Brain</h2>
        <p>
          An explorer for Theo’s identity and memory — the axioms and
          notes that persist across model changes (IDENTITY.md, brain.json,
          transcripts).
        </p>
        <p>
          Next milestone: read <code>brain.json</code> through the bridge and
          render categories → axioms, the way the Flutter app’s Brain tab
          does.
        </p>
      </div>
    </div>
  )
}

export default BrainSection
