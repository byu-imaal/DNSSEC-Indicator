'use strict'

import dnsPacket from 'dns-packet'
import { Buffer } from 'buffer/' // the slash is required

const state = {}
const dohServer = 'dns.google'
const protocols = ['http', 'https', 'ftp']

chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.sync.set({ dohServer })
	console.log(`DoH server set to "${dohServer}" (default)`)
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {

	if (changeInfo.status == 'complete') {
		const url = new URL(tab.url)

		if (tabId in state && state[tabId].hostname == url.hostname) {
			return
		}

		updateHostname(tabId, url)
		await updateStatus(tabId)
		updateIcon(tabId)
	}
})

chrome.tabs.onActivated.addListener(async activeInfo => {
	const tabId = activeInfo.tabId

	if (!(tabId in state)) {
		const tab = await chrome.tabs.get(tabId)
		updateHostname(tabId, tab.url)
		await updateStatus(tabId)
	}

	updateIcon(tabId)
})

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
	delete state[tabId]
})

function updateHostname(tabId, url) {
	let hostname = ''
	
	try {
		if (typeof(url) != URL) {
			url = new URL(url) // url could be empty or malformed
		}

		// remove the colon
		const protocol = url.protocol.substring(0, url.protocol.length - 1)

		if (protocols.includes(protocol)) {
			hostname = url.hostname
		}
	} catch {
		console.log(`exception in updateHostname: ${typeof(url)} "${url}"`)
	}

	state[tabId] = {
		hostname: hostname,
		status: 'default',
	}
}

async function updateStatus(tabId) {
	const { hostname } = state[tabId]

	if (hostname == '') {
		console.log(`updateStatus for ${tabId}: empty hostname or unsupported protocol`)
		return
	}

	console.log(`updateStatus for ${tabId} (${hostname})`)
	
	const { dohServer } = await chrome.storage.sync.get('dohServer')
	
	const response = await dohQuery(hostname, dohServer, true)

	if (response.rcode == 'SERVFAIL') {
		// check to see if it failed because it's bogus
		const response2 = await dohQuery(hostname, dohServer, false)
		
		if (response2.rcode != 'SERVFAIL') {
			state[tabId].status = 'bogus'
		} else {
			state[tabId].status = 'default'
		}
	} else if (response.flag_ad) {
		state[tabId].status = 'secure'
	} else {
		state[tabId].status = 'insecure'
	}

	console.log(`new status for ${tabId} (${hostname}): ${state[tabId].status}`)
}

async function dohQuery(qname, dohServer, dnssec=true) {

	const resolver = `https://${dohServer}/dns-query`

	const requestBuf = dnsPacket.encode({
		type: 'query',
		id: 0,
		flags:
			dnsPacket.RECURSION_DESIRED |
			dnsPacket.AUTHENTIC_DATA |
			(dnssec ? 0 : dnsPacket.CHECKING_DISABLED),
		questions: [{
			type: 'A',
			name: qname,
		}]
	})

	const response = await fetch(resolver, {
		method: 'POST',
		headers: {
			'Accept': 'application/dns-message',
			'Content-Type': 'application/dns-message',
			'Content-Length': requestBuf.byteLength,
		},
		body: requestBuf,
	})

	const responseBuf = Buffer.from(await response.arrayBuffer())

	return dnsPacket.decode(responseBuf)
}

function updateIcon(tabId) {
	console.log(`updateIcon for ${tabId}`)

	let color
	switch (state[tabId].status) {
		case 'secure':
			color = 'green'
			break
		case 'insecure':
			color = 'blue'
			break
		case 'bogus':
			color = 'red'
			break
		default:
			color = 'grey'
	}

	console.log(`new icon for ${tabId} (${state[tabId].status}): ${color}`)

	const canvas = new OffscreenCanvas(16, 16)
	const context = canvas.getContext('2d')
	context.clearRect(0, 0, 16, 16)
	context.fillStyle = color
	context.fillRect(0, 0, 16, 16)
	const imageData = context.getImageData(0, 0, 16, 16)
	chrome.action.setIcon({ imageData: imageData }, () => { /* ... */ })

	// chrome.action.setBadgeBackgroundColor({color:"blue"})
	// chrome.action.setBadgeText({text:"3"})
}