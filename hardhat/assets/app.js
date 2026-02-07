// Requires ethers v5 CDN
const { CHAIN_ID, GAME_ADDRESS, FACTORY_ADDRESS, STORE_ADDRESS } = window.APP_CONFIG;

const GAME_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const FACTORY_ABI = [
  "function createCampaign(string title, uint256 goalWei, uint256 durationSeconds) returns (address)",
  "function getCampaigns() view returns (address[])"
];


const CAMPAIGN_ABI = [
  "function name() view returns (string)",
  "function goal() view returns (uint256)",
  "function deadline() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function contribute() payable",
  "function finalizeCampaign()",
  "function owner() view returns (address)"
];

const STORE_ABI = [
  "function getPrice(uint256 basePrice) view returns (uint256)",
  "function buy(uint256 itemId, uint256 basePrice)"
];

function el(id){ return document.getElementById(id); }
function shortAddr(a){ return a ? a.slice(0,6) + "..." + a.slice(-4) : ""; }

async function getProvider() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  return new ethers.providers.Web3Provider(window.ethereum);
}

async function ensureSepolia(provider){
  const net = await provider.getNetwork();
  const chainHex = "0x" + net.chainId.toString(16);
  if (chainHex.toLowerCase() !== CHAIN_ID.toLowerCase()) {
    throw new Error("Wrong network. Please switch to Sepolia.");
  }
}

async function connectWallet(){
  const provider = await getProvider();
  await provider.send("eth_requestAccounts", []);
  await ensureSepolia(provider);
  const signer = provider.getSigner();
  const addr = await signer.getAddress();
  localStorage.setItem("wallet", addr);
  return { provider, signer, addr };
}

async function getWalletIfConnected(){
  const provider = await getProvider();
  const accounts = await provider.listAccounts();
  if (!accounts || accounts.length === 0) return null;
  await ensureSepolia(provider);
  const signer = provider.getSigner();
  const addr = accounts[0];
  localStorage.setItem("wallet", addr);
  return { provider, signer, addr };
}

async function loadBalances(){
  const s = await connectWallet();
  const ethBal = await s.provider.getBalance(s.addr);

  const game = new ethers.Contract(GAME_ADDRESS, GAME_ABI, s.provider);
  const dec = await game.decimals();
  const sym = await game.symbol();
  const gameBal = await game.balanceOf(s.addr);

  if (el("wallet")) el("wallet").textContent = shortAddr(s.addr);
  if (el("ethBal")) el("ethBal").textContent = ethers.utils.formatEther(ethBal) + " ETH";
  if (el("gameBal")) el("gameBal").textContent = ethers.utils.formatUnits(gameBal, dec) + " " + sym;
}

async function createCampaignUI(){
  const status = el("status");

  try {
    status.textContent = "Checking wallet…";

    const { signer, addr } = await connectWallet();

    const title = el("title").value.trim();
    let goalEth = el("goal").value.trim().replace(",", "."); // защита от запятой
    const daysStr = el("days").value.trim();

    if (!title) throw new Error("Title is empty");
    if (!goalEth) throw new Error("Goal is empty");
    if (!daysStr) throw new Error("Duration (days) is empty");

    const days = Number(daysStr);
    if (!Number.isFinite(days) || days <= 0) throw new Error("Days must be a number > 0");

    const goalWei = ethers.utils.parseEther(goalEth);
    const durationSeconds = Math.floor(days * 24 * 60 * 60);

    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

    status.textContent = "Sending transaction…";

    const tx = await factory.createCampaign(title, goalWei, durationSeconds);

    status.textContent = "Tx sent: " + tx.hash + " (waiting…)";
    const receipt = await tx.wait();

    status.textContent = "Campaign created ✅ Block: " + receipt.blockNumber;

  } catch (e) {
    const msg =
      e?.data?.message ||
      e?.error?.message ||
      e?.reason ||
      e?.message ||
      String(e);

    el("status").textContent = "Error: " + msg;
    console.error(e);
  }
}


