import { latestTime, duration as time, increaseTime, increaseTimeTo } from './time';
import { assertVMException } from '../helpers'

const StandardTokenMock = artifacts.require('StandardTokenMock');
const TokenVestingTimelock = artifacts.require('TokenVestingTimelock');

const BN = web3.BigNumber;
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BN))
  .should();

/**
 * A helper function that sets up a general scenraio for TokenVestingTimelock using the given options,
 * asserts various things that should hold in every scenraio and exposes callbacks to assert more things in specific scenraios.
 * @param {Object} opts options that determine the scenario
 * @param {string} opts.owner the owner of the timelock and token contracts
 * @param {string} opts.beneficiary the beneficiary of the vesting,
 * @param {string} opts.otherAddress an arbitrary address that's different from owner and beneficiary,
 * @param {string} opts.revokable is the timelock revokable,
 * @param {string} opts.amount amount of tokens to transfer to timelock,
 * @param {string} opts.startDelay start of the vesting period from now,
 * @param {string} opts.duration duration of the vesting period,
 * @param {string} opts.releaseDelay delay until releaseTime after end of vesting period, pass null for no releaseTime
 *
 * @param {Object} lifecycle - an object containing callbacks to invoke during the lifecycle of the time lock
 * All lifecycle callbacks receive the following parameters: timelock, token, now, start, duration, releaseTime
 * @param {Function} lifecycle.beforeStart - invoked before the start of the vesting period
 * @param {Function} lifecycle.duringVesting - invoked in the middle of the vesting period
 * @param {Function} lifecycle.afterVesting - invoked after the vesting period has ended
 * @param {Function} lifecycle.afterRelease - invoked after releaseTime
 */
export function scenario(opts, lifecycle) {
  const {
    owner,
    beneficiary,
    otherAddress,
    revokable,
    amount,
    startDelay,
    duration,
    releaseDelay
  } = opts;

  // patch defaults
  lifecycle = Object.assign({
    beforeStart: async () => {},
    duringVesting: async () => {},
    afterVesting: async () => {},
    afterRelease: async () => {},
  }, lifecycle);

  return async () => {
    const now = latestTime();
    const start = now + startDelay;
    const end = start + duration;
    const releaseTime = (releaseDelay || releaseDelay === 0) ? now + startDelay + duration + releaseDelay : 0;

    const token = await StandardTokenMock.new(owner, amount);
    const timelock = await TokenVestingTimelock.new(
      token.address,
      beneficiary,
      start,
      duration,
      revokable,
      releaseTime
    );
    if(amount)
      await token.transfer(timelock.address, amount);

    // Checks invariants which must hold all the time for all scenraios
    async function invariants(timelock, token, now, start, duration, releaseTime) {
      if (!revokable) {
        await timelock.revoke().should.be.rejected;
      }

      await timelock.revoke({from: beneficiary}).should.be.rejected;
      await timelock.revoke({from: otherAddress}).should.be.rejected;

      /**
       * make sure vesting is linear (within a rounding error) if not revoked
       */
      if(!(await timelock.revoked())) {
        const formula = new BN(amount).mul(BN.min(1, BN.max(0,new BN(now).minus(start)).div(duration))).round();
        const vestedAmount = await timelock.vestedAmount();
        formula.should.be.bignumber.equal(vestedAmount);

        const releasable = formula.minus(await token.balanceOf(beneficiary));
        const releasableAmount = await timelock.releasableAmount();
        releasable.should.be.bignumber.equal(releasableAmount);
      }
    }

    async function beforeStart() {
      const now = latestTime();
      assert(now < start);

      await invariants(timelock, token, now, start, duration, releaseTime);

      /**
       * Parameters are initialized properly.
       */
      assert.equal(token.address, (await timelock.token()));
      assert.equal(beneficiary, (await timelock.beneficiary()));
      start.should.be.bignumber.equal(await timelock.start());
      duration.should.be.bignumber.equal(await timelock.duration());
      assert.equal(revokable, (await timelock.revocable()));
      releaseTime.should.be.bignumber.equal(await timelock.releaseTime());

      Number(0).should.be.bignumber.equal(await timelock.released());
      assert.equal(false, (await timelock.revoked()));

      /**
       * Cannot release before start
       */
      await timelock.release().should.be.rejected;

      await lifecycle.beforeStart(timelock, token, now, start, duration, releaseTime);
    }

    async function duringVesting() {
      const now = latestTime()
      assert(now > start, 'current time is not during vesting!');
      assert(now < end, 'current time is not during vesting!');

      await invariants(timelock, token, now, start, duration, releaseTime);
      await lifecycle.duringVesting(timelock, token, now, start, duration, releaseTime);
    }

    async function afterVesting() {
      const now = latestTime();
      assert(now > end, 'current time is not after vesting!');

      await invariants(timelock, token, now, start, duration, releaseTime);
      await lifecycle.afterVesting(timelock, token, now, start, duration, releaseTime);
    }

    let afterReleaseCalled = false;
    async function afterReleaseIfNeeded() {
      const now = latestTime();
      if(now <= releaseTime || afterReleaseCalled) return;

      await invariants(timelock, token, now, start, duration, releaseTime);
      await lifecycle.afterRelease(timelock, token, now, start, duration, releaseTime);

      afterReleaseCalled = true;
    }

    await beforeStart();
    await afterReleaseIfNeeded();
    await increaseTimeTo(start + Math.max(1, duration / 3));
    await afterReleaseIfNeeded();
    await duringVesting();
    await increaseTimeTo(end + Math.max(1, releaseDelay / 3));
    await afterReleaseIfNeeded();
    await afterVesting();
    if(releaseTime > end){
      await increaseTimeTo(releaseTime + time.seconds(10));
    }
    await afterReleaseIfNeeded();
  }
}
