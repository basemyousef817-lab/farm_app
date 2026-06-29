// ============================================
// 0. نظام تسجيل الدخول
// ============================================
const USERS = [
    { username: 'admin', password: '123456' },
    { username: 'yousef', password: 'gis2024' },
    { username: 'user', password: '123' }
];

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        if (typeof initializeApp === 'function') initializeApp();
        errorEl.style.display = 'none';
    } else {
        errorEl.style.display = 'block';
        document.getElementById('username').style.borderColor = '#e76f51';
        document.getElementById('password').style.borderColor = '#e76f51';
        setTimeout(() => {
            document.getElementById('username').style.borderColor = '';
            document.getElementById('password').style.borderColor = '';
        }, 2000);
    }
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    document.getElementById('app-content').style.display = 'none';
    document.getElementById('login-page').style.display = 'flex';
    if (map) { map.remove(); map = null; }
    window.mapInitialized = false;
}

function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        initializeApp();
    } else {
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const loginPage = document.getElementById('login-page');
        if (loginPage.style.display !== 'none') login();
    }
});

// ============================================
// 1. تهيئة الخريطة والمتغيرات
// ============================================
let map = null;
let baseLayer = null;
let farms = [];
let markers = [];
let selectedFarmId = null;
let isAddingMode = false;
let satelliteLayer = null;
let ndviLayer = null;
let cropChart = null;
let currentMapType = 'osm';
const categories = ['عضوية', 'تقليدية', 'تجريبية', 'مروية', 'بعلية'];

// ============================================
// 2. المزارع الحقيقية (غرب المنيا - مصر)
// ============================================
const defaultFarms = [
    {
        id: 1,
        name: 'مزرعة النيل للاستصلاح',
        lat: 28.0321,
        lng: 30.6112,
        area: 150,
        irrigated: 110,
        crop: 'قمح',
        status: 'نشطة',
        owner: 'أحمد محمد',
        category: 'عضوية'
    },
    {
        id: 2,
        name: 'مزرعة الفيوم الجديدة',
        lat: 28.0521,
        lng: 30.6912,
        area: 200,
        irrigated: 160,
        crop: 'برتقال',
        status: 'نشطة',
        owner: 'سارة علي',
        category: 'مروية'
    },
    {
        id: 3,
        name: 'مزرعة الوادي للاستثمار',
        lat: 28.0121,
        lng: 30.6412,
        area: 300,
        irrigated: 220,
        crop: 'زيتون',
        status: 'قيد التطوير',
        owner: 'محمد إبراهيم',
        category: 'تقليدية'
    },
    {
        id: 4,
        name: 'مزرعة الأمل للتنمية',
        lat: 28.0721,
        lng: 30.5712,
        area: 80,
        irrigated: 50,
        crop: 'خضروات',
        status: 'جديدة',
        owner: 'نورا حسن',
        category: 'تجريبية'
    }
];

// ============================================
// 3. تهيئة التطبيق
// ============================================
function initializeApp() {
    if (!window.mapInitialized) {
        window.mapInitialized = true;
        initMap();
        loadFarms();
        reloadMarkers();
        console.log('✅ نظام GIS جاهز!');
        console.log(`👤 مرحباً ${localStorage.getItem('username')}`);
    }
}

function initMap() {
    map = L.map('map').setView([28.0421, 30.6312], 11);
    baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);
}

// ============================================
// 4. إدارة المزارع
// ============================================
function loadFarms() {
    const saved = localStorage.getItem('farms');
    if (saved) {
        farms = JSON.parse(saved);
        console.log('📂 تم استرجاع البيانات');
        return true;
    }
    // تحميل المزارع الحقيقية
    farms = JSON.parse(JSON.stringify(defaultFarms));
    saveFarms();
    return false;
}

function saveFarms() {
    localStorage.setItem('farms', JSON.stringify(farms));
    console.log('✅ تم حفظ البيانات');
}

