const API_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1'

// 預設顯示的目標幣種（含 TWD、VND，移除 CHF）
const TARGET_CURRENCIES = [
  'twd', 'usd', 'eur', 'jpy', 'gbp', 'hkd', 'cny',
  'krw', 'thb', 'sgd', 'aud', 'cad', 'vnd',
]

// 預設基準幣種選單
const BASE_OPTIONS = [
  'twd', 'usd', 'eur', 'jpy', 'gbp', 'hkd', 'cny',
  'krw', 'thb', 'sgd', 'aud', 'cad', 'vnd',
]

// 幣種中文名稱
const ZH_NAMES = {
  twd: '新台幣', usd: '美元', eur: '歐元', jpy: '日圓',
  gbp: '英鎊', hkd: '港幣', cny: '人民幣', krw: '韓元',
  thb: '泰銖', sgd: '新加坡幣', aud: '澳幣', cad: '加拿大幣',
  vnd: '越南盾',
}

// 幣種對應國旗 emoji
const FLAGS = {
  twd: '🇹🇼', usd: '🇺🇸', eur: '🇪🇺', jpy: '🇯🇵',
  gbp: '🇬🇧', hkd: '🇭🇰', cny: '🇨🇳', krw: '🇰🇷',
  thb: '🇹🇭', sgd: '🇸🇬', aud: '🇦🇺', cad: '🇨🇦',
  vnd: '🇻🇳',
}

const NO_DECIMAL = ['jpy', 'krw', 'idr', 'huf', 'isk', 'vnd']

const state = {
  rates: {},       // { eur: 0.027, jpy: 4.99, ... } 以 base 為基準
  base: 'twd',
  names: {},       // { twd: 'New Taiwan Dollar', ... }
}

// DOM
const amountInput = document.getElementById('amount-input')
const baseSelect = document.getElementById('base-currency')
const resultsList = document.getElementById('results-list')
const errorBanner = document.getElementById('error-banner')
const errorMessage = document.getElementById('error-message')
const updateTime = document.getElementById('update-time')

// --- Utils ---

function debounce(fn, ms) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

function fmt(value, code) {
  const digits = NO_DECIMAL.includes(code) ? 0 : 2
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function showError(msg) {
  errorMessage.textContent = msg
  errorBanner.hidden = false
}

function hideError() {
  errorBanner.hidden = true
}

// --- Build UI ---

function buildResultRows() {
  resultsList.innerHTML = ''
  const targets = TARGET_CURRENCIES.filter(c => c !== state.base)
  targets.forEach(code => {
    const row = document.createElement('div')
    row.className = 'currency-row loading'
    row.dataset.code = code
    row.innerHTML = `
      <span class="currency-flag">${FLAGS[code] || ''}</span>
      <span class="currency-code">${code.toUpperCase()}</span>
      <span class="currency-name">${ZH_NAMES[code] || state.names[code] || ''}</span>
      <span class="currency-amount skeleton" style="width:6rem">&nbsp;</span>
      <button class="history-btn" data-code="${code}" aria-label="${code.toUpperCase()} 歷史走勢">📈</button>
    `
    resultsList.appendChild(row)
  })
}

function updateRows() {
  const amount = parseFloat(amountInput.value)
  const rows = resultsList.querySelectorAll('.currency-row')

  rows.forEach(row => {
    const code = row.dataset.code
    const amountEl = row.querySelector('.currency-amount')
    row.classList.remove('loading')
    amountEl.classList.remove('skeleton')

    if (isNaN(amount) || amount < 0 || !state.rates[code]) {
      amountEl.textContent = '—'
      return
    }

    const result = amount * state.rates[code]
    amountEl.textContent = fmt(result, code)
  })
}

// --- API ---

async function loadNames() {
  const res = await fetch(`${API_BASE}/currencies.json`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  state.names = await res.json()
}

async function fetchRates(base) {
  const res = await fetch(`${API_BASE}/currencies/${base}.json`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  state.rates = data[base]  // e.g. data['twd'] = { usd: 0.031, eur: 0.027, ... }
  return data.date
}

function populateBaseSelect() {
  baseSelect.innerHTML = ''
  BASE_OPTIONS.forEach(code => {
    const opt = document.createElement('option')
    opt.value = code
    opt.textContent = `${FLAGS[code] || ''} ${code.toUpperCase()}`
    baseSelect.appendChild(opt)
  })
  baseSelect.value = state.base
}

// --- Init & refresh ---

async function refresh(base) {
  state.base = base
  hideError()
  buildResultRows()  // show skeletons immediately

  try {
    const date = await fetchRates(base)
    if (date) {
      updateTime.textContent = `資料日期 ${date}`
    }
    updateRows()
  } catch (err) {
    showError('無法取得最新匯率，請檢查網路連線後重試')
    console.error('fetchRates error:', err)
  }
}

async function init() {
  try {
    await loadNames()
  } catch (err) {
    console.warn('載入幣種名稱失敗，使用代碼替代', err)
  }

  populateBaseSelect()
  await refresh(state.base)
}

// --- History chart ---

let historyChart = null

async function fetchHistory(base, target) {
  const today = new Date()
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (29 - i))
    return d.toISOString().slice(0, 10)  // YYYY-MM-DD
  })

  const results = await Promise.all(
    dates.map(async date => {
      try {
        const res = await fetch(
          `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${base}.json`,
          { signal: AbortSignal.timeout(5000) }
        )
        if (!res.ok) return null
        const data = await res.json()
        const rate = data[base]?.[target]
        return rate != null ? { date, rate } : null
      } catch {
        return null
      }
    })
  )
  return results.filter(Boolean)
}

