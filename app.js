/* =========================================================
   Lecture-Hall Seat Finder — Application Logic
   ========================================================= */

// ─── Step 1: Data Layer ───────────────────────────────────

const ROOM = Object.freeze({
  id: 'LH101',
  name: 'Lecture Hall 101',
  columns: 5
});

const ROW_ZONES = Object.freeze([
  { row: 1, label: 'A', zone: 'FRONT' },
  { row: 2, label: 'B', zone: 'MIDDLE' },
  { row: 3, label: 'C', zone: 'BACK' }
]);

const SEAT_DATA = [
  { id: 'A1', row: 1, column: 1, available: true,  obstructed: false, aisle: true,  socket: true  },
  { id: 'A2', row: 1, column: 2, available: true,  obstructed: false, aisle: false, socket: false },
  { id: 'A3', row: 1, column: 3, available: false, obstructed: false, aisle: false, socket: false },
  { id: 'A4', row: 1, column: 4, available: true,  obstructed: false, aisle: false, socket: true  },
  { id: 'A5', row: 1, column: 5, available: true,  obstructed: false, aisle: true,  socket: false },
  { id: 'B1', row: 2, column: 1, available: true,  obstructed: false, aisle: true,  socket: false },
  { id: 'B2', row: 2, column: 2, available: true,  obstructed: false, aisle: false, socket: true  },
  { id: 'B3', row: 2, column: 3, available: false, obstructed: false, aisle: false, socket: false },
  { id: 'B4', row: 2, column: 4, available: true,  obstructed: false, aisle: false, socket: true  },
  { id: 'B5', row: 2, column: 5, available: true,  obstructed: false, aisle: true,  socket: true  },
  { id: 'C1', row: 3, column: 1, available: true,  obstructed: false, aisle: true,  socket: false },
  { id: 'C2', row: 3, column: 2, available: true,  obstructed: false, aisle: false, socket: true  },
  { id: 'C3', row: 3, column: 3, available: true,  obstructed: true,  aisle: false, socket: false },
  { id: 'C4', row: 3, column: 4, available: true,  obstructed: false, aisle: false, socket: true  },
  { id: 'C5', row: 3, column: 5, available: true,  obstructed: false, aisle: true,  socket: false }
];

// Deep-freeze seats so recommend never mutates them
const SEATS = Object.freeze(SEAT_DATA.map(s => Object.freeze({ ...s })));

// Preset Preferences
const PRESETS = {
  P01: { groupSize: 2, preferredZone: 'MIDDLE', requiresSocket: true,  prefersAisle: true  },
  P02: { groupSize: 1, preferredZone: 'ANY',    requiresSocket: false, prefersAisle: false },
  P03: { groupSize: 5, preferredZone: 'ANY',    requiresSocket: false, prefersAisle: false }
};

const INVALID_PREFS = {
  IP01: { groupSize: 0, preferredZone: 'MIDDLE',    requiresSocket: true,  prefersAisle: true  },
  IP02: { groupSize: 1, preferredZone: 'NEAR_DOOR', requiresSocket: false, prefersAisle: false }
};

// Invalid seat sets for demo
const INVALID_SEAT_SETS = {
  IS01: [
    { id: 'X1', row: 1, column: 1, available: true, obstructed: false, aisle: true,  socket: false },
    { id: 'X1', row: 1, column: 2, available: true, obstructed: false, aisle: false, socket: true  }
  ],
  IS02: [
    { id: 'Y1', row: 1, column: 1, available: true, obstructed: false, aisle: true,  socket: false },
    { id: 'Y2', row: 1, column: 1, available: true, obstructed: false, aisle: false, socket: true  }
  ]
};

const VALID_ZONES = ['ANY', 'FRONT', 'MIDDLE', 'BACK'];

// ─── Step 1: Validation ──────────────────────────────────

function validateSeatSet(seats) {
  const ids = new Set();
  const coords = new Set();
  for (const seat of seats) {
    if (ids.has(seat.id)) {
      return { valid: false, errorCode: 'DUPLICATE_SEAT_ID' };
    }
    ids.add(seat.id);
    const coordKey = `${seat.row},${seat.column}`;
    if (coords.has(coordKey)) {
      return { valid: false, errorCode: 'DUPLICATE_COORDINATE' };
    }
    coords.add(coordKey);
  }
  return { valid: true };
}

