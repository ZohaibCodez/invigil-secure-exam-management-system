/** Frozen at publication and copied to each new attempt. Legacy exams stay reviewable. */
export type DeliverySettings = {
  requireProctorApproval: boolean;
  requireReadiness: boolean;
  confirmSubjects: boolean;
  lockOnSave: boolean;
  minimumAttemptPercent: number;
  venue: string;
  sessionLabel: string;
  /** Candidate must stay in fullscreen; exits and tab switches count as violations. */
  requireFullscreen: boolean;
  /** Violations before the attempt is locked for examiner review (1-10). */
  maxViolations: number;
};
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  requireProctorApproval: false,
  requireReadiness: false,
  confirmSubjects: false,
  lockOnSave: false,
  minimumAttemptPercent: 0,
  venue: "",
  sessionLabel: "",
  requireFullscreen: false,
  maxViolations: 3,
};
export type EntryAttestation = {
  entryVersion: string;
  instructionsRead: boolean;
  deviceReady: boolean;
  subjectsConfirmed: boolean;
  recordedAt: string;
  admissionId: string | null;
};
