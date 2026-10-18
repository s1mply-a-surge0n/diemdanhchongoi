const API_URL =
  "https://script.google.com/macros/s/AKfycbzpoHExr9Oi82mIoxGQkN2MJjWTpPJjbEbqY-6w1FOsdpMWXyTvxzoCroCuURrI3mgH/exec";

/* =====================================================
   GLOBAL DATA
===================================================== */
let appData = {
  config: [],
  seats: {}
};

let adminPassword = "";

/* =====================================================
   INIT
===================================================== */
document.addEventListener("DOMContentLoaded", loadData);

/* =====================================================
   LOAD DATA & SELF-HEALING
===================================================== */
async function loadData() {
  showStatus("Đang tải dữ liệu...", "info");

  try {
    const response = await fetch(`${API_URL}?action=getData`);
    if (!response.ok) throw new Error(`Lỗi kết nối máy chủ (${response.status})`);

    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message || "Không tải được dữ liệu.");

    // Tự động dọn sạch nhãn ghế nếu dữ liệu trên Google Sheet bị dính chữ code lỗi
    appData.config = (data.config || []).map(item => {
      let label = String(item.label || "").trim();
      if (label.includes("\${") || label.includes("escapeHtml") || !label) {
        label = `${numberToLetter(item.row || 1)}${item.col || 1}`;
      }
      return { ...item, label };
    });

    appData.seats = data.seats || {};

    renderSeats();
    showStatus("Đã cập nhật dữ liệu.", "success");
    setTimeout(hideStatus, 1500);

  } catch (error) {
    console.error(error);
    showStatus("❌ " + error.message, "error");
  }
}

/* =====================================================
   RENDER SEATS (USER VIEW)
===================================================== */
function renderSeats() {
  const container = document.getElementById("sections");
  if (!container) return;
  container.innerHTML = "";

  const sections = groupSections(appData.config);

  sections.forEach(section => {
    const sectionElement = document.createElement("div");
    sectionElement.className = "section";

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = section.name;
    sectionElement.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "seat-grid";

    const maxCol = Math.max(
      ...section.seats.map(seat => Number(seat.col) || 1),
      1
    );
    grid.style.gridTemplateColumns = `repeat(${maxCol}, 1fr)`;

    const seats = [...section.seats].sort((a, b) => {
      const rowA = Number(a.row) || 0;
      const rowB = Number(b.row) || 0;
      const colA = Number(a.col) || 0;
      const colB = Number(b.col) || 0;

      if (rowA !== rowB) return rowA - rowB;
      return colA - colB;
    });

    seats.forEach(seat => {
      const seatElement = document.createElement("div");
      seatElement.className = "seat";

      if (seat.row && seat.col) {
        seatElement.style.gridRow = seat.row;
        seatElement.style.gridColumn = seat.col;
      }

      const booking = appData.seats[seat.id];
      if (booking && booking.name) {
        seatElement.classList.add("occupied");
        seatElement.title = `Ghế ${seat.label} - Người đặt: ${booking.name}`; // Tooltip rê chuột hiện tên đầy đủ
      } else {
        seatElement.classList.add("available");
        seatElement.title = `Ghế ${seat.label} (Trống)`;
      }

      const number = document.createElement("div");
      number.className = "seat-number";
      number.textContent = seat.label;

      const name = document.createElement("div");
      name.className = "seat-name";
      name.textContent = (booking && booking.name) ? booking.name : "Trống";

      seatElement.appendChild(number);
      seatElement.appendChild(name);

      seatElement.onclick = () => handleSeatClick(seat);
      grid.appendChild(seatElement);
    });

    sectionElement.appendChild(grid);
    container.appendChild(sectionElement);
  });
}

function groupSections(config) {
  const map = {};
  config
    .filter(item => item.type === "seat")
    .forEach(seat => {
      const sectionId = seat.section_id || "DEFAULT";
      if (!map[sectionId]) {
        map[sectionId] = {
          id: sectionId,
          name: seat.section_name || sectionId,
          seats: []
        };
      }
      map[sectionId].seats.push(seat);
    });
  return Object.values(map);
}

