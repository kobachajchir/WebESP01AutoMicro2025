type Vector = readonly [number, number, number];
type Face = { normal: Vector; corners: readonly Vector[]; opacity: number };

const FACES: readonly Face[] = [
  { normal: [0, 0, -1], corners: [[-1, -.75, -1.35], [1, -.75, -1.35], [1, .75, -1.35], [-1, .75, -1.35]], opacity: .3 },
  { normal: [0, 0, 1], corners: [[1, -.75, 1.35], [-1, -.75, 1.35], [-1, .75, 1.35], [1, .75, 1.35]], opacity: .12 },
  { normal: [-1, 0, 0], corners: [[-1, -.75, 1.35], [-1, -.75, -1.35], [-1, .75, -1.35], [-1, .75, 1.35]], opacity: .14 },
  { normal: [1, 0, 0], corners: [[1, -.75, -1.35], [1, -.75, 1.35], [1, .75, 1.35], [1, .75, -1.35]], opacity: .2 },
  { normal: [0, 1, 0], corners: [[-1, .75, -1.35], [1, .75, -1.35], [1, .75, 1.35], [-1, .75, 1.35]], opacity: .22 },
  { normal: [0, -1, 0], corners: [[-1, -.75, 1.35], [1, -.75, 1.35], [1, -.75, -1.35], [-1, -.75, -1.35]], opacity: .08 },
];

// Project the same vehicle-shaped block from each catalogued camera direction.
// The front triangle, rear bar and underside cross distinguish opposite views.
export default function SensorCameraViewIcon({ position, up = [0, 1, 0] }: {
  position: Vector;
  up?: Vector;
}) {
  const direction = normalize(position);
  const right = normalize(cross(up, direction));
  const screenUp = cross(direction, right);
  const project = (point: Vector) => `${16 + dot(point, right) * 7},${16 - dot(point, screenUp) * 7}`;
  const projectPoints = (points: readonly Vector[]) => points.map(project).join(" ");
  return <svg viewBox="0 0 32 32" className="sensor-camera-view-icon" aria-hidden="true" focusable="false">
    {FACES.filter((face) => dot(face.normal, direction) > .001).map((face, index) =>
      <polygon key={index} points={face.corners.map(project).join(" ")}
        fill="currentColor" fillOpacity={face.opacity} stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />)}
    {direction[2] < -.001 ? <polygon points={projectPoints([[0, .4, -1.36], [-.38, -.3, -1.36], [.38, -.3, -1.36]])}
      fill="currentColor" /> : null}
    {direction[2] > .001 ? <polyline points={projectPoints([[-.5, 0, 1.36], [.5, 0, 1.36]])}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /> : null}
    {direction[1] > .001 ? <polygon points={projectPoints([[0, .76, -.8], [-.4, .76, .3], [.4, .76, .3]])}
      fill="currentColor" /> : null}
    {direction[1] < -.001 ? <g stroke="currentColor" strokeWidth={1.4}>
      <polyline fill="none" points={projectPoints([[-.45, -.76, 0], [.45, -.76, 0]])} />
      <polyline fill="none" points={projectPoints([[0, -.76, -.5], [0, -.76, .5]])} />
    </g> : null}
  </svg>;
}

function dot(a: Vector, b: Vector) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vector, b: Vector): Vector {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(vector: Vector): Vector {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
