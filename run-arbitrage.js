require("dotenv").config();
const Web3 = require("web3");
const { ChainId, Token, TokenAmount, Pair } = require("@uniswap/sdk");
const abis = require("./abis");
const { mainnet: addresses } = require("./addresses");

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.INFURA_URL)
);

const kyber = new web3.eth.Contract(
  abis.kyber.kyberNetworkProxy,
  addresses.kyber.kyberNetworkProxy
);

const AMOUNT_ETH = 100; // amount to trade
const RECENT_ETH_TO_DAI_PRICE = 1500;
const AMOUNT_ETH_POWER_18 = web3.utils.toWei(AMOUNT_ETH.toString());
const AMOUNT_DAI_POWER_18 = web3.utils.toWei(
  (AMOUNT_ETH * RECENT_ETH_TO_DAI_PRICE).toString()
);

const init = async () => {
  const [dai, weth] = await Promise.all(
    [addresses.tokens.dai, addresses.tokens.weth].map((tokenAddr) => {
      return Token.fetchData(ChainId.MAINNET, tokenAddr);
    })
  );

  console.log(dai, weth);

  const daiWethPair = await Pair.fetchData(dai, weth);

  web3.eth
    .subscribe("newBlockHeaders")
    .on("data", async (blkHeader) => {
      console.log(`Block #${blkHeader.number} created.`);

      const kyberRateRes = await Promise.all([
        kyber.methods
          .getExpectedRate(
            addresses.tokens.dai,
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            AMOUNT_DAI_POWER_18
          )
          .call(), // DAI to ETH rate
        kyber.methods
          .getExpectedRate(
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            addresses.tokens.dai,
            AMOUNT_ETH_POWER_18
          )
          .call(), // ETH to DAI rate
      ]);

      const kyberRate = {
        buy: parseFloat(1 / (kyberRateRes[0].expectedRate / 10 ** 18)),
        sell: parseFloat(kyberRateRes[1].expectedRate / 10 ** 18),
      };

      // console.log(kyberRateRes);
      console.log("Kyber ETH/DAI Price:");
      console.log(kyberRate);

      const uniswapRateRes = await Promise.all([
        daiWethPair.getOutputAmount(new TokenAmount(dai, AMOUNT_DAI_POWER_18)),
        daiWethPair.getOutputAmount(new TokenAmount(weth, AMOUNT_ETH_POWER_18)),
      ]);

      //   console.log(uniswapRateRes);
      const uniswapRate = {
        buy: parseFloat(
          AMOUNT_DAI_POWER_18 / (uniswapRateRes[0][0].toExact() * 10 ** 18)
        ),
        sell: parseFloat(uniswapRateRes[1][0].toExact() / AMOUNT_ETH),
      };

      console.log("Uniswap ETH/DAI Price:");
      console.log(uniswapRate);
    })
    .on("error", (err) => {
      console.log(err);
    });
};

init();
