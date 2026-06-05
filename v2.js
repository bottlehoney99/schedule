const PEOPLE = [
  {
    id: "person1",
    label: "A",
    title: "A 일정",
    eyebrow: "개인 학교 일정",
    copy: "담임, 부서, 교과 일정을 빠르게 정리합니다.",
  },
  {
    id: "person2",
    label: "B",
    title: "B 일정",
    eyebrow: "공유 학교 일정",
    copy: "상담, 업무, 연수 흐름을 달력에서 바로 조정합니다.",
  },
  {
    id: "person3",
    label: "C",
    title: "여가 일정",
    eyebrow: "여가 전용",
    copy: "여가 일정만 따로 모아 가볍게 관리합니다.",
  },
];

const PRIMARY_PERSON_ID = "person1";
const TASK_ROW_MARKER = "__WORK_TASK__";
const HEADER_ROW_MARKER = "__PAGE_HEADER__";
const TASK_ID_PREFIX = "task:";
const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};
const SUPABASE_URL = String(SUPABASE_CONFIG.url || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(SUPABASE_CONFIG.anonKey || "");
const SUPABASE_TABLE = String(SUPABASE_CONFIG.table || "schedules");
const SUPABASE_TASK_TABLE = String(SUPABASE_CONFIG.taskTable || "work_tasks");

const CATEGORY_PROFILES = {
  person1: {
    labels: {
      homeroom: "담임 일정",
      department: "부서 일정",
      subject: "교과교사 일정",
    },
    shortLabels: {
      homeroom: "담임",
      department: "부서",
      subject: "교과",
    },
    order: ["homeroom", "department", "subject"],
    defaultCategory: "homeroom",
  },
  person2: {
    labels: {
      homeroom: "여가 일정",
      subject: "상담 일정",
      department: "업무 일정",
      training: "연수 일정",
    },
    shortLabels: {
      homeroom: "여가",
      subject: "상담",
      department: "업무",
      training: "연수",
    },
    order: ["homeroom", "subject", "department", "training"],
    selectOrder: ["subject", "department", "training", "homeroom"],
    defaultCategory: "subject",
  },
  person3: {
    labels: {
      homeroom: "여가 일정",
    },
    shortLabels: {
      homeroom: "여가",
    },
    order: ["homeroom"],
    selectOrder: ["homeroom"],
    defaultCategory: "homeroom",
  },
};

const state = {
  personId: "person1",
  visibleDate: startOfMonth(new Date()),
  selectedDate: toDateInputValue(new Date()),
  filter: "all",
  mode: "schedule",
  schedules: [],
  tasks: [],
  selectedItem: null,
  taskStorage: "workTasks",
};

const elements = {
  profileButtons: document.querySelectorAll(".profile-button"),
  profileKicker: document.querySelector("#profileKicker"),
  profileTitle: document.querySelector("#profileTitle"),
  profileCopy: document.querySelector("#profileCopy"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  scheduleForm: document.querySelector("#scheduleForm"),
  taskForm: document.querySelector("#taskForm"),
  scheduleId: document.querySelector("#scheduleId"),
  scheduleCategory: document.querySelector("#scheduleCategory"),
  scheduleTitle: document.querySelector("#scheduleTitle"),
  scheduleDate: document.querySelector("#scheduleDate"),
  scheduleTime: document.querySelector("#scheduleTime"),
  schedulePlace: document.querySelector("#schedulePlace"),
  scheduleMemo: document.querySelector("#scheduleMemo"),
  scheduleSubmitText: document.querySelector("#scheduleSubmitText"),
  taskId: document.querySelector("#taskId"),
  taskCategory: document.querySelector("#taskCategory"),
  taskTitle: document.querySelector("#taskTitle"),
  taskStart: document.querySelector("#taskStart"),
  taskEnd: document.querySelector("#taskEnd"),
  taskMemo: document.querySelector("#taskMemo"),
  taskSubmitText: document.querySelector("#taskSubmitText"),
  syncStatus: document.querySelector("#syncStatus"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  todayButton: document.querySelector("#todayButton"),
  monthLabel: document.querySelector("#monthLabel"),
  categoryFilters: document.querySelector("#categoryFilters"),
  pulseStrip: document.querySelector("#pulseStrip"),
  calendarGrid: document.querySelector("#calendarGrid"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detailContent: document.querySelector("#detailContent"),
  detailType: document.querySelector("#detailType"),
  detailTitle: document.querySelector("#detailTitle"),
  detailMeta: document.querySelector("#detailMeta"),
  detailMemo: document.querySelector("#detailMemo"),
  editSelected: document.querySelector("#editSelected"),
  completeSelected: document.querySelector("#completeSelected"),
  deleteSelected: document.querySelector("#deleteSelected"),
  selectedDateLabel: document.querySelector("#selectedDateLabel"),
  selectedCount: document.querySelector("#selectedCount"),
  dayList: document.querySelector("#dayList"),
};

init();

async function init() {
  elements.scheduleDate.value = state.selectedDate;
  elements.taskStart.value = state.selectedDate;
  elements.taskEnd.value = state.selectedDate;
  bindEvents();
  await switchPerson("person1");
}

function bindEvents() {
  elements.profileButtons.forEach((button) => {
    button.addEventListener("click", () => switchPerson(button.dataset.person));
  });

  elements.modeTabs.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  elements.prevMonth.addEventListener("click", () => {
    state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() - 1, 1);
    state.selectedDate = toDateInputValue(state.visibleDate);
    render();
  });

  elements.nextMonth.addEventListener("click", () => {
    state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + 1, 1);
    state.selectedDate = toDateInputValue(state.visibleDate);
    render();
  });

  elements.todayButton.addEventListener("click", () => {
    state.visibleDate = startOfMonth(new Date());
    state.selectedDate = toDateInputValue(new Date());
    elements.scheduleDate.value = state.selectedDate;
    elements.taskStart.value = state.selectedDate;
    elements.taskEnd.value = state.selectedDate;
    state.selectedItem = null;
    render();
  });

  elements.scheduleForm.addEventListener("submit", saveSchedule);
  elements.taskForm.addEventListener("submit", saveTask);
  elements.editSelected.addEventListener("click", editSelectedItem);
  elements.completeSelected.addEventListener("click", completeSelectedItem);
  elements.deleteSelected.addEventListener("click", deleteSelectedItem);
}

async function switchPerson(personId) {
  state.personId = personId;
  state.filter = "all";
  state.selectedItem = null;
  document.body.dataset.person = personId;

  const profile = getPersonProfile();
  elements.profileKicker.textContent = profile.eyebrow;
  elements.profileTitle.textContent = profile.title;
  elements.profileCopy.textContent = profile.copy;

  elements.profileButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.person === personId);
  });

  populateCategorySelects();
  resetForms();
  renderFilters();
  await loadData();
  render();
}

