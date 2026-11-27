// ================================
// 校园跑步助手：真实 GPS 记录
// ================================

// 赣南师范大学蓉江校区近似中心
const campus = [25.7993, 114.88039];

// 初始化地图
const map = L.map("map").setView(campus, 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
}).addTo(map);

// 校园标记
L.marker(campus)
  .addTo(map)
  .bindPopup("赣南师范大学蓉江校区");

// 地图上的当前位置
let userMarker = null;

// 跑步轨迹
const routeLine = L.polyline([], {
  color: "#2468df",
  weight: 5
}).addTo(map);

// 跑步状态
let running = false;
let watchId = null;
let timerId = null;

let startTime = 0;
let elapsed = 0;
let distance = 0;
let lastPoint = null;

// 获取页面元素
const $ = id => document.getElementById(id);

// 时间格式
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s]
    .map(v => String(v).padStart(2, "0"))
    .join(":");
}

// 计算两个 GPS 点之间的距离
function getDistance(a, b) {
  const R = 6371000;
  const rad = x => x * Math.PI / 180;

  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) *
    Math.cos(rad(b.lat)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R *
    Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// 更新显示
function updateDisplay() {
  const seconds = elapsed +
    (Date.now() - startTime) / 1000;

  $("timer").textContent = formatTime(seconds);

  $("distance").textContent =
    (distance / 1000).toFixed(2);

  if (distance > 0 && seconds > 0) {
    const pace = seconds / (distance / 1000);

    const mins = Math.floor(pace / 60);
    const secs = Math.floor(pace % 60);

    $("pace").textContent =
      mins + "'" + String(secs).padStart(2, "0") + '"';
  } else {
    $("pace").textContent = "--";
  }
}

// 更新当前位置
function updateMarker(point) {
  if (!userMarker) {
    userMarker = L.marker([point.lat, point.lon])
      .addTo(map)
      .bindPopup("当前位置");
  } else {
    userMarker.setLatLng([point.lat, point.lon]);
  }
}

// GPS 数据处理
function onPosition(position) {
  if (!running) return;

  const coords = position.coords;

  // 精度太低的数据暂时不用于计算
  if (coords.accuracy > 35) {
    $("mapStatus").textContent =
      "GPS 精度较低，正在等待更准确的位置：" +
      Math.round(coords.accuracy) + " 米";
    return;
  }

  const point = {
    lat: coords.latitude,
    lon: coords.longitude,
    time: position.timestamp
  };

  updateMarker(point);

  if (lastPoint) {
    const meters = getDistance(lastPoint, point);

    const seconds =
      (point.time - lastPoint.time) / 1000;

    const speed = meters / seconds;

    // 排除异常跳点
    if (
      seconds > 0 &&
      seconds <= 15 &&
      meters >= 2 &&
      speed <= 7
    ) {
      distance += meters;

      routeLine.addLatLng([
        point.lat,
        point.lon
      ]);
    } else if (seconds > 15) {
      // GPS中断时间太长，不计算这段距离
      routeLine.addLatLng([
        point.lat,
        point.lon
      ]);
    }
  } else {
    routeLine.addLatLng([
      point.lat,
      point.lon
    ]);
  }

  lastPoint = point;

  map.setView([point.lat, point.lon], 17);

  $("mapStatus").textContent =
    "GPS正常 · 定位精度约 " +
    Math.round(coords.accuracy) + " 米";

  updateDisplay();
}

// GPS 错误处理
function onLocationError(error) {
  const messages = {
    1: "请允许浏览器使用定位权限",
    2: "暂时无法获取 GPS 位置，请检查定位服务",
    3: "定位超时，请到室外重试"
  };

  $("mapStatus").textContent =
    messages[error.code] || error.message;
}

// 定位按钮
$("locateBtn").addEventListener("click", function () {
  if (!navigator.geolocation) {
    $("mapStatus").textContent =
      "当前浏览器不支持 GPS";
    return;
  }

  $("mapStatus").textContent =
    "正在获取当前位置...";

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const point = {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };

      updateMarker(point);

      map.setView([
        point.lat,
        point.lon
      ], 17);

      $("mapStatus").textContent =
        "定位成功，精度约 " +
        Math.round(position.coords.accuracy) + " 米";
    },
    onLocationError,
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
});

// 开始真实跑步
$("startBtn").addEventListener("click", function () {
  if (!navigator.geolocation) {
    alert("浏览器不支持 GPS 定位");
    return;
  }

  if (!window.isSecureContext) {
    alert("请使用 HTTPS 网站打开跑步助手");
    return;
  }

  if (!confirm("确定开始记录真实跑步吗？")) {
    return;
  }

  running = true;
  distance = 0;
  elapsed = 0;
  lastPoint = null;

  routeLine.setLatLngs([]);

  startTime = Date.now();

  $("startBtn").disabled = true;
  $("stopBtn").disabled = false;

  $("mapStatus").textContent =
    "正在获取 GPS，请稍候...";timerId = setInterval(updateDisplay, 1000);

  watchId = navigator.geolocation.watchPosition(
    onPosition,
    onLocationError,
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    }
  );
});

// 结束跑步并保存
$("stopBtn").addEventListener("click", function () {
  if (!running) return;

  running = false;

  elapsed += (Date.now() - startTime) / 1000;

  clearInterval(timerId);

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;

  $("mapStatus").textContent = "本次跑步已结束";

  updateDisplay();

  if (distance < 10) {
    alert("本次有效 GPS 距离不足 10 米，未保存记录。");
    return;
  }

  const records = JSON.parse(
    localStorage.getItem("campusRuns") || "[]"
  );

  records.unshift({
    date: new Date().toLocaleString(),
    distance: Number((distance / 1000).toFixed(2)),
    time: Math.round(elapsed)
  });

  localStorage.setItem(
    "campusRuns",
    JSON.stringify(records)
  );

  loadHistory();

  alert("跑步记录已保存！");
});

// 加载历史记录
function loadHistory() {
  const records = JSON.parse(
    localStorage.getItem("campusRuns") || "[]"
  );

  const box = $("history");
  box.replaceChildren();

  if (records.length === 0) {
    box.textContent = "暂无跑步记录";
    return;
  }

  records.forEach(record => {
    const item = document.createElement("div");
    item.className = "record";

    const title = document.createElement("strong");
    title.textContent =
      record.distance + " 公里";

    const detail = document.createElement("div");
    detail.textContent =
      record.date + " · 用时 " +
      formatTime(record.time);

    item.append(title, detail);
    box.appendChild(item);
  });
}

// 页面打开时读取历史记录
loadHistory();