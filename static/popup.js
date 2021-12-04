// initialize field with user's current doh server
let dohServerField = document.getElementById("dohServerField")

chrome.storage.sync.get("dohServer", ({ dohServer }) => {
	dohServerField.value = dohServer
})

dohServerField.addEventListener("input", e => {
	dohServer = e.target.value
	chrome.storage.sync.set({ dohServer })
	console.log(`DoH server set to "${dohServer}"`)
})
