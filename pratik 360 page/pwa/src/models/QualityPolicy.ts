import { FrameQuality } from '../geometry/FrameQuality';
import type { FrameQualityMetrics } from '../geometry/FrameQuality';
import type { FrameQualityRecord } from './CaptureModels';

/** Automatic retakes before the user is asked to decide. */
export const AUTO_RETAKES = 2;

export type GateAction =
  /** Store the photo with this record. */
  | { kind: 'accept'; record: FrameQualityRecord }
  /** Discard and retake automatically (dot stays open). */
  | { kind: 'retry'; message: string }
  /** Stop and ask: retake, or keep with a recorded warning. Never decided silently. */
  | { kind: 'ask'; reason: string; record: FrameQualityRecord };

function toRecord(m: FrameQualityMetrics | null, status: FrameQualityRecord['status'], note: string | null): FrameQualityRecord {
  return {
    status,
    blurRatio: m ? +m.blurRatio.toFixed(3) : NaN,
    structureRatio: m ? +m.structureRatio.toFixed(3) : undefined,
    meanLuma: m ? +m.meanLuma.toFixed(1) : NaN,
    clipped: m ? +m.clippedFraction.toFixed(3) : NaN,
    shadowClipped: m ? +m.shadowClippedFraction.toFixed(3) : undefined,
    lowTexture: m ? m.lowTexture : false,
    note
  };
}

/**
 * The one quality policy for every capture path (video-frame grab, canvas fallback,
 * simulator, import). Failed photos are retried automatically twice; the third failure, and
 * any photo whose quality could not be measured, requires an explicit user decision.
 *
 * @param failuresSoFar automatic failures already recorded for this dot
 */
export function qualityGate(
  metrics: FrameQualityMetrics | null,
  options: { simulated: boolean; failuresSoFar: number; acceptedRatios: number[] }
): GateAction {
  if (options.simulated) {
    return { kind: 'accept', record: toRecord(metrics, 'simulated', 'Synthetic simulator frame') };
  }
  const verdict = FrameQuality.assess(metrics, options.acceptedRatios);
  if (verdict.status === 'passed') return { kind: 'accept', record: toRecord(metrics, 'passed', verdict.note) };
  if (verdict.status === 'unavailable') {
    return { kind: 'ask', reason: verdict.reason ?? 'Quality could not be measured', record: toRecord(null, 'unavailable', verdict.reason) };
  }
  if (options.failuresSoFar < AUTO_RETAKES) {
    return { kind: 'retry', message: `${verdict.reason ?? 'Photo rejected'} · retaking` };
  }
  return { kind: 'ask', reason: verdict.reason ?? 'Photo failed the quality check', record: toRecord(metrics, 'failed', verdict.reason) };
}

/** Record of a user's explicit choice to keep a photo that failed or could not be checked. */
export function acceptedWithWarning(record: FrameQualityRecord): FrameQualityRecord {
  return { ...record, decision: 'accepted-with-warning' };
}