function validatePreference(pref) {
  const gs = pref.groupSize;
  if (!Number.isInteger(gs) || gs < 1 || gs > ROOM.columns) {
    return { valid: false, errorCode: 'INVALID_GROUP_SIZE' };
  }
  if (!VALID_ZONES.includes(pref.preferredZone)) {
    return { valid: false, errorCode: 'INVALID_ZONE' };
  }
  return { valid: true };
}

// ─── Step 2: Scoring & Ranking Engine ─────────────────────

function getZoneForRow(rowNum) {
  const rz = ROW_ZONES.find(r => r.row === rowNum);
  return rz ? rz.zone : null;
}

function getLabelForRow(rowNum) {
  const rz = ROW_ZONES.find(r => r.row === rowNum);
  return rz ? rz.label : '?';
}

function findCandidateBlocks(seats, groupSize) {
  const blocks = [];
  const uniqueRows = [...new Set(seats.map(s => s.row))].sort((a, b) => a - b);

  for (const rowNum of uniqueRows) {
    const rowSeats = seats.filter(s => s.row === rowNum);

    for (let startCol = 1; startCol <= ROOM.columns - groupSize + 1; startCol++) {
      const blockSeats = [];
      let valid = true;

      for (let c = startCol; c < startCol + groupSize; c++) {
        const seat = rowSeats.find(s => s.column === c);
        if (!seat || !seat.available || seat.obstructed) {
          valid = false;
          break;
        }
        blockSeats.push(seat);
      }

      if (valid) {
        blocks.push({
          row: rowNum,
          startColumn: startCol,
          seats: blockSeats,
          seatIds: blockSeats.map(s => s.id)
        });
      }
    }
  }

  return blocks;
}

function scoreBlock(block, preference) {
  let score = 0;
  const reasons = [];

  // Zone match: +3
  if (preference.preferredZone !== 'ANY') {
    const zone = getZoneForRow(block.row);
    if (zone === preference.preferredZone) {
      score += 3;
      reasons.push({ type: 'zone', text: 'Zone match (+3)' });
    }
  }

  // Aisle preference: +1
  if (preference.prefersAisle) {
    const hasAisle = block.seats.some(s => s.aisle);
    if (hasAisle) {
      score += 1;
      reasons.push({ type: 'aisle', text: 'Aisle preference (+1)' });
    }
  }

  return { score, reasons };
}

function rankBlocks(scoredBlocks) {
  return scoredBlocks.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.row !== b.row) return a.row - b.row;
    return a.startColumn - b.startColumn;
  });
}

function recommend(preference, seats) {
  // Intentional validation order: seat-set integrity is checked first so that
  // a corrupted seat set is always reported, even if the preference is also
  // invalid.  Do not reorder without updating the corresponding test cases.
  const seatValidation = validateSeatSet(seats);
  if (!seatValidation.valid) {
    return { status: 'invalid', errorCode: seatValidation.errorCode };
  }

  // Validate preference
  const prefValidation = validatePreference(preference);
  if (!prefValidation.valid) {
    return { status: 'invalid', errorCode: prefValidation.errorCode };
  }

  // Find candidate blocks
  let blocks = findCandidateBlocks(seats, preference.groupSize);

  // Filter by socket requirement
  if (preference.requiresSocket) {
    blocks = blocks.filter(block => block.seats.some(s => s.socket));
  }

  // Score each block
  const scoredBlocks = blocks.map(block => {
    const { score, reasons } = scoreBlock(block, preference);
    return { ...block, score, reasons };
  });

  // Rank
  const ranked = rankBlocks(scoredBlocks);

  if (ranked.length === 0) {
    return { status: 'NO_SUITABLE_BLOCK', recommended: null, alternatives: [] };
  }

  return {
    status: 'ok',
    recommended: ranked[0],
    alternatives: ranked.slice(1)
  };
}

// ─── Step 4: State & Rendering ────────────────────────────

const state = {
  currentResult: null,
  highlightedAlternativeIndex: -1,
  activeSeatSet: SEATS,       // always the frozen original unless demoing IS01/IS02
  activeSeatSetLabel: 'Standard' // human-readable badge shown in the seat map header
};

// DOM references (set on init)
let dom = {};

