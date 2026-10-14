/** Human Performance OS · v0.2. Missing legacy conditions remain null/unknown and excluded. Ranges are validated at write/import boundaries. */
export type ID = string;
export type ISOTime = string;
export type LocalDate = string; // YYYY-MM-DD in recorded timeZone
export type Evidence = 'task-measured' | 'self-reported' | 'subjective' | 'self-checked' | 'observational' | 'rule-based';
export type System = 'sleep' | 'fitness' | 'cognition' | 'regulation' | 'nutrition';
export type CognitiveKind = 'reaction' | 'memory' | 'language';
export type Rating5 = 1 | 2 | 3 | 4 | 5;
export type Rating10 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export interface Entity {
  id: ID;
  createdAt: ISOTime;
  updatedAt: ISOTime;
  revision: number;
  deletedAt: ISOTime | null;
  source: 'personal' | 'demo';
}
export interface DayEntity extends Entity { localDate: LocalDate; timeZone: string }
export interface Consent {
  purpose: 'microphone-local' | 'cloud-sync' | 'cloud-transcription' | 'ai-analysis';
  grantedAt: ISOTime;
  revokedAt: ISOTime | null;
  policyVersion: string;
  dataCategories: string[];
  provider: string | null;
}
export interface Goals {
  priorities: Array<'processing' | 'memory' | 'expression' | 'sleep' | 'fitness' | 'calm'>; // <=2
  dailyTrainingMinutes: number; // 3..60, chosen by user
  sleepMinutes: number; // personal goal, not diagnosis
  targetWakeTime: string; // HH:mm
  weeklyModerateMinutes: number;
  weeklyStrengthDays: number; // 0..7
  cognitiveSessionsPerWeek: number; // 0..7
  trainingWeekdays: number[]; // 1=Mon..7=Sun
}
export interface UserSettings extends Entity {
  nickname: string | null;
  timeZone: string;
  locale: 'zh-CN';
  theme: 'light' | 'dark' | 'system';
  reducedMotion: boolean;
  onboardingCompletedAt: ISOTime | null;
  exerciseExperience: 'inactive' | 'occasional' | 'regular';
  goals: Goals;
  baselineResultIds: Partial<Record<CognitiveKind, ID[]>>;
  consents: Consent[];
}
export interface SubjectiveValue<T extends number> { value: T; evidence: 'subjective'; recordedAt: ISOTime }
export interface DailyState extends DayEntity {
  feeling: 'energetic' | 'ordinary' | 'tired' | null;
  energyMorning: SubjectiveValue<Rating5> | null;
  energyAfternoon: SubjectiveValue<Rating5> | null;
  energyEvening: SubjectiveValue<Rating5> | null;
  note: string | null;
}
export interface SleepRecord extends DayEntity {
  evidence: 'self-reported';
  kind: 'night' | 'nap';
  sleepAt: ISOTime;
  wakeAt: ISOTime; // >sleepAt; localDate is wake date
  awakeMinutes: number | null;
  quality: SubjectiveValue<Rating5> | null;
  wakeEnergy: SubjectiveValue<Rating5> | null;
  note: string | null;
}
export interface StrengthSet { exercise: string; sets: number; repetitions: number | null; loadKg: number | null }
export interface ExerciseRecord extends DayEntity {
  evidence: 'self-reported';
  kind: 'walk' | 'run' | 'cycle' | 'strength' | 'other';
  startedAt: ISOTime | null;
  minutes: number; // >0..1440, finite
  intensity: 'light' | 'moderate' | 'vigorous' | null;
  talkTest?: 'sing' | 'talk' | 'few' | 'unknown' | null;
  intensitySource?: 'talk-test-v1' | null;
  strength: StrengthSet[];
  fatigueAfter: SubjectiveValue<Rating5> | null;
  recoveryAfter: SubjectiveValue<Rating5> | null;
  note: string | null;
}
export type MealState = 'usual' | 'late' | 'missed' | 'not-applicable' | null;
export interface CaffeineEntry { id: ID; type: string; consumedAt: ISOTime; milligrams: number | null }
export interface NutritionRecord extends DayEntity {
  evidence: 'self-reported';
  breakfast: MealState;
  lunch: MealState;
  dinner: MealState;
  waterMl: number | null; // explicit ml; unknown !=0
  caffeine: CaffeineEntry[];
  energy: Array<{ period: 'morning' | 'afternoon' | 'evening'; rating: SubjectiveValue<Rating5> }>;
  note: string | null;
}
export interface RegulationRecord extends DayEntity {
  stress: SubjectiveValue<Rating10> | null;
  tension: SubjectiveValue<Rating10> | null;
  alertness: SubjectiveValue<Rating10> | null;
  practice: {
    kind: 'breathing' | 'mindfulness' | 'relaxation';
    startedAt: ISOTime;
    actualSeconds: number;
    targetSeconds: number;
    status: 'completed' | 'ended-early';
    stressBefore: Rating10 | null;
    stressAfter: Rating10 | null;
    inhaleSeconds: number | null;
    exhaleSeconds: number | null;
  } | null;
}
export interface TrainingTask extends Entity {
  kind: CognitiveKind;
  protocolVersion: string;
  contentVersion: string;
  difficulty: 'basic' | 'standard' | 'advanced';
  instructions: string;
  scoring: 'answer-key' | 'self-check' | 'self-rating' | 'text-rules' | 'idea-units';
  itemIds: ID[];
  timing: { readingSeconds?: number; responseDeadlineSeconds?: number; prepareSeconds?: number; expressionSeconds?: number };
}
export interface Trial {
  itemId: ID;
  response: 'supported' | 'unsupported' | 'insufficient' | null;
  correct: boolean;
  responseMs: number | null; // monotonic elapsed; timeout has null response
  timedOut: boolean;
}
export interface ResultBase extends DayEntity {
  taskId: ID;
  protocolVersion: string;
  contentVersion: string;
  difficulty: TrainingTask['difficulty'];
  purpose: 'baseline' | 'practice' | 'regular';
  startedAt: ISOTime | null;
  endedAt: ISOTime | null;
  actualSeconds: number | null;
  status: 'completed' | 'interrupted' | 'aborted';
  excludedFromComparison: boolean;
  exclusionReason: string | null;
  device: { input: 'touch' | 'keyboard' | 'mouse' | 'unknown'; platform: string };
  note: string | null;
}
export interface ReactionResult extends ResultBase {
  kind: 'reaction';
  evidence: 'task-measured';
  trials: Trial[];
  // Derived metrics never replace trials. IQR requires >=4 correct trials.
  summary: { correct: number; total: number; accuracy: number; medianCorrectMs: number | null; iqrCorrectMs: number | null };
}
export interface MemoryResult extends ResultBase {
  kind: 'memory';
  evidence: 'self-checked' | 'rule-based';
  scoringVersion?: 'idea-units-v1' | null;
  stage: 'immediate' | 'delayed';
  parentResultId: ID | null;
  recallText: string;
  checkedKeyIds: ID[];
  totalKeys: number;
  checkedBy: 'user' | 'system';
  repeatedMaterial: boolean;
  reviewedBeforeRecall: boolean;
  scheduledRecallAt: ISOTime | null;
  scheduledFromAt: ISOTime | null; // Retains the exact original scheduling time through migration.
  actualDelaySeconds: number | null;
}
export interface LanguageResult extends ResultBase {
  kind: 'language';
  evidence: 'subjective' | 'rule-based'; // fixed text checks do not measure semantic correctness or vocal fluency
  promptId: ID;
  topicText?: string | null;
  structure: 'conclusion-evidence-action';
  preparationSeconds: number | null;
  expressionSeconds: number;
  text: string | null;
  audioAssetId: ID | null;
  selfRating: { structure: Rating5 | null; logic: Rating5 | null; fluency: Rating5 | null } | null;
  autoScore?: { ruleVersion: 'text-rules-v1'; input: 'typed' | 'transcript'; structure: 0 | Rating5 | null; logic: 0 | Rating5 | null; fluency: 0 | Rating5 | null } | null;
  nextImprovement: string | null;
}
export type TrainingResult = ReactionResult | MemoryResult | LanguageResult;
export interface AudioAsset extends Entity {
  resultId: ID;
  blob: Blob; // IndexedDB only; exported separately, not JSON
  mimeType: string;
  durationSeconds: number;
  byteLength: number;
  consentGrantedAt: ISOTime;
  localOnly: true;
}
export interface FocusSession extends DayEntity {
  startedAt: ISOTime;
  endedAt: ISOTime;
  targetSeconds: number;
  actualSeconds: number;
  pausedSeconds: number;
  distractions: number;
  status: 'completed' | 'ended-early';
  note: string | null;
}
export interface UserPlan extends Entity {
  weekStart: LocalDate;
  timeZone: string;
  startsOn: LocalDate;
  endsOn: LocalDate | null;
  goalsSnapshot: Goals;
  confirmedAt: ISOTime;
  origin: 'onboarding' | 'user-edit' | 'weekly-review';
}
export interface PlanItem extends DayEntity {
  planId: ID;
  system: System;
  kind: string;
  title: string;
  estimatedMinutes: number;
  optional: boolean;
  status: 'pending' | 'completed' | 'skipped';
  sourceRecordId: ID | null;
  completedAt: ISOTime | null;
  skipReason: string | null;
}
export interface LifeEvent extends DayEntity {
  tags: Array<'overtime' | 'travel' | 'illness' | 'alcohol' | 'medication-change' | 'other'>;
  endedOn: LocalDate | null;
  description: string | null;
  annotateCharts: boolean;
}
export interface WeeklyReview extends Entity {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  timeZone: string;
  sourceRecordIds: ID[];
  summarySnapshot: Record<string, { value: number | null; unit: string; n: number; evidence: Evidence }>;
  workReflection: string;
  nextAdjustment: string;
  nextPlanId: ID | null;
  knownConfounderIds: ID[];
}
export interface ObservationCycle extends Entity {
  evidence: 'observational';
  change: string;
  startsOn: LocalDate;
  endsOn: LocalDate;
  comparisonWindow: { beforeStart: LocalDate; beforeEnd: LocalDate; afterStart: LocalDate; afterEnd: LocalDate };
  protocolVersions: string[];
  eventIds: ID[];
  reflection: string | null;
  decision: 'continue' | 'revert' | 'observe-more' | null;
}
export interface ExportBundle {
  schemaVersion: 1;
  format: 'human-performance-os-core';
  exportedAt: ISOTime;
  space: 'personal' | 'demo';
  settings: UserSettings;
  dailyStates: DailyState[];
  sleep: SleepRecord[];
  exercise: ExerciseRecord[];
  nutrition: NutritionRecord[];
  regulation: RegulationRecord[];
  tasks: TrainingTask[];
  results: TrainingResult[];
  focus: FocusSession[];
  plans: UserPlan[];
  planItems: PlanItem[];
  events: LifeEvent[];
  weeklyReviews: WeeklyReview[];
  observations: ObservationCycle[];
  audioMetadata: Omit<AudioAsset, 'blob'>[];
  audioIncluded: false;
}