function reloadMarkers() {
    if (!map) return;
    markers.forEach(({ marker }) => map.removeLayer(marker));
    markers = [];
    farms.forEach((farm, index) => {
        const icon = L.divIcon({ className: 'farm-marker', html: index + 1, iconSize: [24, 24], iconAnchor: [12, 12] });
        const marker = L.marker([farm.lat, farm.lng], { icon }).addTo(map)
            .bindPopup(`<strong>${farm.name}</strong><br><span>📍 ${farm.owner}</span><br><span>🌾 ${farm.crop}</span><br><span>📐 ${farm.area} ف</span>`);
        marker.on('click', () => showFarmDetails(farm.id));
        markers.push({ marker, farm });
    });
    updateStats();
    if (farms.length > 0) {
        showFarmDetails(farms[0].id);
    } else {
        document.getElementById('farm-details').innerHTML = '<p style="color:#999;text-align:center;">لا توجد مزارع. اضغط "إدخال يدوي" لإضافة مزرعة جديدة</p>';
    }
}

// ============================================
// 5. عرض التفاصيل مع زر الحذف
// ============================================
function showFarmDetails(farmId) {
    const farm = farms.find(f => f.id === farmId);
    if (!farm) return;
    selectedFarmId = farmId;
    if (!farm.category) farm.category = 'غير مصنف';
    
    let categoryButtons = categories.map(cat => 
        `<button class="category-btn ${farm.category === cat ? 'active' : ''}" onclick="changeCategory(${farm.id}, '${cat}')">${cat}</button>`
    ).join('');
    
    const statusColor = farm.status === 'نشطة' ? '#2d6a4f' : '#e76f51';
    const statusBadge = farm.status === 'نشطة' ? '' : 'warning';
    
    let ndviHTML = '';
    if (farm.ndvi !== undefined && farm.ndvi !== null) {
        ndviHTML = `
            <p><span class="label">🛰️ NDVI:</span> <span style="background:${farm.ndviColor || '#999'};padding:1px 8px;border-radius:8px;color:white;font-size:10px;">${farm.ndvi}</span></p>
            <p><span class="label">📊 الحالة:</span> <span style="color:${farm.ndviColor || '#999'}">${farm.ndviStatus || 'غير محدد'}</span></p>
            ${farm.ndviRecommendation ? `<p style="font-size:10px;background:#f8fafc;padding:4px;border-radius:4px;margin-top:3px;">💡 ${farm.ndviRecommendation}</p>` : ''}
            ${farm.analysisSource ? `<p style="font-size:8px;color:#999;">📡 ${farm.analysisSource}</p>` : ''}
            <p style="font-size:9px;color:#999;">📅 ${farm.lastAnalysis || 'لم يتم'}</p>
            ${farm.cost ? `<p style="font-size:10px;color:#333;"><span class="label">💰 التكلفة:</span> $${farm.cost}</p>` : ''}
            ${farm.profit ? `<p style="font-size:10px;color:#333;"><span class="label">📈 الربح:</span> $${farm.profit}</p>` : ''}
        `;
    } else {
        ndviHTML = `<p style="font-size:10px;color:#999;"><i class="fas fa-satellite"></i> اضغط "تحليل القمر"</p>`;
    }
    
    document.getElementById('farm-details').innerHTML = `
        <div class="farm-card">
            <p><span class="label">🌿 ${farm.name}</span></p>
            <p><span class="label">👤 ${farm.owner}</span></p>
            <p><span class="label">🌾 ${farm.crop}</span></p>
            <p><span class="label">📐 ${farm.area} ف</span></p>
            <p><span class="label">💧 ${farm.irrigated} ف (${Math.round(farm.irrigated/farm.area*100)}%)</span></p>
            <p><span class="label">📊</span> <span class="badge ${statusBadge}" style="background:${statusColor}">${farm.status}</span></p>
            <p><span class="label">🏷️</span> <span style="background:#e8f5e9;padding:1px 8px;border-radius:8px;font-size:10px;">${farm.category}</span></p>
            ${ndviHTML}
            <p style="font-size:9px;color:#666;margin-top:3px;"><span class="label">التصنيف:</span><br>${categoryButtons}</p>
            <button onclick="deleteFarm(${farm.id})" style="margin-top:8px;padding:4px 12px;background:#c0392b;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;width:100%;">
                🗑️ حذف المزرعة
            </button>
        </div>
    `;
    map.setView([farm.lat, farm.lng], 13);
}

// ============================================
// 6. حذف المزرعة
// ============================================
function deleteFarm(farmId) {
    const farm = farms.find(f => f.id === farmId);
    if (!farm) return;
    
    if (confirm(`⚠️ هل أنت متأكد من حذف "${farm.name}"؟\nهذا الإجراء لا يمكن التراجع عنه.`)) {
        // حذف من المصفوفة
        farms = farms.filter(f => f.id !== farmId);
        saveFarms();
        reloadMarkers();
        alert(`✅ تم حذف "${farm.name}" بنجاح`);
    }
}

