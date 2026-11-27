/** Frozen at publication and copied to each new attempt. Legacy exams stay reviewable. */
export type DeliverySettings = {
  requireProctorApproval: boolean;
  requireReadiness: boolean;
  confirmSubjects: boolean;
  lockOnSave: boolean;
  minimumAttemptPercent: number;
  venue: string;
  sessionLabel: string;
};
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  requireProctorApproval: false,
  requireReadiness: false,
  confirmSubjects: false,
  lockOnSave: false,
  minimumAttemptPercent: 0,
  venue: "",
  sessionLabel: "",
};
export type EntryAttestation = {
  entryVersion: string;
  instructionsRead: boolean;
  deviceReady: boolean;
  subjectsConfirmed: boolean;
  recordedAt: string;
  admissionId: string | null;
};
