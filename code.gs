// Code.gs
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const sheetId = '1xYw7SjghLNXJKcGRnzAGcjlgan0Rn88QMIpiIpyXTUM';
    const preferredSheetName = 'Sheet1'; // <--- nếu tab của bạn tên khác, đổi ở đây (ví dụ 'Trang tính1')
    const ss = SpreadsheetApp.openById(sheetId);

    // Thử lấy sheet theo tên, nếu null thì fallback dùng sheet đầu tiên hoặc tạo mới
    let sheet = ss.getSheetByName(preferredSheetName);
    if (!sheet) {
      const all = ss.getSheets();
      if (all && all.length > 0) {
        sheet = all[0]; // dùng sheet đầu tiên nếu không có tab tên preferredSheetName
      } else {
        sheet = ss.insertSheet(preferredSheetName);
      }
    }

    // Nếu sheet rỗng, thêm header chuẩn
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Tên', 'ĐiểmNgu', 'Tuần', 'AvatarURL', 'ThờiGian']);
    }

    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
    if (action === 'vote') {
      return handleVote(e, sheet);
    } else if (action === 'getLeaderboard') {
      return handleGetLeaderboard(e, sheet);
    } else if (action === 'getStats') {
      return handleGetStats(e, sheet);
    } else {
      return createResponse({ success: true, message: 'API hoạt động!', endpoints: ['vote', 'getLeaderboard', 'getStats'] });
    }
  } catch (error) {
    return createResponse({ success: false, message: 'Lỗi: ' + error.toString() }, 500);
  }
}

function handleVote(e, sheet) {
  const name = e.parameter.name;
  const week = getCurrentWeek();
  const now = new Date();
  
  // Tìm xem đã có trong tuần này chưa
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name && parseInt(data[i][2]) === week) {
      foundRow = i;
      break;
    }
  }
  
  if (foundRow > 0) {
    // Cập nhật điểm
    const currentScore = parseInt(data[foundRow][1]) || 0;
    sheet.getRange(foundRow + 1, 2).setValue(currentScore + 1);
    sheet.getRange(foundRow + 1, 5).setValue(now.toISOString());
  } else {
    // Thêm mới
    const avatarMap = {
      'Cao Chấn Hải': 'image/sieýai.jpg',
      'Nguyễn Tuấn Duy': 'image/nguyentuanduy1.jpg',
      'Dương Anh Kiệt': 'image/kietduong.jpg',
      'Lê Đức Thành': 'image/AnhThanh.jpg',
      'Anh Nam Định': 'image/emnamdinh.jpg',
      'Idol Thành Đạt': 'image/thangmap.jpg',
      'Nguyễn Đình Anh Khoa': 'image/khoalun.jpg',
      'Con Đĩ Của Team': 'image/khoacao.jpg'
    };
    
    const avatar = avatarMap[name] || 'image/anhemdowny.jpg';
    sheet.appendRow([name, 1, week, avatar, now.toISOString()]);
  }
  
  return createResponse({ 
    success: true, 
    message: `Đã vote cho ${name}!`, 
    name: name,
    week: week
  });
}

function handleGetLeaderboard(e, sheet) {
  const week = e.parameter.week || getCurrentWeek();
  const limit = parseInt(e.parameter.limit) || 10;
  
  const data = sheet.getDataRange().getValues();
  const leaderboard = [];
  
  // Lấy dữ liệu của tuần này
  for (let i = 1; i < data.length; i++) {
    if (parseInt(data[i][2]) === parseInt(week)) {
      leaderboard.push({
        name: data[i][0],
        score: parseInt(data[i][1]) || 0,
        week: parseInt(data[i][2]),
        avatar: data[i][3] || 'image/anhemdowny.jpg',
        time: data[i][4]
      });
    }
  }
  
  // Sắp xếp theo điểm cao nhất
  leaderboard.sort((a, b) => b.score - a.score);
  
  // Giới hạn số lượng
  const topLeaderboard = leaderboard.slice(0, limit);
  
  // Tính tổng votes
  const totalVotes = leaderboard.reduce((sum, item) => sum + item.score, 0);
  
  return createResponse({
    success: true,
    week: week,
    totalVotes: totalVotes,
    leaderboard: topLeaderboard,
    timestamp: new Date().toISOString()
  });
}

function handleGetStats(e, sheet) {
  const data = sheet.getDataRange().getValues();
  const stats = {
    totalVotes: 0,
    totalPeople: 0,
    weeks: {},
    mostVoted: { name: '', score: 0 }
  };
  
  for (let i = 1; i < data.length; i++) {
    const score = parseInt(data[i][1]) || 0;
    const week = parseInt(data[i][2]);
    const name = data[i][0];
    
    stats.totalVotes += score;
    
    if (!stats.weeks[week]) {
      stats.weeks[week] = { votes: 0, people: 0 };
    }
    stats.weeks[week].votes += score;
    stats.weeks[week].people++;
    
    if (score > stats.mostVoted.score) {
      stats.mostVoted = { name: name, score: score };
    }
  }
  
  stats.totalPeople = new Set(data.slice(1).map(row => row[0])).size;
  
  return createResponse({
    success: true,
    stats: stats,
    currentWeek: getCurrentWeek()
  });
}

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.floor(diff / oneWeek) + 1;
}

function createResponse(data, statusCode = 200) {
  const response = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  // Thêm header CORS (cách này chắc chắn hoạt động)
  Object.defineProperty(response, 'headers', {
    value: {
      'Access-Control-Allow-Origin': '*'
    }
  });
  
  return response;
}
function doOptions() {
  return HtmlService
    .createHtmlOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}