// ============================================
// 7. باقي الدوال (بدون تغيير)
// ============================================
function changeCategory(farmId, newCategory) {
    const farm = farms.find(f => f.id === farmId);
    if (!farm) return;
    farm.category = newCategory;
    saveFarms();
    showFarmDetails(farmId);
    updateChart();
}

function updateStats() {
    document.getElementById('farm-count').textContent = farms.length;
    document.getElementById('total-area').textContent = farms.reduce((sum, f) => sum + f.area, 0);
    document.getElementById('irrigated-area').textContent = farms.reduce((sum, f) => sum + f.irrigated, 0);
    updateChart();
}

function updateChart() {
    const ctx = document.getElementById('cropChart').getContext('2d');
    const cropCount = {};
    farms.forEach(farm => { cropCount[farm.crop] = (cropCount[farm.crop] || 0) + 1; });
    const labels = Object.keys(cropCount);
    const data = Object.values(cropCount);
    const colors = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc'];
    if (cropChart) cropChart.destroy();
    if (labels.length > 0) {
        cropChart = new Chart(ctx, {
            type: 'pie',
            data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderColor: '#ffffff', borderWidth: 1 }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 8 } } } } }
        });
    }
}

// ============================================
// 8. إضافة مزرعة بالضغط على الخريطة
// ============================================
function enableAddMode() {
    isAddingMode = !isAddingMode;
    const btn = document.getElementById('add-mode-btn');
    if (isAddingMode) {
        btn.textContent = '❌ إلغاء';
        btn.style.background = 'rgba(255,0,0,0.3)';
        map.getContainer().style.cursor = 'crosshair';
        alert('🔍 اضغط على الخريطة لإضافة مزرعة');
    } else {
        btn.textContent = '➕ إضافة مزرعة';
        btn.style.background = '';
        map.getContainer().style.cursor = '';
    }
}

map.on('click', function(e) {
    if (!isAddingMode) return;
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const farmName = prompt('✏️ اسم المزرعة:');
    if (!farmName) { isAddingMode = false; document.getElementById('add-mode-btn').textContent = '➕ إضافة مزرعة'; map.getContainer().style.cursor = ''; return; }
    const crop = prompt('🌾 المحصول:', 'قمح');
    const area = prompt('📐 المساحة:', '100');
    const owner = prompt('👤 المالك:', 'مزارع جديد');
    addFarmToSystem(farmName, lat, lng, parseFloat(area) || 100, crop || 'غير محدد', owner || 'غير محدد');
    isAddingMode = false;
    document.getElementById('add-mode-btn').textContent = '➕ إضافة مزرعة';
    map.getContainer().style.cursor = '';
});

// ============================================
// 9. إضافة مزرعة يدوي
// ============================================
function openAddFarmForm() {
    document.getElementById('farm-form-modal').style.display = 'flex';
    document.getElementById('f-name').value = '';
    document.getElementById('f-owner').value = '';
    document.getElementById('f-crop').value = '';
    document.getElementById('f-area').value = '';
    document.getElementById('f-lat').value = '';
    document.getElementById('f-lng').value = '';
    document.getElementById('f-irrigated').value = '';
}

function closeFarmForm() {
    document.getElementById('farm-form-modal').style.display = 'none';
}

function saveFarmFromForm() {
    const name = document.getElementById('f-name').value.trim();
    const owner = document.getElementById('f-owner').value.trim() || 'غير محدد';
    const crop = document.getElementById('f-crop').value.trim() || 'غير محدد';
    const area = parseFloat(document.getElementById('f-area').value);
    const lat = parseFloat(document.getElementById('f-lat').value);
    const lng = parseFloat(document.getElementById('f-lng').value);
    const irrigated = parseFloat(document.getElementById('f-irrigated').value) || Math.floor(area * 0.6);

    if (!name || !area || isNaN(lat) || isNaN(lng)) {
        alert('❌ يرجى ملء جميع الحقول المطلوبة');
        return;
    }

    addFarmToSystem(name, lat, lng, area, crop, owner, irrigated);
    closeFarmForm();
}

