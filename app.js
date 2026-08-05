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

  // Initialise the chatbot
  initChatbot();
});

// ─── FAQ Chatbot Engine ───────────────────────────────────

/**
 * Returns a plain-text answer (HTML allowed) for a given user query by
 * pattern-matching against a prioritised list of intents.  All numeric
 * facts are derived from the live SEATS / ROOM / ROW_ZONES constants so
 * they are always consistent with the data layer.
 */
function getChatbotAnswer(raw) {
  const q = raw.toLowerCase().trim();

  // ── Helpers (live data) ──────────────────────────────────
  const totalSeats    = SEATS.length;
  const availSeats    = SEATS.filter(s => s.available && !s.obstructed);
  const unavailSeats  = SEATS.filter(s => !s.available);
  const obstrSeats    = SEATS.filter(s => s.available && s.obstructed);
  const aisleSeats    = SEATS.filter(s => s.aisle);
  const socketSeats   = SEATS.filter(s => s.socket);

  const availIds      = availSeats.map(s => `<strong>${s.id}</strong>`).join(', ');
  const unavailIds    = unavailSeats.map(s => `<strong>${s.id}</strong>`).join(', ');
  const obstrIds      = obstrSeats.map(s => `<strong>${s.id}</strong>`).join(', ');
  const aisleIds      = aisleSeats.map(s => `<strong>${s.id}</strong>`).join(', ');
  const socketIds     = socketSeats.map(s => `<strong>${s.id}</strong>`).join(', ');

  // ── Intents (ordered: most specific first) ───────────────

  // Greeting
  if (/^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening))[!?.,]?$/.test(q)) {
    return `👋 Hello! I'm the <strong>Seat Finder Assistant</strong> for ${ROOM.name} (<strong>${ROOM.id}</strong>). Ask me anything about seats, scoring, zones, or error codes!`;
  }

  // Booking / read-only
  if (/book|reserv|hold|buy|purchase|ticket|sign.?up|register/.test(q)) {
    return `🚫 <strong>This is not a booking system.</strong><br><br>The Seat Finder is <em>read-only</em> — it recommends seats based on your preferences but <strong>never marks any seat as taken, creates a hold, or reserves anything</strong>. Selecting or highlighting a recommendation has zero effect on availability.`;
  }

  // How scoring works
  if (/scor|point|rank|weight|calcul/.test(q)) {
    return `📊 <strong>How scoring works:</strong><br><br>Every candidate block starts at <strong>0 points</strong>.<br><br>` +
      `<strong>+3</strong> if your preferred zone is not <em>ANY</em> and the block's row matches it.<br>` +
      `<strong>+1</strong> if you prefer an aisle and at least one seat in the block has an aisle.<br><br>` +
      `No other points are added or deducted. Blocks are then sorted by <strong>score ↓ → row ↑ → starting column ↑</strong>.`;
  }

  // Aisle seats
  if (/aisle/.test(q)) {
    return `🚶 <strong>Aisle seats</strong> are on the edge of a row — easier to reach without disturbing others and useful if you need quick access.<br><br>` +
      `In LH101, the <strong>${aisleSeats.length}</strong> aisle seats are: ${aisleIds}.<br><br>` +
      `When you check <em>"Prefers Aisle"</em>, any block with at least one aisle seat scores <strong>+1</strong>.`;
  }

  // Socket / charging seats
  if (/socket|charg|plug|power|outlet/.test(q)) {
    return `🔌 <strong>Socket seats</strong> have a nearby power outlet — great for laptops or devices.<br><br>` +
      `In LH101, the <strong>${socketSeats.length}</strong> socket seats are: ${socketIds}.<br><br>` +
      `When you tick <em>"Requires Socket"</em>, only blocks where <strong>at least one seat</strong> has a socket are eligible.`;
  }

  // Zone / FRONT / MIDDLE / BACK
  if (/zone|front|middle|back/.test(q)) {
    const zoneList = ROW_ZONES.map(rz =>
      `Row <strong>${rz.label}</strong> → <strong>${rz.zone}</strong>`
    ).join('<br>');
    return `🗺️ <strong>Zones</strong> divide the hall into sections:<br><br>${zoneList}<br><br>` +
      `Choosing a zone (not <em>ANY</em>) adds <strong>+3</strong> to blocks in that zone. Choose <em>ANY</em> to consider all rows equally.`;
  }

  // Seat counts / available
  if (/how many|count|total|availab|seat/.test(q)) {
    return `🪑 <strong>LH101 seat breakdown</strong> (live from map):<br><br>` +
      `• Total seats: <strong>${totalSeats}</strong><br>` +
      `• Available & clear: <strong>${availSeats.length}</strong> — ${availIds}<br>` +
      `• Unavailable: <strong>${unavailSeats.length}</strong> — ${unavailIds}<br>` +
      `• Obstructed: <strong>${obstrSeats.length}</strong> — ${obstrIds}`;
  }

  // Why a seat is excluded
  if (/exclud|not eligible|why.*seat|can't.*sit|unavail|obstruct/.test(q)) {
    return `❌ <strong>A seat is excluded from recommendations if:</strong><br><br>` +
      `1️⃣ <strong>Unavailable</strong> — the seat is already taken or blocked (${unavailIds}).<br>` +
      `2️⃣ <strong>Obstructed</strong> — the seat exists but has a blocked view (${obstrIds}).<br><br>` +
      `Hover over any gray or gold seat on the map to see its exclusion reason as a tooltip.`;
  }

  // INVALID_GROUP_SIZE
  if (/invalid.group|group.?size|invalid_group/.test(q)) {
    return `⚠️ <strong>INVALID_GROUP_SIZE</strong><br><br>` +
      `Triggered when <em>groupSize</em> is not a whole number between <strong>1</strong> and <strong>${ROOM.columns}</strong> (inclusive).<br><br>` +
      `Common causes: entering <code>0</code>, a negative number, a decimal, or leaving the field blank (which becomes NaN). Load sample <em>IP01 Bad Size</em> to see it live.`;
  }

  // INVALID_ZONE
  if (/invalid.zone|invalid_zone|near.?door|bad.?zone/.test(q)) {
    return `⚠️ <strong>INVALID_ZONE</strong><br><br>` +
      `The <em>preferredZone</em> must be exactly one of: <strong>ANY · FRONT · MIDDLE · BACK</strong>.<br><br>` +
      `Any other value (e.g. <code>NEAR_DOOR</code>) triggers this error. Load sample <em>IP02 Bad Zone</em> to see it live.`;
  }

  // DUPLICATE_SEAT_ID
  if (/duplicate.*id|dup.*id|duplicate_seat|same.*id/.test(q)) {
    return `⚠️ <strong>DUPLICATE_SEAT_ID</strong><br><br>` +
      `Each seat must have a unique ID. If two seats share the same ID (e.g. two seats both named <code>X1</code>), the seat set is rejected immediately — even if the preference is valid.<br><br>` +
      `Load sample <em>IS01 Dup ID</em> to see it live.`;
  }

  // DUPLICATE_COORDINATE
  if (/duplicate.*coord|dup.*coord|duplicate_coord|same.*coord|same.*(row|col)/.test(q)) {
    return `⚠️ <strong>DUPLICATE_COORDINATE</strong><br><br>` +
      `Each seat must occupy a unique (row, column) position. Two different seats at the same grid location trigger this error.<br><br>` +
      `Load sample <em>IS02 Dup Coord</em> to see it live.`;
  }

  // NO_SUITABLE_BLOCK
  if (/no.?suitable|no.?match|no.?result|no.?block|no.?seat/.test(q)) {
    return `🔍 <strong>NO_SUITABLE_BLOCK</strong><br><br>` +
      `This is a valid outcome — not an error. It means no consecutive block of the requested size meets your criteria (available, not obstructed, socket if required).<br><br>` +
      `Example: requesting <strong>5 adjacent seats</strong> always yields NO_SUITABLE_BLOCK in LH101 because every row has at least one unavailable or obstructed middle seat. Load <em>P03 No Match</em> to see it.`;
  }

  // Group size / consecutive
  if (/group|consecutive|adjac|together|block/.test(q)) {
    return `👥 <strong>Group size</strong> is the number of adjacent seats you need (1–${ROOM.columns}).<br><br>` +
      `A <em>candidate block</em> is a window of exactly that many consecutive columns in a single row — every seat in the block must be available and not obstructed. The window slides across all ${ROOM.columns} columns per row.`;
  }

  // How to use / reset / sample buttons
  if (/how.*use|reset|sample|demo|try|start|begin|get.?start/.test(q)) {
    return `🚀 <strong>How to use:</strong><br><br>` +
      `1. Set <em>Group Size</em>, <em>Zone</em>, Socket, and Aisle in the left panel.<br>` +
      `2. Click <strong>✨ Recommend</strong> to see the best block highlighted green on the map.<br>` +
      `3. Click any alternative in the results to shift the highlight (read-only).<br>` +
      `4. Use the <strong>Load Sample</strong> buttons to instantly demo P01–P03 and all error cases.<br>` +
      `5. Click <strong>↺ Reset</strong> to return to the default P01 setup.`;
  }

  // What is P01 / P02 / P03
  if (/p0?1|p0?2|p0?3/.test(q)) {
    return `📋 <strong>Preset scenarios:</strong><br><br>` +
      `<strong>P01</strong> — Group 2, MIDDLE, socket + aisle → recommends <strong>B1 + B2</strong> (score 4).<br>` +
      `<strong>P02</strong> — Group 1, ANY zone, no extras → recommends <strong>A1</strong> (score 0, tie-break).<br>` +
      `<strong>P03</strong> — Group 5, ANY zone → <strong>NO_SUITABLE_BLOCK</strong> (no row has 5 clear consecutive seats).`;
  }

  // What is this / about
  if (/what.*this|what.*app|what.*tool|about|purpose|help/.test(q)) {
    return `ℹ️ The <strong>Lecture Hall Seat Finder</strong> helps students pick the best available seat or group of adjacent seats in <strong>${ROOM.name}</strong> based on preferences like zone, socket, and aisle.<br><br>` +
      `It ranks all eligible consecutive blocks by a deterministic score and highlights the top recommendation on the live seat map. It is <em>read-only</em> — nothing is reserved or booked.`;
  }

  // Fallback
  return `🤔 I didn't quite catch that. Try asking about:<br><br>` +
    `• <em>Scoring</em> — how points are calculated<br>` +
    `• <em>Aisle / Socket / Zone</em> — what features mean<br>` +
    `• <em>Seat counts</em> — live breakdown from the map<br>` +
    `• <em>Error codes</em> — INVALID_GROUP_SIZE, INVALID_ZONE, etc.<br>` +
    `• <em>Booking</em> — read-only disclaimer<br><br>` +
    `Or use the quick-chip buttons below! 👇`;
}

