import { latestTime, increaseTimeTo, duration} from './helpers/time';
const helpers = require('./helpers');


const TokenVestingTimelockManager = artifacts.require('./TokenVestingTimelockManager.sol');
const StandardTokenMock = artifacts.require('./test/StandardTokenMock.sol');

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('TokenVestingTimelockManager', function (accounts)  {

  const amount = new BigNumber(1000);
  var owner;
  var beneficiary;

  beforeEach(async function () {
    owner = accounts[0];
    beneficiary = accounts[1];
    this.token = await StandardTokenMock.new(owner, amount);
    this.start = latestTime() + duration.minutes(1); // +1 minute so it starts after contract instantiation
    this.duration = duration.years(2);
    this.lockedPeriod = duration.years(1);
    this.releaseTime = this.start + this.lockedPeriod;
    this.vestingManager = await TokenVestingTimelockManager.new(this.token.address);
    await this.token.transfer(this.vestingManager.address,amount);
  });

  it('addVestedContract log', async function () {
      var tx = await this.vestingManager.addVestedContract(beneficiary,this.start,this.duration,true,this.releaseTime,1);
      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "AddVestedContract");
      assert.equal(tx.logs[0].args._beneficiary,beneficiary);
      await this.vestingManager
      assert.equal(tx.logs[0].args._contract,await this.vestingManager.getVestedContract(beneficiary));
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
    assert.equal(tx.logs.length, 3);
    assert.equal(tx.logs[2].event, "AddVestedContract");
    assert.equal(tx.logs[2].args._beneficiary,beneficiaries[2]);
    assert.equal(tx.logs[2].args._contract,await this.vestingManager.getVestedContract(beneficiaries[2]));
  });

  it('drain ', async function () {
    assert.equal(await this.token.balanceOf(accounts[2]),0);
    await this.vestingManager.drain(accounts[2],{from : owner});
    var balance = await this.token.balanceOf(accounts[2]);
    if (balance.equals(amount) === false) {
      assert.equal(true,false);
    }
  });

  it('drain onlyOwner', async function () {
    await this.vestingManager.drain(accounts[1],{from : accounts[2]}).should.be.rejected;
  });

  it('revoke', async function () {
    await this.vestingManager.addVestedContract(beneficiary,this.start,this.duration,true,this.releaseTime,1);
    await increaseTimeTo(this.start + duration.minutes(1));
    await this.vestingManager.revoke(beneficiary,{from:owner}).should.be.fulfilled;
  });
  it('revoke for none exisiting beneficiary should fail', async function () {
    await increaseTimeTo(this.start + duration.minutes(1));
    await this.vestingManager.revoke(accounts[1],{from:owner}).should.be.rejected;
  });

  it('revoke onlyOwner', async function () {
    await increaseTimeTo(this.start + duration.minutes(1));
    await this.vestingManager.revoke(beneficiary,{from:accounts[2]}).should.be.rejected;
  });
});
