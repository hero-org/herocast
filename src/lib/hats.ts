import { HatsFarcasterDelegatorAbi } from "@/common/constants/contracts/HatsFarcasterDelegator";
import { config } from "@/common/helpers/rainbowkit";
import { Registry } from "@hatsprotocol/modules-sdk";
import { readContract } from "@wagmi/core";

export const getCustomRegistry = (): Registry => {
    return {
        factory: {
            name: "Hats Module Factory",
            details: "Deploys instances of hats modules.",
            links: [
                {
                    label: "GitHub",
                    link: "",
                }
            ],
            implementationAddress: "0xfE661c01891172046feE16D3a57c3Cf456729efA",
            deployments: [
                { "chainId": "5", "block": "9713194" },
                { "chainId": "10", "block": "109695493" },
                { "chainId": "100", "block": "30023568" },
                { "chainId": "1", "block": "18265591" },
                { "chainId": "137", "block": "48249962" },
                { "chainId": "42161", "block": "136870116" },
                { "chainId": "424", "block": "5490406" },
                { "chainId": "11155111", "block": "4655267" },
                { "chainId": "42220", "block": "22586287" },
                { "chainId": "8453", "block": "7526983" }
            ],
            abi: [
                {
                    "inputs": [
                        {
                            "internalType": "contract IHats",
                            "name": "_hats",
                            "type": "address"
                        },
                        { "internalType": "string", "name": "_version", "type": "string" }
                    ],
                    "stateMutability": "nonpayable",
                    "type": "constructor"
                },
                { "inputs": [], "name": "BatchArrayLengthMismatch", "type": "error" },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "implementation",
                            "type": "address"
                        },
                        { "internalType": "uint256", "name": "hatId", "type": "uint256" },
                        {
                            "internalType": "bytes",
                            "name": "otherImmutableArgs",
                            "type": "bytes"
                        }
                    ],
                    "name": "HatsModuleFactory_ModuleAlreadyDeployed",
                    "type": "error"
                },
                {
                    "anonymous": false,
                    "inputs": [
                        {
                            "indexed": false,
                            "internalType": "address",
                            "name": "implementation",
                            "type": "address"
                        },
                        {
                            "indexed": false,
                            "internalType": "address",
                            "name": "instance",
                            "type": "address"
                        },
                        {
                            "indexed": false,
                            "internalType": "uint256",
                            "name": "hatId",
                            "type": "uint256"
                        },
                        {
                            "indexed": false,
                            "internalType": "bytes",
                            "name": "otherImmutableArgs",
                            "type": "bytes"
                        },
                        {
                            "indexed": false,
                            "internalType": "bytes",
                            "name": "initData",
                            "type": "bytes"
                        }
                    ],
                    "name": "HatsModuleFactory_ModuleDeployed",
                    "type": "event"
                },
                {
                    "inputs": [],
                    "name": "HATS",
                    "outputs": [
                        { "internalType": "contract IHats", "name": "", "type": "address" }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address[]",
                            "name": "_implementations",
                            "type": "address[]"
                        },
                        {
                            "internalType": "uint256[]",
                            "name": "_hatIds",
                            "type": "uint256[]"
                        },
                        {
                            "internalType": "bytes[]",
                            "name": "_otherImmutableArgsArray",
                            "type": "bytes[]"
                        },
                        {
                            "internalType": "bytes[]",
                            "name": "_initDataArray",
                            "type": "bytes[]"
                        }
                    ],
                    "name": "batchCreateHatsModule",
                    "outputs": [
                        { "internalType": "bool", "name": "success", "type": "bool" }
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "_implementation",
                            "type": "address"
                        },
                        { "internalType": "uint256", "name": "_hatId", "type": "uint256" },
                        {
                            "internalType": "bytes",
                            "name": "_otherImmutableArgs",
                            "type": "bytes"
                        },
                        { "internalType": "bytes", "name": "_initData", "type": "bytes" }
                    ],
                    "name": "createHatsModule",
                    "outputs": [
                        { "internalType": "address", "name": "_instance", "type": "address" }
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "_implementation",
                            "type": "address"
                        },
                        { "internalType": "uint256", "name": "_hatId", "type": "uint256" },
                        {
                            "internalType": "bytes",
                            "name": "_otherImmutableArgs",
                            "type": "bytes"
                        }
                    ],
                    "name": "deployed",
                    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "internalType": "address",
                            "name": "_implementation",
                            "type": "address"
                        },
                        { "internalType": "uint256", "name": "_hatId", "type": "uint256" },
                        {
                            "internalType": "bytes",
                            "name": "_otherImmutableArgs",
                            "type": "bytes"
                        }
                    ],
                    "name": "getHatsModuleAddress",
                    "outputs": [
                        { "internalType": "address", "name": "", "type": "address" }
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "version",
                    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
                    "stateMutability": "view",
                    "type": "function"
                }
            ],
        },
        eligibilitiesChain:
        {
            "name": "Hats Eligibilities Chain",
            "details": "Eligibility module that chains any amount of eligibility modules with 'and' & 'or' logical operations.",
            "links":
                [
                    {
                        "label": "GitHub",
                        "link": "https://github.com/Hats-Protocol/hats-module"
                    }
                ],
            "implementationAddress": "0x83200f1633cDb6C8f28F202CEA1B6a9105862D83",
            "deployments":
                [
                    {
                        "chainId": "5",
                        "block": "10009615"
                    },
                    {
                        "chainId": "10",
                        "block": "111939238"
                    }
                ],
            "abi":
                [
                    {
                        "inputs":
                            [
                                {
                                    "internalType": "string",
                                    "name": "_version",
                                    "type": "string"
                                }
                            ],
                        "stateMutability": "nonpayable",
                        "type": "constructor"
                    },
                    {
                        "anonymous": false,
                        "inputs":
                            [
                                {
                                    "indexed": false,
                                    "internalType": "uint8",
                                    "name": "version",
                                    "type": "uint8"
                                }
                            ],
                        "name": "Initialized",
                        "type": "event"
                    },
                    {
                        "inputs":
                            [],
                        "name": "CONJUNCTION_CLAUSE_LENGTHS",
                        "outputs":
                            [
                                {
                                    "internalType": "uint256[]",
                                    "name": "",
                                    "type": "uint256[]"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "HATS",
                        "outputs":
                            [
                                {
                                    "internalType": "contract IHats",
                                    "name": "",
                                    "type": "address"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "IMPLEMENTATION",
                        "outputs":
                            [
                                {
                                    "internalType": "address",
                                    "name": "",
                                    "type": "address"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "MODULES",
                        "outputs":
                            [
                                {
                                    "internalType": "address[]",
                                    "name": "",
                                    "type": "address[]"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "NUM_CONJUNCTION_CLAUSES",
                        "outputs":
                            [
                                {
                                    "internalType": "uint256",
                                    "name": "",
                                    "type": "uint256"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [
                                {
                                    "internalType": "address",
                                    "name": "_wearer",
                                    "type": "address"
                                },
                                {
                                    "internalType": "uint256",
                                    "name": "_hatId",
                                    "type": "uint256"
                                }
                            ],
                        "name": "getWearerStatus",
                        "outputs":
                            [
                                {
                                    "internalType": "bool",
                                    "name": "eligible",
                                    "type": "bool"
                                },
                                {
                                    "internalType": "bool",
                                    "name": "standing",
                                    "type": "bool"
                                }
                            ],
                        "stateMutability": "view",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "hatId",
                        "outputs":
                            [
                                {
                                    "internalType": "uint256",
                                    "name": "",
                                    "type": "uint256"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [
                                {
                                    "internalType": "bytes",
                                    "name": "_initData",
                                    "type": "bytes"
                                }
                            ],
                        "name": "setUp",
                        "outputs":
                            [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "version",
                        "outputs":
                            [
                                {
                                    "internalType": "string",
                                    "name": "",
                                    "type": "string"
                                }
                            ],
                        "stateMutability": "view",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "version_",
                        "outputs":
                            [
                                {
                                    "internalType": "string",
                                    "name": "",
                                    "type": "string"
                                }
                            ],
                        "stateMutability": "view",
                        "type": "function"
                    }
                ]
        },
        togglesChain:
        {
            "name": "Hats Toggles Chain",
            "details": "Toggle module that chains any amount of toggle modules with 'and' & 'or' logical operations.",
            "links":
                [
                    {
                        "label": "GitHub",
                        "link": "https://github.com/Hats-Protocol/hats-module"
                    }
                ],
            "implementationAddress": "0x2f1388e095BEc051dB9F1B226Faf222ef5c33f16",
            "deployments":
                [
                    {
                        "chainId": "5",
                        "block": "10009649"
                    }
                ],
            "abi":
                [
                    {
                        "inputs":
                            [
                                {
                                    "internalType": "string",
                                    "name": "_version",
                                    "type": "string"
                                }
                            ],
                        "stateMutability": "nonpayable",
                        "type": "constructor"
                    },
                    {
                        "anonymous": false,
                        "inputs":
                            [
                                {
                                    "indexed": false,
                                    "internalType": "uint8",
                                    "name": "version",
                                    "type": "uint8"
                                }
                            ],
                        "name": "Initialized",
                        "type": "event"
                    },
                    {
                        "inputs":
                            [],
                        "name": "CONJUNCTION_CLAUSE_LENGTHS",
                        "outputs":
                            [
                                {
                                    "internalType": "uint256[]",
                                    "name": "",
                                    "type": "uint256[]"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "HATS",
                        "outputs":
                            [
                                {
                                    "internalType": "contract IHats",
                                    "name": "",
                                    "type": "address"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "IMPLEMENTATION",
                        "outputs":
                            [
                                {
                                    "internalType": "address",
                                    "name": "",
                                    "type": "address"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "MODULES",
                        "outputs":
                            [
                                {
                                    "internalType": "address[]",
                                    "name": "",
                                    "type": "address[]"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "NUM_CONJUNCTION_CLAUSES",
                        "outputs":
                            [
                                {
                                    "internalType": "uint256",
                                    "name": "",
                                    "type": "uint256"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [
                                {
                                    "internalType": "uint256",
                                    "name": "_hatId",
                                    "type": "uint256"
                                }
                            ],
                        "name": "getHatStatus",
                        "outputs":
                            [
                                {
                                    "internalType": "bool",
                                    "name": "",
                                    "type": "bool"
                                }
                            ],
                        "stateMutability": "view",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "hatId",
                        "outputs":
                            [
                                {
                                    "internalType": "uint256",
                                    "name": "",
                                    "type": "uint256"
                                }
                            ],
                        "stateMutability": "pure",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [
                                {
                                    "internalType": "bytes",
                                    "name": "_initData",
                                    "type": "bytes"
                                }
                            ],
                        "name": "setUp",
                        "outputs":
                            [],
                        "stateMutability": "nonpayable",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "version",
                        "outputs":
                            [
                                {
                                    "internalType": "string",
                                    "name": "",
                                    "type": "string"
                                }
                            ],
                        "stateMutability": "view",
                        "type": "function"
                    },
                    {
                        "inputs":
                            [],
                        "name": "version_",
                        "outputs":
                            [
                                {
                                    "internalType": "string",
                                    "name": "",
                                    "type": "string"
                                }
                            ],
                        "stateMutability": "view",
                        "type": "function"
                    }
                ]
        },
        modules: [
            {
                "name": "Farcaster Delegator Contract",
                "details":
                    [
                        ""
                    ],
                "links":
                    [
                        {
                            "label": "GitHub",
                            "link": "https://github.com/Hats-Protocol/farcaster-delegator"
                        }
                    ],
                "parameters":
                    [

                    ],
                "type":
                {
                    "eligibility": true,
                    "toggle": false,
                    "hatter": false
                },
                "implementationAddress": "0xa947334c33dadca4bcbb396395ecfd66601bb38c",
                "deployments":
                    [
                        {
                            "chainId": "10",
                            "block": "115614516"
                        }
                    ],
                "creationArgs":
                {
                    "useHatId": true,
                    "immutable":
                        [
                            {
                                "name": "Owner Hat",
                                "description": "The hat ID for the owner hat. The wearer(s) of this hat are authorized to update the agreement.",
                                "type": "uint256",
                                "example": "26959946667150639794667015087019630673637144422540572481103610249216",
                                "displayType": "hat"
                            },
                            // {
                            //     "name": "Caster Hat",
                            //     "description": "The hat ID for the caster hat. The wearer(s) of this hat are authorized to publish casts from the Farcaster account.",
                            //     "type": "uint256",
                            //     "example": "26959946667150639794667015087019630673637144422540572481103610249216",
                            //     "displayType": "hat"
                            // }
                            {
                                "name": "ID Gateway Address",
                                "description": "The address of the ID Gateway contract.",
                                "type": "address",
                                "example": "0x",
                                "displayType": "address"
                            },
                            {
                                "name": "ID Registry Address",
                                "description": "The address of the ID Registry contract.",
                                "type": "address",
                                "example": "0x",
                                "displayType": "address"
                            },
                            {
                                "name": "Key Gateway Address",
                                "description": "The address of the Key Gateway contract.",
                                "type": "address",
                                "example": "0x",
                                "displayType": "address"
                            },
                            {
                                "name": "Key Registry Address",
                                "description": "The address of the Key Registry contract.",
                                "type": "address",
                                "example": "0x",
                                "displayType": "address"
                            },
                            {
                                "name": "Signed Key Request Validator Address",
                                "description": "The address of the Signed Key Request Validator contract.",
                                "type": "address",
                                "example": "0x",
                                "displayType": "address"
                            }
                        ],
                    "mutable":
                        [
                            {
                                "name": "_version",
                                "description": "The version of the module.",
                                "displayType": "string",
                                "type": "string",
                                "example": "0"
                            }
                        ]
                },
                "customRoles":
                    [
                        {
                            "id": "casterHat",
                            "name": "Caster Owner",
                            "criteria": "CASTER_HAT"
                        },
                    ],
                "writeFunctions":
                    [

                    ],
                "abi": [
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
                        "name": "InvalidSigner",
                        "inputs":
                            []
                    },
                    {
                        "type": "error",
                        "name": "InvalidTypedData",
                        "inputs":
                            []
                    },
                    {
                        "type": "error",
                        "name": "InvalidTypehash",
                        "inputs":
                            []
                    },
                    {
                        "type": "error",
                        "name": "Unauthorized",
                        "inputs":
                            []
                    }
                ]
            }
        ]
    }
};

export async function isValidSigner(
    contractAddress: `0x${string}`,
    typeHash: `0x${string}`,
    signer: `0x${string}`
): Promise<boolean> {
    const res = await readContract(config, {
        address: contractAddress,
        abi: HatsFarcasterDelegatorAbi,
        functionName: "isValidSigner",
        args: [typeHash, signer],
    });
    console.log("isValidSigner result", res);
    return res;
}

export async function isValidSignature(
    contractAddress: `0x${string}`,
    hash: `0x${string}`,
    sig: `0x${string}`
): Promise<boolean> {
    const res = await readContract(config, {
        address: contractAddress,
        abi: HatsFarcasterDelegatorAbi,
        functionName: "isValidSignature",
        args: [hash, sig],
    });
    console.log(
        "isValidSignature result",
        res,
        "isValid: ",
        res === "0x1626ba7e"
    );
    return res === "0x1626ba7e";
}

export const SIGNED_KEY_REQUEST_TYPEHASH = "0x16be47f1f1f50a66a48db64eba3fd35c21439c23622e513aab5b902018aec438";

