import latestTime from './helpers/latestTime';
import { increaseTimeTo, duration } from './helpers/increaseTime';
const helpers = require('./helpers');


const TokenVestingTimelock = artifacts.require('./TokenVestingTimelock.sol');
const StandardTokenMock = artifacts.require('./test/StandardTokenMock.sol');

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('TokenVestingAndTimelock', function (accounts)  {

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
    this.vesting = await TokenVestingTimelock.new(this.token.address,beneficiary, this.start, this.duration, true,this.releaseTime);
    await this.token.transfer(this.vesting.address,amount);
  });

  it('can immidietly revoke', async function () {
    console.log({revocable: await this.vesting.revocable(), revoked: await this.vesting.revoked()});
    await this.vesting.revoke({ from: owner });
  })

  it('cannot be released before release time', async function () {
    try {
      await this.vesting.release();
      assert(false, "cannot be released before release time");
    } catch(error) {
      helpers.assertVMException(error);
    }
  });
  it('can be released after release time', async function () {
    await increaseTimeTo(this.start + this.releaseTime + duration.weeks(1));
    assert.equal(await this.token.balanceOf(beneficiary),0);
    var tx  = await this.vesting.release();
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, "Released");
    if (await this.token.balanceOf(beneficiary) == 0) {
      assert.equal(true,false);
    }
  });

  it('should release proper amount after releaseTime', async function () {
    await increaseTimeTo(this.releaseTime);

    const { receipt } = await this.vesting.release();
    const releaseTime = web3.eth.getBlock(receipt.blockNumber).timestamp;

    const balance = await this.token.balanceOf(beneficiary);
    balance.should.bignumber.equal(amount.mul(releaseTime - this.start).div(this.duration).floor());
  });

  it('should linearly release tokens during vesting period', async function () {
    const vestingPeriod = this.duration - this.lockedPeriod;
    const checkpoints = 4;

    for (let i = 1; i <= checkpoints; i++) {
      const now = this.start + this.lockedPeriod + i * (vestingPeriod / checkpoints);
      await increaseTimeTo(now);

      await this.vesting.release();
      const balance = await this.token.balanceOf(beneficiary);
      const expectedVesting = amount.mul(now - this.start).div(this.duration).floor();

      balance.should.bignumber.equal(expectedVesting);
    }
  });

  it('should have released all after end', async function () {
    await increaseTimeTo(this.start + this.duration);
    await this.vesting.release();
    const balance = await this.token.balanceOf(beneficiary);
    balance.should.bignumber.equal(amount);
  });

  it('should be revoked by owner if revocable is set', async function () {
    await increaseTimeTo(this.start + duration.minutes(1));
    await this.vesting.revoke({ from: owner }).should.be.fulfilled;
  });

  it('should fail to be revoked by owner if revocable not set', async function () {
    const vesting = await TokenVestingTimelock.new(this.token.address,beneficiary, this.start,this.duration, false, this.releaseTime, { from: owner });
    await vesting.revoke( { from:  owner }).should.be.rejectedWith('revert');
  });

  it('should return the non-vested tokens when revoked by owner', async function () {
    await increaseTimeTo(this.start + this.lockedPeriod + duration.weeks(12));

    const vested = await this.vesting.vestedAmount();

    await this.vesting.revoke({ from: owner });

    const ownerBalance = await this.token.balanceOf(owner);
    ownerBalance.should.bignumber.equal(amount.sub(vested));
  });

  it('should keep the vested tokens when revoked by owner', async function () {
    await increaseTimeTo(this.start + this.lockedPeriod + duration.weeks(12));

    const vestedPre = await this.vesting.vestedAmount();

    await this.vesting.revoke({ from: owner });

    const vestedPost = await this.vesting.vestedAmount();

    vestedPre.should.bignumber.equal(vestedPost);
  });

  it('should fail to be revoked a second time', async function () {
    await increaseTimeTo(this.start + this.lockedPeriod + duration.weeks(12));

    await this.vesting.vestedAmount();

    await this.vesting.revoke({ from: owner });

    await this.vesting.revoke({ from: owner }).should.be.rejectedWith('revert');
  });

  it('cannot be released before time limit', async function () {
    await this.vesting.release().should.be.rejected;
  });

  it('cannot be released just before time limit', async function () {
    await increaseTimeTo(this.releaseTime - duration.seconds(3));
    await this.vesting.release().should.be.rejected;
  });

  it('can be released just after limit', async function () {
    await increaseTimeTo(this.releaseTime + duration.seconds(1));
    await this.vesting.release().should.be.fulfilled;
    const balance = await this.token.balanceOf(beneficiary);
    balance.should.be.bignumber.equal(amount.div(2));
  });

  it('can be released after time limit', async function () {
    await increaseTimeTo(this.releaseTime + duration.years(1));
    await this.vesting.release().should.be.fulfilled;
    const balance = await this.token.balanceOf(beneficiary);
    balance.should.be.bignumber.equal(amount);
  });

  it('cannot be released twice', async function () {
    await increaseTimeTo(this.releaseTime + duration.years(1));
    await this.vesting.release().should.be.fulfilled;
    await this.vesting.release().should.be.rejected;
    const balance = await this.token.balanceOf(beneficiary);
    balance.should.be.bignumber.equal(amount);
  });

  it('release time should be greater than now if it is not zero', async function () {
    await TokenVestingTimelock.new(this.token.address,beneficiary, this.start,this.duration, false, 1, { from: owner }).should.be.rejected;
  });

  it('release time can be zero', async function () {
    await TokenVestingTimelock.new(this.token.address,beneficiary, this.start,this.duration, false, 0, { from: owner }).should.be.fulfilled;
  });

  it('can be released any time if release time is zero', async function () {

    var token = await StandardTokenMock.new(owner, amount);
    this.vesting = await TokenVestingTimelock.new(token.address,beneficiary, this.start, duration.seconds(2), true,0);
    await token.transfer(this.vesting.address,amount);
    await increaseTimeTo(this.start +duration.seconds(1));
    await this.vesting.release().should.be.fulfilled;
  });
});