async function renderCampaigns(){
  const session = await getWalletIfConnected();
  if (!session) {
    el("list").innerHTML = `<div class="card">Connect wallet first on Connect page.</div>`;
    return;
  }

  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, session.provider);
  const addresses = await factory.getCampaigns();

  if (addresses.length === 0){
    el("list").innerHTML = `<div class="card">No campaigns yet. Create one!</div>`;
    return;
  }

  const now = Math.floor(Date.now()/1000);

  const cards = await Promise.all(addresses.map(async (addr) => {
    const c = new ethers.Contract(addr, CAMPAIGN_ABI, session.provider);
    const [title, goal, deadline, raised, owner] = await Promise.all([
      c.name(), c.goal(), c.deadline(), c.totalRaised(), c.owner()
    ]);

    const secondsLeft = Math.max(0, deadline.toNumber() - now);
    const days = Math.floor(secondsLeft / 86400);
    const hrs = Math.floor((secondsLeft % 86400) / 3600);

    return `
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <div>
            <div class="badge">Campaign</div>
            <h3 style="margin:10px 0 6px">${title}</h3>
            <small class="muted">Address: ${shortAddr(addr)} • Owner: ${shortAddr(owner)}</small>
          </div>
          <div class="badge">⏳ ${days}d ${hrs}h</div>
        </div>
        <hr/>
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
          <div><small class="muted">Goal</small><div>${ethers.utils.formatEther(goal)} ETH</div></div>
          <div><small class="muted">Raised</small><div>${ethers.utils.formatEther(raised)} ETH</div></div>
          <div><small class="muted">Deadline</small><div>${new Date(deadline.toNumber()*1000).toLocaleString()}</div></div>
        </div>
        <hr/>
        <label>Contribute (ETH)</label>
        <div class="row">
          <input id="amt-${addr}" placeholder="0.01" style="flex:1"/>
          <button class="btn primary" onclick="contributeTo('${addr}')">Contribute</button>
          <button class="btn" onclick="finalize('${addr}')">Finalize (Owner)</button>
        </div>
        <small class="muted" id="msg-${addr}"></small>
      </div>
    `;
  }));

  el("list").innerHTML = cards.join("");
}

async function contributeTo(campaignAddr){
  const { signer } = await connectWallet();
  const c = new ethers.Contract(campaignAddr, CAMPAIGN_ABI, signer);
  const amt = el(`amt-${campaignAddr}`).value.trim();
  const value = ethers.utils.parseEther(amt);

  const tx = await c.contribute({ value });
  el(`msg-${campaignAddr}`).textContent = "Tx: " + tx.hash;
  await tx.wait();
  el(`msg-${campaignAddr}`).textContent = "Contribution success ✅ Tokens minted! Check Balance page.";
}

async function finalize(campaignAddr){
  const { signer } = await connectWallet();
  const c = new ethers.Contract(campaignAddr, CAMPAIGN_ABI, signer);

  const tx = await c.finalizeCampaign();
  el(`msg-${campaignAddr}`).textContent = "Finalize tx: " + tx.hash;
  await tx.wait();
  el(`msg-${campaignAddr}`).textContent = "Finalized ✅";
}

async function storeLoad(){
  const session = await connectWallet();
  const provider = session.provider;
  const signer = session.signer;

  const game = new ethers.Contract(GAME_ADDRESS, GAME_ABI, provider);
  const dec = await game.decimals();

  const store = new ethers.Contract(STORE_ADDRESS, STORE_ABI, provider);

  // base prices in tokens (human units)
  const items = [
    { id: 1, name: "Purple Skin", base: "50" },
    { id: 2, name: "XP Booster", base: "80" },
    { id: 3, name: "Premium Badge", base: "120" },
  ];

  const rows = await Promise.all(items.map(async (it) => {
    const baseWei = ethers.utils.parseUnits(it.base, dec);
    const priceWei = await store.getPrice(baseWei);
    return `
      <div class="card">
        <div class="badge">Store Item</div>
        <h3 style="margin:10px 0 6px">${it.name}</h3>
        <p>Dynamic in-app price (simulation only).</p>
        <div class="row" style="justify-content:space-between">
          <div>
            <small class="muted">Base</small><div>${it.base} GAME</div>
          </div>
          <div>
            <small class="muted">Current Price</small><div>${ethers.utils.formatUnits(priceWei, dec)} GAME</div>
          </div>
        </div>
        <hr/>
        <button class="btn primary" onclick="buyItem(${it.id}, '${it.base}')">Buy</button>
        <small class="muted" id="buymsg-${it.id}"></small>
      </div>
    `;
  }));

  el("storeList").innerHTML = rows.join("");

  // show balances too
  await loadBalances();

  // expose buy
  window.buyItem = async (itemId, base) => {
    const gameWithSigner = new ethers.Contract(GAME_ADDRESS, GAME_ABI, signer);
    const storeWithSigner = new ethers.Contract(STORE_ADDRESS, STORE_ABI, signer);

    const baseWei = ethers.utils.parseUnits(base, dec);
    const priceWei = await storeWithSigner.getPrice(baseWei);

    // approve then buy
    const tx1 = await gameWithSigner.approve(STORE_ADDRESS, priceWei);
    el(`buymsg-${itemId}`).textContent = "Approve tx: " + tx1.hash;
    await tx1.wait();

    const tx2 = await storeWithSigner.buy(itemId, baseWei);
    el(`buymsg-${itemId}`).textContent = "Buy tx: " + tx2.hash;
    await tx2.wait();

    el(`buymsg-${itemId}`).textContent = "Purchased ✅ UI updated (refresh to see new dynamic price).";
    await loadBalances();
  };
}

// export for pages
window.APP = {
  connectWallet,
  loadBalances,
  createCampaignUI,
  renderCampaigns,
  storeLoad
};
