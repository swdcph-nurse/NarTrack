(function () {
  const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzOITprKzWcOhvgl6ELltxJmhGEjCifJA0ZwdDgqba-gKTP1hswlcnRa1Lithqx6fIs/exec";

  
  function getWardName() {
    // รองรับทั้ง key เก่า (WARD_NAME) และ key ใหม่ (APP_WARD_NAME)
    return localStorage.getItem("APP_WARD_NAME") || localStorage.getItem("WARD_NAME") || "หอสงฆ์อาพาธ";
  }

  function getHospitalName() {
    // รองรับทั้ง key เก่า (HOSPITAL_NAME) และ key ใหม่ (APP_HOSP_NAME)
    return localStorage.getItem("APP_HOSP_NAME") || localStorage.getItem("HOSPITAL_NAME") || "โรงพยาบาลสมเด็จพระยุพราชสว่างแดนดิน";
  }

  window.openWardSystemConfigModal = async function () {
    const { value: password, isConfirmed } = await Swal.fire({
      title: "ยืนยันสิทธิ์ผู้ดูแลระบบ",
      html: "<div class='text-start text-secondary small mb-2'>กรุณากรอกรหัสผ่านผู้ดูแลระบบ (Admin Password) เพื่อเข้าสู่การตั้งค่าย้ายวอร์ดและ API</div>",
      input: "password",
      inputPlaceholder: "กรอกรหัสผ่าน (admin1234)",
      showCancelButton: true,
      confirmButtonText: "<i class='fas fa-unlock me-1'></i> เข้าสู่การตั้งค่า",
      cancelButtonText: "ยกเลิก",
      inputValidator: (val) => {
        if (!val || val.trim() !== "admin1234") {
          return "รหัสผ่านไม่ถูกต้อง (ต้องเป็น admin1234)";
        }
      }
    });

    if (!isConfirmed) return;

    const currentWard = getWardName();
    const currentHospital = getHospitalName();
    const currentApi = localStorage.getItem("GAS_API_URL") || DEFAULT_API_URL;

    const modalHtml = `
      <div class="text-start">
        <div class="mb-3">
          <label class="form-label small fw-bold text-dark mb-1"><i class="fas fa-hospital-user text-primary me-1"></i>ชื่อหอผู้ป่วย / หน่วยงาน <span class="text-danger">*</span></label>
          <input type="text" class="form-control form-control-sm" id="cfg-ward-name" value="${escapeHtml(currentWard)}" placeholder="เช่น หอสงฆ์อาพาธ, ICU, ศัลยกรรมชาย">
        </div>
        <div class="mb-3">
          <label class="form-label small fw-bold text-dark mb-1"><i class="fas fa-hospital text-primary me-1"></i>ชื่อโรงพยาบาล <span class="text-danger">*</span></label>
          <input type="text" class="form-control form-control-sm" id="cfg-hospital-name" value="${escapeHtml(currentHospital)}" placeholder="เช่น โรงพยาบาลสมเด็จพระยุพราชสว่างแดนดิน">
        </div>
        <div class="mb-2">
          <label class="form-label small fw-bold text-dark mb-1"><i class="fas fa-link text-primary me-1"></i>Google Apps Script Web App API URL <span class="text-danger">*</span></label>
          <textarea class="form-control form-control-sm" id="cfg-api-url" rows="3" placeholder="https://script.google.com/macros/s/.../exec">${escapeHtml(currentApi)}</textarea>
          <div class="form-text small" style="font-size: 0.72rem;">URL ของ Web App ที่ Deploy จาก Google Apps Script ของหน่วยงานใหม่</div>
        </div>
      </div>
    `;

    const { value: formValues, isConfirmed: isConfigSaved } = await Swal.fire({
      title: "ตั้งค่าย้ายวอร์ดและ API ระบบ",
      html: modalHtml,
      width: "550px",
      showCancelButton: true,
      confirmButtonText: "<i class='fas fa-save me-1'></i> บันทึกการตั้งค่า",
      cancelButtonText: "ยกเลิก",
      focusConfirm: false,
      preConfirm: () => {
        const ward = document.getElementById("cfg-ward-name")?.value.trim();
        const hospital = document.getElementById("cfg-hospital-name")?.value.trim();
        const api = document.getElementById("cfg-api-url")?.value.trim();

        if (!ward) {
          Swal.showValidationMessage("กรุณาระบุชื่อหอผู้ป่วย");
          return false;
        }
        if (!hospital) {
          Swal.showValidationMessage("กรุณาระบุชื่อโรงพยาบาล");
          return false;
        }
        if (!api || !api.startsWith("http")) {
          Swal.showValidationMessage("กรุณาระบุ Web App API URL ให้ถูกต้อง");
          return false;
        }

        return { ward, hospital, api };
      }
    });

    if (!isConfigSaved || !formValues) return;

    // บันทึกทั้ง key เก่าและ key ใหม่เพื่อความ backward-compatible
    localStorage.setItem("WARD_NAME", formValues.ward);
    localStorage.setItem("HOSPITAL_NAME", formValues.hospital);
    localStorage.setItem("APP_WARD_NAME", formValues.ward);
    localStorage.setItem("APP_HOSP_NAME", formValues.hospital);
    localStorage.setItem("GAS_API_URL", formValues.api);
    if (window.GASApi && typeof window.GASApi.setApiUrl === "function") {
      window.GASApi.setApiUrl(formValues.api);
    }

    // ล้างแคชทั้งหมดเพื่อดึงข้อมูลจาก API ใหม่
    localStorage.removeItem("drug_master_cache");
    localStorage.removeItem("shift_count_history_cache");
    localStorage.removeItem("drug_stock_cache_for_shiftcount");

    // บันทึกชื่อลง Google Sheets ด้วย (ถ้า API ใหม่พร้อมใช้งาน)
    try {
      await GASApi.saveSystemConfig({
        password: "admin1234",
        HospitalName: formValues.hospital,
        WardName: formValues.ward
      });
    } catch (e) {
      console.warn("Cannot sync config to remote sheet:", e);
    }

    const origin = window.location.origin;
    const basePath = window.location.pathname.replace(/[^/]*$/, '');
    const shareLink = origin + basePath + "dashboard.html?api=" + encodeURIComponent(formValues.api);

    await Swal.fire({
      icon: "success",
      title: "บันทึกการตั้งค่าสำเร็จ",
      html: `<p class="mb-2">อัปเดตข้อมูลเป็น <b>${escapeHtml(formValues.ward)}</b> (${escapeHtml(formValues.hospital)}) เรียบร้อยแล้ว</p>` +
        `<div class="p-2 bg-light border rounded text-start mt-2">` +
        `<div class="small fw-bold text-primary mb-1"><i class="fas fa-share-nodes me-1"></i> ลิงก์แชร์ให้เครื่องอื่น:</div>` +
        `<input type="text" class="form-control form-control-sm text-secondary mb-2" id="share-link-val" value="${escapeHtml(shareLink)}" readonly>` +
        `<button type="button" class="btn btn-outline-primary btn-sm w-100" id="btn-copy-share-lnk"><i class="fas fa-copy me-1"></i> คัดลอกลิงก์</button>` +
        `</div>`,
      didOpen: () => {
        const btn = document.getElementById('btn-copy-share-lnk');
        if (btn) {
          btn.addEventListener('click', () => {
            const inp = document.getElementById('share-link-val');
            if (inp) { inp.select(); navigator.clipboard.writeText(inp.value); showToast("คัดลอกลิงก์เรียบร้อยแล้ว"); }
          });
        }
      },
      confirmButtonText: 'เสร็จสิ้น (รีโหลดหน้า)'
    });

    window.location.reload();
  };

  // ตรวจ URL Parameter ?api=... สำหรับแชร์การตั้งค่า API ข้ามเครื่อง
  (function checkApiQueryParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryApi = params.get("api") || params.get("apiUrl");
      if (queryApi && queryApi.startsWith("http")) {
        const existing = localStorage.getItem("GAS_API_URL");
        if (existing !== queryApi.trim()) {
          localStorage.setItem("GAS_API_URL", queryApi.trim());
          localStorage.setItem("APP_WARD_NAME", "");
          localStorage.setItem("APP_HOSP_NAME", "");
          // ล้างแคชทั้งหมดเพื่อโหลดข้อมูลใหม่จาก API ใหม่
          localStorage.removeItem("drug_master_cache");
          localStorage.removeItem("shift_count_history_cache");
          localStorage.removeItem("drug_stock_cache_for_shiftcount");
        }
        // ลบ query string ออกจาก URL โดยไม่รีโหลด
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    } catch (e) {}
  })();

  if (!localStorage.getItem("GAS_API_URL")) {
    localStorage.setItem("GAS_API_URL", DEFAULT_API_URL);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/\\r\\n|\\n/g, "")
      .replace(/\r\n|\r|\n/g, " ")
      .trim()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function cleanHtmlMarkup(value) {
    return String(value ?? "")
      .replace(/\\r\\n|\\n/g, "")
      .replace(/\r\n|\r|\n/g, "")
      .trim();
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH") + " " + date.toLocaleTimeString("th-TH");
  }

  function formatShortDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH");
  }

  function readJsonCache(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJsonCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
    } catch (err) {}
  }

  function getDrugMasterCache() {
    return readJsonCache("drug_master_cache", []);
  }

  function setDrugMasterCache(list) {
    writeJsonCache("drug_master_cache", list);
    window.__drugMasterCache = Array.isArray(list) ? list : [];
  }

  function getShiftCountHistoryCache() {
    return readJsonCache("shift_count_history_cache", []);
  }

  function setShiftCountHistoryCache(list) {
    writeJsonCache("shift_count_history_cache", list);
    window.__shiftCountHistoryCache = Array.isArray(list) ? list : [];
  }

  function getDrugStockCache() {
    return readJsonCache("drug_stock_cache_for_shiftcount", []);
  }

  function setDrugStockCache(list) {
    writeJsonCache("drug_stock_cache_for_shiftcount", list);
    window.__shiftCountStockCache = Array.isArray(list) ? list : [];
  }

  function computeExpectedRemainByDrugID(stockList) {
    const map = new Map();
    const rows = Array.isArray(stockList) ? stockList : [];
    rows.forEach(item => {
      const drugId = String(item.DrugID || "");
      if (!drugId) return;
      const remain = parseFloat(item.QtyRemain);
      const current = map.get(drugId) || 0;
      map.set(drugId, current + (Number.isFinite(remain) ? remain : 0));
    });
    return map;
  }

  function setInlineLoadingState(targetId, show, message) {
    const el = document.getElementById(targetId);
    window.__shiftCountLoadingState = !!show;
    if (!el) return;
    if (show) {
      el.classList.remove("d-none");
      const textEl = el.querySelector("[data-loading-text]");
      if (textEl && message) textEl.textContent = message;
    } else {
      el.classList.add("d-none");
    }
  }

  function renderEmptyRow(tbody, colSpan, message) {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="' + colSpan + '" class="text-center text-muted py-4">' + escapeHtml(message) + '</td></tr>';
  }

  function populateDisbursementDropdown(stockList) {
    const select = document.getElementById("disburse-stock-select");
    if (!select) return;

    const currentValue = select.value;
    const rows = Array.isArray(stockList) ? stockList.filter(item => parseFloat(item.QtyRemain || 0) > 0) : [];

    const masterList = getDrugMasterCache();
    const strengthMap = new Map();
    masterList.forEach(m => {
      if (m.DrugID) strengthMap.set(String(m.DrugID), m.Strength || "");
    });

    // รวมกลุ่มยาที่เป็นตัวเดียวกัน (DrugID เดียวกัน) และ LOT เดียวกัน
    const grouped = new Map();
    rows.forEach(item => {
      const remain = parseFloat(item.QtyRemain || 0);
      if (remain <= 0) return;
      const drugId = String(item.DrugID || item.DrugName || "").trim();
      const lot = String(item.LOT || "").trim();
      const groupKey = drugId + "___" + lot;

      let strength = strengthMap.get(drugId) || item.Strength || "";
      let baseDrugName = item.DrugName || "-";
      let displayName = baseDrugName;
      if (strength && !baseDrugName.includes(strength)) {
        displayName = baseDrugName + " (" + strength + ")";
      }

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          groupKey: groupKey,
          drugID: drugId,
          drugName: baseDrugName,
          displayName: displayName,
          strength: strength,
          lot: lot,
          unit: item.Unit || "แอมป์/ขวด",
          totalQtyRemain: 0,
          stockIDs: []
        });
      }

      const g = grouped.get(groupKey);
      g.totalQtyRemain += remain;
      g.stockIDs.push(item.StockID);
    });

    window.__disbursementGroupedCache = grouped;

    let html = '<option value="" disabled selected>-- เลือกยาและล็อตจากคลัง --</option>';
    if (grouped.size === 0) {
      html = '<option value="" disabled selected>-- ไม่พบรายการคงเหลือ --</option>';
    } else {
      grouped.forEach(g => {
        const text = g.displayName + " | LOT " + (g.lot || "-") + " | คงเหลือ " + g.totalQtyRemain + " " + g.unit;
        html += '<option value="' + escapeHtml(g.groupKey) + '" data-drug-id="' + escapeHtml(g.drugID) + '" data-lot="' + escapeHtml(g.lot) + '" data-name="' + escapeHtml(g.drugName) + '" data-display-name="' + escapeHtml(g.displayName) + '" data-remain="' + g.totalQtyRemain + '" data-unit="' + escapeHtml(g.unit) + '">' + escapeHtml(text) + '</option>';
      });
    }

    select.innerHTML = html;
    if (currentValue && grouped.has(currentValue)) {
      select.value = currentValue;
    }
  }

  function populateReceiveDrugDropdown(masterList) {
    const select = document.getElementById("drug-name-input");
    if (!select) return;

    const rows = Array.isArray(masterList) ? masterList : [];
    setDrugMasterCache(rows);
    if (rows.length === 0) {
      select.innerHTML = '<option value="" selected disabled>ไม่พบรายการยาใน Drug Master</option>';
      return;
    }

    let html = '<option value="" selected disabled>-- เลือกชื่อยา --</option>';
    rows.forEach(item => {
      const label = (item.DrugName || "-") + (item.Strength ? " (" + item.Strength + ")" : "") + (item.Unit ? " - " + item.Unit : "");
      html += '<option value="' + escapeHtml(item.DrugID || "") + '" data-name="' + escapeHtml(item.DrugName || "") + '" data-strength="' + escapeHtml(item.Strength || "") + '" data-unit="' + escapeHtml(item.Unit || "") + '">' + escapeHtml(label) + '</option>';
    });

    select.innerHTML = html;
  }

  function syncReceiveDrugFieldsFromSelect() {
    const select = document.getElementById("drug-name-input");
    const strengthInput = document.getElementById("drug-strength-input");
    const unitInput = document.getElementById("drug-unit-input");
    if (!select) return;

    const option = select.selectedOptions && select.selectedOptions[0];
    if (strengthInput) strengthInput.value = "";
    if (unitInput) unitInput.value = "";
    if (!option || !option.dataset) {
      return;
    }
    if (strengthInput && option.dataset.strength) {
      strengthInput.value = option.dataset.strength;
    }
    if (unitInput && option.dataset.unit) {
      unitInput.value = option.dataset.unit;
    }
  }

    function renderNavbar(activePage) {
    const placeholder = document.getElementById("navbar-placeholder");
    if (!placeholder) return;

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userName = user.name || "เจ้าหน้าที่";
    const userRole = user.role || "พยาบาลประจำการ";
    const wardName = getWardName();

    placeholder.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-dark navbar-custom">
        <div class="container-fluid">
          <a class="navbar-brand" href="dashboard.html">
            <div class="navbar-brand-wrap">
              <img src="icon-app.png" alt="Logo" width="42" height="42" class="rounded shadow-sm">
              <div class="navbar-brand-text">
                <div class="brand-title">ระบบยาเสพติด</div>
                <small class="brand-subtitle">งานบริหารเวชภัณฑ์ควบคุม</small>
              </div>
            </div>
            <div class="ward-context-pill">
              <i class="fas fa-hospital-user text-info"></i>
              <div class="ward-context-pill__name">${escapeHtml(wardName)}</div>
            </div>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent" aria-controls="navbarContent" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarContent">
            <ul class="navbar-nav nav-menu-list my-2">
              <li class="nav-item"><a class="nav-link" id="nav-dashboard" href="dashboard.html"><i class="fas fa-chart-line"></i><span>แดชบอร์ด</span></a></li>
              <li class="nav-item"><a class="nav-link" id="nav-shiftcount" href="shiftcount.html"><i class="fas fa-clipboard-check"></i><span>ตรวจนับยา</span></a></li>
              <li class="nav-item"><a class="nav-link" id="nav-stock" href="stock.html"><i class="fas fa-boxes-stacked"></i><span>รับเข้าสต็อก</span></a></li>
              <li class="nav-item"><a class="nav-link" id="nav-disbursement" href="disbursement.html"><i class="fas fa-file-medical"></i><span>ตัดจ่ายยา</span></a></li>
              <li class="nav-item"><a class="nav-link" id="nav-report" href="report.html"><i class="fas fa-file-invoice"></i><span>รายงาน</span></a></li>
              <li class="nav-item"><a class="nav-link" id="nav-settings" href="settings.html"><i class="fas fa-gear"></i><span>ตั้งค่ารายการยา</span></a></li>
            </ul>
            <div class="navbar-actions">
              <div class="user-profile-badge">
                <i class="fas fa-user-circle fs-3 text-info flex-shrink-0"></i>
                <div class="user-text">
                  <div class="user-name">${escapeHtml(userName)}</div>
                  <div class="user-role">${escapeHtml(userRole)}</div>
                </div>
              </div>
              <button class="btn btn-outline-info btn-sm w-100 mb-2 py-2" id="btn-system-ward-config" style="border-color: rgba(6, 182, 212, 0.4); color: #38bdf8;">
                <i class="fas fa-sliders me-2"></i>
                <span>ตั้งค่าวอร์ด / API</span>
              </button>
              <button class="btn btn-outline-light btn-sm w-100 py-2" id="btn-logout">
                <i class="fas fa-right-from-bracket me-2"></i>
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    `;

    const activeLink = document.getElementById(activePage);
    if (activeLink) {
      activeLink.classList.add("active");
    }

    const configBtn = document.getElementById("btn-system-ward-config");
    if (configBtn && !configBtn.dataset.bound) {
      configBtn.dataset.bound = "1";
      configBtn.addEventListener("click", function () {
        window.openWardSystemConfigModal();
      });
    }

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "1";
      logoutBtn.addEventListener("click", function () {
        localStorage.removeItem("user");
        window.location.replace("login.html");
      });
    }
  }

  window.initLoginPage = function () {
    window.location.replace("dashboard.html");
  };

  window.loadNavbar = async function () {
    const page = window.location.pathname.split("/").pop() || "dashboard.html";
    const activeMap = {
      "dashboard.html": "nav-dashboard",
      "stock.html": "nav-stock",
      "shiftcount.html": "nav-shiftcount",
      "disbursement.html": "nav-disbursement",
      "report.html": "nav-report",
      "settings.html": "nav-settings"
    };
    renderNavbar(activeMap[page] || "nav-dashboard");
  };

  // --- Disbursement Page ---
  window.renderDisbursementTable = function (rows) {
    const tbody = document.getElementById("disbursement-tbody");
    if (!tbody) return;

    if (window.__disbursementTable && typeof window.__disbursementTable.destroy === "function") {
      window.__disbursementTable.destroy();
      window.__disbursementTable = null;
    }

    tbody.closest("table")?.classList.add("stack-table-mobile");
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ยังไม่มีประวัติการตัดจ่ายยา</td></tr>';
      return;
    }

    const masterList = getDrugMasterCache();
    const strengthMap = new Map();
    masterList.forEach(m => {
      if (m.DrugID) strengthMap.set(String(m.DrugID), m.Strength || "");
    });

    tbody.innerHTML = cleanHtmlMarkup(list.map(item => {
      const drugId = String(item.DrugID || "");
      const strength = strengthMap.get(drugId) || item.Strength || "";
      const baseName = item.DrugName || "-";
      let displayName = baseName;
      if (strength && !baseName.includes(strength)) {
        displayName = baseName + " (" + strength + ")";
      }
      const lotStr = item.LOT || "-";

      return `
        <tr>
          <td data-label="รหัสรายการ"><span class="fw-semibold text-primary">${escapeHtml(item.DisburseID || item.DrugName || "-")}</span></td>
          <td data-label="ชื่อยา">
            <div class="fw-bold text-dark">${escapeHtml(displayName)}</div>
            <div class="small mt-1"><span class="badge bg-secondary-subtle text-secondary border">LOT: ${escapeHtml(lotStr)}</span></div>
          </td>
          <td data-label="LOT"><span class="badge bg-secondary">${escapeHtml(lotStr)}</span></td>
          <td data-label="ชื่อผู้ป่วย">${escapeHtml(item.PatientName || "-")} <span class="text-muted">(${escapeHtml(item.HN || "-")})</span></td>
          <td data-label="จำนวน" class="text-end fw-bold text-primary">${escapeHtml(item.Qty ?? 0)}</td>
          <td data-label="ผู้บันทึก">${escapeHtml(item.User || "-")}</td>
          <td data-label="วันที่ตัดจ่าย">${formatShortDate(item.Date || item.Timestamp)}</td>
        </tr>
      `;
    }).join(""));

    window.__disbursementTable = $("#disbursement-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 10,
      responsive: true
    });
  };

  window.initDisbursementPage = async function () {
    showLoading(true);

    try {
      let masterData = getDrugMasterCache();
      if (!masterData || masterData.length === 0) {
        const masterRes = await GASApi.getDrugMaster();
        if (masterRes.success && Array.isArray(masterRes.data)) {
          masterData = masterRes.data;
          setDrugMasterCache(masterData);
        }
      }

      const stockRes = await GASApi.getDrugStock();
      if (stockRes.success) {
        window.__disbursementStockCache = Array.isArray(stockRes.data) ? stockRes.data : [];
        populateDisbursementDropdown(window.__disbursementStockCache);
      } else {
        window.__disbursementStockCache = [];
      }

      const historyRes = await GASApi.getDisbursementReport("");
      if (historyRes.success) {
        window.renderDisbursementTable(historyRes.data || []);
      } else {
        window.renderDisbursementTable([]);
      }
    } catch (err) {
      console.error("Disbursement page error:", err);
      Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const stockSelect = document.getElementById("disburse-stock-select");
    const remainHint = document.getElementById("stock-remain-hint");
    const disburseDateInput = document.getElementById("disburse-date-input");
    const disburseUserInput = document.getElementById("disburse-user-input");

    if (disburseDateInput && !disburseDateInput.value) {
      disburseDateInput.value = new Date().toISOString().slice(0, 10);
    }
    if (disburseUserInput) {
      disburseUserInput.value = disburseUserInput.value || "";
    }
    if (stockSelect && remainHint && !stockSelect.dataset.bound) {
      stockSelect.dataset.bound = "1";
      stockSelect.addEventListener("change", function () {
        const groupKey = this.value;
        const g = window.__disbursementGroupedCache ? window.__disbursementGroupedCache.get(groupKey) : null;
        if (g) {
          remainHint.innerText = "คงเหลือในระบบ: " + g.totalQtyRemain + " " + g.unit + " (LOT: " + g.lot + ")";
        } else {
          remainHint.innerText = "คงเหลือในระบบ: - แอมป์/ขวด";
        }
      });
    }

    const disburseForm = document.getElementById("disburse-form");
    if (disburseForm && !disburseForm.dataset.bound) {
      disburseForm.dataset.bound = "1";
      disburseForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const groupKey = document.getElementById("disburse-stock-select")?.value || "";
        const disburseDate = document.getElementById("disburse-date-input")?.value || "";
        const qty = parseFloat(document.getElementById("disburse-qty-input")?.value || "0");
        const patientName = (document.getElementById("patient-name-input")?.value || "").trim();
        const hn = (document.getElementById("patient-hn-input")?.value || "").trim();
        const user = (document.getElementById("disburse-user-input")?.value || "").trim();

        if (!groupKey) {
          Swal.fire("แจ้งเตือน", "กรุณาเลือกรายการยาและล็อตก่อนตัดจ่าย", "warning");
          return;
        }
        if (!disburseDate) {
          Swal.fire("แจ้งเตือน", "กรุณาระบุวันที่ตัดจ่าย", "warning");
          return;
        }
        if (!patientName || !hn) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกข้อมูลผู้ป่วย (ชื่อ-นามสกุล และ HN) ให้ครบถ้วน", "warning");
          return;
        }
        if (!user) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกชื่อผู้จ่ายยา (พยาบาล) ก่อนทำรายการ", "warning");
          document.getElementById("disburse-user-input")?.focus();
          return;
        }
        if (!qty || qty <= 0) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกจำนวนที่ต้องการจ่ายให้ถูกต้อง", "warning");
          return;
        }

        const g = window.__disbursementGroupedCache ? window.__disbursementGroupedCache.get(groupKey) : null;
        if (g && qty > g.totalQtyRemain) {
          Swal.fire("แจ้งเตือน", "จำนวนที่ต้องการจ่าย (" + qty + " " + g.unit + ") เกินยอดคงเหลือในล็อตนี้ (" + g.totalQtyRemain + " " + g.unit + ")", "warning");
          return;
        }

        showLoading(true);
        try {
          const payload = {
            DrugID: g ? g.drugID : "",
            LOT: g ? g.lot : "",
            StockID: g && g.stockIDs ? g.stockIDs[0] : groupKey,
            Date: disburseDate,
            Qty: qty,
            PatientName: patientName,
            HN: hn,
            User: user
          };

          const response = await GASApi.disburseDrug(payload);
          showLoading(false);

          if (response.success) {
            const drugDisplayName = (g && g.displayName) || response.drugName || "รายการที่เลือก";
            const qtyRemain = response.qtyRemain != null ? response.qtyRemain : "-";
            const lotText = response.lot || (g ? g.lot : "-");

            Swal.fire({
              icon: "success",
              title: "ตัดจ่ายสำเร็จ",
              html: "ตัดจ่าย <b>" + escapeHtml(drugDisplayName) + "</b><br>LOT: <b>" + escapeHtml(lotText) + "</b><br>จำนวน: <b>" + escapeHtml(qty) + "</b> หน่วย<br>วันที่ตัดจ่าย: <b>" + escapeHtml(disburseDate) + "</b><br>คงเหลือในล็อตนี้: <b>" + escapeHtml(qtyRemain) + "</b> หน่วย"
            }).then(() => {
              disburseForm.reset();
              if (disburseDateInput) disburseDateInput.value = new Date().toISOString().slice(0, 10);
              if (disburseUserInput) disburseUserInput.value = "";
              if (remainHint) remainHint.innerText = "คงเหลือในระบบ: - แอมป์/ขวด";
              window.initDisbursementPage();
            });
          } else {
            Swal.fire("เกิดข้อผิดพลาด", response.message || "ไม่สามารถตัดจ่ายได้", "error");
          }
        } catch (error) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", error.toString(), "error");
        }
      });
    }
  };

  // --- Stock Page ---
  window.renderStockTable = function (stockList) {
    const tbody = document.getElementById("stock-tbody");
    if (!tbody) return;

    if (window.__stockDataTable && typeof window.__stockDataTable.destroy === "function") {
      window.__stockDataTable.destroy();
      window.__stockDataTable = null;
    }

    tbody.closest("table")?.classList.add("stack-table-mobile");
    const rows = Array.isArray(stockList) ? stockList : [];
    const today = new Date();
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">ยังไม่มีข้อมูลรับเข้ายา</td></tr>';
      return;
    }

    const masterList = getDrugMasterCache();
    const strengthMap = new Map();
    masterList.forEach(m => {
      if (m.DrugID) strengthMap.set(String(m.DrugID), m.Strength || "");
    });

    tbody.innerHTML = cleanHtmlMarkup(rows.map(item => {
      const remain = parseFloat(item.QtyRemain || 0);
      const expiryDate = item.ExpiryDate ? new Date(item.ExpiryDate) : null;
      let statusBadge = '<span class="badge bg-secondary">ปกติ</span>';

      if (remain <= 0) {
        statusBadge = '<span class="badge bg-secondary">หมดแล้ว</span>';
      } else if (expiryDate && !Number.isNaN(expiryDate.getTime())) {
        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          statusBadge = '<span class="expiry-status-danger">หมดอายุ</span>';
        } else if (diffDays <= 30) {
          statusBadge = '<span class="expiry-status-warning">ใกล้หมดอายุ</span>';
        } else {
          statusBadge = '<span class="expiry-status-safe">ปกติ</span>';
        }
      }

      const drugId = String(item.DrugID || "");
      const strength = strengthMap.get(drugId) || item.Strength || "";
      const baseName = item.DrugName || "-";
      let displayName = baseName;
      if (strength && !baseName.includes(strength)) {
        displayName = baseName + " (" + strength + ")";
      }

      return `
        <tr>
          <td data-label="รหัสสต็อก"><span class="fw-semibold text-primary">${escapeHtml(item.StockID || "-")}</span></td>
          <td data-label="ชื่อยา"><span class="fw-bold">${escapeHtml(displayName)}</span></td>
          <td data-label="LOT"><span class="badge bg-secondary">${escapeHtml(item.LOT || "-")}</span></td>
          <td data-label="วันหมดอายุ">${escapeHtml(formatShortDate(item.ExpiryDate))}</td>
          <td data-label="รับเข้า" class="text-end">${escapeHtml(item.QtyReceive ?? 0)}</td>
          <td data-label="คงเหลือ" class="text-end fw-bold text-primary">${escapeHtml(item.QtyRemain ?? 0)}</td>
          <td data-label="วันที่รับเข้า">${escapeHtml(formatShortDate(item.ReceiveDate))}</td>
          <td data-label="ผู้บันทึก">${escapeHtml(item.CreatedBy || "-")}</td>
          <td data-label="สถานะ" class="text-center">${statusBadge}</td>
        </tr>
      `;
    }).join(""));

    window.__stockDataTable = $("#stock-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 10
    });
  };

  window.initStockPage = async function () {
    showLoading(true);

    try {
      const [stockResponse, masterResponse] = await Promise.all([
        GASApi.getDrugStock(),
        GASApi.getDrugMaster()
      ]);

      if (masterResponse.success) {
        populateReceiveDrugDropdown(masterResponse.data || []);
      }
      if (stockResponse.success) {
        window.renderStockTable(stockResponse.data || []);
      } else {
        window.renderStockTable([]);
      }
    } catch (err) {
      console.error("Stock page error:", err);
      Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
    } finally {
      showLoading(false);
    }

    const receiveDateInput = document.getElementById("receive-date-input");
    if (receiveDateInput && !receiveDateInput.value) {
      receiveDateInput.value = new Date().toISOString().slice(0, 10);
    }

    const drugNameSelect = document.getElementById("drug-name-input");
    if (drugNameSelect && !drugNameSelect.dataset.bound) {
      drugNameSelect.dataset.bound = "1";
      drugNameSelect.addEventListener("change", syncReceiveDrugFieldsFromSelect);
    }

    const receiveForm = document.getElementById("receive-form");
    if (receiveForm && !receiveForm.dataset.bound) {
      receiveForm.dataset.bound = "1";
      receiveForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const drugId = document.getElementById("drug-name-input")?.value || "";
        const drugName = document.getElementById("drug-name-input")?.selectedOptions?.[0]?.dataset?.name || "";
        const strength = document.getElementById("drug-strength-input")?.value || "";
        const unit = document.getElementById("drug-unit-input")?.value || "";
        const lot = (document.getElementById("drug-lot-input")?.value || "").trim();
        const expiryDate = document.getElementById("drug-exp-input")?.value;
        const qty = parseFloat(document.getElementById("drug-qty-input")?.value || "0");
        const receiveDate = document.getElementById("receive-date-input")?.value;
        const createdBy = (document.getElementById("created-by-input")?.value || "").trim();

        if (!drugId || !lot || !expiryDate || !receiveDate) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกข้อมูลการรับเข้ายาและล็อตให้ครบถ้วน", "warning");
          return;
        }
        if (!createdBy) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกชื่อผู้บันทึกรับเข้ายาก่อนทำรายการ", "warning");
          document.getElementById("created-by-input")?.focus();
          return;
        }
        if (!qty || qty <= 0) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกจำนวนรับเข้าให้ถูกต้อง", "warning");
          return;
        }

        showLoading(true);
        try {
          const response = await GASApi.addDrugStock({
            DrugID: drugId,
            DrugName: drugName,
            Strength: strength,
            Unit: unit,
            LOT: lot,
            ExpiryDate: expiryDate,
            QtyReceive: qty,
            ReceiveDate: receiveDate,
            CreatedBy: createdBy
          });
          showLoading(false);

          if (response.success) {
            Swal.fire({
              icon: "success",
              title: "รับเข้ายาสำเร็จ",
              text: response.message
            }).then(() => {
              receiveForm.reset();
              if (receiveDateInput) receiveDateInput.value = new Date().toISOString().slice(0, 10);
              const defaultUser = document.getElementById("created-by-input");
              if (defaultUser) defaultUser.value = "";
              window.initStockPage();
            });
          } else {
            Swal.fire("บันทึกไม่สำเร็จ", response.message, "error");
          }
        } catch (error) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", error.toString(), "error");
        }
      });
    }
  };

  // --- Settings Page ---
  window.renderDrugTable = function (drugList) {
    const tbody = document.getElementById("drug-tbody");
    if (!tbody) return;

    if (window.__drugDataTable && typeof window.__drugDataTable.destroy === "function") {
      window.__drugDataTable.destroy();
      window.__drugDataTable = null;
    }

    tbody.closest("table")?.classList.add("stack-table-mobile");
    const rows = Array.isArray(drugList) ? drugList : [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">ยังไม่มีรายการยาในระบบ</td></tr>';
      return;
    }

    tbody.innerHTML = cleanHtmlMarkup(rows.map(item => `
      <tr>
        <td data-label="รหัสยา"><span class="fw-semibold text-primary">${escapeHtml(item.DrugID || "-")}</span></td>
        <td data-label="ชื่อยา" class="fw-bold">${escapeHtml(item.DrugName || "-")}</td>
        <td data-label="ความแรง">${escapeHtml(item.Strength || "-")}</td>
        <td data-label="หน่วย"><span class="badge bg-secondary">${escapeHtml(item.Unit || "-")}</span></td>
        <td data-label="Stock Ward" class="text-center fw-bold" style="font-size:1.05rem; color:#10b981;">${escapeHtml(item.StockWard ?? 0)}</td>
        <td data-label="จัดการ" class="text-center">
          <button class="btn btn-warning btn-sm btn-edit-drug"
            data-id="${escapeHtml(item.DrugID || "")}"
            data-name="${escapeHtml(item.DrugName || "")}"
            data-strength="${escapeHtml(item.Strength || "")}"
            data-unit="${escapeHtml(item.Unit || "")}"
            data-stock="${escapeHtml(item.StockWard ?? 0)}">
            <i class="fas fa-edit me-1"></i>แก้ไข
          </button>
        </td>
      </tr>
    `).join(""));

    document.querySelectorAll(".btn-edit-drug").forEach(btn => {
      btn.addEventListener("click", function () {
        document.getElementById("drug-id-input").value = this.dataset.id || "";
        document.getElementById("drug-name-master").value = this.dataset.name || "";
        document.getElementById("drug-strength-master").value = this.dataset.strength || "";
        document.getElementById("drug-unit-master").value = this.dataset.unit || "";
        document.getElementById("stock-ward-master").value = this.dataset.stock || 0;
        document.getElementById("drugModalLabel").innerHTML = '<i class="fas fa-edit me-2"></i>แก้ไขข้อมูลยา';
        new bootstrap.Modal(document.getElementById("drugModal")).show();
      });
    });

    window.__drugDataTable = $("#drug-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "asc"]],
      pageLength: 10
    });
  };

  window.initSettingsPage = async function () {
    showLoading(true);
    try {
      const res = await GASApi.getDrugMaster();
      showLoading(false);
      if (res.success) {
        window.renderDrugTable(res.data || []);
      }
    } catch (err) {
      showLoading(false);
      Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
    }

    const drugForm = document.getElementById("drug-form");
    if (drugForm && !drugForm.dataset.bound) {
      drugForm.dataset.bound = "1";
      drugForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const id = document.getElementById("drug-id-input").value;
        const name = document.getElementById("drug-name-master").value.trim();
        const strength = document.getElementById("drug-strength-master").value.trim();
        const unit = document.getElementById("drug-unit-master").value.trim();
        const stock = parseFloat(document.getElementById("stock-ward-master").value || "0");

        if (!name || !strength || !unit || isNaN(stock) || stock < 0) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง", "warning");
          return;
        }

        showLoading(true);
        try {
          const res = await GASApi.updateDrugMaster({
            DrugID: id,
            DrugName: name,
            Strength: strength,
            Unit: unit,
            StockWard: stock
          });
          showLoading(false);

          if (res.success) {
            bootstrap.Modal.getInstance(document.getElementById("drugModal"))?.hide();
            Swal.fire("สำเร็จ", res.message, "success").then(() => {
              window.initSettingsPage();
            });
          } else {
            Swal.fire("ข้อผิดพลาด", res.message, "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
        }
      });
    }

    const addBtn = document.getElementById("btn-add-drug");
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = "1";
      addBtn.addEventListener("click", function () {
        document.getElementById("drug-id-input").value = "";
        document.getElementById("drugModalLabel").innerHTML = '<i class="fas fa-prescription-bottle-medical me-2"></i>เพิ่มข้อมูลยา';
        document.getElementById("drug-form").reset();
      });
    }
  };

  // --- Report Page ---
  window.populateReportDrugDropdown = function (stockOrMasterList) {
    const select = document.getElementById("report-drug-select");
    if (!select) return;

    const rows = Array.isArray(stockOrMasterList) ? stockOrMasterList : [];
    const masterList = getDrugMasterCache();
    const strengthMap = new Map();
    masterList.forEach(m => {
      if (m.DrugID) strengthMap.set(String(m.DrugID), m.Strength || "");
    });

    const unique = new Map();
    rows.forEach(item => {
      if (item.DrugID && !unique.has(item.DrugID)) {
        const drugId = String(item.DrugID);
        const name = item.DrugName || "-";
        const strength = strengthMap.get(drugId) || item.Strength || "";
        let displayName = name;
        if (strength && !name.includes(strength)) {
          displayName = name + " (" + strength + ")";
        }
        unique.set(drugId, displayName);
      }
    });

    let html = '<option value="">-- ทุกชนิดยา (ทั้งหมด) --</option>';
    unique.forEach((displayName, id) => {
      html += '<option value="' + escapeHtml(id) + '">' + escapeHtml(displayName) + '</option>';
    });
    select.innerHTML = html;
  };

  window.renderShiftReportPreview = function (data, yearMonth) {
    const contentDiv = document.getElementById("pdf-report-content");
    const titleEl = document.getElementById("pdf-report-title");
    const subtitleEl = document.getElementById("pdf-report-subtitle");

    if (!contentDiv || !titleEl || !subtitleEl) return;

    const parts = String(yearMonth || "").split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const monthLabel = year && month ? (months[month - 1] || "-") + " พ.ศ. " + (year + 543) : "-";

    titleEl.innerText = "รายงานสรุปการตรวจนับยาเสพติดประจำเวร";
    subtitleEl.innerText = "ประจำเดือน: " + monthLabel;

    if (!year || !month) {
      contentDiv.innerHTML = '<div class="text-center py-5 text-muted">กรุณาเลือกเดือนที่ต้องการดูรายงาน</div>';
      return;
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const rows = Array.isArray(data) ? data : [];

    function normShift(s) {
      const str = String(s || "").trim();
      if (str.indexOf("ด") === 0 || str.toLowerCase().indexOf("n") === 0) return "ด";
      if (str.indexOf("ช") === 0 || str.toLowerCase().indexOf("m") === 0) return "ช";
      if (str.indexOf("บ") === 0 || str.toLowerCase().indexOf("a") === 0 || str.toLowerCase().indexOf("e") === 0) return "บ";
      return str;
    }

    const drugMap = new Map();
    const masterList = getDrugMasterCache();
    if (Array.isArray(masterList) && masterList.length > 0) {
      masterList.forEach(m => {
        if (m.DrugID) {
          const dName = m.DrugName || "-";
          const dStr = m.Strength ? " (" + m.Strength + ")" : "";
          drugMap.set(String(m.DrugID), { id: String(m.DrugID), name: dName + dStr });
        }
      });
    }

    rows.forEach(item => {
      const dId = String(item.DrugID || item.DrugName || "").trim();
      if (dId && !drugMap.has(dId)) {
        drugMap.set(dId, { id: dId, name: item.DrugName || dId });
      }
    });

    const drugs = Array.from(drugMap.values());
    if (drugs.length === 0) {
      contentDiv.innerHTML = '<div class="text-center py-5 text-muted">ไม่พบข้อมูลรายการยาในระบบ</div>';
      return;
    }

    const countMap = new Map();
    const userMap = new Map();

    rows.forEach(item => {
      if (!item.Date) return;
      const dObj = new Date(item.Date);
      const dayNum = !isNaN(dObj.getTime()) ? dObj.getDate() : parseInt(String(item.Date).split("-")[2], 10);
      if (!dayNum || isNaN(dayNum)) return;

      const sKey = normShift(item.Shift);
      const dId = String(item.DrugID || item.DrugName || "").trim();
      const val = item.AmpRemain != null ? item.AmpRemain : (item.ExpectedTotal != null ? item.ExpectedTotal : "");
      
      countMap.set(dayNum + "_" + sKey + "_" + dId, val);
      if (item.DrugName) {
        countMap.set(dayNum + "_" + sKey + "_" + item.DrugName.trim(), val);
      }

      if (item.User) {
        userMap.set(dayNum + "_" + sKey, item.User);
      }
    });

    const shifts = ["ด", "ช", "บ"];

    function buildHalfMonthTable(startDay, endDay, label) {
      let headerDaysHtml = '';
      let headerShiftsHtml = '';

      for (let d = startDay; d <= endDay; d++) {
        headerDaysHtml += '<th colspan="3" class="text-center bg-secondary-subtle border-start border-end" style="border-bottom: 1px solid #94a3b8 !important;">วันที่ ' + d + '</th>';
        headerShiftsHtml += '<th class="shift-header-night border-start" style="width: 22px; font-size: 0.68rem;">ด</th>' +
          '<th class="shift-header-morning" style="width: 22px; font-size: 0.68rem;">ช</th>' +
          '<th class="shift-header-afternoon border-end" style="width: 22px; font-size: 0.68rem;">บ</th>';
      }

      let drugRowsHtml = '';
      drugs.forEach((drug) => {
        let cellsHtml = '';
        for (let d = startDay; d <= endDay; d++) {
          shifts.forEach((s, sIdx) => {
            const key1 = d + "_" + s + "_" + drug.id;
            const key2 = d + "_" + s + "_" + drug.name;
            const val = countMap.has(key1) ? countMap.get(key1) : (countMap.has(key2) ? countMap.get(key2) : "");
            const borderClass = (sIdx === 0 ? "border-start " : "") + (sIdx === 2 ? "border-end " : "");
            cellsHtml += '<td class="text-center ' + borderClass + '" style="font-size: 0.72rem; font-weight: ' + (val !== "" ? "600" : "normal") + ';">' + (val !== "" ? escapeHtml(val) : "") + '</td>';
          });
        }

        drugRowsHtml += '<tr>' +
          '<td class="drug-col border-end text-truncate" title="' + escapeHtml(drug.name) + '">' + escapeHtml(drug.name) + '</td>' +
          cellsHtml +
          '</tr>';
      });

      let userCellsHtml = '';
      for (let d = startDay; d <= endDay; d++) {
        shifts.forEach((s, sIdx) => {
          const u = userMap.get(d + "_" + s) || "";
          const borderClass = (sIdx === 0 ? "border-start " : "") + (sIdx === 2 ? "border-end " : "");
          const shortName = u.length > 8 ? u.slice(0, 7) + "…" : u;
          userCellsHtml += '<td class="text-center ' + borderClass + '" style="font-size: 0.60rem; line-height: 1.1; max-width: 24px; overflow: hidden; white-space: nowrap;" title="' + escapeHtml(u) + '">' + escapeHtml(shortName) + '</td>';
        });
      }

      const userRowHtml = '<tr class="user-row border-top">' +
        '<td class="drug-col border-end fw-bold text-primary" style="font-size: 0.72rem;"><i class="fas fa-signature me-1"></i>ชื่อผู้ตรวจ</td>' +
        userCellsHtml +
        '</tr>';

      return '<div class="mb-3">' +
        '<div class="d-flex justify-content-between align-items-center mb-1">' +
        '<span class="badge bg-dark px-2 py-1" style="font-size: 0.72rem;">ช่วงที่: ' + label + ' (วันที่ ' + startDay + ' - ' + endDay + ')</span>' +
        '<span class="text-muted small" style="font-size: 0.7rem;"><span class="badge bg-secondary me-1">ด</span>=ดึก &nbsp; <span class="badge bg-warning text-dark me-1">ช</span>=เช้า &nbsp; <span class="badge bg-info text-dark me-1">บ</span>=บ่าย</span>' +
        '</div>' +
        '<div class="table-responsive">' +
        '<table class="table table-bordered table-sm w-100 report-table-compact mb-0" style="border: 1.5px solid #64748b;">' +
        '<thead>' +
        '<tr class="text-center align-middle" style="background-color: #f1f5f9;">' +
        '<th rowspan="2" class="drug-col border-end align-middle bg-light" style="width: 150px; font-size: 0.75rem;">รายการยา / วันที่</th>' +
        headerDaysHtml +
        '</tr>' +
        '<tr class="text-center align-middle">' +
        headerShiftsHtml +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        drugRowsHtml +
        userRowHtml +
        '</tbody>' +
        '</table>' +
        '</div>' +
        '</div>';
    }

    const splitDay = Math.min(16, daysInMonth);
    const tableTop = buildHalfMonthTable(1, splitDay, "ครึ่งแรกของเดือน");
    let tableBottom = '';
    if (daysInMonth > splitDay) {
      tableBottom = buildHalfMonthTable(splitDay + 1, daysInMonth, "ครึ่งหลังของเดือน");
    }

    contentDiv.innerHTML = cleanHtmlMarkup('<div>' + tableTop + tableBottom + '</div>');
  };

  window.renderDisburseReportPreview = function (data, drugNameLabel, startDate, endDate) {
    const contentDiv = document.getElementById("pdf-report-content");
    const titleEl = document.getElementById("pdf-report-title");
    const subtitleEl = document.getElementById("pdf-report-subtitle");

    if (!contentDiv || !titleEl || !subtitleEl) return;

    titleEl.innerText = "รายงานการตัดจ่ายยาเสพติดให้โทษ";
    
    let dateRangeStr = "ทุกช่วงเวลา";
    if (startDate && endDate) {
      dateRangeStr = "ระหว่างวันที่ " + formatShortDate(startDate) + " ถึง " + formatShortDate(endDate);
    } else if (startDate) {
      dateRangeStr = "ตั้งแต่วันที่ " + formatShortDate(startDate);
    } else if (endDate) {
      dateRangeStr = "ถึงวันที่ " + formatShortDate(endDate);
    }

    subtitleEl.innerText = "ชนิดยา: " + (drugNameLabel || "ทุกชนิดยา") + " | " + dateRangeStr;

    const list = Array.isArray(data) ? data : [];
    if (list.length === 0) {
      contentDiv.innerHTML = '<div class="text-center py-5 text-muted"><i class="fas fa-file-excel fs-2 mb-2 d-block opacity-50"></i>ไม่พบประวัติการตัดจ่ายตามเงื่อนไขที่เลือก</div>';
      return;
    }

    const masterList = getDrugMasterCache();
    const strengthMap = new Map();
    masterList.forEach(m => {
      if (m.DrugID) strengthMap.set(String(m.DrugID), m.Strength || "");
    });

    let totalQty = 0;
    const rowsHtml = list.map((item, idx) => {
      const qtyNum = parseFloat(item.Qty) || 0;
      totalQty += qtyNum;
      const drugId = String(item.DrugID || "");
      const strength = strengthMap.get(drugId) || item.Strength || "";
      const baseName = item.DrugName || "-";
      let displayName = baseName;
      if (strength && !baseName.includes(strength)) {
        displayName = baseName + " (" + strength + ")";
      }

      return '<tr>' +
        '<td class="text-center">' + (idx + 1) + '</td>' +
        '<td class="text-center">' + escapeHtml(formatShortDate(item.Date || item.Timestamp)) + '</td>' +
        '<td class="fw-semibold text-start">' + escapeHtml(displayName) + '</td>' +
        '<td class="text-center"><span class="badge bg-secondary">' + escapeHtml(item.LOT || "-") + '</span></td>' +
        '<td class="text-start">' + escapeHtml(item.PatientName || "-") + '</td>' +
        '<td class="text-center">' + escapeHtml(item.HN || "-") + '</td>' +
        '<td class="text-end fw-bold text-primary">' + escapeHtml(item.Qty ?? 0) + '</td>' +
        '<td class="text-start">' + escapeHtml(item.User || "-") + '</td>' +
        '<td class="text-center text-muted small">' + (item.Timestamp ? new Date(item.Timestamp).toLocaleTimeString("th-TH", {hour:"2-digit", minute:"2-digit"}) : "-") + '</td>' +
        '</tr>';
    }).join("");

    contentDiv.innerHTML = cleanHtmlMarkup(
      '<div class="mb-3 d-flex justify-content-between align-items-center bg-light p-2 rounded border">' +
      '<span class="small fw-semibold text-secondary">' +
      '<i class="fas fa-list-check me-1 text-primary"></i> จำนวนรายการทั้งหมด: <b class="text-dark">' + list.length + '</b> รายการ' +
      '</span>' +
      '<span class="small fw-semibold text-secondary">' +
      '<i class="fas fa-pills me-1 text-success"></i> ปริมาณรวมที่ตัดจ่าย: <b class="text-dark fs-6">' + totalQty + '</b> หน่วย (แอมป์/ขวด)' +
      '</span>' +
      '</div>' +
      '<div class="table-responsive">' +
      '<table class="table table-bordered table-sm w-100 align-middle" style="font-size: 0.8rem;">' +
      '<thead style="background-color: #1e293b; color: white;">' +
      '<tr class="text-center align-middle">' +
      '<th style="width: 45px;">ลำดับ</th>' +
      '<th style="width: 100px;">วันที่จ่าย</th>' +
      '<th>ชื่อยาเสพติด (ขนาดยา)</th>' +
      '<th style="width: 90px;">LOT</th>' +
      '<th>ชื่อ-นามสกุล ผู้ป่วย</th>' +
      '<th style="width: 95px;">HN</th>' +
      '<th style="width: 80px;">จำนวนจ่าย</th>' +
      '<th style="width: 130px;">ผู้จ่าย (พยาบาล)</th>' +
      '<th style="width: 85px;">เวลาบันทึก</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' +
      rowsHtml +
      '</tbody>' +
      '<tfoot class="bg-light fw-bold">' +
      '<tr>' +
      '<td colspan="6" class="text-end">ยอดรวมการจ่ายทั้งหมด:</td>' +
      '<td class="text-end text-primary">' + totalQty + '</td>' +
      '<td colspan="2"></td>' +
      '</tr>' +
      '</tfoot>' +
      '</table>' +
      '</div>'
    );
  };

  window.initReportPage = async function () {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const pdfHosp = document.getElementById("pdf-hospital-name");
    if (pdfHosp) pdfHosp.innerText = getHospitalName();
    const pdfWard = document.getElementById("pdf-ward-name");
    if (pdfWard) pdfWard.innerText = "หอผู้ป่วย: " + getWardName();
    const printDateEl = document.getElementById("pdf-print-date");
    if (printDateEl) {
      printDateEl.innerText = "วันที่พิมพ์: " + new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH");
    }

    const now = new Date();
    const curYearMonth = now.toISOString().slice(0, 7);
    const monthInput = document.getElementById("report-month-input");
    if (monthInput && !monthInput.value) {
      monthInput.value = curYearMonth;
    }

    const startDateInput = document.getElementById("disburse-start-date");
    const endDateInput = document.getElementById("disburse-end-date");
    if (startDateInput && !startDateInput.value) {
      startDateInput.value = curYearMonth + "-01";
    }
    if (endDateInput && !endDateInput.value) {
      endDateInput.value = now.toISOString().slice(0, 10);
    }

    try {
      let masterData = getDrugMasterCache();
      if (!masterData || masterData.length === 0) {
        const masterRes = await GASApi.getDrugMaster();
        if (masterRes.success && Array.isArray(masterRes.data)) {
          masterData = masterRes.data;
          setDrugMasterCache(masterData);
        }
      }
      if (!masterData || masterData.length === 0) {
        const stockRes = await GASApi.getDrugStock();
        if (stockRes.success && Array.isArray(stockRes.data)) {
          masterData = stockRes.data;
        }
      }
      window.populateReportDrugDropdown(masterData || []);
    } catch (err) {
      console.warn("Unable to load report dropdown:", err);
    }

    const shiftBtn = document.getElementById("btn-generate-shift-report");
    if (shiftBtn && !shiftBtn.dataset.bound) {
      shiftBtn.dataset.bound = "1";
      shiftBtn.addEventListener("click", async function () {
        const monthVal = document.getElementById("report-month-input").value;
        if (!monthVal) {
          Swal.fire("แจ้งเตือน", "กรุณาเลือกปีและเดือนสำหรับรายงานตรวจนับ", "warning");
          return;
        }
        showLoading(true);
        try {
          const res = await GASApi.getMonthlyShiftCountReport(monthVal);
          showLoading(false);
          if (res.success) {
            window.renderShiftReportPreview(res.data || [], monthVal);
            document.getElementById("btn-download-pdf").classList.remove("disabled");
            window.__reportMode = "shift";
            window.__reportParam = monthVal;
          } else {
            Swal.fire("เกิดข้อผิดพลาด", res.message || "ไม่สามารถสร้างรายงานตรวจนับได้", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
        }
      });
    }

    const disburseBtn = document.getElementById("btn-generate-disburse-report");
    if (disburseBtn && !disburseBtn.dataset.bound) {
      disburseBtn.dataset.bound = "1";
      disburseBtn.addEventListener("click", async function () {
        const select = document.getElementById("report-drug-select");
        const drugID = select?.value || "";
        const drugName = select?.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0].text : "ทุกชนิดยา";
        const startDate = document.getElementById("disburse-start-date")?.value || "";
        const endDate = document.getElementById("disburse-end-date")?.value || "";

        showLoading(true);
        try {
          const res = await GASApi.getDisbursementReport(drugID, startDate, endDate);
          showLoading(false);
          if (res.success) {
            const allData = Array.isArray(res.data) ? res.data : [];
            window.renderDisburseReportPreview(allData, drugName, startDate, endDate);
            document.getElementById("btn-download-pdf").classList.remove("disabled");
            window.__reportMode = "disburse";
            window.__reportParam = drugID ? drugName : "all";
          } else {
            Swal.fire("เกิดข้อผิดพลาด", res.message || "ไม่สามารถสร้างรายงานตัดจ่ายได้", "error");
          }
        } catch (err) {
          showLoading(false);
          Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
        }
      });
    }

    const downloadBtn = document.getElementById("btn-download-pdf");
    if (downloadBtn && !downloadBtn.dataset.bound) {
      downloadBtn.dataset.bound = "1";
      downloadBtn.addEventListener("click", function () {
        if (this.classList.contains("disabled")) return;
        const printArea = document.getElementById("report-print-area");
        if (!printArea) return;

        showLoading(true);
        setTimeout(async () => {
          try {
            const { jsPDF } = window.jspdf;
            const canvas = await html2canvas(printArea, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              logging: false
            });

            const imgData = canvas.toDataURL("image/png");
            // A4 Landscape: width 297mm, height 210mm
            const pdf = new jsPDF("l", "mm", "a4");
            const pageWidth = 297;
            const pageHeight = 210;
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            while (heightLeft > 5) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
            }

            const mode = window.__reportMode || "report";
            const param = window.__reportParam ? ("-" + window.__reportParam) : "";
            pdf.save("report-" + mode + param + "-" + new Date().toISOString().slice(0, 10) + ".pdf");
            showLoading(false);
            showToast("ดาวน์โหลด PDF แนวนอนสำเร็จ");
          } catch (err) {
            showLoading(false);
            Swal.fire("เกิดข้อผิดพลาด", err.toString(), "error");
          }
        }, 300);
      });
    }
  };

  // --- Shift Count Page & Batch System ---
  function getBangkokDateString(date) {
    if (!date) return "";
    let d;
    if (typeof date === "string" && date.length === 10 && date.indexOf("-") === 4) {
      d = new Date(date + "T00:00:00+07:00");
    } else {
      d = new Date(date);
    }
    if (Number.isNaN(d.getTime())) return "";
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(d);
  }

  function formatThaiDate(value) {
    if (!value) return "-";
    let d;
    if (typeof value === "string" && value.length === 10 && value.indexOf("-") === 4) {
      d = new Date(value + "T00:00:00+07:00");
    } else {
      d = new Date(value);
    }
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
  }

  function formatThaiDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) + " " +
      d.toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit"
      });
  }

  function getCurrentBangkokShift() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "numeric",
      hour12: false
    });
    const hour = parseInt(formatter.format(now), 10);
    // 00.00-08.00 = เวรดึก, 08.00-16.00 = เวรเช้า, 16.00-24.00 = เวรบ่าย
    if (hour >= 0 && hour < 8) {
      return "ดึก";
    } else if (hour >= 8 && hour < 16) {
      return "เช้า";
    } else {
      return "บ่าย";
    }
  }

  function getSelectedShiftValue() {
    const checked = document.querySelector('input[name="shift-select"]:checked');
    return checked ? checked.value : "เช้า";
  }

  function getShiftLabel(shift) {
    const labels = {
      "เช้า": "เวรเช้า",
      "บ่าย": "เวรบ่าย",
      "ดึก": "เวรดึก"
    };
    return labels[shift] || shift || "-";
  }

  function getCurrentUserName() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user && user.name) return user.name;
    } catch (err) {}
    return "";
  }

  function isValidNumber(value) {
    return value !== "" && !Number.isNaN(Number(value)) && Number(value) >= 0;
  }

  function getShiftBatchTableRows() {
    const tbody = document.getElementById("shift-batch-tbody");
    return tbody ? Array.from(tbody.querySelectorAll("tr[data-drug-id]")) : [];
  }

  function updateShiftBatchRow(row) {
    if (!row) return;
    const ampInput = row.querySelector(".amp-remain-input");
    const emptyInput = row.querySelector(".empty-amp-input");
    const totalCell = row.querySelector(".count-total-cell");
    const resultCell = row.querySelector(".count-result-cell");
    const statusCell = row.querySelector(".count-status-cell");
    const actionBtn = row.querySelector(".row-save-btn");
    const target = parseFloat(row.dataset.target || "0");
    const expectedRemain = parseFloat(row.dataset.expectedRemain || "0");
    const unit = row.dataset.unit || "หน่วย";
    const ampValue = ampInput ? ampInput.value : "";
    const emptyValue = emptyInput ? emptyInput.value : "";
    const filled = isValidNumber(ampValue) && isValidNumber(emptyValue);
    const ampRemain = filled ? parseFloat(ampValue) : 0;
    const emptyAmp = filled ? parseFloat(emptyValue) : 0;
    const total = filled ? ampRemain + emptyAmp : null;
    const diff = filled ? total - target : null;
    const ampMatchesSystem = filled ? ampRemain === expectedRemain : null;
    const passed = filled && ampMatchesSystem && diff === 0;

    row.dataset.completed = filled ? "1" : "0";
    row.dataset.match = passed ? "1" : "0";
    row.dataset.difference = filled ? String(diff) : "";
    row.dataset.ampMismatch = filled && !ampMatchesSystem ? "1" : "0";

    if (statusCell) {
      statusCell.innerHTML = filled
        ? '<span class="badge bg-success-subtle text-success px-2 py-1"><i class="fas fa-circle-check me-1"></i>● ตรวจแล้ว</span>'
        : '<span class="badge bg-danger-subtle text-danger px-2 py-1"><i class="fas fa-circle-xmark me-1"></i>● ยังไม่นับ</span>';
    }

    if (totalCell) {
      totalCell.textContent = filled ? String(total) : "-";
    }

    if (resultCell) {
      if (!filled) {
        resultCell.innerHTML = '<span class="text-muted">-</span>';
      } else if (!ampMatchesSystem) {
        resultCell.innerHTML = '<span class="text-danger fw-semibold">✕ ยอดพร้อมใช้ไม่ตรงสต็อก</span>';
      } else if (diff === 0) {
        resultCell.innerHTML = '<span class="text-success fw-semibold">✓ ครบถ้วน</span>';
      } else if (diff < 0) {
        resultCell.innerHTML = '<span class="text-danger fw-semibold">✗ ยาขาด ' + Math.abs(diff) + ' ' + escapeHtml(unit) + '</span>';
      } else {
        resultCell.innerHTML = '<span class="text-danger fw-semibold">✗ ยาเกิน ' + diff + ' ' + escapeHtml(unit) + '</span>';
      }
    }

    if (actionBtn) {
      actionBtn.disabled = !filled;
      actionBtn.innerHTML = row.dataset.saved === "1"
        ? '<i class="fas fa-pen-to-square me-1"></i>แก้ไข'
        : '<i class="fas fa-floppy-disk me-1"></i>บันทึก';
    }

    row.classList.remove("table-success", "table-danger", "table-warning");
    if (!filled) {
      row.classList.add("table-warning");
    } else if (passed) {
      row.classList.add("table-success");
    } else {
      row.classList.add("table-danger");
    }
  }

  function updateShiftBatchSummary() {
    const rows = getShiftBatchTableRows();
    const total = rows.length;
    const completed = rows.filter(row => row.dataset.completed === "1").length;
    const mismatch = rows.filter(row => row.dataset.completed === "1" && row.dataset.match !== "1").length;
    const pending = total - completed;
    const ready = completed - mismatch;
    const summaryText = document.getElementById("shift-batch-summary-text");
    const summaryChecked = document.getElementById("shift-batch-summary-checked");
    const summaryPending = document.getElementById("shift-batch-summary-pending");
    const summaryMismatch = document.getElementById("shift-batch-summary-mismatch");
    const summaryReady = document.getElementById("shift-batch-summary-ready");
    const alertBox = document.getElementById("shift-batch-alert");
    const submitBtn = document.getElementById("btn-save-batch");

    if (summaryText) summaryText.textContent = "ตรวจสอบแล้ว " + completed + " จาก " + total + " รายการ";
    if (summaryChecked) summaryChecked.textContent = String(completed);
    if (summaryPending) summaryPending.textContent = String(pending);
    if (summaryMismatch) summaryMismatch.textContent = String(mismatch);
    if (summaryReady) summaryReady.textContent = String(ready);

    let alertType = "info";
    let alertMessage = "พร้อมตรวจนับต่อได้ทันที";
    // อนุญาตให้กดบันทึกได้แม้ผลไม่ตรง ตราบใดที่กรอกครบทุกแถว
    const disabled = total === 0 || pending > 0 || window.__shiftCountLoadingState;

    if (pending > 0) {
      alertType = "warning";
      alertMessage = "ยังมี " + pending + " รายการที่ยังไม่ได้นับครบ กรุณากรอกให้ครบทุกแถวก่อนส่งยอด";
    } else if (mismatch > 0) {
      alertType = "danger";
      alertMessage = "พบ " + mismatch + " รายการที่ยอดไม่ตรง สามารถกดบันทึกได้โดยระบบจะให้ระบุเหตุผล";
    } else if (total > 0) {
      alertType = "success";
      alertMessage = "ครบทุกแถวและผลตรวจสอบตรงทั้งหมด พร้อมบันทึกส่งตรวจเช็คยอด";
    }

    if (alertBox) {
      alertBox.className = "alert alert-" + alertType + " border-0 mb-0";
      alertBox.textContent = alertMessage;
    }

    if (submitBtn) {
      submitBtn.disabled = disabled;
    }
  }

  function getShiftBatchPayload(reasonsMap) {
    const selectedDate = document.getElementById("count-date-input")?.value || getBangkokDateString(new Date());
    const selectedShift = getSelectedShiftValue();
    const user = (document.getElementById("count-user-input")?.value || "").trim();
    const rows = getShiftBatchTableRows();

    return {
      Date: selectedDate,
      Shift: selectedShift,
      User: user,
      Items: rows.map(row => {
        const drugId = row.dataset.drugId;
        return {
          DrugID: drugId,
          AmpRemain: parseFloat(row.querySelector(".amp-remain-input")?.value || "0"),
          EmptyAmp: parseFloat(row.querySelector(".empty-amp-input")?.value || "0"),
          Note: (reasonsMap && reasonsMap[drugId]) || row.dataset.note || ""
        };
      })
    };
  }

  async function saveShiftBatchRows(rowList, reasonsMap) {
    const rows = Array.isArray(rowList) ? rowList : [];
    if (rows.length === 0) return;

    const payload = {
      Date: document.getElementById("count-date-input")?.value || getBangkokDateString(new Date()),
      Shift: getSelectedShiftValue(),
      User: (document.getElementById("count-user-input")?.value || "").trim() || getCurrentUserName(),
      Items: rows.map(row => {
        const drugId = row.dataset.drugId;
        return {
          DrugID: drugId,
          AmpRemain: parseFloat(row.querySelector(".amp-remain-input")?.value || "0"),
          EmptyAmp: parseFloat(row.querySelector(".empty-amp-input")?.value || "0"),
          Note: (reasonsMap && reasonsMap[drugId]) || row.dataset.note || ""
        };
      })
    };

    showLoading(true);
    try {
      const response = await GASApi.saveShiftCountBatch(payload);
      showLoading(false);
      if (!response.success) {
        Swal.fire("เกิดข้อผิดพลาด", response.message || "ไม่สามารถบันทึกตรวจนับได้", "error");
        return;
      }

      Swal.fire({
        icon: "success",
        title: "บันทึกสำเร็จ",
        html: "บันทึกแล้ว <b>" + escapeHtml(response.savedCount != null ? response.savedCount : rows.length) + "</b> รายการ"
      });

      await window.__reloadShiftCountTable();
    } catch (error) {
      showLoading(false);
      Swal.fire("เชื่อมต่อไม่สำเร็จ", error.toString(), "error");
    }
  }

  window.renderShiftCountTable = function (historyList) {
    const tbody = document.getElementById("shift-history-tbody");
    if (!tbody) return;

    if (window.__shiftCountHistoryTable && typeof window.__shiftCountHistoryTable.destroy === "function") {
      window.__shiftCountHistoryTable.destroy();
      window.__shiftCountHistoryTable = null;
    }

    tbody.closest("table")?.classList.add("stack-table-mobile");
    const rows = Array.isArray(historyList) ? historyList : [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ยังไม่มีประวัติการตรวจนับ</td></tr>';
      return;
    }

    tbody.innerHTML = cleanHtmlMarkup(rows.map(item => {
      const isCorrect = String(item.Result || "") === "ถูกต้อง";
      const noteBadge = item.Note ? '<div class="text-danger small mt-1"><i class="fas fa-comment-dots me-1"></i>' + escapeHtml(item.Note) + '</div>' : '';
      return `
        <tr>
          <td data-label="วันที่">${escapeHtml(formatShortDate(item.Date))}</td>
          <td data-label="เวร"><span class="badge bg-primary">${escapeHtml(getShiftLabel(item.Shift))}</span></td>
          <td data-label="ชื่อยา">${escapeHtml(item.DrugName || "-")} ${noteBadge}</td>
          <td data-label="แอมป์ดี" class="text-end">${escapeHtml(item.AmpRemain ?? 0)}</td>
          <td data-label="แอมป์เปล่า" class="text-end">${escapeHtml(item.EmptyAmp ?? 0)}</td>
          <td data-label="ยอดรวม" class="text-end fw-semibold">${escapeHtml(item.ExpectedTotal ?? 0)}</td>
          <td data-label="ผลตรวจสอบ" class="text-center ${isCorrect ? "text-success fw-semibold" : "text-danger fw-semibold"}">${isCorrect ? "✓ ครบถ้วน" : "✗ ไม่ตรง"}</td>
          <td data-label="ผู้บันทึก">${escapeHtml(item.User || "-")}</td>
        </tr>
      `;
    }).join(""));

    window.__shiftCountHistoryTable = $("#shift-history-table").DataTable({
      language: {
        url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/th.json"
      },
      order: [[0, "desc"]],
      pageLength: 10
    });
  };

  window.renderShiftBatchTable = function (masterList, historyList, selectedDate, selectedShift, stockList) {
    const tbody = document.getElementById("shift-batch-tbody");
    if (!tbody) return;

    tbody.closest("table")?.classList.add("stack-table-mobile");
    const masterRows = Array.isArray(masterList) ? masterList : [];
    const historyRows = Array.isArray(historyList) ? historyList : [];
    const stockRows = Array.isArray(stockList) ? stockList : (window.__shiftCountStockCache || getDrugStockCache());
    const expectedRemainMap = computeExpectedRemainByDrugID(stockRows);
    const map = new Map();
    historyRows.forEach(item => {
      if (getBangkokDateString(item.Date) === String(selectedDate || "") && String(item.Shift || "") === String(selectedShift || "")) {
        map.set(String(item.DrugID || ""), item);
      }
    });

    if (masterRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ยังไม่มีรายการยาในระบบ</td></tr>';
      updateShiftBatchSummary();
      return;
    }

    tbody.innerHTML = cleanHtmlMarkup(masterRows.map((item, index) => {
      const saved = map.get(String(item.DrugID || ""));
      const ampRemain = saved ? saved.AmpRemain ?? "" : "";
      const emptyAmp = saved ? saved.EmptyAmp ?? "" : "";
      const target = Number(item.StockWard || 0);
      const drugId = String(item.DrugID || "");
      const expectedRemain = expectedRemainMap.has(drugId) ? expectedRemainMap.get(drugId) : 0;
      const hasSaved = !!saved;
      const unit = item.Unit || "หน่วย";
      const filled = isValidNumber(ampRemain) && isValidNumber(emptyAmp);
      const total = filled ? Number(ampRemain) + Number(emptyAmp) : null;
      const diff = total === null ? null : total - target;
      const ampMatchesSystem = filled ? Number(ampRemain) === expectedRemain : null;
      const statusHtml = hasSaved
        ? '<span class="badge bg-success-subtle text-success px-2 py-1">● ตรวจแล้ว</span>'
        : '<span class="badge bg-danger-subtle text-danger px-2 py-1">● ยังไม่นับ</span>';
      const resultHtml = total === null
        ? '<span class="text-muted">-</span>'
        : !ampMatchesSystem
          ? '<span class="text-danger fw-semibold">✕ ยอดพร้อมใช้ไม่ตรงสต็อก</span>'
          : diff === 0
            ? '<span class="text-success fw-semibold">✓ ครบถ้วน</span>'
            : diff < 0
              ? '<span class="text-danger fw-semibold">✗ ยาขาด ' + Math.abs(diff) + ' ' + escapeHtml(unit) + '</span>'
              : '<span class="text-danger fw-semibold">✗ ยาเกิน ' + diff + ' ' + escapeHtml(unit) + '</span>';

      return `
        <tr data-drug-id="${escapeHtml(item.DrugID || "")}" data-target="${escapeHtml(target)}" data-unit="${escapeHtml(unit)}" data-saved="${hasSaved ? "1" : "0"}" data-expected-remain="${escapeHtml(expectedRemain)}">
          <td data-label="สถานะ" class="count-status-cell text-center">${statusHtml}</td>
          <td data-label="ชื่อยา" class="text-start">
            <div class="fw-bold text-dark" style="font-size: 0.9rem;">${escapeHtml(item.DrugName || "-")}</div>
            <small class="text-muted" style="font-size: 0.78rem;">${escapeHtml(item.Strength || "")}</small>
          </td>
          <td data-label="Stock Ward" class="text-center fw-bold text-primary" style="font-size: 0.95rem;">${escapeHtml(target)}</td>
          <td data-label="แอมป์ดี (พร้อมใช้)" class="text-center" style="width: 135px;">
            <input type="number" min="0" step="1" class="form-control form-control-sm amp-remain-input text-center fw-bold mx-auto py-1 px-2" style="max-width: 85px;" value="${escapeHtml(ampRemain)}" data-row-index="${index}" inputmode="numeric" aria-label="แอมป์ดี แถว ${index + 1}">
            <div class="small text-muted text-nowrap mt-1" style="font-size: 0.73rem;">คงเหลือ: <b class="text-dark">${escapeHtml(expectedRemain)}</b> ${escapeHtml(unit)}</div>
          </td>
          <td data-label="แอมป์เปล่า" class="text-center" style="width: 110px;">
            <input type="number" min="0" step="1" class="form-control form-control-sm empty-amp-input text-center fw-bold mx-auto py-1 px-2" style="max-width: 85px;" value="${escapeHtml(emptyAmp)}" data-row-index="${index}" inputmode="numeric" aria-label="แอมป์เปล่า แถว ${index + 1}">
          </td>
          <td data-label="ยอดรวม" class="count-total-cell text-center fw-bold" style="font-size: 0.95rem;">${total === null ? "-" : escapeHtml(total)}</td>
          <td data-label="ผลตรวจสอบ" class="count-result-cell text-center" style="font-size: 0.82rem;">${resultHtml}</td>
          <td data-label="Action" class="text-center">
            <button type="button" class="btn btn-outline-primary btn-sm py-1 px-2 row-save-btn" style="font-size: 0.78rem;" tabindex="-1" ${!filled ? "disabled" : ""}>
              <i class="fas fa-floppy-disk me-1"></i>${hasSaved ? "แก้ไข" : "บันทึก"}
            </button>
          </td>
        </tr>
      `;    }).join(""));

    if (!tbody.dataset.bound) {
      tbody.dataset.bound = "1";
      tbody.addEventListener("input", function (event) {
        const row = event.target.closest("tr[data-drug-id]");
        if (!row) return;
        updateShiftBatchRow(row);
        updateShiftBatchSummary();
      });

      tbody.addEventListener("keydown", function (event) {
        const input = event.target.closest(".amp-remain-input, .empty-amp-input");
        if (!input || event.key !== "Tab") return;

        const row = input.closest("tr[data-drug-id]");
        if (!row) return;

        if (input.classList.contains("amp-remain-input") && !event.shiftKey) {
          event.preventDefault();
          row.querySelector(".empty-amp-input")?.focus();
          return;
        }

        if (input.classList.contains("empty-amp-input") && !event.shiftKey) {
          event.preventDefault();
          const rows = getShiftBatchTableRows();
          const currentIndex = rows.indexOf(row);
          const nextRow = rows[currentIndex + 1];
          if (nextRow) {
            nextRow.querySelector(".amp-remain-input")?.focus();
          } else {
            row.querySelector(".row-save-btn")?.focus();
          }
          return;
        }

        if (input.classList.contains("empty-amp-input") && event.shiftKey) {
          event.preventDefault();
          row.querySelector(".amp-remain-input")?.focus();
        }
      });

      tbody.addEventListener("click", async function (event) {
        const button = event.target.closest(".row-save-btn");
        if (!button) return;
        const row = button.closest("tr[data-drug-id]");
        if (!row) return;
        const user = (document.getElementById("count-user-input")?.value || "").trim();
        if (!user) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกชื่อผู้ตรวจนับก่อนบันทึกข้อมูล", "warning");
          document.getElementById("count-user-input")?.focus();
          return;
        }

        if (row.dataset.completed !== "1") {
          Swal.fire("แจ้งเตือน", "กรุณากรอกข้อมูลให้ครบก่อนบันทึกแถวนี้", "warning");
          return;
        }

        const isMismatch = row.dataset.match !== "1";
        let reason = "";

        if (isMismatch) {
          const drugName = row.querySelector("td[data-label='ชื่อยา'] .fw-semibold")?.textContent || row.dataset.drugId;
          const { value: text, isConfirmed } = await Swal.fire({
            title: "ระบุเหตุผลที่ยอดไม่ตรง",
            html: "<div class='text-start small text-muted mb-2'>รายการ: <b class='text-dark'>" + escapeHtml(drugName) + "</b></div>",
            input: "textarea",
            inputPlaceholder: "กรุณาระบุเหตุผล เช่น ยาแตกเสียหาย, รอตัดจ่ายคนไข้ ฯลฯ",
            showCancelButton: true,
            confirmButtonText: "ยืนยันบันทึก",
            cancelButtonText: "ยกเลิก",
            inputValidator: (val) => {
              if (!val || !val.trim()) {
                return "กรุณาระบุเหตุผลก่อนบันทึก";
              }
            }
          });
          if (!isConfirmed) return;
          reason = (text || "").trim();
        }

        const reasonsMap = {};
        if (row.dataset.drugId) {
          reasonsMap[row.dataset.drugId] = reason;
        }
        await saveShiftBatchRows([row], reasonsMap);
      });
    }

    const renderedRows = getShiftBatchTableRows();
    renderedRows.forEach(updateShiftBatchRow);
    updateShiftBatchSummary();

    const firstInput = tbody.querySelector(".amp-remain-input");
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 0);
    }
  };

  async function loadShiftCountPageData() {
    const selectedDate = document.getElementById("count-date-input")?.value || getBangkokDateString(new Date());
    const selectedShift = getSelectedShiftValue();
    setInlineLoadingState("shift-batch-loading", true, "โปรดรอสักครู่ ระบบกำลังอัปเดตข้อมูลล่าสุด");
    const cachedMaster = Array.isArray(window.__shiftCountMasterCache) && window.__shiftCountMasterCache.length ? window.__shiftCountMasterCache : getDrugMasterCache();
    const cachedHistory = Array.isArray(window.__shiftCountHistoryCache) && window.__shiftCountHistoryCache.length ? window.__shiftCountHistoryCache : getShiftCountHistoryCache();
    const cachedStock = Array.isArray(window.__shiftCountStockCache) && window.__shiftCountStockCache.length ? window.__shiftCountStockCache : getDrugStockCache();

    if (cachedMaster.length || cachedHistory.length) {
      window.renderShiftBatchTable(cachedMaster, cachedHistory, selectedDate, selectedShift, cachedStock);
      window.renderShiftCountTable(cachedHistory.filter(item => getBangkokDateString(item.Date) === String(selectedDate || "") && String(item.Shift || "") === String(selectedShift || "")));
    } else {
      const batchTbody = document.getElementById("shift-batch-tbody");
      const historyTbody = document.getElementById("shift-history-tbody");
      renderEmptyRow(batchTbody, 8, "กำลังโหลดรายการยา...");
      renderEmptyRow(historyTbody, 8, "กำลังโหลดประวัติการตรวจนับ...");
    }

    const [masterRes, historyRes, stockRes] = await Promise.allSettled([
      GASApi.getDrugMaster(),
      GASApi.getShiftCountHistory(),
      GASApi.getDrugStock()
    ]);

    const masterOk = masterRes.status === "fulfilled" && masterRes.value && masterRes.value.success;
    const historyOk = historyRes.status === "fulfilled" && historyRes.value && historyRes.value.success;
    const stockOk = stockRes.status === "fulfilled" && stockRes.value && stockRes.value.success;
    const masterRows = masterOk ? (masterRes.value.data || []) : cachedMaster;
    const historyRows = historyOk ? (historyRes.value.data || []) : cachedHistory;
    const stockRows = stockOk ? (stockRes.value.data || []) : cachedStock;

    if (masterOk) {
      setDrugMasterCache(masterRows);
    }
    if (historyOk) {
      setShiftCountHistoryCache(historyRows);
    }
    if (stockOk) {
      setDrugStockCache(stockRows);
    }

    window.__shiftCountMasterCache = Array.isArray(masterRows) ? masterRows : [];
    window.__shiftCountHistoryCache = Array.isArray(historyRows) ? historyRows : [];
    window.__shiftCountStockCache = Array.isArray(stockRows) ? stockRows : [];
    window.renderShiftBatchTable(window.__shiftCountMasterCache, window.__shiftCountHistoryCache, selectedDate, selectedShift, window.__shiftCountStockCache);
    window.renderShiftCountTable(window.__shiftCountHistoryCache.filter(item => getBangkokDateString(item.Date) === String(selectedDate || "") && String(item.Shift || "") === String(selectedShift || "")));
    setInlineLoadingState("shift-batch-loading", false);
  }

  window.__reloadShiftCountTable = loadShiftCountPageData;

  window.initShiftCountPage = async function () {
    const dateInput = document.getElementById("count-date-input");
    const todayValue = getBangkokDateString(new Date());
    if (dateInput && !dateInput.value) {
      dateInput.value = todayValue;
    }

    const todayLabel = document.getElementById("shift-today-label");
    if (todayLabel) {
      todayLabel.textContent = "วันที่ปัจจุบัน: " + formatThaiDate(new Date());
    }

    const countUserInput = document.getElementById("count-user-input");
    if (countUserInput) {
      countUserInput.value = countUserInput.value || "";
    }

    const autoShift = getCurrentBangkokShift();
    const shiftRadio = document.querySelector('input[name="shift-select"][value="' + autoShift + '"]');
    if (shiftRadio) {
      shiftRadio.checked = true;
    }

    const refreshBtn = document.getElementById("btn-refresh-batch");
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "1";
      refreshBtn.addEventListener("click", async function () {
        await loadShiftCountPageData();
      });
    }

    const saveBtn = document.getElementById("btn-save-batch");
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = "1";
      saveBtn.addEventListener("click", async function () {
        const user = (document.getElementById("count-user-input")?.value || "").trim();
        if (!user) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกชื่อผู้ตรวจนับก่อนบันทึกข้อมูล", "warning");
          document.getElementById("count-user-input")?.focus();
          return;
        }

        const rows = getShiftBatchTableRows();
        const completedRows = rows.filter(row => row.dataset.completed === "1");
        const mismatchRows = rows.filter(row => row.dataset.completed === "1" && row.dataset.match !== "1");

        if (rows.length === 0) {
          Swal.fire("แจ้งเตือน", "ยังไม่มีรายการยาให้ตรวจนับ", "warning");
          return;
        }
        if (completedRows.length !== rows.length) {
          Swal.fire("แจ้งเตือน", "กรุณากรอกข้อมูลให้ครบทุกแถวก่อนส่งยอด", "warning");
          return;
        }

        if (mismatchRows.length > 0) {
          let mismatchFormHtml = '<div class="text-start mb-3"><p class="text-danger small fw-semibold mb-2"><i class="fas fa-triangle-exclamation me-1"></i>พบรายการยาที่ยอดไม่ตรง ' + mismatchRows.length + ' รายการ กรุณาระบุเหตุผลสำหรับแต่ละรายการ:</p>';
          
          mismatchRows.forEach((r, idx) => {
            const drugName = r.querySelector("td[data-label='ชื่อยา'] .fw-semibold")?.textContent || r.dataset.drugId;
            const target = r.dataset.target || "0";
            const ampVal = r.querySelector(".amp-remain-input")?.value || "0";
            const emptyVal = r.querySelector(".empty-amp-input")?.value || "0";
            const total = parseFloat(ampVal) + parseFloat(emptyVal);
            const expRemain = r.dataset.expectedRemain || "0";
            const unit = r.dataset.unit || "หน่วย";

            let issueDesc = [];
            if (parseFloat(ampVal) !== parseFloat(expRemain)) {
              issueDesc.push("ยอดพร้อมใช้ " + ampVal + " (คงเหลือในระบบ: " + expRemain + ")");
            }
            if (total !== parseFloat(target)) {
              issueDesc.push("ยอดรวม " + total + " (เป้าหมาย Stock: " + target + ")");
            }

            mismatchFormHtml += '<div class="card bg-light border p-3 mb-2 shadow-sm rounded-3">' +
              '<div class="d-flex justify-content-between align-items-center mb-1">' +
              '<span class="fw-bold text-dark"><i class="fas fa-pills me-1 text-primary"></i>' + escapeHtml(drugName) + '</span>' +
              '<span class="badge bg-danger">ไม่ตรง</span>' +
              '</div>' +
              '<div class="small text-muted mb-2">' +
              escapeHtml(issueDesc.join(" | ")) +
              '</div>' +
              '<label class="form-label small text-secondary mb-1">เหตุผลที่ไม่ตรง <span class="text-danger">*</span>:</label>' +
              '<div class="input-group input-group-sm mb-1">' +
              '<input type="text" class="form-control mismatch-reason-input" data-drug-id="' + escapeHtml(r.dataset.drugId) + '" placeholder="ระบุเหตุผล เช่น ยาแตกชำรุด, รอตัดจ่ายคนไข้, เบิกชดเชย ฯลฯ" required>' +
              '</div>' +
              '<div class="d-flex gap-1 flex-wrap mt-1">' +
              '<button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2 quick-reason-btn" style="font-size: 0.72rem;" data-reason="ยาแตก/ชำรุดเสียหาย">ยาแตก/ชำรุด</button>' +
              '<button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2 quick-reason-btn" style="font-size: 0.72rem;" data-reason="บันทึกตัดจ่ายตกหล่น/รอตัดจ่าย">รอตัดจ่ายคนไข้</button>' +
              '<button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2 quick-reason-btn" style="font-size: 0.72rem;" data-reason="อยู่ระหว่างรอเบิกชดเชยจากคลัง">รอเบิกชดเชย</button>' +
              '<button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2 quick-reason-btn" style="font-size: 0.72rem;" data-reason="ยอดยกมาจากเวรที่แล้วไม่ตรง">ยอดยกมาไม่ตรง</button>' +
              '</div>' +
              '</div>';
          });
          mismatchFormHtml += '</div>';

          const { value: reasons, isConfirmed } = await Swal.fire({
            title: 'ระบุเหตุผลรายการที่ยอดไม่ตรง',
            html: mismatchFormHtml,
            icon: 'warning',
            width: '650px',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-check me-1"></i> ยืนยันบันทึกข้อมูล',
            cancelButtonText: 'ยกเลิก',
            customClass: {
              confirmButton: 'btn btn-primary px-4',
              cancelButton: 'btn btn-secondary px-3'
            },
            didOpen: (popup) => {
              popup.querySelectorAll('.quick-reason-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                  const input = this.closest('.card').querySelector('.mismatch-reason-input');
                  if (input) {
                    input.value = this.dataset.reason;
                    input.focus();
                  }
                });
              });
            },
            preConfirm: () => {
              const inputs = document.querySelectorAll('.mismatch-reason-input');
              const resMap = {};
              let missing = false;
              inputs.forEach(inp => {
                const val = inp.value.trim();
                if (!val) missing = true;
                resMap[inp.dataset.drugId] = val;
              });
              if (missing) {
                Swal.showValidationMessage('กรุณาระบุเหตุผลให้ครบทุกรายการที่ไม่ตรง');
                return false;
              }
              return resMap;
            }
          });

          if (isConfirmed && reasons) {
            await saveShiftBatchRows(rows, reasons);
          }
          return;
        }

        // All matched
        await saveShiftBatchRows(rows);
      });
    }

    document.querySelectorAll('input[name="shift-select"]').forEach(input => {
      if (!input.dataset.bound) {
        input.dataset.bound = "1";
        input.addEventListener("change", async function () {
          localStorage.setItem("shiftcount_shift", this.value);
          await loadShiftCountPageData();
        });
      }
    });

    if (dateInput && !dateInput.dataset.bound) {
      dateInput.dataset.bound = "1";
      dateInput.addEventListener("change", async function () {
        await loadShiftCountPageData();
      });
    }

    const countForm = document.getElementById("shift-count-form");
    if (countForm && !countForm.dataset.bound) {
      countForm.dataset.bound = "1";
      countForm.addEventListener("submit", function (event) {
        event.preventDefault();
      });
    }

    showLoading(true);
    try {
      await loadShiftCountPageData();
    } finally {
      showLoading(false);
    }
  };

  // --- Dashboard Page ---
  function renderDashboardChart(stockList) {
    const canvas = document.getElementById("stockChart");
    if (!canvas) return;

    if (window.__dashboardChart && typeof window.__dashboardChart.destroy === "function") {
      window.__dashboardChart.destroy();
      window.__dashboardChart = null;
    }

    const rows = Array.isArray(stockList) ? stockList : [];
    const labels = rows.map(item => item.DrugName || "-");
    const data = rows.map(item => parseFloat(item.QtyRemain || 0));

    window.__dashboardChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "คงเหลือ (แอมป์/ขวด)",
          data: data,
          backgroundColor: "#3b82f6",
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  function renderExpiryList(alerts) {
    const list = document.getElementById("expiry-list");
    if (!list) return;

    const rows = Array.isArray(alerts) ? alerts : [];
    if (rows.length === 0) {
      list.innerHTML = '<div class="p-3 text-center text-muted">ไม่มียาใกล้หมดอายุ</div>';
      return;
    }

    list.innerHTML = cleanHtmlMarkup(rows.map(item => `
      <div class="list-group-item d-flex justify-content-between align-items-center border-0 border-bottom py-3">
        <div>
          <div class="fw-semibold">${escapeHtml(item.DrugName || "-")} <span class="badge bg-secondary">LOT ${escapeHtml(item.LOT || "-")}</span></div>
          <small class="text-secondary">หมดอายุ: ${escapeHtml(formatShortDate(item.ExpiryDate))}</small>
        </div>
        <span class="badge bg-warning text-dark px-3 py-2">${escapeHtml(item.DaysLeft ?? 0)} วัน</span>
      </div>
    `).join(""));
  }

  window.initDashboardPage = async function () {
    showLoading(true);
    try {
      const [dashRes, alertRes, stockRes] = await Promise.all([
        GASApi.getDashboardData(),
        GASApi.checkExpiryAlert(),
        GASApi.getDrugStock()
      ]);
      showLoading(false);

      if (dashRes.success) {
        const data = dashRes.data || {};
        const totalStock = document.getElementById("stat-total-stock");
        if (totalStock) totalStock.innerText = data.totalStock || 0;
        const totalItems = document.getElementById("stat-total-items");
        if (totalItems) totalItems.innerText = data.totalItems || 0;
        const todayDisbursement = document.getElementById("stat-today-disbursement");
        if (todayDisbursement) todayDisbursement.innerText = data.todayDisbursement || 0;
        const expiryAlerts = document.getElementById("stat-expiry-alerts");
        if (expiryAlerts) expiryAlerts.innerText = data.expiryAlerts || 0;
      }

      if (alertRes.success) {
        renderExpiryList(alertRes.data || []);
      }

      if (stockRes.success) {
        renderDashboardChart(stockRes.data || []);
      }
    } catch (err) {
      showLoading(false);
      console.error("Dashboard error:", err);
    }
  };

})();
