import React, { Component } from "react";
import EngSwapContract from "./contracts/EngSwap.json";
import tokenContract from "./contracts/ERC20.json";
import getWeb3 from "./getWeb3";
import "./App.css";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import { IconButton } from '@material-ui/core';
import Typography from "@material-ui/core/Typography";
import Tooltip from '@material-ui/core/Tooltip';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import styled, { ThemeProvider } from "styled-components";
import Container from "@material-ui/core/Container";
import CssBaseline from "@material-ui/core/CssBaseline";
import Grid from "@material-ui/core/Grid";
import theme from "./theme";
import TermsDialog from "./components/TermsDialog"
import Box from "./components/Box";
import Snackbar from "./components/Snackbar";
import CircularProgress from '@material-ui/core/CircularProgress';

import { isAddress } from "./util";

const cosmos = require("cosmos-lib");
const Web3 = require("web3");
const BigNumber = require('bignumber.js');
const prefix = process.env.REACT_APP_BECH32_PREFIX || 'secret';
const tokenDecimals = 8;
BigNumber.config({ DECIMAL_PLACES: tokenDecimals })
const ETHERSCAN_MAINNET = 'http://etherscan.io/tx/';
const ETHERSCAN_RINKEBY = 'http://rinkeby.etherscan.io/tx/';

