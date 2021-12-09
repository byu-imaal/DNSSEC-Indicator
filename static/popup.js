
// nav

const nav = document.querySelector('nav')
const navItems = nav.querySelectorAll('.nav-item')
const content = document.querySelector('.content')
const contentPanes = content.querySelectorAll('.content-pane')

const clearActive = function () {
	navItems.forEach(item => {
		item.classList.remove('active')
	})
	contentPanes.forEach(pane => {
		pane.classList.remove('active')
	})
}

navItems.forEach(item => {
	item.addEventListener('click', () => {
		const pane = document.querySelector('#' + item.dataset.pane)
		clearActive()
		pane.classList.add('active')
		item.classList.add('active')
	})
})

// status

const domainField = document.getElementById('domain')
const statusField = document.getElementById('status')

chrome.runtime.sendMessage({ type: 'status' }, response => {
	domainField.innerHTML = response.domain
	statusField.innerHTML = response.status
})

// settings

const dohServerField = document.getElementById('dohServerField')
const protocolsField = document.getElementById('protocolsField')
const retryFrequencyField = document.getElementById('retryFrequencyField')

// initialize fields with user's current settings
chrome.storage.sync.get(
	['dohServer', 'protocols', 'retryFrequency'],
	({ dohServer, protocols, retryFrequency }) => {
		dohServerField.value = dohServer
		protocolsField.value = protocols
		retryFrequencyField.value = retryFrequency
	})

// update settings as they are changed
dohServerField.addEventListener('input', e => {
	dohServer = e.target.value
	chrome.storage.sync.set({ dohServer })
	console.log(`DoH server set to "${dohServer}"`)
})
protocolsField.addEventListener('input', e => {
	protocols = e.target.value.split(',')
	protocols = protocols.map(p => p.trim())
	chrome.storage.sync.set({ protocols })
	console.log(`Protocols set to "${protocols}"`)
})
retryFrequencyField.addEventListener('input', e => {
	retryFrequency = e.target.value
	chrome.storage.sync.set({ retryFrequency })
	console.log(`Retry frequency set to "${retryFrequency}"`)
})