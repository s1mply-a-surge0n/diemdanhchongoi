const API_URL =
  "https://script.google.com/macros/s/AKfycbzpoHExr9Oi82mIoxGQkN2MJjWTpPJjbEbqY-6w1FOsdpMWXyTvxzoCroCuURrI3mgH/exec";

/* =====================================================
   GLOBAL DATA & STATE
===================================================== */
let appData = {
  config: [],
  seats: {}
};

let adminPassword = "";
let selectedSectionId = null;

/* =====================================================
   INIT
===================================================== */
document.addEventListener("DOMContentLoaded", loadData);

/* =====================================================
   LOAD DATA
===================================================== */
async function loadData() {
  showStatus("Đang tải dữ liệu...", "info");

  try {
    const response = await fetch(`${API_URL}?action=getData`);

    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ (${response.status})`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Không tải được dữ liệu.");
    }

    appData.config = data.config || [];
    appData.seats = data.seats || {};

    renderSeatMap();
    hideStatus();

  } catch (error) {
    console.error(error);
    showStatus(error.message || "Không thể kết nối Google Sheet.", "danger");
  }
}

/* =====================================================
   RENDER SEAT MAP (USER VIEW)
===================================================== */
function renderSeatMap() {
  const container = document.getElementById("sectionsContainer");
  if (!container) return;

  container.innerHTML = "";
  const sections = getSections();

  sections.forEach(section => {
    const card = document.createElement("div");
    card.className = "section-card mb-4";

    const title = document.createElement("div");
    title.className = "section-title fw-bold fs-5 mb-2";
    title.textContent = section.name;
    card.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "seat-grid";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${section.maxCol}, 60px)`;
    grid.style.gap = "8px";

    section.items.forEach(item => {
      const seat = document.createElement("div");
      const occupied = appData.seats[item.id];

      seat.className = occupied ? "seat occupied" : "seat available";
      seat.style.gridColumn = item.col;
      seat.style.gridRow = item.row;

      seat.innerHTML = `
        <div class="seat-number fw-bold">${escapeHtml(item.label)}</div>
        <div class="seat-name small">${occupied ? escapeHtml(occupied.name) : "Trống"}</div>
      `;

      seat.onclick = () => handleSeatClick(item);
      grid.appendChild(seat);
    });

    card.appendChild(grid);
    container.appendChild(card);
  });
}

/* =====================================================
   GROUP SECTIONS HELPER
===================================================== */
function getSections() {
  const map = {};

  appData.config.forEach(item => {
    const secId = item.section_id || "DEFAULT";

    if (!map[secId]) {
      map[secId] = {
        id: secId,
        name: item.section_name || secId,
        items: [],
        maxCol: 1
      };
    }

    map[secId].items.push(item);
    map[secId].maxCol = Math.max(map[secId].maxCol, Number(item.col) || 1);
  });

  return Object.values(map);
}

/* =====================================================
   BOOK / CANCEL SEAT
===================================================== */
async function handleSeatClick(item) {
  const occupied = appData.seats[item.id];

  if (occupied) {
    const confirmCancel = confirm(
      `Ghế ${item.label} đang được chọn bởi "${occupied.name}".\n\nHủy ghế này?`
    );
    if (confirmCancel) {
      await cancelSeat(item.id);
    }
    return;
  }

  const name = prompt(`Bạn đang chọn ghế ${item.label}.\n\nNhập tên của bạn:`);
  if (!name || !name.trim()) return;

  await bookSeat(item.id, name.trim());
}

async function bookSeat(seatId, name) {
  showStatus("Đang đăng ký ghế...", "info");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "book", seatId, name })
    });

    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message);

    await loadData();
    showStatus("Đã đặt ghế thành công!", "success");
    setTimeout(hideStatus, 2000);

  } catch (error) {
    showStatus(error.message || "Không thể đặt ghế.", "danger");
  }
}

async function cancelSeat(seatId) {
  showStatus("Đang hủy ghế...", "info");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "cancel", seatId })
    });

    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message);

    await loadData();
    showStatus("Đã hủy ghế.", "success");
    setTimeout(hideStatus, 2000);

  } catch (error) {
    showStatus(error.message || "Không thể hủy ghế.", "danger");
  }
}

