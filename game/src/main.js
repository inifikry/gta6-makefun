// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, wasted, busted and win screens, and saves the
// player's cash and mission progress to localStorage.
//
// ?seed=N fixes the city and the traffic. ?shot=start|city|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createWorld, EVENT_BUSTED, EVENT_CRIME, EVENT_HIT, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_STEP, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const world = createWorld(random, city);
const renderer = createRenderer(canvas, city);
const audio = createAudio();

function readSave() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.save()));
    const best = Math.max(readBest(), world.state.cash);
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, world.missions.objective(), 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const saved = readSave();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let winShown = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    world.reset(fresh ? null : saved);
    accumulator = 0;
    winShown = false;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Follow the objective at the bottom of the screen.');
  }

  function endRun(nextScreen, message) {
    screen = nextScreen;
    saveGame();
    best = Math.max(best, world.state.cash);
    announce(message);
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_STEP) audio.click();
    if (events & EVENT_MISSION) {
      audio.mission();
      saveGame();
      if (world.missions.state().finished && !winShown) {
        winShown = true;
        screen = SCREEN_WIN;
        announce('All jobs done. Solmar Bay is yours.');
      }
    }
    if (events & EVENT_CRIME) announce('The police are onto you.');
    if (events & EVENT_WASTED) endRun(SCREEN_OVER, `Wasted. You went down with $${world.state.cash}.`);
    else if (events & EVENT_BUSTED) {
      audio.bust();
      endRun(SCREEN_BUSTED, 'Busted. The Solmar Bay PD caught up with you.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame(false);
      else if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) startGame(true);
      else if (screen === SCREEN_WIN) screen = SCREEN_PLAY;
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      audio.unlock();
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function aimAngle() {
    const mouse = input.mouse();
    const target = renderer.toWorld(mouse.x, mouse.y);
    const p = world.state.player;
    return Math.atan2(target.y - p.y, target.x - p.x);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = world.step(STEP, input, aimAngle());
        handleEvents(events);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) { accumulator = 0; break; }
      }
    } else if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { move: () => ({ x: 0, y: 0 }), running: () => false, shooting: () => false, takeActions: () => 0 }, 0);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const p = world.state.player;
    audio.siren(screen === SCREEN_PLAY && world.state.stars > 0);
    audio.engine(screen === SCREEN_PLAY && p.inCar ? Math.abs(p.inCar.speed) / 560 : 0);
    renderer.draw(world.state, screen, world.missions.objective(), best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
