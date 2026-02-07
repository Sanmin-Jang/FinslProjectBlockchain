const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const GAME = await hre.ethers.getContractFactory("GAME");
  const game = await GAME.deploy();
  await game.waitForDeployment();

  const Factory = await hre.ethers.getContractFactory("CampaignFactory");
  const factory = await Factory.deploy(await game.getAddress());
  await factory.waitForDeployment();

  await (await game.transferOwnership(await factory.getAddress())).wait();


  const Store = await hre.ethers.getContractFactory("GameFiStore");
  const store = await Store.deploy(await game.getAddress());
  await store.waitForDeployment();

  console.log("GAME:", await game.getAddress());
  console.log("Factory:", await factory.getAddress());
  console.log("Store:", await store.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
