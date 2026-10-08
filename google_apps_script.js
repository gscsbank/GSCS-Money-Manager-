/**
 * =========================================================================
 * Galapitiyagama Sanasa Bank - Member Analytics & Promotions Engine
 * Google Apps Script Web App Backend (Code.gs)
 * =========================================================================
 */

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Members Analytics Sheet
  let membersSheet = ss.getSheetByName("Members");
  if (!membersSheet) {
    membersSheet = ss.insertSheet("Members");
    const headers = [
      "Member ID", "Full Name", "Phone Number", "Sanasa Account No", 
      "Total Balance (LKR)", "Monthly Income (LKR)", "Monthly Expense (LKR)", 
      "Total Outside Loans (LKR)", "Active Loans Count", "Active Goals Count", 
      "Registered Date", "Last Synced Time", "Status / Notes"
    ];
    membersSheet.appendRow(headers);
    membersSheet.getRange(1, 1, 1, headers.length)
      .setBackground("#059669")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
    membersSheet.setFrozenRows(1);
  }

  // 2. Announcements & Promotions Sheet
  let promoSheet = ss.getSheetByName("Promotions");
  if (!promoSheet) {
    promoSheet = ss.insertSheet("Promotions");
    const promoHeaders = [
      "Promo ID", "Title", "Message", "Badge / Tag", 
      "Action Button Text", "Action Phone / Link", "Is Active (TRUE/FALSE)", "Created Date"
    ];
    promoSheet.appendRow(promoHeaders);
    promoSheet.getRange(1, 1, 1, promoHeaders.length)
      .setBackground("#0284c7")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
    promoSheet.setFrozenRows(1);

    promoSheet.appendRow([
      "PROMO-001",
      "සණස විශේෂ ස්ථාවර තැන්පතු පොලී අනුපාත!",
      "ඔබේ අතිරික්ත මුදල් සඳහා ඉහළම ආරක්ෂාව සහ වැඩිම පොලියක් ලබාගන්න අදම ගලපිටියාගම සණස බැංකු ශාඛාව අමතන්න.",
      "Special FD Offer",
      "ශාඛාව අමතන්න",
      "0752895951",
      "TRUE",
      new Date().toLocaleDateString()
    ]);
  }
}

