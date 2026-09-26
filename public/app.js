// Estado global
const state = {
  token: localStorage.token || '',
  data: {
    towers: [],
    apartments: [],
    vehicles: [],
    news: []
  },
  currentModule: 'vehicles'
};

// Utilidades
const $ = (id) => document.getElementById(id);
const esc = (x) => String(x || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// API Call
async function api(endpoint, method = 'GET', body = null) {
  try {
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`/api${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Error');
    return data;
  } catch (e) { throw e; }
}

// Toast
function toast(msg, type = 'success') {
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// Format date
function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'short', day: '2-digit'
  });
}

// Show/Hide panels
function showPanel() {
  $('loginContainer').hidden = !!state.token;
  $('mainPanel').hidden = !state.token;
  if (state.token) {
    $('todayDate').textContent = new Date().toLocaleDateString('es-ES');
    loadAll();
  }
}

// LOGIN
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const d = await api('/login', 'POST', {
      username: $('username').value,
      password: $('password').value
    });
    state.token = d.token;
    localStorage.token = d.token;
    showPanel();
  } catch (e) {
    $('loginError').textContent = e.message;
    $('loginError').style.display = 'block';
  }
});

// LOGOUT
$('logoutBtn').addEventListener('click', () => {
  if (confirm('¿Salir del sistema?')) {
    state.token = '';
    localStorage.removeItem('token');
    showPanel();
  }
});

// MODULE NAVIGATION
document.querySelectorAll('.module-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.module-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    e.target.classList.add('active');
    const mod = e.target.dataset.module;
    state.currentModule = mod;
    $(`${mod}Module`).classList.add('active');
  });
});

// ==================== VEHÍCULOS ====================
async function loadVehicles(search = '') {
  try {
    const endpoint = search ? `/vehicles?plate=${search}` : '/vehicles';
    state.data.vehicles = await api(endpoint);
    renderVehicles();
  } catch (e) { toast(e.message, 'error'); }
}

function renderVehicles() {
  const list = $('vehiclesList');
  if (!state.data.vehicles.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🚗</div><p>No hay vehículos registrados</p></div>';
    return;
  }
  list.innerHTML = `<table>
    <thead><tr><th>Placa</th><th>Marca</th><th>Color</th><th>Observaciones</th><th>Acciones</th></tr></thead>
    <tbody>
      ${state.data.vehicles.map(v => `<tr>
        <td data-label="Placa"><span class="plate">${v.plate}</span></td>
        <td data-label="Marca">${esc(v.brand)}</td>
        <td data-label="Color">${esc(v.color)}</td>
        <td data-label="Observaciones">${esc(v.observations || '-')}</td>
        <td data-label="Acciones"><div class="actions">
          <button class="btn-edit" onclick="editVehicle(${v.id})">✏ Editar</button>
          <button class="btn-danger" onclick="deleteVehicle(${v.id})">🗑 Eliminar</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

$('vehicleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const plate = $('vehiclePlate').value.toUpperCase().trim();
  const brand = $('vehicleBrand').value.trim();
  const color = $('vehicleColor').value;
  const obs = $('vehicleObservations').value.trim();
  try {
    await api('/vehicles', 'POST', { plate, brand, color, observations: obs });
    toast('✅ Vehículo guardado');
    $('vehicleForm').reset();
    loadVehicles();
  } catch (e) { toast(e.message, 'error'); }
});

function editVehicle(id) {
  const v = state.data.vehicles.find(x => x.id === id);
  if (!v) return;
  const plate = prompt('Placa:', v.plate);
  if (plate === null) return;
  const brand = prompt('Marca:', v.brand);
  if (brand === null) return;
  const color = prompt('Color:', v.color);
  if (color === null) return;
  const obs = prompt('Observaciones:', v.observations || '');
  if (obs === null) return;
  
  api(`/vehicles/${id}`, 'PUT', { plate: plate.toUpperCase(), brand, color, observations: obs })
    .then(() => { toast('✏ Actualizado'); loadVehicles(); })
    .catch(e => toast(e.message, 'error'));
}

function deleteVehicle(id) {
  if (!confirm('¿Eliminar vehículo?')) return;
  api(`/vehicles/${id}`, 'DELETE')
    .then(() => { toast('🗑 Eliminado'); loadVehicles(); })
    .catch(e => toast(e.message, 'error'));
}

$('vehicleSearch').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (val.length < 2) {
    $('vehicleSearchResults').style.display = 'none';
    return;
  }
  loadVehicles(val);
});

// ==================== TORRES ====================
async function loadTowers() {
  try {
    state.data.towers = await api('/towers');
    renderTowers();
    updateAptSelect();
  } catch (e) { toast(e.message, 'error'); }
}

function renderTowers() {
  const list = $('towersList');
  if (!state.data.towers.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏗️</div><p>No hay torres registradas</p></div>';
    return;
  }
  list.innerHTML = `<table>
    <thead><tr><th>Nombre</th><th>Acciones</th></tr></thead>
    <tbody>
      ${state.data.towers.map(t => `<tr>
        <td data-label="Nombre">${esc(t.name)}</td>
        <td data-label="Acciones"><div class="actions">
          <button class="btn-edit" onclick="editTower(${t.id})">✏ Editar</button>
          <button class="btn-danger" onclick="deleteTower(${t.id})">🗑 Eliminar</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

$('towerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('towerName').value.trim();
  try {
    await api('/towers', 'POST', { name });
    toast('✅ Torre guardada');
    $('towerForm').reset();
    loadTowers();
  } catch (e) { toast(e.message, 'error'); }
});

function editTower(id) {
  const t = state.data.towers.find(x => x.id === id);
  if (!t) return;
  const name = prompt('Nombre:', t.name);
  if (name === null) return;
  api(`/towers/${id}`, 'PUT', { name })
    .then(() => { toast('✏ Actualizado'); loadTowers(); })
    .catch(e => toast(e.message, 'error'));
}

function deleteTower(id) {
  if (!confirm('¿Eliminar torre? Se eliminarán también sus apartamentos.')) return;
  api(`/towers/${id}`, 'DELETE')
    .then(() => { toast('🗑 Eliminado'); loadTowers(); })
    .catch(e => toast(e.message, 'error'));
}

function updateAptSelect() {
  const sel = $('apartmentTower');
  sel.innerHTML = '<option value="">-- Seleccionar torre --</option>';
  state.data.towers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

// ==================== APARTAMENTOS ====================
async function loadApartments() {
  try {
    state.data.apartments = await api('/apartments');
    renderApartments();
    updateNewsSelect();
  } catch (e) { toast(e.message, 'error'); }
}

function renderApartments() {
  const list = $('apartmentsList');
  if (!state.data.apartments.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏠</div><p>No hay apartamentos registrados</p></div>';
    return;
  }
  list.innerHTML = `<table>
    <thead><tr><th>Número</th><th>Torre</th><th>Acciones</th></tr></thead>
    <tbody>
      ${state.data.apartments.map(a => `<tr>
        <td data-label="Número">${esc(a.number)}</td>
        <td data-label="Torre">${esc(a.tower_name)}</td>
        <td data-label="Acciones"><div class="actions">
          <button class="btn-edit" onclick="editApt(${a.id})">✏ Editar</button>
          <button class="btn-danger" onclick="deleteApt(${a.id})">🗑 Eliminar</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

$('apartmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const number = $('apartmentNumber').value.trim();
  const tid = parseInt($('apartmentTower').value);
  if (!number || !tid) { toast('Completa todos los campos', 'error'); return; }
  try {
    await api('/apartments', 'POST', { number, tower_id: tid });
    toast('✅ Apartamento guardado');
    $('apartmentForm').reset();
    loadApartments();
  } catch (e) { toast(e.message, 'error'); }
});

function editApt(id) {
  const a = state.data.apartments.find(x => x.id === id);
  if (!a) return;
  const number = prompt('Número:', a.number);
  if (number === null) return;
  api(`/apartments/${id}`, 'PUT', { number, tower_id: a.tower_id })
    .then(() => { toast('✏ Actualizado'); loadApartments(); })
    .catch(e => toast(e.message, 'error'));
}

function deleteApt(id) {
  if (!confirm('¿Eliminar apartamento?')) return;
  api(`/apartments/${id}`, 'DELETE')
    .then(() => { toast('🗑 Eliminado'); loadApartments(); })
    .catch(e => toast(e.message, 'error'));
}

function updateNewsSelect() {
  const sel = $('newsApartment');
  sel.innerHTML = '<option value="">-- Sin apartamento --</option>';
  state.data.apartments.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.number} - ${a.tower_name}`;
    sel.appendChild(opt);
  });
}

// ==================== NOVEDADES ====================
async function loadNews() {
  try {
    state.data.news = await api('/news');
    renderNews();
  } catch (e) { toast(e.message, 'error'); }
}

function renderNews() {
  const list = $('newsList');
  if (!state.data.news.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📰</div><p>No hay novedades registradas</p></div>';
    return;
  }
  list.innerHTML = `<table>
    <thead><tr><th>Título</th><th>Descripción</th><th>Apartamento</th><th>Fecha</th><th>Acciones</th></tr></thead>
    <tbody>
      ${state.data.news.map(n => `<tr>
        <td data-label="Título">${esc(n.title)}</td>
        <td data-label="Descripción">${esc((n.description || '').substring(0, 50))}</td>
        <td data-label="Apartamento">${n.apartment_number ? `${n.apartment_number} - ${n.tower_name}` : '-'}</td>
        <td data-label="Fecha">${fmtDate(n.created_at)}</td>
        <td data-label="Acciones"><div class="actions">
          <button class="btn-edit" onclick="editNews(${n.id})">✏ Editar</button>
          <button class="btn-danger" onclick="deleteNews(${n.id})">🗑 Eliminar</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

$('newsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('newsTitle').value.trim();
  const desc = $('newsDescription').value.trim();
  const apt = $('newsApartment').value;
  try {
    await api('/news', 'POST', { title, description: desc, apartment_id: apt ? parseInt(apt) : null });
    toast('✅ Novedad guardada');
    $('newsForm').reset();
    loadNews();
  } catch (e) { toast(e.message, 'error'); }
});

function editNews(id) {
  const n = state.data.news.find(x => x.id === id);
  if (!n) return;
  const title = prompt('Título:', n.title);
  if (title === null) return;
  const desc = prompt('Descripción:', n.description || '');
  if (desc === null) return;
  api(`/news/${id}`, 'PUT', { title, description: desc, apartment_id: n.apartment_id })
    .then(() => { toast('✏ Actualizado'); loadNews(); })
    .catch(e => toast(e.message, 'error'));
}

function deleteNews(id) {
  if (!confirm('¿Eliminar novedad?')) return;
  api(`/news/${id}`, 'DELETE')
    .then(() => { toast('🗑 Eliminado'); loadNews(); })
    .catch(e => toast(e.message, 'error'));
}

// ==================== CARGAR TODO ====================
async function loadAll() {
  await loadTowers();
  await loadApartments();
  await loadVehicles();
  await loadNews();
}

// INIT
showPanel();