function addFarmToSystem(name, lat, lng, area, crop, owner, irrigated) {
    const newFarm = {
        id: Date.now(),
        name: name,
        lat: lat,
        lng: lng,
        area: area,
        irrigated: irrigated || Math.floor(area * 0.6),
        crop: crop || 'غير محدد',
        status: 'جديدة',
        owner: owner || 'غير محدد',
        category: 'غير مصنف',
        cost: 0,
        profit: 0
    };
    farms.push(newFarm);
    const icon = L.divIcon({ className: 'farm-marker', html: farms.length, iconSize: [24, 24], iconAnchor: [12, 12] });
    const marker = L.marker([lat, lng], { icon }).addTo(map)
        .bindPopup(`<strong>${newFarm.name}</strong><br><span>📍 ${newFarm.owner}</span><br><span>🌾 ${newFarm.crop}</span><br><span>📐 ${newFarm.area} ف</span>`);
    marker.on('click', () => showFarmDetails(newFarm.id));
    markers.push({ marker, farm: newFarm });
    updateStats();
    showFarmDetails(newFarm.id);
    saveFarms();
    alert(`✅ تم إضافة ${newFarm.name} بنجاح!`);
}

function zoomToFarms() {
    if (farms.length === 0) { alert('⚠️ لا توجد مزارع'); return; }
    const bounds = L.latLngBounds(farms.map(f => [f.lat, f.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });
}

// ============================================
// 10. استيراد Excel
// ============================================
function importExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        let addedCount = 0;
        jsonData.forEach(row => {
            const newFarm = {
                id: Date.now() + addedCount,
                name: row['اسم المزرعة'] || row['name'] || `مزرعة ${addedCount + 1}`,
                lat: parseFloat(row['خط العرض']) || parseFloat(row['lat']) || 30.0444 + (Math.random() - 0.5) * 0.2,
                lng: parseFloat(row['خط الطول']) || parseFloat(row['lng']) || 31.2357 + (Math.random() - 0.5) * 0.2,
                area: parseFloat(row['المساحة']) || parseFloat(row['area']) || 100,
                irrigated: parseFloat(row['مروي']) || parseFloat(row['irrigated']) || 60,
                crop: row['المحصول'] || row['crop'] || 'غير محدد',
                status: row['الحالة'] || row['status'] || 'جديدة',
                owner: row['المالك'] || row['owner'] || 'غير محدد',
                category: row['التصنيف'] || row['category'] || 'غير مصنف'
            };
            farms.push(newFarm);
            addedCount++;
        });
        reloadMarkers();
        saveFarms();
        alert(`✅ تم استيراد ${addedCount} مزرعة`);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

// ============================================
// 11. تبديل الخريطة والغطاء النباتي
// ============================================
function switchMap(type) {
    if (satelliteLayer) { map.removeLayer(satelliteLayer); satelliteLayer = null; }
    if (baseLayer) { map.removeLayer(baseLayer); baseLayer = null; }
    if (ndviLayer) { map.removeLayer(ndviLayer); ndviLayer = null; }
    let layer;
    switch(type) {
        case 'osm': layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }); break;
        case 'satellite': layer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 }); break;
        case 'google': layer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { attribution: '© Google', maxZoom: 19, subdomains: ['mt0','mt1','mt2','mt3'] }); break;
    }
    baseLayer = layer;
    layer.addTo(map);
    currentMapType = type;
}

function toggleNDVI() {
    if (ndviLayer) { map.removeLayer(ndviLayer); ndviLayer = null; return; }
    const greenAreas = [
        [[28.04,30.62],[28.06,30.65]],
        [[28.02,30.60],[28.04,30.63]],
        [[28.07,30.64],[28.09,30.67]]
    ];
    ndviLayer = L.layerGroup();
    greenAreas.forEach(area => {
        const rect = L.rectangle(area, { color: '#2d6a4f', weight: 1.5, opacity: 0.8, fillColor: '#40916c', fillOpacity: 0.3 }).addTo(ndviLayer);
        rect.bindPopup('🌿 غطاء نباتي كثيف');
    });
    ndviLayer.addTo(map);
}

