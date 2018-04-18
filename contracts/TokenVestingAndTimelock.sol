pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";


/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 */
contract TokenVestingAndTimelock is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for ERC20Basic;

  event Released(uint256 amount);
  event Revoked();

  // beneficiary of tokens after they are released
  address public beneficiary;

  uint256 public cliff;
  uint256 public start;
  uint256 public duration;

  bool public revocable;
  // ERC20 basic token contract being held
  ERC20Basic public token;

  // timestamp when token release is enabled
  uint256 public releaseTime;

  uint256 public released;
  bool public revoked;

  /**
   * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
   * _beneficiary, gradually in a linear fashion until _start + _duration. By then all
   * of the balance will have vested.
   * It will allow a beneficiary to extract the tokens after a given release time
   * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
   * @param _cliff duration in seconds of the cliff in which tokens will begin to vest
   * @param _duration duration in seconds of the period in which the tokens will vest
   * @param _revocable whether the vesting is revocable or not
   */
  function TokenVestingAndTimelock(
       ERC20Basic _token,
       address _beneficiary,
       uint256 _start,
       uint256 _cliff,
       uint256 _duration,
       bool _revocable,
       uint256 _releaseTime
    )
    public
    {
    require(_beneficiary != address(0));
    require(_cliff <= _duration);
    require(_releaseTime > now);

    beneficiary = _beneficiary;
    revocable = _revocable;
    duration = _duration;
    cliff = _start.add(_cliff);
    start = _start;
    token = _token;
    releaseTime = _releaseTime;
  }

  /**
   * @notice Transfers vested tokens to beneficiary.
   */
  function release() public {
    uint256 unreleased = releasableAmount();

    require(unreleased > 0);
    require(now >= releaseTime);

    released = released.add(unreleased);

    token.safeTransfer(beneficiary, unreleased);

    emit Released(unreleased);
  }

  /**
   * @notice Allows the owner to revoke the vesting. Tokens already vested
   * remain in the contract, the rest are returned to the owner.
   */
  function revoke() public onlyOwner {
    require(revocable);
    require(!revoked);

    uint256 balance = token.balanceOf(this);

    uint256 unreleased = releasableAmount();
    uint256 refund = balance.sub(unreleased);

    revoked = true;

    token.safeTransfer(owner, refund);

    emit Revoked();
  }

  /**
   * @dev Calculates the amount that has already vested but hasn't been released yet.
   */
  function releasableAmount() public view returns (uint256) {
    return vestedAmount().sub(released);
  }

  /**
   * @dev Calculates the amount that has already vested.
   */
  function vestedAmount() public view returns (uint256) {
    uint256 currentBalance = token.balanceOf(this);
    uint256 totalBalance = currentBalance.add(released);

    if (now < cliff) {
      return 0;
    } else if (now >= start.add(duration) || revoked) {
      return totalBalance;
    } else {
      return totalBalance.mul(now.sub(start)).div(duration);
    }
  }
}