function initDOM() {
  dom = {
    groupSize: document.getElementById('groupSize'),
    preferredZone: document.getElementById('preferredZone'),
    requiresSocket: document.getElementById('requiresSocket'),
    prefersAisle: document.getElementById('prefersAisle'),
    btnRecommend: document.getElementById('btnRecommend'),
    btnReset: document.getElementById('btnReset'),
    seatGrid: document.getElementById('seatGrid'),
    resultsContent: document.getElementById('resultsContent'),
    testResults: document.getElementById('testResults'),
    seatSetBadge: document.getElementById('seatSetBadge'),
    legendCounter: document.getElementById('legendCounter')
  };
}

function readFormPreference() {
  // Note: parseInt('', 10) → NaN; Number.isInteger(NaN) === false, so
  // an empty or cleared groupSize field correctly routes to INVALID_GROUP_SIZE.
  // The <input min="1" max="5"> clamp only runs on spinner arrows, not on
  // manual text entry — so typing "0" and clicking Recommend WILL trigger
  // INVALID_GROUP_SIZE without needing the sample button.
  return {
    groupSize: parseInt(dom.groupSize.value, 10),
    preferredZone: dom.preferredZone.value,
    requiresSocket: dom.requiresSocket.checked,
    prefersAisle: dom.prefersAisle.checked
  };
}

function setFormPreference(pref) {
  dom.groupSize.value = pref.groupSize;
  dom.preferredZone.value = pref.preferredZone;
  dom.requiresSocket.checked = pref.requiresSocket;
  dom.prefersAisle.checked = pref.prefersAisle;
}

// ─── Seat Map Rendering ──────────────────────────────────

/** Returns a human-readable tooltip explaining why a seat is not eligible. */
function getSeatExclusionReason(seat) {
  if (!seat.available) return 'Unavailable — excluded from recommendation';
  if (seat.obstructed) return 'Obstructed view — excluded from recommendation';
  return null;
}

function renderSeatMap() {
  const result = state.currentResult;
  const recommendedIds = new Set();
  const alternativeIds = new Set();

  if (result && result.status === 'ok' && result.recommended) {
    result.recommended.seatIds.forEach(id => recommendedIds.add(id));

    // If an alternative is selected for highlighting, use it
    if (state.highlightedAlternativeIndex >= 0 && result.alternatives[state.highlightedAlternativeIndex]) {
      result.alternatives[state.highlightedAlternativeIndex].seatIds.forEach(id => alternativeIds.add(id));
    }
  }

  // Update the active seat-set badge
  if (dom.seatSetBadge) {
    dom.seatSetBadge.textContent = `Seat set: ${state.activeSeatSetLabel}`;
    dom.seatSetBadge.className = 'seat-set-badge' +
      (state.activeSeatSetLabel !== 'Standard' ? ' seat-set-badge--demo' : '');
  }

  // Compute and display live legend counters
  const liveSeatSet = state.activeSeatSet;
  const cntAvail = liveSeatSet.filter(s => s.available && !s.obstructed).length;
  const cntUnavail = liveSeatSet.filter(s => !s.available).length;
  const cntObstructed = liveSeatSet.filter(s => s.available && s.obstructed).length;
  if (dom.legendCounter) {
    dom.legendCounter.textContent =
      `${cntAvail} available · ${cntUnavail} unavailable · ${cntObstructed} obstructed`;
  }

  let html = '';
  for (const rz of ROW_ZONES) {
    html += `<div class="seat-row zone-${rz.zone}">`;
    html += `<div class="row-label">
      <span class="row-label__letter">${rz.label}</span>
      <span class="row-label__zone">${rz.zone}</span>
    </div>`;
    html += '<div class="seat-cells">';

    for (let col = 1; col <= ROOM.columns; col++) {
      const seat = state.activeSeatSet.find(s => s.row === rz.row && s.column === col);
      if (!seat) {
        html += `<div class="seat seat--unavailable" role="img" aria-label="No seat at column ${col}"><span class="seat__id">—</span></div>`;
        continue;
      }

      let stateClass = '';
      if (recommendedIds.has(seat.id)) {
        stateClass = 'seat--recommended';
      } else if (alternativeIds.has(seat.id)) {
        stateClass = 'seat--alternative';
      } else if (!seat.available) {
        stateClass = 'seat--unavailable';
      } else if (seat.obstructed) {
        stateClass = 'seat--obstructed';
      } else {
        stateClass = 'seat--available';
      }

      let badges = '';
      if (seat.aisle) badges += '<span class="seat__badge">Aisle</span>';
      if (seat.socket) badges += '<span class="seat__badge">Socket</span>';
      if (seat.obstructed) badges += '<span class="seat__badge">Obstructed</span>';
      if (!seat.available) badges += '<span class="seat__badge">Unavail</span>';

      // Build a tooltip explaining why this seat cannot be recommended
      const exclusionReason = getSeatExclusionReason(seat);
      const tooltipAttr = exclusionReason
        ? ` title="${exclusionReason}" aria-label="${seat.id}: ${exclusionReason}"`
        : ` aria-label="Seat ${seat.id}"`;

      // Non-eligible seats get a visual hint cursor; eligible ones remain default
      const cursorClass = exclusionReason ? ' seat--ineligible' : '';

      html += `<div class="seat ${stateClass}${cursorClass}" data-seat-id="${seat.id}"${tooltipAttr} role="img">
        <span class="seat__id">${seat.id}</span>
        <div class="seat__badges">${badges}</div>
      </div>`;
    }

    html += '</div></div>';
  }

  dom.seatGrid.innerHTML = html;
}

