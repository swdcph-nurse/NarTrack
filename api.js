/**
 * api.js
 * คลาสหรือฟังก์ชันจัดการติดต่อสื่อสารกับ Google Apps Script Web App API
 */

var GASApi = window.GASApi = window.GASApi || {
  // ดึงค่า URL ของ Web App จาก LocalStorage
  getApiUrl: function() {
    return localStorage.getItem("GAS_API_URL") || "";
  },

  // ตั้งค่า URL ของ Web App
  setApiUrl: function(url) {
    localStorage.setItem("GAS_API_URL", url.trim());
  },

  // ฟังก์ชันกลางสำหรับการยิง API
  request: async function(action, method = "GET", data = null) {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      throw new Error("ยังไม่ได้กำหนดค่า Google Apps Script Web App API URL");
    }

    let url = apiUrl;
    let options = {
      method: "POST", // GAS Web App แนะนำให้ส่งด้วย POST เพื่อป้องกันการติด Redirect และ CORS สำหรับข้อมูลขนาดใหญ่
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8" // จำเป็นต้องส่งเป็น text/plain สำหรับ GAS เพื่อเลี่ยง CORS preflight options
      }
    };

    // แปลงการร้องขอสำหรับ Web App
    if (method === "GET") {
      url += (url.includes("?") ? "&" : "?") + "action=" + action;
      if (data) {
        for (let key in data) {
          url += `&${key}=${encodeURIComponent(data[key])}`;
        }
      }
      options = {
        method: "GET",
        mode: "cors"
      };
    } else {
      // POST
      options.body = JSON.stringify({
        action: action,
        data: data,
        username: data?.username,
        password: data?.password
      });
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("API Request Failed:", error);
      throw error;
    }
  },

  // 1. ฟังก์ชันเริ่มต้นระบบตารางข้อมูล
  initSystem: async function() {
    return await this.request("initSystem", "POST");
  },

  // 2. ฟังก์ชันล็อกอินเข้าระบบ
  login: async function(username, password) {
    return await this.request("login", "POST", { username, password });
  },

  // 3. ฟังก์ชันรับยาเข้าสต็อก
  addDrugStock: async function(data) {
    return await this.request("addDrugStock", "POST", data);
  },

  // 4. ฟังก์ชันดึงสต็อกยาเสพติดทั้งหมด
  getDrugStock: async function() {
    return await this.request("getDrugStock", "GET");
  },

  // 5. ฟังก์ชันตัดจ่ายยาเสพติด
  disburseDrug: async function(data) {
    return await this.request("disburseDrug", "POST", data);
  },

  // 5.1 ชื่อเรียกแบบใหม่ให้สอดคล้องกับฝั่งหน้าเว็บ
  saveDisbursement: async function(data) {
    return await this.request("disburseDrug", "POST", data);
  },

  // 6. ฟังก์ชันบันทึกตรวจนับเวร
  saveShiftCount: async function(data) {
    return await this.request("saveShiftCount", "POST", data);
  },

  // 7. ดึงประวัติการตรวจนับ
  getShiftCountHistory: async function() {
    return await this.request("getShiftCountHistory", "GET");
  },

  // 8. ดึงข้อมูล Dashboard สรุป
  getDashboardData: async function() {
    return await this.request("getDashboardData", "GET");
  },

  // 9. ดึงประวัติแจ้งเตือนยาใกล้หมดอายุ
  checkExpiryAlert: async function() {
    return await this.request("checkExpiryAlert", "GET");
  },

  // 10. รายงานประวัติการตัดจ่าย
  getDisbursementReport: async function(drugID = "") {
    return await this.request("getDisbursementReport", "GET", { drugID });
  },

  // 11. รายงานตรวจนับประจำเวรรายเดือน
  getMonthlyShiftCountReport: async function(yearMonth) {
    return await this.request("getMonthlyShiftCountReport", "GET", { yearMonth });
  },

  // 12. ดึงรายการยาหลัก
  getDrugMaster: async function() {
    return await this.request("getDrugMaster", "GET");
  },

  // 13. บันทึกหรืออัปเดตรายการยาหลัก
  updateDrugMaster: async function(data) {
    return await this.request("updateDrugMaster", "POST", data);
  },

  saveShiftCountBatch: async function(data) {
    return await this.request("saveShiftCountBatch", "POST", data);
  }
};
