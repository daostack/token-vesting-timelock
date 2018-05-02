const MintableToken = artifacts.require("./MintableToken.sol");
const TokenVestingTimelockManager = artifacts.require("./TokenVestingTimelockManager.sol");

module.exports = async (deployer, network, accounts) => {
  let tokenAddress, beneficiaries, manager;

  if (network === 'development'){
    // Mock deployment
    await deployer.deploy(MintableToken);
    const token = await MintableToken.deployed();
    tokenAddress = token.address;
    beneficiaries = accounts.slice(0, 3).map(address => ({
      beneficiary: address,
      start: 5,
      duration: 10,
      revokable: true,
      releaseTime: 0,
      amount: 100
    }));

    await deployer.deploy(TokenVestingTimelockManager, tokenAddress);
    manager = await TokenVestingTimelockManager.deployed();

    const success = await token.mint(manager.address, 300);
  } else {
    // Real deployment
    const json = require('./vesting.json'); // load vesting config from json file.
    tokenAddress = json.tokenAddress;
    beneficiaries = json.beneficiaries;

    await deployer.deploy(TokenVestingTimelockManager, tokenAddress);
    manager = await TokenVestingTimelockManager.deployed();
  }

  await manager.addVestedContracts(
    beneficiaries.map(x => x.beneficiary),
    beneficiaries.map(x => x.start),
    beneficiaries.map(x => x.duration),
    beneficiaries.map(x => x.revokable),
    beneficiaries.map(x => x.releaseTime),
    beneficiaries.map(x => x.amount)
  )

  console.log(`Deployed 'TokenVestingTimelockManager' to network: ${network}, with tokenAddress = ${tokenAddress} and the following beneficiaries:`);
  console.log(JSON.stringify(beneficiaries, undefined, 2));
};