function setMode(mode) {
  state.mode = mode;
  elements.modeTabs.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  elements.scheduleForm.classList.toggle("hidden", mode !== "schedule");
  elements.taskForm.classList.toggle("hidden", mode !== "task");
}

function populateCategorySelects() {
  const profile = getCategoryProfile();
  const scheduleOrder = profile.selectOrder || profile.order;
  fillSelect(elements.scheduleCategory, scheduleOrder, profile.labels);

  const taskLabels = Object.fromEntries(
    profile.order.map((category) => [category, `${profile.shortLabels[category]} 업무`]),
  );
  fillSelect(elements.taskCategory, profile.order, taskLabels);
}

function fillSelect(select, order, labels) {
  select.replaceChildren(
    ...order.map((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = labels[category];
      return option;
    }),
  );
}

function renderFilters() {
  const profile = getCategoryProfile();
  const buttons = [
    createFilterButton("all", "전체"),
    ...profile.order.map((category) => createFilterButton(category, profile.shortLabels[category])),
  ];
  elements.categoryFilters.replaceChildren(...buttons);
}

function createFilterButton(value, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.filter = value;
  button.classList.toggle("active", state.filter === value);
  button.addEventListener("click", () => {
    state.filter = value;
    state.selectedItem = null;
    renderFilters();
    render();
  });
  return button;
}

