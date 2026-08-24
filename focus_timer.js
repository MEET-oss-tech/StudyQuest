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
