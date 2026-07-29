/**
 * Shared domain types for Elvy Lesson Plan Studio.
 *
 * This file is intentionally UI-independent so it can be imported by:
 * - the Lesson Plan Studio page
 * - the Teaching Brain blueprint adapter
 * - lesson-plan persistence services
 * - future API routes and validators
 */

export type LessonStatus =
  | "Draft"
  | "Generated"
  | "Reviewed"
  | "Approved"
  | "Ready for Elvy";

export type LessonPlanStage = {
  stage: string;
  time: string;
  teacherActivities: string;
  studentActivities: string;
  interaction: string;
  resources: string;
  assessment: string;
};

export type IntegratedSkillRow = {
  skill: string;
  objective: string;
  textbookActivities: string;
  elvyStrategy: string;
};

export type ElvyBlueprintStageName =
  | "Warm-up"
  | "Presentation"
  | "Practice"
  | "Production"
  | "Assessment"
  | "Homework";

export type ElvyBlueprintStage = {
  stage: ElvyBlueprintStageName;
  duration: string;

  // What Elvy must achieve during this stage.
  teachingObjective: string;

  // What appears on the classroom whiteboard.
  whiteboardPlan: string;

  // What Elvy says and how the stage is introduced.
  elvyScript: string;

  // Ordered learner actions for this stage.
  learnerTaskSequence: string[];

  // Acceptable learner answers or performance examples.
  expectedResponses: string[];

  // How Elvy evaluates the learner response.
  evaluationCriteria: string;

  // Feedback Elvy gives after evaluation.
  feedbackStrategy: string;

  // Progressive help: prompt → hint → model → guided answer.
  supportLadder: string[];

  // Conditions required before moving to the next stage.
  successCriteria: string[];

  // Maximum supported attempts before adapting or moving on.
  retryLimit: number;

  // What Elvy does when the learner succeeds.
  successAction: string;

  // What Elvy does when the learner needs more help.
  recoveryAction: string;

  // How Elvy moves into the following stage.
  transition: string;

  // Backward-compatible field for previously stored lesson plans.
  instructions?: string;
};

export type LessonPlan = {
  status: LessonStatus;

  // 1. Lesson information
  level: string;
  sublevel: string;
  unit: string;
  lessonNumber: string;
  lessonTitle: string;
  textbook: string;
  pages: string;
  duration: string;
  theme: string;
  cefrLevel: string;
  schoolGrade: string;

  // 2. Curriculum intelligence
  unitObjectives: string;
  lessonObjectives: string;
  communicativeObjective: string;
  languageObjective: string;
  successCriteria: string;

  // 3. Learning foundation
  competencies: string;
  prerequisites: string;
  outcomes: string;

  // 4. Language content
  vocabulary: string;
  grammar: string;
  functions: string;
  pronunciation: string;
  usefulExpressions: string;
  sentencePatterns: string;

  // 5. Integrated skills
  integratedSkills: IntegratedSkillRow[];

  // 6. Pedagogical framework
  teachingApproach: string;
  pedagogicalFramework: string;
  udlStrategies: string;
  differentiation: string;
  assessmentForLearning: string;

  // 7. Teaching procedure
  stages: LessonPlanStage[];

  // 8. Assessment strategy
  diagnosticAssessment: string;
  formativeAssessment: string;
  summativeAssessment: string;
  selfAssessment: string;
  peerAssessment: string;

  // 9. Classroom management
  teacherTips: string;
  grouping: string;
  timeManagement: string;
  transitions: string;
  commonDifficulties: string;
  suggestedSolutions: string;

  // 10. Resources and extension
  resources: string;
  homework: string;
  fastFinishers: string;
  extraPractice: string;
  parentSuggestions: string;
  teacherNotes: string;

  // 11. Internal Elvy teaching blueprint
  elvyBlueprint: ElvyBlueprintStage[];

  // 12. Generation and approval metadata
  generatedBy: string;
  generationDate: string;
  sourceBook: string;
  confidenceScore: string;
  teacherApproved: string;
  readyForElvy: string;
};

export type CurriculumNavigatorLesson = {
  id: string;
  title: string;
};

export type CurriculumNavigatorUnit = {
  id: string;
  title: string;
  displayTitle: string;
  sublevelTitle: string;
  lessons: CurriculumNavigatorLesson[];
};

export type CurriculumTreeRecord = {
  syllabusId: string;
  title: string;
  levelId: string;
  levelTitle: string;
  sublevelIds: string[];
  units: number;
  lessons: number;
  generatedAt: string;
};
