/**
 * Whiteboard rendering pipeline (deterministic — NO AI here).
 *
 *   Storyboard (scene descriptions from the model)
 *     → Scene Graph (positioned, timed drawing items)   ← this module
 *       → the frontend WhiteboardPlayer animates it (writing/drawing)
 *       → (future) a server-side renderer can rasterize the same graph to MP4
 *
 * The model only ever describes WHAT appears (headings, bullets, charts,
 * diagrams). This compiler decides WHERE and WHEN, with consistent
 * typography, spacing and pacing, so every video looks like the same
 * professional instructor drew it.
 *
 * All geometry targets a 1280×720 canvas. "Hand-drawn" jitter is generated
 * from a seeded PRNG so the same storyboard always compiles to the exact
 * same video (scene-level regeneration stays stable).
 */

const CANVAS = { width: 1280, height: 720 };
const MARGIN_X = 110;
const CONTENT_WIDTH = CANVAS.width - MARGIN_X * 2;

// Single visual theme — consistency beats configurability.
const THEME = {
    background: '#fdfdfb',
    ink: '#1f2937',
    accent: '#2456d6',
    warm: '#d97706',
    highlight: 'rgba(253, 224, 71, 0.55)',
    chartPalette: ['#2456d6', '#d97706', '#059669', '#dc2626', '#7c3aed'],
    headingFont: 56,
    subheadingFont: 40,
    bodyFont: 30,
    smallFont: 24,
    lineHeight: 1.5,
};

// Writing speed used to time "write" animations (chars per second).
const WRITE_SPEED = 16;
const MIN_ITEM_TIME = 0.5;

/** Deterministic PRNG (mulberry32) so jitter is stable across compiles. */
function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Rough text width estimate for a handwriting-style font. */
function textWidth(text, fontSize) {
    return (text || '').length * fontSize * 0.52;
}

/** Hand-drawn-looking horizontal line as an SVG path with slight waviness. */
function handLine(x1, y, x2, rand, amp = 2.5) {
    const segments = Math.max(2, Math.floor((x2 - x1) / 90));
    let d = `M ${x1.toFixed(1)} ${(y + (rand() - 0.5) * amp).toFixed(1)}`;
    for (let i = 1; i <= segments; i++) {
        const x = x1 + ((x2 - x1) * i) / segments;
        const yy = y + (rand() - 0.5) * amp * 2;
        const cx = x - (x2 - x1) / segments / 2;
        d += ` Q ${cx.toFixed(1)} ${(y + (rand() - 0.5) * amp * 3).toFixed(1)} ${x.toFixed(1)} ${yy.toFixed(1)}`;
    }
    return d;
}

/** Hand-drawn rectangle path. */
function handRect(x, y, w, h, rand) {
    const j = () => (rand() - 0.5) * 4;
    return `M ${x + j()} ${y + j()} L ${x + w + j()} ${y + j()} L ${x + w + j()} ${y + h + j()} L ${x + j()} ${y + h + j()} Z`;
}

