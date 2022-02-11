import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import { BigNumber, Contract, ethers, providers, utils } from 'ethers';
import React, { useEffect, useState, useRef } from 'react'
import Web3Modal from 'web3modal';
import { NFT_CONTRACT_ABI, NFT_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, TOKEN_CONTRACT_ADDRESS } from '../constants';

export default function Home() {
  // Create a BigNumber `0`
  const zero = BigNumber.from(0);
  // walletConnected keeps track of whether the user's wallet is connected or not
  const [walletConnected, setWalletConnected] = useState(false);
  // loading is set to true when we are waiting for a transaction to get mined
  const [loading, setLoading] = useState(false);
  // tokensToBeClaimed keeps track of the number of tokens that can be claimed
  // based on the Crypto Dev NFT's held by the user for which they havent claimed the tokens
  const [tokensToBeClaimed, setTokensToBeClaimed] = useState(zero);
  // balanceOfCryptoDevTokens keeps track of number of Crypto Dev tokens owned by an address
  const [balanceOfCryptoDevTokens, setBalanceOfCryptoDevTokens] = useState(
    zero
  );
  // amount of the tokens that the user wants to mint
  const [tokenAmount, setTokenAmount] = useState(zero);
  // tokensMinted is the total number of tokens that have been minted till now out of 10000(max total supply)
  const [tokensMinted, setTokensMinted] = useState(zero);
  // Create a reference to the Web3 Modal (used for connecting to Metamask) which persists as long as the page is open
  const web3ModalRef = useRef();

  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        cacheProvider: false
      })
    }
    connectWallet();
    getTokensToBeClaimed();
    getBalanceOfCryptoDevTokens();
    getTotalTokensMinted();
  }, [walletConnected])

  /**
   * this is to check how many free tokens can this address 
   */
  const getTokensToBeClaimed = async () => {
    try {
      let signer = await getProviderOrSigner(true);
      let nftContract = new Contract(
        NFT_CONTRACT_ADDRESS,
        NFT_CONTRACT_ABI,
        signer
      )
      let tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        signer
      )
      let address = await signer.getAddress();
      let nftAmount = await nftContract.balanceOf(address);
      console.log("you have %d CryptoDevs NFT", nftAmount.toNumber())

      if (nftAmount === zero) {
        setTokensToBeClaimed(zero);
      } else {
        let amount = 0;
        for (let i = 0; i < nftAmount.toNumber(); i++) {
          // iterate through the list of NFTs that the user owns
          // and grab its ID
          let tokenId = await nftContract.tokenOfOwnerByIndex(address, i);

          // check whether this NFT ID has been used to claim the free token
          let claimed = await tokenContract.tokenIdsClaimed(tokenId);
          console.log("%s has CryptoDevs #%d", address, tokenId.toNumber());
          console.log("claimed: ", claimed);
          
          if (!claimed) {
            amount += 1;
          }
        }
        console.log("tokens left to be claimed: %d", amount)
        setTokensToBeClaimed(BigNumber.from(amount));
      }
    } catch (e) {
      console.log(e);
      setTokensToBeClaimed(zero);
    }
  }

  /**
   * get balance of crypto dev tokens that this user has
   */
  const getBalanceOfCryptoDevTokens = async () => {
    try {
      let signer = await getProviderOrSigner(true);
      let tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        signer
      );

      let address = await signer.getAddress();
      let balance = await tokenContract.balanceOf(address);
      console.log("You have %s $CD", utils.formatEther(balance));
      setBalanceOfCryptoDevTokens(balance);
    } catch (e) {
      console.log(e);
      setBalanceOfCryptoDevTokens(zero);
    }
  }

  const mintCryptoDevToken = async (amount) => {
    try {
      let signer = await getProviderOrSigner(true);
      let tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        signer
      );

      const cost = 0.001 * amount;
      let tx = await tokenContract.mint(amount, {
        value: utils.parseEther(cost.toString())
      });
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await getBalanceOfCryptoDevTokens();
      await getTotalTokensMinted();
      await getTokensToBeClaimed();
    } catch (e) {
      console.log(e);
    }
  }

  const claimCryptoDevTokens = async () => {
    try {
      let signer = await getProviderOrSigner(true);
      let tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        signer
      );

      let tx = await tokenContract.claim();
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await getBalanceOfCryptoDevTokens();
      await getTotalTokensMinted();
      await getTokensToBeClaimed();
    } catch (e) {
      console.log(e);
    }
  }

  const getTotalTokensMinted = async () => {
    try {
      let provider = await getProviderOrSigner();
      let tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        provider
      );

      let currentMinted = await tokenContract.totalSupply();
      console.log("Tokens minted: %s", utils.formatEther(currentMinted));
      setTokensMinted(currentMinted);
    } catch (e) {
      console.log(e);
    }
  }

  const getProviderOrSigner = async (needSigner = false) => {
    try {
      const provider = await web3ModalRef.current.connect();
      const web3Provider = new ethers.providers.Web3Provider(provider);

      const { chainId } = await web3Provider.getNetwork();
      if (chainId !== 4) {
        window.alert("please connect to rinkeby network");
        throw new Error("please connect to rinkeby network");
      }

      if (needSigner) {
        let signer = web3Provider.getSigner();
        return signer;
      }

      return web3Provider;
    } catch (e) {
      console.log(e);
    }
  }

  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (e) {
      console.log(e);
    }
  }

  /*
        renderButton: Returns a button based on the state of the dapp
      */
  const renderButton = () => {
    // If we are currently waiting for something, return a loading button
    if (loading) {
      return (
        <div>
          <button className={styles.button}>Loading...</button>
        </div>
      );
    }
    // If tokens to be claimed are greater than 0, Return a claim button
    if (tokensToBeClaimed > 0) {
      return (
        <div>
          <div className={styles.description}>
            {tokensToBeClaimed * 10} Tokens can be claimed!
          </div>
          <button className={styles.button} onClick={claimCryptoDevTokens}>
            Claim Tokens
          </button>
        </div>
      );
    }
    // If user doesn't have any tokens to claim, show the mint button
    return (
      <div style={{ display: "flex-col" }}>
        <div>
          <input
            type="number"
            placeholder="Amount of Tokens"
            // BigNumber.from converts the `e.target.value` to a BigNumber
            onChange={(e) => setTokenAmount(BigNumber.from(e.target.value))}
            className={styles.input}
          />
        </div>

        <button
          className={styles.button}
          disabled={!(tokenAmount > 0)}
          onClick={() => mintCryptoDevToken(tokenAmount)}
        >
          Mint Tokens
        </button>
      </div>
    );
  };

  return (
    <div>
      <Head>
        <title>Crypto Devs</title>
        <meta name="description" content="ICO-Dapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs ICO!</h1>
          <div className={styles.description}>
            You can claim or mint Crypto Dev tokens here
          </div>
          {walletConnected ? (
            <div>
              <div className={styles.description}>
                {/* Format Ether helps us in converting a BigNumber to string */}
                You have minted {utils.formatEther(balanceOfCryptoDevTokens)} Crypto
                Dev Tokens
              </div>
              <div className={styles.description}>
                {/* Format Ether helps us in converting a BigNumber to string */}
                Overall {utils.formatEther(tokensMinted)}/10000 have been minted!!!
              </div>
              {renderButton()}
            </div>
          ) : (
            <button onClick={connectWallet} className={styles.button}>
              Connect your wallet
            </button>
          )}
        </div>
        <div>
          <img className={styles.image} src="./0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
}