const StyledButton = styled(Button)`
  color: ${props => props.theme.palette.primary.main};
`;

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      formValid: false,
      snackbarOpen: false,
      accepted: false,
      tokenBalance: null,
      swapAmount: null,
      recipientAddress: null,
      web3: null,
      web3Error: null,
      networkId: null,
      accounts: null,
      contract: null,
      contractAddress: null,
      tokenContract: null,
      errors: {
        swapAmount: "",
        recipientAddress: "",
        termsAccepted: ""
      },
      receipt: null,
      infoMessage: null,
      transactionHash: null,
      etherscanUrl: ETHERSCAN_RINKEBY
    };
  }

  handleChange = event => {
    const { name, value, checked } = event.target;
    const { errors, tokenBalance } = this.state;
    let newValue = value;
    
    switch (name) {
      case "termsAccepted":
        if (!checked) {
          errors.termsAccepted = "You must agree to the terms and conditions";
        } else {
          errors.termsAccepted = "";
        }

        this.setState({ accepted: checked });
        break;

      case "swapAmount":

        if(newValue.length === 0 || isNaN(newValue)) {
            errors.swapAmount = "Invalid swap amount"
        } else {
          //trim extra decimal places
          if (value.includes(".") && value.substring(".").length > tokenDecimals) {
            const index = value.indexOf(".")
            newValue = value.substring(0, index) + value.substring(index, index + tokenDecimals + 1)
          }

          if (parseFloat(newValue) < 1) {
            errors.swapAmount = "Minimum 1 ENG"
          } else if (Web3.utils.toBN(this.toGrains(newValue)).gt(Web3.utils.toBN(tokenBalance))) {
              errors.swapAmount = "Insufficient balance"
          } else {
            errors.swapAmount = "";
          }
        }
        break;

      case "recipientAddress":
        errors.recipientAddress = "";
        if (!value || !isAddress(value, prefix)) {
          errors.recipientAddress = `Invalid address, expected address starting with "${prefix}" and have 45 character`;
        } else {
          try {
            cosmos.address.getBytes32(value, prefix);
            this.setState({
              recipientAddress: value
            });
          } catch (error) {
            errors.recipientAddress = error.message;
          }
        }
        break;

      default:
        break;
    }

    this.setState({ errors, [name]: newValue });
    this.setState({formValid: this.canSubmit()})
  };

  handleSubmit = event => {
    event.preventDefault();

    if (this.validateForm(this.state.errors)) {
      this.initiateSwap();
    } else {
      this.setErrorMessage(this.state.errors);
    }
  };

  validateForm = errors => {
    let valid = true;
    Object.values(errors).forEach(val => val.length > 0 && (valid = false));
    return valid;
  };

  networkHandler = async (networkId) => {
    const {web3} = this.state;
    if (!web3) {
      return;
    }

    const deployedNetwork = EngSwapContract.networks[networkId];

    // Confirm we have a contract configured
    if (!deployedNetwork) {
      this.setErrorMessage("Network is unsupported");
      return;
    } else {
      this.setErrorMessage("");
    }

    let contractAddress = deployedNetwork.address;
    const instance = new web3.eth.Contract(
      EngSwapContract.abi,
      deployedNetwork && contractAddress
    );

    let tokenAddress = null;

    await instance.methods
      .token()
      .call()
      .then(result => {
        console.log(`Swapping with ENG contract at address: ${result}`);
        tokenAddress = result;
      });
      const tokenInstance = new web3.eth.Contract(
        tokenContract.abi,
        deployedNetwork && tokenAddress
      );
      
      this.setState({
        contract: instance,
        contractAddress: contractAddress,
        tokenContract: tokenInstance,
        networkId: networkId,
        etherscanUrl: networkId === 1 ? ETHERSCAN_MAINNET : ETHERSCAN_RINKEBY
      },
      this.tokenBalance
    );
  }

  etherscanUrl = () => {
    const {etherscanUrl, transactionHash} = this.state;
    return etherscanUrl + transactionHash;
  }

  accountsHandler = accounts => {
    if (accounts && accounts.length > 0) {
      this.setState({
        accounts: accounts,
        errors: {
          swapAmount: "",
          recipientAddress: "",
          termsAccepted: ""
        }
      })
      this.tokenBalance();
    }
  }

  componentDidMount = async () => {
    this.initWeb3();
  };

  initWeb3 = async () => {

    try {
      this.setState({loading: true});
      
      // Get network provider and web3 instance.
      const web3 = await getWeb3(this.accountsHandler, this.networkHandler);

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      // Get the contract instance.
      const networkId = await web3.eth.net.getId();
      this.setState({
        web3: web3,
        accounts: accounts,
      });

      this.networkHandler(networkId);
    } catch (error) {
      // Catch any errors for any of the above operations.
      this.setErrorMessage(
        `Failed to load web3, accounts, or contract. Check console for details.`
      );
      this.setState({web3Error: error});
      console.error(error);
    } finally {
      this.setState({loading: false});
    }
  }
  
  enableWeb3 = async () => {
    this.initWeb3();
    window.location.reload();
  }

  tokenBalance = async () => {
    this.setState({loading: true});
    const { accounts, tokenContract } = this.state;

    if (accounts && accounts.length > 0 && tokenContract) {
      await tokenContract.methods
        .balanceOf(accounts[0])
        .call()
        .then(result => {
          this.setState({
            tokenBalance: result,
            maxSwap: this.fromGrains(result)
          });
        });
    }
    this.setState({loading: false});
  };

  setInfoMessage = message => {
    if (message) {
      this.setState({ snackbarOpen: true, infoMessage: message, severity: "info"});
    }
  };

  setSuccessMessage = message => {
    this.setState({ snackbarOpen: true, infoMessage: message, severity: "success"});
  }

  setErrorMessage = message => {
    if (message) {
      this.setState({ snackbarOpen: true, infoMessage: message, severity: "error"});
    } else {
      this.setState({ snackbarOpen: false});
    }
  };

  snackbarClosed = () => {
    this.setState({ snackbarOpen: false});
  }

  toGrains = amount => {
    return new BigNumber(amount).multipliedBy(10 ** tokenDecimals).toString()
  }

  fromGrains = amount => {
    return new BigNumber(amount).dividedBy(10 ** tokenDecimals).toString()
  }

  resetForm = () => {
    this.setState({
      formValid: false,
      accepted: false,
      swapAmount: null,
      recipientAddress: null,
    });
  }

  initiateSwap = async () => {
    const {
      accounts,
      swapAmount,
      contract,
      tokenContract,
      contractAddress
    } = this.state;

    const self = this;

    if(!isAddress(self.state.recipientAddress, prefix)) {
      self.setErrorMessage(`Please enter valid ${prefix} recipient`);
      return;
    }

    const allowance = await tokenContract.methods
      .allowance(accounts[0], contractAddress)
      .call();

    this.setState({loading: true});

    const swapAmountGrains = this.toGrains(swapAmount)
    self.setInfoMessage("Open Metamask and sign the 'Approve' transaction");

    // Check if current allowance is sufficient, else approve
    if (Web3.utils.toBN(allowance).lt(Web3.utils.toBN(swapAmountGrains))) {
      await tokenContract.methods
        .approve(contractAddress, swapAmountGrains)
        .send({
          from: accounts[0],
          gas: 50000
        })
        .once("transactionHash", function(transactionHash) {
          self.setInfoMessage("Broadcasting 'Approve ENG transfer'");
        })
        .once("confirmation", function(confirmationNumber, receipt) {
          if (receipt.status === true) {
            self.setInfoMessage("Approved. Sign the 'Burn' transaction");
          } else {
            self.setErrorMessage("Failed to approve ENG burn");
          }
        })
        .on("error", function(error) {
          self.handleError(error);
        });
    }

    await contract.methods
      .burnFunds(
        Web3.utils.fromAscii(self.state.recipientAddress),
        swapAmountGrains
      )
      .send({
        from: accounts[0],
        gas: 150000
      })
      .once("transactionHash", function(transactionHash) {
        self.setInfoMessage("Broadcasting 'Burn' transaction");
      })
      .on("error", function(error) {
        self.handleError(error);
      }).then(function(receipt) {
        self.setState({ transactionHash: receipt.transactionHash });
        if (receipt.status === true) {
          self.setSuccessMessage("ENG Burn confirmed");
          self.tokenBalance();
        } else {
          self.setErrorMessage("ENG Burn failed");
        }
        self.setState({loading: false});
      });
  };

  handleError = (txError) => {
    console.error(`Contract error: ${txError.message}`);
    if (txError.message && txError.message.includes("User denied transaction signature")) {
      this.setErrorMessage("Failed to sign the transaction");
    } else if ("insufficient funds"){
      this.setErrorMessage("Out of gas⛽️ or contact data disabled on your ledger eth app.");
    } else {
      this.setErrorMessage("Swap failed. Check console logs.");
    }
    this.setState({loading: false});
  }

  canSubmit = () => {
    const result = !this.state.loading &&
      this.state.accepted &&
      this.state.swapAmount > 0 &&
      this.state.recipientAddress &&
      this.validateForm(this.state.errors)
    return result;
  };

  maxSwapAmount = () => {
    if (this.hasEng()) {
      this.setState({swapAmount: this.fromGrains(this.state.tokenBalance)});
    }
  }

  hasEng = () => {
    const { tokenBalance } = this.state;
    return tokenBalance && parseFloat(tokenBalance) > 0
  }

  render() {
    const { errors, loading } = this.state;

    if (!this.state.web3) {
      if (this.state.web3Error) {
        return <div className="App">
          <Typography className="h3" component="h3" variant="h3" style={{ marginTop: 50, marginBottom: 10 }}>
            You're not connected to Metamask.</Typography>
          
            <Typography className="h4" component="h4" variant="h4" style={{ marginTop: 50, marginBottom: 10 }}>
            Please make sure to have <a href="https://metamask.io/" target="new">MetaMask</a> installed and ready to use.</Typography>
          {loading && (
            <CircularProgress
              size={15}
            />
          )}
          <Button
            onClick={this.enableWeb3}
            disabled={loading}
          >
          <div style={{marginTop: "50px"}}><img src="metamask-fox.svg" width="100" height="100" alt="Retry Metamask"/></div>
            
            Click to Connect Metamask
          </Button>
          
          <Snackbar 
            snackbarOpen={this.state.snackbarOpen} 
            snackbarClosed={this.snackbarClosed}
            severity={this.state.severity} 
            message={this.state.infoMessage}
            />
          </div>;
      } else {
        return <div className="App">
          <Typography className="h1" component="h1" variant="h4" style={{ marginTop: 50, marginBottom: 10 }}>
            Connecting to Metamask...
            <CircularProgress
                size={20}
              />
          </Typography>
          
          <Snackbar 
            snackbarOpen={this.state.snackbarOpen} 
            snackbarClosed={this.snackbarClosed}
            severity={this.state.severity} 
            message={this.state.infoMessage}
            />
          </div>;
      }
    }

    return (
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        <ThemeProvider theme={theme}>
          <div className="App">
          <Typography className="h1" component="h1" variant="h4" style={{ marginTop: 50 }}>
              SecretSwap.io
            </Typography>
            <Typography className="h1" component="h1" variant="h4" style={{ marginTop: 50 }}>
              Burn ENG for SCRT!
            </Typography>
            <Typography className="span" component="span" variant="body1" style={{ marginBottom: 10, fontSize: 10 }}>
              Disclaimer: Site is currently in Alpha. Updates will be made over time. Please be kind! If you have any issues with the swap, please visit the following link https://secretnodes.org/#/swap-issues 
            </Typography>
            <Box
              fontFamily="h6.fontFamily"
              fontSize={{ xs: 'h6.fontSize', sm: 'h4.fontSize', md: 'h3.fontSize' }}
              p={{ xs: 2, sm: 3, md: 4 }}
            >

              <form noValidate>
              <Grid container spacing={2}>
                <Typography className="h3" component='h3' variant="h6" align="center" style={{ marginBottom: 10, fontSize: 18, width:"100%"}}>
                  Create a SCRT Adddress With:
                </Typography>
                <StyledButton color="primary"
                  style={{ fontSize: 12, width:"33%"}}
                  onClick={(e) => {
                    e.preventDefault();
                    let win = window.open('https://secretnodes.org/#/tutorials/ledger-swap', '_blank');
                    win.focus();
                  }}
                >
                  Ledger
                </StyledButton>
                <StyledButton color="primary"
                  style={{ fontSize: 12, width:"33%"}}
                  onClick={(e) => {
                    e.preventDefault();
                    let win = window.open('https://wallet.keplr.app', '_blank');
                    win.focus();
                  }}
                >
                  Keplr (recommended)
                </StyledButton>
                <StyledButton color="primary"
                  style={{ fontSize: 12, width:"33%"}}
                  onClick={(e) => {
                    e.preventDefault();
                    let win = window.open('https://blog.scrt.network/secret-network-mathwallet-tutorial/', '_blank');
                    win.focus();
                  }}
                >
                  Mathwallet
                </StyledButton>
                <Grid item xs={12}>
                <Typography className="h3" component='h3' variant="h6" align="center" style={{ marginBottom: 10, fontSize: 18, width:"100%"}}>
                  Start the Swap:
                </Typography>
                  <FormControlLabel
                    control={
                      <TextField
                        required
                        name="swapAmount"
                        id="swapAmount"
                        disabled={!this.hasEng()}
                        label="ENG amount"
                        value={this.state.swapAmount || ""}
                        autoFocus
                        onChange={this.handleChange}
                      />
                    }
                    label={"Total: " + this.state.maxSwap}
                    labelPlacement="bottom"
                  />
                  
                  <Tooltip title="Use full ENG balance" aria-label="Use full ENG balance">
                    <IconButton
                        onClick={this.maxSwapAmount}
                        >
                        <ArrowUpwardIcon/>
                      </IconButton>
                  </Tooltip>
                </Grid>

                {errors.swapAmount.length > 0 && (
                  <Grid item xs={12}>
                    <Typography style={{ color: "red", marginTop: 0 }}>
                        {errors.swapAmount}
                    </Typography>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <TextField
                        required
                        name="recipientAddress"
                        value={this.state.recipientAddress || ""}
                        label="SCRT address"
                        onChange={this.handleChange}
                        disabled={!this.hasEng()}
                      />
                    }
                    label="Recipient Secret Address"
                    labelPlacement="bottom"
                  />
                  <Tooltip title="Secret recipient - Make sure to enter a valid Secret address as recipient, not ETH or ENG address." aria-label="Secret recipient">
                    <IconButton>
                        <HelpOutlineIcon fontSize="small"/>
                    </IconButton>
                  </Tooltip>
                </Grid>

                {errors.recipientAddress.length > 0 && (
                  <Grid item xs={12}>
                    <Typography style={{ color: "red", marginTop: 0 }}>
                      {errors.recipientAddress}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <TermsDialog 
                    handleChange={this.handleChange} 
                    accepted={this.state.accepted}>
                  </TermsDialog>
                </Grid>
                <Grid item xs={12}>
                <div>
                  {loading && (
                    <CircularProgress
                      size={15}
                    />
                  )}
                  <StyledButton color="primary"
                    onClick={this.handleSubmit}
                    disabled={!this.canSubmit()}
                  >
                    Start Swap
                  </StyledButton>
                  <StyledButton color="primary"
                  style={{ marginTop: 20, fontSize: 12, width: "100%"}}
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href='https://secretnodes.org/#/ss';
                  }}
                >
                  FAQ
                </StyledButton>
                <Typography className="h3" component='h3' variant="h6" align="center" style={{ marginBottom: 10, fontSize: 18, width:"100%"}}>
                  Explore the Secret Network:
                </Typography>
                <StyledButton color="primary"
                  style={{ fontSize: 12, width:"33%"}}
                  onClick={(e) => {
                    e.preventDefault();
                    let win = window.open('https://puzzle.report/secret/chains/secret-1', '_blank');
                    win.focus();
                  }}
                >
                  Puzzle
                </StyledButton>
                <StyledButton color="primary"
                  style={{ fontSize: 12, width:"33%"}}
                  onClick={(e) => {
                    e.preventDefault();
                    let win = window.open('https://explorer.cashmaney.com/', '_blank');
                    win.focus();
                  }}
                >
                  Cashmaney
                </StyledButton>
                  </div>
                </Grid>
              </Grid>
            </form>
            </Box>
            <Snackbar 
              snackbarOpen={this.state.snackbarOpen} 
              snackbarClosed={this.snackbarClosed}
              severity={this.state.severity} 
              message={this.state.infoMessage}
              />
          </div>
        </ThemeProvider>
      </Container>
    );
  }
}

export default App;