// ============================================
// 12. تحليل NDVI (محاكاة)
// ============================================
function analyzeFarm() {
    if (farms.length === 0) {
        alert('❌ لا توجد مزارع للتحليل');
        return;
    }
    
    const farmId = selectedFarmId || farms[0].id;
    const farm = farms.find(f => f.id === farmId);
    if (!farm) {
        alert('❌ المزرعة غير موجودة');
        return;
    }

    showLoading(farmId);

    setTimeout(() => {
        const ndvi = parseFloat((Math.random() * 0.6 + 0.2).toFixed(2));
        
        farm.ndvi = ndvi;
        farm.analysisSource = '📊 محاكاة ذكية';
        farm.lastAnalysis = new Date().toLocaleDateString('ar-EG');

        analyzeNDVIResult(farm);
        saveFarms();
        showFarmDetails(farm.id);
        
        document.getElementById('loading-msg')?.remove();

        alert(`🛰️ تحليل ${farm.name}\n📊 NDVI: ${ndvi}\n📈 ${farm.ndviStatus}\n💡 ${farm.ndviRecommendation}`);
    }, 1500);
}

function showLoading(farmId) {
    const detailsDiv = document.getElementById('farm-details');
    let loadingMsg = document.getElementById('loading-msg');
    if (!loadingMsg) {
        loadingMsg = document.createElement('div');
        loadingMsg.id = 'loading-msg';
        detailsDiv.appendChild(loadingMsg);
    }
    loadingMsg.innerHTML = `
        <p style="text-align:center;color:#2d6a4f;font-size:11px;">
            <i class="fas fa-spinner fa-spin"></i> جاري تحليل البيانات...
        </p>
    `;
}

function analyzeNDVIResult(farm) {
    const ndvi = farm.ndvi || 0;
    let status, color, recommendation;
    if (ndvi > 0.6) {
        status = 'ممتاز 🌟';
        color = '#2d6a4f';
        recommendation = 'المحصول صحي جداً. استمر في الرعاية.';
    } else if (ndvi > 0.4) {
        status = 'جيد 👍';
        color = '#52b788';
        recommendation = 'بحالة جيدة. يوصى بزيادة الري.';
    } else if (ndvi > 0.25) {
        status = 'متوسط ⚠️';
        color = '#f4a261';
        recommendation = 'يوجد إجهاد. يوصى بفحص التربة.';
    } else {
        status = 'ضعيف 🚨';
        color = '#e76f51';
        recommendation = 'تحذير! يوصى بمراجعة فورية للري.';
    }
    farm.ndviStatus = status;
    farm.ndviColor = color;
    farm.ndviRecommendation = recommendation;
    
    if (ndvi < 0.3) {
        const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
        alerts.push({
            id: Date.now(),
            farmName: farm.name,
            message: `NDVI منخفض (${ndvi}) في ${farm.name}`,
            recommendation: recommendation,
            date: new Date().toISOString(),
            resolved: false
        });
        localStorage.setItem('alerts', JSON.stringify(alerts));
    }
}

// ============================================
// 13. باقي الدوال (الإنذارات، لوحة التحكم، مقارنة، تكاليف، PDF)
// ============================================
function showAlerts() {
    const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    const active = alerts.filter(a => !a.resolved);
    if (active.length === 0) { alert('✅ لا توجد إنذارات'); return; }
    let msg = '🚨 الإنذارات:\n\n';
    active.forEach((a, i) => {
        msg += `${i+1}. ${a.farmName}\n`;
        msg += `   📝 ${a.message}\n`;
        msg += `   💡 ${a.recommendation}\n`;
        msg += `   📅 ${new Date(a.date).toLocaleDateString('ar-EG')}\n\n`;
    });
    alert(msg);
}

