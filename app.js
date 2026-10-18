const API_URL =
  "https://script.google.com/macros/s/AKfycbzpoHExr9Oi82mIoxGQkN2MJjWTpPJjbEbqY-6w1FOsdpMWXyTvxzoCroCuURrI3mgH/exec";

/* =====================================================
   GLOBAL STATE
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
    if (!response.ok) throw new Error(`Lỗi kết nối server (${response.status})`);

    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message || "Lỗi tải dữ liệu");

    appData.config = data.config || [];
    appData.seats = data.seats || {};

    renderSeatMap();
    showStatus("Đã cập nhật dữ liệu.", "success");
    setTimeout(hideStatus, 1500);

  } catch (error) {
    console.error(error);
    showStatus("❌ " + error.message, "error");
  }
}

/* =====================================================
   RENDER USER SEAT MAP
===================================================== */
function renderSeatMap() {
  const container = document.getElementById("sections");
  if (!container) return;
  container.innerHTML = "";

  const sections = getSections();

  sections.forEach(section => {
    const sectionEl = document.createElement("div");
    sectionEl.className = "section";

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = section.name;
    sectionEl.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "seat-grid";
    grid.style.gridTemplateColumns = `repeat(${section.maxCol}, 65px)`;

    section.items.forEach(item => {
      const seat = document.createElement("div");
      const occupied = appData.seats[item.id];

      seat.className = occupied ? "seat occupied" : "seat available";
      seat.style.gridRow = item.row;
      seat.style.gridColumn = item.col;

      seat.innerHTML = `
        <div class="seat-number">${escapeHtml(item.label)}</div>
        <div class="seat-name">${occupied ? escapeHtml(occupied.name) : "Trống"}</div>
      `;

      seat.onclick = () => handleSeatClick(item);
      grid.appendChild(seat);
    });

    sectionEl.appendChild(grid);
    container.appendChild(sectionEl);
  });
}

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
      `Ghế ${item.label} đang được "${occupied.name}" sử dụng.\n\nHủy ghế này?`
    );
    if (confirmCancel) await cancelSeat(item.id);
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
    showStatus("🎉 Đặt ghế thành công!", "success");
    setTimeout(hideStatus, 2000);

  } catch (error) {
    showStatus("❌ " + error.message, "error");
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
    showStatus("🗑️ Đã hủy ghế.", "success");
    setTimeout(hideStatus, 1500);

  } catch (error) {
    showStatus("❌ " + error.message, "error");
  }
}

/* =====================================================
   ADMIN LOGIN & PANEL MODALS
===================================================== */
function openAdminLogin() {
  document.getElementById("adminPassword").value = "";
  document.getElementById("loginModal").classList.add("show");
}

function closeAdminLogin() {
  document.getElementById("loginModal").classList.remove("show");
}

async function loginAdmin() {
  const password = document.getElementById("adminPassword").value.trim();
  if (!password) {
    alert("Vui lòng nhập mật khẩu.");
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "loginAdmin",
        password: password
      })
    });

    const data = await response.json();
    if (data.status !== "success") {
      alert("Sai mật khẩu admin.");
      return;
    }

    adminPassword = password;
    closeAdminLogin();
    openAdminPanel();

  } catch (error) {
    console.error(error);
    alert("Không thể kết nối server.");
  }
}

function openAdminPanel() {
  const sections = getSections();
  if (sections.length > 0 && !selectedSectionId) {
    selectedSectionId = sections[0].id;
  }

  renderAdminSections();
  renderSectionEditor();
  document.getElementById("adminModal").classList.add("show");
}

function closeAdminPanel() {
  document.getElementById("adminModal").classList.remove("show");
}

