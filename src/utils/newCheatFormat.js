/**
 * Adapter for the BE "new format" cheat form (e.g. game 9824).
 * The page at /{gameId}/inputdata is a full HTML app with inline JS (SCENARIOS).
 * Extension CSP blocks running that JS, so we parse SCENARIOS and rebuild a
 * scoped form that POSTs the same field names to /{gameId}/inputed.
 */

const SCENARIOS_RE = /const\s+SCENARIOS\s*=\s*(\{[\s\S]*?\})\s*;/;

export function isNewCheatFormat(html) {
    if (!html || typeof html !== 'string') return false;
    return SCENARIOS_RE.test(html) || (
        /<!DOCTYPE\s+html/i.test(html)
        && /name=["']matrixCellData["']/.test(html)
        && /name=["']stackedCodeReel1["']/.test(html)
    );
}

export function extractScenarios(html) {
    const match = String(html).match(SCENARIOS_RE);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch (error) {
        console.error('CHEAT_TOOL: failed to parse SCENARIOS', error);
        return null;
    }
}

export function adaptCheatFormHtml(rawHtml, gameId) {
    if (!isNewCheatFormat(rawHtml)) {
        return { format: 'legacy', formHtml: rawHtml, scenarios: null };
    }
    const scenarios = extractScenarios(rawHtml);
    if (!scenarios) {
        return { format: 'legacy', formHtml: rawHtml, scenarios: null };
    }
    return {
        format: 'new',
        formHtml: buildNewFormatFormHtml(scenarios, gameId),
        scenarios,
    };
}

export function asMatrixData(scenario) {
    if (!scenario?.grid) return '';
    const flat = [];
    for (let reel = 0; reel < scenario.reels; reel++) {
        for (let row = 0; row < scenario.rows; row++) {
            flat.push(scenario.grid[row][reel]);
        }
    }
    return flat.join(',');
}

export function tableFormatForShape(reels, rows) {
    if (!reels || !rows) return null;
    return Array(reels).fill(String(rows)).join(',');
}

export function inferTableFormat(matrixData, scenarios = null) {
    const count = String(matrixData || '')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0).length;
    if (!count) return null;

    const formats = scenarios?.formats;
    if (Array.isArray(formats)) {
        const match = formats.find((f) => (f.reels * f.rows) === count);
        if (match) return tableFormatForShape(match.reels, match.rows);
    }

    if (count === 20) return '4,4,4,4,4';
    if (count === 25) return '5,5,5,5,5';
    if (count === 15) return '3,3,3,3,3';
    return null;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function wildsOf(scenario) {
    const wilds = scenario?.wilds;
    if (!Array.isArray(wilds) || !wilds.some((v) => Number(v) > 0)) return null;
    return `sticky wilds [${wilds.join(',')}]`;
}

function scenarioOptionLabel(scenario) {
    const bits = [`level ${scenario.level}`];
    if (Array.isArray(scenario.points) && scenario.points.length >= 2) {
        bits.push(`points ${scenario.points[0]}-${scenario.points[1]}`);
    }
    const wilds = wildsOf(scenario);
    if (wilds) bits.push(wilds);
    bits.push(`chain ${scenario.steps}`);
    return `${scenario.id} - ${bits.join(', ')}`;
}

function scenarioOptionsHtml(list) {
    const options = ['<option value="">- none -</option>'];
    (list || []).forEach((scenario) => {
        options.push(
            `<option value="${escapeHtml(scenario.id)}">${escapeHtml(scenarioOptionLabel(scenario))}</option>`
        );
    });
    return options.join('');
}

function seedOptionsHtml(scenarios) {
    const modes = [
        { pool: 'mg', label: 'MG' },
        { pool: 'fg', label: 'FG' },
        { pool: 'rs', label: 'RS' },
    ];
    const options = ['<option value="">- copy a scenario grid -</option>'];
    modes.forEach((mode) => {
        (scenarios[mode.pool] || []).forEach((scenario) => {
            options.push(
                `<option value="${mode.pool}:${escapeHtml(scenario.id)}">${mode.label} ${escapeHtml(scenario.info)}</option>`
            );
        });
    });
    return options.join('');
}

function shapeOptionsHtml(scenarios) {
    const seen = new Set();
    const options = ['<option value="">auto (by cell count)</option>'];
    (scenarios.formats || []).forEach((format) => {
        const key = `${format.reels}x${format.rows}`;
        if (seen.has(key)) return;
        seen.add(key);
        const cells = format.reels * format.rows;
        const tableFormat = tableFormatForShape(format.reels, format.rows);
        options.push(
            `<option value="${escapeHtml(tableFormat)}">${format.reels}×${format.rows} = ${cells} cells - ${escapeHtml(format.mode)}</option>`
        );
    });
    return options.join('');
}

export function buildNewFormatFormHtml(scenarios, gameId) {
    const serviceId = gameId != null ? String(gameId) : '';
    return `
<div class="new-cheat-format" data-cheat-format="new">
  <p class="new-cheat-lede">New BE cheat format — forced grid, authored scenarios, max-win cap, and reset. Same POST fields as the staging tool.</p>

  <div class="new-cheat-section">
    <h4>Player</h4>
    <p>User ID: <input type="text" name="userId" id="userId" size="30"></p>
    <input type="hidden" name="serviceId" value="${escapeHtml(serviceId)}">
  </div>

  <div class="new-cheat-section">
    <h4>A · Forced grid</h4>
    <p>
      <label for="matrixData">Matrix symbols (reel by reel, top → bottom)</label><br>
      <input class="new-cheat-wide" type="text" name="matrixData" id="matrixData" placeholder="e.g. 6,5,4,3,Q,J,...">
    </p>
    <p class="new-cheat-row">
      <label>Read as
        <select id="gridFormat" data-local="1">${shapeOptionsHtml(scenarios)}</select>
      </label>
      <label>Start from
        <select id="seedFrom" data-local="1">${seedOptionsHtml(scenarios)}</select>
      </label>
      <button type="button" class="btn btn-sm btn-outline-secondary" id="clearGrid">clear</button>
    </p>
    <p>
      <label for="matrixCellData">Sizes / xSplit (<code>vertex:size</code> or <code>vertex:size:S1</code>)</label><br>
      <input class="new-cheat-wide" type="text" name="matrixCellData" id="matrixCellData" placeholder="7:1:S1,15:4">
    </p>
    <p>
      <label for="powerUpSymbolCode">Cascade refill queue</label><br>
      <input class="new-cheat-wide" type="text" name="powerUpSymbolCode" id="powerUpSymbolCode" placeholder="symbol codes…">
    </p>
  </div>

  <div class="new-cheat-section">
    <h4>B · Scenarios</h4>
    <p>
      <label for="scenario">Main game (<code>MG_scenario_&lt;id&gt;</code>)</label><br>
      <select class="new-cheat-wide" id="scenario" name="stackedCodeReel1">${scenarioOptionsHtml(scenarios.mg)}</select>
    </p>
    <p>
      <label for="freeScenario">Free game (<code>FG_scenario_&lt;id&gt;</code>)</label><br>
      <select class="new-cheat-wide" id="freeScenario" name="megaSymbolCode">${scenarioOptionsHtml(scenarios.fg)}</select>
    </p>
    <p>
      <label for="respinScenario">Respins (<code>RS_scenario_&lt;id&gt;</code>)</label><br>
      <select class="new-cheat-wide" id="respinScenario" name="stackedCodeReel5">${scenarioOptionsHtml(scenarios.rs)}</select>
    </p>
  </div>

  <div class="new-cheat-section">
    <h4>C · Max win cap</h4>
    <p>
      <label for="maxWin">Max win (× base bet)</label><br>
      <input type="number" name="matrixLightningData" id="maxWin" min="1" step="1" placeholder="e.g. 10">
    </p>
  </div>

  <div class="new-cheat-section">
    <h4>D · Reset</h4>
    <p>
      <label><input type="checkbox" name="jackpotTypeRight" id="clearQcMode" value="1"> Clear QC mode</label>
    </p>
    <p>
      <label><input type="checkbox" name="jackpotTypeLeft" id="clearPlaySession" value="1"> Clear play session</label>
      <select id="currency" name="jackpotType">
        <option value="USD">USD</option>
        <option value="VND">VND</option>
      </select>
    </p>
  </div>
</div>
`.trim();
}

export function findScenario(scenarios, pool, id) {
    if (!scenarios || id === '' || id == null) return null;
    const list = scenarios[pool] || [];
    const needle = String(id);
    return list.find((s) => String(s.id) === needle) || null;
}
