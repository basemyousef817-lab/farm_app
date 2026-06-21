// ============================================
// 1. تهيئة الخريطة
// ============================================
const map = L.map('map').setView([30.0444, 31.2357], 12);

let baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
}).addTo(map);

// ============================================
// 2. المتغيرات العامة
// ============================================
let farms = [];
let markers = [];
let selectedFarmId = null;
let isAddingMode = false;
let satelliteLayer = null;
let ndviLayer = null;
let cropChart = null;
let currentMapType = 'osm';

// التصنيفات المتاحة
const categories = ['عضوية', 'تقليدية', 'تجريبية', 'مروية', 'بعلية'];

// ============================================
// 3. تحميل البيانات من المخزن أو استخدام البيانات الافتراضية
// ============================================
function loadFarms() {
    const saved = localStorage.getItem('farms');
    if (saved) {
        farms = JSON.parse(saved);
        console.log('📂 تم استرجاع البيانات من المخزن');
        return true;
    }
    // بيانات افتراضية
    farms = [
        {
            id: 1,
            name: 'مزرعة النيل',
            lat: 30.0744,
            lng: 31.2557,
            area: 120,
            irrigated: 80,
            crop: 'قمح',
            status: 'نشطة',
            owner: 'أحمد محمد',
            category: 'عضوية'
        },
        {
            id: 2,
            name: 'مزرعة الفيوم',
            lat: 30.0144,
            lng: 31.2157,
            area: 85,
            irrigated: 60,
            crop: 'برتقال',
            status: 'قيد التطوير',
            owner: 'سارة علي',
            category: 'مروية'
        },
        {
            id: 3,
            name: 'مزرعة الوادي',
            lat: 30.1044,
            lng: 31.2757,
            area: 200,
            irrigated: 150,
            crop: 'زيتون',
            status: 'نشطة',
            owner: 'محمد إبراهيم',
            category: 'تقليدية'
        },
        {
            id: 4,
            name: 'مزرعة الأمل',
            lat: 29.9844,
            lng: 31.2057,
            area: 50,
            irrigated: 20,
            crop: 'خضروات',
            status: 'جديدة',
            owner: 'نورا حسن',
            category: 'تجريبية'
        },
    ];
    saveFarms();
    return false;
}

// ============================================
// 4. حفظ البيانات
// ============================================
function saveFarms() {
    localStorage.setItem('farms', JSON.stringify(farms));
    console.log('✅ تم حفظ البيانات بنجاح!');
}

// ============================================
// 5. عرض المزارع على الخريطة
// ============================================
function reloadMarkers() {
    markers.forEach(({ marker }) => {
        map.removeLayer(marker);
    });
    markers = [];

    farms.forEach((farm, index) => {
        const icon = L.divIcon({
            className: 'farm-marker',
            html: index + 1,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        });

        const marker = L.marker([farm.lat, farm.lng], { icon })
            .addTo(map)
            .bindPopup(`
                <strong>${farm.name}</strong><br>
                <span style="color:#2d6a4f;">📍 المالك: ${farm.owner}</span><br>
                <span>🌾 المحصول: ${farm.crop}</span><br>
                <span>📐 المساحة: ${farm.area} فدان</span>
            `);

        marker.on('click', () => {
            showFarmDetails(farm.id);
        });

        markers.push({ marker, farm });
    });

    updateStats();
    if (farms.length > 0) {
        showFarmDetails(farms[0].id);
    }
}

