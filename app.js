const PEOPLE = [
  {
    id: "person1",
    page: "index.html",
    label: "A",
    title: "내 학교 일정 관리",
    eyebrow: "개인 학교 일정",
  },
  {
    id: "person2",
    page: "person2.html",
    label: "B",
    title: "다른 사람 학교 일정 관리",
    eyebrow: "공유 학교 일정",
  },
];
const PRIMARY_PERSON_ID = "person1";
const CURRENT_PERSON = getCurrentPerson();
const STORAGE_KEY = getScopedStorageKey("personal-school-schedule-v1");
const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};
const SUPABASE_URL = String(SUPABASE_CONFIG.url || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(SUPABASE_CONFIG.anonKey || "");
const SUPABASE_TABLE = String(SUPABASE_CONFIG.table || "schedules");
const SUPABASE_TASK_TABLE = String(SUPABASE_CONFIG.taskTable || "work_tasks");
const SUPABASE_PAGE_SETTINGS_TABLE = String(SUPABASE_CONFIG.pageSettingsTable || "page_settings");
const TASK_STORAGE_KEY = getScopedStorageKey("personal-school-work-tasks-v1");
const HEADER_STORAGE_KEY = getScopedStorageKey("personal-school-header-v1");
const TASK_ROW_MARKER = "__WORK_TASK__";
const TASK_ID_PREFIX = "task:";
const HEADER_ROW_MARKER = "__PAGE_HEADER__";

let taskStorageAdapter = null;
let headerSaveTimer = null;
let calendarActionMenu = null;

const CATEGORY_LABELS = {
  homeroom: "담임 일정",
  department: "부서 일정",
  subject: "교과교사 일정",
};

const CATEGORY_SHORT_LABELS = {
  homeroom: "담임",
  department: "부서",
  subject: "교과",
};

const PERSON_CATEGORY_PROFILES = {
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
    taskLabels: {
      homeroom: "여가 업무",
      subject: "상담 업무",
      department: "업무",
      training: "연수 업무",
    },
    order: ["homeroom", "subject", "department", "training"],
    selectOrder: ["subject", "department", "training", "homeroom"],
    defaultCategory: "subject",
  },
};

const state = {
  schedules: [],
  tasks: [],
  visibleDate: startOfMonth(new Date()),
  selectedDate: toDateInputValue(new Date()),
  filter: "all",
  query: "",
  view: "calendar",
  taskFilter: "open",
  expandedCalendarDates: new Set(),
  entryMode: "schedule",
};

const elements = {
  scheduleForm: document.querySelector("#scheduleForm"),
  editingId: document.querySelector("#editingId"),
  formTitle: document.querySelector("#formTitle"),
  submitLabel: document.querySelector("#submitLabel"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  categoryInput: document.querySelector("#categoryInput"),
  titleInput: document.querySelector("#titleInput"),
  dateInput: document.querySelector("#dateInput"),
  placeInput: document.querySelector("#placeInput"),
  startTimeInput: document.querySelector("#startTimeInput"),
  endTimeInput: document.querySelector("#endTimeInput"),
  memoInput: document.querySelector("#memoInput"),
  statsGrid: document.querySelector("#statsGrid"),
  upcomingList: document.querySelector("#upcomingList"),
  monthLabel: document.querySelector("#monthLabel"),
  prevMonthButton: document.querySelector("#prevMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  todayButton: document.querySelector("#todayButton"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarView: document.querySelector("#calendarView"),
  listView: document.querySelector("#listView"),
  agendaList: document.querySelector("#agendaList"),
  searchInput: document.querySelector("#searchInput"),
  categoryTabs: document.querySelectorAll(".category-tab"),
  calendarViewButton: document.querySelector("#calendarViewButton"),
  listViewButton: document.querySelector("#listViewButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  clearCompletedButton: document.querySelector("#clearCompletedButton"),
  taskForm: document.querySelector("#taskForm"),
  editingTaskId: document.querySelector("#editingTaskId"),
  taskFormTitle: document.querySelector("#taskFormTitle"),
  taskSubmitLabel: document.querySelector("#taskSubmitLabel"),
  cancelTaskEditButton: document.querySelector("#cancelTaskEditButton"),
  taskCategoryInput: document.querySelector("#taskCategoryInput"),
  taskTitleInput: document.querySelector("#taskTitleInput"),
  taskStartDateInput: document.querySelector("#taskStartDateInput"),
  taskEndDateInput: document.querySelector("#taskEndDateInput"),
  taskMemoInput: document.querySelector("#taskMemoInput"),
  taskList: document.querySelector("#taskList"),
  showOpenTasksButton: document.querySelector("#showOpenTasksButton"),
  showAllTasksButton: document.querySelector("#showAllTasksButton"),
  template: document.querySelector("#eventTemplate"),
};

init();

async function init() {
  setupPersonShell();
  elements.dateInput.value = state.selectedDate;
  elements.taskStartDateInput.value = state.selectedDate;
  elements.taskEndDateInput.value = state.selectedDate;
  bindEvents();
  setEntryMode("schedule");
  render();
  await loadHeaderSettingsFromDatabase();
  const [schedules, tasks] = await Promise.all([loadSchedules(), loadTasks()]);
  state.schedules = schedules;
  state.tasks = tasks;
  applyInitialScheduleSelection();
  render();
}

function bindEvents() {
  elements.scheduleForm.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.prevMonthButton.addEventListener("click", () => changeMonth(-1));
  elements.nextMonthButton.addEventListener("click", () => changeMonth(1));
  elements.todayButton.addEventListener("click", goToday);
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
  elements.categoryTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      render();
    });
  });
  elements.calendarViewButton.addEventListener("click", () => setView("calendar"));
  elements.listViewButton.addEventListener("click", () => setView("list"));
  elements.exportButton.addEventListener("click", exportSchedules);
  elements.importInput.addEventListener("change", importSchedules);
  elements.clearCompletedButton.addEventListener("click", clearCompleted);
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.cancelTaskEditButton.addEventListener("click", resetTaskForm);
  elements.showOpenTasksButton.addEventListener("click", () => {
    state.taskFilter = "open";
    renderTasks();
  });
  elements.showAllTasksButton.addEventListener("click", () => {
    state.taskFilter = "all";
    renderTasks();
  });
  document.querySelectorAll("[data-entry-mode]").forEach((button) => {
    button.addEventListener("click", () => setEntryMode(button.dataset.entryMode));
  });
}

function setupPersonShell() {
  document.body.dataset.person = CURRENT_PERSON.id;
  setupCategoryShell();
  const headerDate = document.querySelector("#headerDate");
  if (headerDate) {
    headerDate.textContent = new Intl.DateTimeFormat("ko-KR", {
      month: "long", day: "numeric", weekday: "long",
    }).format(new Date());
  }

  const savedHeader = loadHeaderConfig();
  document.title = savedHeader.title;

  const eyebrow = document.querySelector(".eyebrow");
  if (eyebrow) {
    eyebrow.textContent = savedHeader.eyebrow;
    makeEditableHeaderText(eyebrow, "eyebrow");
  }

  const heading = document.querySelector(".topbar h1");
  if (heading) {
    heading.textContent = savedHeader.title;
    makeEditableHeaderText(heading, "title");
  }

  const actions = document.querySelector(".topbar-actions");
  if (!actions || actions.querySelector(".person-switcher")) return;

  const switcher = document.createElement("nav");
  switcher.className = "person-switcher";
  switcher.setAttribute("aria-label", "일정 사용자 전환");

  PEOPLE.forEach((person) => {
    const link = document.createElement("a");
    link.className = "person-link";
    link.href = person.page;
    link.textContent = person.label;

    if (person.id === CURRENT_PERSON.id) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }

    switcher.append(link);
  });

  actions.prepend(switcher);
}