function doGet(e) {
  setupSheets();
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getPromo";
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === "getPromo") {
    const promoSheet = ss.getSheetByName("Promotions");
    const data = promoSheet.getDataRange().getValues();
    let activePromo = null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isActive = String(row[6]).toUpperCase().trim() === "TRUE";
      if (isActive) {
        activePromo = {
          id: row[0],
          title: row[1],
          message: row[2],
          badge: row[3],
          buttonText: row[4],
          actionTarget: row[5]
        };
        break;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", promo: activePromo }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getAdminData") {
    const membersSheet = ss.getSheetByName("Members");
    const mData = membersSheet.getDataRange().getValues();
    const members = [];
    for (let i = 1; i < mData.length; i++) {
      const r = mData[i];
      members.push({
        memberId: r[0],
        name: r[1],
        phone: r[2],
        accountNo: r[3],
        totalBalance: r[4],
        monthlyIncome: r[5],
        monthlyExpense: r[6],
        totalLoans: r[7],
        loansCount: r[8],
        goalsCount: r[9],
        registeredDate: r[10],
        lastSynced: r[11]
      });
    }

    // Also return active promo for admin
    const promoSheet = ss.getSheetByName("Promotions");
    const pData = promoSheet.getDataRange().getValues();
    let currentPromo = null;
    for (let i = 1; i < pData.length; i++) {
      const row = pData[i];
      if (String(row[6]).toUpperCase().trim() === "TRUE") {
        currentPromo = {
          id: row[0],
          title: row[1],
          message: row[2],
          badge: row[3],
          buttonText: row[4],
          actionTarget: row[5],
          isActive: true
        };
        break;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", members: members, currentPromo: currentPromo }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── savePromo via GET (avoids no-cors POST issues from admin panel) ──────
  if (action === "savePromo") {
    const promoSheet = ss.getSheetByName("Promotions");
    const title       = e.parameter.title       || "";
    const message     = e.parameter.message     || "";
    const badge       = e.parameter.badge       || "Special Offer";
    const buttonText  = e.parameter.buttonText  || "විමසන්න";
    const actionTarget = e.parameter.actionTarget || "0752895951";
    const promoId     = "PROMO-" + Date.now();
    const nowStr      = new Date().toLocaleDateString();

    // Deactivate all old promos
    const allData = promoSheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      promoSheet.getRange(i + 1, 7).setValue("FALSE");
    }

    // Append new active promo row
    promoSheet.appendRow([promoId, title, message, badge, buttonText, actionTarget, "TRUE", nowStr]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", promoId: promoId }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  setupSheets();
  try {
    const contents = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. If Action is Save Promo / Notification Campaign
    if (contents.action === "savePromo") {
      const promoSheet = ss.getSheetByName("Promotions");
      const title = contents.title || "";
      const message = contents.message || "";
      const badge = contents.badge || "Special Offer";
      const buttonText = contents.buttonText || "විමසන්න";
      const actionTarget = contents.actionTarget || "0752895951";
      const promoId = "PROMO-" + Date.now();
      const nowStr = new Date().toLocaleDateString();

      // Deactivate old active promos if needed
      const data = promoSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        promoSheet.getRange(i + 1, 7).setValue("FALSE");
      }

      // Add new active promo
      promoSheet.appendRow([
        promoId, title, message, badge, buttonText, actionTarget, "TRUE", nowStr
      ]);

      return ContentService.createTextOutput(JSON.stringify({ status: "success", promoId: promoId }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Member Sync Handling
    const membersSheet = ss.getSheetByName("Members");
    const data = membersSheet.getDataRange().getValues();

    const memberId = contents.memberId || ("SANASA-" + Date.now());
    const name = contents.name || "";
    const phone = contents.phone || "";
    const accountNo = contents.accountNo || "";
    const totalBalance = Number(contents.totalBalance || 0);
    const monthlyIncome = Number(contents.monthlyIncome || 0);
    const monthlyExpense = Number(contents.monthlyExpense || 0);
    const totalLoans = Number(contents.totalLoans || 0);
    const loansCount = Number(contents.loansCount || 0);
    const goalsCount = Number(contents.goalsCount || 0);
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" });

    let existingRowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if ((phone && String(row[2]).trim() === String(phone).trim()) || 
          (accountNo && accountNo !== "N/A" && String(row[3]).trim() === String(accountNo).trim()) || 
          (memberId && String(row[0]).trim() === String(memberId).trim())) {
        existingRowIndex = i + 1;
        break;
      }
    }

    if (existingRowIndex > 0) {
      membersSheet.getRange(existingRowIndex, 2).setValue(name);
      membersSheet.getRange(existingRowIndex, 3).setValue(phone);
      membersSheet.getRange(existingRowIndex, 4).setValue(accountNo);
      membersSheet.getRange(existingRowIndex, 5).setValue(totalBalance);
      membersSheet.getRange(existingRowIndex, 6).setValue(monthlyIncome);
      membersSheet.getRange(existingRowIndex, 7).setValue(monthlyExpense);
      membersSheet.getRange(existingRowIndex, 8).setValue(totalLoans);
      membersSheet.getRange(existingRowIndex, 9).setValue(loansCount);
      membersSheet.getRange(existingRowIndex, 10).setValue(goalsCount);
      membersSheet.getRange(existingRowIndex, 12).setValue(nowStr);
    } else {
      membersSheet.appendRow([
        memberId, name, phone, accountNo,
        totalBalance, monthlyIncome, monthlyExpense,
        totalLoans, loansCount, goalsCount,
        nowStr, nowStr, "Active Member"
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", memberId: memberId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