/* =====================================================
   ADMIN AUTHENTICATION
===================================================== */
function openAdminLogin() {
  const passwordInput = document.getElementById("adminPassword");
  if (passwordInput) passwordInput.value = "";

  const modalEl = document.getElementById("adminLoginModal");
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

async function loginAdmin() {
  const passwordInput = document.getElementById("adminPassword");
  const password = passwordInput ? passwordInput.value.trim() : "";

  if (!password) {
    alert("Vui lòng nhập mật khẩu.");
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "saveConfig",
        adminPassword: password,
        config: appData.config
      })
    });

    const data = await response.json();

    if (data.status !== "success") {
      alert("Sai mật khẩu admin.");
      return;
    }

    adminPassword = password;

    const modalEl = document.getElementById("adminLoginModal");
    if (modalEl) {
      bootstrap.Modal.getInstance(modalEl)?.hide();
    }

    openAdminPanel();

  } catch (error) {
    console.error(error);
    alert("Không thể xác thực mật khẩu admin.");
  }
}

/* =====================================================
   ADMIN PANEL & SECTION EDITOR
===================================================== */
function openAdminPanel() {
  const sections = getSections();
  if (sections.length > 0 && !selectedSectionId) {
    selectedSectionId = sections[0].id;
  }

  renderAdminSections();
  renderSectionEditor();

  const modalEl = document.getElementById("adminModal");
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function renderAdminSections() {
  const container = document.getElementById("adminSections");
  if (!container) return;

  container.innerHTML = "";

  getSections().forEach(section => {
    const div = document.createElement("div");
    div.className = `admin-section-item p-2 mb-2 rounded border cursor-pointer ${
      section.id === selectedSectionId ? "bg-primary text-white" : "bg-light text-dark"
    }`;

    div.innerHTML = `
      <strong>${escapeHtml(section.name)}</strong><br>
      <small>${section.items.length} ghế</small>
    `;

    div.onclick = () => {
      selectedSectionId = section.id;
      renderAdminSections();
      renderSectionEditor();
    };

    container.appendChild(div);
  });
}

function renderSectionEditor() {
  const editor = document.getElementById("sectionEditor");
  if (!editor) return;

  if (!selectedSectionId) {
    editor.innerHTML = `
      <div class="text-muted text-center py-5">
        Chọn hoặc tạo một khu vực để bắt đầu chỉnh sửa.
      </div>
    `;
    return;
  }

  const section = getSections().find(s => s.id === selectedSectionId);
  if (!section) return;

  const maxRow = getMaxRow(section);

  editor.innerHTML = `
    <div class="admin-editor p-3 border rounded">
      <h5 class="mb-3">Chỉnh sửa: ${escapeHtml(section.name)}</h5>
      <hr>

      <div class="mb-3">
        <label class="form-label fw-bold">Tên khu vực</label>
        <input id="editSectionName" class="form-control" value="${escapeAttribute(section.name)}">
      </div>

      <div class="row g-2 mb-3">
        <div class="col-md-6">
          <label class="form-label fw-bold">Số hàng</label>
          <input id="editRows" type="number" min="1" class="form-control" value="${maxRow}">
        </div>
        <div class="col-md-6">
          <label class="form-label fw-bold">Số cột</label>
          <input id="editCols" type="number" min="1" class="form-control" value="${section.maxCol}">
        </div>
      </div>

      <div class="d-flex gap-2 mb-3">
        <button class="btn btn-primary" onclick="generateGrid()">⚙️ Tạo lại Lưới ghế</button>
        <button class="btn btn-outline-danger" onclick="deleteSection()">🗑️ Xóa khu vực</button>
      </div>

      <div id="gridPreview" class="admin-preview mt-4"></div>
    </div>
  `;

  renderGridPreview(section);
}

function getMaxRow(section) {
  return Math.max(...section.items.map(item => Number(item.row) || 1), 1);
}

/* =====================================================
   GENERATE / EDIT GRID
===================================================== */
function generateGrid() {
  const section = getSections().find(s => s.id === selectedSectionId);
  if (!section) return;

  const nameInput = document.getElementById("editSectionName");
  const rowsInput = document.getElementById("editRows");
  const colsInput = document.getElementById("editCols");

  const name = nameInput ? nameInput.value.trim() : section.name;
  const rows = Number(rowsInput ? rowsInput.value : 1);
  const cols = Number(colsInput ? colsInput.value : 1);

  if (!name || rows < 1 || cols < 1) {
    alert("Vui lòng nhập đúng tên, số hàng và số cột!");
    return;
  }

  const newItems = [];

  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      const old = section.items.find(
        item => Number(item.row) === row && Number(item.col) === col
      );

      newItems.push({
        id: old?.id || `${section.id}_R${row}C${col}`,
        section_id: section.id,
        section_name: name,
        type: "seat",
        row: row,
        col: col,
        label: old?.label || `${numberToLetter(row)}${col}`,
        enabled: true
      });
    }
  }

  // Loại bỏ các ghế thuộc khu vực cũ và cập nhật ghế mới
  appData.config = appData.config.filter(item => item.section_id !== section.id);
  appData.config.push(...newItems);

  renderAdminSections();
  renderSectionEditor();
}

