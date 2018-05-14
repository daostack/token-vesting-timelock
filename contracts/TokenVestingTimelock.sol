pragma solidity 0.4.23;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a vesting period. Optionally revocable by the
 * owner.
 */
contract TokenVestingTimelock is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20Basic;

    event Released(uint256 amount);
    event Revoked();
    // beneficiary of tokens after they are released
    address public beneficiary;

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
   * @param _token the toke to be vested and lock
   * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
   * @param  _start start time of the vesting plan
   * @param _duration duration in seconds of the period in which the tokens will vest
   * @param _revokable whether the vesting is revocable or not
   * @param _releaseTime the release time of the token
   */
    constructor(
        ERC20Basic _token,
        address _beneficiary,
        uint256 _start,
        uint256 _duration,
        bool _revokable,
        uint256 _releaseTime
    )
    public
    {
        require(_beneficiary != address(0));
        if (_releaseTime > 0) {
            // solium-disable-next-line security/no-block-members
            require(_releaseTime > block.timestamp);
        }

        beneficiary = _beneficiary;
        revocable = _revokable;
        duration = _duration;
        start = _start;
        token = _token;
        releaseTime = _releaseTime;
    }

  /**
   * @notice Transfers vested tokens to beneficiary.
   */
    function release() public returns(bool) {
        uint256 unreleased = releasableAmount();

        require(unreleased > 0);

        if (releaseTime > 0) {
        // solium-disable-next-line security/no-block-members
            require(block.timestamp >= releaseTime);
        }

        released = released.add(unreleased);

        require(unreleased > 0);

        token.safeTransfer(beneficiary, unreleased);

        emit Released(unreleased);

        return true;
    }

  /**
   * @notice Allows the owner to revoke the vesting. Tokens already vested
   * remain in the contract, the rest are returned to the owner.
   */
    function revoke() public onlyOwner returns(bool) {
        require(revocable);
        require(!revoked);

        uint256 balance = token.balanceOf(this);

        uint256 unreleased = releasableAmount();
        uint256 refund = balance.sub(unreleased);

        revoked = true;

        token.safeTransfer(owner, refund);

        emit Revoked();

        return true;
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
        // solium-disable-next-line security/no-block-members
        if (block.timestamp < start) {
            return 0;
          // solium-disable-next-line security/no-block-members
        } else if (block.timestamp >= start.add(duration) || revoked) {
            return totalBalance;
        } else {
            // solium-disable-next-line security/no-block-members
            return totalBalance.mul(block.timestamp.sub(start)).div(duration);
        }
    }
}
