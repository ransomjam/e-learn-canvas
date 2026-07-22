/**
 * Whiteboard video renderer — deterministic scene graph → real MP4.
 *
 * This is the final stage of the whiteboard pipeline:
 *
 *   Scene Graph (whiteboard.service) ──► canvas frames ──► ffmpeg ──► MP4
 *                narration text  ──► TTS (provider) ──► audio track ─┘
 *
 * No AI is involved here: the same scene graph + narration audio always
 * produce the identical video. Frames are rasterized with @napi-rs/canvas
 * and piped straight into ffmpeg's stdin (no frame files on disk); the
 * narration is a single PCM track aligned to scene start times.
 *
 * The drawing semantics intentionally mirror the frontend WhiteboardPlayer:
 * "write" text reveals characters over time, "draw" paths are stroked
 * progressively along their length, "fade" rects blend in with opacity.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { once } = require('events');
const { createCanvas, GlobalFonts, Path2D } = require('@napi-rs/canvas');
const { svgPathProperties: SvgPathProperties } = require('svg-path-properties');
const ffmpegPath = require('ffmpeg-static');

const FPS = 24;
const AUDIO_RATE = 24000; // Gemini TTS output: 16-bit PCM mono @ 24 kHz
const SCENE_AUDIO_PAD_SECONDS = 0.7; // breathing room after narration ends

// ── fonts ──────────────────────────────────────────────────────────────────
const FONT_DIR = path.join(__dirname, '../../assets/fonts');
let fontsReady = false;
function ensureFonts() {
    if (fontsReady) return;
    const caveat = path.join(FONT_DIR, 'Caveat.ttf');
    if (fs.existsSync(caveat)) {
        GlobalFonts.registerFromPath(caveat, 'Caveat');
    }
    fontsReady = true;
}

function fontFor(item) {
    const size = item.fontSize || 30;
    const family = item.family === 'mono' ? 'monospace' : 'Caveat, sans-serif';
    // Variable-weight TTF: request the bold instance explicitly
    const weight = item.weight === 'bold' ? '700 ' : '400 ';
    return `${weight}${size}px ${family}`;
}

// ── path sampling (progressive stroke) ─────────────────────────────────────
/**
 * Split an SVG path into subpaths (on absolute M commands) and pre-sample
 * each into polyline points, so partial strokes can be drawn without
 * connector lines jumping between subpaths (e.g. arrowheads).
 */
function samplePath(d) {
    const subpaths = String(d).split(/(?=M)/).map((s) => s.trim()).filter(Boolean);
    const sampled = [];
    let totalLength = 0;
    for (const sub of subpaths) {
        try {
            const props = new SvgPathProperties(sub);
            const length = props.getTotalLength();
            if (!isFinite(length) || length <= 0) continue;
            const steps = Math.max(8, Math.min(220, Math.ceil(length / 4)));
            const points = [];
            for (let i = 0; i <= steps; i++) {
                const pt = props.getPointAtLength((length * i) / steps);
                points.push([pt.x, pt.y]);
            }
            sampled.push({ points, length });
            totalLength += length;
        } catch { /* skip malformed subpath */ }
    }
    return { subpaths: sampled, totalLength };
}

/** Stroke the first `progress` (0..1) of a sampled path. */
function strokePartialPath(ctx, sampled, progress) {
    let remaining = sampled.totalLength * Math.max(0, Math.min(1, progress));
    for (const sub of sampled.subpaths) {
        if (remaining <= 0) break;
        const fraction = Math.min(1, remaining / sub.length);
        const count = Math.max(2, Math.ceil((sub.points.length - 1) * fraction) + 1);
        ctx.beginPath();
        ctx.moveTo(sub.points[0][0], sub.points[0][1]);
        for (let i = 1; i < count && i < sub.points.length; i++) {
            ctx.lineTo(sub.points[i][0], sub.points[i][1]);
        }
        ctx.stroke();
        remaining -= sub.length;
    }
}

// ── scene drawing ──────────────────────────────────────────────────────────
function itemProgress(item, t) {
    if (t <= item.startTime) return 0;
    if (t >= item.startTime + item.duration) return 1;
    return (t - item.startTime) / item.duration;
}

