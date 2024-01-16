
export const HatsFarcasterDelegatorContractAddress = '0x0000000' as `0x${string}`;

export const HatsFarcasterDelegatorAbi = 
[
    {
        "type": "constructor",
        "inputs":
        [
            {
                "name": "_version",
                "type": "string",
                "internalType": "string"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "receive",
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "ADD_TYPEHASH",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "CHANGE_RECOVERY_ADDRESS_TYPEHASH",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "ERC1271_MAGICVALUE",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "bytes4",
                "internalType": "bytes4"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "HATS",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IHats"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "IMPLEMENTATION",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "REGISTER_TYPEHASH",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "REMOVE_TYPEHASH",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "SIGNED_KEY_REQUEST_TYPEHASH",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "TRANSFER_TYPEHASH",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "addKey",
        "inputs":
        [
            {
                "name": "_keyType",
                "type": "uint32",
                "internalType": "uint32"
            },
            {
                "name": "_key",
                "type": "bytes",
                "internalType": "bytes"
            },
            {
                "name": "_metadataType",
                "type": "uint8",
                "internalType": "uint8"
            },
            {
                "name": "_metadata",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs":
        [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "changeRecoveryAddress",
        "inputs":
        [
            {
                "name": "_newRecovery",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs":
        [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "hatId",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "idGateway",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IIdGateway"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "idRegistry",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IIdRegistry"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "isValidSignature",
        "inputs":
        [
            {
                "name": "_hash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "_signature",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs":
        [
            {
                "name": "",
                "type": "bytes4",
                "internalType": "bytes4"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "isValidSigner",
        "inputs":
        [
            {
                "name": "_typehash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "_signer",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs":
        [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "keyGateway",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IKeyGateway"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "keyRegistry",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IKeyRegistry"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "ownerHat",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "prepareToReceive",
        "inputs":
        [
            {
                "name": "_fid",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs":
        [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "receivable",
        "inputs":
        [
            {
                "name": "fid",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs":
        [
            {
                "name": "receivable",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "register",
        "inputs":
        [
            {
                "name": "_recovery",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_extraStorage",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs":
        [
            {
                "name": "fid",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "overpayment",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "removeKey",
        "inputs":
        [
            {
                "name": "_key",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs":
        [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "setUp",
        "inputs":
        [
            {
                "name": "_initData",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs":
        [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "signedKeyRequestValidator",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "supportsInterface",
        "inputs":
        [
            {
                "name": "_interfaceId",
                "type": "bytes4",
                "internalType": "bytes4"
            }
        ],
        "outputs":
        [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "pure"
    },
    {
        "type": "function",
        "name": "transferFid",
        "inputs":
        [
            {
                "name": "_to",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_deadline",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "_sig",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs":
        [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "version",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "string",
                "internalType": "string"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "version_",
        "inputs":
        [],
        "outputs":
        [
            {
                "name": "",
                "type": "string",
                "internalType": "string"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "Initialized",
        "inputs":
        [
            {
                "name": "version",
                "type": "uint8",
                "indexed": false,
                "internalType": "uint8"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "ReadyToReceive",
        "inputs":
        [
            {
                "name": "fid",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AlreadyRegistered",
        "inputs":
        []
    },
    {
        "type": "error",
        "name": "CallFailed",
        "inputs":
        []
    },
    {
        "type": "error",
        "name": "Unauthorized",
        "inputs":
        []
    }
] as const;