const CONTRACT_ADDRESS = "0x7671682F0C7FBF4fbD5808eAB315cF70a99b73f2";
//FIRST TEST IS AT: "0x949345Eeb64a13311Bf0c465672Dd33B46Bb3dE6"; 
const announcementsDictionary = {};

// calling to ERC5564Announcer located at 0x85c66C808298e3C10CD90126Ff5f2F4e80294C8b
// !! THIS ADDR IS A SEPOLIA ADDRESS WHERE I MANUALLY DEPLOYED THE ANNOUNCER !!
const ANNOUNCER_ADDRESS = "0x85c66C808298e3C10CD90126Ff5f2F4e80294C8b";
const ANNOUNCER_ABI = [
    "event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)"
];
let CONTRACT_ABI = null;

// LOADING ABI 
async function loadABI() {
    try {
        const response = await fetch('../JSON/naivecontractABI.json');
        if (!response.ok) throw new Error('Failed to load ABI JSON');
        CONTRACT_ABI = await response.json();
        console.log('ABI loaded:', CONTRACT_ABI);
    } catch (error) {
        console.error('Error loading ABI:', error);
        alert("Failed to load contract ABI. Check console for details.");
    }
}

// GENERATING ADDRESS
async function generateAddress() {
    try {
        // CHECK IF ABI IS LOADED
        if (!CONTRACT_ABI) {
            alert("ABI not loaded. Please reload the page.");
            return;
        }
        // IS METAMASK AVAILABLE?
        if (!window.ethereum) {
            alert("MetaMask is required to interact with this dApp");
            return;
        }
        // CONNECT TO METAMASK
        await ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        // CONNECT TO CONTRACT
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        // GET INPUT VALUE
        const stealthMetaAddress = document.getElementById("stealthMetaAddress").value.replace(/^st:eth:/, "");
        if (!stealthMetaAddress) {
            alert("Please enter a stealth meta address in hex format!");
            return;
        }
        // CONVERT TO BYTES IF IN HEX
        const stealthMetaBytes = ethers.utils.arrayify(stealthMetaAddress);
        // CALLING FUNCTION
        const result = await contract.generateStealthAddress(stealthMetaBytes);
        // SHOW RESULT
        const resultDiv = document.getElementById("result");
        document.getElementById("txtboxSA").value = result.stealthAddress;
        document.getElementById("txtboxANN").value = ethers.utils.hexlify(result.ephemeralPubKey);
        document.getElementById("txtboxVT").value = ethers.utils.hexlify(result.viewTag);
        document.getElementById("btnannounce").removeAttribute("disabled");
    } catch (error) {
        console.error(error);
        alert("An error occurred: " + error.message);
    }
}

async function announce() {
    try {
        // checking metamask
        if (!window.ethereum) {
            alert("MetaMask is required to interact with this dApp");
            return;
        }
        // connecting to metamask
        await ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        // connecting to announcer contract
        const announcerABI = [
            "function announce(uint256 schemeId, address stealthAddress, bytes ephemeralPubKey, bytes metadata) external",
        ];
        const announcer = new ethers.Contract(ANNOUNCER_ADDRESS, announcerABI, signer);
        const schemeId = 1;
        const stealthAddress = document.getElementById("txtboxSA").value;
        const ephemeralPubKey = ethers.utils.arrayify(document.getElementById("txtboxANN").value);
        const metadata = ethers.utils.arrayify(document.getElementById("txtboxVT").value);
        const tx = await announcer.announce(schemeId, stealthAddress, ephemeralPubKey, metadata);
        await tx.wait();

        alert("Announcement successful!");
    } catch (error) {
        console.error(error);
        alert("An error occurred: " + error.message);
    }
}