function renderChart(data, base, target) {
  const rates = data.map(d => d.rate)
  const maxRate = Math.max(...rates)
  const minRate = Math.min(...rates)

  const pointColors = rates.map(r => {
    if (r === maxRate) return '#22c55e'
    if (r === minRate) return '#ef4444'
    return '#6c63ff'
  })

  const ctx = document.getElementById('history-chart').getContext('2d')
  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date.slice(5)),  // MM-DD
      datasets: [{
        data: rates,
        borderColor: '#6c63ff',
        borderWidth: 2,
        pointBackgroundColor: pointColors,
        pointRadius: 3,
        tension: 0.3,
        fill: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y}${ctx.parsed.y === maxRate ? ' ▲最高' : ctx.parsed.y === minRate ? ' ▼最低' : ''}`,
          }
        }
      },
      scales: {
        x: { ticks: { font: { size: 10 } } },
        y: { ticks: { font: { size: 10 } } },
      }
    }
  })
}

async function openHistoryModal(base, target) {
  const modal = document.getElementById('chart-modal')
  const titleEl = document.getElementById('chart-title')
  const loadingEl = document.getElementById('chart-loading')
  const canvasWrap = document.getElementById('chart-canvas-wrap')

  titleEl.textContent = `${base.toUpperCase()} → ${target.toUpperCase()} 近 30 天走勢`
  loadingEl.hidden = false
  canvasWrap.hidden = true
  modal.hidden = false

  const data = await fetchHistory(base, target)

  loadingEl.hidden = true
  if (data.length > 0) {
    canvasWrap.hidden = false
    renderChart(data, base, target)
  } else {
    loadingEl.textContent = '無法取得歷史資料'
    loadingEl.hidden = false
  }
}

function closeHistoryModal() {
  const modal = document.getElementById('chart-modal')
  modal.hidden = true
  if (historyChart) {
    historyChart.destroy()
    historyChart = null
  }
  document.getElementById('chart-loading').textContent = '載入中…'
}

document.getElementById('chart-modal-close').addEventListener('click', closeHistoryModal)
document.getElementById('chart-modal-overlay').addEventListener('click', closeHistoryModal)

// --- Events ---

resultsList.addEventListener('click', e => {
  const btn = e.target.closest('.history-btn')
  if (btn) openHistoryModal(state.base, btn.dataset.code)
})

document.getElementById('refresh-btn').addEventListener('click', () => {
  state.lastFetchBase = null
  refresh(baseSelect.value)
})

amountInput.addEventListener('input', debounce(updateRows, 250))

baseSelect.addEventListener('change', () => {
  refresh(baseSelect.value)
})

init()