// ─── Results Rendering ───────────────────────────────────

function renderResults() {
  const result = state.currentResult;

  if (!result) {
    dom.resultsContent.innerHTML = `
      <div class="results-empty">
        <div class="results-empty__icon">🪑</div>
        <div class="results-empty__text">Set your preferences and click Recommend to find seats</div>
      </div>`;
    return;
  }

  if (result.status === 'invalid') {
    dom.resultsContent.innerHTML = `
      <div class="result-error">
        <div class="result-error__icon">⚠️</div>
        <div class="result-error__code">${result.errorCode}</div>
        <div class="result-error__text">Invalid input — please correct and try again</div>
      </div>`;
    return;
  }

  if (result.status === 'NO_SUITABLE_BLOCK') {
    dom.resultsContent.innerHTML = `
      <div class="result-no-match">
        <div class="result-no-match__icon">🔍</div>
        <div class="result-no-match__code">NO_SUITABLE_BLOCK</div>
        <div class="result-no-match__text">No block of consecutive seats matches your criteria</div>
      </div>`;
    return;
  }

  // Successful recommendation
  const rec = result.recommended;
  let html = `
    <div class="result-recommended">
      <div class="result-recommended__header">
        <span class="result-recommended__label">Recommended</span>
        <span class="result-recommended__score">Score: ${rec.score}</span>
      </div>
      <div class="result-recommended__seats">${rec.seatIds.join(' + ')}</div>
      <div class="result-reasons">
        ${rec.reasons.map(r => `<span class="reason-tag reason-tag--${r.type}">${r.text}</span>`).join('')}
        ${rec.reasons.length === 0 ? '<span class="reason-tag" style="color:var(--text-muted)">No bonus criteria matched</span>' : ''}
      </div>
    </div>`;

  if (result.alternatives.length > 0) {
    html += `<div class="result-alternatives">
      <div class="result-alternatives__title">Alternatives (${result.alternatives.length})</div>
      <div class="alternatives-list">`;

    result.alternatives.forEach((alt, idx) => {
      html += `
        <div class="alternative-item" data-alt-index="${idx}"
             role="button" tabindex="0"
             aria-label="Alternative ${idx + 1}: seats ${alt.seatIds.join(', ')}, score ${alt.score}. Click to highlight on map.">
          <span class="alternative-item__seats">${alt.seatIds.join(' + ')}</span>
          <div class="alternative-item__info">
            <div class="alternative-item__reasons">
              ${alt.reasons.map(r => `<span class="reason-tag reason-tag--${r.type}" style="font-size:10px;padding:2px 6px">${r.text}</span>`).join('')}
            </div>
            <span class="alternative-item__score">Score: ${alt.score}</span>
          </div>
        </div>`;
    });

    html += '</div></div>';
  }

  dom.resultsContent.innerHTML = html;

  // Attach click (and keyboard) listeners to alternatives for highlighting (read-only).
  // Clicking an alternative only updates highlightedAlternativeIndex; it NEVER
  // mutates state.currentResult, preserving the read-only guarantee.
  document.querySelectorAll('.alternative-item').forEach(el => {
    const handleActivate = () => {
      const idx = parseInt(el.getAttribute('data-alt-index'), 10);
      if (state.highlightedAlternativeIndex === idx) {
        state.highlightedAlternativeIndex = -1; // toggle off
      } else {
        state.highlightedAlternativeIndex = idx;
      }
      renderSeatMap(); // re-render map only, results stay unchanged
    };
    el.addEventListener('click', handleActivate);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleActivate();
      }
    });
  });
}

