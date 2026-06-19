import { useState } from 'react'

function CodeSection(): JSX.Element {
  const [text, setText] = useState(
    '// Code section.\n' +
      '// This is where Theo’s coding tools integrate later — a real\n' +
      '// editor (Monaco) plus the run_command / git / file tools from the\n' +
      '// Python agent. For now it’s a scratch buffer so the section is live.\n'
  )

  return (
    <div className="section">
      <span className="tag">Placeholder</span>
      <div className="placeholder">
        <h2>Code</h2>
        <p>
          The home for Theo’s coding capabilities. Next milestone: swap this
          scratch buffer for a Monaco editor and connect the agent’s file /
          shell / git tools.
        </p>
      </div>
      <textarea
        className="editor mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
    </div>
  )
}

export default CodeSection
