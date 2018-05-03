import { duration } from './helpers/time';
import { scenario } from './helpers/scenario';

contract('Scenarios', (accounts) => {

  it('Happy path - with releaseTime', scenario({
    owner: accounts[0],
    beneficiary: accounts[1],
    otherAddress: accounts[2],
    revokable: false,
    amount: 1000,
    startDelay: duration.hours(10),
    duration: duration.hours(10),
    releaseDelay: duration.hours(10)
  }, {
    duringVesting: async (timelock, token, now, start, duration, releaseTime) => {
      await timelock.release({from: accounts[1]}).should.be.rejected;
    },
    afterVesting: async (timelock, token, now, start, duration, releaseTime) => {
      await timelock.release({from: accounts[1]}).should.be.rejected;
    },
    afterRelease: async (timelock, token, now, start, duration, releaseTime) => {
      const balanceBefore = await token.balanceOf(accounts[1]);

      const success = await timelock.release.call({from: accounts[1]});
      assert.isTrue(success);
      await timelock.release({from: accounts[1]});

      const balanceAfter = await token.balanceOf(accounts[1]);
      balanceAfter.should.be.bignumber.equal(balanceBefore + 1000);
    },
  }));

  it('Happy path - no releaseTime', scenario({
    owner: accounts[0],
    beneficiary: accounts[1],
    otherAddress: accounts[2],
    revokable: false,
    amount: 1000,
    startDelay: duration.hours(10),
    duration: duration.hours(10),
    releaseDelay: null
  }, {
    duringVesting: async (timelock, token, now, start, duration, releaseTime) => {
      const success = await timelock.release.call({from: accounts[1]});
      assert.isTrue(success);
      await timelock.release({from: accounts[1]});
    },
    afterVesting: async (timelock, token, now, start, duration, releaseTime) => {
      const success = await timelock.release.call({from: accounts[1]});
      assert.isTrue(success);
      await timelock.release({from: accounts[1]});

      await timelock.release({from: accounts[1]}).should.be.rejected;
    }
  }));

  it('Revoked after start', scenario({
    owner: accounts[0],
    beneficiary: accounts[1],
    otherAddress: accounts[2],
    revokable: true,
    amount: 1000,
    startDelay: duration.hours(10),
    duration: duration.hours(10),
    releaseDelay: duration.hours(10)
  }, {
    beforeStart: async (timelock, token, now, start, duration, releaseTime) => {
      const balanceBeforeRevoke = await token.balanceOf(accounts[0]);

      const success = await timelock.revoke.call({from: accounts[0]});
      assert.isTrue(success);
      await timelock.revoke({from: accounts[0]});

      const balanceAfterRevoke = await token.balanceOf(accounts[0]);
      balanceAfterRevoke.should.be.bignumber.equal(balanceBeforeRevoke + 1000);
    }
  }));

  it('Revoked during vesting', scenario({
    owner: accounts[0],
    beneficiary: accounts[1],
    otherAddress: accounts[2],
    revokable: true,
    amount: 1000,
    startDelay: duration.hours(10),
    duration: duration.hours(10),
    releaseDelay: duration.hours(10)
  }, {
    duringVesting: async (timelock, token, now, start, duration, releaseTime) => {
      const balanceBeforeRevoke = await token.balanceOf(accounts[0]);

      const success = await timelock.revoke.call({from: accounts[0]});
      assert.isTrue(success);
      await timelock.revoke({from: accounts[0]});

      const refund = Math.round(1000 * (1 - ((now - start) / duration)))

      const balanceAfterRevoke = await token.balanceOf(accounts[0]);
      balanceAfterRevoke.should.be.bignumber.equal(balanceBeforeRevoke.plus(refund));
    }
  }));

  it('Revoked after vesting', scenario({
    owner: accounts[0],
    beneficiary: accounts[1],
    otherAddress: accounts[2],
    revokable: true,
    amount: 1000,
    startDelay: duration.hours(10),
    duration: duration.hours(10),
    releaseDelay: duration.hours(10)
  }, {
    afterVesting: async (timelock, token, now, start, duration, releaseTime) => {
      const balanceBeforeRevoke = await token.balanceOf(accounts[0]);

      const success = await timelock.revoke.call({from: accounts[0]});
      assert.isTrue(success);
      await timelock.revoke({from: accounts[0]});

      const balanceAfterRevoke = await token.balanceOf(accounts[0]);
      balanceAfterRevoke.should.be.bignumber.equal(balanceBeforeRevoke);
    }
  }));
})
