pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./libs/LibBytes.sol";
import "./Authorizable.sol";
import "./interfaces/IAssetProxy.sol";


contract ERC1155Proxy is
    Authorizable,
    IAssetProxy
{
    using LibBytes for bytes;
    using SafeMath for uint256;

    // Id of this proxy.
    bytes4 constant internal PROXY_ID = bytes4(keccak256("ERC1155Assets(address,uint256[],uint256[],bytes)"));

    /// @dev Transfers batch of ERC1155 assets. Either succeeds or throws.
    /// @param assetData Byte array encoded with ERC1155 token address, array of ids, array of values, and callback data.
    /// @param from Address to transfer assets from.
    /// @param to Address to transfer assets to.
    /// @param amount Amount that will be multiplied with each element of `assetData.values` to scale the
    ///        values that will be transferred.
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
            address erc1155TokenAddress,
            uint256[] memory ids,
            uint256[] memory values,
            bytes memory data
        ) = abi.decode(
            assetData.sliceDestructive(4, assetData.length),
            (address, uint256[], uint256[], bytes)
        );
        // solhint-enable indent

        // Scale values up by `amount`
        uint256 length = values.length;
        uint256[] memory scaledValues = new uint256[](length);
        for (uint256 i = 0; i != length; i++) {
            // We write the scaled values to an unused location in memory in order
            // to avoid copying over `ids` or `data`. This is possible if they are
            // identical to `values` and the offsets for each are pointing to the
            // same location in the ABI encoded calldata.
            scaledValues[i] = values[i].mul(amount);
        }

        // Execute `safeBatchTransferFrom` call
        // Either succeeds or throws
        IERC1155(erc1155TokenAddress).safeBatchTransferFrom(
            from,
            to,
            ids,
            scaledValues,
            data
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