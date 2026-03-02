const DAYS_PER_WEEK = 5;
const DISPLAY_WEEKS = 2;
const TOTAL_DAYS = DAYS_PER_WEEK * DISPLAY_WEEKS;
const ROOM_CAPACITY = 11;
const STORAGE_KEY = "presence-data-v3";

const BASE_STATUSES = [
  { key: "empty", label: "", className: "empty" },
  { key: "on-site", label: "Sur site", className: "on-site" },
  { key: "remote", label: "Télétravail", className: "remote" },
  { key: "leave", label: "Congé", className: "leave" },
  { key: "rest", label: "Biot", className: "rest" },
];

const CUSTOM_COLORS = ["#f8c291", "#c8e6c9", "#ffe082", "#d1c4e9", "#b2dfdb", "#f5b7b1", "#aed6f1"];

const DEFAULT_MEMBERS = [
  { name: "Géraldine", avatar: "https://i.pravatar.cc/80?img=47", defaultPlanning: ["on-site", "remote", "remote", "on-site", "remote"] },
  { name: "Luc", avatar: "https://i.pravatar.cc/80?img=12", defaultPlanning: Array(DAYS_PER_WEEK).fill("empty") },
  { name: "Ben", avatar: "https://i.pravatar.cc/80?img=15", defaultPlanning: Array(DAYS_PER_WEEK).fill("empty") },
  { name: "Sébastien", avatar: "https://i.pravatar.cc/80?img=14", defaultPlanning: ["on-site", "on-site", "remote", "remote", "remote"] },
  { name: "Guillaume PB", avatar: "https://i.pravatar.cc/80?img=32", defaultPlanning: ["leave", "leave", "leave", "leave", "leave"] },
  { name: "Jean-Sébastien", avatar: "https://i.pravatar.cc/80?img=24", defaultPlanning: Array(DAYS_PER_WEEK).fill("empty") },
  { name: "Nabil", avatar: "https://i.pravatar.cc/80?img=52", defaultPlanning: ["remote", "rest", "rest", "on-site", "remote"] },
  { name: "Alice", avatar: "https://i.pravatar.cc/80?img=5", defaultPlanning: Array(DAYS_PER_WEEK).fill("empty") },
  { name: "Thomas", avatar: "https://i.pravatar.cc/80?img=18", defaultPlanning: Array(DAYS_PER_WEEK).fill("empty") },
  { name: "Delphine", avatar: "https://i.pravatar.cc/80?img=44", defaultPlanning: ["on-site", "remote", "remote", "empty", "on-site"] },
  { name: "Sonia", avatar: "https://i.pravatar.cc/80?img=25", defaultPlanning: ["leave", "leave", "leave", "remote", "remote"] },
  { name: "Guillaume H", avatar: "https://i.pravatar.cc/80?img=7", defaultPlanning: ["remote", "remote", "remote", "remote", "remote"] },
  { name: "David", avatar: "https://i.pravatar.cc/80?img=60", defaultPlanning: ["on-site", "remote", "remote", "leave", "leave"] },
];

const planningByWeek = new Map();
const customStatuses = [];
let members = DEFAULT_MEMBERS.map((member) => ({ ...member, defaultPlanning: [...member.defaultPlanning] }));

const thead = document.querySelector("#presence-table thead");
const tbody = document.querySelector("#presence-table tbody");
const table = document.querySelector("#presence-table");
const tfoot = table.tFoot || table.createTFoot();
const weekRange = document.querySelector("#week-range");
const statusLegend = document.querySelector("#status-legend");
const customStatusForm = document.querySelector("#custom-status-form");
const customStatusInput = document.querySelector("#custom-status-name");
const memberForm = document.querySelector("#member-form");
const memberNameInput = document.querySelector("#member-name");
const memberAvatarInput = document.querySelector("#member-avatar");

function createEmptyDayArray() {
  return Array(DAYS_PER_WEEK).fill("empty");
}

function getAllStatuses() {
  return [...BASE_STATUSES, ...customStatuses];
}

function getStatusMap() {
  return new Map(getAllStatuses().map((status) => [status.key, status]));
}

function getStatusCycleKeys() {
  return getAllStatuses().map((status) => status.key);
}