function setEntryMode(mode) {
  state.entryMode = mode;
  document.querySelectorAll("[data-entry-mode]").forEach((button) => {
    const active = button.dataset.entryMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelector("#scheduleEntry").classList.toggle("hidden", mode !== "schedule");
  document.querySelector("#taskEntry").classList.toggle("hidden", mode !== "task");
}

function setupCategoryShell() {
  const labels = getCategoryLabels();
  const shortLabels = getCategoryShortLabels();
  const order = getCategoryOrder();

  updateCategorySelect(elements.categoryInput, labels, getCategorySelectOrder());
  elements.categoryInput.value = getDefaultCategory();
  updateCategorySelect(elements.taskCategoryInput, getTaskCategoryLabels(), order);
  updateCategoryTabs(shortLabels, order);
  updateLegend(labels, order);
  elements.categoryTabs = document.querySelectorAll(".category-tab");
}

function updateCategorySelect(select, labels, order) {
  if (!select) return;

  const optionsByValue = new Map(Array.from(select.options).map((option) => [option.value, option]));
  order.forEach((category) => {
    let option = optionsByValue.get(category);
    if (!option) {
      option = document.createElement("option");
      option.value = category;
    }

    option.textContent = labels[category];
    select.append(option);
  });
}

function updateCategoryTabs(shortLabels, order) {
  const tabs = Array.from(document.querySelectorAll(".category-tab"));
  const parent = tabs[0]?.parentElement;
  if (!parent) return;

  const allTab = tabs.find((tab) => tab.dataset.filter === "all");
  if (allTab) {
    allTab.textContent = "전체";
    parent.append(allTab);
  }

  order.forEach((category) => {
    let tab = tabs.find((item) => item.dataset.filter === category);
    if (!tab) {
      tab = document.createElement("button");
      tab.className = "category-tab";
      tab.type = "button";
      tab.dataset.filter = category;
    }

    tab.textContent = shortLabels[category];
    parent.append(tab);
  });
}

function updateLegend(labels, order) {
  const legend = document.querySelector(".legend");
  if (!legend) return;

  legend.replaceChildren(
    ...order.map((category) => {
      const item = document.createElement("span");
      item.innerHTML = `<i class="dot ${category}"></i>${labels[category]}`;
      return item;
    }),
  );
}

function makeEditableHeaderText(element, field) {
  element.contentEditable = "true";
  element.spellcheck = false;
  element.setAttribute("role", "textbox");
  element.setAttribute("aria-label", field === "title" ? "큰 제목 수정" : "작은 제목 수정");
  element.setAttribute("title", "클릭해서 직접 수정");

  element.addEventListener("input", () => {
    saveHeaderConfigFromPage();
  });

  element.addEventListener("blur", () => {
    if (!element.textContent.trim()) {
      element.textContent = field === "title" ? CURRENT_PERSON.title : CURRENT_PERSON.eyebrow;
    }
    saveHeaderConfigFromPage();
  });

  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      element.blur();
    }
  });
}

function loadHeaderConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HEADER_STORAGE_KEY) || "{}");
    return {
      title: String(parsed.title || CURRENT_PERSON.title),
      eyebrow: String(parsed.eyebrow || CURRENT_PERSON.eyebrow),
    };
  } catch (error) {
    return {
      title: CURRENT_PERSON.title,
      eyebrow: CURRENT_PERSON.eyebrow,
    };
  }
}

function saveHeaderConfigFromPage() {
  const heading = document.querySelector(".topbar h1");
  const eyebrow = document.querySelector(".eyebrow");
  const title = heading?.textContent.trim() || CURRENT_PERSON.title;
  const eyebrowText = eyebrow?.textContent.trim() || CURRENT_PERSON.eyebrow;

  document.title = title;
  const config = {
    title,
    eyebrow: eyebrowText,
  };

  localStorage.setItem(HEADER_STORAGE_KEY, JSON.stringify(config));
  queueHeaderSettingsSave(config);
}

async function loadHeaderSettingsFromDatabase() {
  try {
    const row = await readHeaderSettingsRow();
    if (!row) return;

    const config = {
      title: String(row.header_title || row.headerTitle || CURRENT_PERSON.title),
      eyebrow: String(row.header_eyebrow || row.headerEyebrow || CURRENT_PERSON.eyebrow),
    };
    applyHeaderConfig(config);
    localStorage.setItem(HEADER_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn("Header settings could not be loaded from Supabase.", error);
  }
}

function applyHeaderConfig(config) {
  const heading = document.querySelector(".topbar h1");
  const eyebrow = document.querySelector(".eyebrow");
  if (heading) heading.textContent = config.title;
  if (eyebrow) eyebrow.textContent = config.eyebrow;
  document.title = config.title;
}

function queueHeaderSettingsSave(config) {
  if (headerSaveTimer) window.clearTimeout(headerSaveTimer);
  headerSaveTimer = window.setTimeout(() => {
    saveHeaderSettingsToDatabase(config).catch((error) => {
      console.warn("Header settings could not be saved to Supabase.", error);
    });
  }, 500);
}

async function saveHeaderSettingsToDatabase(config) {
  try {
    await supabaseRequest(`${SUPABASE_PAGE_SETTINGS_TABLE}?on_conflict=person_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        person_id: CURRENT_PERSON.id,
        header_title: config.title,
        header_eyebrow: config.eyebrow,
        updated_at: new Date().toISOString(),
      }]),
    });
  } catch (error) {
    if (!isMissingPageSettingsTableError(error)) throw error;
    await upsertHeaderSettingsScheduleRow(config);
  }
}

async function readHeaderSettingsRow() {
  try {
    const rows = await supabaseRequest(
      `${SUPABASE_PAGE_SETTINGS_TABLE}?person_id=eq.${encodeURIComponent(CURRENT_PERSON.id)}&select=*`,
    );
    return rows[0] || null;
  } catch (error) {
    if (!isMissingPageSettingsTableError(error)) throw error;
    return readHeaderSettingsScheduleRow();
  }
}

async function readHeaderSettingsScheduleRow() {
  const rows = await supabaseRequest(
    `${SUPABASE_TABLE}?id=eq.${encodeURIComponent(getHeaderSettingsRowId())}&select=*`,
  );
  const row = rows[0];
  if (!row) return null;
  return parseHeaderSettingsPayload(row.memo);
}

async function upsertHeaderSettingsScheduleRow(config) {
  await supabaseRequest(`${SUPABASE_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      id: getHeaderSettingsRowId(),
      category: "homeroom",
      title: config.title,
      date: "1970-01-01",
      start_time: "",
      end_time: "",
      place: HEADER_ROW_MARKER,
      memo: JSON.stringify({
        marker: HEADER_ROW_MARKER,
        headerTitle: config.title,
        headerEyebrow: config.eyebrow,
      }),
      reminder_minutes: null,
      completed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]),
  });
}