/* =====================================================
   ADMIN EDITOR
===================================================== */
function renderAdminSections() {
  const container = document.getElementById("adminSections");
  if (!container) return;
  container.innerHTML = "";

  getSections().forEach(section => {
    const div = document.createElement("div");
    div.className = `admin-section-item ${section.id === selectedSectionId ? "active" : ""}`;

    div.innerHTML = `
      <strong>${escapeHtml(section.name)}</strong><br>
      <small style="color:#666">${section.items.length} ghế</small>
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
    editor.innerHTML = `<div style="text-align:center; padding:40px; color:#888">Chọn một khu vực ở danh sách bên trái để chỉnh sửa.</div>`;
    return;
  }

  const section = getSections().find(s => s.id === selectedSectionId);
  if (!section) return;

  const maxRow = Math.max(...section.items.map(item => Number(item.row) || 1), 1);

  editor.innerHTML = `
    <h3>Chỉnh sửa: ${escapeHtml(section.name)}</h3>
    
    <div class="form-group">
      <label>Tên khu vực</label>
      <input id="editSectionName" value="${escapeAttribute(section.name)}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Số hàng</label>
        <input id="editRows" type="number" min="1" value="${maxRow}">
      </div>
      <div class="form-group">
        <label>Số cột</label>
        <input id="editCols" type="number" min="1" value="${section.maxCol}">
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom: 15px;">
      <button class="btn-primary" onclick="generateGrid()">⚙️ Tạo lại lưới ghế</button>
      <button class="btn-danger" onclick="deleteSection()">🗑️ Xóa khu vực</button>
    </div>

    <div class="preview-box">
      <strong>Preview (Bấm vào ghế để đổi tên nhãn):</strong>
      <div id="gridPreview"></div>
    </div>
  `;

  renderGridPreview(section);
}

function generateGrid() {
  const section = getSections().find(s => s.id === selectedSectionId);
  if (!section) return;

  const name = document.getElementById("editSectionName").value.trim();
  const rows = Number(document.getElementById("editRows").value);
  const cols = Number(document.getElementById("editCols").value);

  if (!name || rows < 1 || cols < 1) {
    alert("Vui lòng nhập đầy đủ thông tin hợp lệ.");
    return;
  }

  const newItems = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const old = section.items.find(
        item => Number(item.row) === r && Number(item.col) === c
      );

      newItems.push({
        id: old?.id || `${section.id}_R${r}C${c}`,
        section_id: section.id,
        section_name: name,
        type: "seat",
        row: r,
        col: c,
        label: old?.label || `${numberToLetter(r)}${c}`,
        enabled: true
      });
    }
  }

  appData.config = appData.config.filter(item => item.section_id !== section.id);
  appData.config.push(...newItems);

  renderAdminSections();
  renderSectionEditor();
}

function addSection() {
  const newId = "SEC_" + Date.now();
  appData.config.push({
    id: `${newId}_R1C1`,
    section_id: newId,
    section_name: "Khu vực mới",
    type: "seat",
    row: 1,
    col: 1,
    label: "A1",
    enabled: true
  });

  selectedSectionId = newId;
  renderAdminSections();
  renderSectionEditor();
}

function deleteSection() {
  if (!selectedSectionId) return;

  const section = getSections().find(s => s.id === selectedSectionId);
  if (!section) return;

  if (!confirm(`Bạn có muốn xóa khu vực "${section.name}" không?`)) return;

  appData.config = appData.config.filter(item => item.section_id !== selectedSectionId);
  selectedSectionId = null;

  renderAdminSections();
  renderSectionEditor();
}

/* =====================================================
   PREVIEW & EDIT INDIVIDUAL SEAT LABELS (FIXED)
===================================================== */
function renderGridPreview(section) {
  const preview = document.getElementById("gridPreview");
  if (!preview) return;

  let gridHtml = `<div class="preview-grid" style="grid-template-columns: repeat(${section.maxCol}, 55px);">`;

  section.items.forEach(item => {
    // Lấy label sạch, nếu rỗng thì tạo mặc định
    let cleanLabel = item.label || `${numberToLetter(item.row)}${item.col}`;
    
    // Nếu nhãn đang bị dính chuỗi code lỗi thì dọn sạch
    if (cleanLabel.includes("escapeHtml") || cleanLabel.includes("\${")) {
      cleanLabel = `${numberToLetter(item.row)}${item.col}`;
      item.label = cleanLabel; // Cập nhật lại vào bộ nhớ
    }

    gridHtml += `
      <button 
        type="button"
        class="preview-seat" 
        style="grid-column: ${item.col}; grid-row: ${item.row};"
        onclick="editSeatLabel('${item.id}')"
        title="Bấm để đổi tên ghế"
      >
        ${escapeHtml(cleanLabel)}
      </button>
    `;
  });

  gridHtml += `</div>`;
  preview.innerHTML = gridHtml;
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

async function saveAdminConfig() {
  if (!adminPassword) {
    alert("Phiên admin đã hết hạn.");
    return;
  }

  showStatus("Đang lưu cấu trúc...", "info");

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
    if (data.status !== "success") throw new Error(data.message || "Lỗi lưu cấu trúc");

    alert("🎉 Đã lưu cấu trúc sơ đồ thành công!");
    closeAdminPanel();
    await loadData();

  } catch (error) {
    alert(error.message || "Không thể lưu.");
    showStatus("❌ " + error.message, "error");
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
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  el.className = `status show ${type}`;
}

function hideStatus() {
  const el = document.getElementById("status");
  if (el) el.className = "status";
}
