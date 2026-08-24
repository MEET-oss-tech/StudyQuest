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

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);

    return Object.assign(createDefaultState(), parsed);
  } catch (err) {
    console.error("Failed to load StudyQuest data, starting fresh.", err);
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const levelThresholdCache = [0]; // index 0 = level 1 threshold

function xpForLevel(level) {
  while (levelThresholdCache.length < level) {
    const k = levelThresholdCache.length + 1; // next level number
    const prev = levelThresholdCache[levelThresholdCache.length - 1];
    levelThresholdCache.push(prev + 50 * k);
  }
  return levelThresholdCache[level - 1];
}

function calculateLevel(totalXp) {
  let level = 1;
  while (totalXp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

function addXp(amount) {
  state.xp += amount;
  state.level = calculateLevel(state.xp);
}

const DIFFICULTY_XP = { Easy: 20, Medium: 40, Hard: 70 };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA + "T00:00:00");
  const b = new Date(dateB + "T00:00:00");
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function registerStudyActivity() {
  const today = todayISO();
  const last = state.streak.lastActiveDate;

  if (last === today) {
    return; // already logged today
  }
  if (last) {
    const gap = daysBetween(last, today);
    if (gap === 1) {
      state.streak.count += 1;
    } else if (gap > 1) {
      state.streak.count = 1; // missed a day, restart
    }
  } else {
    state.streak.count = 1;
  }
  state.streak.lastActiveDate = today;
}

function achievementDef(id) {
  return ACHIEVEMENT_DEFS.find((a) => a.id === id);
}

function checkAchievements() {
  const newlyUnlocked = [];

  const conditions = {
    first_mission: () => state.stats.missionsCompleted >= 1,
    streak_3: () => state.streak.count >= 3,
    streak_7: () => state.streak.count >= 7,
    xp_hunter: () => state.xp >= 500,
    level_5: () => state.level >= 5,
    subject_master: () =>
      state.subjects.some(
        (s) => s.totalTopics > 0 && s.completedTopics >= s.totalTopics,
      ),
    mission_machine: () => state.stats.missionsCompleted >= 20,
    focus_master: () => state.focusSessions.length >= 10,
  };

  state.achievements.forEach((a) => {
    if (a.unlocked) return;
    const test = conditions[a.id];
    if (test && test()) {
      a.unlocked = true;
      a.unlockedAt = new Date().toISOString();
      newlyUnlocked.push(a.id);
    }
  });

  newlyUnlocked.forEach((id) => {
    const def = achievementDef(id);
    showToast(`Achievement unlocked: ${def.name}`, "trophy");
  });

  return newlyUnlocked;
}

function uid(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

let toastTimer = null;
function showToast(message, iconName = "check") {
  const toast = document.getElementById("toast");
  toast.innerHTML = `${iconSvg(iconName, "icon-sm")}<span>${escapeHTML(message)}</span>`;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
