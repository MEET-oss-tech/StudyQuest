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

const sectionTitles = {
  home: "Home",
  dashboard: "Dashboard",
  missions: "Missions",
  subjects: "Subjects",
  progress: "Progress",
  achievements: "Achievements",
  focus: "Focus Mode",
  goals: "Goals",
  settings: "Settings",
};

function goToSection(name) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === name);
  });

  document.getElementById("topbarTitle").textContent =
    sectionTitles[name] || "StudyQuest";
  closeMobileSidebar();
  window.scrollTo({
    top: 0,
    behavior: "instant" in window.scrollTo ? "instant" : "auto",
  });

  if (name === "dashboard") renderDashboard();
  if (name === "missions") renderMissions();
  if (name === "subjects") renderSubjects();
  if (name === "progress") renderProgress();
  if (name === "achievements") renderAchievements();
  if (name === "goals") renderGoals();
  if (name === "focus") renderFocus();
  if (name === "settings") renderSettings();
}

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => goToSection(btn.dataset.section));
  });
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => goToSection(btn.dataset.goto));
  });
}

function openMobileSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarOverlay").classList.add("open");
}
function closeMobileSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}
function setupMobileNav() {
  document
    .getElementById("hamburgerBtn")
    .addEventListener("click", openMobileSidebar);
  document
    .getElementById("sidebarOverlay")
    .addEventListener("click", closeMobileSidebar);
}

function openModal(id) {
  document.getElementById("modalOverlay").classList.add("open");
  document.getElementById(id).classList.add("open");
}
function closeAllModals() {
  document.getElementById("modalOverlay").classList.remove("open");
  document
    .querySelectorAll(".modal")
    .forEach((m) => m.classList.remove("open"));
}
function setupModalCloseHandlers() {
  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeAllModals);
  });
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeAllModals();
  });
}

let confirmCallback = null;
function askConfirm(title, text, onYes) {
  document.getElementById("confirmModalTitle").textContent = title;
  document.getElementById("confirmModalText").textContent = text;
  confirmCallback = onYes;
  openModal("confirmModal");
}
function setupConfirmModal() {
  document
    .getElementById("confirmModalYesBtn")
    .addEventListener("click", () => {
      if (typeof confirmCallback === "function") confirmCallback();
      confirmCallback = null;
      closeAllModals();
    });
}

function fillSubjectSelect(selectEl, { includeAllOption = false } = {}) {
  selectEl.innerHTML = "";
  if (includeAllOption) {
    const opt = document.createElement("option");
    opt.value = "all";
    opt.textContent = "All subjects";
    selectEl.appendChild(opt);
  }
  state.subjects.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    selectEl.appendChild(opt);
  });
}

function refreshAllSubjectSelects() {
  fillSubjectSelect(document.getElementById("missionSubjectInput"));
  fillSubjectSelect(document.getElementById("goalSubjectInput"));
  fillSubjectSelect(document.getElementById("timerSubjectSelect"));
  fillSubjectSelect(document.getElementById("missionFilterSubject"), {
    includeAllOption: true,
  });
}

function addMission({ title, subject, difficulty, dueDate }) {
  state.missions.push({
    id: uid("mission"),
    title,
    subject,
    difficulty,
    xp: DIFFICULTY_XP[difficulty] || 20,
    dueDate,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  });
  saveState();
}

function updateMission(id, { title, subject, difficulty, dueDate }) {
  const m = state.missions.find((m) => m.id === id);
  if (!m) return;
  m.title = title;
  m.subject = subject;
  m.difficulty = difficulty;
  m.xp = DIFFICULTY_XP[difficulty] || 20;
  m.dueDate = dueDate;
  saveState();
}

function deleteMission(id) {
  state.missions = state.missions.filter((m) => m.id !== id);
  saveState();
  renderMissions();
  renderDashboard();
}