async function parseAnnouncements() {
    const announcementsDictionary = {};
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const contract = new ethers.Contract(ANNOUNCER_ADDRESS, ANNOUNCER_ABI, provider);
        const filter = contract.filters.Announcement();
        const logs = await provider.getLogs({
            ...filter,
            fromBlock: 0,
            toBlock: "latest",
        });
        if (logs.length === 0) {
            console.log("Nessun log trovato.");
            document.getElementById("results").innerHTML = "<p>Nessun evento trovato.</p>";
            return;
        }
        const parsedLogs = logs.map((log) => contract.interface.parseLog(log));
        const resultsDiv = document.getElementById("results");
        resultsDiv.innerHTML = "";

        let tableHTML = `
            <div class="table-responsive">
                <table class="table table-dark table-striped table-hover">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th><label class="t-title-label">Scheme ID</label></th>
                            <th><label class="t-title-label">Stealth Address</label></th>
                            <th><label class="t-title-label">Caller</label></th>
                            <th><label class="t-title-label">Ephemeral PubKey</label></th>
                            <th><label class="t-title-label">View Tag</label> </th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        parsedLogs.forEach((log, index) => {
            const { schemeId, stealthAddress, caller, ephemeralPubKey, metadata } = log.args;
            const viewTag = metadata.slice(0, 4);
            tableHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${ethers.utils.hexlify(schemeId)}</td>
                    <td>${ethers.utils.hexlify(stealthAddress)}</td>
                    <td>${ethers.utils.hexlify(caller)}</td>
                    <td>${ethers.utils.hexlify(ephemeralPubKey)}</td>
                    <td>${viewTag}</td>
                </tr>
            `;
            announcementsDictionary[index] = {
                stealthAddress: stealthAddress,
                caller: caller,
                ephemeralPubKey: ephemeralPubKey,
                metadata: metadata
            };
        });
        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;
        resultsDiv.innerHTML = tableHTML;
        localStorage.setItem("announcementsDictionary", JSON.stringify(announcementsDictionary));
        console.log(localStorage.getItem("announcementsDictionary"));
        document.getElementById("privateViewingKey").removeAttribute("hidden");
        document.getElementById("publicSpendingKey").removeAttribute("hidden");
        document.getElementById("privateSpendingKey").removeAttribute("hidden");
        document.getElementById("btnCompute").removeAttribute("disabled");
    } catch (error) {
        console.error("Error parsing announcements:", error);
        document.getElementById("results").innerHTML = `<p>Errore durante l'analisi: ${error.message}</p>`;
    }
}

async function checkSA() {
    // CONNECT TO METAMASK
    await ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    // CONNECT TO CONTRACT
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    stealthAddresses = document.getElementById("divSA");
    stealthAddresses.innerHTML = "";
    let anns = localStorage.getItem("announcementsDictionary");
    if (!anns) {
        alert("No announcements fetched.");
        return;
    }
    anns = JSON.parse(anns);
    const viewingKey = document.getElementById("privateViewingKey").value;
    const publicSpendingKey = document.getElementById("publicSpendingKey").value;
    if (!viewingKey || !publicSpendingKey) {
        alert("Please provide both keys in order to compute.");
        return;
    }

    stealthAddresses.innerHTML = `
    <div class="table-responsive">
        <table id="stealthTable" class="table table-dark table-striped table-hover">
            <thead>
                <tr>
                    <th><label  class="t-title-label">Stealth Address</label></th>
                    <th><label  class="t-title-label">Is Valid</label></th>
                    <th><label class="t-title-label">Compute S-Key</th>
                    <th><label class="t-title-label">Stealth Key</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
    </div>
`;
    const tableBody = document.querySelector("#stealthTable tbody");

    for (const [index, value] of Object.entries(anns)) {
        const { stealthAddress, caller, ephemeralPubKey, metadata } = value;
        try {
            const isValid = await checkStealthAddress(contract, stealthAddress, ephemeralPubKey, viewingKey, publicSpendingKey);
            console.log(`Stealth address ${stealthAddress} is valid: ${isValid}`);
            const statusClass = isValid ? 'valid' : 'invalid';
            const buttonStatus = isValid ? '' : 'disabled'; // Rimuovi la stringa per pulsanti abilitati
            const rowHTML = `
            <tr>
                <td><strong><label class="${statusClass}">${stealthAddress}</label></strong></td>
                <td><label class="${statusClass}">${isValid}</label></td>
                <td>
                    <button 
                        id="btnSA${stealthAddress}" 
                        onclick="computeSKWrapper('${stealthAddress}', '${ephemeralPubKey}', '${viewingKey}')" 
                        class="btn btn-primary" 
                        ${buttonStatus}>
                        Compute S-KEY
                    </button>
                </td>
                <td><label id="lblSA${stealthAddress}"></label></td>
            </tr>`;
            tableBody.innerHTML += rowHTML;

        } catch (error) {
            console.error(`Error checking stealth address ${stealthAddress}: ${error.message}`);
        }
    }

}
async function checkStealthAddress(contract, stealthAddress, ephemeralPubKey, viewingKey, spendingKey) {
    try {
        const result = await contract.checkStealthAddress(stealthAddress, ephemeralPubKey, viewingKey, spendingKey);
        return result;
    } catch (error) {
        console.error("Error calling checkStealthAddress:", error);
        throw new Error("Error checking stealth address");
    }
}

