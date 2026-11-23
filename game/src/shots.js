// The screenshot scenes behind ?shot=start|city|chase|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a small autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// A scripted stand-in for the keyboard: the world only ever asks it for
// move(), running(), shooting() and takeActions().
function scriptedInput(steer) {
  return {
    move() { return steer(); },
    running() { return false; },
    shooting() { return false; },
    takeActions() { return 0; },
  };
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Steer a car toward a point: throttle on, steer toward the bearing.
function driveToward(world, target) {
  const car = world.state.player.inCar;
  if (!car) return { x: 0, y: 0 };
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(car.angle, desired);
  return { x: diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0, y: -1 };
}

function putPlayerInCar(world, car) {
  const p = world.state.player;
  car.kind = 'player';
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Unknown names stage the title screen.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'city') {
    // On foot at a busy downtown crossing, traffic and pedestrians around.
    world.reset();
    state.player.x = 1020;
    state.player.y = 1020;
    const idle = scriptedInput(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < 6 / STEP; i += 1) world.step(STEP, idle, 0);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // The cover: mid-getaway, four stars, police on the player's tail,
    // the safehouse objective on the HUD. The player flees east along the
    // 1000 road, so the chase stays on the road and the mission stays open.
    world.reset();
    const car = state.cars.find((c) => c.kind === 'parked' && c.x > 2000) || state.cars[0];
    putPlayerInCar(world, car);
    state.player.x = 1400;
    state.player.y = 1000;
    car.x = 1400;
    car.y = 1000;
    car.angle = 0;
    car.speed = 380;
    state.heat = 62;
    state.stars = 3;
    state.lastCrime = 0;
    world.missions.load({ index: 2, step: 1, finished: false });
    const drive = scriptedInput(() => driveToward(world, { x: 2900, y: 1000 }));
    for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, drive, 0);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mission one in progress: the stolen Comet GT, one star, heading for
    // the paint shop with the objective arrow on screen.
    world.reset();
    const comet = state.cars.find((c) => c.id === state.missionCarId);
    putPlayerInCar(world, comet);
    comet.x = 2000;
    comet.y = 1800;
    comet.angle = -Math.PI / 2;
    comet.speed = 300;
    state.heat = 26;
    state.stars = 1;
    state.lastCrime = 0;
    const drive = scriptedInput(() => driveToward(world, { x: 620, y: 620 }));
    for (let i = 0; i < 2.5 / STEP; i += 1) world.step(STEP, drive, 0);
    return { screen: SCREEN_PLAY };
  }
  // start (and anything else): the title screen over a living city.
  world.reset();
  const idle = scriptedInput(() => ({ x: 0, y: 0 }));
  for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, idle, 0);
  return { screen: SCREEN_TITLE };
}

export const SHOT_NAMES = ['start', 'city', 'chase', 'mission'];
export { SCREEN_OVER };