async function loadData() {
  elements.syncStatus.textContent = isSupabaseConfigured() ? "Supabase 동기화 중" : "임시 저장소 사용";

  const [schedules, tasks] = await Promise.all([loadSchedules(), loadTasks()]);
  state.schedules = schedules;
  state.tasks = tasks;
  elements.syncStatus.textContent = isSupabaseConfigured() ? "Supabase 연결됨" : "임시 저장소 사용";
}

async function loadSchedules() {
  if (!isSupabaseConfigured()) return readLocal("schedules").map(normalizeSchedule).sort(sortSchedules);

  try {
    const rows = await supabaseRequest(`${SUPABASE_TABLE}?select=*`);
    return rows
      .filter(isVisibleScheduleRow)
      .map(scheduleFromDatabase)
      .sort(sortSchedules);
  } catch (error) {
    console.error(error);
    elements.syncStatus.textContent = "DB 연결 실패, 임시 저장소 사용";
    return readLocal("schedules").map(normalizeSchedule).sort(sortSchedules);
  }
}

async function loadTasks() {
  if (!isSupabaseConfigured()) return readLocal("tasks").map(normalizeTask).sort(sortTasks);

  try {
    const rows = await supabaseRequest(`${SUPABASE_TASK_TABLE}?select=*`);
    state.taskStorage = "workTasks";
    return rows.filter(isVisibleOwnedId).map(taskFromDatabase).sort(sortTasks);
  } catch (error) {
    try {
      const rows = await supabaseRequest(`${SUPABASE_TABLE}?select=*`);
      state.taskStorage = "scheduleRows";
      return rows.filter(isVisibleTaskScheduleRow).map(taskFromScheduleRow).sort(sortTasks);
    } catch (fallbackError) {
      console.error(fallbackError);
      elements.syncStatus.textContent = "업무 DB 연결 실패, 임시 저장소 사용";
      return readLocal("tasks").map(normalizeTask).sort(sortTasks);
    }
  }
}

async function saveSchedule(event) {
  event.preventDefault();
  const draft = normalizeSchedule({
    id: elements.scheduleId.value || createId(),
    category: elements.scheduleCategory.value,
    title: elements.scheduleTitle.value,
    date: elements.scheduleDate.value,
    startTime: elements.scheduleTime.value,
    place: elements.schedulePlace.value,
    memo: elements.scheduleMemo.value,
    completed: false,
    createdAt: new Date().toISOString(),
  });

  if (!draft.title || !draft.date) return;

  const previous = state.schedules.find((item) => item.id === draft.id);
  if (previous) {
    draft.completed = previous.completed;
    draft.createdAt = previous.createdAt;
  }

  const saved = await persistSchedule(draft);
  upsertIntoState(state.schedules, saved);
  state.selectedDate = saved.date;
  state.visibleDate = startOfMonth(parseDate(saved.date));
  state.selectedItem = { type: "schedule", id: saved.id };
  resetScheduleForm();
  render();
}

async function saveTask(event) {
  event.preventDefault();
  const draft = normalizeTask({
    id: elements.taskId.value || createId(),
    category: elements.taskCategory.value,
    title: elements.taskTitle.value,
    startDate: elements.taskStart.value,
    endDate: elements.taskEnd.value,
    memo: elements.taskMemo.value,
    completed: false,
    createdAt: new Date().toISOString(),
  });

  if (!draft.title || !draft.startDate || !draft.endDate) return;
  if (draft.endDate < draft.startDate) {
    elements.syncStatus.textContent = "마감일은 시작일 이후여야 합니다";
    return;
  }

  const previous = state.tasks.find((item) => item.id === draft.id);
  if (previous) {
    draft.completed = previous.completed;
    draft.createdAt = previous.createdAt;
  }

  const saved = await persistTask(draft);
  upsertIntoState(state.tasks, saved);
  state.selectedDate = saved.startDate;
  state.visibleDate = startOfMonth(parseDate(saved.startDate));
  state.selectedItem = { type: "task", id: saved.id };
  resetTaskForm();
  render();
}

