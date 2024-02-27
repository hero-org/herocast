export const HatsModuleFactoryAbi = [
    {
        "type": "constructor",
        "inputs":
        [
            {
                "name": "_hats",
                "type": "address",
                "internalType": "contract IHats"
            },
            {
                "name": "_version",
                "type": "string",
                "internalType": "string"
            }
        ],
        "stateMutability": "nonpayable"
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
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "batchCreateHatsModule",
        "inputs":
        [
            {
                "name": "_implementations",
                "type": "address[]",
                "internalType": "address[]"
            },
            {
                "name": "_hatIds",
                "type": "uint256[]",
                "internalType": "uint256[]"
            },
            {
                "name": "_otherImmutableArgsArray",
                "type": "bytes[]",
                "internalType": "bytes[]"
            },
            {
                "name": "_initDataArray",
                "type": "bytes[]",
                "internalType": "bytes[]"
            }
        ],
        "outputs":
        [
            {
                "name": "success",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "createHatsModule",
        "inputs":
        [
            {
                "name": "_implementation",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_hatId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "_otherImmutableArgs",
                "type": "bytes",
                "internalType": "bytes"
            },
            {
                "name": "_initData",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs":
        [
            {
                "name": "_instance",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deployed",
        "inputs":
        [
            {
                "name": "_implementation",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_hatId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "_otherImmutableArgs",
                "type": "bytes",
                "internalType": "bytes"
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
        "name": "getHatsModuleAddress",
        "inputs":
        [
            {
                "name": "_implementation",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_hatId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "_otherImmutableArgs",
                "type": "bytes",
                "internalType": "bytes"
            }
        ],
        "outputs":
        [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
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
        "type": "event",
        "name": "HatsModuleFactory_ModuleDeployed",
        "inputs":
        [
            {
                "name": "implementation",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "instance",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "hatId",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "otherImmutableArgs",
                "type": "bytes",
                "indexed": false,
                "internalType": "bytes"
            },
            {
                "name": "initData",
                "type": "bytes",
                "indexed": false,
                "internalType": "bytes"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "BatchArrayLengthMismatch",
        "inputs":
        []
    },
    {
        "type": "error",
        "name": "HatsModuleFactory_ModuleAlreadyDeployed",
        "inputs":
        [
            {
                "name": "implementation",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "hatId",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "otherImmutableArgs",
                "type": "bytes",
                "internalType": "bytes"
            }
        ]
    }
] as const;