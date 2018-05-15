import { latestTime, increaseTimeTo, duration} from './helpers/time';
const helpers = require('./helpers');


const TokenVestingTimelockManager = artifacts.require('./TokenVestingTimelockManager.sol');
const StandardTokenMock = artifacts.require('./test/StandardTokenMock.sol');
const TokenVestingTimelock = artifacts.require('./TokenVestingTimelock.sol');

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('TokenVestingTimelockManager', function (accounts)  {

  const amount = new BigNumber(1000);
  var owner;
  var beneficiary;
  var contractsOwner;

  beforeEach(async function () {
    owner = accounts[0];
    beneficiary = accounts[1];
    contractsOwner =  accounts[3];
    this.token = await StandardTokenMock.new(owner, amount);
    this.start = latestTime() + duration.minutes(1); // +1 minute so it starts after contract instantiation
    this.duration = duration.years(2);
    this.lockedPeriod = duration.years(1);
    this.releaseTime = this.start + this.lockedPeriod;
    this.vestingManager = await TokenVestingTimelockManager.new(this.token.address,contractsOwner);
    await this.token.transfer(this.vestingManager.address,amount);
  });

  it('addVestedContract log', async function () {
      var tx = await this.vestingManager.addVestedContract(beneficiary,this.start,this.duration,true,this.releaseTime,1);
      assert.equal(tx.logs.length, 2);
      assert.equal(tx.logs[1].event, "AddVestedContract");
      assert.equal(tx.logs[1].args._beneficiary,beneficiary);
      await this.vestingManager
      assert.equal(tx.logs[1].args._contract,await this.vestingManager.getVestedContract(beneficiary));
  });

  it('addVestedContract check onlyOwner ', async function () {

      await this.vestingManager.addVestedContract(beneficiary,this.start,this.duration,true,this.releaseTime,1,{from :accounts[1]}).should.be.rejected;
  });

  it('addVestedContracts ', async function () {
    var beneficiaries = [accounts[1],accounts[2],accounts[3]];
    var starts = [this.start,this.start,this.start];
    var duration =  [this.duration,this.duration,this.duration];
    var recoverables = [true,false,false];
    var releaseTimes = [this.releaseTime,this.releaseTime,this.releaseTime];
    var amounts = [1,2,3];
    var tx = await this.vestingManager.addVestedContracts(beneficiaries,starts,duration,recoverables,releaseTimes,amounts,{from :owner});
    assert.equal(tx.logs.length, 6);
    assert.equal(tx.logs[5].event, "AddVestedContract");
    assert.equal(tx.logs[5].args._beneficiary,beneficiaries[2]);
    assert.equal(tx.logs[5].args._contract,await this.vestingManager.getVestedContract(beneficiaries[2]));
    var vestingContractAddress = await this.vestingManager.getVestedContract(beneficiaries[2]);
    var vestingContract = TokenVestingTimelock.at(vestingContractAddress);
    assert.equal(await vestingContract.owner(),contractsOwner);

  });

  it('drain ', async function () {
    assert.equal(await this.token.balanceOf(accounts[2]),0);
    await this.vestingManager.drain({from : owner});
    var balance = await this.token.balanceOf(owner);
    if (balance.equals(amount) === false) {
      assert.equal(true,false);
    }
  });

  it('drain onlyOwner', async function () {
    await this.vestingManager.drain({from : accounts[2]}).should.be.rejected;
  });
});
