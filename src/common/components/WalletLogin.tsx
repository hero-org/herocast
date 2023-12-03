import React from "react";

import '@rainbow-me/rainbowkit/styles.css';
import {
    ConnectButton,
} from '@rainbow-me/rainbowkit';

const WalletLogin = () => <ConnectButton showBalance={false} chainStatus="none" />

export default WalletLogin;