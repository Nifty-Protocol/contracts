pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./libs/LibBytes.sol";
import "./Authorizable.sol";
import "./interfaces/IAssetProxy.sol";

contract ERC721Proxy is
    Authorizable,
    IAssetProxy
{
    using LibBytes for bytes;
    // Id of this proxy.
    bytes4 constant internal PROXY_ID = bytes4(keccak256("ERC721Token(address,uint256)"));

    function transferFrom(
        bytes calldata assetData,
        address from,
        address to,
        uint256 amount
    )
        override
        external
        onlyAuthorized
    {
        // Decode params from `assetData`
        // solhint-disable indent
        (
            address erc721TokenAddress,
            uint256 tokenId
        ) = abi.decode( 
            assetData.sliceDestructive(4, assetData.length),
            (address, uint256)
        );
        // solhint-enable indent

        // Execute `transferFrom` call
        // Either succeeds or throws
        IERC721(erc721TokenAddress).transferFrom(
            from,
            to,
            tokenId
        );
    }

    /// @dev Gets the proxy id associated with the proxy address.
    /// @return Proxy id.
    function getProxyId()
        override
        external
        pure
        returns (bytes4)
    {
        return PROXY_ID;
    }
}
