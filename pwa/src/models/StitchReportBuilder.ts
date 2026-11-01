import type { CaptureDocument, StitchReport } from './CaptureModels';
import type { StitchOutcome } from '../services/StitchPipeline';

/** Required share of the sphere above the optional nadir. */
export const COVERAGE_TARGET = 0.995;

/**
 * Single source of the stitch report and its warnings (UI and capture.json both use this),
 * plus whether the lens calibration may learn from this stitch.
 */
export function buildStitchReport(
  outcome: StitchOutcome,
  capture: CaptureDocument,
  clampedNote: string | null
): { report: StitchReport; calibrationConfidence: number } {
  const al = outcome.alignment;
  const s = outcome.seamStats;
  const warnings: string[] = [];
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  if (clampedNote) warnings.push(clampedNote);
  if (outcome.photographedCoverage < COVERAGE_TARGET) {
    warnings.push(`Only ${pct(outcome.photographedCoverage)} of the required sphere was photographed — retake the missing areas.`);
  }
  if (outcome.filledFraction > 0.001) {
    warnings.push(
      `${pct(outcome.filledFraction)} of the panorama is a synthetic blur fill (no photo there). Heritage mode (Fill gaps off) leaves it black.`
    );
  } else if (outcome.missingFraction > 0.001) {
    warnings.push(`${pct(outcome.missingFraction)} of the sphere has no photo and is shown black (heritage mode).`);
  }
  if (al.reverted) {
    warnings.push('Image alignment made the photos agree worse than the motion sensors did, so sensor positions were kept. Check seams.');
  }
  if (al.focalRejected) {
    warnings.push(`The lens focal estimate (×${al.focalRejected.toFixed(3)}) was implausible and was not used.`);
  }
  if (al.components > 1) {
    warnings.push(`The photos form ${al.components} separate groups with no verified link between them — their relative placement relies on motion sensors.`);
  }
  if (al.unconstrainedFrames.length > 0) {
    warnings.push(`${al.unconstrainedFrames.length} photo(s) could not be verified against any neighbour and were placed by motion sensors only.`);
  }
  if (al.matches < 3 * capture.frames.length) {
    warnings.push('Few verified matching details between photos; alignment relied mostly on motion sensors.');
  }
  if (al.ambiguousMatches > 0 && al.ambiguousMatches > al.rawMatches * 0.3) {
    warnings.push('Many points matched several places equally well (repeating architecture). Check repeated arches, pillars and windows for misplacement.');
  }
  if (al.rmsAfter > 2) {
    warnings.push(`Residual alignment error ${al.rmsAfter.toFixed(1)} px — likely parallax (phone moved, or very close objects). Retake turning the phone around its lens.`);
  }
  if (outcome.detailRatio < 0.85) {
    warnings.push('Output width exceeds the detail the photos contain; a smaller width loses nothing.');
  }
  if (outcome.ghostRiskAreas.length > 0) {
    const where = outcome.ghostRiskAreas
      .map((g) => `yaw ${Math.round(g.yaw)}°, pitch ${Math.round(g.pitch)}° (${g.errorPx.toFixed(1)} px)`)
      .join('; ');
    warnings.push(`Possible ghosting (parallax or movement) near: ${where}.`);
  }
  if (s.assigned > 0) {
    warnings.push(`${s.assigned} area(s) where photos disagreed (people, moving or near objects) were taken from a single photo to avoid double images.`);
  }
  const unresolved = s.skippedTooLarge + s.skippedNoCoveringFrame + s.skippedLowConfidence;
  if (unresolved > 0) {
    warnings.push(`${unresolved} area(s) where photos disagreed could NOT be resolved (too large, not covered by one photo, or unverified) — check for double images.`);
  }
  if (!outcome.usedWebGL) warnings.push('Stitched with the CPU renderer (graphics acceleration unavailable).');

  const fq = { checked: 0, unavailable: 0, acceptedWithWarning: 0, lowTexture: 0 };
  for (const f of capture.frames) {
    const q = f.quality;
    if (!q) {
      fq.unavailable++;
      continue;
    }
    if (q.status === 'unavailable') fq.unavailable++;
    else fq.checked++;
    if (q.decision === 'accepted-with-warning') fq.acceptedWithWarning++;
    if (q.lowTexture) fq.lowTexture++;
  }
  if (fq.acceptedWithWarning > 0) warnings.push(`${fq.acceptedWithWarning} photo(s) failed the quality check and were kept by your choice.`);
  if (fq.unavailable > 0) warnings.push(`${fq.unavailable} photo(s) could not be quality-checked.`);

  // Per-photo retake guidance: which photos, where they were aimed, and why.
  const retakeMap = new Map<number, string[]>();
  const addReason = (frame: number, reason: string) => {
    const list = retakeMap.get(frame) ?? [];
    list.push(reason);
    retakeMap.set(frame, list);
  };
  for (const k of al.unconstrainedFrames) addReason(k, 'no verified overlap with any neighbour — retake with ~30% more overlap and keep the phone turning on the spot');
  if (al.components > 1 && al.componentOf) {
    const sizes = new Map<number, number>();
    for (const g of al.componentOf) sizes.set(g, (sizes.get(g) ?? 0) + 1);
    const main = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    al.componentOf.forEach((g, k) => {
      if (g !== main && !al.unconstrainedFrames.includes(k)) addReason(k, 'linked only to a small group that is not verified against the main panorama');
    });
  }
  capture.frames.forEach((f, k) => {
    const q = f.quality;
    if (q?.decision === 'accepted-with-warning') addReason(k, q.note ?? 'kept despite failing the quality check (blur, exposure or low detail)');
    else if (q && q.status === 'unavailable') addReason(k, 'quality could not be measured');
  });
  const aim = (k: number) => {
    const t = capture.frames[k].transform;
    const fx = -t[8], fy = -t[9], fz = -t[10];
    const yaw = (Math.atan2(fx, -fz) * 180) / Math.PI - capture.referenceWorldYaw;
    return { yaw: Math.round(((yaw + 540) % 360) - 180), pitch: Math.round((Math.asin(Math.max(-1, Math.min(1, fy))) * 180) / Math.PI) };
  };
  const retake = [...retakeMap.entries()].sort((a, b) => a[0] - b[0]).map(([frame, reasons]) => ({ frame, ...aim(frame), reasons }));
  const { verdict, reasons: verdictReasons } = verdictFor({
    frames: capture.frames.length,
    unconstrained: al.unconstrainedFrames.length,
    components: al.components,
    reverted: al.reverted,
    coverage: outcome.photographedCoverage,
    filled: outcome.filledFraction,
    seamsDetected: s.detected,
    seamsUnresolvedLarge: s.skippedTooLarge + s.skippedNoCoveringFrame,
    seamsUnresolved: unresolved,
    lowConfidenceOverlapShare: s.overlapCells > 0 ? s.lowConfidenceCells / s.overlapCells : 0,
    ghostRiskAreas: outcome.ghostRiskAreas.length,
    rmsAfter: al.rmsAfter,
    confidence: al.confidence,
    verified: al.matches,
    retakeCount: retake.length,
    qualityUnavailable: fq.unavailable,
    qualityKeptFailed: fq.acceptedWithWarning,
    detailRatio: outcome.detailRatio
  });
  if (verdict === 'retake') {
    warnings.unshift(`Verdict: RETAKE — not reliable enough for documentation: ${verdictReasons.join('; ')}.`);
  } else if (verdict === 'review') {
    warnings.unshift(`Verdict: REVIEW — ${verdictReasons.join('; ')}.`);
  }

  const report: StitchReport = {
    photographedCoverage: outcome.photographedCoverage,
    filledFraction: outcome.filledFraction,
    missingFraction: outcome.missingFraction,
    matches: {
      pairs: al.pairs,
      verifiedPairs: al.verifiedPairs,
      raw: al.rawMatches,
      ambiguous: al.ambiguousMatches,
      verified: al.matches,
      rejected: al.rejectedMatches,
      insufficient: al.insufficientMatches,
      weakPairs: al.weakPairs
    },
    alignment: {
      rmsBeforePx: al.rmsBefore,
      rmsAfterPx: al.rmsAfter,
      focalScale: al.focalScale,
      focalRejected: al.focalRejected ?? null,
      reverted: al.reverted,
      converged: al.converged,
      iterations: al.iterations,
      components: al.components,
      unconstrainedFrames: al.unconstrainedFrames,
      confidence: al.confidence
    },
    seams: {
      regionsDetected: s.detected,
      regionsAssigned: s.assigned,
      regionsSkippedTooLarge: s.skippedTooLarge,
      regionsSkippedNoCoveringPhoto: s.skippedNoCoveringFrame,
      regionsSkippedLowConfidence: s.skippedLowConfidence,
      // Share of the OVERLAP area (cells seen by ≥ 2 photos) where no overlapping photo is verified.
      lowConfidenceShare: s.overlapCells > 0 ? s.lowConfidenceCells / s.overlapCells : 0,
      // Same cells as a share of the whole panorama grid.
      lowConfidencePanoramaShare: s.gridCells > 0 ? s.lowConfidenceCells / s.gridCells : 0
    },
    vignetting: { cornerLoss: outcome.vignetting.cornerLoss, applied: outcome.vignetting.applied, samples: outcome.vignetting.samples },
    ghostRiskAreas: outcome.ghostRiskAreas,
    renderer: outcome.usedWebGL ? 'webgl2' : 'cpu',
    outputWidth: capture.settings.width,
    decodeSize: outcome.decodeSize,
    detailRatio: outcome.detailRatio,
    millis: Object.values(outcome.timings).reduce((a, b) => a + b, 0),
    timings: outcome.timings,
    peakMBEstimate: Math.round(outcome.peakBytesEstimate / (1024 * 1024)),
    frameQuality: fq,
    verdict,
    verdictReasons,
    retake,
    frameLinks: al.frameLinks,
    warnings
  };

  // Lens calibration learns only from a trustworthy, single-group, non-reverted solve whose
  // focal estimate was accepted.
  const calibrationConfidence =
    al.reverted || al.focalRejected || al.components > 1 || !al.converged ? 0 : al.confidence;
  return { report, calibrationConfidence };
}