/* =====================================================
   ADD / DELETE SECTION
===================================================== */
function addSection() {
  const newSecId = "SEC_" + Date.now();
  const defaultName = "Khu vực mới";

  appData.config.push({
    id: `${newSecId}_R1C1`,
    section_id: newSecId,
    section_name: defaultName,
    type: "seat",
    row: 1,
    col: 1,
    label: "A1",
    enabled: true
  });

  selectedSectionId = newSecId;

  renderAdminSections();
  renderSectionEditor();
}

function deleteSection() {
  if (!selectedSectionId) return;

  const section = getSections().find(s => s.id === selectedSectionId);
  if (!section) return;

  if (!confirm(`Bạn có chắc muốn xóa toàn bộ khu vực "${section.name}"?`)) {
    return;
  }

  appData.config = appData.config.filter(item => item.section_id !== selectedSectionId);
  selectedSectionId = null;

  renderAdminSections();
  renderSectionEditor();
}

/* =====================================================
   PREVIEW & EDIT INDIVIDUAL SEAT LABELS
===================================================== */
function renderGridPreview(section) {
  const preview = document.getElementById("gridPreview");
  if (!preview) return;

  preview.innerHTML = `
    <h6 class="fw-bold mb-2">Xem trước (Bấm vào ghế để đổi tên nhãn):</h6>
    <div class="preview-grid" style="display: grid; grid-template-columns: repeat(${section.maxCol}, 55px); gap: 6px;">
      ${section.items
        .map(
          item => `
        <button 
          type="button"
          class="btn btn-sm btn-outline-secondary preview-seat text-truncate" 
          style="grid-column: ${item.col}; grid-row:${item.row}; height: 40px;"
          onclick="editSeatLabel('\${item.id}')"
          title="Bấm để đổi tên ghế"
        >
          \${escapeHtml(item.label)}
        </button>
      `
        )
        .join("")}
    </div>
  `;
}

function editSeatLabel(seatId) {
  const seat = appData.config.find(item => item.id === seatId);
  if (!seat) return;

  const newLabel = prompt("Nhập tên nhãn ghế mới:", seat.label);
  if (newLabel && newLabel.trim()) {
    seat.label = newLabel.trim();
    renderSectionEditor();
  }
}

/* =====================================================
   SAVE LAYOUT TO GOOGLE SHEETS
===================================================== */
async function saveLayout() {
  if (!adminPassword) {
    alert("Phiên admin đã hết hạn, vui lòng đăng nhập lại.");
    return;
  }

  showStatus("Đang lưu cấu trúc lên máy chủ...", "info");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "saveConfig",
        adminPassword: adminPassword,
        config: appData.config
      })
    });

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Không thể lưu cấu trúc.");
    }

    alert("🎉 Đã lưu cấu trúc phòng thành công!");
    await loadData();

    const modalEl = document.getElementById("adminModal");
    if (modalEl) {
      bootstrap.Modal.getInstance(modalEl)?.hide();
    }

  } catch (error) {
    alert(error.message || "Lỗi khi lưu cấu trúc.");
    showStatus("❌ " + error.message, "danger");
  }
}

/* =====================================================
   UTILITIES
===================================================== */
function numberToLetter(number) {
  let result = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function showStatus(message, type) {
  const el = document.getElementById("statusMsg");
  if (!el) return;

  el.className = `alert alert-${type} text-center my-2`;
  el.textContent = message;
  el.classList.remove("d-none");
}

function hideStatus() {
  const el = document.getElementById("statusMsg");
  if (el) el.classList.add("d-none");
}