async function persistSchedule(schedule) {
  if (!isSupabaseConfigured()) {
    saveLocalState();
    return schedule;
  }

  try {
    const rows = await supabaseRequest(`${SUPABASE_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([scheduleToDatabase(schedule)]),
    });
    elements.syncStatus.textContent = "일정 저장됨";
    return rows[0] ? scheduleFromDatabase(rows[0]) : schedule;
  } catch (error) {
    console.error(error);
    saveLocalState();
    elements.syncStatus.textContent = "일정 임시 저장됨";
    return schedule;
  }
}

async function persistTask(task) {
  if (!isSupabaseConfigured()) {
    saveLocalState();
    return task;
  }

  try {
    const endpoint = state.taskStorage === "scheduleRows"
      ? `${SUPABASE_TABLE}?on_conflict=id`
      : `${SUPABASE_TASK_TABLE}?on_conflict=id`;
    const row = state.taskStorage === "scheduleRows" ? taskToScheduleRow(task) : taskToDatabase(task);
    const rows = await supabaseRequest(endpoint, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([row]),
    });
    elements.syncStatus.textContent = "업무 저장됨";
    return rows[0]
      ? state.taskStorage === "scheduleRows"
        ? taskFromScheduleRow(rows[0])
        : taskFromDatabase(rows[0])
      : task;
  } catch (error) {
    console.error(error);
    saveLocalState();
    elements.syncStatus.textContent = "업무 임시 저장됨";
    return task;
  }
}

function render() {
  renderMonthLabel();
  renderPulseStrip();
  renderCalendar();
  renderDayList();
  renderDetail();
}

function renderMonthLabel() {
  elements.monthLabel.textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(state.visibleDate);
}

function renderPulseStrip() {
  const days = getMonthDays(state.visibleDate);
  const nodes = days.map((date) => {
    const dateValue = toDateInputValue(date);
    const count = getItemsForDate(dateValue).length;
    const node = document.createElement("button");
    node.type = "button";
    node.className = "pulse-node";
    node.classList.toggle("has-items", count > 0);
    node.classList.toggle("is-selected", dateValue === state.selectedDate);
    node.style.minHeight = `${Math.max(9, Math.min(44, 9 + count * 8))}px`;
    node.title = `${date.getDate()}일 ${count}개`;
    node.addEventListener("click", () => selectDate(dateValue));
    return node;
  });
  elements.pulseStrip.style.gridTemplateColumns = `repeat(${days.length}, minmax(8px, 1fr))`;
  elements.pulseStrip.replaceChildren(...nodes);
}

function renderCalendar() {
  const monthStart = startOfMonth(state.visibleDate);
  const firstCell = addDays(monthStart, -monthStart.getDay());
  const cells = Array.from({ length: 42 }, (_, index) => addDays(firstCell, index));
  const todayValue = toDateInputValue(new Date());

  elements.calendarGrid.replaceChildren(
    ...cells.map((date) => {
      const dateValue = toDateInputValue(date);
      const items = getItemsForDate(dateValue);
      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.classList.toggle("is-muted", date.getMonth() !== state.visibleDate.getMonth());
      cell.classList.toggle("is-today", dateValue === todayValue);
      cell.classList.toggle("is-selected", dateValue === state.selectedDate);

      const head = document.createElement("div");
      head.className = "day-head";
      const dateButton = document.createElement("button");
      dateButton.type = "button";
      dateButton.className = "day-number";
      dateButton.textContent = date.getDate();
      dateButton.addEventListener("click", () => selectDate(dateValue));
      const count = document.createElement("span");
      count.className = "day-count";
      count.textContent = items.length ? `${items.length}` : "";
      head.append(dateButton, count);

      const eventList = document.createElement("div");
      eventList.className = "day-events";
      items.slice(0, 4).forEach((item) => eventList.append(createDayItemButton(item)));
      if (items.length > 4) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "more-chip";
        more.textContent = `+${items.length - 4}`;
        more.addEventListener("click", () => selectDate(dateValue));
        eventList.append(more);
      }

      cell.append(head, eventList);
      return cell;
    }),
  );
}

function createDayItemButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `day-item ${item.category} ${item.type} ${item.spanClass || ""}`;
  button.classList.toggle(
    "active",
    state.selectedItem?.type === item.type && state.selectedItem?.id === item.id,
  );
  button.innerHTML = `
    <span class="item-dot"></span>
    <span>
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.subtitle)}</span>
    </span>
  `;
  button.addEventListener("click", () => {
    state.selectedDate = item.date;
    state.selectedItem = { type: item.type, id: item.id };
    render();
  });
  return button;
}

function renderDayList() {
  const items = getItemsForDate(state.selectedDate);
  elements.selectedDateLabel.textContent = formatDate(state.selectedDate);
  elements.selectedCount.textContent = `${items.length}개`;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "detail-empty";
    empty.textContent = "선택한 날짜에 표시할 항목이 없습니다.";
    elements.dayList.replaceChildren(empty);
    return;
  }

  elements.dayList.replaceChildren(
    ...items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle(
        "active",
        state.selectedItem?.type === item.type && state.selectedItem?.id === item.id,
      );
      button.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.subtitle)}</span>`;
      button.addEventListener("click", () => {
        state.selectedItem = { type: item.type, id: item.id };
        render();
      });
      return button;
    }),
  );
}