function getNextStatusKey(currentKey) {
  const cycle = getStatusCycleKeys();
  const currentIndex = cycle.indexOf(currentKey);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  return cycle[(safeIndex + 1) % cycle.length];
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getNextCustomColor() {
  return CUSTOM_COLORS[customStatuses.length % CUSTOM_COLORS.length];
}

function isHalfDayEntry(entry) {
  return !!entry && typeof entry === "object" && entry.type === "half";
}

function normalizeDayEntry(entry, validStatusKeys) {
  if (typeof entry === "string") {
    return validStatusKeys.has(entry) ? entry : "empty";
  }

  if (isHalfDayEntry(entry)) {
    const morning = validStatusKeys.has(entry.am) ? entry.am : "empty";
    const afternoon = validStatusKeys.has(entry.pm) ? entry.pm : "empty";
    return { type: "half", am: morning, pm: afternoon };
  }

  return "empty";
}

function cloneDayEntry(entry) {
  if (isHalfDayEntry(entry)) {
    return { type: "half", am: entry.am, pm: entry.pm };
  }
  return entry;
}

function normalizeMember(member, fallbackIndex = 0) {
  if (!member || typeof member !== "object") {
    return null;
  }

  const name = typeof member.name === "string" ? member.name.trim() : "";
  if (!name) {
    return null;
  }

  const avatar = typeof member.avatar === "string" && member.avatar.trim()
    ? member.avatar.trim()
    : `https://i.pravatar.cc/80?u=${encodeURIComponent(`${name}-${fallbackIndex}`)}`;

  let defaultPlanning = Array.isArray(member.defaultPlanning) ? member.defaultPlanning.slice(0, DAYS_PER_WEEK) : createEmptyDayArray();
  while (defaultPlanning.length < DAYS_PER_WEEK) {
    defaultPlanning.push("empty");
  }

  return { name, avatar, defaultPlanning };
}

function normalizeWeekPlanning(weekPlanning, memberCount, validStatusKeys) {
  const normalizedWeek = [];

  for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
    const memberPlanning = Array.isArray(weekPlanning) ? weekPlanning[memberIndex] : null;

    if (!Array.isArray(memberPlanning)) {
      normalizedWeek.push(createEmptyDayArray());
      continue;
    }

    const trimmed = memberPlanning.slice(0, DAYS_PER_WEEK);
    while (trimmed.length < DAYS_PER_WEEK) {
      trimmed.push("empty");
    }

    normalizedWeek.push(trimmed.map((entry) => normalizeDayEntry(entry, validStatusKeys)));
  }

  return normalizedWeek;
}

function sortMembersAndPlanning() {
  const indexedMembers = members.map((member, originalIndex) => ({ member, originalIndex }));
  indexedMembers.sort((a, b) => a.member.name.localeCompare(b.member.name, "fr", { sensitivity: "base" }));

  const isSameOrder = indexedMembers.every((entry, sortedIndex) => entry.originalIndex === sortedIndex);
  if (isSameOrder) {
    return;
  }

  members = indexedMembers.map((entry) => entry.member);

  planningByWeek.forEach((weekPlanning, weekKey) => {
    const reorderedWeek = indexedMembers.map((entry) => {
      const row = weekPlanning[entry.originalIndex];
      return Array.isArray(row) ? row : createEmptyDayArray();
    });

    planningByWeek.set(weekKey, reorderedWeek);
  });
}

function loadPlanningFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return;
    }

    if (Array.isArray(parsed.members)) {
      const storedMembers = parsed.members
        .map((member, index) => normalizeMember(member, index))
        .filter((member) => !!member);

      if (storedMembers.length > 0) {
        members = storedMembers;
      }
    }

    if (Array.isArray(parsed.customStatuses)) {
      parsed.customStatuses.forEach((item) => {
        if (!item || typeof item !== "object") {
          return;
        }

        if (typeof item.key !== "string" || typeof item.label !== "string" || typeof item.color !== "string") {
          return;
        }

        if (BASE_STATUSES.some((base) => base.key === item.key) || customStatuses.some((status) => status.key === item.key)) {
          return;
        }

        customStatuses.push({ key: item.key, label: item.label, color: item.color });
      });
    }

    const weeks = parsed.weeks;
    if (!weeks || typeof weeks !== "object") {
      return;
    }

    const validStatusKeys = new Set(getStatusCycleKeys());

    Object.entries(weeks).forEach(([weekKey, weekPlanning]) => {
      const normalizedWeek = normalizeWeekPlanning(weekPlanning, members.length, validStatusKeys);
      planningByWeek.set(weekKey, normalizedWeek);
    });
  } catch (error) {
    console.warn("Impossible de charger les présences sauvegardées.", error);
  }
}