// ============================================
// 6. عرض التفاصيل في اللوحة الجانبية
// ============================================
function showFarmDetails(farmId) {
    const farm = farms.find(f => f.id === farmId);
    if (!farm) return;

    selectedFarmId = farmId;

    if (!farm.category) {
        farm.category = 'غير مصنف';
    }

    let categoryButtons = categories.map(cat => 
        `<button class="category-btn ${farm.category === cat ? 'active' : ''}" onclick="changeCategory(${farm.id}, '${cat}')">${cat}</button>`
    ).join('');

    const statusColor = farm.status === 'نشطة' ? '#2d6a4f' : '#e76f51';
    const statusBadge = farm.status === 'نشطة' ? '' : 'warning';

    let ndviHTML = '';
    if (farm.ndvi !== undefined && farm.ndvi !== null) {
        ndviHTML = `
            <p><span class="label">🛰️ مؤشر NDVI:</span> 
                <span style="background:${farm.ndviColor || '#999'}; padding:2px 10px; border-radius:10px; color:white; font-size:11px;">
                    ${farm.ndvi}
                </span>
            </p>
            <p><span class="label">📊 حالة المحصول:</span> 
                <span style="color:${farm.ndviColor || '#999'}">${farm.ndviStatus || 'غير محدد'}</span>
            </p>
            ${farm.ndviRecommendation ? `
                <p style="font-size:11px; background:#f8fafc; padding:6px; border-radius:5px; margin-top:4px;">
                    💡 ${farm.ndviRecommendation}
                </p>
            ` : ''}
            <p style="font-size:10px; color:#999;">📅 آخر تحليل: ${farm.lastAnalysis || 'لم يتم'}</p>
        `;
    } else {
        ndviHTML = `
            <p style="font-size:11px; color:#999;">
                <i class="fas fa-satellite"></i> اضغط "تحليل القمر" للحصول على تقرير
            </p>
        `;
    }

    document.getElementById('farm-details').innerHTML = `
        <div class="farm-card">
            <p><span class="label">🌿 اسم المزرعة:</span> ${farm.name}</p>
            <p><span class="label">👤 المالك:</span> ${farm.owner}</p>
            <p><span class="label">🌾 المحصول:</span> ${farm.crop}</p>
            <p><span class="label">📐 المساحة:</span> ${farm.area} فدان</p>
            <p><span class="label">💧 مروي:</span> ${farm.irrigated} فدان (${Math.round(farm.irrigated/farm.area*100)}%)</p>
            <p><span class="label">📊 الحالة:</span>
                <span class="badge ${statusBadge}" style="background:${statusColor}">
                    ${farm.status}
                </span>
            </p>
            <p><span class="label">🏷️ التصنيف:</span>
                <span style="background:#e8f5e9;padding:2px 10px;border-radius:10px;font-size:11px;">
                    ${farm.category}
                </span>
            </p>
            ${ndviHTML}
            <p style="font-size:11px;color:#666;margin-top:4px;">
                <span class="label">تغيير التصنيف:</span><br>
                ${categoryButtons}
            </p>
            <p style="font-size: 10px; color: #999; margin-top: 6px;">
                🆔 ID: ${farm.id}
            </p>
        </div>
    `;

    map.setView([farm.lat, farm.lng], 14);
}

// ============================================
// 7. تغيير التصنيف
// ============================================
function changeCategory(farmId, newCategory) {
    const farm = farms.find(f => f.id === farmId);
    if (!farm) return;
    
    farm.category = newCategory;
    saveFarms();
    showFarmDetails(farmId);
    updateChart();
}

// ============================================
// 8. تحديث الإحصائيات
// ============================================
function updateStats() {
    document.getElementById('farm-count').textContent = farms.length;
    document.getElementById('total-area').textContent = farms.reduce((sum, f) => sum + f.area, 0);
    document.getElementById('irrigated-area').textContent = farms.reduce((sum, f) => sum + f.irrigated, 0);
    updateChart();
}

// ============================================
// 9. الرسوم البيانية 📊
// ============================================
function updateChart() {
    const ctx = document.getElementById('cropChart').getContext('2d');
    
    const cropCount = {};
    farms.forEach(farm => {
        cropCount[farm.crop] = (cropCount[farm.crop] || 0) + 1;
    });
    
    const labels = Object.keys(cropCount);
    const data = Object.values(cropCount);
    const colors = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc'];
    
    if (cropChart) {
        cropChart.destroy();
    }
    
    if (labels.length > 0) {
        cropChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 9 }
                        }
                    }
                }
            }
        });
    }
}

