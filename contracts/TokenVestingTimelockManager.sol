pragma solidity 0.4.21;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "./TokenVestingTimelock.sol";


/**
 * @title TokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a vesting period. Optionally revocable by the
 * owner.
 */
contract TokenVestingTimelockManager is Ownable {
    using SafeERC20 for ERC20Basic;

    event AddVestedContract(address _beneficiary,address _contract);

    ERC20Basic public token;

    mapping(address=>address) public vestingContracts;

    function TokenVestingTimelockManager(ERC20Basic _token)
    public
    {
        token = _token;
    }

  /**
   * @notice addVestedContract.
   */
    function addVestedContract(
        address _beneficiary,
        uint256 _start,
        uint256 _duration,
        bool _revokable,
        uint256 _releaseTime,
        uint256 _amount
    )
    onlyOwner
    public
    returns (bool)
    {
        require(vestingContracts[_beneficiary]==address(0));
        TokenVestingTimelock tokenVestingAndTimelock = new TokenVestingTimelock(token,_beneficiary,_start,_duration,_revokable,_releaseTime);
        vestingContracts[_beneficiary] = address(tokenVestingAndTimelock);
        token.safeTransfer(address(tokenVestingAndTimelock),_amount);
        emit AddVestedContract(_beneficiary,address(tokenVestingAndTimelock));
        return true;
    }

    /**
     * @notice addVestedContracts.
     */
    function addVestedContracts(
        address[] _beneficiaries,
        uint256[] _start,
        uint256[] _duration,
        bool[] _revokable,
        uint256[] _releaseTime,
        uint256[] _amounts
    )
    onlyOwner
    external
    returns (bool)
    {
        require(_beneficiaries.length == _start.length);
        require(_beneficiaries.length == _duration.length);
        require(_beneficiaries.length == _revokable.length);
        require(_beneficiaries.length == _releaseTime.length);
        require(_beneficiaries.length == _amounts.length);
        require(_beneficiaries.length > 0);

        for (uint i = 0 ; i < _beneficiaries.length ; i++ ) {
            addVestedContract(_beneficiaries[i],_start[i],_duration[i],_revokable[i],_releaseTime[i],_amounts[i]);
        }
        return true;
    }

    function getVestedContract(address _beneficiary) public view returns (address){
        return vestingContracts[_beneficiary];
    }

    function revoke(address _beneficiary) onlyOwner public returns (bool){
        return TokenVestingTimelock(vestingContracts[_beneficiary]).revoke();
    }

    /*
    ** @dev Drain tokens to a given address.
    *  @param _to the address to drain the tokens to.
    */
    function drain(address _to) onlyOwner public {
        token.safeTransfer(_to, token.balanceOf(address(this)));
    }
}