function showDashboard() {
    if (farms.length === 0) {
        alert('⚠️ لا توجد مزارع');
        return;
    }
    const total = farms.length;
    const area = farms.reduce((s, f) => s + f.area, 0);
    const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    const active = alerts.filter(a => !a.resolved);
    const html = `
        <div id="dash" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)this.remove()">
            <div style="background:white;padding:20px;border-radius:12px;max-width:380px;width:90%;">
                <h2 style="color:#1a472a;text-align:center;font-size:18px;">📊 لوحة التحكم</h2>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0;">
                    <div style="background:#e8f5e9;padding:10px;border-radius:6px;text-align:center;">
                        <div style="font-size:20px;font-weight:bold;color:#1a472a;">${total}</div>
                        <div style="font-size:10px;color:#666;">المزارع</div>
                    </div>
                    <div style="background:#e3f2fd;padding:10px;border-radius:6px;text-align:center;">
                        <div style="font-size:20px;font-weight:bold;color:#1565c0;">${area}</div>
                        <div style="font-size:10px;color:#666;">فدان</div>
                    </div>
                    <div style="background:#fff3e0;padding:10px;border-radius:6px;text-align:center;">
                        <div style="font-size:20px;font-weight:bold;color:#e76f51;">${active.length}</div>
                        <div style="font-size:10px;color:#666;">إنذارات</div>
                    </div>
                    <div style="background:#f3e5f5;padding:10px;border-radius:6px;text-align:center;">
                        <div style="font-size:20px;font-weight:bold;color:#6a1b9a;">${total > 0 ? (area/total).toFixed(0) : 0}</div>
                        <div style="font-size:10px;color:#666;">متوسط</div>
                    </div>
                </div>
                <button onclick="document.getElementById('dash').remove()" style="width:100%;padding:8px;background:#1a472a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">إغلاق</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

function showComparison() {
    if (farms.length < 2) {
        alert('⚠️ تحتاج إلى مزرعتين على الأقل للمقارنة');
        return;
    }
    let msg = '📊 مقارنة المزارع:\n\n';
    farms.forEach(f => {
        msg += `🌿 ${f.name}\n`;
        msg += `   📐 المساحة: ${f.area} ف\n`;
        msg += `   🌾 المحصول: ${f.crop}\n`;
        msg += `   📊 NDVI: ${f.ndvi || 'غير محدد'}\n`;
        msg += `   💧 الري: ${f.irrigated} ف (${Math.round(f.irrigated/f.area*100)}%)\n`;
        msg += `   📈 الحالة: ${f.status}\n`;
        msg += `   🏷️ التصنيف: ${f.category}\n\n`;
    });
    alert(msg);
}

function showCostAnalysis() {
    if (farms.length === 0) {
        alert('⚠️ لا توجد مزارع لتحليل التكاليف');
        return;
    }
    let msg = '💰 تحليل التكاليف والأرباح:\n\n';
    let totalCost = 0, totalProfit = 0;
    farms.forEach(f => {
        const cost = f.cost || Math.floor(Math.random() * 5000 + 1000);
        const profit = f.profit || Math.floor(Math.random() * 8000 + 2000);
        f.cost = cost;
        f.profit = profit;
        totalCost += cost;
        totalProfit += profit;
        msg += `🌿 ${f.name}\n`;
        msg += `   💰 التكلفة: $${cost}\n`;
        msg += `   📈 الربح: $${profit}\n`;
        msg += `   📊 صافي الربح: $${profit - cost}\n\n`;
    });
    msg += `📊 إجمالي التكلفة: $${totalCost}\n`;
    msg += `📈 إجمالي الربح: $${totalProfit}\n`;
    msg += `💰 صافي الربح الإجمالي: $${totalProfit - totalCost}`;
    saveFarms();
    alert(msg);
}

function exportPDF() {
    if (farms.length === 0) {
        alert('⚠️ لا توجد بيانات');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        doc.setFontSize(18);
        doc.setTextColor(26, 71, 42);
        doc.text('تقرير استصلاح الأراضي', 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-EG')}`, 105, 28, { align: 'center' });
        
        let y = 40;
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`عدد المزارع: ${farms.length}`, 20, y);
        y += 8;
        doc.text(`المساحة الكلية: ${farms.reduce((s,f) => s + f.area, 0)} فدان`, 20, y);
        y += 8;
        
        const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
        doc.text(`الإنذارات النشطة: ${alerts.filter(a => !a.resolved).length}`, 20, y);
        y += 15;
        
        doc.setFontSize(11);
        doc.setTextColor(26, 71, 42);
        doc.text('تفاصيل المزارع:', 20, y);
        y += 6;
        
        farms.forEach(f => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setTextColor(0);
            doc.setFontSize(9);
            doc.text(`${f.name} | ${f.area} ف | ${f.crop} | ${f.status}${f.ndvi ? ' | NDVI: '+f.ndvi : ''}`, 20, y);
            y += 5;
        });
        
        doc.save(`تقرير_${new Date().toISOString().split('T')[0]}.pdf`);
        alert('✅ تم إنشاء التقرير بنجاح!');
        
    } catch (error) {
        console.error('❌ فشل إنشاء PDF:', error);
        alert('❌ حدث خطأ في إنشاء التقرير. حاول مرة أخرى.');
    }
}

// ============================================
// 14. PWA والتشغيل
// ============================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('✅ PWA جاهزة'))
        .catch(() => console.log('❌ فشل التسجيل'));
}

checkLoginStatus();