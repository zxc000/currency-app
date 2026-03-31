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
      <span class="currency-name">${state.names[code] || ''}</span>
      <span class="currency-amount skeleton" style="width:6rem">&nbsp;</span>
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

// --- Events ---

document.getElementById('refresh-btn').addEventListener('click', () => {
  state.lastFetchBase = null
  refresh(baseSelect.value)
})

amountInput.addEventListener('input', debounce(updateRows, 250))

baseSelect.addEventListener('change', () => {
  refresh(baseSelect.value)
})

init()
