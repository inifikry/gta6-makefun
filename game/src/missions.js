// The story: three jobs for fixer Mara Quinn, each with steps the player
// must finish in order. A step names what to do and where; the world reports
// where the player is and what they are driving, and this module decides
// when a step is done and what the next objective reads.

import { MISSIONS } from './config.js';

export function createMissions() {
  let index = 0;
  let step = 0;
  let finished = false;

  function current() {
    return MISSIONS[index] ?? null;
  }

  function objective() {
    const mission = current();
    if (!mission) return { text: 'All jobs done — Solmar Bay is yours.', target: null, kind: 'done' };
    const stepDef = mission.steps[step];
    return {
      mission: mission.name,
      giver: mission.giver,
      text: stepDef.text,
      kind: stepDef.kind,
      target: stepDef.target,
      step: step + 1,
      steps: mission.steps.length,
      reward: mission.reward,
    };
  }

  // True when the player is close enough to a step's target point.
  function nearTarget(target, x, y, radius) {
    if (!target) return false;
    const dx = x - target.x;
    const dy = y - target.y;
    return dx * dx + dy * dy < radius * radius;
  }

  /**
   * Advance the mission from what the world reports. `report` carries the
   * player's position, the car they are driving (or null) and the wanted
   * stars. Returns 'step' when a step finished, 'mission' when a whole job
   * finished, or ''.
   */
  function update(report) {
    const mission = current();
    if (!mission || finished) return '';
    const stepDef = mission.steps[step];
    let done = false;
    if (stepDef.kind === 'car') {
      done = report.inMissionCar === true;
    } else if (stepDef.kind === 'drive') {
      done = report.inMissionCar === true && nearTarget(stepDef.target, report.x, report.y, 70);
    } else if (stepDef.kind === 'goto') {
      done = nearTarget(stepDef.target, report.x, report.y, 60);
    } else if (stepDef.kind === 'survive') {
      done = report.stars === 0;
    }
    if (!done) return '';
    step += 1;
    if (step >= mission.steps.length) {
      index += 1;
      step = 0;
      if (index >= MISSIONS.length) finished = true;
      return 'mission';
    }
    return 'step';
  }

  function state() {
    return { index, step, finished };
  }

  function load(saved) {
    index = Math.min(saved.index || 0, MISSIONS.length - 1);
    step = saved.step || 0;
    finished = !!saved.finished;
  }

  return { current, objective, update, state, load };
}
