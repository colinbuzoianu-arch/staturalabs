import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { PoseLandmarker } from "@mediapipe/tasks-vision";

// Draws one detected skeleton (lines along PoseLandmarker.POSE_CONNECTIONS,
// dots at each landmark) onto a canvas already sized to the source frame.
// landmarks are normalized [0,1]; width/height convert to pixel space.
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly NormalizedLandmark[],
  width: number,
  height: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
    const start = landmarks[connection.start];
    const end = landmarks[connection.end];
    if (!start || !end) continue;
    ctx.beginPath();
    ctx.moveTo(start.x * width, start.y * height);
    ctx.lineTo(end.x * width, end.y * height);
    ctx.stroke();
  }

  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export type NormalizedBoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

// Normalized ([0,1]) bounding box around a skeleton's landmarks — used to
// size/position the clickable hit-region over each detected person in the
// multi-person picker.
export function boundingBox(
  landmarks: readonly NormalizedLandmark[],
): NormalizedBoundingBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return { minX, minY, maxX, maxY };
}