function toggleCompleteMission(id) {
  const mission = state.missions.find((m) => m.id === id);
  if (!mission) return;

  if (mission.completed) {

    mission.completed = false;
    mission.completedAt = null;
    state.xp = Math.max(0, state.xp - mission.xp);
    state.level = calculateLevel(state.xp);
    state.stats.missionsCompleted = Math.max(
      0,
      state.stats.missionsCompleted - 1,
    );
  } else {
    mission.completed = true;
    mission.completedAt = new Date().toISOString();
    addXp(mission.xp);
    state.stats.missionsCompleted += 1;
    registerStudyActivity();
    showToast(`+${mission.xp} XP — "${mission.title}" complete!`, "zap");
  }

  saveState();
  checkAchievements();
  saveState();
  renderMissions();
  renderDashboard();
  renderSidebarStats();
}

function getFilteredSortedMissions() {
  const search = document
    .getElementById("missionSearch")
    .value.trim()
    .toLowerCase();
  const subjectFilter = document.getElementById("missionFilterSubject").value;
  const statusFilter = document.getElementById("missionFilterStatus").value;
  const sortBy = document.getElementById("missionSort").value;

  let list = state.missions.filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(search);
    const matchesSubject =
      subjectFilter === "all" || m.subject === subjectFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && m.completed) ||
      (statusFilter === "active" && !m.completed);
    return matchesSearch && matchesSubject && matchesStatus;
  });

  const difficultyRank = { Easy: 0, Medium: 1, Hard: 2 };
  list = list.sort((a, b) => {
    if (sortBy === "xp") return b.xp - a.xp;
    if (sortBy === "difficulty")
      return difficultyRank[b.difficulty] - difficultyRank[a.difficulty];
    if (sortBy === "title") return a.title.localeCompare(b.title);
    return new Date(a.dueDate) - new Date(b.dueDate); // default: dueDate
  });

  return list;
}

function missionRowHTML(m) {
  const badgeClass =
    m.difficulty === "Easy"
      ? "badge-easy"
      : m.difficulty === "Hard"
        ? "badge-hard"
        : "badge-medium";
  return `
    <div class="item-row ${m.completed ? "completed" : ""}" data-id="${m.id}">
      <div class="item-main">
        <p class="item-title ${m.completed ? "strike" : ""}">${escapeHTML(m.title)}</p>
        <div class="item-sub">
          <span>${escapeHTML(m.subject)}</span>
          <span class="badge ${badgeClass}">${m.difficulty}</span>
          <span class="badge badge-xp">+${m.xp} XP</span>
          <span>Due ${formatDate(m.dueDate)}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-action complete-mission-btn" title="${m.completed ? "Mark active" : "Complete"}" data-id="${m.id}">${iconSvg(m.completed ? "undo" : "check", "icon-sm")}</button>
        <button class="icon-action edit-mission-btn" title="Edit" data-id="${m.id}">${iconSvg("edit", "icon-sm")}</button>
        <button class="icon-action delete-mission-btn" title="Delete" data-id="${m.id}">${iconSvg("trash", "icon-sm")}</button>
      </div>
    </div>`;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMissions() {
  const list = getFilteredSortedMissions();
  const container = document.getElementById("missionsList");
  const empty = document.getElementById("missionsEmpty");

  if (state.missions.length === 0) {
    container.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  if (list.length === 0) {
    container.innerHTML = `<p class="muted" style="padding:20px 0;">No missions match your filters.</p>`;
    return;
  }

  container.innerHTML = list.map(missionRowHTML).join("");

  container
    .querySelectorAll(".complete-mission-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        toggleCompleteMission(btn.dataset.id),
      ),
    );
  container.querySelectorAll(".delete-mission-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      askConfirm(
        "Delete mission?",
        "This mission will be removed permanently.",
        () => deleteMission(btn.dataset.id),
      );
    }),
  );
  container
    .querySelectorAll(".edit-mission-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () => openMissionModal(btn.dataset.id)),
    );
}

