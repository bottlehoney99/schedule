const STORAGE_KEY = "personal-school-schedule-v1";

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

const state = {
  schedules: loadSchedules(),
  visibleDate: startOfMonth(new Date()),
  selectedDate: toDateInputValue(new Date()),
  filter: "all",
  query: "",
  view: "calendar",
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
  template: document.querySelector("#eventTemplate"),
};

init();

function init() {
  elements.dateInput.value = state.selectedDate;
  bindEvents();
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
}

function handleSubmit(event) {
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
  if (existingIndex >= 0) {
    draft.completed = state.schedules[existingIndex].completed;
    draft.createdAt = state.schedules[existingIndex].createdAt;
    state.schedules.splice(existingIndex, 1, draft);
    showToast("일정을 수정했습니다.");
  } else {
    state.schedules.push(draft);
    showToast("일정을 추가했습니다.");
  }

  state.visibleDate = startOfMonth(parseDate(draft.date));
  state.selectedDate = draft.date;
  persist();
  resetForm();
  render();
}

function resetForm() {
  const selectedDate = state.selectedDate || toDateInputValue(new Date());
  elements.scheduleForm.reset();
  elements.editingId.value = "";
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
  elements.dateInput.value = state.selectedDate;
  render();
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
}

function renderToolbar() {
  elements.monthLabel.textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(state.visibleDate);

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
    ["전체", state.schedules.length],
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
          <span>${formatDate(schedule.date)} · ${CATEGORY_SHORT_LABELS[schedule.category]}${schedule.startTime ? ` · ${schedule.startTime}` : ""}</span>
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
      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.classList.toggle("is-muted", date.getMonth() !== state.visibleDate.getMonth());
      cell.classList.toggle("is-today", dateValue === todayValue);
      cell.classList.toggle("is-selected", dateValue === state.selectedDate);

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
      daySchedules.slice(0, 4).forEach((schedule) => {
        const eventButton = document.createElement("button");
        eventButton.type = "button";
        eventButton.className = `day-event ${schedule.category}`;
        eventButton.innerHTML = `
          <span class="dot ${schedule.category}"></span>
          <span>
            <strong>${escapeHtml(schedule.title)}</strong>
            <span>${schedule.startTime || CATEGORY_SHORT_LABELS[schedule.category]}</span>
          </span>
        `;
        eventButton.addEventListener("click", () => editSchedule(schedule.id));
        events.append(eventButton);
      });

      if (daySchedules.length > 4) {
        const more = document.createElement("p");
        more.className = "more-count";
        more.textContent = `+${daySchedules.length - 4}개 더`;
        events.append(more);
      }

      cell.append(button, events);
      return cell;
    }),
  );
}

function renderAgenda() {
  const month = state.visibleDate.getMonth();
  const year = state.visibleDate.getFullYear();
  const schedules = getFilteredSchedules()
    .filter((schedule) => {
      const date = parseDate(schedule.date);
      return date.getFullYear() === year && date.getMonth() === month;
    })
    .sort(sortSchedules);

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

function createEventItem(schedule) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  node.dataset.category = schedule.category;
  node.classList.toggle("is-completed", schedule.completed);
  node.querySelector(".event-category").textContent = CATEGORY_LABELS[schedule.category];
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

function deleteSchedule(id) {
  const schedule = state.schedules.find((item) => item.id === id);
  if (!schedule) return;

  const confirmed = window.confirm(`"${schedule.title}" 일정을 삭제할까요?`);
  if (!confirmed) return;

  state.schedules = state.schedules.filter((item) => item.id !== id);
  persist();
  resetForm();
  render();
  showToast("일정을 삭제했습니다.");
}

function toggleComplete(id) {
  state.schedules = state.schedules.map((schedule) =>
    schedule.id === id ? { ...schedule, completed: !schedule.completed } : schedule,
  );
  persist();
  render();
}

function clearCompleted() {
  const completedCount = state.schedules.filter((schedule) => schedule.completed).length;
  if (!completedCount) {
    showToast("정리할 완료 일정이 없습니다.");
    return;
  }

  const confirmed = window.confirm(`완료된 일정 ${completedCount}개를 정리할까요?`);
  if (!confirmed) return;

  state.schedules = state.schedules.filter((schedule) => !schedule.completed);
  persist();
  resetForm();
  render();
  showToast("완료 일정을 정리했습니다.");
}

function getFilteredSchedules() {
  return state.schedules.filter((schedule) => {
    const matchesCategory = state.filter === "all" || schedule.category === state.filter;
    const haystack = [schedule.title, schedule.place, schedule.memo, CATEGORY_LABELS[schedule.category]]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesCategory && matchesQuery;
  });
}

function exportSchedules() {
  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schedules: state.schedules,
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
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = Array.isArray(parsed) ? parsed : parsed.schedules;
      if (!Array.isArray(imported)) throw new Error("Invalid schedule file");

      const normalized = imported
        .map(normalizeSchedule)
        .filter((schedule) => schedule.title && schedule.date && CATEGORY_LABELS[schedule.category]);

      state.schedules = mergeSchedules(state.schedules, normalized);
      persist();
      render();
      showToast(`${normalized.length}개 일정을 가져왔습니다.`);
    } catch (error) {
      showToast("가져올 수 없는 파일입니다.");
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

function loadSchedules() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSchedule).filter((schedule) => schedule.title && schedule.date);
  } catch (error) {
    return [];
  }
}

function normalizeSchedule(schedule) {
  return {
    id: typeof schedule.id === "string" ? schedule.id : createId(),
    category: CATEGORY_LABELS[schedule.category] ? schedule.category : "homeroom",
    title: String(schedule.title || "").trim(),
    date: String(schedule.date || ""),
    startTime: String(schedule.startTime || ""),
    endTime: String(schedule.endTime || ""),
    place: String(schedule.place || "").trim(),
    memo: String(schedule.memo || "").trim(),
    completed: Boolean(schedule.completed),
    createdAt: schedule.createdAt || new Date().toISOString(),
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.schedules));
}

function sortSchedules(a, b) {
  return (
    a.date.localeCompare(b.date) ||
    (a.startTime || "99:99").localeCompare(b.startTime || "99:99") ||
    a.title.localeCompare(b.title, "ko")
  );
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

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