/** Arrow path (with head) from (x1,y1) to (x2,y2). */
function arrowPath(x1, y1, x2, y2, rand) {
    const midX = (x1 + x2) / 2 + (rand() - 0.5) * 8;
    const midY = (y1 + y2) / 2 + (rand() - 0.5) * 8;
    const angle = Math.atan2(y2 - midY, x2 - midX);
    const head = 14;
    const h1x = x2 - head * Math.cos(angle - 0.45);
    const h1y = y2 - head * Math.sin(angle - 0.45);
    const h2x = x2 - head * Math.cos(angle + 0.45);
    const h2y = y2 - head * Math.sin(angle + 0.45);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} M ${h1x.toFixed(1)} ${h1y.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${h2x.toFixed(1)} ${h2y.toFixed(1)}`;
}

/** Wrap text to fit the content width; returns array of lines. */
function wrapText(text, fontSize, maxWidth = CONTENT_WIDTH) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (textWidth(candidate, fontSize) > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    return lines;
}

let itemCounter = 0;
function makeItem(props) {
    return { id: `item-${++itemCounter}`, animation: 'write', color: THEME.ink, ...props };
}

/**
 * Lay out one storyboard element; returns { items, nextY }.
 * Each element type produces one or more positioned scene-graph items.
 */
function layoutElement(el, y, rand, sceneIndex) {
    const items = [];
    const kind = el.kind || 'text';
    const text = el.text || '';

    switch (kind) {
        case 'heading': {
            const fontSize = THEME.subheadingFont;
            const lines = wrapText(text, fontSize);
            lines.forEach((line, i) => {
                items.push(makeItem({
                    kind: 'text', text: line, fontSize, weight: 'bold',
                    x: CANVAS.width / 2 - textWidth(line, fontSize) / 2,
                    y: y + i * fontSize * THEME.lineHeight,
                }));
            });
            return { items, nextY: y + lines.length * fontSize * THEME.lineHeight + 26 };
        }

        case 'definition': {
            const term = el.term || text.split(':')[0] || 'Definition';
            const def = el.text || '';
            const fontSize = THEME.bodyFont;
            const termItem = makeItem({
                kind: 'text', text: term, fontSize: THEME.subheadingFont, weight: 'bold',
                color: THEME.accent, x: MARGIN_X, y,
            });
            items.push(termItem);
            const underlineY = y + THEME.subheadingFont * 0.35;
            items.push(makeItem({
                kind: 'path', animation: 'draw', color: THEME.accent, strokeWidth: 3,
                d: handLine(MARGIN_X, underlineY, MARGIN_X + textWidth(term, THEME.subheadingFont), rand),
                x: 0, y: 0, drawSeconds: 0.6,
            }));
            let yy = y + THEME.subheadingFont * 0.9 + 10;
            for (const line of wrapText(def, fontSize)) {
                items.push(makeItem({ kind: 'text', text: line, fontSize, x: MARGIN_X + 24, y: yy }));
                yy += fontSize * THEME.lineHeight;
            }
            return { items, nextY: yy + 20 };
        }

        case 'bullet': {
            const fontSize = THEME.bodyFont;
            const lines = wrapText(text, fontSize, CONTENT_WIDTH - 46);
            // hand-drawn bullet dot
            items.push(makeItem({
                kind: 'path', animation: 'draw', strokeWidth: 4, drawSeconds: 0.25,
                d: `M ${MARGIN_X + 6} ${y - fontSize * 0.3} a 5 5 0 1 0 0.1 0 Z`,
                x: 0, y: 0,
            }));
            lines.forEach((line, i) => {
                items.push(makeItem({
                    kind: 'text', text: line, fontSize,
                    x: MARGIN_X + 34, y: y + i * fontSize * THEME.lineHeight,
                }));
            });
            return { items, nextY: y + lines.length * fontSize * THEME.lineHeight + 14 };
        }

        case 'formula': {
            const fontSize = THEME.subheadingFont;
            const w = textWidth(text, fontSize);
            const x = CANVAS.width / 2 - w / 2;
            items.push(makeItem({ kind: 'text', text, fontSize, x, y, color: THEME.accent, family: 'mono' }));
            items.push(makeItem({
                kind: 'path', animation: 'draw', color: THEME.ink, strokeWidth: 2.5, drawSeconds: 0.8,
                d: handRect(x - 26, y - fontSize * 0.85, w + 52, fontSize * 1.5, rand),
                x: 0, y: 0,
            }));
            return { items, nextY: y + fontSize * 1.6 + 24 };
        }

        case 'box': {
            const fontSize = THEME.bodyFont;
            const lines = wrapText(text, fontSize, CONTENT_WIDTH - 80);
            const boxH = lines.length * fontSize * THEME.lineHeight + 34;
            const boxW = Math.min(CONTENT_WIDTH, Math.max(...lines.map((l) => textWidth(l, fontSize))) + 64);
            const x = CANVAS.width / 2 - boxW / 2;
            items.push(makeItem({
                kind: 'path', animation: 'draw', color: THEME.warm, strokeWidth: 3, drawSeconds: 1,
                d: handRect(x, y - fontSize, boxW, boxH, rand), x: 0, y: 0,
            }));
            lines.forEach((line, i) => {
                items.push(makeItem({
                    kind: 'text', text: line, fontSize, weight: 'bold',
                    x: CANVAS.width / 2 - textWidth(line, fontSize) / 2,
                    y: y + 6 + i * fontSize * THEME.lineHeight,
                }));
            });
            return { items, nextY: y + boxH + 22 };
        }

        case 'arrow': {
            const x = CANVAS.width / 2;
            items.push(makeItem({
                kind: 'path', animation: 'draw', color: THEME.accent, strokeWidth: 3.5, drawSeconds: 0.7,
                d: arrowPath(x, y - 6, x, y + 44, rand), x: 0, y: 0,
            }));
            if (text) {
                items.push(makeItem({
                    kind: 'text', text, fontSize: THEME.smallFont, color: THEME.accent,
                    x: x + 22, y: y + 26,
                }));
            }
            return { items, nextY: y + 66 };
        }

        case 'underline': {
            items.push(makeItem({
                kind: 'path', animation: 'draw', color: THEME.warm, strokeWidth: 3.5, drawSeconds: 0.5,
                d: handLine(MARGIN_X, y - 8, MARGIN_X + CONTENT_WIDTH * 0.45, rand, 3.5), x: 0, y: 0,
            }));
            return { items, nextY: y + 12 };
        }

        case 'highlight': {
            items.push(makeItem({
                kind: 'rect', animation: 'fade', fill: THEME.highlight,
                x: MARGIN_X - 10, y: y - 62, width: CONTENT_WIDTH * 0.7, height: 52, behind: true,
            }));
            return { items, nextY: y };
        }

        case 'chart': {
            const chartType = el.chartType || 'bar';
            const labels = Array.isArray(el.labels) ? el.labels.slice(0, 6) : [];
            const values = (Array.isArray(el.values) ? el.values.slice(0, 6) : []).map(Number);
            const w = 520, h = 250;
            const x0 = CANVAS.width / 2 - w / 2;
            const maxV = Math.max(...values, 1);

            if (chartType === 'pie') {
                const cx = CANVAS.width / 2, cy = y + h / 2, r = 105;
                const total = values.reduce((a, b) => a + b, 0) || 1;
                let angle = -Math.PI / 2;
                values.forEach((v, i) => {
                    const slice = (v / total) * Math.PI * 2;
                    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
                    const x2 = cx + r * Math.cos(angle + slice), y2 = cy + r * Math.sin(angle + slice);
                    const large = slice > Math.PI ? 1 : 0;
                    items.push(makeItem({
                        kind: 'path', animation: 'draw', drawSeconds: 0.8, strokeWidth: 2.5,
                        color: THEME.chartPalette[i % THEME.chartPalette.length],
                        fill: `${THEME.chartPalette[i % THEME.chartPalette.length]}22`,
                        d: `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`,
                        x: 0, y: 0,
                    }));
                    const midAngle = angle + slice / 2;
                    if (labels[i]) {
                        items.push(makeItem({
                            kind: 'text', text: labels[i], fontSize: THEME.smallFont,
                            x: cx + (r + 22) * Math.cos(midAngle) - (Math.cos(midAngle) < 0 ? textWidth(labels[i], THEME.smallFont) : 0),
                            y: cy + (r + 22) * Math.sin(midAngle),
                        }));
                    }
                    angle += slice;
                });
                if (el.text) {
                    items.push(makeItem({
                        kind: 'text', text: el.text, fontSize: THEME.smallFont, color: THEME.accent,
                        x: CANVAS.width / 2 - textWidth(el.text, THEME.smallFont) / 2, y: y + h + 46,
                    }));
                }
                return { items, nextY: y + h + 70 };
            }

            // axes (bar/line)
            items.push(makeItem({
                kind: 'path', animation: 'draw', strokeWidth: 3, drawSeconds: 0.8,
                d: `${handLine(x0, y + h, x0 + w, rand)} M ${x0} ${y + h} L ${x0 + (rand() - 0.5) * 3} ${y}`,
                x: 0, y: 0,
            }));
            if (chartType === 'line') {
                const pts = values.map((v, i) => ({
                    x: x0 + 40 + (i * (w - 80)) / Math.max(values.length - 1, 1),
                    y: y + h - 18 - (v / maxV) * (h - 40),
                }));
                let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
                for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
                items.push(makeItem({
                    kind: 'path', animation: 'draw', color: THEME.accent, strokeWidth: 3.5, drawSeconds: 1.4,
                    d, x: 0, y: 0,
                }));
                pts.forEach((p, i) => {
                    if (labels[i]) {
                        items.push(makeItem({
                            kind: 'text', text: String(labels[i]), fontSize: 20,
                            x: p.x - textWidth(String(labels[i]), 20) / 2, y: y + h + 28,
                        }));
                    }
                });
            } else {
                const bw = Math.min(80, (w - 60) / values.length - 24);
                values.forEach((v, i) => {
                    const bx = x0 + 44 + i * ((w - 60) / values.length);
                    const bh = (v / maxV) * (h - 44);
                    items.push(makeItem({
                        kind: 'path', animation: 'draw', drawSeconds: 0.7, strokeWidth: 2.5,
                        color: THEME.chartPalette[i % THEME.chartPalette.length],
                        fill: `${THEME.chartPalette[i % THEME.chartPalette.length]}33`,
                        d: handRect(bx, y + h - bh, bw, bh, rand), x: 0, y: 0,
                    }));
                    if (labels[i]) {
                        items.push(makeItem({
                            kind: 'text', text: String(labels[i]), fontSize: 20,
                            x: bx + bw / 2 - textWidth(String(labels[i]), 20) / 2, y: y + h + 28,
                        }));
                    }
                });
            }
            if (el.text) {
                items.push(makeItem({
                    kind: 'text', text: el.text, fontSize: THEME.smallFont, color: THEME.accent,
                    x: CANVAS.width / 2 - textWidth(el.text, THEME.smallFont) / 2, y: y + h + 58,
                }));
            }
            return { items, nextY: y + h + 84 };
        }

        case 'diagram': {
            const nodes = (Array.isArray(el.nodes) ? el.nodes : String(text).split('→')).map((n) => String(n).trim()).filter(Boolean).slice(0, 5);
            if (!nodes.length) return { items, nextY: y };
            const fontSize = THEME.smallFont + 2;
            const gap = 56;
            const widths = nodes.map((n) => Math.max(120, textWidth(n, fontSize) + 44));
            const total = widths.reduce((a, b) => a + b, 0) + gap * (nodes.length - 1);
            let x = Math.max(MARGIN_X, CANVAS.width / 2 - total / 2);
            const boxH = 66;
            nodes.forEach((node, i) => {
                items.push(makeItem({
                    kind: 'path', animation: 'draw', strokeWidth: 2.8, drawSeconds: 0.7,
                    color: THEME.accent, d: handRect(x, y, widths[i], boxH, rand), x: 0, y: 0,
                }));
                items.push(makeItem({
                    kind: 'text', text: node, fontSize,
                    x: x + widths[i] / 2 - textWidth(node, fontSize) / 2, y: y + boxH / 2 + fontSize * 0.35,
                }));
                if (i < nodes.length - 1) {
                    items.push(makeItem({
                        kind: 'path', animation: 'draw', strokeWidth: 3, drawSeconds: 0.4,
                        d: arrowPath(x + widths[i] + 6, y + boxH / 2, x + widths[i] + gap - 6, y + boxH / 2, rand),
                        x: 0, y: 0,
                    }));
                }
                x += widths[i] + gap;
            });
            let nextY = y + boxH + 26;
            if (el.text) {
                items.push(makeItem({
                    kind: 'text', text: el.text, fontSize: THEME.smallFont, color: THEME.accent,
                    x: CANVAS.width / 2 - textWidth(el.text, THEME.smallFont) / 2, y: nextY + 10,
                }));
                nextY += 44;
            }
            return { items, nextY };
        }

        case 'text':
        default: {
            const fontSize = THEME.bodyFont;
            const lines = wrapText(text, fontSize);
            lines.forEach((line, i) => {
                items.push(makeItem({
                    kind: 'text', text: line, fontSize,
                    x: MARGIN_X, y: y + i * fontSize * THEME.lineHeight,
                    ...(el.emphasis ? { weight: 'bold', color: THEME.accent } : {}),
                }));
            });
            return { items, nextY: y + lines.length * fontSize * THEME.lineHeight + 16 };
        }
    }
}

/** Assign start times so drawing finishes ~85% into the scene. */
function scheduleItems(items, durationSeconds) {
    const naturalTimes = items.map((item) => {
        if (item.kind === 'text') return Math.max(MIN_ITEM_TIME, (item.text || '').length / WRITE_SPEED);
        if (item.animation === 'draw') return Math.max(MIN_ITEM_TIME, item.drawSeconds || 0.8);
        return 0.35;
    });
    const naturalTotal = naturalTimes.reduce((a, b) => a + b, 0) || 1;
    const budget = Math.max(durationSeconds * 0.85, 3);
    const scale = Math.min(1.4, budget / naturalTotal); // never slower than 1.4×natural
    let t = 0.4; // small lead-in
    items.forEach((item, i) => {
        const dur = Math.max(MIN_ITEM_TIME * 0.5, naturalTimes[i] * scale);
        item.startTime = Number(t.toFixed(2));
        item.duration = Number(dur.toFixed(2));
        t += dur + 0.12 * scale; // natural micro-pause between strokes
    });
    return Math.max(durationSeconds, Math.ceil(t + 1));
}

const whiteboardService = {
    THEME,
    CANVAS,

    /**
     * Compile a storyboard (validated scene descriptions) into a scene graph.
     * Pure and deterministic: same input → same output.
     */
    compileStoryboard(storyboard) {
        itemCounter = 0;
        const scenes = (storyboard.scenes || []).map((scene, index) => this.compileScene(scene, index));
        const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
        return {
            version: 1,
            title: storyboard.title || 'Whiteboard lesson',
            canvas: CANVAS,
            theme: THEME,
            totalDurationSeconds: Number(totalDuration.toFixed(1)),
            scenes,
        };
    },

    /** Compile a single scene (used for scene-level regeneration too). */
    compileScene(scene, index) {
        const rand = seededRandom(1337 + index * 101);
        const items = [];
        let y = 96;

        // Scene title (except pure title scenes, which center their heading)
        if (scene.type === 'title') {
            const title = scene.title || 'Lesson';
            const fontSize = THEME.headingFont;
            const lines = wrapText(title, fontSize);
            let ty = CANVAS.height / 2 - (lines.length * fontSize * THEME.lineHeight) / 2;
            lines.forEach((line) => {
                items.push(makeItem({
                    kind: 'text', text: line, fontSize, weight: 'bold',
                    x: CANVAS.width / 2 - textWidth(line, fontSize) / 2, y: ty,
                }));
                ty += fontSize * THEME.lineHeight;
            });
            items.push(makeItem({
                kind: 'path', animation: 'draw', color: THEME.accent, strokeWidth: 4, drawSeconds: 0.9,
                d: handLine(CANVAS.width / 2 - 190, ty + 4, CANVAS.width / 2 + 190, rand, 3.5),
                x: 0, y: 0,
            }));
            // Subtitle from first element, if any
            const sub = (scene.elements || []).find((e) => e.text);
            if (sub) {
                items.push(makeItem({
                    kind: 'text', text: sub.text, fontSize: THEME.bodyFont, color: '#6b7280',
                    x: CANVAS.width / 2 - textWidth(sub.text, THEME.bodyFont) / 2, y: ty + 58,
                }));
            }
        } else {
            if (scene.title) {
                items.push(makeItem({
                    kind: 'text', text: scene.title, fontSize: THEME.subheadingFont, weight: 'bold',
                    x: MARGIN_X, y,
                }));
                items.push(makeItem({
                    kind: 'path', animation: 'draw', color: THEME.accent, strokeWidth: 3.5, drawSeconds: 0.7,
                    d: handLine(MARGIN_X, y + 14, MARGIN_X + Math.min(CONTENT_WIDTH, textWidth(scene.title, THEME.subheadingFont) + 30), rand, 3),
                    x: 0, y: 0,
                }));
                y += THEME.subheadingFont * THEME.lineHeight + 26;
            }
            for (const el of scene.elements || []) {
                const { items: elItems, nextY } = layoutElement(el, y, rand, index);
                items.push(...elItems);
                y = nextY;
                if (y > CANVAS.height - 60) break; // never overflow the board
            }
        }

        const durationSeconds = scheduleItems(items, Number(scene.durationSeconds) || 12);
        return {
            index,
            type: scene.type || 'explanation',
            title: scene.title || '',
            narration: scene.narration || '',
            durationSeconds,
            items,
        };
    },

    /** Basic storyboard sanity-check/normalization after model generation. */
    normalizeStoryboard(raw) {
        const storyboard = raw && typeof raw === 'object' ? raw : {};
        let scenes = Array.isArray(storyboard.scenes) ? storyboard.scenes : [];
        scenes = scenes.slice(0, 14).map((scene, i) => ({
            type: scene.type || (i === 0 ? 'title' : 'explanation'),
            title: String(scene.title || '').slice(0, 120),
            narration: String(scene.narration || ''),
            durationSeconds: Math.min(60, Math.max(6, Number(scene.durationSeconds) || 12)),
            elements: (Array.isArray(scene.elements) ? scene.elements : []).slice(0, 10),
        }));
        if (!scenes.length) throw new Error('The AI produced an empty storyboard');
        return { title: String(storyboard.title || 'Whiteboard lesson'), scenes };
    },
};

module.exports = whiteboardService;