function drawScene(ctx, scene, t, theme, pathCache) {
    ctx.fillStyle = theme.background || '#fdfdfb';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Highlights (behind) first, then ink — same ordering as the web player
    const items = [...scene.items].sort((a, b) => Number(b.behind || false) - Number(a.behind || false));

    for (const item of items) {
        const p = itemProgress(item, t);
        if (p <= 0) continue;

        if (item.kind === 'text') {
            const text = (item.text || '').slice(0, Math.ceil((item.text || '').length * p));
            if (!text) continue;
            ctx.font = fontFor(item);
            ctx.fillStyle = item.color || '#1f2937';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(text, item.x, item.y);
        } else if (item.kind === 'path') {
            let sampled = pathCache.get(item.id);
            if (!sampled) {
                sampled = samplePath(item.d);
                pathCache.set(item.id, sampled);
            }
            ctx.strokeStyle = item.color || '#1f2937';
            ctx.lineWidth = item.strokeWidth || 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (item.fill && p >= 1) {
                try {
                    ctx.fillStyle = item.fill;
                    ctx.fill(new Path2D(item.d));
                } catch { /* fill is decorative — ignore bad paths */ }
            }
            strokePartialPath(ctx, sampled, p);
        } else if (item.kind === 'rect') {
            ctx.save();
            ctx.globalAlpha = p;
            ctx.fillStyle = item.fill || 'transparent';
            const r = 6;
            const { x, y, width: w, height: h } = item;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
}

// ── audio track assembly ───────────────────────────────────────────────────
/**
 * Build one continuous s16le PCM track: each scene's narration starts at the
 * scene's start time; gaps are silence. Returns { pcmPath, sceneDurations }.
 * sceneDurations may exceed the scene graph's drawing durations when the
 * narration runs longer — the board simply holds while the voice finishes.
 */
function buildAudioTrack(scenes, narrationPcm, tmpDir) {
    const bytesPerSecond = AUDIO_RATE * 2; // mono, 16-bit
    const sceneDurations = scenes.map((scene, i) => {
        const pcm = narrationPcm?.[i];
        const audioSeconds = pcm ? pcm.length / bytesPerSecond : 0;
        return Math.max(scene.durationSeconds, audioSeconds ? audioSeconds + SCENE_AUDIO_PAD_SECONDS : 0);
    });

    const hasAudio = (narrationPcm || []).some((b) => b && b.length > 0);
    if (!hasAudio) return { pcmPath: null, sceneDurations };

    const chunks = [];
    scenes.forEach((scene, i) => {
        const sceneBytes = Math.round(sceneDurations[i] * bytesPerSecond) & ~1; // keep sample alignment
        const pcm = narrationPcm?.[i] || Buffer.alloc(0);
        const audio = pcm.slice(0, sceneBytes);
        chunks.push(audio);
        if (audio.length < sceneBytes) chunks.push(Buffer.alloc(sceneBytes - audio.length)); // silence tail
    });
    const pcmPath = path.join(tmpDir, 'narration.pcm');
    fs.writeFileSync(pcmPath, Buffer.concat(chunks));
    return { pcmPath, sceneDurations };
}

// ── main entry ─────────────────────────────────────────────────────────────
/**
 * Render a compiled scene graph (plus optional per-scene narration PCM
 * buffers) into an MP4 file. Returns { filePath, durationSeconds }.
 *
 * @param {object} sceneGraph          output of whiteboard.service.compileStoryboard
 * @param {Buffer[]|null} narrationPcm one s16le@24k mono buffer per scene (null entries = silent)
 * @param {function} onProgress        (fractionDone 0..1) => void
 */
async function renderVideo(sceneGraph, narrationPcm, onProgress = () => { }) {
    ensureFonts();
    if (!ffmpegPath) throw new Error('ffmpeg binary is not available on this server');

    const { width, height } = sceneGraph.canvas || { width: 1280, height: 720 };
    const theme = sceneGraph.theme || {};
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whiteboard-'));
    const outPath = path.join(tmpDir, 'whiteboard.mp4');

    const { pcmPath, sceneDurations } = buildAudioTrack(sceneGraph.scenes, narrationPcm, tmpDir);
    const totalSeconds = sceneDurations.reduce((a, b) => a + b, 0);
    const totalFrames = Math.ceil(totalSeconds * FPS);

    const args = [
        '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(FPS), '-i', 'pipe:0',
        ...(pcmPath ? ['-f', 's16le', '-ar', String(AUDIO_RATE), '-ac', '1', '-i', pcmPath] : []),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
        ...(pcmPath ? ['-c:a', 'aac', '-b:a', '96k'] : []),
        '-movflags', '+faststart',
        '-shortest',
        outPath,
    ];

    const ffmpeg = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffmpegErr = '';
    ffmpeg.stderr.on('data', (d) => { ffmpegErr = (ffmpegErr + d.toString()).slice(-4000); });
    const ffmpegDone = new Promise((resolve, reject) => {
        ffmpeg.on('error', reject);
        ffmpeg.on('close', (code) => code === 0
            ? resolve()
            : reject(new Error(`ffmpeg exited with code ${code}: ${ffmpegErr.slice(-500)}`)));
    });

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const pathCache = new Map();

    let framesWritten = 0;
    try {
        for (let s = 0; s < sceneGraph.scenes.length; s++) {
            const scene = sceneGraph.scenes[s];
            const frames = Math.ceil(sceneDurations[s] * FPS);
            for (let f = 0; f < frames; f++) {
                const t = f / FPS;
                drawScene(ctx, scene, t, theme, pathCache);
                const frame = Buffer.from(ctx.getImageData(0, 0, width, height).data.buffer);
                if (!ffmpeg.stdin.write(frame)) {
                    await once(ffmpeg.stdin, 'drain');
                }
                framesWritten++;
            }
            pathCache.clear(); // items are per-scene; free the samples
            onProgress(Math.min(0.99, framesWritten / totalFrames));
        }
    } finally {
        ffmpeg.stdin.end();
    }

    await ffmpegDone;
    if (pcmPath) fs.unlinkSync(pcmPath);
    return { filePath: outPath, durationSeconds: Math.round(totalSeconds), tmpDir };
}

/** Remove the temp directory a render created (call after upload). */
function cleanup(tmpDir) {
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* best effort */ }
}

module.exports = { renderVideo, cleanup, AUDIO_RATE };