function parseHeaderSettingsPayload(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed?.marker === HEADER_ROW_MARKER ? parsed : null;
  } catch (error) {
    return null;
  }
}

function getHeaderSettingsRowId() {
  return `${getCurrentPersonPrefix()}header-settings`;
}

async function handleSubmit(event) {
  event.preventDefault();

  const draft = {
    id: elements.editingId.value || createId(),
    category: elements.categoryInput.value,
    title: elements.titleInput.value.trim(),
    date: elements.dateInput.value,
    startTime: elements.startTimeInput.value,
    endTime: elements.endTimeInput.value,
    place: elements.placeInput.value.trim(),
    memo: elements.memoInput.value.trim(),
    reminderMinutes: null,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  if (!draft.title || !draft.date) {
    showToast("일정명과 날짜를 입력하세요.");
    return;
  }

  if (draft.startTime && draft.endTime && draft.endTime < draft.startTime) {
    showToast("종료 시간은 시작 시간보다 늦어야 합니다.");
    return;
  }

  const existingIndex = state.schedules.findIndex((schedule) => schedule.id === draft.id);
  const existingSchedule = state.schedules[existingIndex];
  if (existingSchedule) {
    draft.completed = state.schedules[existingIndex].completed;
    draft.createdAt = state.schedules[existingIndex].createdAt;
    draft.reminderMinutes = existingSchedule.reminderMinutes;
  }

  try {
    const savedSchedule = await upsertScheduleInDatabase(draft);
    if (existingIndex >= 0) {
      state.schedules.splice(existingIndex, 1, savedSchedule);
      showToast("일정을 수정했습니다.");
    } else {
      state.schedules.push(savedSchedule);
      showToast("일정을 추가했습니다.");
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error(error);
    if (existingIndex >= 0) {
      state.schedules.splice(existingIndex, 1, draft);
    } else {
      state.schedules.push(draft);
    }
    saveLegacySchedules();
    showToast("Supabase 저장에 실패해 이 기기에 임시 저장했습니다.");
  }

  state.schedules.sort(sortSchedules);

  state.visibleDate = startOfMonth(parseDate(draft.date));
  state.selectedDate = draft.date;
  resetForm();
  render();
}

function resetForm() {
  const selectedDate = state.selectedDate || toDateInputValue(new Date());
  elements.scheduleForm.reset();
  elements.editingId.value = "";
  elements.categoryInput.value = getDefaultCategory();
  elements.dateInput.value = selectedDate;
  elements.formTitle.textContent = "새 일정";
  elements.submitLabel.textContent = "일정 추가";
  elements.cancelEditButton.classList.add("hidden");
}

function changeMonth(delta) {
  state.visibleDate = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + delta, 1);
  render();
}

function goToday() {
  const today = new Date();
  state.visibleDate = startOfMonth(today);
  state.selectedDate = toDateInputValue(today);
  state.view = "list";
  elements.dateInput.value = state.selectedDate;
  render();
  scrollAgendaIntoView();
}

function setView(view) {
  state.view = view;
  render();
}

function render() {
  renderToolbar();
  renderStats();
  renderUpcoming();
  renderCalendar();
  renderAgenda();
  renderTasks();
}

function renderToolbar() {
  elements.monthLabel.textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(state.visibleDate);

  document.querySelector("#taskMonthSummary").textContent = elements.monthLabel.textContent;

  elements.categoryTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });

  elements.calendarViewButton.classList.toggle("active", state.view === "calendar");
  elements.listViewButton.classList.toggle("active", state.view === "list");
  elements.calendarView.classList.toggle("hidden", state.view !== "calendar");
  elements.listView.classList.toggle("hidden", state.view !== "list");
}

function renderStats() {
  const todayValue = toDateInputValue(new Date());
  const weekEnd = addDays(parseDate(todayValue), 6);
  const upcomingWeek = state.schedules.filter((schedule) => {
    const date = parseDate(schedule.date);
    return date >= parseDate(todayValue) && date <= weekEnd && !schedule.completed;
  });

  const stats = [
    ["오늘", state.schedules.filter((schedule) => schedule.date === todayValue && !schedule.completed).length],
    ["7일 안", upcomingWeek.length],
    ["미완료", state.schedules.filter((schedule) => !schedule.completed).length],
    ["진행 업무", state.tasks.filter((task) => !task.completed).length],
    ["지연 업무", state.tasks.filter((task) => isTaskOverdue(task)).length],
    ["전체 일정", state.schedules.length],
  ];

  elements.statsGrid.replaceChildren(
    ...stats.map(([label, value]) => {
      const tile = document.createElement("div");
      tile.className = "stat-tile";
      tile.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
      return tile;
    }),
  );
}

function renderUpcoming() {
  const today = parseDate(toDateInputValue(new Date()));
  const upcoming = state.schedules
    .filter((schedule) => parseDate(schedule.date) >= today && !schedule.completed)
    .sort(sortSchedules)
    .slice(0, 6);

  if (!upcoming.length) {
    elements.upcomingList.innerHTML = `<div class="empty-state">예정된 일정이 없습니다.</div>`;
    return;
  }

  elements.upcomingList.replaceChildren(
    ...upcoming.map((schedule) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mini-event";
      item.dataset.category = schedule.category;
      item.innerHTML = `
        <span class="mini-marker"></span>
        <span>
          <strong>${escapeHtml(schedule.title)}</strong>
          <span>${formatDate(schedule.date)} · ${getCategoryShortLabel(schedule.category)}${schedule.startTime ? ` · ${schedule.startTime}` : ""}</span>
        </span>
      `;
      item.addEventListener("click", () => {
        state.visibleDate = startOfMonth(parseDate(schedule.date));
        state.selectedDate = schedule.date;
        elements.dateInput.value = schedule.date;
        setView("list");
      });
      return item;
    }),
  );
}