function openMissionModal(id) {
  refreshAllSubjectSelects();
  const form = document.getElementById("missionForm");
  form.reset();
  if (id) {
    const m = state.missions.find((m) => m.id === id);
    document.getElementById("missionModalTitle").textContent = "Edit Mission";
    document.getElementById("missionId").value = m.id;
    document.getElementById("missionTitleInput").value = m.title;
    document.getElementById("missionSubjectInput").value = m.subject;
    document.getElementById("missionDifficultyInput").value = m.difficulty;
    document.getElementById("missionDueInput").value = m.dueDate;
  } else {
    document.getElementById("missionModalTitle").textContent = "Add Mission";
    document.getElementById("missionId").value = "";
    document.getElementById("missionDueInput").value = todayISO();
  }
  openModal("missionModal");
}

function setupMissionForm() {
  document
    .getElementById("addMissionBtn")
    .addEventListener("click", () => openMissionModal(null));

  document.getElementById("missionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("missionId").value;
    const data = {
      title: document.getElementById("missionTitleInput").value.trim(),
      subject: document.getElementById("missionSubjectInput").value,
      difficulty: document.getElementById("missionDifficultyInput").value,
      dueDate: document.getElementById("missionDueInput").value,
    };
    if (!data.title) return;

    if (id) {
      updateMission(id, data);
      showToast("Mission updated.");
    } else {
      addMission(data);
      showToast("Mission added.");
    }
    closeAllModals();
    renderMissions();
    renderDashboard();
  });

  [
    "missionSearch",
    "missionFilterSubject",
    "missionFilterStatus",
    "missionSort",
  ].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderMissions);
    document.getElementById(id).addEventListener("change", renderMissions);
  });
}

function addSubject({ name, totalTopics, completedTopics }) {
  state.subjects.push({ id: uid("subj"), name, totalTopics, completedTopics });
  saveState();
}
function updateSubject(id, { name, totalTopics, completedTopics }) {
  const s = state.subjects.find((s) => s.id === id);
  if (!s) return;
  s.name = name;
  s.totalTopics = totalTopics;
  s.completedTopics = completedTopics;
  saveState();
}
function deleteSubject(id) {
  state.subjects = state.subjects.filter((s) => s.id !== id);
  saveState();
  renderSubjects();
  refreshAllSubjectSelects();
}

function subjectCardHTML(s) {
  const pct =
    s.totalTopics > 0
      ? clamp(Math.round((s.completedTopics / s.totalTopics) * 100), 0, 100)
      : 0;
  return `
    <div class="subject-card" data-id="${s.id}">
      <div class="subject-card-head">
        <h4>${escapeHTML(s.name)}</h4>
        <div class="subject-card-actions">
          <button class="icon-action edit-subject-btn" data-id="${s.id}" title="Edit">${iconSvg("edit", "icon-sm")}</button>
          <button class="icon-action delete-subject-btn" data-id="${s.id}" title="Delete">${iconSvg("trash", "icon-sm")}</button>
        </div>
      </div>
      <div class="progress-bar"><div class="progress-fill teal" style="width:${pct}%"></div></div>
      <p class="subject-topics">${s.completedTopics} / ${s.totalTopics} topics · ${pct}%</p>
    </div>`;
}

function renderSubjects() {
  const grid = document.getElementById("subjectsGrid");
  grid.innerHTML = state.subjects.map(subjectCardHTML).join("");

  grid
    .querySelectorAll(".edit-subject-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () => openSubjectModal(btn.dataset.id)),
    );
  grid.querySelectorAll(".delete-subject-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      askConfirm(
        "Delete subject?",
        "Missions and goals referencing it will keep their saved subject name.",
        () => deleteSubject(btn.dataset.id),
      );
    }),
  );
}