export interface VerdictInput {
  frames: number;
  unconstrained: number;
  components: number;
  reverted: boolean;
  coverage: number;
  filled: number;
  seamsDetected: number;
  seamsUnresolvedLarge: number;
  seamsUnresolved: number;
  /** Share of overlap cells where no overlapping photo is verified (0..1). */
  lowConfidenceOverlapShare: number;
  ghostRiskAreas: number;
  rmsAfter: number;
  confidence: number;
  verified: number;
  retakeCount: number;
  /** Photos whose quality could not be measured. */
  qualityUnavailable: number;
  /** Photos kept by the user although they failed the quality check. */
  qualityKeptFailed: number;
  detailRatio: number;
}

/**
 * The one place that decides GOOD / REVIEW / RETAKE. A small alignment error never earns GOOD:
 * every photo must be verified against a neighbour, quality must have been measured for every
 * photo, and no uncertain area may remain. Reasons are returned so the UI can show them.
 */
export function verdictFor(v: VerdictInput): { verdict: 'good' | 'review' | 'retake'; reasons: string[] } {
  const retake: string[] = [];
  const review: string[] = [];
  const linked = 1 - v.unconstrained / Math.max(1, v.frames);
  if (v.reverted) retake.push('alignment contradicted the motion sensors and was reverted');
  if (v.components > 1) retake.push(`${v.components} photo groups are not connected to each other`);
  if (linked < 0.8) retake.push(`${v.unconstrained} of ${v.frames} photos have no verified neighbour`);
  if (v.coverage < 0.97) retake.push(`only ${(v.coverage * 100).toFixed(1)}% photographed`);
  if (v.seamsDetected > 0 && v.seamsUnresolvedLarge > 0.15 * v.seamsDetected) retake.push('many disagreement areas could not be resolved');
  if (v.lowConfidenceOverlapShare > 0.35) retake.push(`${Math.round(v.lowConfidenceOverlapShare * 100)}% of the overlap has no verified photo`);
  if (v.frames > 0 && v.qualityUnavailable / v.frames > 0.25) retake.push('quality could not be measured for many photos');
  if (retake.length > 0) return { verdict: 'retake', reasons: retake };

  if (v.unconstrained > 0) review.push(`${v.unconstrained} photo(s) not verified against any neighbour`);
  if (v.qualityUnavailable > 0) review.push(`quality unmeasured for ${v.qualityUnavailable} photo(s)`);
  if (v.qualityKeptFailed > 0) review.push(`${v.qualityKeptFailed} photo(s) kept despite failing quality checks`);
  if (v.retakeCount > 0) review.push(`${v.retakeCount} photo(s) flagged for retake`);
  if (v.seamsUnresolved > 0) review.push(`${v.seamsUnresolved} unresolved disagreement area(s)`);
  if (v.ghostRiskAreas > 0) review.push('possible ghosting / parallax areas');
  if (v.filled > 0.001) review.push('synthetic fill present');
  if (v.lowConfidenceOverlapShare > 0.1) review.push(`${Math.round(v.lowConfidenceOverlapShare * 100)}% of the overlap is unverified`);
  if (v.rmsAfter > 2) review.push(`residual error ${v.rmsAfter.toFixed(1)} px`);
  if (v.confidence < 0.5) review.push('low alignment confidence');
  if (v.verified < 3 * Math.max(1, v.frames)) review.push('few verified matches');
  if (v.detailRatio < 0.85) review.push('output larger than the detail in the photos');
  if (review.length > 0) return { verdict: 'review', reasons: review };
  return { verdict: 'good', reasons: ['all photos verified, coverage complete, no unresolved areas'] };
}