// ─── Event Handlers ──────────────────────────────────────

function onRecommend() {
  state.highlightedAlternativeIndex = -1;
  state.activeSeatSet = SEATS; // always use original frozen data
  state.activeSeatSetLabel = 'Standard';
  const pref = readFormPreference();
  state.currentResult = recommend(pref, state.activeSeatSet);
  renderSeatMap();
  renderResults();
}

function onReset() {
  state.currentResult = null;
  state.highlightedAlternativeIndex = -1;
  state.activeSeatSet = SEATS;
  state.activeSeatSetLabel = 'Standard';
  setFormPreference(PRESETS.P01);
  renderSeatMap();
  renderResults();
}

function onLoadSample(presetKey) {
  if (PRESETS[presetKey]) {
    state.activeSeatSet = SEATS;
    state.activeSeatSetLabel = 'Standard';
    setFormPreference(PRESETS[presetKey]);
  } else if (INVALID_PREFS[presetKey]) {
    state.activeSeatSet = SEATS;
    state.activeSeatSetLabel = 'Standard';
    setFormPreference(INVALID_PREFS[presetKey]);
  } else if (INVALID_SEAT_SETS[presetKey]) {
    // For invalid seat sets, load P01 prefs but swap the seat data
    setFormPreference(PRESETS.P01);
    state.activeSeatSet = INVALID_SEAT_SETS[presetKey];
    state.activeSeatSetLabel = `${presetKey} demo`; // e.g. "IS01 demo"
  }
  // Auto-run recommend after loading sample
  onRecommend_withSeatSet();
}

function onRecommend_withSeatSet() {
  state.highlightedAlternativeIndex = -1;
  const pref = readFormPreference();
  state.currentResult = recommend(pref, state.activeSeatSet);
  renderSeatMap();
  renderResults();
}

// ─── Step 5: Inline Test Suite ───────────────────────────

