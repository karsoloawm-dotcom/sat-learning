const SIGHT_INTERVAL = .125;
const NOTICE_TIME = 1.2;
const CAPTURE_RANGE = 1.12;
const WINDUP_TIME = .7;
const SEARCH_TIME = 6;
const PATROL_SPEED = 1.05;
const CHASE_SPEED = 2.05;

// All evidence is a snapshot. Movement during search only uses these snapshots.
export function createKeeperHunt(layout, actor, cue, capture) {
  let phase = "patrol", clock = 0, entered = 0, grace = 0;
  let sightIn = 0, exposure = 0, heardAt = -Infinity, seenAt = -Infinity, steps = 0, nextWindup = 0;
  let lastSeen = null, heard = null, patrolIndex = 0;
  let registerUsed = false;
  const history = [];

  function change(next, reason) {
    if (next === phase) return;
    phase = next;
    entered = clock;
    history.push({phase, reason, at: clock, lastSeen, heard});
    if (history.length > 24) history.shift();
    cue(next, reason);
  }

  function reset(seconds = 0) {
    // Menus don't advance the clock. Preserve an existing grace window.
    grace = Math.max(grace, clock + seconds);
    sightIn = exposure = steps = 0;
    heardAt = seenAt = -Infinity;
    nextWindup = clock;
    lastSeen = heard = null;
    registerUsed = false;
    patrolIndex = 0;
    change("patrol", "reset");
  }

  function hear(point, reason) {
    heard = {x:point.x, z:point.z};
    heardAt = clock;
    if (phase === "patrol" || phase === "search") change("investigate", reason);
  }

  function readRegister() {
    if (clock < grace || registerUsed || (phase !== "patrol" && phase !== "investigate")) return false;
    registerUsed = true;
    if(phase === "investigate")cue("investigate","register");
    hear(layout.registerApproach, "register");
    return true;
  }

  function step(dt, player, stride, eligible, onGround) {
    clock += dt;
    const age = clock - entered;
    const g = actor.position;
    const distance = Math.hypot(g.x - player.x, g.z - player.z);
    if (eligible && !onGround && phase !== "patrol") {
      reset(10);
      cue("escaped");
    }
    if (!eligible || !onGround || clock < grace) {
      if (phase !== "patrol") reset();
    } else {
      steps += stride;
      if (steps >= 1.2) {
        steps %= 1.2;
        const radius = stride / dt > 2.7 ? 9 : 4;
        if (distance < radius && layout.audible(g, player) && phase !== "chase" && phase !== "windup") {
          hear(player, "footsteps");
        }
      }

      if (phase === "windup") {
        if (distance > CAPTURE_RANGE || !layout.reachable(g, player)) {
          nextWindup = clock + .55;
          change("chase", "out-of-reach");
        } else if (layout.vision(g, player)) {
          lastSeen = {x:player.x, z:player.z};
          seenAt = clock;
          actor.face(player);
          if (age >= WINDUP_TIME) {
            change("capture", "contact");
            capture();
            reset(12);
            return;
          }
          actor.brace(age / WINDUP_TIME);
          return;
        } else {
          exposure = 0;
          change("search", "cover");
        }
      }

      sightIn -= dt;
      if (sightIn <= 0) {
        sightIn += SIGHT_INTERVAL;
        const facing = Math.sin(actor.heading()) * (player.x - g.x) + Math.cos(actor.heading()) * (player.z - g.z);
        const visible = distance < 9 && facing >= Math.cos(Math.PI / 3) * distance && layout.vision(g, player);
        if (visible) {
          lastSeen = {x:player.x, z:player.z};
          seenAt = clock;
          exposure += SIGHT_INTERVAL;
          if (phase === "patrol") change("investigate", "sight");
          if (phase === "investigate") actor.face(player);
          if (exposure >= NOTICE_TIME && phase !== "chase") change("chase", "seen");
          if (phase === "chase" && clock >= nextWindup && distance <= CAPTURE_RANGE && layout.reachable(g, player)) {
            change("windup", "reach");
            actor.brace(0);
            return;
          }
        } else {
          exposure = 0;
          if (phase === "chase") change("search", "cover");
        }
      }
    }

    if (phase === "investigate" || phase === "search") {
      const evidence = phase === "investigate" && heardAt > seenAt ? heard : lastSeen;
      const searchAge = clock - entered;
      if (searchAge >= SEARCH_TIME) {
        reset(10);
        cue("escaped");
      } else if (evidence && actor.walkTo(evidence, PATROL_SPEED + .35, dt)) {
        return;
      } else {
        actor.lookAround(searchAge);
        return;
      }
    }
    if (phase === "chase" && lastSeen) {
      if (!actor.walkTo(lastSeen, CHASE_SPEED, dt)) actor.lookAround(0);
      return;
    }

    const waypoint = layout.patrol[patrolIndex];
    if (!actor.walkTo(waypoint, PATROL_SPEED, dt)) {
      patrolIndex = (patrolIndex + 1) % layout.patrol.length;
      actor.lookAround(0);
    }
  }

  return {step, reset, readRegister, status:() => ({
    phase, clock, grace:Math.max(0, grace - clock), lastSeen, heard, history:history.slice()
  })};
}