// ============================================
// 10. إضافة مزرعة بالضغط على الخريطة
// ============================================
function enableAddMode() {
    isAddingMode = !isAddingMode;
    const btn = document.getElementById('add-mode-btn');
    if (isAddingMode) {
        btn.textContent = '❌ إلغاء الإضافة';
        btn.style.background = 'rgba(255, 0, 0, 0.3)';
        map.getContainer().style.cursor = 'crosshair';
        alert('🔍 اضغط على أي مكان في الخريطة لإضافة مزرعة جديدة');
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
    
    const farmName = prompt('✏️ أدخل اسم المزرعة:');
    if (!farmName) {
        isAddingMode = false;
        document.getElementById('add-mode-btn').textContent = '➕ إضافة مزرعة';
        map.getContainer().style.cursor = '';
        return;
    }
    
    const crop = prompt('🌾 أدخل نوع المحصول:', 'قمح');
    const area = prompt('📐 أدخل المساحة بالفدان:', '100');
    const owner = prompt('👤 أدخل اسم المالك:', 'مزارع جديد');
    
    const newFarm = {
        id: Date.now(),
        name: farmName,
        lat: lat,
        lng: lng,
        area: parseFloat(area) || 100,
        irrigated: Math.floor((parseFloat(area) || 100) * 0.6),
        crop: crop || 'غير محدد',
        status: 'جديدة',
        owner: owner || 'غير محدد',
        category: 'غير مصنف'
    };
    
    farms.push(newFarm);
    
    const icon = L.divIcon({
        className: 'farm-marker',
        html: farms.length,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
    
    const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`
            <strong>${newFarm.name}</strong><br>
            <span style="color:#2d6a4f;">📍 المالك: ${newFarm.owner}</span><br>
            <span>🌾 المحصول: ${newFarm.crop}</span><br>
            <span>📐 المساحة: ${newFarm.area} فدان</span>
        `);
    
    marker.on('click', () => {
        showFarmDetails(newFarm.id);
    });
    
    markers.push({ marker, farm: newFarm });
    updateStats();
    showFarmDetails(newFarm.id);
    saveFarms();
    
    isAddingMode = false;
    document.getElementById('add-mode-btn').textContent = '➕ إضافة مزرعة';
    map.getContainer().style.cursor = '';
    
    alert(`✅ تم إضافة ${newFarm.name} بنجاح!`);
});

// ============================================
// 11. إضافة مزرعة عشوائية
// ============================================
function addFarm() {
    const newFarm = {
        id: Date.now(),
        name: `مزرعة جديدة ${farms.length + 1}`,
        lat: 30.0444 + (Math.random() - 0.5) * 0.1,
        lng: 31.2357 + (Math.random() - 0.5) * 0.1,
        area: Math.floor(Math.random() * 150) + 30,
        irrigated: Math.floor(Math.random() * 100) + 10,
        crop: ['قمح', 'أرز', 'قطن', 'خضروات', 'فاكهة'][Math.floor(Math.random() * 5)],
        status: ['نشطة', 'قيد التطوير', 'جديدة'][Math.floor(Math.random() * 3)],
        owner: 'مستخدم جديد',
        category: categories[Math.floor(Math.random() * categories.length)]
    };

    farms.push(newFarm);

    const icon = L.divIcon({
        className: 'farm-marker',
        html: farms.length,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });

    const marker = L.marker([newFarm.lat, newFarm.lng], { icon })
        .addTo(map)
        .bindPopup(`
            <strong>${newFarm.name}</strong><br>
            <span style="color:#2d6a4f;">📍 المالك: ${newFarm.owner}</span><br>
            <span>🌾 المحصول: ${newFarm.crop}</span><br>
            <span>📐 المساحة: ${newFarm.area} فدان</span>
        `);

    marker.on('click', () => {
        showFarmDetails(newFarm.id);
    });

    markers.push({ marker, farm: newFarm });
    updateStats();
    showFarmDetails(newFarm.id);
    saveFarms();
    
    alert(`✅ تم إضافة ${newFarm.name} بنجاح!`);
}

// ============================================
// 12. تكبير لعرض جميع المزارع
// ============================================
function zoomToFarms() {
    if (farms.length === 0) return;
    const bounds = L.latLngBounds(farms.map(f => [f.lat, f.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
}

// ============================================
// 13. استيراد من Excel
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
        alert(`✅ تم استيراد ${addedCount} مزرعة بنجاح!`);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

// ============================================
// 14. تبديل الخريطة 🌍
// ============================================
function switchMap(type) {
    if (satelliteLayer) {
        map.removeLayer(satelliteLayer);
        satelliteLayer = null;
    }
    if (baseLayer) {
        map.removeLayer(baseLayer);
        baseLayer = null;
    }
    if (ndviLayer) {
        map.removeLayer(ndviLayer);
        ndviLayer = null;
    }
    
    let layer;
    switch(type) {
        case 'osm':
            layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19,
            });
            break;
        case 'satellite':
            layer = L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                { attribution: '© Esri', maxZoom: 19 }
            );
            break;
        case 'google':
            layer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                attribution: '© Google',
                maxZoom: 19,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            });
            break;
    }
    
    baseLayer = layer;
    layer.addTo(map);
    currentMapType = type;
}