function renderCalendar() {
  const monthStart = startOfMonth(state.visibleDate);
  const firstCell = addDays(monthStart, -monthStart.getDay());
  const cells = Array.from({ length: 42 }, (_, index) => addDays(firstCell, index));
  const todayValue = toDateInputValue(new Date());
  const filtered = getFilteredSchedules();

  elements.calendarGrid.replaceChildren(
    ...cells.map((date) => {
      const dateValue = toDateInputValue(date);
      const daySchedules = filtered.filter((schedule) => schedule.date === dateValue).sort(sortSchedules);
      const isExpanded = state.expandedCalendarDates.has(dateValue);
      const visibleSchedules = isExpanded ? daySchedules : daySchedules.slice(0, 4);
      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.classList.toggle("is-muted", date.getMonth() !== state.visibleDate.getMonth());
      cell.classList.toggle("is-today", dateValue === todayValue);
      cell.classList.toggle("is-selected", dateValue === state.selectedDate);
      cell.classList.toggle("is-expanded", isExpanded);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "day-button";
      button.textContent = date.getDate();
      button.addEventListener("click", () => {
        state.selectedDate = dateValue;
        elements.dateInput.value = dateValue;
        state.visibleDate = startOfMonth(date);
        render();
      });

      const events = document.createElement("div");
      events.className = "day-events";
      visibleSchedules.forEach((schedule) => {
        const eventButton = document.createElement("button");
        eventButton.type = "button";
        eventButton.className = `day-event ${schedule.category}`;
        eventButton.classList.toggle("is-completed", schedule.completed);
        eventButton.innerHTML = `
          <span class="dot ${schedule.category}"></span>
          <span>
            <strong>${escapeHtml(schedule.title)}</strong>
            <span>${schedule.startTime || getCategoryShortLabel(schedule.category)}</span>
          </span>
        `;
        eventButton.addEventListener("click", (event) => {
          event.stopPropagation();
          showCalendarScheduleMenu(schedule, eventButton);
        });
        events.append(eventButton);
      });

      if (daySchedules.length > 4) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "more-count";
        more.classList.toggle("is-expanded", isExpanded);
        more.textContent = isExpanded ? "접기" : `+${daySchedules.length - 4}개 더`;
        more.setAttribute("aria-label", isExpanded ? "일정 접기" : `${daySchedules.length - 4}개 일정 더 보기`);
        more.addEventListener("click", (event) => {
          event.stopPropagation();
          if (isExpanded) {
            state.expandedCalendarDates.delete(dateValue);
          } else {
            state.expandedCalendarDates.add(dateValue);
          }
          renderCalendar();
        });
        events.append(more);
      }

      cell.append(button, events);
      return cell;
    }),
  );
}

