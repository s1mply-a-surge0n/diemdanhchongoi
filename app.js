const API_URL =
  "https://script.google.com/macros/s/AKfycbzpoHExr9Oi82mIoxGQkN2MJjWTpPJjbEbqY-6w1FOsdpMWXyTvxzoCroCuURrI3mgH/exec";

/*
 * ==================================================
 * GLOBAL DATA
 * ==================================================
 */
let appData = {
  config: [],
  seats: {}
};

let adminPassword = "";

/*
 * ==================================================
 * INIT
 * ==================================================
 */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
});

/*
 * ==================================================
 * LOAD DATA
 * ==================================================
 */
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

    renderSeats();
    showStatus("Đã cập nhật dữ liệu.", "success");
    setTimeout(hideStatus, 1500);

  } catch (error) {
    console.error(error);
    showStatus("❌ " + error.message, "error");
  }
}

/*
 * ==================================================
 * RENDER SEATS (USER VIEW)
 * ==================================================
 */
function renderSeats() {
  const container = document.getElementById("sections");
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

    // Tìm số cột lớn nhất để đặt tỉ lệ CSS Grid
    const maxCol = Math.max(
      ...section.seats.map(seat => Number(seat.col) || 1),
      1
    );

    grid.style.gridTemplateColumns = `repeat(${maxCol}, 1fr)`;

    // Sắp xếp ghế theo Hàng -> Cột
    const seats = [...section.seats].sort((a, b) => {
      const rowA = Number(a.row) || 0;
      const rowB = Number(b.row) || 0;
      const colA = Number(a.col) || 0;
      const colB = Number(b.col) || 0;

      if (rowA !== rowB) return rowA - rowB;
      return colA - colB;
    });

    // Vẽ từng ghế
    seats.forEach(seat => {
      const seatElement = document.createElement("div");
      seatElement.className = "seat";

      // Cố định hàng và cột trong CSS Grid để tránh xô lệch
      if (seat.row && seat.col) {
        seatElement.style.gridRow = seat.row;
        seatElement.style.gridColumn = seat.col;
      }

      const booking = appData.seats[seat.id];

      if (booking && booking.name) {
        seatElement.classList.add("occupied");
      } else {
        seatElement.classList.add("available");
      }

      const number = document.createElement("div");
      number.className = "seat-number";
      number.textContent = seat.label || `${seat.row}-${seat.col}`;

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

/*
 * ==================================================
 * GROUP SECTIONS
 * ==================================================
 */
function groupSections(config) {
  const map = {};

  config
    .filter(item => item.type === "seat")
    .forEach(seat => {
      const sectionId = seat.section_id || "default";

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

/*
 * ==================================================
 * CLICK SEAT
 * ==================================================
 */
function handleSeatClick(seat) {
  const booking = appData.seats[seat.id];

  // Nếu ghế đã có người đặt
  if (booking && booking.name) {
    const shouldCancel = confirm(
      `Ghế ${seat.label} đang được "${booking.name}" sử dụng.\n\nBạn có muốn hủy ghế này không?`
    );

    if (shouldCancel) {
      cancelSeat(seat.id);
    }
    return;
  }

  // Nếu ghế còn trống
  const name = prompt(`Bạn đang chọn ghế ${seat.label}.\n\nNhập tên của bạn:`);

  if (!name || !name.trim()) {
    return;
  }

  bookSeat(seat.id, name.trim());
}

/*
 * ==================================================
 * BOOK SEAT
 * ==================================================
 */
async function bookSeat(seatId, name) {
  showStatus("Đang đăng ký ghế...", "info");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "book",
        seatId: seatId,
        name: name
      })
    });

    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ (${response.status})`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Không thể đặt ghế.");
    }

    await loadData();
    showStatus("🎉 Đã đặt ghế thành công!", "success");
    setTimeout(hideStatus, 2000);

  } catch (error) {
    console.error(error);
    showStatus("❌ " + error.message, "error");
  }
}

/*
 * ==================================================
 * CANCEL SEAT
 * ==================================================
 */
async function cancelSeat(seatId) {
  showStatus("Đang hủy ghế...", "info");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "cancel",
        seatId: seatId
      })
    });

    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ (${response.status})`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Không thể hủy ghế.");
    }

    await loadData();
    showStatus("🗑️ Đã hủy ghế.", "success");
    setTimeout(hideStatus, 1500);

  } catch (error) {
    console.error(error);
    showStatus("❌ " + error.message, "error");
  }
}

