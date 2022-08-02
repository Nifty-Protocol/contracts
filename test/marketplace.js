const ERC20Proxy = artifacts.require('ERC20Proxy');
const ERC721Proxy = artifacts.require('ERC721Proxy');
const ERC71155Proxy = artifacts.require('ERC1155Proxy');
const Exchange = artifacts.require('Exchange');
const LibAssetData = artifacts.require('LibAssetData');
const NFT = artifacts.require('NFT');
const WETH = artifacts.require('WETH');
const BigNumber = require('bignumber.js');
const signTyped = require('./signature');

const chainId = 5777;

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

web3.providers.HttpProvider.prototype.sendAsync = web3.providers.HttpProvider.prototype.send;

const now = () => Math.round((Date.now() / 1000));

const olderDate = () => (now() + 3600);

contract('Exchange', (accounts) => {
  let exchange;
  let libAssetData;
  let erc721proxy;
  let nft;
  let etherToken;
  let marketplaceIdentifier;
  const provider = web3.currentProvider;

  const owner = accounts[0];
  const buyer = accounts[1];
  const seller = accounts[2];
  const royaltiesAddress = accounts[3];

  before(async () => {
    exchange = await Exchange.deployed();
    libAssetData = await LibAssetData.deployed();

    etherToken = await WETH.deployed();
    erc721proxy = await ERC721Proxy.deployed();

    nft = await NFT.new('NFT Test', 'NFTT');

    marketplaceIdentifier = web3.utils.sha3('nftrade');

    await exchange.setProtocolFeeMultiplier(new BigNumber(2));
    await exchange.setProtocolFeeCollectorAddress(accounts[5]);
    await exchange.registerMarketplace(marketplaceIdentifier, 26, accounts[7]);
    // await exchange.marketplaceDistribution(false);
  });

  const createNFT = async (from) => {
    // minting a new NFT
    console.log({ async: 'minting a new NFT', from });
    const mintTransaction = await nft.mint(from, 12341, { from });
    return mintTransaction.logs[0].args.tokenId;
  };

  const listNFT = async (from, forToken, price, expire) => {
    const tokenID = await createNFT(from);
    const takerAssetData = await libAssetData.encodeERC20AssetData(forToken);
    const id = await libAssetData.decodeAssetProxyId(takerAssetData);
    console.log(id);
    const makerAssetData = await libAssetData.encodeERC721AssetData(nft.address, tokenID);
    const newOrder = {
      chainId,
      exchangeAddress      : exchange.address,
      makerAddress         : from,
      takerAddress         : NULL_ADDRESS,
      senderAddress        : NULL_ADDRESS,
      royaltiesAddress,
      expirationTimeSeconds: expire,
      salt                 : now(),
      makerAssetAmount     : '1',
      takerAssetAmount     : web3.utils.toWei(String(price)),
      makerAssetData,
      takerAssetData,
      royaltiesAmount      : web3.utils.toWei(String(price * 0.1))
    };

    const signedOrder = await signTyped(
      provider,
      newOrder,
      from,
      exchange.address,
    );

    await nft
      .setApprovalForAll(erc721proxy.address, true, { from }); // need to check if already isApprovedForAll

    const orderInfo = await exchange.getOrderInfo(signedOrder);

    const { orderHash } = orderInfo;

    console.log(orderInfo);

    assert.isNotEmpty(orderHash);

    const isValid = await exchange.isValidHashSignature(
      orderHash,
      from,
      signedOrder.signature
    );

    assert.isTrue(isValid);

    return { signedOrder, orderHash };
  };

  describe('Exchange Flow', () => {
    it('Buying a listed asset with erc 20', async () => {
      const order = await listNFT(seller, etherToken.address, 0.1, olderDate());
      const averageGas = await web3.eth.getGasPrice();

      const value = order.signedOrder.takerAssetAmount;
      await etherToken.deposit({ from: buyer, value });
      await etherToken.approve(ERC20Proxy.address, value, { from: buyer });

      console.log(order);

      const buyOrder = await exchange.fillOrder(
        order.signedOrder,
        order.signedOrder.signature,
        marketplaceIdentifier,
        {
          from    : buyer,
          gasPrice: averageGas,
        }
      );
    });
    it('Buying a listed asset with eth', async () => {
      // const averageGas = await web3.eth.getGasPrice();
      const order = await listNFT(seller, NULL_ADDRESS, 0.1, olderDate());
      const value = order.signedOrder.takerAssetAmount;

      const buyOrder = await exchange.fillOrder(
        order.signedOrder,
        order.signedOrder.signature,
        marketplaceIdentifier,
        {
          from: buyer,
          value,
        }
      );
    });

    it('Buying a listed asset with eth as a gift', async () => {
      const order = await listNFT(seller, NULL_ADDRESS, 0.1, olderDate());

      const value = order.signedOrder.takerAssetAmount;

      console.log(order);

      const buyOrder = await exchange.fillOrderFor(
        order.signedOrder,
        order.signedOrder.signature,
        marketplaceIdentifier,
        accounts[4],
        {
          from: buyer,
          value,
        }
      );
    });

    it('swap', async () => {
      const makerTokens = await Promise.all([
        await createNFT(seller), await createNFT(seller)
      ]);
      const takerTokens = await Promise.all([
        await createNFT(buyer), await createNFT(buyer)
      ]);

      const makerAssets = await Promise.all(
        makerTokens.map((tokenID) => libAssetData.encodeERC721AssetData(nft.address, tokenID))
      );

      const makerAssetData = await libAssetData.encodeMultiAssetData([1, 1], makerAssets);

      const takerAssets = await Promise.all(
        takerTokens.map((tokenID) => libAssetData.encodeERC721AssetData(nft.address, tokenID))
      );

      const erc20Data = await libAssetData.encodeERC20AssetData(etherToken.address);

      takerAssets.push(erc20Data);

      const takerAssetData = await libAssetData.encodeMultiAssetData([1, 1, web3.utils.toWei('1')], takerAssets);

      const newOrder = {
        chainId,
        exchangeAddress      : exchange.address,
        makerAddress         : seller,
        takerAddress         : NULL_ADDRESS,
        senderAddress        : NULL_ADDRESS,
        royaltiesAddress     : NULL_ADDRESS,
        expirationTimeSeconds: olderDate(),
        salt                 : now(),
        makerAssetAmount     : '1',
        takerAssetAmount     : '1',
        makerAssetData,
        takerAssetData,
        royaltiesAmount      : 0
      };

      const signedOrder = await signTyped(
        provider,
        newOrder,
        seller,
        exchange.address,
      );

      await nft.setApprovalForAll(erc721proxy.address, true, { from: seller });

      const orderInfo = await exchange.getOrderInfo(signedOrder);

      const { orderHash } = orderInfo;

      console.log(orderInfo);

      assert.isNotEmpty(orderHash);

      const isValid = await exchange.isValidHashSignature(
        orderHash,
        seller,
        signedOrder.signature
      );

      assert.isTrue(isValid);

      const order = { signedOrder, orderHash };

      // SWAP

      await nft.setApprovalForAll(erc721proxy.address, true, { from: buyer });
      await etherToken.deposit({ from: buyer, value: web3.utils.toWei('1') });
      await etherToken.approve(ERC20Proxy.address, web3.utils.toWei('1'), { from: buyer });
      const fixedFee = web3.utils.toWei('0.1');
      await exchange.setProtocolFixedFee(fixedFee);
      const buyOrder = await exchange.fillOrder(
        order.signedOrder,
        order.signedOrder.signature,
        marketplaceIdentifier,
        {
          from : buyer,
          value: fixedFee,
        }
      );
    });

    it('offer', async () => {
      const tokenID = await createNFT(seller);

      const makerAssetData = await libAssetData.encodeERC20AssetData(etherToken.address);

      const takerAssetData = await libAssetData.encodeERC721AssetData(nft.address, tokenID);

      await etherToken.deposit({ from: buyer, value: web3.utils.toWei('1') });
      await etherToken.approve(ERC20Proxy.address, web3.utils.toWei('1'), { from: buyer });

      const price = 0.1;

      const newOrder = {
        chainId,
        exchangeAddress      : exchange.address,
        makerAddress         : buyer,
        takerAddress         : NULL_ADDRESS,
        senderAddress        : NULL_ADDRESS,
        royaltiesAddress,
        expirationTimeSeconds: olderDate(),
        salt                 : now(),
        makerAssetAmount     : web3.utils.toWei(String(price)),
        takerAssetAmount     : '1',
        makerAssetData,
        takerAssetData,
        royaltiesAmount      : web3.utils.toWei(String(0.05))
      };

      const signedOrder = await signTyped(
        provider,
        newOrder,
        buyer,
        exchange.address,
      );

      await nft.setApprovalForAll(erc721proxy.address, true, { from: seller });

      const orderInfo = await exchange.getOrderInfo(signedOrder);

      const { orderHash } = orderInfo;

      console.log(orderInfo);

      assert.isNotEmpty(orderHash);

      const isValid = await exchange.isValidHashSignature(
        orderHash,
        buyer,
        signedOrder.signature
      );

      assert.isTrue(isValid);

      const order = { signedOrder, orderHash };

      // ACCEPT OFFER

      await nft.setApprovalForAll(erc721proxy.address, true, { from: seller });
      const buyOrder = await exchange.fillOrder(
        order.signedOrder,
        order.signedOrder.signature,
        marketplaceIdentifier,
        {
          from: seller,
        }
      );
    });
  });
});