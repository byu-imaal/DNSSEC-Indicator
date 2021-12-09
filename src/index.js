'use strict'

import dnsPacket from 'dns-packet'
import { Buffer } from 'buffer/' // the slash is required

const state = {}

const defaultDohServer = 'dns.google'
const defaultProtocols = ['http', 'https', 'ftp']
const defaultRetryFrequency = 1000

class DohError extends Error {
	constructor(message) {
		super(message)
		this.name = 'DohError'
	}
}

chrome.runtime.onInstalled.addListener(async () => {

	const data = await chrome.storage.sync.get({
		dohServer: defaultDohServer,
		protocols: defaultProtocols,
		retryFrequency: defaultRetryFrequency,
	})

	await chrome.storage.sync.set({
		dohServer: data.dohServer,
		protocols: data.protocols,
		retryFrequency: data.retryFrequency,
	})

	console.log(`Current settings:
	dohServer: ${data.dohServer}
	protocols: ${data.protocols}
	retryFrequency: ${data.retryFrequency}`)

	// run on all active tabs

	const activeTabs = await chrome.tabs.query({
		active: true,
	})

	activeTabs.forEach(async tab => {
		await updateHostname(tab.id, tab.url)
		await updateStatus(tab.id)
		updateIcon(tab.id)
	})
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {

	if (changeInfo.status == 'complete') {
		const url = new URL(tab.url)

		if (tabId in state) {

			if (state[tabId].retryTimeout) {
				clearTimeout(state[tabId].retryTimeout)
				delete state[tabId].retryTimeout
			}

			if (state[tabId].hostname == url.hostname && state[tabId].status != 'error') {
				return
			}
		}

		await updateHostname(tabId, url)
		await updateStatus(tabId)
		updateIcon(tabId)
	}
})

chrome.tabs.onActivated.addListener(async activeInfo => {
	const tabId = activeInfo.tabId

	if (tabId in state) {

		if (state[tabId].retryTimeout) {
			clearTimeout(state[tabId].retryTimeout)
			delete state[tabId].retryTimeout
		}

		if (state[tabId].status == 'error') {
			await updateStatus(tabId)
			updateIcon(tabId)
		}
	} else {
		const tab = await chrome.tabs.get(tabId)
		await updateHostname(tabId, tab.url)
		await updateStatus(tabId)
		updateIcon(tabId)
	}
})

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
	delete state[tabId]
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.type == 'status') {
		chrome.tabs.query({
			active: true,
			currentWindow: true,
		}, ([tab]) => {
			let url
			try {
				url = new URL(tab.url)
			} catch (e) {
				url = { origin: '<invalid>' }
			}
			sendResponse({
				domain: url.origin,
				status: state[tab.id].status,
			})
		})
		return true // indicate resopnse is asyncronous
	}
})

async function updateHostname(tabId, url) {
	let hostname = ''

	try {
		if (typeof (url) != URL) {
			url = new URL(url) // url could be empty or malformed
		}

		// remove the colon
		const protocol = url.protocol.substring(0, url.protocol.length - 1)

		const { protocols } = await chrome.storage.sync.get('protocols')

		if (protocols.includes(protocol)) {
			hostname = url.hostname
		}
	} catch {
		console.log(`exception in updateHostname: ${typeof (url)} "${url}"`)
	}

	state[tabId] = { hostname }
}

async function updateStatus(tabId) {
	const { hostname } = state[tabId]

	if (hostname == '') {
		state[tabId].status = 'unsupported'
		console.log(`updateStatus for ${tabId}: empty hostname or unsupported protocol`)
		return
	}

	console.log(`updateStatus for ${tabId} (${hostname})`)

	const { dohServer } = await chrome.storage.sync.get('dohServer')

	try {
		const response = await dohQuery(hostname, dohServer, true)

		if (response.rcode == 'SERVFAIL') {
			// check to see if it failed because it's bogus
			const response2 = await dohQuery(hostname, dohServer, false)

			if (response2.rcode != 'SERVFAIL') {
				state[tabId].status = 'bogus'
			} else {
				state[tabId].status = 'unsupported'
			}
		} else if (response.flag_ad) {
			state[tabId].status = 'secure'
		} else {
			state[tabId].status = 'insecure'
		}
	} catch (e) {
		if (e instanceof DohError) {

			state[tabId].status = 'error'

			if (state[tabId].retryTimeout) {
				clearTimeout(state[tabId].retryTimeout)
			}

			const { retryFrequency } = await chrome.storage.sync.get('retryFrequency')
			state[tabId].retryTimeout = setTimeout(async () => {
				await updateStatus(tabId)
				updateIcon(tabId)
			}, retryFrequency)

		} else {
			throw e
		}
	}

	console.log(`new status for ${tabId} (${hostname}): ${state[tabId].status}`)
}

async function dohQuery(qname, dohServer, dnssec = true) {

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

	// fetch fails if the internet is not connected, make it retry later
	let response
	try {
		response = await fetch(resolver, {
			method: 'POST',
			headers: {
				'Accept': 'application/dns-message',
				'Content-Type': 'application/dns-message',
				'Content-Length': requestBuf.byteLength,
			},
			body: requestBuf,
		})
	} catch (e) {
		if (e instanceof TypeError) {
			throw new DohError('Failed to fetch')
		} else {
			throw e
		}
	}

	const responseBuf = Buffer.from(await response.arrayBuffer())

	return dnsPacket.decode(responseBuf)
}

function updateIcon(tabId) {
	const status = state[tabId].status
	console.log(`updateIcon for ${tabId} to ${status}`)

	chrome.action.setIcon({
		tabId,
		path: {
			16: `icons/${status}/16.png`,
			32: `icons/${status}/32.png`,
			48: `icons/${status}/48.png`,
			128: `icons/${status}/128.png`,
		}
	})

	const capStatus = status.charAt(0).toUpperCase() + status.slice(1)
	chrome.action.setTitle({
		tabId,
		title: `DNSSEC Status: ${capStatus}`,
	})
}