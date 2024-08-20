// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./node_modules/hashgraphcontracts/contracts/system-contracts/hedera-token-service/HederaTokenService.sol";
import "./node_modules/hashgraphcontracts/contracts/system-contracts/HederaResponseCodes.sol";

interface IZeroComController {
    function registerAgent(
        address agent,
        address owner,
        uint256 cap
    ) external;
    function setCap(uint256 cap) external;
    function freezeAgent(bool freeze) external;
    function deductCredits(address agent, uint256 amount) external;
}

contract ZeroComAgent is HederaTokenService {
    address public owner;
    address public controller;
    address public token;
    uint256 public spendingCap;
    bytes32 public ipnsAddress;

    uint256 public documentCounter;

    struct Metadata {
        string id;
        string name;
    }

    mapping(string => string) titleToId;
    mapping(string => string) idToTitle;
    mapping(string => Metadata) documents;
    string[] private documentIds;

    event SpendingCapSet(uint256 cap);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function.");
        _;
    }

    modifier onlyController() {
        require(
            msg.sender == owner || msg.sender == controller,
            "Unauthorized"
        );
        _;
    }

    constructor(address _controller) {
        owner = msg.sender;
        controller = _controller;
        IZeroComController(_controller).registerAgent(
            address(this),
            msg.sender,
            0
        );
    }

    function getOwner() external view returns (address) {
        return owner;
    }

    ///////////////////////////
    // Token Services Functions
    ///////////////////////////

    function _tokenAssociate(address tokenAddress) private {
        int response = HederaTokenService.associateToken(
            address(this),
            tokenAddress
        );
        if (response != HederaResponseCodes.SUCCESS) {
            revert("Associate Failed");
        }
    }

    function initializeAgent(address _token, bytes32 _ipnsAddress) external {
        token = _token;
        ipnsAddress = _ipnsAddress;
        _tokenAssociate(_token);
    }

    function transferToken(address receiver, int64 amount) external {
        int response = HederaTokenService.transferToken(
            token,
            address(this),
            receiver,
            amount
        );
    }

    ///////////////////
    // Vector DB Functions
    ////////////////////

    function addDocument(
        string memory title,
        string memory documentCID
    ) external {
        Metadata memory metadata = Metadata({id: documentCID, name: title});
        titleToId[title] = documentCID;
        idToTitle[documentCID] = title;

        documents[documentCID] = metadata;
        documentIds.push(documentCID);
        documentCounter++;
    }

    function documentIDToTitle(
        string memory documentId
    ) public view returns (string memory) {
        return idToTitle[documentId];
    }

    function titleToDocumentID(
        string memory title
    ) public view returns (string memory) {
        return titleToId[title];
    }

    function getCollectionPrincipal() public view returns (bytes32) {
        return ipnsAddress;
    }

    function getMetadataList() public view returns (Metadata[] memory) {
        Metadata[] memory metadataList = new Metadata[](documentIds.length);
        for (uint256 i = 0; i < documentIds.length; i++) {
            metadataList[i] = documents[documentIds[i]];
        }
        return metadataList;
    }

    function getMetadata(
        string memory documentId
    ) public view returns (Metadata memory) {
        return documents[documentId];
    }
}
