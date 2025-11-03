// ws-server.js (Node 20.19+ / 22.12+)
// If you're not using "type":"module", rename to ws-server.cjs and use require()
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8787 });

const SAMPLE = [
  { ticker: "DXCM", label: "FDA clearance rumor", severity: "warn", url: "https://example.com/dxcm" },
  { ticker: "NVDA", label: "New Omniverse partner", severity: "info", url: "https://example.com/nvda" },
  { ticker: "DASTY", label: "Virtual-twin rollout win", severity: "success", url: "https://example.com/dasty" },
  { ticker: "PATH", label: "Platform release wave", severity: "info", url: "https://example.com/path" },
  { ticker: "HON",  label: "Mega rollout signed", severity: "success", url: "https://example.com/hon" },
  { ticker: "PTC",  label: "New Vuforia deployment", severity: "info" },
  { ticker: "BSY",  label: "DOT award mention", severity: "success" },
  { ticker: "ABT",  label: "Libre coverage update", severity: "info" },
  { ticker: "IRTC", label: "CPT code chatter", severity: "warn" },
];

// Simple shuffle + round-robin so we don't spam the same item
function makeRotator(list) {
  let pool = list.slice().sort(() => Math.random() - 0.5);
  let idx = 0;
  return () => {
    const item = pool[idx++];
    if (idx >= pool.length) {
      pool = list.slice().sort(() => Math.random() - 0.5);
      idx = 0;
    }
    return item;
  };
}
const nextEvent = makeRotator(SAMPLE);

wss.on('connection', (ws) => {
  console.log('client connected');
  const tick = () => {
    const base = nextEvent();
    const payload = {
      ...base,
      id: `${base.ticker}-${Date.now()}`, // unique id
      ts: Date.now(),
    };
    try { ws.send(JSON.stringify(payload)); } catch {}
  };

  // send immediately, then every 5–9s (randomized)
  tick();
  let timer = setInterval(tick, 5000 + Math.floor(Math.random() * 4000));

  ws.on('close', () => clearInterval(timer));
  ws.on('error', () => clearInterval(timer));
});

console.log("WS live on ws://localhost:8787");