function openSubjectModal(id) {
  const form = document.getElementById("subjectForm");
  form.reset();
  if (id) {
    const s = state.subjects.find((s) => s.id === id);
    document.getElementById("subjectModalTitle").textContent = "Edit Subject";
    document.getElementById("subjectId").value = s.id;
    document.getElementById("subjectNameInput").value = s.name;
    document.getElementById("subjectTotalInput").value = s.totalTopics;
    document.getElementById("subjectCompletedInput").value = s.completedTopics;
  } else {
    document.getElementById("subjectModalTitle").textContent = "Add Subject";
    document.getElementById("subjectId").value = "";
  }
  openModal("subjectModal");
}

function setupSubjectForm() {
  document
    .getElementById("addSubjectBtn")
    .addEventListener("click", () => openSubjectModal(null));

  document.getElementById("subjectForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("subjectId").value;
    const total = Math.max(
      1,
      parseInt(document.getElementById("subjectTotalInput").value, 10) || 1,
    );
    const completed = clamp(
      parseInt(document.getElementById("subjectCompletedInput").value, 10) || 0,
      0,
      total,
    );
    const data = {
      name: document.getElementById("subjectNameInput").value.trim(),
      totalTopics: total,
      completedTopics: completed,
    };
    if (!data.name) return;

    if (id) updateSubject(id, data);
    else addSubject(data);

    closeAllModals();
    renderSubjects();
    refreshAllSubjectSelects();
    renderDashboard();
    checkAchievements();
    saveState();
    showToast("Subject saved.");
  });
}

function addGoal({ title, subject, target, current, deadline }) {
  state.goals.push({
    id: uid("goal"),
    title,
    subject,
    target,
    current,
    deadline,
  });
  saveState();
}
function updateGoal(id, { title, subject, target, current, deadline }) {
  const g = state.goals.find((g) => g.id === id);
  if (!g) return;
  Object.assign(g, { title, subject, target, current, deadline });
  saveState();
}
function deleteGoal(id) {
  state.goals = state.goals.filter((g) => g.id !== id);
  saveState();
  renderGoals();
}

function goalCardHTML(g) {
  const pct =
    g.target > 0 ? clamp(Math.round((g.current / g.target) * 100), 0, 100) : 0;
  const done = g.current >= g.target;
  const remaining = Math.max(0, g.target - g.current);
  return `
    <div class="goal-card" data-id="${g.id}">
      <div class="goal-card-head">
        <h4>${escapeHTML(g.title)}</h4>
        <div class="subject-card-actions">
          <button class="icon-action edit-goal-btn" data-id="${g.id}" title="Edit">${iconSvg("edit", "icon-sm")}</button>
          <button class="icon-action delete-goal-btn" data-id="${g.id}" title="Delete">${iconSvg("trash", "icon-sm")}</button>
        </div>
      </div>
      <p class="goal-card-meta">${escapeHTML(g.subject)} · Deadline ${formatDate(g.deadline)} ${done ? "· <strong style='color:var(--teal)'>Completed</strong>" : ""}</p>
      <div class="progress-bar"><div class="progress-fill ${done ? "teal" : ""}" style="width:${pct}%"></div></div>
      <div class="goal-progress-num">
        <span>${g.current} / ${g.target}</span>
        <span>${pct}% · ${remaining} left</span>
      </div>
      <div class="inline-form" style="margin-top:10px;">
        <button class="btn btn-ghost bump-goal-btn" data-id="${g.id}" data-delta="1" style="flex:1;">+1 Progress</button>
      </div>
    </div>`;
}

function renderGoals() {
  const grid = document.getElementById("goalsGrid");
  const empty = document.getElementById("goalsEmpty");

  if (state.goals.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = state.goals.map(goalCardHTML).join("");

  grid
    .querySelectorAll(".edit-goal-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () => openGoalModal(btn.dataset.id)),
    );
  grid
    .querySelectorAll(".delete-goal-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        askConfirm(
          "Delete goal?",
          "This goal will be removed permanently.",
          () => deleteGoal(btn.dataset.id),
        ),
      ),
    );
  grid.querySelectorAll(".bump-goal-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const g = state.goals.find((g) => g.id === btn.dataset.id);
      if (!g) return;
      g.current = clamp(g.current + 1, 0, g.target);
      saveState();
      renderGoals();
    }),
  );
}