function showCalendarScheduleMenu(schedule, anchor) {
  closeCalendarActionMenu();

  const menu = document.createElement("div");
  menu.className = "calendar-action-menu";
  menu.addEventListener("click", (event) => event.stopPropagation());

  const title = document.createElement("strong");
  title.textContent = schedule.title;

  const completeButton = document.createElement("button");
  completeButton.type = "button";
  completeButton.textContent = schedule.completed ? "완료 해제" : "일정 완료";
  completeButton.addEventListener("click", () => {
    closeCalendarActionMenu();
    toggleComplete(schedule.id);
  });

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "일정 수정";
  editButton.addEventListener("click", () => {
    closeCalendarActionMenu();
    editSchedule(schedule.id);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger";
  deleteButton.textContent = "일정 삭제";
  deleteButton.addEventListener("click", () => {
    closeCalendarActionMenu();
    deleteSchedule(schedule.id);
  });

  menu.append(title, completeButton, editButton, deleteButton);
  document.body.append(menu);

  const anchorRect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.max(12, Math.min(anchorRect.left, window.innerWidth - menuRect.width - 12));
  const top = Math.max(12, Math.min(anchorRect.bottom + 6, window.innerHeight - menuRect.height - 12));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  calendarActionMenu = menu;
  setTimeout(() => {
    document.addEventListener("click", closeCalendarActionMenu, { once: true });
  });
}

function closeCalendarActionMenu() {
  calendarActionMenu?.remove();
  calendarActionMenu = null;
}

function renderAgenda() {
  const month = state.visibleDate.getMonth();
  const year = state.visibleDate.getFullYear();
  const focusDate = getVisibleAgendaFocusDate();
  const schedules = getFilteredSchedules()
    .filter((schedule) => {
      const date = parseDate(schedule.date);
      return date.getFullYear() === year && date.getMonth() === month;
    })
    .sort((a, b) => sortAgendaSchedules(a, b, focusDate));

  if (!schedules.length) {
    elements.agendaList.innerHTML = `<div class="empty-state">이 달에 표시할 일정이 없습니다.</div>`;
    return;
  }

  const groups = groupByDate(schedules);
  const fragments = Object.entries(groups).map(([date, daySchedules]) => {
    const day = document.createElement("section");
    day.className = "agenda-day";

    const heading = document.createElement("div");
    heading.className = "agenda-day-heading";
    heading.innerHTML = `<h3>${formatDate(date)}</h3><span>${daySchedules.length}개</span>`;
    day.append(heading);

    daySchedules.forEach((schedule) => day.append(createEventItem(schedule)));
    return day;
  });

  elements.agendaList.replaceChildren(...fragments);
}

function scrollAgendaIntoView() {
  requestAnimationFrame(() => {
    elements.listView.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function createEventItem(schedule) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  node.dataset.category = schedule.category;
  node.classList.toggle("is-completed", schedule.completed);
  node.querySelector(".event-category").textContent = getCategoryLabel(schedule.category);
  node.querySelector(".event-time").textContent = formatTimeRange(schedule);
  node.querySelector("h3").textContent = schedule.title;

  const metaParts = [formatDate(schedule.date)];
  if (schedule.place) metaParts.push(schedule.place);
  node.querySelector(".event-meta").textContent = metaParts.join(" · ");

  const memo = node.querySelector(".event-memo");
  memo.textContent = schedule.memo;
  memo.classList.toggle("hidden", !schedule.memo);

  const completeButton = node.querySelector(".complete-event");
  completeButton.title = schedule.completed ? "완료 해제" : "완료 표시";
  completeButton.setAttribute("aria-label", completeButton.title);
  completeButton.addEventListener("click", () => toggleComplete(schedule.id));
  node.querySelector(".edit-event").addEventListener("click", () => editSchedule(schedule.id));
  node.querySelector(".delete-event").addEventListener("click", () => deleteSchedule(schedule.id));

  return node;
}

function editSchedule(id) {
  setEntryMode("schedule");
  const schedule = state.schedules.find((item) => item.id === id);
  if (!schedule) return;

  elements.editingId.value = schedule.id;
  elements.categoryInput.value = schedule.category;
  elements.titleInput.value = schedule.title;
  elements.dateInput.value = schedule.date;
  elements.placeInput.value = schedule.place;
  elements.startTimeInput.value = schedule.startTime;
  elements.endTimeInput.value = schedule.endTime;
  elements.memoInput.value = schedule.memo;
  elements.formTitle.textContent = "일정 수정";
  elements.submitLabel.textContent = "수정 저장";
  elements.cancelEditButton.classList.remove("hidden");
  state.selectedDate = schedule.date;
  state.visibleDate = startOfMonth(parseDate(schedule.date));
  render();
  elements.titleInput.focus();
}

async function deleteSchedule(id) {
  const schedule = state.schedules.find((item) => item.id === id);
  if (!schedule) return;

  const confirmed = window.confirm(`"${schedule.title}" 일정을 삭제할까요?`);
  if (!confirmed) return;

  state.schedules = state.schedules.filter((item) => item.id !== id);
  try {
    await deleteScheduleFromDatabase(id);
    localStorage.removeItem(STORAGE_KEY);
    showToast("일정을 삭제했습니다.");
  } catch (error) {
    console.error(error);
    saveLegacySchedules();
    showToast("Supabase 삭제에 실패해 이 기기에 임시 반영했습니다.");
  }
  resetForm();
  render();
}

async function toggleComplete(id) {
  const changedSchedule = state.schedules.find((schedule) => schedule.id === id);
  if (!changedSchedule) return;

  const updatedSchedule = { ...changedSchedule, completed: !changedSchedule.completed };
  state.schedules = state.schedules.map((schedule) =>
    schedule.id === id ? updatedSchedule : schedule,
  );

  try {
    await updateScheduleInDatabase(updatedSchedule);
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error(error);
    saveLegacySchedules();
    showToast("Supabase 저장에 실패해 이 기기에 임시 반영했습니다.");
  }
  render();
}

async function clearCompleted() {
  const completedScheduleIds = state.schedules
    .filter((schedule) => schedule.completed)
    .map((schedule) => schedule.id);
  const completedCount = completedScheduleIds.length;
  if (!completedCount) {
    showToast("정리할 완료 일정이 없습니다.");
    return;
  }

  const confirmed = window.confirm(`완료된 일정 ${completedCount}개를 정리할까요?`);
  if (!confirmed) return;

  state.schedules = state.schedules.filter((schedule) => !schedule.completed);
  try {
    await deleteCompletedSchedulesFromDatabase(completedScheduleIds);
    localStorage.removeItem(STORAGE_KEY);
    showToast("완료 일정을 정리했습니다.");
  } catch (error) {
    console.error(error);
    saveLegacySchedules();
    showToast("Supabase 정리에 실패해 이 기기에 임시 반영했습니다.");
  }
  resetForm();
  render();
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const draft = {
    id: elements.editingTaskId.value || createId(),
    category: elements.taskCategoryInput.value,
    title: elements.taskTitleInput.value.trim(),
    startDate: elements.taskStartDateInput.value,
    endDate: elements.taskEndDateInput.value,
    memo: elements.taskMemoInput.value.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  };

  if (!draft.title || !draft.startDate || !draft.endDate) {
    showToast("업무명과 기간을 입력하세요.");
    return;
  }

  if (draft.endDate < draft.startDate) {
    showToast("마감일은 시작일보다 빠를 수 없습니다.");
    return;
  }

  const existingIndex = state.tasks.findIndex((task) => task.id === draft.id);
  const existingTask = state.tasks[existingIndex];
  if (existingTask) {
    draft.completed = existingTask.completed;
    draft.createdAt = existingTask.createdAt;
  }

  try {
    const savedTask = await upsertTaskInDatabase(draft);
    if (existingIndex >= 0) {
      state.tasks.splice(existingIndex, 1, savedTask);
      showToast("업무를 수정했습니다.");
    } else {
      state.tasks.push(savedTask);
      showToast("업무를 추가했습니다.");
    }
    localStorage.removeItem(TASK_STORAGE_KEY);
  } catch (error) {
    console.error(error);
    if (existingIndex >= 0) {
      state.tasks.splice(existingIndex, 1, draft);
    } else {
      state.tasks.push(draft);
    }
    saveLegacyTasks();
    showToast("Supabase 저장에 실패해 업무를 이 기기에 임시 저장했습니다.");
  }

  state.tasks.sort(sortTasks);
  state.visibleDate = startOfMonth(parseDate(draft.startDate));
  resetTaskForm();
  render();
}

function resetTaskForm() {
  const selectedDate = state.selectedDate || toDateInputValue(new Date());
  elements.taskForm.reset();
  elements.editingTaskId.value = "";
  elements.taskStartDateInput.value = selectedDate;
  elements.taskEndDateInput.value = selectedDate;
  elements.taskFormTitle.textContent = "기간 업무";
  elements.taskSubmitLabel.textContent = "업무 추가";
  elements.cancelTaskEditButton.classList.add("hidden");
}

function renderTasks() {
  elements.showOpenTasksButton.classList.toggle("active", state.taskFilter === "open");
  elements.showAllTasksButton.classList.toggle("active", state.taskFilter === "all");

  const tasks = getFilteredTasks();
  if (!tasks.length) {
    elements.taskList.innerHTML = `<div class="empty-state">표시할 기간 업무가 없습니다.</div>`;
    return;
  }

  elements.taskList.replaceChildren(...tasks.map(createTaskItem));
}

function createTaskItem(task) {
  const node = document.querySelector("#taskTemplate").content.firstElementChild.cloneNode(true);
  node.dataset.category = task.category;
  node.classList.toggle("is-completed", task.completed);
  node.querySelector(".task-category").textContent = getTaskCategoryLabel(task.category);
  node.querySelector(".task-status").textContent = getTaskStatusText(task);
  node.querySelector("h3").textContent = task.title;
  node.querySelector(".task-period").textContent = `${formatDate(task.startDate)} - ${formatDate(task.endDate)}`;

  const memo = node.querySelector(".task-memo");
  memo.textContent = task.memo;
  memo.classList.toggle("hidden", !task.memo);

  const completeButton = node.querySelector(".complete-task");
  completeButton.title = task.completed ? "완료 해제" : "업무 완료";
  completeButton.setAttribute("aria-label", completeButton.title);
  completeButton.addEventListener("click", () => toggleTaskComplete(task.id));
  node.querySelector(".edit-task").addEventListener("click", () => editTask(task.id));
  node.querySelector(".delete-task").addEventListener("click", () => deleteTask(task.id));

  return node;
}

function editTask(id) {
  setEntryMode("task");
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  elements.editingTaskId.value = task.id;
  elements.taskCategoryInput.value = task.category;
  elements.taskTitleInput.value = task.title;
  elements.taskStartDateInput.value = task.startDate;
  elements.taskEndDateInput.value = task.endDate;
  elements.taskMemoInput.value = task.memo;
  elements.taskFormTitle.textContent = "업무 수정";
  elements.taskSubmitLabel.textContent = "수정 저장";
  elements.cancelTaskEditButton.classList.remove("hidden");
  state.visibleDate = startOfMonth(parseDate(task.startDate));
  render();
  elements.taskTitleInput.focus();
}

async function deleteTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const confirmed = window.confirm(`"${task.title}" 업무를 삭제할까요?`);
  if (!confirmed) return;

  state.tasks = state.tasks.filter((item) => item.id !== id);
  try {
    await deleteTaskFromDatabase(id);
    localStorage.removeItem(TASK_STORAGE_KEY);
    showToast("업무를 삭제했습니다.");
  } catch (error) {
    console.error(error);
    saveLegacyTasks();
    showToast("Supabase 삭제에 실패해 업무를 이 기기에 임시 반영했습니다.");
  }

  resetTaskForm();
  render();
}

async function toggleTaskComplete(id) {
  const changedTask = state.tasks.find((task) => task.id === id);
  if (!changedTask) return;

  const updatedTask = { ...changedTask, completed: !changedTask.completed };
  state.tasks = state.tasks.map((task) => (task.id === id ? updatedTask : task));

  try {
    await updateTaskInDatabase(updatedTask);
    localStorage.removeItem(TASK_STORAGE_KEY);
  } catch (error) {
    console.error(error);
    saveLegacyTasks();
    showToast("Supabase 저장에 실패해 업무를 이 기기에 임시 반영했습니다.");
  }

  render();
}

function getFilteredSchedules() {
  return state.schedules.filter((schedule) => {
    const matchesCategory = state.filter === "all" || schedule.category === state.filter;
    const haystack = [schedule.title, schedule.place, schedule.memo, getCategoryLabel(schedule.category)]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesCategory && matchesQuery;
  });
}

function getFilteredTasks() {
  const monthStart = startOfMonth(state.visibleDate);
  const monthEnd = new Date(state.visibleDate.getFullYear(), state.visibleDate.getMonth() + 1, 0);

  return state.tasks
    .filter((task) => {
      const matchesCategory = state.filter === "all" || task.category === state.filter;
      const haystack = [task.title, task.memo, getCategoryLabel(task.category)].join(" ").toLowerCase();
      const matchesQuery = !state.query || haystack.includes(state.query);
      const overlapsMonth = parseDate(task.startDate) <= monthEnd && parseDate(task.endDate) >= monthStart;
      const matchesTaskFilter = state.taskFilter === "all" || !task.completed;
      return matchesCategory && matchesQuery && overlapsMonth && matchesTaskFilter;
    })
    .sort(sortTasks);
}

function exportSchedules() {
  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schedules: state.schedules,
      tasks: state.tasks,
    },
    null,
    2,
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `school-schedule-${toDateInputValue(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("일정을 내보냈습니다.");
}

function importSchedules(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = Array.isArray(parsed) ? parsed : parsed.schedules;
      const importedTasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
      if (!Array.isArray(imported)) throw new Error("Invalid schedule file");

      const normalized = imported
        .map(normalizeSchedule)
        .filter((schedule) => schedule.title && schedule.date && isKnownCategory(schedule.category));
      const normalizedTasks = importedTasks
        .map(normalizeTask)
        .filter((task) => task.title && task.startDate && task.endDate && isKnownCategory(task.category));

      const [savedSchedules, savedTasks] = await Promise.all([
        upsertSchedulesInDatabase(normalized),
        upsertTasksInDatabase(normalizedTasks),
      ]);
      state.schedules = mergeSchedules(state.schedules, savedSchedules);
      state.tasks = mergeTasks(state.tasks, savedTasks);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TASK_STORAGE_KEY);
      render();
      showToast(`${normalized.length}개 일정과 ${normalizedTasks.length}개 업무를 가져왔습니다.`);
    } catch (error) {
      console.error(error);
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = Array.isArray(parsed) ? parsed : parsed.schedules;
        const importedTasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
        const normalized = Array.isArray(imported)
          ? imported
              .map(normalizeSchedule)
              .filter((schedule) => schedule.title && schedule.date && isKnownCategory(schedule.category))
          : [];
        const normalizedTasks = importedTasks
          .map(normalizeTask)
          .filter((task) => task.title && task.startDate && task.endDate && isKnownCategory(task.category));

        if (!normalized.length && !normalizedTasks.length) throw new Error("Invalid schedule file");
        state.schedules = mergeSchedules(state.schedules, normalized);
        state.tasks = mergeTasks(state.tasks, normalizedTasks);
        saveLegacySchedules();
        saveLegacyTasks();
        render();
        showToast("Supabase 가져오기에 실패해 이 기기에 임시 저장했습니다.");
      } catch (fallbackError) {
        showToast("가져올 수 없는 파일입니다.");
      }
    } finally {
      elements.importInput.value = "";
    }
  };
  reader.readAsText(file);
}

function mergeSchedules(current, imported) {
  const byId = new Map(current.map((schedule) => [schedule.id, schedule]));
  imported.forEach((schedule) => byId.set(schedule.id, schedule));
  return Array.from(byId.values()).sort(sortSchedules);
}

function mergeTasks(current, imported) {
  const byId = new Map(current.map((task) => [task.id, task]));
  imported.forEach((task) => byId.set(task.id, task));
  return Array.from(byId.values()).sort(sortTasks);
}

async function loadSchedules() {
  try {
    const databaseSchedules = await readAllSchedulesFromDatabase();
    const normalized = databaseSchedules
      .map(normalizeSchedule)
      .filter((schedule) => schedule.title && schedule.date);

    const legacySchedules = loadLegacySchedules();
    if (!normalized.length && legacySchedules.length) {
      await upsertSchedulesInDatabase(legacySchedules);
      localStorage.removeItem(STORAGE_KEY);
      showToast("기존 저장 일정을 Supabase로 옮겼습니다.");
      return legacySchedules.sort(sortSchedules);
    }

    localStorage.removeItem(STORAGE_KEY);
    return normalized.sort(sortSchedules);
  } catch (error) {
    console.error(error);
    showToast("Supabase에 연결할 수 없어 임시 저장소를 사용합니다.");
    return loadLegacySchedules();
  }
}

function loadLegacySchedules() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSchedule).filter((schedule) => schedule.title && schedule.date).sort(sortSchedules);
  } catch (error) {
    return [];
  }
}

async function loadTasks() {
  try {
    const databaseTasks = await readAllTasksFromDatabase();
    const normalized = databaseTasks
      .map(normalizeTask)
      .filter((task) => task.title && task.startDate && task.endDate);

    const legacyTasks = loadLegacyTasks();
    if (!normalized.length && legacyTasks.length) {
      await upsertTasksInDatabase(legacyTasks);
      localStorage.removeItem(TASK_STORAGE_KEY);
      showToast("기존 저장 업무를 Supabase로 옮겼습니다.");
      return legacyTasks.sort(sortTasks);
    }

    localStorage.removeItem(TASK_STORAGE_KEY);
    return normalized.sort(sortTasks);
  } catch (error) {
    console.error(error);
    showToast("업무 DB에 연결할 수 없어 임시 저장소를 사용합니다.");
    return loadLegacyTasks();
  }
}

function loadLegacyTasks() {
  try {
    const stored = localStorage.getItem(TASK_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTask).filter((task) => task.title && task.startDate && task.endDate).sort(sortTasks);
  } catch (error) {
    return [];
  }
}

async function readAllSchedulesFromDatabase() {
  const rows = await supabaseRequest(`${SUPABASE_TABLE}?select=*&order=date.asc,start_time.asc,title.asc`);
  return rows
    .filter((row) => !isSystemScheduleRow(row) && isOwnedRowForCurrentPerson(row))
    .map(scheduleFromDatabase);
}

async function upsertScheduleInDatabase(schedule) {
  const savedSchedules = await upsertSchedulesInDatabase([schedule]);
  return savedSchedules[0] || normalizeSchedule(schedule);
}

async function updateScheduleInDatabase(schedule) {
  const rows = await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(getDatabaseOwnedId(schedule.id))}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(scheduleToDatabase(schedule)),
  });

  return rows[0] ? scheduleFromDatabase(rows[0]) : normalizeSchedule(schedule);
}

async function upsertSchedulesInDatabase(schedules) {
  const normalized = schedules.map(normalizeSchedule);
  if (!normalized.length) return [];

  const rows = await supabaseRequest(`${SUPABASE_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(normalized.map(scheduleToDatabase)),
  });

  return rows.map(scheduleFromDatabase);
}

async function deleteScheduleFromDatabase(id) {
  await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(getDatabaseOwnedId(id))}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

async function deleteCompletedSchedulesFromDatabase(ids) {
  await Promise.all(ids.map((id) => deleteScheduleFromDatabase(id)));
}

async function readAllTasksFromDatabase() {
  if (taskStorageAdapter === "scheduleRows") return readAllTasksFromScheduleRows();

  try {
    const rows = await supabaseRequest(`${SUPABASE_TASK_TABLE}?select=*&order=end_date.asc,start_date.asc,title.asc`);
    taskStorageAdapter = "workTasks";
    return rows.filter(isOwnedRowForCurrentPerson).map(taskFromDatabase);
  } catch (error) {
    if (!isMissingTaskTableError(error)) throw error;
    taskStorageAdapter = "scheduleRows";
    return readAllTasksFromScheduleRows();
  }
}

async function upsertTaskInDatabase(task) {
  const savedTasks = await upsertTasksInDatabase([task]);
  return savedTasks[0] || normalizeTask(task);
}

async function updateTaskInDatabase(task) {
  if (taskStorageAdapter === "scheduleRows") return updateTaskScheduleRow(task);

  let rows;
  try {
    rows = await supabaseRequest(`${SUPABASE_TASK_TABLE}?id=eq.${encodeURIComponent(getDatabaseOwnedId(task.id))}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(taskToDatabase(task)),
    });
  } catch (error) {
    if (!isMissingTaskTableError(error)) throw error;
    taskStorageAdapter = "scheduleRows";
    return updateTaskScheduleRow(task);
  }

  return rows[0] ? taskFromDatabase(rows[0]) : normalizeTask(task);
}

async function upsertTasksInDatabase(tasks) {
  const normalized = tasks.map(normalizeTask);
  if (!normalized.length) return [];

  if (taskStorageAdapter === "scheduleRows") return upsertTasksAsScheduleRows(normalized);

  try {
    const rows = await supabaseRequest(`${SUPABASE_TASK_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(normalized.map(taskToDatabase)),
    });
    taskStorageAdapter = "workTasks";
    return rows.map(taskFromDatabase);
  } catch (error) {
    if (!isMissingTaskTableError(error)) throw error;
    taskStorageAdapter = "scheduleRows";
    return upsertTasksAsScheduleRows(normalized);
  }
}

async function deleteTaskFromDatabase(id) {
  if (taskStorageAdapter === "scheduleRows") {
    await deleteTaskScheduleRow(id);
    return;
  }

  try {
    await supabaseRequest(`${SUPABASE_TASK_TABLE}?id=eq.${encodeURIComponent(getDatabaseOwnedId(id))}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  } catch (error) {
    if (!isMissingTaskTableError(error)) throw error;
    taskStorageAdapter = "scheduleRows";
    await deleteTaskScheduleRow(id);
  }
}

async function readAllTasksFromScheduleRows() {
  const rows = await supabaseRequest(
    `${SUPABASE_TABLE}?select=*&place=eq.${encodeURIComponent(TASK_ROW_MARKER)}&order=date.asc,title.asc`,
  );
  return rows.filter(isOwnedTaskScheduleRowForCurrentPerson).map(taskFromScheduleRow);
}

async function upsertTasksAsScheduleRows(tasks) {
  const normalized = tasks.map(normalizeTask);
  if (!normalized.length) return [];

  const rows = await supabaseRequest(`${SUPABASE_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(normalized.map(taskToScheduleRow)),
  });

  return rows.map(taskFromScheduleRow);
}

async function updateTaskScheduleRow(task) {
  const rows = await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(getDatabaseTaskId(task.id))}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(taskToScheduleRow(task)),
  });

  return rows[0] ? taskFromScheduleRow(rows[0]) : normalizeTask(task);
}

