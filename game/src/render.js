// Drawing only: the world in, pixels out. A camera follows the player over
// the city; the HUD, the minimap and the menus are drawn on top. The view is
// a fixed 1280x720 logical area scaled to fit the window.

import { BEACH_Y, FONT, PALETTE, PLAYER, ROAD, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const VIEW = { width: 1280, height: 720 };

function starRow(stars) {
  let out = '';
  for (let i = 0; i < 5; i += 1) out += i < stars ? '★' : '☆';
  return out;
}

export function createRenderer(canvas, city) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  // World coordinates of the mouse, for aiming: the renderer owns the view.
  function toWorld(mx, my) {
    return {
      x: (mx - view.x) / view.scale + camera.x,
      y: (my - view.y) / view.scale + camera.y,
    };
  }

  const camera = { x: 0, y: 0 };

  function drawCity(state) {
    const x0 = camera.x;
    const y0 = camera.y;
    const x1 = x0 + VIEW.width;
    const y1 = y0 + VIEW.height;

    // Ground: grass, then sand and sea along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, VIEW.width, VIEW.height);
    if (y1 > BEACH_Y) {
      context.fillStyle = PALETTE.sand;
      context.fillRect(x0, Math.max(y0, BEACH_Y), VIEW.width, Math.min(y1, BEACH_Y + 90) - Math.max(y0, BEACH_Y));
      context.fillStyle = PALETTE.sea;
      context.fillRect(x0, Math.max(y0, BEACH_Y + 90), VIEW.width, y1 - Math.max(y0, BEACH_Y + 90));
    }

    // Parks and their trees.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      context.fillStyle = '#3f8f4f';
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const tree of city.trees) {
      if (tree.x < x0 || tree.x > x1 || tree.y < y0 || tree.y > y1) continue;
      context.fillStyle = '#1f5c2e';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
    }

    // Roads: asphalt, centre dashes and sidewalks.
    context.fillStyle = PALETTE.road;
    for (const rx of city.roadsX) context.fillRect(rx - ROAD.width / 2, y0, ROAD.width, VIEW.height);
    for (const ry of city.roadsY) context.fillRect(x0, ry - ROAD.width / 2, VIEW.width, ROAD.width);
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of city.roadsX) {
      context.fillRect(rx - ROAD.width / 2 - 8, y0, 8, VIEW.height);
      context.fillRect(rx + ROAD.width / 2, y0, 8, VIEW.height);
    }
    for (const ry of city.roadsY) {
      context.fillRect(x0, ry - ROAD.width / 2 - 8, VIEW.width, 8);
      context.fillRect(x0, ry + ROAD.width / 2, VIEW.width, 8);
    }
    context.fillStyle = PALETTE.roadLine;
    for (const rx of city.roadsX) {
      for (let y = Math.floor(y0 / 40) * 40; y < y1; y += 40) context.fillRect(rx - 2, y, 4, 20);
    }
    for (const ry of city.roadsY) {
      for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) context.fillRect(x, ry - 2, 20, 4);
    }

    // Buildings: coloured blocks with a roof line and lit windows.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.buildingRoof;
      context.fillRect(b.x, b.y, b.w, 6);
      context.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx * 7 + cy * 3 + (b.tall ? 1 : 0)) % 3 === 0) {
            context.fillRect(b.x + 8 + cx * 26, b.y + 12 + cy * 26, 10, 12);
          }
        }
      }
    }

    // Landmark signs.
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const mark of city.landmarks) {
      if (mark.x < x0 || mark.x > x1 || mark.y < y0 || mark.y > y1) continue;
      text(mark.name, mark.x, mark.y - 26, 15, PALETTE.text, 'center', 'middle');
    }
  }

  function drawCar(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const len = 44;
    const wid = 22;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(-len / 2 + 3, -wid / 2 + 3, len, wid);
    context.fillStyle = car.color;
    context.fillRect(-len / 2, -wid / 2, len, wid);
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.fillRect(-6, -wid / 2 + 3, 14, wid - 6);
    context.fillStyle = '#ffe9a8';
    context.fillRect(len / 2 - 4, -wid / 2 + 2, 3, 5);
    context.fillRect(len / 2 - 4, wid / 2 - 7, 3, 5);
    if (car.kind === 'police') {
      const t = Math.floor(performance.now() / 180) % 2 === 0;
      context.fillStyle = t ? PALETTE.policeLight : PALETTE.policeLight2;
      context.fillRect(-4, -wid / 2 - 2, 8, 5);
      context.fillStyle = t ? PALETTE.policeLight2 : PALETTE.policeLight;
      context.fillRect(-4, wid / 2 - 3, 8, 5);
      text('PD', 0, 0, 11, '#ffffff', 'center', 'middle');
    }
    if (isPlayer) {
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 2;
      context.strokeRect(-len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8);
    }
    context.restore();
  }

  function drawPed(ped) {
    if (ped.state === 'down') {
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(ped.x, ped.y, 12, 7, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#222';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) return;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#7a5200';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
    context.stroke();
  }

  function drawObjectiveArrow(state, objective) {
    if (!objective.target) return;
    const p = state.player;
    const dx = objective.target.x - p.x;
    const dy = objective.target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 90) {
      // A pulsing ring on the target itself.
      const pulse = 18 + Math.sin(performance.now() / 200) * 6;
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(objective.target.x, objective.target.y, pulse, 0, Math.PI * 2);
      context.stroke();
      return;
    }
    // An arrow at the screen edge pointing at the target, with the distance.
    const angle = Math.atan2(dy, dx);
    const cx = camera.x + VIEW.width / 2 + Math.cos(angle) * 260;
    const cy = camera.y + VIEW.height / 2 + Math.sin(angle) * 200;
    context.save();
    context.translate(cx, cy);
    context.rotate(angle);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(18, 0);
    context.lineTo(-10, -11);
    context.lineTo(-10, 11);
    context.closePath();
    context.fill();
    context.restore();
    text(`${Math.round(d)}m`, cx, cy + 30, 14, PALETTE.marker, 'center');
  }

  function drawMinimap(state, objective) {
    const mw = 220;
    const mh = 165;
    const mx = VIEW.width - mw - 14;
    const my = 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    context.fillStyle = '#1c2733';
    context.fillRect(mx, my, mw, mh);
    context.strokeStyle = '#556';
    context.lineWidth = 1;
    for (const rx of city.roadsX) {
      context.beginPath();
      context.moveTo(mx + rx * sx, my);
      context.lineTo(mx + rx * sx, my + mh);
      context.stroke();
    }
    for (const ry of city.roadsY) {
      context.beginPath();
      context.moveTo(mx, my + ry * sy);
      context.lineTo(mx + mw, my + ry * sy);
      context.stroke();
    }
    if (objective.target) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + objective.target.x * sx, my + objective.target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.dead || car.kind === 'parked') continue;
      context.fillStyle = car.kind === 'police' ? PALETTE.policeLight : '#9aa5b1';
      context.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    const p = state.player;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    // Camera frame on the minimap.
    context.strokeStyle = 'rgba(255,255,255,0.6)';
    context.strokeRect(mx + camera.x * sx, my + camera.y * sy, VIEW.width * sx, VIEW.height * sy);
  }

  function drawHud(state, objective, best) {
    const p = state.player;
    // Top-left: cash, health, ammo.
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(14, 14, 250, 86);
    text(`$${state.cash}`, 26, 44, 26, '#7CFC00', 'left');
    text(`Health ${Math.max(0, Math.round(p.health))}`, 26, 72, 16, p.health < 30 ? PALETTE.healthLow : PALETTE.text, 'left');
    context.fillStyle = '#333';
    context.fillRect(26, 80, 180, 8);
    context.fillStyle = p.health < 30 ? PALETTE.healthLow : PALETTE.health;
    context.fillRect(26, 80, 180 * Math.max(0, p.health) / 100, 8);
    text(p.inCar ? 'In car — W/S drive, A/D steer, E exit' : `Ammo ${p.ammo} — E enter car, F punch, Space shoot`, 26, 112, 13, PALETTE.muted, 'left');

    // Wanted stars, top-centre.
    text(starRow(state.stars), VIEW.width / 2, 44, 34, state.stars > 0 ? PALETTE.star : PALETTE.muted, 'center');
    if (state.stars > 0) text('WANTED', VIEW.width / 2, 68, 14, PALETTE.danger, 'center');

    drawMinimap(state, objective);

    // Mission objective, bottom-left.
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(14, VIEW.height - 78, 430, 64);
    text(`${objective.mission || 'Free roam'} — ${objective.text}`, 26, VIEW.height - 52, 16, PALETTE.text, 'left');
    if (objective.mission) text(`${objective.giver}  •  Reward $${objective.reward}  •  Step ${objective.step}/${objective.steps}`, 26, VIEW.height - 28, 13, PALETTE.muted, 'left');
    else text('Explore Solmar Bay. Steal a car, make some cash.', 26, VIEW.height - 28, 13, PALETTE.muted, 'left');

    // Speed, bottom-right.
    const speed = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 0.12) : 0;
    text(p.inCar ? `${speed} km/h` : 'On foot', VIEW.width - 26, VIEW.height - 28, 20, PALETTE.text, 'right');

    if (state.messageTimer > 0 && state.message) {
      text(state.message, VIEW.width / 2, 110, 22, PALETTE.marker, 'center');
    }
    void best;
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 34 + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(8, 12, 18, 0.88)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 72, 46, PALETTE.text, 'center');
    lines.forEach((line, i) => text(line, VIEW.width / 2, y + 128 + i * 34, 20, PALETTE.muted, 'center'));
    text(prompt, VIEW.width / 2, y + height - 34, 22, PALETTE.marker, 'center');
  }

  function draw(state, screen, objective, best) {
    const p = state.player;
    camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2));
    camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.sky;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    // Clip in world space, after the camera translation: the clip rect is
    // the camera's own window, so nothing outside the view is painted.
    context.translate(-camera.x, -camera.y);
    context.beginPath();
    context.rect(camera.x, camera.y, VIEW.width, VIEW.height);
    context.clip();
    drawCity(state);
    for (const pickup of state.pickups) {
      context.fillStyle = pickup.kind === 'cash' ? '#7CFC00' : pickup.kind === 'ammo' ? '#ffd60a' : '#ff6b6b';
      context.beginPath();
      context.arc(pickup.x, pickup.y, 10, 0, Math.PI * 2);
      context.fill();
      text(pickup.kind === 'cash' ? '$' : pickup.kind === 'ammo' ? 'A' : '+', pickup.x, pickup.y + 5, 14, '#111', 'center');
    }
    for (const car of state.cars) {
      if (car.dead) continue;
      drawCar(car, state.player.inCar === car);
    }
    for (const ped of state.peds) drawPed(ped);
    drawPlayer(state);
    for (const bullet of state.bullets) {
      context.fillStyle = '#ffe66d';
      context.beginPath();
      context.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    if (screen === SCREEN_PLAY) drawObjectiveArrow(state, objective);
    context.restore();
    // HUD and panels live in screen space, not world space.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR BAY', ['An open-world crime story in a sun-soaked city.', 'Steal cars. Run jobs for Mara Quinn. Outrun the law.', `Best cash: $${best}`], 'Press Space or click to start — Enter to continue');
    } else if (screen === SCREEN_PAUSED) {
      drawHud(state, objective, best);
      drawPanel('Paused', ['The city waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawHud(state, objective, best);
      drawPanel('WASTED', [`You went down with $${state.cash} in your pocket.`, `Best cash: $${best}`], 'Press Space to try again');
    } else if (screen === SCREEN_BUSTED) {
      drawHud(state, objective, best);
      drawPanel('BUSTED', ['The Solmar Bay PD caught up with you.', `Best cash: $${best}`], 'Press Space to try again');
    } else if (screen === SCREEN_WIN) {
      drawHud(state, objective, best);
      drawPanel('SOLMAR BAY IS YOURS', ['All three of Mara Quinn\'s jobs are done.', `You finished with $${state.cash}.`], 'Press Space to keep playing');
    } else {
      drawHud(state, objective, best);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld, view: VIEW };
}
