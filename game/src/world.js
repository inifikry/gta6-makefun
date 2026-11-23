// The simulation: the player on foot or in a car, traffic and pedestrians,
// police who chase the wanted level, bullets and pickups, collisions and the
// mission tracker. No drawing and no browser in here: step() advances one
// fixed step and returns what happened as bit flags, so the caller can play
// the right sound and change screens without the world knowing about them.

import { BEACH_Y, CAR, MISSIONS, PALETTE, PICKUP, PLAYER, POLICE, ROAD, WANTED, WORLD } from './config.js';
import { createMissions } from './missions.js';

export const EVENT_PICKUP = 1;
export const EVENT_CRIME = 2;
export const EVENT_HIT = 4;
export const EVENT_SHOT = 8;
export const EVENT_PUNCH = 16;
export const EVENT_STEP = 32;
export const EVENT_MISSION = 64;
export const EVENT_BUSTED = 128;
export const EVENT_WASTED = 256;

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random, city) {
  const missions = createMissions();
  const state = {
    player: null,
    cars: [],
    peds: [],
    bullets: [],
    pickups: [],
    heat: 0,
    stars: 0,
    elapsed: 0,
    lastCrime: -99,
    cash: 0,
    carsStolen: 0,
    missionCarId: 0,
    bustTimer: 0,
    heatArmed: false,
    message: '',
    messageTimer: 0,
  };

  function makeCar(kind, x, y, angle, color) {
    return {
      id: state.cars.length + 1,
      kind,
      x, y, angle,
      speed: 0,
      color,
      // Traffic: which road it follows and which way along it.
      axis: 'x',
      dir: 1,
      road: 0,
      cruise: CAR.cruise + (random.next() - 0.5) * CAR.cruiseJitter * 2,
      ramCd: 0,
      shootCd: 0,
      dead: false,
    };
  }

  function spawnTrafficCar() {
    const point = city.randomRoadPoint();
    const car = makeCar('traffic', point.x, point.y, 0, random.pick(PALETTE.traffic));
    const onX = city.roadsX.some((rx) => Math.abs(point.x - rx) < 2);
    if (onX) {
      car.axis = 'y';
      car.road = point.x;
      car.dir = random.next() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'x';
      car.road = point.y;
      car.dir = random.next() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
    // Keep it in its lane, not on the centreline.
    if (car.axis === 'x') car.y = car.road + (car.dir > 0 ? ROAD.lane : -ROAD.lane);
    else car.x = car.road + (car.dir > 0 ? -ROAD.lane : ROAD.lane);
    car.speed = car.cruise;
    return car;
  }

  function spawnPed() {
    const point = city.randomRoadPoint();
    return {
      x: point.x + (random.next() - 0.5) * 60,
      y: point.y + (random.next() - 0.5) * 60,
      angle: random.next() * TAU,
      speed: 34 + random.next() * 26,
      color: random.pick(PALETTE.ped),
      state: 'walk',
      target: city.randomRoadPoint(),
      fleeTimer: 0,
      downTimer: 0,
    };
  }

  function spawnParked(x, y, angle, color, missionCar) {
    const car = makeCar('parked', x, y, angle, color);
    if (missionCar) state.missionCarId = car.id;
    return car;
  }

  function spawnPolice() {
    const p = state.player;
    // Arrive from the road nearest the player, a little way off.
    const point = city.nearestRoadPoint(p.x + (random.next() - 0.5) * 900, p.y + (random.next() - 0.5) * 900);
    const car = makeCar('police', point.x, point.y, 0, PALETTE.police);
    car.speed = POLICE.chaseSpeed;
    return car;
  }

  function addCrime(amount) {
    state.heat = Math.min(100, state.heat + amount);
    state.lastCrime = state.elapsed;
  }

  function starsFromHeat(heat) {
    return heat <= 0 ? 0 : Math.min(5, Math.ceil(heat / 20));
  }

  function reset(save) {
    state.cars = [];
    state.peds = [];
    state.bullets = [];
    state.pickups = [];
    state.heat = 0;
    state.stars = 0;
    state.elapsed = 0;
    state.lastCrime = -99;
    state.cash = save?.cash ?? 0;
    state.carsStolen = 0;
    state.bustTimer = 0;
    state.heatArmed = false;
    state.message = '';
    state.messageTimer = 0;
    state.player = {
      x: 600, y: 1000, angle: -Math.PI / 2,
      health: PLAYER.health, ammo: PLAYER.ammoMax,
      inCar: null, punchCd: 0, shootCd: 0, invuln: 0,
    };
    // The Comet GT waiting at the marina for mission one.
    state.cars.push(spawnParked(2920, 1900, Math.PI / 2, '#ffd60a', true));
    state.cars.push(spawnParked(660, 660, 0, '#8ecae6', false));
    state.cars.push(spawnParked(1420, 1020, Math.PI, '#f4a261', false));
    state.cars.push(spawnParked(2200, 620, -Math.PI / 2, '#90be6d', false));
    state.cars.push(spawnParked(1020, 1420, 0, '#adb5bd', false));
    for (let i = 0; i < 10; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < 16; i += 1) state.peds.push(spawnPed());
    state.pickups.push({ x: 640, y: 940, kind: 'cash' });
    state.pickups.push({ x: 1060, y: 660, kind: 'ammo' });
    state.pickups.push({ x: 2220, y: 1060, kind: 'health' });
    state.pickups.push({ x: 1820, y: 1820, kind: 'cash' });
    if (save?.mission) missions.load(save.mission);
    else missions.load({ index: 0, step: 0, finished: false });
  }

  function nearestCar(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      if (car.dead || !kinds.includes(car.kind)) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;

    if (p.inCar) {
      const car = p.inCar;
      const move = input.move();
      // W/S is throttle and brake; A/D steers, weaker the slower the car is.
      if (move.y < 0) car.speed += CAR.accel * dt;
      else if (move.y > 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.5) * dt;
      else car.speed -= Math.sign(car.speed) * 140 * dt;
      if (Math.abs(car.speed) < 8 && move.y === 0) car.speed = 0;
      car.speed = Math.max(-CAR.reverse, Math.min(CAR.maxSpeed, car.speed));
      const steer = move.x * CAR.turn * Math.min(1, Math.abs(car.speed) / 140) * Math.sign(car.speed || 1);
      car.angle += steer * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      city.resolveCircle(car, CAR.radius);
      car.x = Math.max(24, Math.min(WORLD.width - 24, car.x));
      car.y = Math.max(24, Math.min(WORLD.height - 24, car.y));
      // Running a pedestrian over is a crime, and it shows.
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist(car.x, car.y, ped.x, ped.y) < CAR.radius + 12 && Math.abs(car.speed) > 150) {
          ped.state = 'down';
          ped.downTimer = 6;
          addCrime(WANTED.hitPed);
        }
      }
      return 0;
    }

    // On foot: walk or run, blocked by buildings, kept inside the world.
    const move = input.move();
    const len = Math.hypot(move.x, move.y) || 1;
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.x += (move.x / len) * speed * dt * (move.x || move.y ? 1 : 0);
    p.y += (move.y / len) * speed * dt * (move.x || move.y ? 1 : 0);
    if (move.x || move.y) p.angle = Math.atan2(move.y, move.x);
    city.resolveCircle(p, PLAYER.radius);
    p.x = Math.max(16, Math.min(WORLD.width - 16, p.x));
    p.y = Math.max(16, Math.min(WORLD.height - 16, p.y));
    return 0;
  }

  function stepTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.kind !== 'traffic' || car.dead) continue;
      // Brake for the car ahead on the same road.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.dead) continue;
        if (other.axis !== car.axis || other.road !== car.road) continue;
        const ahead = car.axis === 'x' ? (other.x - car.x) * car.dir : (other.y - car.y) * car.dir;
        const lateral = car.axis === 'x' ? Math.abs(other.y - car.y) : Math.abs(other.x - car.x);
        if (ahead > 0 && ahead < 70 && lateral < 40) { blocked = true; break; }
      }
      const target = blocked ? 0 : car.cruise;
      car.speed += Math.sign(target - car.speed) * 200 * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const cross = car.axis === 'x' ? city.roadsY : city.roadsX;
      const pos = car.axis === 'x' ? car.y : car.x;
      const along = car.axis === 'x' ? car.x : car.y;
      for (const line of cross) {
        if (Math.abs(along - line) < 6 && random.next() < 0.004) {
          const turn = random.next();
          if (turn < 0.4) {
            car.axis = car.axis === 'x' ? 'y' : 'x';
            car.road = line;
            car.dir = random.next() < 0.5 ? 1 : -1;
            car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
            if (car.axis === 'x') car.y = line + (car.dir > 0 ? ROAD.lane : -ROAD.lane);
            else car.x = line + (car.dir > 0 ? -ROAD.lane : ROAD.lane);
          }
          break;
        }
      }
      void pos;
      // Out of the city or stuck: respawn on a random road.
      if (car.x < -80 || car.x > WORLD.width + 80 || car.y < -80 || car.y > BEACH_Y + 80) {
        const fresh = spawnTrafficCar();
        Object.assign(car, fresh);
      }
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) { ped.state = 'walk'; ped.target = city.randomRoadPoint(); }
        continue;
      }
      const dPlayer = dist(ped.x, ped.y, p.x, p.y);
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
        const away = Math.atan2(ped.y - p.y, ped.x - p.x);
        ped.x += Math.cos(away) * ped.speed * 1.8 * dt;
        ped.y += Math.sin(away) * ped.speed * 1.8 * dt;
        ped.angle = away;
      } else {
        if (dPlayer < 90 && p.inCar && Math.abs(p.inCar.speed) > 200) { ped.state = 'flee'; ped.fleeTimer = 2; continue; }
        const dx = ped.target.x - ped.x;
        const dy = ped.target.y - ped.y;
        const d = Math.hypot(dx, dy);
        if (d < 24) { ped.target = city.randomRoadPoint(); continue; }
        ped.angle = Math.atan2(dy, dx);
        ped.x += (dx / d) * ped.speed * dt;
        ped.y += (dy / d) * ped.speed * dt;
      }
      city.resolveCircle(ped, 10);
      ped.x = Math.max(16, Math.min(WORLD.width - 16, ped.x));
      ped.y = Math.max(16, Math.min(WORLD.height - 16, ped.y));
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    const wanted = POLICE.carsPerStar[state.stars] || 0;
    let police = state.cars.filter((c) => c.kind === 'police' && !c.dead);
    while (police.length < wanted) {
      const car = spawnPolice();
      state.cars.push(car);
      police.push(car);
    }
    // Extra patrol cars cruise off when the heat is gone.
    if (police.length > wanted) {
      for (let i = police.length - 1; i >= wanted; i -= 1) police[i].dead = true;
    }
    let touching = false;
    for (const car of police) {
      if (car.dead) continue;
      if (car.ramCd > 0) car.ramCd -= dt;
      if (car.shootCd > 0) car.shootCd -= dt;
      const desired = Math.atan2(p.y - car.y, p.x - car.x);
      car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, angleDiff(car.angle, desired)));
      car.speed = POLICE.chaseSpeed;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      city.resolveCircle(car, CAR.radius);
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < CAR.radius + PLAYER.radius + 6) {
        touching = true;
        if (car.ramCd <= 0 && p.inCar) {
          car.ramCd = POLICE.ramCooldown;
          p.health -= POLICE.ramDamage;
          if (p.invuln <= 0) { p.invuln = 0.5; }
        }
      }
      // At three stars and up the police open fire.
      if (state.stars >= POLICE.shootFromStar && car.shootCd <= 0 && d < 520) {
        car.shootCd = POLICE.shootCooldown;
        const spread = (random.next() - 0.5) * 0.3;
        state.bullets.push({
          x: car.x, y: car.y,
          vx: Math.cos(desired + spread) * PLAYER.bulletSpeed,
          vy: Math.sin(desired + spread) * PLAYER.bulletSpeed,
          from: 'police', life: 1.6,
        });
      }
    }
    if (touching && !p.inCar) {
      state.bustTimer += dt;
      if (state.bustTimer >= POLICE.bustTime) return EVENT_BUSTED;
    } else if (touching && p.inCar && Math.abs(p.inCar.speed) < 25) {
      state.bustTimer += dt;
      if (state.bustTimer >= POLICE.bustTime * 1.6) return EVENT_BUSTED;
    } else {
      state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    }
    return 0;
  }

  function stepBullets(dt) {
    const p = state.player;
    let events = 0;
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0) continue;
      if (city.buildingAt(bullet.x, bullet.y)) { bullet.life = 0; continue; }
      if (bullet.from === 'player') {
        for (const ped of state.peds) {
          if (ped.state === 'down') continue;
          if (dist(bullet.x, bullet.y, ped.x, ped.y) < 14) {
            bullet.life = 0;
            ped.state = 'down';
            ped.downTimer = 8;
            addCrime(WANTED.killPed);
            events |= EVENT_CRIME;
            break;
          }
        }
        if (bullet.life <= 0) continue;
        for (const car of state.cars) {
          if (car.dead || car.kind === 'parked') continue;
          if (dist(bullet.x, bullet.y, car.x, car.y) < CAR.radius + 6) {
            bullet.life = 0;
            if (car.kind === 'police') {
              car.dead = true;
              addCrime(WANTED.killCop);
              events |= EVENT_CRIME;
            }
            break;
          }
        }
      } else if (dist(bullet.x, bullet.y, p.x, p.y) < PLAYER.radius + 4 && p.invuln <= 0) {
        bullet.life = 0;
        p.health -= 8;
        p.invuln = 0.4;
        events |= EVENT_HIT;
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    return events;
  }

  function stepPickups(dt) {
    const p = state.player;
    let events = 0;
    for (const pickup of state.pickups) {
      if (dist(p.x, p.y, pickup.x, pickup.y) < 34) {
        pickup.taken = true;
        if (pickup.kind === 'cash') state.cash += PICKUP.cashValue;
        else if (pickup.kind === 'ammo') p.ammo = Math.min(PLAYER.ammoMax, p.ammo + PICKUP.ammoValue);
        else p.health = Math.min(PLAYER.health, p.health + PICKUP.healthValue);
        events |= EVENT_PICKUP;
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    void dt;
    return events;
  }

  function handleActions(dt, input, aimAngle) {
    const p = state.player;
    const actions = input.takeActions();
    let events = 0;
    if (actions & 4) { // ACTION_ENTER
      if (p.inCar) {
        const car = p.inCar;
        p.inCar = null;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      } else {
        const car = nearestCar(p.x, p.y, 56, ['parked', 'traffic']);
        if (car) {
          if (car.kind === 'parked' || car.kind === 'traffic') {
            addCrime(WANTED.steal);
            events |= EVENT_CRIME;
            state.carsStolen += 1;
            state.message = car.id === state.missionCarId ? 'Comet GT stolen — get to the paint shop!' : 'Car stolen!';
            state.messageTimer = 3;
          }
          car.kind = 'player';
          p.inCar = car;
          p.x = car.x;
          p.y = car.y;
        }
      }
    }
    if (actions & 8) { // ACTION_PUNCH
      if (!p.inCar && p.punchCd <= 0) {
        p.punchCd = PLAYER.punchCooldown;
        events |= EVENT_PUNCH;
        const hx = p.x + Math.cos(p.angle) * PLAYER.punchRange;
        const hy = p.y + Math.sin(p.angle) * PLAYER.punchRange;
        for (const ped of state.peds) {
          if (ped.state !== 'down' && dist(hx, hy, ped.x, ped.y) < 26) {
            ped.state = 'down';
            ped.downTimer = 5;
            addCrime(WANTED.hitPed);
            events |= EVENT_CRIME;
          }
        }
      }
    }
    if (!p.inCar && (input.shooting() || (actions & 16)) && p.shootCd <= 0 && p.ammo > 0) {
      p.shootCd = PLAYER.shootCooldown;
      p.ammo -= 1;
      addCrime(WANTED.shoot);
      events |= EVENT_SHOT | EVENT_CRIME;
      state.bullets.push({
        x: p.x + Math.cos(aimAngle) * 20,
        y: p.y + Math.sin(aimAngle) * 20,
        vx: Math.cos(aimAngle) * PLAYER.bulletSpeed,
        vy: Math.sin(aimAngle) * PLAYER.bulletSpeed,
        from: 'player', life: 1.4,
      });
    }
    void dt;
    return events;
  }

  /**
   * One fixed step. `input` is the input device (or a scripted stand-in with
   * the same shape) and `aimAngle` is where the player aims on foot.
   */
  function step(dt, input, aimAngle) {
    let events = 0;
    state.elapsed += dt;
    const p = state.player;

    events |= stepPlayer(dt, input);
    events |= handleActions(dt, input, aimAngle);
    stepTraffic(dt);
    stepPeds(dt);
    events |= stepPolice(dt);
    events |= stepBullets(dt);
    events |= stepPickups(dt);

    // Wanted heat cools off when the player stays out of sight.
    if (state.elapsed - state.lastCrime > WANTED.decayDelay && state.stars > 0) {
      const nearCop = state.cars.some((c) => c.kind === 'police' && !c.dead && dist(c.x, c.y, p.x, p.y) < 420);
      if (!nearCop) state.heat = Math.max(0, state.heat - WANTED.decay * dt);
    }
    state.stars = starsFromHeat(state.heat);

    // Mission three starts hot: the heat is set once, when the job begins.
    const mission = missions.current();
    if (mission && mission.id === 'heat-wave' && missions.state().step === 0 && !state.heatArmed) {
      state.heatArmed = true;
      state.heat = 60;
      state.stars = 3;
      state.lastCrime = state.elapsed;
    }

    const report = {
      x: p.x, y: p.y,
      inMissionCar: p.inCar !== null && p.inCar.id === state.missionCarId,
      stars: state.stars,
    };
    const missionEvent = missions.update(report);
    if (missionEvent === 'step') {
      events |= EVENT_STEP;
      state.message = 'Objective complete!';
      state.messageTimer = 2.5;
    } else if (missionEvent === 'mission') {
      events |= EVENT_MISSION;
      state.cash += mission.reward;
      state.message = `${mission.name} complete — $${mission.reward}`;
      state.messageTimer = 3.5;
    }

    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (p.health <= 0) return events | EVENT_WASTED;
    if (p.health < PLAYER.health && state.stars === 0) p.health = Math.min(PLAYER.health, p.health + 2 * dt);
    return events;
  }

  function save() {
    return { cash: state.cash, mission: missions.state() };
  }

  reset();
  return { state, missions, reset, step, addCrime, starsFromHeat, nearestCar };
}