function savePlanningToStorage() {
  try {
    const payload = {
      members,
      customStatuses,
      weeks: Object.fromEntries(planningByWeek.entries()),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Impossible de sauvegarder les présences.", error);
  }
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShort(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatFull(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDisplayedWeekStart(baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);

  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setDate(date.getDate() + mondayOffset);

  if (dayOfWeek === 6 || dayOfWeek === 0) {
    date.setDate(date.getDate() + 7);
  }

  return date;
}

function buildWeekDates(monday) {
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const date = addDays(monday, index);
    return {
      date,
      short: formatShort(date),
      iso: toIsoDate(date),
    };
  });
}

function cloneDefaultWeekPlanning() {
  return members.map((member) => {
    const planning = Array.isArray(member.defaultPlanning) ? [...member.defaultPlanning] : createEmptyDayArray();
    while (planning.length < DAYS_PER_WEEK) {
      planning.push("empty");
    }
    return planning.slice(0, DAYS_PER_WEEK);
  });
}

function getPlanningForWeek(weekKey) {
  if (!planningByWeek.has(weekKey)) {
    planningByWeek.set(weekKey, cloneDefaultWeekPlanning());
    savePlanningToStorage();
  }
  return planningByWeek.get(weekKey);
}

function renderLegend() {
  statusLegend.replaceChildren();
  const statuses = getAllStatuses();

  statuses.forEach((status) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = status.label || "Vide";

    if (status.className) {
      chip.classList.add(status.className);
    }

    if (status.color) {
      chip.style.backgroundColor = status.color;
      chip.style.borderColor = "#b5b5b5";
    }

    statusLegend.append(chip);
  });
}

function applyStatusVisual(element, statusKey) {
  const statusMap = getStatusMap();
  const status = statusMap.get(statusKey) || statusMap.get("empty");

  element.classList.remove("on-site", "remote", "leave", "rest", "empty");
  element.style.backgroundColor = "";

  if (status.className) {
    element.classList.add(status.className);
  }

  if (status.color) {
    element.style.backgroundColor = status.color;
  }

  return status;
}

loadPlanningFromStorage();
sortMembersAndPlanning();

const displayedWeekStart = getDisplayedWeekStart();
const displayedWeekStarts = Array.from({ length: DISPLAY_WEEKS }, (_, index) => addDays(displayedWeekStart, index * 7));
const displayedWeekDates = displayedWeekStarts.flatMap((weekStart) => buildWeekDates(weekStart));
const displayedWeekPlannings = displayedWeekStarts.map((weekStart) => getPlanningForWeek(toIsoDate(weekStart)));

function renderWeekRange() {
  if (!weekRange) {
    return;
  }

  const fromDate = formatFull(displayedWeekDates[0].date);
  const toDate = formatFull(displayedWeekDates[displayedWeekDates.length - 1].date);
  weekRange.textContent = `Semaines affichées : du ${fromDate} au ${toDate}`;
}

function renderHeader() {
  const row = document.createElement("tr");

  const corner = document.createElement("th");
  corner.className = "corner";
  row.append(corner);

  displayedWeekDates.forEach((date, columnIndex) => {
    const th = document.createElement("th");
    th.className = "date";
    if (columnIndex > 0 && columnIndex % DAYS_PER_WEEK === 0) {
      th.classList.add("week-separator");
    }
    const onSiteCount = getOnSiteCountForColumn(columnIndex);
    if (onSiteCount > ROOM_CAPACITY) {
      th.classList.add("capacity-exceeded");
      th.title = `Capacité dépassée: ${formatOnSiteCount(onSiteCount)} / ${ROOM_CAPACITY}`;
    }
    th.textContent = date.short;
    row.append(th);
  });

  if (DISPLAY_WEEKS >= 2) {
    const actionHead = document.createElement("th");
    actionHead.className = "action-head";
    actionHead.textContent = "Action";
    row.append(actionHead);
  }

  thead.replaceChildren(row);
}

function getWeekAndDayIndex(columnIndex) {
  return {
    weekIndex: Math.floor(columnIndex / DAYS_PER_WEEK),
    dayIndex: columnIndex % DAYS_PER_WEEK,
  };
}

function toggleHalfDay(weekPlanning, memberIndex, dayIndex) {
  const current = weekPlanning[memberIndex][dayIndex];

  if (isHalfDayEntry(current)) {
    weekPlanning[memberIndex][dayIndex] = current.am;
  } else {
    weekPlanning[memberIndex][dayIndex] = { type: "half", am: current, pm: current };
  }

  savePlanningToStorage();
  renderBody();
}

