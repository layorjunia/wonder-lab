#!/usr/bin/env node
/* Screenshot the real app UI at device size, headless, with no browser pane needed.

     node Tools/ui_shot.mjs steps.json

   steps.json: { "url": "http://127.0.0.1:8798/Web/dist/dev.html", "w": 834, "h": 1194, "scale": 2,
                 "steps": [ { "js": "Tabs.show('Stable')", "wait": 800, "shot": "/path/stable.png" }, ... ] }
   Each step runs its JavaScript in the page (it may be async; top-level await works), waits, then saves a
   PNG if "shot" is given. The browser profile is fresh every run, so steps set up
   whatever state they need (Store.d...). Made 2026-09-27 to show Jacob the Stable and the preview mode;
   the browser pane's own screenshots can't be saved to disk. */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "uishot-"))}`, "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
}
if (!target) { console.error("chrome did not start"); chrome.kill(); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (js) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${js}\n })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) console.error("js error:", r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};

const W = spec.w || 834, H = spec.h || 1194, S = spec.scale || 2;
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: S, mobile: W < 768 });
if (W < 768) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Page.enable");
await send("Page.navigate", { url: spec.url });
await sleep(spec.load || 3500);
// A "perf" step measures the page for that many seconds: main-thread busy time (script, style, layout, paint
// and other tasks), animation frames drawn, and memory. Numbers are relative (headless Chrome paints canvases
// in software), for comparing screens and before/after a change.
await send("Performance.enable");
const metrics = async () => Object.fromEntries((await send("Performance.getMetrics")).result.metrics.map((m) => [m.name, m.value]));
await evaluate(`if (!window.__rafN) { window.__rafN = 0; const r = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => r((t) => { window.__rafN++; f(t); }); }`);
for (const st of spec.steps) {
  if (st.js) { const v = await evaluate(st.js); if (v !== undefined) console.log(JSON.stringify(v)); }
  // A "profile" step samples the JavaScript for that many seconds and prints where the time went.
  if (st.profile) {
    await sleep(st.wait ?? 600);
    await send("Profiler.enable"); await send("Profiler.setSamplingInterval", { interval: 200 }); await send("Profiler.start");
    await sleep(st.profile * 1000);
    const prof = (await send("Profiler.stop")).result.profile;
    const self = {}, dt = {};
    prof.samples.forEach((id, i) => { dt[id] = (dt[id] || 0) + (prof.timeDeltas[i] || 0); });
    for (const n of prof.nodes) {
      const f = n.callFrame, name = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
      self[name] = (self[name] || 0) + (dt[n.id] || 0);
    }
    const total = Object.values(self).reduce((a, b) => a + b, 0);
    console.log(`${st.label || "profile"}:`);
    Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, st.top || 12).forEach(([k, v]) => console.log(`  ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`));
    continue;
  }
  if (st.perf) {
    await sleep(st.wait ?? 600);
    const a = await metrics(), f0 = await evaluate("return window.__rafN");
    await sleep(st.perf * 1000);
    const b = await metrics(), f1 = await evaluate("return window.__rafN");
    const canv = await evaluate(`return [...document.querySelectorAll("canvas")].filter((c) => c.offsetParent || c.getClientRects().length).map((c) => c.width * c.height).reduce((s, n) => s + n, 0)`);
    const pct = (k) => Math.round((100 * (b[k] - a[k])) / st.perf);
    console.log(`${(st.label || "").padEnd(26)} busy ${String(pct("TaskDuration")).padStart(3)}%  script ${String(pct("ScriptDuration")).padStart(3)}%  style+layout ${String(pct("RecalcStyleDuration") + pct("LayoutDuration")).padStart(3)}%  ` +
      `rAF/s ${String(Math.round((f1 - f0) / st.perf)).padStart(4)}  canvas ${(canv / 1e6).toFixed(1)} Mpx  heap ${(b.JSHeapUsedSize / 1e6).toFixed(0)} MB  nodes ${b.Nodes}`);
    continue;
  }
  await sleep(st.wait ?? 600);
  if (st.shot) {
    const r = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(st.shot, Buffer.from(r.result.data, "base64"));
    console.log("saved", st.shot);
  }
}
ws.close(); chrome.kill();
process.exit(0);