// ============================================
// 15. الغطاء النباتي 🌿
// ============================================
function toggleNDVI() {
    if (ndviLayer) {
        map.removeLayer(ndviLayer);
        ndviLayer = null;
        return;
    }

    const greenAreas = [
        [[30.06, 31.24], [30.08, 31.27]],
        [[30.02, 31.21], [30.04, 31.24]],
        [[30.09, 31.26], [30.11, 31.29]],
        [[29.99, 31.20], [30.01, 31.23]],
    ];

    ndviLayer = L.layerGroup();
    greenAreas.forEach(area => {
        const rect = L.rectangle(area, {
            color: '#2d6a4f',
            weight: 2,
            opacity: 0.8,
            fillColor: '#40916c',
            fillOpacity: 0.4,
        }).addTo(ndviLayer);
        rect.bindPopup('🌿 غطاء نباتي كثيف (NDVI مرتفع)');
    });

    ndviLayer.addTo(map);
}

// ============================================
// 16. تحليل القمر الصناعي 🛰️
// ============================================
function analyzeFarm() {
    if (farms.length === 0) {
        alert('❌ لا توجد مزارع للتحليل');
        return;
    }
    
    const farmId = selectedFarmId || farms[0].id;
    const farm = farms.find(f => f.id === farmId);
    
    if (!farm) return;
    
    // محاكاة تحليل NDVI
    const ndvi = (Math.random() * 0.8 + 0.1).toFixed(2);
    farm.ndvi = parseFloat(ndvi);
    
    let status, color, recommendation;
    if (ndvi > 0.6) {
        status = 'ممتاز 🌟';
        color = '#2d6a4f';
        recommendation = 'المحصول صحي جداً. استمر في الرعاية الحالية.';
    } else if (ndvi > 0.4) {
        status = 'جيد 👍';
        color = '#52b788';
        recommendation = 'المحصول بحالة جيدة. يوصى بزيادة بسيطة في الري.';
    } else if (ndvi > 0.25) {
        status = 'متوسط ⚠️';
        color = '#f4a261';
        recommendation = 'يوجد إجهاد في المحصول. يوصى بفحص التربة.';
    } else {
        status = 'ضعيف 🚨';
        color = '#e76f51';
        recommendation = 'تحذير! المحصول يعاني. يوصى بمراجعة فورية للري والتسميد.';
    }
    
    farm.ndviStatus = status;
    farm.ndviColor = color;
    farm.ndviRecommendation = recommendation;
    farm.lastAnalysis = new Date().toLocaleDateString('ar-EG');
    
    saveFarms();
    showFarmDetails(farm.id);
    
    // إضافة إنذار لو NDVI منخفض
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
        alert(`🚨 إنذار! ${farm.name} تعاني من إجهاد\n💡 ${recommendation}`);
    } else {
        alert(`🛰️ تم تحليل ${farm.name}\n📊 NDVI: ${ndvi}\n📈 الحالة: ${status}`);
    }
}

