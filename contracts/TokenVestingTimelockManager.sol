pragma solidity ^0.4.21;

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
        bool _revocable,
        uint256 _releaseTime,
        uint256 _amount
    )
    onlyOwner
    public
    returns (bool)
    {
        require(vestingContracts[_beneficiary]==address(0));
        TokenVestingTimelock tokenVestingAndTimelock = new TokenVestingTimelock(token,_beneficiary,_start,_duration,_revocable,_releaseTime);
        vestingContracts[_beneficiary] = address(tokenVestingAndTimelock);
        token.transfer(address(tokenVestingAndTimelock),_amount);
        emit AddVestedContract(_beneficiary,address(tokenVestingAndTimelock));
    }

    /**
     * @notice addVestedContracts.
     */
    function addVestedContracts(
        address[] _beneficiaries,
        uint256[] _start,
        uint256[] _duration,
        bool[] _revocable,
        uint256[] _releaseTime,
        uint256[] _amounts
    )
    onlyOwner
    public
    returns (bool)
    {
        require(_beneficiaries.length == _start.length);
        require(_beneficiaries.length == _duration.length);
        require(_beneficiaries.length == _revocable.length);
        require(_beneficiaries.length == _releaseTime.length);
        require(_beneficiaries.length == _amounts.length);
        require(_beneficiaries.length > 0);

        for (uint i = 0 ; i < _beneficiaries.length ; i++ ) {
            addVestedContract(_beneficiaries[i],_start[i],_duration[i],_revocable[i],_releaseTime[i],_amounts[i]);
        }
    }

    function getVestedContract(address _beneficiary) public view returns (address){
        return vestingContracts[_beneficiary];
    }
}
