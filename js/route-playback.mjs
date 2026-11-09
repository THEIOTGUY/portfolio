// Metric route sampling is shared by playback and its checks.
export function createRoutePlayback(route, speed = 0.7, hold = 3) {
  const distances = [0];
  for (let i = 1; i < route.length; i++) {
    const segment = Math.hypot(route[i][0] - route[i - 1][0], route[i][2] - route[i - 1][2]);
    if (!(segment > 0)) throw new Error('Route points must be distinct');
    distances.push(distances.at(-1) + segment);
  }
  const length = distances.at(-1);
  if (!(length > 0)) throw new Error('Route must have at least two points');
  const leg = length / speed, duration = 2 * (leg + hold);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function poseAt(distance) {
    const d = clamp(distance, 0, length);
    let i = 1;
    while (i < distances.length - 1 && distances[i] < d) i++;
    const t = (d - distances[i - 1]) / (distances[i] - distances[i - 1]);
    return route[i].map((v, k) => route[i - 1][k] + (v - route[i - 1][k]) * t);
  }
  function headingAt(distance) {
    const a = poseAt(distance - 0.3), b = poseAt(distance + 0.3);
    return Math.atan2(b[2] - a[2], b[0] - a[0]);
  }
  function at(time) {
    const phase = ((time % duration) + duration) % duration;
    const outbound = phase < leg + hold;
    const distance = outbound ? Math.min(length, phase * speed) : Math.max(0, length - (phase - leg - hold) * speed);
    const turning = outbound ? phase >= leg : phase >= 2 * leg + hold;
    const turn = turning ? clamp((phase - (outbound ? leg : 2 * leg + hold)) / hold, 0, 1) : 0;
    const heading = headingAt(distance) + (outbound ? 0 : Math.PI) + turn * Math.PI;
    return { distance, position: poseAt(distance), heading, outbound, turning, phase };
  }
  return { distances, length, leg, duration, poseAt, at, timeAt: fraction => clamp(fraction, 0, 1) * leg };
}

export function blendAngle(from, to, amount) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}
