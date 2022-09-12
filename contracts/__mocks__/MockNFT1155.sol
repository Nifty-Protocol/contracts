pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MockNFT1155 is ERC1155 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() public ERC1155("") {

    }

    function mint(address receiver) public returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _mint(
            receiver,
            newItemId,
            1,
            ""
        );
        return newItemId;
    }
}