/* =====================================================
   BOOK / CANCEL SEAT
===================================================== */
function handleSeatClick(seat) {
  const booking = appData.seats[seat.id];

  if (booking && booking.name) {
    const shouldCancel = confirm(
      `Ghế ${seat.label} đang được "${booking.name}" sử dụng.\n\nBạn có muốn hủy ghế này không?`
    );
    if (shouldCancel) cancelSeat(seat.id);
    return;
  }

  const name = prompt(`Bạn đang chọn ghế ${seat.label}.\n\nNhập tên của bạn:`);
  if (!name || !name.trim()) return;

  bookSeat(seat.id, name.trim());
}

async function bookSeat(seatId, name) {
  showStatus("Đang đăng ký ghế...", "info");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "book", seatId, name })
    });

    if (!response.ok) throw new Error(`Lỗi kết nối (${response.status})`);
    const data = await response.json();

    if (data.status !== "success") throw new Error(data.message || "Không thể đặt ghế.");

    await loadData();
    showStatus("🎉 Đã đặt ghế thành công!", "success");
    setTimeout(hideStatus, 2000);

  } catch (error) {
    console.error(error);
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

    if (!response.ok) throw new Error(`Lỗi kết nối (${response.status})`);
    const data = await response.json();

    if (data.status !== "success") throw new Error(data.message || "Không thể hủy ghế.");

    await loadData();
    showStatus("🗑️ Đã hủy ghế.", "success");
    setTimeout(hideStatus, 1500);

  } catch (error) {
    console.error(error);
    showStatus("❌ " + error.message, "error");
  }
}

/* =====================================================
   ADMIN LOGIN & MODAL CONTROLS
===================================================== */
function openAdminLogin() {
  const pwdInput = document.getElementById("adminPassword");
  if (pwdInput) pwdInput.value = "";
  document.getElementById("loginModal").classList.add("show");
}

function closeAdminLogin() {
  document.getElementById("loginModal").classList.remove("show");
}

async function loginAdmin() {
  const pwdInput = document.getElementById("adminPassword");
  const password = pwdInput ? pwdInput.value.trim() : "";

  if (!password) {
    alert("Vui lòng nhập mật khẩu.");
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "loginAdmin", password })
    });

    if (!response.ok) throw new Error(`Lỗi kết nối (${response.status})`);
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
    alert("Không thể kết nối máy chủ.");
  }
}

function openAdminPanel() {
  renderAdmin();
  document.getElementById("adminModal").classList.add("show");
}

function closeAdminPanel() {
  document.getElementById("adminModal").classList.remove("show");
}

