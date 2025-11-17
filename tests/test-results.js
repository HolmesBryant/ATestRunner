class TestResults extends HTMLElement {
  constructor() {
    super();
    // Create a Shadow DOM for encapsulation
    this.attachShadow({ mode: 'open' });
    this._render();
    this._attachEventListeners();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        /* All styles are now scoped to this component */
        :host {
          display: block; /* Make the custom element a block container */
        }
        .result {
          padding: 5px 8px;
          margin: 4px 0;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }
        .result.PASS { background-color: #e6ffed; border-left: 4px solid #28a745; }
        .result.FAIL { background-color: #ffebee; border-left: 4px solid #dc3545; color: #c53939; }
        .result.ERROR { background-color: #fce4ec; border-left: 4px solid #e91e63; color: #b71c1c; }
        .result.GROUP_START {
          font-weight: bold;
          margin-top: 15px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 8px;
        }
        /* Style for the group verdict message */
        .result.GROUP_END {
            border-top: 1px solid #ccc;
            margin-top: 8px;
            padding-top: 4px;
            font-weight: bold;
        }
        .result.GROUP_END.pass { color: #28a745; }
        .result.GROUP_END.fail { color: #dc3545; }

        .result-details { font-size: 0.8em; margin-left: 20px; color: #666; }
        #final-verdict {
          margin-top: 20px;
          font-weight: bold;
          padding: 10px;
          border-radius: 5px;
          text-align: center;
        }
        #final-verdict.pass { background-color: #28a745; color: white; }
        #final-verdict.fail { background-color: #dc3545; color: white; }
      </style>
      <div id="results-container"></div>
      <div id="final-verdict"></div>
    `;
    // Cache references to the DOM elements
    this.resultsContainer = this.shadowRoot.querySelector('#results-container');
    this.finalVerdictEl = this.shadowRoot.querySelector('#final-verdict');
  }

  _attachEventListeners() {
    // Listen for events dispatched on this element
    this.addEventListener('a-testresult', e => {
      e.stopPropagation(); // Stop the event from bubbling further
      const { gist, verdict, result, expect, groupVerdict } = e.detail;
      const resultEl = document.createElement('div');
      resultEl.className = `result ${verdict}`;

      let content = '';

      if (verdict === 'GROUP_END') {
          // Display the group verdict from the event detail
          resultEl.classList.add(groupVerdict); // Add .pass or .fail for color
          content = `<b>Group Verdict: ${groupVerdict.toUpperCase()}</b>`;
      } else {
          content = `<b>${verdict}</b>: ${gist}`;
          if (verdict === 'FAIL' || verdict === 'ERROR') {
            content += `<div class="result-details">
              <b>Result:</b> ${JSON.stringify(result)}<br>
              <b>Expected:</b> ${JSON.stringify(expect)}
            </div>`;
          }
      }
      resultEl.innerHTML = content;
      this.resultsContainer.appendChild(resultEl);
    });

    // Listen for the final completion event
    this.addEventListener('a-complete', e => {
      e.stopPropagation();
      const { verdict } = e.detail;
      this.finalVerdictEl.textContent = `All tests complete. Final Verdict: ${verdict.toUpperCase()}`;
      this.finalVerdictEl.className = verdict;
    });
  }
}

// Register the custom element with the browser
customElements.define('test-results', TestResults);