function renderDetail() {
  const selected = getSelectedSourceItem();
  elements.detailEmpty.classList.toggle("hidden", Boolean(selected));
  elements.detailContent.classList.toggle("hidden", !selected);
  if (!selected) return;

  const isTask = selected.type === "task";
  elements.detailType.textContent = isTask ? getTaskCategoryLabel(selected.item.category) : getCategoryLabel(selected.item.category);
  elements.detailTitle.textContent = selected.item.title;
  elements.detailMeta.textContent = isTask
    ? `${formatDate(selected.item.startDate)} - ${formatDate(selected.item.endDate)}`
    : [formatDate(selected.item.date), selected.item.startTime, selected.item.place].filter(Boolean).join(" · ");
  elements.detailMemo.textContent = selected.item.memo || "메모 없음";
  elements.completeSelected.textContent = selected.item.completed ? "완료 해제" : "완료";
}

function getItemsForDate(dateValue) {
  const scheduleItems = getVisibleSchedules()
    .filter((schedule) => schedule.date === dateValue)
    .map((schedule) => ({
      type: "schedule",
      id: schedule.id,
      category: schedule.category,
      title: schedule.title,
      subtitle: schedule.startTime || getCategoryShortLabel(schedule.category),
      date: schedule.date,
      sortTime: schedule.startTime || "99:99",
    }));

  const taskItems = getVisibleTasks()
    .filter((task) => dateValue >= task.startDate && dateValue <= task.endDate)
    .map((task) => ({
      type: "task",
      id: task.id,
      category: task.category,
      title: task.title,
      subtitle: getTaskSubtitle(task, dateValue),
      spanClass: getTaskSpanClass(task, dateValue),
      date: dateValue,
      sortTime: "98:99",
    }));

  return [...taskItems, ...scheduleItems].sort((a, b) =>
    a.sortTime.localeCompare(b.sortTime) || a.title.localeCompare(b.title, "ko"),
  );
}

function getVisibleSchedules() {
  return state.schedules.filter((schedule) => {
    const matchesCategory = state.filter === "all" || schedule.category === state.filter;
    return matchesCategory && !schedule.completed;
  });
}