function openGoalModal(id) {
  refreshAllSubjectSelects();
  const form = document.getElementById("goalForm");
  form.reset();
  if (id) {
    const g = state.goals.find((g) => g.id === id);
    document.getElementById("goalModalTitle").textContent = "Edit Goal";
    document.getElementById("goalId").value = g.id;
    document.getElementById("goalTitleInput").value = g.title;
    document.getElementById("goalSubjectInput").value = g.subject;
    document.getElementById("goalTargetInput").value = g.target;
    document.getElementById("goalCurrentInput").value = g.current;
    document.getElementById("goalDeadlineInput").value = g.deadline;
  } else {
    document.getElementById("goalModalTitle").textContent = "Add Goal";
    document.getElementById("goalId").value = "";
  }
  openModal("goalModal");
}

function setupGoalForm() {
  document
    .getElementById("addGoalBtn")
    .addEventListener("click", () => openGoalModal(null));

  document.getElementById("goalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("goalId").value;
    const target = Math.max(
      1,
      parseInt(document.getElementById("goalTargetInput").value, 10) || 1,
    );
    const current = clamp(
      parseInt(document.getElementById("goalCurrentInput").value, 10) || 0,
      0,
      target,
    );
    const data = {
      title: document.getElementById("goalTitleInput").value.trim(),
      subject: document.getElementById("goalSubjectInput").value,
      target,
      current,
      deadline: document.getElementById("goalDeadlineInput").value,
    };
    if (!data.title) return;

    if (id) updateGoal(id, data);
    else addGoal(data);

    closeAllModals();
    renderGoals();
    showToast("Goal saved.");
  });
}

function renderAchievements() {
  const grid = document.getElementById("achievementsGrid");
  grid.innerHTML = ACHIEVEMENT_DEFS.map((def) => {
    const rec = state.achievements.find((a) => a.id === def.id);
    const unlocked = rec && rec.unlocked;
    return `
      <div class="ach-card ${unlocked ? "unlocked" : ""}">
        <span class="ach-ico">${iconSvg(def.icon, "icon-lg")}</span>
        <div>
          <p class="ach-name">${def.name}</p>
          <p class="ach-desc">${def.desc}</p>
          <span class="ach-status ${unlocked ? "unlocked-tag" : "locked"}">${unlocked ? "UNLOCKED" : "LOCKED"}</span>
        </div>
      </div>`;
  }).join("");

  const unlockedCount = state.achievements.filter((a) => a.unlocked).length;
  document.getElementById("achUnlockedCount").textContent = unlockedCount;
  document.getElementById("achTotalCount").textContent =
    ACHIEVEMENT_DEFS.length;
}

let timerState = {
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  intervalId: null,
  running: false,
  minutes: 25,
};

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  document.getElementById("timerDisplay").textContent = formatTimer(
    timerState.remainingSeconds,
  );
}

function setupFocusTimer() {
  document.querySelectorAll("#timerOptions .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (timerState.running) return; // don't allow changing length mid-run
      document
        .querySelectorAll("#timerOptions .chip")
        .forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const mins = parseInt(chip.dataset.mins, 10);
      timerState.minutes = mins;
      timerState.totalSeconds = mins * 60;
      timerState.remainingSeconds = mins * 60;
      updateTimerDisplay();
    });
  });

  document
    .getElementById("timerSubjectSelect")
    .addEventListener("change", (e) => {
      document.getElementById("timerSubjectLabel").textContent =
        e.target.value || "General";
    });

  document
    .getElementById("timerStartBtn")
    .addEventListener("click", startTimer);
  document
    .getElementById("timerPauseBtn")
    .addEventListener("click", pauseTimer);
  document
    .getElementById("timerResetBtn")
    .addEventListener("click", resetTimer);
}