function createHalfButton(memberIndex, columnIndex, halfKey, statusKey) {
  const { weekIndex, dayIndex } = getWeekAndDayIndex(columnIndex);
  const weekPlanning = displayedWeekPlannings[weekIndex];

  const button = document.createElement("button");
  button.type = "button";
  button.className = `half-status ${halfKey}`;

  const status = applyStatusVisual(button, statusKey);
  button.textContent = status.label || "Vide";

  const halfLabel = halfKey === "am" ? "Matin" : "Après-midi";
  button.setAttribute("aria-label", `${members[memberIndex].name} ${displayedWeekDates[columnIndex].short} ${halfLabel}: ${status.label || "vide"}`);

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    const entry = weekPlanning[memberIndex][dayIndex];
    if (!isHalfDayEntry(entry)) {
      return;
    }

    entry[halfKey] = getNextStatusKey(entry[halfKey]);
    savePlanningToStorage();
    renderBody();
  });

  return button;
}

function getOnSiteCountForColumn(columnIndex) {
  const { weekIndex, dayIndex } = getWeekAndDayIndex(columnIndex);
  const weekPlanning = displayedWeekPlannings[weekIndex];

  let count = 0;
  for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
    const entry = weekPlanning[memberIndex][dayIndex];
    if (entry === "on-site") {
      count += 1;
      continue;
    }

    if (isHalfDayEntry(entry)) {
      if (entry.am === "on-site") {
        count += 0.5;
      }
      if (entry.pm === "on-site") {
        count += 0.5;
      }
    }
  }

  return count;
}

function formatOnSiteCount(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function renderFooter() {
  const row = document.createElement("tr");

  const labelCell = document.createElement("th");
  labelCell.className = "footer-label";
  labelCell.textContent = `Total sur site (capacité ${ROOM_CAPACITY})`;
  row.append(labelCell);

  for (let columnIndex = 0; columnIndex < TOTAL_DAYS; columnIndex += 1) {
    const cell = document.createElement("td");
    cell.className = "footer-value";
    if (columnIndex > 0 && columnIndex % DAYS_PER_WEEK === 0) {
      cell.classList.add("week-separator");
    }

    const onSiteCount = getOnSiteCountForColumn(columnIndex);
    cell.textContent = formatOnSiteCount(onSiteCount);
    if (onSiteCount > ROOM_CAPACITY) {
      cell.classList.add("capacity-exceeded");
      cell.title = `Capacité dépassée: ${formatOnSiteCount(onSiteCount)} / ${ROOM_CAPACITY}`;
    }
    row.append(cell);
  }

  if (DISPLAY_WEEKS >= 2) {
    const actionCell = document.createElement("td");
    actionCell.className = "footer-action";
    row.append(actionCell);
  }

  tfoot.replaceChildren(row);
}

function createStatusCell(memberIndex, columnIndex) {
  const { weekIndex, dayIndex } = getWeekAndDayIndex(columnIndex);
  const weekPlanning = displayedWeekPlannings[weekIndex];
  const dayEntry = weekPlanning[memberIndex][dayIndex];

  const td = document.createElement("td");
  td.className = "status";
  if (columnIndex > 0 && columnIndex % DAYS_PER_WEEK === 0) {
    td.classList.add("week-separator");
  }

  let clickTimer = null;

  td.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    toggleHalfDay(weekPlanning, memberIndex, dayIndex);
  });

  if (isHalfDayEntry(dayEntry)) {
    td.classList.add("half-day");
    const halfWrapper = document.createElement("div");
    halfWrapper.className = "half-wrapper";
    halfWrapper.append(
      createHalfButton(memberIndex, columnIndex, "am", dayEntry.am),
      createHalfButton(memberIndex, columnIndex, "pm", dayEntry.pm)
    );
    td.append(halfWrapper);

    td.setAttribute("aria-label", `${members[memberIndex].name} ${displayedWeekDates[columnIndex].short}: demi-journées`);
    return td;
  }

  const status = applyStatusVisual(td, dayEntry);
  td.textContent = status.label;
  td.setAttribute("role", "button");
  td.setAttribute("tabindex", "0");
  td.setAttribute("aria-label", `${members[memberIndex].name} ${displayedWeekDates[columnIndex].short}: ${status.label || "vide"}`);

  const updateStatus = () => {
    weekPlanning[memberIndex][dayIndex] = getNextStatusKey(dayEntry);
    savePlanningToStorage();
    renderBody();
  };

  td.addEventListener("click", () => {
    if (clickTimer) {
      return;
    }

    clickTimer = setTimeout(() => {
      updateStatus();
      clickTimer = null;
    }, 180);
  });
  td.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      updateStatus();
    }
  });

  return td;
}