function getVisibleTasks() {
  return state.tasks.filter((task) => {
    const matchesCategory = state.filter === "all" || task.category === state.filter;
    return matchesCategory && !task.completed;
  });
}

function selectDate(dateValue) {
  state.selectedDate = dateValue;
  state.visibleDate = startOfMonth(parseDate(dateValue));
  state.selectedItem = null;
  elements.scheduleDate.value = dateValue;
  elements.taskStart.value = dateValue;
  elements.taskEnd.value = dateValue;
  render();
}

function editSelectedItem() {
  const selected = getSelectedSourceItem();
  if (!selected) return;

  if (selected.type === "schedule") {
    setMode("schedule");
    elements.scheduleId.value = selected.item.id;
    elements.scheduleCategory.value = selected.item.category;
    elements.scheduleTitle.value = selected.item.title;
    elements.scheduleDate.value = selected.item.date;
    elements.scheduleTime.value = selected.item.startTime;
    elements.schedulePlace.value = selected.item.place;
    elements.scheduleMemo.value = selected.item.memo;
    elements.scheduleSubmitText.textContent = "수정 저장";
    elements.scheduleTitle.focus();
    return;
  }

  setMode("task");
  elements.taskId.value = selected.item.id;
  elements.taskCategory.value = selected.item.category;
  elements.taskTitle.value = selected.item.title;
  elements.taskStart.value = selected.item.startDate;
  elements.taskEnd.value = selected.item.endDate;
  elements.taskMemo.value = selected.item.memo;
  elements.taskSubmitText.textContent = "수정 저장";
  elements.taskTitle.focus();
}

async function completeSelectedItem() {
  const selected = getSelectedSourceItem();
  if (!selected) return;

  selected.item.completed = !selected.item.completed;
  if (selected.type === "schedule") {
    await persistSchedule(selected.item);
  } else {
    await persistTask(selected.item);
  }
  state.selectedItem = null;
  saveLocalState();
  render();
}

async function deleteSelectedItem() {
  const selected = getSelectedSourceItem();
  if (!selected) return;

  const confirmed = window.confirm(`"${selected.item.title}" 항목을 삭제할까요?`);
  if (!confirmed) return;

  if (selected.type === "schedule") {
    state.schedules = state.schedules.filter((item) => item.id !== selected.item.id);
    await deleteScheduleFromDatabase(selected.item.id);
  } else {
    state.tasks = state.tasks.filter((item) => item.id !== selected.item.id);
    await deleteTaskFromDatabase(selected.item.id);
  }
  state.selectedItem = null;
  saveLocalState();
  render();
}

async function deleteScheduleFromDatabase(id) {
  if (!isSupabaseConfigured()) return;
  try {
    await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(getDatabaseOwnedId(id))}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    elements.syncStatus.textContent = "일정 삭제됨";
  } catch (error) {
    console.error(error);
    elements.syncStatus.textContent = "삭제 실패, 화면에서만 반영";
  }
}