function startTimer() {
  if (timerState.running) return;
  timerState.running = true;
  document.getElementById("timerStartBtn").disabled = true;
  document.getElementById("timerPauseBtn").disabled = false;

  timerState.intervalId = setInterval(() => {
    timerState.remainingSeconds--;
    updateTimerDisplay();
    if (timerState.remainingSeconds <= 0) {
      clearInterval(timerState.intervalId);
      timerState.running = false;
      completeFocusSession();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerState.intervalId);
  timerState.running = false;
  document.getElementById("timerStartBtn").disabled = false;
  document.getElementById("timerStartBtn").textContent = "Resume";
  document.getElementById("timerPauseBtn").disabled = true;
}

function resetTimer() {
  clearInterval(timerState.intervalId);
  timerState.running = false;
  timerState.remainingSeconds = timerState.minutes * 60;
  updateTimerDisplay();
  document.getElementById("timerStartBtn").disabled = false;
  document.getElementById("timerStartBtn").textContent = "Start";
  document.getElementById("timerPauseBtn").disabled = true;
}

function completeFocusSession() {
  const subject =
    document.getElementById("timerSubjectSelect").value || "General";
  const minutes = timerState.minutes;
  const xpEarned = Math.round(minutes * 1.2); // roughly proportional XP reward

  state.focusSessions.push({
    id: uid("focus"),
    date: new Date().toISOString(),
    minutes,
    subject,
  });
  state.stats.studyHours =
    Math.round((state.stats.studyHours + minutes / 60) * 100) / 100;
  addXp(xpEarned);
  registerStudyActivity();
  saveState();
  checkAchievements();
  saveState();

  showToast(`Focus session complete! +${xpEarned} XP`, "zap");

  document.getElementById("timerStartBtn").disabled = false;
  document.getElementById("timerStartBtn").textContent = "Start";
  document.getElementById("timerPauseBtn").disabled = true;
  timerState.remainingSeconds = timerState.minutes * 60;
  updateTimerDisplay();

  renderFocus();
  renderDashboard();
  renderSidebarStats();
}

function renderFocus() {
  refreshAllSubjectSelects();
  updateTimerDisplay();

  const today = todayISO();
  const todaysSessions = state.focusSessions.filter(
    (s) => s.date.slice(0, 10) === today,
  );
  document.getElementById("focusTodaySessions").textContent =
    todaysSessions.length;

  const totalMinutes = state.focusSessions.reduce(
    (sum, s) => sum + s.minutes,
    0,
  );
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  document.getElementById("focusTotalTime").textContent = `${h}h ${m}m`;

  const historyList = document.getElementById("focusHistoryList");
  const recent = [...state.focusSessions].reverse().slice(0, 8);
  if (recent.length === 0) {
    historyList.innerHTML = `<p class="muted">No focus sessions yet — run one to see it here.</p>`;
  } else {
    historyList.innerHTML = recent
      .map(
        (s) => `
      <div class="item-row">
        <div class="item-main">
          <p class="item-title">${escapeHTML(s.subject)}</p>
          <div class="item-sub"><span>${new Date(s.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
        </div>
        <span class="badge badge-xp">${s.minutes} min</span>
      </div>`,
      )
      .join("");
  }
}

function xpEarnedOnDate(dateISO) {

  let total = 0;
  state.missions.forEach((m) => {
    if (m.completed && m.completedAt && m.completedAt.slice(0, 10) === dateISO)
      total += m.xp;
  });
  state.focusSessions.forEach((s) => {
    if (s.date.slice(0, 10) === dateISO) total += Math.round(s.minutes * 1.2);
  });
  return total;
}

function renderProgress() {
  const totalTopics = state.subjects.reduce((sum, s) => sum + s.totalTopics, 0);
  const completedTopics = state.subjects.reduce(
    (sum, s) => sum + s.completedTopics,
    0,
  );
  const overallPct =
    totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  document.getElementById("progOverall").textContent = overallPct + "%";
  document.getElementById("progTotalXp").textContent = state.xp;
  document.getElementById("progHours").textContent =
    state.stats.studyHours.toFixed(1);
  document.getElementById("progMissions").textContent =
    state.stats.missionsCompleted;

  const now = new Date();
  let weeklyXp = 0,
    monthlyXp = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayXp = xpEarnedOnDate(iso);
    if (i < 7) weeklyXp += dayXp;
    monthlyXp += dayXp;
  }
  document.getElementById("progWeeklyXp").textContent = weeklyXp;
  document.getElementById("progMonthlyXp").textContent = monthlyXp;

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
      xp: xpEarnedOnDate(iso),
    });
  }
  const maxXp = Math.max(...days.map((d) => d.xp), 1);
  document.getElementById("weeklyBarChart").innerHTML = days
    .map(
      (d) => `
    <div class="bar-col">
      <span class="bar-col-val">${d.xp}</span>
      <div class="bar-col-fill" style="height:${(d.xp / maxXp) * 100}%"></div>
      <span class="bar-col-label">${d.label}</span>
    </div>`,
    )
    .join("");

  document.getElementById("progSubjectBars").innerHTML = state.subjects
    .map((s) => {
      const pct =
        s.totalTopics > 0
          ? clamp(Math.round((s.completedTopics / s.totalTopics) * 100), 0, 100)
          : 0;
      return `
      <div class="subject-line">
        <div class="subject-line-top"><strong>${escapeHTML(s.name)}</strong><span>${pct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join("");
}

function renderDashboard() {
  document.getElementById("greetingText").textContent =
    `Welcome back, ${state.user.name}`;

  document.getElementById("statLevel").textContent = state.level;
  document.getElementById("statXp").textContent = state.xp;
  document.getElementById("statStreak").textContent = state.streak.count;
  document.getElementById("statHours").textContent =
    state.stats.studyHours.toFixed(1);
  document.getElementById("statMissionsDone").textContent =
    state.stats.missionsCompleted;
  document.getElementById("statMissionsTotal").textContent =
    state.missions.length;

  const currentFloor = xpForLevel(state.level);
  const nextCeiling = xpForLevel(state.level + 1);
  const span = nextCeiling - currentFloor;
  const progressed = state.xp - currentFloor;
  const pct =
    span > 0 ? clamp(Math.round((progressed / span) * 100), 0, 100) : 100;

  document.getElementById("statXpToNext").textContent =
    `${nextCeiling - state.xp} XP to next level`;
  document.getElementById("xpCardLevel").textContent = `Level ${state.level}`;
  document.getElementById("xpCardCurrent").textContent = state.xp;
  document.getElementById("xpCardNeeded").textContent = nextCeiling;
  document.getElementById("dashXpBar").style.width = pct + "%";

  const today = todayISO();
  const todays = state.missions
    .filter((m) => m.dueDate === today || !m.completed)
    .slice(0, 5);
  const todayList = document.getElementById("todayMissionsList");
  if (todays.length === 0) {
    todayList.innerHTML = `<p class="muted">No missions due — add one to get moving.</p>`;
  } else {
    todayList.innerHTML = todays.map(missionRowHTML).join("");
    todayList
      .querySelectorAll(".complete-mission-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          toggleCompleteMission(btn.dataset.id),
        ),
      );
    todayList
      .querySelectorAll(".delete-mission-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          askConfirm(
            "Delete mission?",
            "This mission will be removed permanently.",
            () => deleteMission(btn.dataset.id),
          ),
        ),
      );
    todayList
      .querySelectorAll(".edit-mission-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () => openMissionModal(btn.dataset.id)),
      );
  }

  const subjList = document.getElementById("dashSubjectsList");
  subjList.innerHTML = state.subjects
    .slice(0, 6)
    .map((s) => {
      const pct =
        s.totalTopics > 0
          ? clamp(Math.round((s.completedTopics / s.totalTopics) * 100), 0, 100)
          : 0;
      return `
      <div class="subject-line">
        <div class="subject-line-top"><strong>${escapeHTML(s.name)}</strong><span>${pct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join("");
}

function renderSidebarStats() {
  document.getElementById("sidebarLevelNum").textContent = state.level;
  document.getElementById("sidebarUserName").textContent = state.user.name;
  document.getElementById("sidebarStreakNum").textContent = state.streak.count;
}

function renderSettings() {
  document.getElementById("settingsNameInput").value = state.user.name;
  document
    .getElementById("lightModeBtn")
    .classList.toggle("active", state.user.theme === "light");
  document
    .getElementById("darkModeBtn")
    .classList.toggle("active", state.user.theme === "dark");
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const nextIcon = theme === "dark" ? "sun" : "moon";
  document.getElementById("themeToggle").innerHTML = iconSvg(nextIcon);
  document.getElementById("mobileThemeToggle").innerHTML = iconSvg(nextIcon);
}

function setupSettings() {
  document.getElementById("saveNameBtn").addEventListener("click", () => {
    const name = document.getElementById("settingsNameInput").value.trim();
    if (!name) return;
    state.user.name = name;
    saveState();
    renderDashboard();
    renderSidebarStats();
    showToast("Name updated.");
  });

  document
    .getElementById("lightModeBtn")
    .addEventListener("click", () => setTheme("light"));
  document
    .getElementById("darkModeBtn")
    .addEventListener("click", () => setTheme("dark"));
  document
    .getElementById("themeToggle")
    .addEventListener("click", () =>
      setTheme(state.user.theme === "dark" ? "light" : "dark"),
    );
  document
    .getElementById("mobileThemeToggle")
    .addEventListener("click", () =>
      setTheme(state.user.theme === "dark" ? "light" : "dark"),
    );

  document.getElementById("resetProgressBtn").addEventListener("click", () => {
    askConfirm(
      "Reset progress?",
      "Your XP and level will be reset to zero. Missions, subjects and goals stay untouched.",
      () => {
        state.xp = 0;
        state.level = 1;
        saveState();
        renderAll();
        showToast("Progress reset.");
      },
    );
  });

  document.getElementById("clearMissionsBtn").addEventListener("click", () => {
    askConfirm(
      "Clear all missions?",
      "Every mission will be permanently removed.",
      () => {
        state.missions = [];
        saveState();
        renderAll();
        showToast("Missions cleared.");
      },
    );
  });

  document.getElementById("clearGoalsBtn").addEventListener("click", () => {
    askConfirm(
      "Clear all goals?",
      "Every goal will be permanently removed.",
      () => {
        state.goals = [];
        saveState();
        renderAll();
        showToast("Goals cleared.");
      },
    );
  });

  document.getElementById("resetAllBtn").addEventListener("click", () => {
    askConfirm(
      "Reset all data?",
      "This wipes everything — XP, missions, subjects, goals, achievements and settings. This cannot be undone.",
      () => {
        state = createDefaultState();
        saveState();
        applyTheme(state.user.theme);
        renderAll();
        goToSection("home");
        showToast("All data reset.");
      },
    );
  });
}

function setTheme(theme) {
  state.user.theme = theme;
  saveState();
  applyTheme(theme);
  renderSettings();
}

function renderAll() {
  refreshAllSubjectSelects();
  renderDashboard();
  renderMissions();
  renderSubjects();
  renderProgress();
  renderAchievements();
  renderGoals();
  renderFocus();
  renderSettings();
  renderSidebarStats();
}

function init() {
  applyTheme(state.user.theme);
  setupNavigation();
  setupMobileNav();
  setupModalCloseHandlers();
  setupConfirmModal();
  setupMissionForm();
  setupSubjectForm();
  setupGoalForm();
  setupFocusTimer();
  setupSettings();

  checkAchievements();
  saveState();
  renderAll();
  updateTimerDisplay();
}

document.addEventListener("DOMContentLoaded", init);