async function computeSKWrapper(stealthAddress, ephemeralPubKey, viewingKey) {
    spendingKey = document.getElementById("privateSpendingKey").value;
    if (!privateSpendingKey) {
        alert("Please enter your private spending key in order to compute the stealth key");
        return;
    }
    currentSK = await computeSK(stealthAddress, ephemeralPubKey, viewingKey, spendingKey);
    document.getElementById("lblSA" + stealthAddress).textContent = currentSK;
}

async function computeSK(stealthAddress, ephemeralPubKey, viewingKey, spendingKey) {
    console.log(stealthAddress, ephemeralPubKey, viewingKey, spendingKey);
    // CONNECT TO METAMASK
    await ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    // CONNECT TO CONTRACT
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    try {
        const result = await contract.computeStealthKey(stealthAddress, ephemeralPubKey, viewingKey, spendingKey);
        return result
    } catch (error) {
        console.error("Error calling computeStealthKey: ", error);
        throw new Error("Error while computing Stealth Key");
    }
}

async function checkBalance() {
    const stealthAddress = document.getElementById("stealthAddressInput").value;
    const privateKey = document.getElementById("privateKeyInput").value;
    if (!stealthAddress || !privateKey) {
        alert("Please enter both stealth address and private key.");
        return;
    }
    try {
        if (typeof window.ethereum === 'undefined') {
            alert('MetaMask is not installed!');
            return;
        }
        await ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const wallet = new ethers.Wallet(privateKey, provider);
        const address = await wallet.getAddress();

        if (address.toLowerCase() != stealthAddress.toLowerCase()) {
            alert("The private key does not match the stealth address.");
            return;
        }
        const balance = await provider.getBalance(stealthAddress);
        const balanceInEther = ethers.utils.formatEther(balance); // Converte il bilancio da wei a ether

        document.getElementById("result").innerHTML = `
                    <h4>Account Info</h4>
                    <p class="p-result"><strong>Address:</strong> ${stealthAddress}</p>
                    <p class="p-result"><strong>Balance:</strong> ${balanceInEther} ETH</p>
                `;
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while fetching the balance.");
    }
}

async function generateStealthMetaAddress() {
    try {
        const privateSpendingKey = ethers.utils.hexlify(ethers.utils.randomBytes(32)); 
        const privateViewKey = ethers.utils.hexlify(ethers.utils.randomBytes(32)); 

        const publicSpendingKey = ethers.utils.computePublicKey(privateSpendingKey, true); 
        const publicViewKey = ethers.utils.computePublicKey(privateViewKey, true); 

        const stealthMetaAddress = `st:eth:${publicSpendingKey}${publicViewKey.slice(2)}`; 
        document.getElementById("stealthMetaAddress").value = stealthMetaAddress;
        document.getElementById("publicViewKey").value = publicViewKey;
        document.getElementById("privateViewKey").value = privateViewKey;
        document.getElementById("publicSpendingKey").value = publicSpendingKey;
        document.getElementById("privateSpendingKey").value = privateSpendingKey;

    } catch (error) {
        console.error("Error generating stealth meta address and keys:", error);
        alert("An error occurred. Please try again.");
    }
}