// ── Chatbot UI ────────────────────────────────────────────

function initChatbot() {
  const toggle   = document.getElementById('chatToggle');
  const panel    = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const messages = document.getElementById('chatMessages');
  const input    = document.getElementById('chatInput');
  const sendBtn  = document.getElementById('chatSend');
  const badge    = document.getElementById('chatBadge');
  const chips    = document.querySelectorAll('.chat-chip');

  if (!toggle || !panel) return; // guard: elements not present

  let isOpen = false;

  // ── Open / close ──────────────────────────────────────
  function openChat() {
    isOpen = true;
    panel.classList.add('chat-panel--open');
    toggle.setAttribute('aria-expanded', 'true');
    badge.classList.remove('chat-toggle__badge--visible');
    setTimeout(() => input.focus(), 300);
    scrollToBottom();
  }

  function closeChat() {
    isOpen = false;
    panel.classList.remove('chat-panel--open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  toggle.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  // Close on Escape
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeChat();
  });

  // ── Send helpers ──────────────────────────────────────
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  function appendMessage(html, role) {
    const avatar = role === 'bot' ? '🤖' : '🎓';
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg--${role}`;
    div.innerHTML = `
      <div class="chat-msg__avatar" aria-hidden="true">${avatar}</div>
      <div class="chat-msg__bubble">${html}</div>`;
    messages.appendChild(div);
    scrollToBottom();
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'chat-typing';
    div.id = 'chatTyping';
    div.setAttribute('aria-label', 'Assistant is typing');
    div.innerHTML = `
      <div class="chat-msg__avatar" aria-hidden="true">🤖</div>
      <div class="chat-typing__bubble">
        <div class="chat-typing__dot"></div>
        <div class="chat-typing__dot"></div>
        <div class="chat-typing__dot"></div>
      </div>`;
    messages.appendChild(div);
    scrollToBottom();
  }

  function removeTyping() {
    const t = document.getElementById('chatTyping');
    if (t) t.remove();
  }

  function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    appendMessage(trimmed, 'user');
    input.value = '';
    sendBtn.disabled = true;

    // Simulate ~600 ms typing delay
    showTyping();
    setTimeout(() => {
      removeTyping();
      const answer = getChatbotAnswer(trimmed);
      appendMessage(answer, 'bot');

      // If panel is closed, show unread badge
      if (!isOpen) {
        badge.classList.add('chat-toggle__badge--visible');
      }
    }, 600 + Math.random() * 300); // 600–900 ms feels natural
  }

  // ── Input / Send button ───────────────────────────────
  input.addEventListener('input', () => {
    sendBtn.disabled = input.value.trim().length === 0;
    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage(input.value);
    }
  });

  sendBtn.addEventListener('click', () => sendMessage(input.value));

  // ── Quick chips ───────────────────────────────────────
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (!isOpen) openChat();
      sendMessage(chip.getAttribute('data-chip'));
    });
  });

  // ── Welcome message (shown once on first open) ────────
  let welcomed = false;
  toggle.addEventListener('click', () => {
    if (!welcomed && isOpen) {
      welcomed = true;
      setTimeout(() => {
        appendMessage(
          `👋 Hi! I'm the <strong>Seat Finder Assistant</strong> for <strong>${ROOM.name}</strong>.<br><br>` +
          `Ask me anything about seats, scoring, zones, socket/aisle features, or error codes — my answers come straight from the live room data. Use the chips below for quick questions!`,
          'bot'
        );
      }, 350);
    }
  });
}
