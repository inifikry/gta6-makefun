// Solmar Bay's map: a road grid over a 3200x2400 city, blocks of buildings
// and parks between the roads, and a beach with the sea along the south edge.
// Everything is generated once from the seed, then read-only: the world and
// the renderer both ask this module what stands where.

import { BEACH_Y, PALETTE, ROAD, WORLD } from './config.js';

export function createCity(random) {
  const roadsX = [];
  const roadsY = [];
  for (let x = ROAD.spacing / 2; x < WORLD.width; x += ROAD.spacing) roadsX.push(x);
  for (let y = ROAD.spacing / 2; y < BEACH_Y; y += ROAD.spacing) roadsY.push(y);

  const buildings = [];
  const parks = [];
  const trees = [];

  // Each block between four roads holds either buildings or a park.
  for (let bx = 0; bx < roadsX.length - 1; bx += 1) {
    for (let by = 0; by < roadsY.length - 1; by += 1) {
      const x0 = roadsX[bx] + ROAD.width / 2 + 14;
      const y0 = roadsY[by] + ROAD.width / 2 + 14;
      const x1 = roadsX[bx + 1] - ROAD.width / 2 - 14;
      const y1 = roadsY[by + 1] - ROAD.width / 2 - 14;
      if (random.next() < 0.22) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = 3 + random.int(0, 4);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + 20 + random.next() * (x1 - x0 - 40), y: y0 + 20 + random.next() * (y1 - y0 - 40), r: 10 + random.next() * 8 });
        }
        continue;
      }
      // One to four buildings per block, each with its own colour and height.
      const cols = random.next() < 0.5 ? 1 : 2;
      const rows = random.next() < 0.5 ? 1 : 2;
      const bw = (x1 - x0 - (cols - 1) * 18) / cols;
      const bh = (y1 - y0 - (rows - 1) * 18) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const w = bw * (0.72 + random.next() * 0.28);
          const h = bh * (0.72 + random.next() * 0.28);
          buildings.push({
            x: x0 + cx * (bw + 18) + (bw - w) / 2,
            y: y0 + cy * (bh + 18) + (bh - h) / 2,
            w,
            h,
            color: random.pick(PALETTE.building),
            tall: random.next() < 0.3,
          });
        }
      }
    }
  }

  // Named landmarks the missions point at (drawn with a sign on the map).
  const landmarks = [
    { name: 'Marina', x: 2960, y: 1900 },
    { name: 'Paint Shop', x: 620, y: 620 },
    { name: 'East Pier', x: 2980, y: 1020 },
    { name: 'Grand Hotel', x: 1020, y: 220 },
    { name: 'Safehouse', x: 220, y: 220 },
  ];

  function onRoad(x, y) {
    if (y >= BEACH_Y) return false;
    for (const rx of roadsX) if (Math.abs(x - rx) <= ROAD.width / 2) return true;
    for (const ry of roadsY) if (Math.abs(y - ry) <= ROAD.width / 2) return true;
    return false;
  }

  // The closest point on a road centreline, for snapping spawns and traffic.
  function nearestRoadPoint(x, y) {
    let bestX = x;
    let bestY = y;
    let best = Infinity;
    for (const rx of roadsX) {
      const d = Math.abs(x - rx);
      if (d < best) { best = d; bestX = rx; bestY = Math.max(0, Math.min(BEACH_Y - 40, y)); }
    }
    for (const ry of roadsY) {
      const d = Math.abs(y - ry);
      if (d < best) { best = d; bestX = Math.max(0, Math.min(WORLD.width, x)); bestY = ry; }
    }
    return { x: bestX, y: bestY };
  }

  // A random point on a road, for spawning traffic and pedestrians.
  function randomRoadPoint() {
    if (random.next() < 0.5) {
      return { x: random.pick(roadsX), y: random.next() * (BEACH_Y - 80) + 40 };
    }
    return { x: random.next() * (WORLD.width - 80) + 40, y: random.pick(roadsY) };
  }

  // A building that contains the point, or null (roads, parks and beach are open).
  function buildingAt(x, y) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // Push a circle out of every building it overlaps; returns true if it moved.
  function resolveCircle(body, radius) {
    let moved = false;
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      moved = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * radius;
        body.y = cy + (dy / d) * radius;
      } else {
        body.x = b.x - radius;
      }
    }
    return moved;
  }

  return { roadsX, roadsY, buildings, parks, trees, landmarks, onRoad, nearestRoadPoint, randomRoadPoint, buildingAt, resolveCircle };
}
