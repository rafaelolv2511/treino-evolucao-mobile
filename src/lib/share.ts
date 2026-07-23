interface WorkoutTitleInput {
  sessionName: string;
  focus?: string;
  muscleGroups?: string[];
}

function searchable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const TITLE_RULES: { title: string; terms: string[] }[] = [
  { title: "Full body day", terms: ["full body", "corpo inteiro"] },
  { title: "Upper body day", terms: ["upper body", "superiores", "membros superiores"] },
  { title: "Lower body day", terms: ["lower body", "inferiores", "membros inferiores"] },
  { title: "Back day", terms: ["costas", "dorsal", "dorso"] },
  { title: "Chest day", terms: ["peito", "peitoral"] },
  { title: "Leg day", terms: ["perna", "quadriceps", "gluteo", "posterior", "femoral", "panturrilha"] },
  { title: "Shoulder day", terms: ["ombro", "deltoide"] },
  { title: "Arm day", terms: ["braco", "biceps", "triceps", "antebraco"] },
  { title: "Core day", terms: ["core", "abdomen", "abdominal"] },
  { title: "Cardio day", terms: ["cardio", "corrida", "esteira", "bike", "bicicleta", "escada"] },
  { title: "Pull day", terms: ["pull"] },
  { title: "Push day", terms: ["push"] },
];

export function instagramWorkoutTitle({
  sessionName,
  focus = "",
  muscleGroups = [],
}: WorkoutTitleInput): string {
  const source = searchable([focus, ...muscleGroups, sessionName].filter(Boolean).join(" "));
  const match = TITLE_RULES.find((rule) => rule.terms.some((term) => source.includes(term)));
  return match?.title ?? "Workout day";
}