async function deleteTaskFromDatabase(id) {
  if (!isSupabaseConfigured()) return;
  try {
    if (state.taskStorage === "scheduleRows") {
      await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(getDatabaseTaskId(id))}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    } else {
      await supabaseRequest(`${SUPABASE_TASK_TABLE}?id=eq.${encodeURIComponent(getDatabaseOwnedId(id))}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    }
    elements.syncStatus.textContent = "업무 삭제됨";
  } catch (error) {
    console.error(error);
    elements.syncStatus.textContent = "삭제 실패, 화면에서만 반영";
  }
}

function getSelectedSourceItem() {
  if (!state.selectedItem) return null;
  if (state.selectedItem.type === "schedule") {
    const item = state.schedules.find((schedule) => schedule.id === state.selectedItem.id);
    return item ? { type: "schedule", item } : null;
  }
  const item = state.tasks.find((task) => task.id === state.selectedItem.id);
  return item ? { type: "task", item } : null;
}

function resetForms() {
  resetScheduleForm();
  resetTaskForm();
}

function resetScheduleForm() {
  elements.scheduleForm.reset();
  elements.scheduleId.value = "";
  elements.scheduleCategory.value = getCategoryProfile().defaultCategory;
  elements.scheduleDate.value = state.selectedDate;
  elements.scheduleSubmitText.textContent = "일정 추가";
}

function resetTaskForm() {
  elements.taskForm.reset();
  elements.taskId.value = "";
  elements.taskCategory.value = getCategoryProfile().order[0];
  elements.taskStart.value = state.selectedDate;
  elements.taskEnd.value = state.selectedDate;
  elements.taskSubmitText.textContent = "업무 추가";
}

function getTaskSubtitle(task, dateValue) {
  if (task.startDate === task.endDate) return "업무";
  if (dateValue === task.startDate) return "업무 시작";
  if (dateValue === task.endDate) return "업무 마감";
  return "업무 진행";
}

function getTaskSpanClass(task, dateValue) {
  if (task.startDate === task.endDate) return "is-single";
  if (dateValue === task.startDate) return "is-start";
  if (dateValue === task.endDate) return "is-end";
  return "is-middle";
}

function getMonthDays(date) {
  const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1));
}

function getPersonProfile() {
  return PEOPLE.find((person) => person.id === state.personId) || PEOPLE[0];
}

function getCategoryProfile() {
  return CATEGORY_PROFILES[state.personId] || CATEGORY_PROFILES.person1;
}

function getCategoryLabel(category) {
  return getCategoryProfile().labels[category] || category;
}

function getCategoryShortLabel(category) {
  return getCategoryProfile().shortLabels[category] || category;
}

function getTaskCategoryLabel(category) {
  return `${getCategoryShortLabel(category)} 업무`;
}

function normalizeSchedule(schedule) {
  return {
    id: typeof schedule.id === "string" ? schedule.id : createId(),
    category: getCategoryProfile().labels[schedule.category] ? schedule.category : getCategoryProfile().defaultCategory,
    title: String(schedule.title || "").trim(),
    date: String(schedule.date || ""),
    startTime: String(schedule.startTime || schedule.start_time || ""),
    place: String(schedule.place || "").trim(),
    memo: String(schedule.memo || "").trim(),
    completed: Boolean(schedule.completed),
    createdAt: schedule.createdAt || schedule.created_at || new Date().toISOString(),
  };
}

function normalizeTask(task) {
  const defaultCategory = getCategoryProfile().order[0] || getCategoryProfile().defaultCategory;
  return {
    id: typeof task.id === "string" ? task.id : createId(),
    category: getCategoryProfile().labels[task.category] ? task.category : defaultCategory,
    title: String(task.title || "").trim(),
    startDate: String(task.startDate || task.start_date || ""),
    endDate: String(task.endDate || task.end_date || ""),
    memo: String(task.memo || "").trim(),
    completed: Boolean(task.completed),
    createdAt: task.createdAt || task.created_at || new Date().toISOString(),
  };
}

function scheduleFromDatabase(row) {
  return normalizeSchedule({
    id: getAppOwnedId(row.id),
    category: row.category,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    place: row.place,
    memo: row.memo,
    completed: row.completed,
    createdAt: row.created_at,
  });
}

function scheduleToDatabase(schedule) {
  const normalized = normalizeSchedule(schedule);
  return {
    id: getDatabaseOwnedId(normalized.id),
    category: normalized.category,
    title: normalized.title,
    date: normalized.date,
    start_time: normalized.startTime,
    end_time: "",
    place: normalized.place,
    memo: normalized.memo,
    reminder_minutes: null,
    completed: normalized.completed,
    created_at: normalized.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function taskFromDatabase(row) {
  return normalizeTask({
    id: getAppOwnedId(row.id),
    category: row.category,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    memo: row.memo,
    completed: row.completed,
    createdAt: row.created_at,
  });
}

function taskToDatabase(task) {
  const normalized = normalizeTask(task);
  return {
    id: getDatabaseOwnedId(normalized.id),
    category: normalized.category,
    title: normalized.title,
    start_date: normalized.startDate,
    end_date: normalized.endDate,
    memo: normalized.memo,
    completed: normalized.completed,
    created_at: normalized.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function taskFromScheduleRow(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.memo || "{}");
  } catch (error) {
    payload = {};
  }
  return normalizeTask({
    id: getAppTaskId(row.id),
    category: row.category,
    title: row.title,
    startDate: payload.startDate || row.date,
    endDate: payload.endDate || row.date,
    memo: payload.memo || "",
    completed: row.completed,
    createdAt: row.created_at,
  });
}

function taskToScheduleRow(task) {
  const normalized = normalizeTask(task);
  return {
    id: getDatabaseTaskId(normalized.id),
    category: normalized.category,
    title: normalized.title,
    date: normalized.endDate,
    start_time: "",
    end_time: "",
    place: TASK_ROW_MARKER,
    memo: JSON.stringify({
      marker: TASK_ROW_MARKER,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      memo: normalized.memo,
    }),
    reminder_minutes: null,
    completed: normalized.completed,
    created_at: normalized.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function isVisibleScheduleRow(row) {
  return isVisibleOwnedId(row) && row.place !== TASK_ROW_MARKER && row.place !== HEADER_ROW_MARKER;
}

function isVisibleTaskScheduleRow(row) {
  return isVisibleOwnedId(row) && row.place === TASK_ROW_MARKER;
}

function isVisibleOwnedId(row) {
  return isOwnedId(String(row.id || ""));
}

function isOwnedId(id) {
  const prefix = getCurrentPersonPrefix();
  if (prefix) return id.startsWith(prefix);
  return !PEOPLE.some((person) => {
    const otherPrefix = getPersonPrefix(person.id);
    return otherPrefix && id.startsWith(otherPrefix);
  });
}

function getPersonPrefix(personId) {
  return personId === PRIMARY_PERSON_ID ? "" : `${personId}:`;
}

function getCurrentPersonPrefix() {
  return getPersonPrefix(state.personId);
}

function getDatabaseOwnedId(id) {
  const prefix = getCurrentPersonPrefix();
  return prefix && !id.startsWith(prefix) ? `${prefix}${id}` : id;
}

function getAppOwnedId(id) {
  const prefix = getCurrentPersonPrefix();
  return prefix && id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

function getDatabaseTaskId(id) {
  const ownedId = getDatabaseOwnedId(id);
  return ownedId.includes(TASK_ID_PREFIX) ? ownedId : `${getCurrentPersonPrefix()}${TASK_ID_PREFIX}${getAppOwnedId(id)}`;
}

function getAppTaskId(id) {
  return getAppOwnedId(id).replace(TASK_ID_PREFIX, "");
}

async function supabaseRequest(endpoint, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("YOUR-PROJECT"));
}

function readLocal(type) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getLocalKey(type)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveLocalState() {
  localStorage.setItem(getLocalKey("schedules"), JSON.stringify(state.schedules));
  localStorage.setItem(getLocalKey("tasks"), JSON.stringify(state.tasks));
}

function getLocalKey(type) {
  return `school-planner-v2-${state.personId}-${type}`;
}

function upsertIntoState(collection, item) {
  const index = collection.findIndex((current) => current.id === item.id);
  if (index >= 0) {
    collection.splice(index, 1, item);
  } else {
    collection.push(item);
  }
  collection.sort(item.startDate ? sortTasks : sortSchedules);
  saveLocalState();
}

function sortSchedules(a, b) {
  return (
    a.date.localeCompare(b.date) ||
    (a.startTime || "99:99").localeCompare(b.startTime || "99:99") ||
    a.title.localeCompare(b.title, "ko")
  );
}

function sortTasks(a, b) {
  return (
    a.endDate.localeCompare(b.endDate) ||
    a.startDate.localeCompare(b.startDate) ||
    a.title.localeCompare(b.title, "ko")
  );
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseDate(value));
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