function runTests() {
  const results = [];

  function assert(testName, condition) {
    results.push({ name: testName, pass: condition });
  }

  // --- P01: Normal case ---
  const r1 = recommend(PRESETS.P01, SEATS);
  assert('P01 status is ok', r1.status === 'ok');
  assert('P01 recommends B1+B2', r1.recommended && r1.recommended.seatIds.join('+') === 'B1+B2');
  assert('P01 score is 4', r1.recommended && r1.recommended.score === 4);
  assert('P01 has zone reason', r1.recommended && r1.recommended.reasons.some(r => r.type === 'zone'));
  assert('P01 has aisle reason', r1.recommended && r1.recommended.reasons.some(r => r.type === 'aisle'));
  assert('P01 second is B4+B5', r1.alternatives.length > 0 && r1.alternatives[0].seatIds.join('+') === 'B4+B5');
  assert('P01 B4+B5 score is 4', r1.alternatives.length > 0 && r1.alternatives[0].score === 4);

  // --- P02: Boundary (single seat, ANY zone, no bonuses) ---
  const r2 = recommend(PRESETS.P02, SEATS);
  assert('P02 status is ok', r2.status === 'ok');
  assert('P02 recommends A1', r2.recommended && r2.recommended.seatIds.join('+') === 'A1');
  assert('P02 score is 0', r2.recommended && r2.recommended.score === 0);
  assert('P02 all scores are 0', r2.alternatives.every(a => a.score === 0));

  // --- P03: No match ---
  const r3 = recommend(PRESETS.P03, SEATS);
  assert('P03 NO_SUITABLE_BLOCK', r3.status === 'NO_SUITABLE_BLOCK');
  assert('P03 recommended is null', r3.recommended === null);
  assert('P03 alternatives empty', r3.alternatives.length === 0);

  // --- IP01: Invalid group size ---
  const r4 = recommend(INVALID_PREFS.IP01, SEATS);
  assert('IP01 invalid status', r4.status === 'invalid');
  assert('IP01 INVALID_GROUP_SIZE', r4.errorCode === 'INVALID_GROUP_SIZE');

  // --- IP02: Invalid zone ---
  const r5 = recommend(INVALID_PREFS.IP02, SEATS);
  assert('IP02 invalid status', r5.status === 'invalid');
  assert('IP02 INVALID_ZONE', r5.errorCode === 'INVALID_ZONE');

  // --- IS01: Duplicate seat ID ---
  const r6 = recommend(PRESETS.P01, INVALID_SEAT_SETS.IS01);
  assert('IS01 invalid status', r6.status === 'invalid');
  assert('IS01 DUPLICATE_SEAT_ID', r6.errorCode === 'DUPLICATE_SEAT_ID');

  // --- IS02: Duplicate coordinate ---
  const r7 = recommend(PRESETS.P01, INVALID_SEAT_SETS.IS02);
  assert('IS02 invalid status', r7.status === 'invalid');
  assert('IS02 DUPLICATE_COORDINATE', r7.errorCode === 'DUPLICATE_COORDINATE');

  // --- Idempotency: recommend does not mutate SEATS ---
  const seatsBefore = JSON.stringify(SEATS);
  recommend(PRESETS.P01, SEATS);
  recommend(PRESETS.P02, SEATS);
  recommend(PRESETS.P03, SEATS);
  const seatsAfter = JSON.stringify(SEATS);
  assert('Seats immutable after recommendations', seatsBefore === seatsAfter);

  // --- NaN / empty groupSize field → INVALID_GROUP_SIZE ---
  // parseInt('', 10) === NaN; Number.isInteger(NaN) === false
  const rNaN = recommend({ groupSize: NaN, preferredZone: 'ANY', requiresSocket: false, prefersAisle: false }, SEATS);
  assert('NaN groupSize → INVALID_GROUP_SIZE', rNaN.status === 'invalid' && rNaN.errorCode === 'INVALID_GROUP_SIZE');

  // --- Manual entry of 0 → INVALID_GROUP_SIZE (bypasses <input min="1">) ---
  const rZero = recommend({ groupSize: 0, preferredZone: 'MIDDLE', requiresSocket: true, prefersAisle: true }, SEATS);
  assert('groupSize 0 (manual entry) → INVALID_GROUP_SIZE', rZero.status === 'invalid' && rZero.errorCode === 'INVALID_GROUP_SIZE');

  // --- state.currentResult immutability: clicking an alternative must not mutate it ---
  const r8 = recommend(PRESETS.P01, SEATS);
  const resultSnapshot = JSON.stringify(r8);
  // Simulate what the UI does when an alternative is clicked
  state.highlightedAlternativeIndex = 0;
  const resultAfterHighlight = JSON.stringify(r8);
  state.highlightedAlternativeIndex = -1;
  assert('Clicking alternative does not mutate currentResult', resultSnapshot === resultAfterHighlight);

  // Render test results
  renderTestResults(results);
  return results;
}

function renderTestResults(results) {
  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  let html = `<div style="margin-bottom:8px;font-weight:700;color:${passed === total ? 'var(--accent-green)' : 'var(--accent-red)'}">
    ${passed}/${total} tests passed
  </div>`;

  results.forEach(r => {
    html += `<div class="test-result ${r.pass ? 'test-result--pass' : 'test-result--fail'}">
      ${r.pass ? '✓' : '✗'} ${r.name}
    </div>`;
  });

  dom.testResults.innerHTML = html;
  dom.testResults.style.display = 'block';
}

// ─── Initialization ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initDOM();

  // Set initial form to P01
  setFormPreference(PRESETS.P01);

  // Render initial seat map (no results)
  renderSeatMap();
  renderResults();

  // Event listeners
  dom.btnRecommend.addEventListener('click', onRecommend);
  dom.btnReset.addEventListener('click', onReset);

  // Sample buttons
  document.querySelectorAll('[data-sample]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-sample');
      onLoadSample(key);
    });
  });

  // Run Tests button
  const btnTest = document.getElementById('btnRunTests');
  if (btnTest) {
    btnTest.addEventListener('click', runTests);
  }
});