// ============================================
// 17. نظام الإنذارات 🔔
// ============================================
function showAlerts() {
    const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    const active = alerts.filter(a => !a.resolved);
    
    if (active.length === 0) {
        alert('✅ لا توجد إنذارات حالية. كل المزارع بحالة جيدة!');
        return;
    }
    
    let msg = '🚨 الإنذارات النشطة:\n\n';
    active.forEach((a, i) => {
        msg += `${i+1}. ${a.farmName}\n`;
        msg += `   📝 ${a.message}\n`;
        msg += `   💡 ${a.recommendation}\n`;
        msg += `   📅 ${new Date(a.date).toLocaleDateString('ar-EG')}\n\n`;
    });
    alert(msg);
}

// ============================================
// 18. لوحة التحكم 📊
// ============================================
function showDashboard() {
    const total = farms.length;
    const area = farms.reduce((s, f) => s + f.area, 0);
    const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    const active = alerts.filter(a => !a.resolved);
    
    const html = `
        <div id="dash" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:2000;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)this.remove()">
            <div style="background:white;padding:25px;border-radius:15px;max-width:450px;width:90%;">
                <h2 style="color:#1a472a;text-align:center;font-size:20px;">📊 لوحة التحكم</h2>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:15px 0;">
                    <div style="background:#e8f5e9;padding:12px;border-radius:8px;text-align:center;">
                        <div style="font-size:24px;font-weight:bold;color:#1a472a;">${total}</div>
                        <div style="font-size:11px;color:#666;">المزارع</div>
                    </div>
                    <div style="background:#e3f2fd;padding:12px;border-radius:8px;text-align:center;">
                        <div style="font-size:24px;font-weight:bold;color:#1565c0;">${area}</div>
                        <div style="font-size:11px;color:#666;">فدان</div>
                    </div>
                    <div style="background:#fff3e0;padding:12px;border-radius:8px;text-align:center;">
                        <div style="font-size:24px;font-weight:bold;color:#e76f51;">${active.length}</div>
                        <div style="font-size:11px;color:#666;">إنذارات</div>
                    </div>
                    <div style="background:#f3e5f5;padding:12px;border-radius:8px;text-align:center;">
                        <div style="font-size:24px;font-weight:bold;color:#6a1b9a;">${total > 0 ? (area/total).toFixed(0) : 0}</div>
                        <div style="font-size:11px;color:#666;">متوسط المساحة</div>
                    </div>
                </div>
                <button onclick="document.getElementById('dash').remove()" style="width:100%;padding:10px;background:#1a472a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">إغلاق</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

// ============================================
// 19. تقارير PDF 📄
// ============================================
function exportPDF() {
    if (farms.length === 0) {
        alert('⚠️ لا توجد بيانات لتصديرها!');
        return;
    }
    
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
}

// ============================================
// 20. تفعيل PWA (تطبيق موبايل)
// ============================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('✅ PWA جاهزة'))
        .catch(() => console.log('❌ فشل التسجيل'));
}

// ============================================
// 21. تشغيل التطبيق
// ============================================
loadFarms();
reloadMarkers();
console.log('✅ نظام GIS لإدارة استصلاح الأراضي جاهز!');
console.log(`📊 عدد المزارع: ${farms.length}`);