/* =====================================================
   ADMIN RENDER & GRID GENERATOR
===================================================== */
function renderAdmin() {
  const container = document.getElementById("adminSections");
  if (!container) return;
  container.innerHTML = "";

  const sections = groupSections(appData.config);

  if (sections.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 20px;">
        <p>Chưa có khu vực nào.</p>
        <button class="btn-primary" onclick="addNewSection()">+ Tạo khu vực mới</button>
      </div>
    `;
    return;
  }

  // Nút tạo thêm khu vực ở trên cùng
  const topBar = document.createElement("div");
  topBar.style.marginBottom = "15px";
  topBar.innerHTML = `<button class="btn-primary" onclick="addNewSection()">+ Tạo khu vực mới</button>`;
  container.appendChild(topBar);

  sections.forEach(section => {
    const wrapper = document.createElement("div");
    wrapper.className = "admin-section";

    const header = document.createElement("div");
    header.className = "admin-section-header";

    const title = document.createElement("strong");
    title.textContent = `${section.name} (${section.seats.length} ghế)`;

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";

    const btnChangeCount = document.createElement("button");
    btnChangeCount.className = "btn-secondary";
    btnChangeCount.textContent = "⚙️ Đổi số ghế";
    btnChangeCount.onclick = () => changeSectionSeatCount(section.id);

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-secondary";
    btnDelete.style.color = "#dc2626";
    btnDelete.textContent = "🗑️ Xóa khu";
    btnDelete.onclick = () => deleteSection(section.id);

    actions.appendChild(btnChangeCount);
    actions.appendChild(btnDelete);

    header.appendChild(title);
    header.appendChild(actions);
    wrapper.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "admin-grid";

    section.seats.forEach(seat => {
      const button = document.createElement("button");
      button.className = "admin-seat";
      button.textContent = seat.label;
      button.title = "Bấm để đổi nhãn tên ghế";

      button.onclick = () => {
        const newLabel = prompt("Nhập tên ghế mới:", seat.label);
        if (newLabel && newLabel.trim()) {
          seat.label = newLabel.trim();
          renderAdmin();
        }
      };

      grid.appendChild(button);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
  });
}

function changeSectionSeatCount(sectionId) {
  const currentSeats = appData.config.filter(
    item => item.type === "seat" && item.section_id === sectionId
  );
  const sectionName = currentSeats[0]?.section_name || sectionId;

  const rowsInput = prompt(`Nhập số HÀNG ghế mới cho [${sectionName}]:`, "5");
  if (!rowsInput) return;

  const colsInput = prompt(`Nhập số CỘT ghế mỗi hàng:`, "6");
  if (!colsInput) return;

  const rows = parseInt(rowsInput, 10);
  const cols = parseInt(colsInput, 10);

  if (isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) {
    alert("Số hàng và cột phải là số nguyên lớn hơn 0!");
    return;
  }

  appData.config = appData.config.filter(
    item => !(item.type === "seat" && item.section_id === sectionId)
  );

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      appData.config.push({
        type: "seat",
        id: `${sectionId}_R${r}C${c}`,
        section_id: sectionId,
        section_name: sectionName,
        row: r,
        col: c,
        label: `${numberToLetter(r)}${c}`
      });
    }
  }

  renderAdmin();
}

function addNewSection() {
  const name = prompt("Nhập tên khu vực mới (Ví dụ: Khu VIP, Bàn Giáo Viên):", "Khu vực mới");
  if (!name || !name.trim()) return;

  const sectionId = "SEC_" + Date.now();
  appData.config.push({
    type: "seat",
    id: `${sectionId}_R1C1`,
    section_id: sectionId,
    section_name: name.trim(),
    row: 1,
    col: 1,
    label: "A1"
  });

  renderAdmin();
}

function deleteSection(sectionId) {
  const section = groupSections(appData.config).find(s => s.id === sectionId);
  if (!section) return;

  if (confirm(`Bạn có chắc chắn muốn xóa khu vực "${section.name}"?`)) {
    appData.config = appData.config.filter(item => item.section_id !== sectionId);
    renderAdmin();
  }
}

/* =====================================================
   SAVE ADMIN CONFIG
===================================================== */
async function saveAdminConfig() {
  if (!adminPassword) {
    alert("Phiên làm việc Admin đã hết hạn.");
    return;
  }

  showStatus("Đang lưu cấu trúc phòng...", "info");

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

    if (!response.ok) throw new Error(`Lỗi kết nối (${response.status})`);
    const data = await response.json();

    if (data.status !== "success") throw new Error(data.message || "Không thể lưu.");

    closeAdminPanel();
    await loadData();
    showStatus("💾 Đã lưu cấu trúc phòng thành công!", "success");
    setTimeout(hideStatus, 2000);

  } catch (error) {
    console.error(error);
    showStatus("❌ " + error.message, "error");
  }
}

/* =====================================================
   UTILITIES
===================================================== */
function numberToLetter(num) {
  let result = "";
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

function showStatus(message, type) {
  const element = document.getElementById("status");
  if (!element) return;
  element.textContent = message;
  element.className = `status show ${type}`;
}

function hideStatus() {
  const element = document.getElementById("status");
  if (element) element.className = "status";
}