function removeMember(memberIndex) {
  if (memberIndex < 0 || memberIndex >= members.length) {
    return;
  }

  const memberName = members[memberIndex].name;
  if (!window.confirm(`Supprimer ${memberName} ?`)) {
    return;
  }

  members.splice(memberIndex, 1);
  planningByWeek.forEach((weekPlanning) => {
    if (Array.isArray(weekPlanning) && weekPlanning.length > memberIndex) {
      weekPlanning.splice(memberIndex, 1);
    }
  });

  savePlanningToStorage();
  renderBody();
}

function copyFirstWeekToSecondWeek(memberIndex) {
  if (DISPLAY_WEEKS < 2 || displayedWeekPlannings.length < 2) {
    return;
  }

  const week1 = displayedWeekPlannings[0];
  const week2 = displayedWeekPlannings[1];

  if (!week1?.[memberIndex] || !week2?.[memberIndex]) {
    return;
  }

  for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
    week2[memberIndex][dayIndex] = cloneDayEntry(week1[memberIndex][dayIndex]);
  }

  savePlanningToStorage();
  renderBody();
}

function renderBody() {
  renderHeader();

  const rows = members.map((member, memberIndex) => {
    const tr = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.className = "name";

    const nameWrap = document.createElement("span");
    nameWrap.className = "member-name";

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.src = member.avatar;
    avatar.alt = `Avatar ${member.name}`;
    avatar.loading = "lazy";

    const label = document.createElement("span");
    label.textContent = member.name;

    nameWrap.append(avatar, label);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-member-btn";
    removeButton.textContent = "Suppr.";
    removeButton.setAttribute("aria-label", `Supprimer ${member.name}`);
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeMember(memberIndex);
    });

    nameCell.append(nameWrap, removeButton);
    tr.append(nameCell);

    for (let columnIndex = 0; columnIndex < TOTAL_DAYS; columnIndex += 1) {
      tr.append(createStatusCell(memberIndex, columnIndex));
    }

    if (DISPLAY_WEEKS >= 2) {
      const actionCell = document.createElement("td");
      actionCell.className = "row-action";

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "copy-week-btn";
      copyButton.innerHTML = "<span aria-hidden=\"true\">⧉</span>";
      copyButton.title = "Copier la semaine 1 vers la semaine 2";
      copyButton.setAttribute("aria-label", `Copier la semaine 1 vers la semaine 2 pour ${member.name}`);
      copyButton.addEventListener("click", () => {
        copyFirstWeekToSecondWeek(memberIndex);
      });

      actionCell.append(copyButton);
      tr.append(actionCell);
    }

    return tr;
  });

  tbody.replaceChildren(...rows);
  renderFooter();
}

function addCustomStatus(label) {
  const normalizedLabel = label.trim();
  if (!normalizedLabel) {
    return;
  }

  const normalizedComparison = normalizedLabel.toLocaleLowerCase("fr");
  const exists = getAllStatuses().some((status) => status.label.toLocaleLowerCase("fr") === normalizedComparison);
  if (exists) {
    return;
  }

  let key = `custom-${slugify(normalizedLabel)}`;
  if (!key || key === "custom-") {
    key = `custom-${Date.now()}`;
  }

  while (getAllStatuses().some((status) => status.key === key)) {
    key = `${key}-x`;
  }

  customStatuses.push({ key, label: normalizedLabel, color: getNextCustomColor() });
  savePlanningToStorage();
  renderLegend();
  renderBody();
}

function addMember(name, avatarUrl) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return;
  }

  const avatar = avatarUrl.trim()
    ? avatarUrl.trim()
    : `https://i.pravatar.cc/80?u=${encodeURIComponent(`${normalizedName}-${Date.now()}`)}`;

  members.push({
    name: normalizedName,
    avatar,
    defaultPlanning: createEmptyDayArray(),
  });

  planningByWeek.forEach((weekPlanning) => {
    weekPlanning.push(createEmptyDayArray());
  });

  sortMembersAndPlanning();
  savePlanningToStorage();
  renderBody();
}

customStatusForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addCustomStatus(customStatusInput.value);
  customStatusInput.value = "";
  customStatusInput.focus();
});

memberForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addMember(memberNameInput.value, memberAvatarInput.value);
  memberNameInput.value = "";
  memberAvatarInput.value = "";
  memberNameInput.focus();
});

renderWeekRange();
renderHeader();
renderLegend();
renderBody();