/*
 * ==================================================
 * ADMIN LOGIN
 * ==================================================
 */
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
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "loginAdmin",
        password: password
      })
    });

    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ (${response.status})`);
    }

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

/*
 * ==================================================
 * OPEN / CLOSE ADMIN PANEL
 * ==================================================
 */
function openAdminPanel() {
  renderAdmin();
  document.getElementById("adminModal").classList.add("show");
}

function closeAdminPanel() {
  document.getElementById("adminModal").classList.remove("show");
}

/*
 * ==================================================
 * ADMIN RENDER
 * ==================================================
 */
function renderAdmin() {
  const container = document.getElementById("adminSections");
  container.innerHTML = "";

  const sections = groupSections(appData.config);

  sections.forEach(section => {
    const wrapper = document.createElement("div");
    wrapper.className = "admin-section";

    // Header quản lý nhóm ghế
    const header = document.createElement("div");
    header.className = "admin-section-header";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "10px";

    const title = document.createElement("strong");
    title.textContent = `${section.name} (${section.seats.length} ghế)`;

    // Nút thay đổi số lượng ghế
    const btnChangeCount = document.createElement("button");
    btnChangeCount.className = "btn-change-count";
    btnChangeCount.textContent = "⚙️ Đổi số lượng ghế";
    btnChangeCount.style.padding = "4px 8px";
    btnChangeCount.style.cursor = "pointer";
    btnChangeCount.onclick = () => changeSectionSeatCount(section.id);

    header.appendChild(title);
    header.appendChild(btnChangeCount);
    wrapper.appendChild(header);

    // Danh sách ghế trong Admin
    const grid = document.createElement("div");
    grid.className = "admin-grid";

    section.seats.forEach(seat => {
      const button = document.createElement("button");
      button.className = "admin-seat";
      button.textContent = seat.label;

      button.onclick = () => {
        const newLabel = prompt("Tên ghế:", seat.label);
        if (newLabel && newLabel.trim()) {
          seat.label = newLabel.trim();
        }
        renderAdmin();
      };

      grid.appendChild(button);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
  });
}

/*
 * ==================================================
 * CHANGE SEAT COUNT IN A SECTION (ADMIN)
 * ==================================================
 */
function changeSectionSeatCount(sectionId) {
  const currentSeats = appData.config.filter(
    item => item.type === "seat" && item.section_id === sectionId
  );

  const sectionName = currentSeats[0]?.section_name || sectionId;

  const rowsInput = prompt(
    `Nhập số HÀNG ghế mới cho [${sectionName}]:`,
    "5"
  );
  if (!rowsInput) return;

  const colsInput = prompt(
    `Nhập số CỘT ghế mỗi hàng:`,
    "6"
  );
  if (!colsInput) return;

  const rows = parseInt(rowsInput, 10);
  const cols = parseInt(colsInput, 10);

  if (isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) {
    alert("Số hàng và số cột phải là số nguyên lớn hơn 0!");
    return;
  }

  const confirmReset = confirm(
    `Bạn có chắc muốn tạo lại nhóm [${sectionName}] với ${rows} hàng x ${cols} cột (${rows * cols} ghế)?`
  );

  if (!confirmReset) return;

  // 1. Lọc bỏ các ghế cũ thuộc nhóm này
  appData.config = appData.config.filter(
    item => !(item.type === "seat" && item.section_id === sectionId)
  );

  // 2. Tạo danh sách ghế mới theo Hàng x Cột
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      appData.config.push({
        type: "seat",
        id: `${sectionId}_R${r}C${c}`,
        section_id: sectionId,
        section_name: sectionName,
        row: r,
        col: c,
        label: `${r}-${c}`
      });
    }
  }

  // 3. Render lại giao diện Admin để kiểm tra trước khi nhấn Lưu
  renderAdmin();
}

/*
 * ==================================================
 * SAVE ADMIN CONFIG
 * ==================================================
 */
async function saveAdminConfig() {
  if (!adminPassword) {
    alert("Phiên admin đã hết.");
    return;
  }

  showStatus("Đang lưu cấu trúc...", "info");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "saveConfig",
        adminPassword: adminPassword,
        config: appData.config
      })
    });

    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ (${response.status})`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Không thể lưu.");
    }

    closeAdminPanel();
    await loadData();

    showStatus("💾 Đã lưu cấu trúc phòng.", "success");
    setTimeout(hideStatus, 2000);

  } catch (error) {
    console.error(error);
    showStatus("❌ " + error.message, "error");
  }
}

/*
 * ==================================================
 * STATUS UI
 * ==================================================
 */
function showStatus(message, type) {
  const element = document.getElementById("status");
  element.textContent = message;
  element.className = `status show ${type}`;
}

function hideStatus() {
  document.getElementById("status").classList.remove("show");
}
