const STORAGE_KEY = "studyquest_state_v1";

const DEFAULT_SUBJECTS = [
  "Java",
  "Python",
  "DSA",
  "HTML",
  "CSS",
  "JavaScript",
  "DBMS",
  "Operating System",
];

const ACHIEVEMENT_DEFS = [
  {
    id: "first_mission",
    name: "First Mission",
    icon: "target",
    desc: "Complete your very first mission.",
  },
  {
    id: "streak_3",
    name: "3 Day Streak",
    icon: "flame",
    desc: "Study 3 days in a row.",
  },
  {
    id: "streak_7",
    name: "7 Day Streak",
    icon: "flame",
    desc: "Study 7 days in a row.",
  },
  {
    id: "xp_hunter",
    name: "XP Hunter",
    icon: "zap",
    desc: "Earn 500 total XP.",
  },
  { id: "level_5", name: "Level 5", icon: "award", desc: "Reach level 5." },
  {
    id: "subject_master",
    name: "Subject Master",
    icon: "book-open",
    desc: "Finish every topic in a subject.",
  },
  {
    id: "mission_machine",
    name: "Mission Machine",
    icon: "checklist",
    desc: "Complete 20 missions.",
  },
  {
    id: "focus_master",
    name: "Focus Master",
    icon: "timer",
    desc: "Finish 10 focus sessions.",
  },
];

function iconSvg(name, cls = "") {
  return `<svg class="icon ${cls}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function createDefaultState() {
  return {
    user: { name: "Player", theme: "light" },
    xp: 0,
    level: 1,
    streak: { count: 0, lastActiveDate: null },
    missions: [],
    subjects: DEFAULT_SUBJECTS.map((name, i) => ({
      id: "subj_" + i,
      name,
      totalTopics: 10,
      completedTopics: 0,
    })),
    goals: [],
    achievements: ACHIEVEMENT_DEFS.map((a) => ({
      id: a.id,
      unlocked: false,
      unlockedAt: null,
    })),
    focusSessions: [], // { id, date (ISO), minutes, subject }
    stats: { missionsCompleted: 0, studyHours: 0 },
  };
}