async function deleteTaskScheduleRow(id) {
  await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(getDatabaseTaskId(id))}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${message}`);
  }

  if (response.status === 204) return [];

  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function isSupabaseConfigured() {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes("YOUR-PROJECT") &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")
  );
}

function scheduleFromDatabase(row) {
  return normalizeSchedule({
    id: getAppOwnedId(row.id),
    category: row.category,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    place: row.place,
    memo: row.memo,
    reminderMinutes: row.reminder_minutes,
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
    end_time: normalized.endTime,
    place: normalized.place,
    memo: normalized.memo,
    reminder_minutes: normalized.reminderMinutes,
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
  const payload = parseTaskRowPayload(row.memo);

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

function parseTaskRowPayload(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed?.marker === TASK_ROW_MARKER ? parsed : {};
  } catch (error) {
    return {};
  }
}

function isTaskScheduleRow(row) {
  return row.place === TASK_ROW_MARKER || isTaskRowId(row.id);
}

function isSystemScheduleRow(row) {
  return isTaskScheduleRow(row) || row.place === HEADER_ROW_MARKER || String(row.id || "").endsWith("header-settings");
}

function isOwnedRowForCurrentPerson(row) {
  const id = String(row.id || "");
  if (isPrimaryPerson()) return !getSecondaryPersonPrefixes().some((prefix) => id.startsWith(prefix));
  return id.startsWith(getCurrentPersonPrefix());
}

function isOwnedTaskScheduleRowForCurrentPerson(row) {
  const id = String(row.id || "");
  if (isPrimaryPerson()) {
    return !getSecondaryPersonPrefixes().some((prefix) => id.startsWith(`${prefix}${TASK_ID_PREFIX}`));
  }
  return id.startsWith(`${getCurrentPersonPrefix()}${TASK_ID_PREFIX}`);
}

function getDatabaseOwnedId(id) {
  const value = String(id || createId());
  const prefix = getCurrentPersonPrefix();
  if (!prefix || value.startsWith(prefix)) return value;
  return `${prefix}${value}`;
}

function getAppOwnedId(id) {
  let value = String(id || createId());
  const prefix = PEOPLE
    .map((person) => getPersonPrefix(person.id))
    .find((candidate) => candidate && value.startsWith(candidate));

  if (prefix) value = value.slice(prefix.length);
  return value;
}

function getDatabaseTaskId(id) {
  const value = getAppTaskId(id);
  return `${getCurrentPersonPrefix()}${TASK_ID_PREFIX}${value}`;
}

function getAppTaskId(id) {
  const value = getAppOwnedId(id);
  return value.startsWith(TASK_ID_PREFIX) ? value.slice(TASK_ID_PREFIX.length) : value;
}

function isTaskRowId(id) {
  const value = String(id || "");
  return value.startsWith(TASK_ID_PREFIX) || PEOPLE.some((person) => {
    const prefix = getPersonPrefix(person.id);
    return Boolean(prefix) && value.startsWith(`${prefix}${TASK_ID_PREFIX}`);
  });
}

function isMissingTaskTableError(error) {
  const message = String(error?.message || error || "");
  return message.includes("PGRST205") || message.includes(`'public.${SUPABASE_TASK_TABLE}'`);
}

function isMissingPageSettingsTableError(error) {
  const message = String(error?.message || error || "");
  return message.includes("PGRST205") || message.includes(`'public.${SUPABASE_PAGE_SETTINGS_TABLE}'`);
}

function getCategoryLabels() {
  return PERSON_CATEGORY_PROFILES[CURRENT_PERSON.id]?.labels || CATEGORY_LABELS;
}

function getCategoryShortLabels() {
  return PERSON_CATEGORY_PROFILES[CURRENT_PERSON.id]?.shortLabels || CATEGORY_SHORT_LABELS;
}

function getTaskCategoryLabels() {
  const profileLabels = PERSON_CATEGORY_PROFILES[CURRENT_PERSON.id]?.taskLabels;
  if (profileLabels) return profileLabels;

  const shortLabels = getCategoryShortLabels();
  return Object.fromEntries(getCategoryOrder().map((category) => [category, `${shortLabels[category]} 업무`]));
}

function getCategoryOrder() {
  return PERSON_CATEGORY_PROFILES[CURRENT_PERSON.id]?.order || ["homeroom", "department", "subject"];
}

function getCategorySelectOrder() {
  return PERSON_CATEGORY_PROFILES[CURRENT_PERSON.id]?.selectOrder || getCategoryOrder();
}

function getDefaultCategory() {
  return PERSON_CATEGORY_PROFILES[CURRENT_PERSON.id]?.defaultCategory || getCategorySelectOrder()[0] || "homeroom";
}

function getCategoryLabel(category) {
  return getCategoryLabels()[category] || CATEGORY_LABELS[category] || "";
}

function getCategoryShortLabel(category) {
  return getCategoryShortLabels()[category] || CATEGORY_SHORT_LABELS[category] || "";
}

function getTaskCategoryLabel(category) {
  return getTaskCategoryLabels()[category] || `${getCategoryShortLabel(category)} 업무`;
}

function isKnownCategory(category) {
  return Boolean(getCategoryLabels()[category] || CATEGORY_LABELS[category]);
}

function getVisibleAgendaFocusDate() {
  if (!state.selectedDate) return "";

  const selectedDate = parseDate(state.selectedDate);
  if (
    selectedDate.getFullYear() !== state.visibleDate.getFullYear() ||
    selectedDate.getMonth() !== state.visibleDate.getMonth()
  ) {
    return "";
  }

  return state.selectedDate;
}

function getCurrentPerson() {
  const fileName = decodeURIComponent(window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  return PEOPLE.find((person) => person.page.toLowerCase() === fileName) || PEOPLE[0];
}

function isPrimaryPerson() {
  return CURRENT_PERSON.id === PRIMARY_PERSON_ID;
}

function getPersonPrefix(personId) {
  return personId === PRIMARY_PERSON_ID ? "" : `${personId}:`;
}

function getCurrentPersonPrefix() {
  return getPersonPrefix(CURRENT_PERSON.id);
}

function getSecondaryPersonPrefixes() {
  return PEOPLE
    .filter((person) => person.id !== PRIMARY_PERSON_ID)
    .map((person) => getPersonPrefix(person.id));
}

function getScopedStorageKey(baseKey) {
  return CURRENT_PERSON?.id === PRIMARY_PERSON_ID ? baseKey : `${baseKey}-${CURRENT_PERSON.id}`;
}

function normalizeSchedule(schedule) {
  return {
    id: typeof schedule.id === "string" ? schedule.id : createId(),
    category: isKnownCategory(schedule.category) ? schedule.category : "homeroom",
    title: String(schedule.title || "").trim(),
    date: String(schedule.date || ""),
    startTime: String(schedule.startTime || ""),
    endTime: String(schedule.endTime || ""),
    place: String(schedule.place || "").trim(),
    memo: String(schedule.memo || "").trim(),
    reminderMinutes: parseReminderValue(schedule.reminderMinutes ?? schedule.reminder_minutes ?? null),
    completed: Boolean(schedule.completed),
    createdAt: schedule.createdAt || new Date().toISOString(),
  };
}

function normalizeTask(task) {
  return {
    id: typeof task.id === "string" ? task.id : createId(),
    category: isKnownCategory(task.category) ? task.category : "homeroom",
    title: String(task.title || "").trim(),
    startDate: String(task.startDate || task.start_date || ""),
    endDate: String(task.endDate || task.end_date || ""),
    memo: String(task.memo || "").trim(),
    completed: Boolean(task.completed),
    createdAt: task.createdAt || task.created_at || new Date().toISOString(),
  };
}

function saveLegacySchedules() {
  const normalized = state.schedules.map(normalizeSchedule).sort(sortSchedules);
  state.schedules = normalized;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

function saveLegacyTasks() {
  const normalized = state.tasks.map(normalizeTask).sort(sortTasks);
  state.tasks = normalized;
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(normalized));
}

function applyInitialScheduleSelection() {
  const scheduleId = new URLSearchParams(window.location.search).get("schedule");
  const schedule = state.schedules.find((item) => item.id === scheduleId);
  if (!schedule) return;

  state.visibleDate = startOfMonth(parseDate(schedule.date));
  state.selectedDate = schedule.date;
  state.view = "list";
  elements.dateInput.value = schedule.date;
}

function sortSchedules(a, b) {
  return (
    a.date.localeCompare(b.date) ||
    (a.startTime || "99:99").localeCompare(b.startTime || "99:99") ||
    a.title.localeCompare(b.title, "ko")
  );
}

function sortAgendaSchedules(a, b, focusDate) {
  if (!focusDate) return sortSchedules(a, b);

  const bucketA = getAgendaDateBucket(a.date, focusDate);
  const bucketB = getAgendaDateBucket(b.date, focusDate);
  if (bucketA !== bucketB) return bucketA - bucketB;

  return sortSchedules(a, b);
}

function getAgendaDateBucket(dateValue, focusDate) {
  if (dateValue === focusDate) return 0;
  return dateValue > focusDate ? 1 : 2;
}

function sortTasks(a, b) {
  return (
    Number(a.completed) - Number(b.completed) ||
    a.endDate.localeCompare(b.endDate) ||
    a.startDate.localeCompare(b.startDate) ||
    a.title.localeCompare(b.title, "ko")
  );
}

function isTaskOverdue(task) {
  return !task.completed && parseDate(task.endDate) < parseDate(toDateInputValue(new Date()));
}

function getTaskStatusText(task) {
  if (task.completed) return "완료";

  const today = parseDate(toDateInputValue(new Date()));
  const startDate = parseDate(task.startDate);
  const endDate = parseDate(task.endDate);

  if (today < startDate) return `${daysBetween(today, startDate)}일 후 시작`;
  if (today > endDate) return `${daysBetween(endDate, today)}일 지연`;
  if (toDateInputValue(today) === task.endDate) return "오늘 마감";
  return `D-${daysBetween(today, endDate)}`;
}

function groupByDate(schedules) {
  return schedules.reduce((groups, schedule) => {
    if (!groups[schedule.date]) groups[schedule.date] = [];
    groups[schedule.date].push(schedule);
    return groups;
  }, {});
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseDate(value));
}

function formatTimeRange(schedule) {
  if (schedule.startTime && schedule.endTime) return `${schedule.startTime} - ${schedule.endTime}`;
  if (schedule.startTime) return schedule.startTime;
  return "시간 미정";
}

function parseReminderValue(value) {
  if (value === null || value === undefined || value === "" || value === "none") return null;
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return Math.round(minutes);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start, end) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / oneDay);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `schedule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 180);
  }, 2200);
}
