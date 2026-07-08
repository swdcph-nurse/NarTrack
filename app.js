/**
 * app.js
 * จัดการ logic ของแต่ละหน้าจอ จัดการการเชื่อมประสาน UI และประสานงานกับ API
 */

// แสดงและซ่อน Spinner
function showLoading(show) {
  const overlay = document.getElementById("loading-spinner-overlay");
  if (overlay) {
    if (show) overlay.classList.remove("d-none");
    else overlay.classList.add("d-none");
  }
}

// แสดง Toast Notification แบบรวดเร็ว
function showToast(title, icon = "success") {
  Swal.fire({
    title: title,
    icon: icon,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });
}

// ตรวจจับหน้าปัจจุบัน
const currentPage = window.location.pathname.split("/").pop();

document.addEventListener("DOMContentLoaded", async function() {
  // 1. ตรวจสอบการตั้งค่า API URL
  if (currentPage !== "index.html") {
    if (!GASApi.getApiUrl()) {
      const { value: url } = await Swal.fire({
        title: 'กำหนดค่าระบบ',
        text: 'กรุณากรอก Google Apps Script Web App API URL เพื่อเปิดใช้งานระบบ',
        input: 'text',
        inputPlaceholder: 'https://script.google.com/macros/s/.../exec',
        allowOutsideClick: false,
        confirmButtonText: 'บันทึก',
        inputValidator: (value) => {
          if (!value) {
            return 'กรุณากรอก URL ก่อนเริ่มต้นใช้งาน'
          }
        }
      });
      if (url) {
        GASApi.setApiUrl(url);
        showToast("บันทึก API URL สำเร็จ");
      }
    }

    // โหลดแถบเมนู
    if (typeof window.loadNavbar === "function") {
      await window.loadNavbar();
    }
    
    // ตั้งค่าผู้ปฏิบัติงานอัตโนมัติในฟอร์มต่างๆ (สามารถแก้ไขได้)
    const defaultUser = "เจ้าหน้าที่เวร";
    const createdByInput = document.getElementById("created-by-input");
    if (createdByInput) createdByInput.value = defaultUser;
    const disburseUserInput = document.getElementById("disburse-user-input");
    if (disburseUserInput) disburseUserInput.value = defaultUser;
    const countUserInput = document.getElementById("count-user-input");
    if (countUserInput) countUserInput.value = defaultUser;
  }

  // 2. ลงทะเบียน Service Worker สำหรับ PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registered successfully!', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));

    // รับ message จาก service worker (สำหรับ in-app notifications)
    navigator.serviceWorker.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'push' && msg.payload) {
        const title = msg.payload.title || 'ข้อความใหม่';
        const body = msg.payload.body || msg.payload.message || '';
        // ใช้ showToast ที่มีอยู่ (Swal) เพื่อแสดงข้อความแบบ in-app (ไม่มี system popup)
        showToast(`${title}: ${body}`, 'info');
      }
    });
  }

  // 3. เรียกใช้งานระบบตามหน้าจอ
  try {
    if (currentPage === "login.html") {
      if (typeof window.initLoginPage === "function") window.initLoginPage();
    } else if (currentPage === "dashboard.html") {
      if (typeof window.initDashboardPage === "function") await window.initDashboardPage();
    } else if (currentPage === "stock.html") {
      if (typeof window.initStockPage === "function") await window.initStockPage();
    } else if (currentPage === "disbursement.html") {
      if (typeof window.initDisbursementPage === "function") await window.initDisbursementPage();
    } else if (currentPage === "shiftcount.html") {
      if (typeof window.initShiftCountPage === "function") await window.initShiftCountPage();
    } else if (currentPage === "report.html") {
      if (typeof window.initReportPage === "function") await window.initReportPage();
    } else if (currentPage === "settings.html") {
      if (typeof window.initSettingsPage === "function") await window.initSettingsPage();
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการโหลดหน้าจอ:", error);
    showToast("ไม่สามารถเรียกข้อมูลจากระบบ: " + error.message, "error");
  }
});

/**
 * ----------------------------------------------------
 * หน้า: LOGIN.HTML
 * ----------------------------------------------------
 */
function initLoginPage() {
  const loginForm = document.getElementById("login-form");
  const initDbBtn = document.getElementById("btn-init-db");
  const apiUrlInput = document.getElementById("api-url-input");

  // ฟอร์มเข้าสู่ระบบ
  if (loginForm) {
    loginForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const apiUrl = apiUrlInput.value.trim();

      if (!apiUrl) {
        Swal.fire("แจ้งเตือน", "กรุณากรอก Google Apps Script Web App API URL ก่อนเข้าใช้งาน", "warning");
        return;
      }

      GASApi.setApiUrl(apiUrl);
      showLoading(true);

      try {
        const response = await GASApi.login(username, password);
        showLoading(false);
        
        if (response.success) {
          localStorage.setItem("user", JSON.stringify(response.user));
          Swal.fire({
            icon: 'success',
            title: 'เข้าสู่ระบบสำเร็จ',
            text: 'ยินดีต้อนรับ ' + response.user.name,
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            window.location.replace("dashboard.html");
          });
        } else {
          Swal.fire("ข้อผิดพลาด", response.message, "error");
        }
      } catch (err) {
        showLoading(false);
        Swal.fire("เข้าสู่ระบบล้มเหลว", "ไม่สามารถติดต่อ API ได้ กรุณาตรวจสอบความถูกต[...]");
      }
    });
  }

  // ปุ่มเริ่มต้นฐานข้อมูลใหม่
  if (initDbBtn) {
    initDbBtn.addEventListener("click", async function() {
      const apiUrl = apiUrlInput.value.trim();
      if (!apiUrl) {
        Swal.fire("แจ้งเตือน", "กรุณากรอก Google Apps Script Web App API URL ก่อนเริ่มใช้งาน", "warning");
        return;
      }

      GASApi.setApiUrl(apiUrl);
      
      Swal.fire({
        title: 'สร้างฐานข้อมูลใหม่?',
        text: 'ระบบจะเข้าไปสร้างชีตที่จำเป็นใน Spreadsheet และตั้งค่าเริ่มต้นให้คุณโ�[...]',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ตกลง, ดำเนินการ',
        cancelButtonText: 'ยกเลิก'
      }).then(async (result) => {
        if (result.isConfirmed) {
          showLoading(true);
          try {
            const response = await GASApi.initSystem();
            showLoading(false);
            if (response.success) {
              Swal.fire({
                title: 'เริ่มต้นระบบสำเร็จ!',
                html: `ระบบได้ทำการสร้างตารางเก็บข้อมูลยาเสพติดให้โทษเรียบร้อยแล้[...]`,
                icon: 'success'
              });
            } else {
              Swal.fire("ล้มเหลว", response.message, "error");
            }
          } catch (err) {
            showLoading(false);
            Swal.fire("เชื่อมต่อล้มเหลว", err.toString(), "error");
          }
        }
      });
    });
  }
}

/* ... rest of app.js remains unchanged ... */
