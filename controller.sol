// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IERC20 {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);
}

interface IZeroComAgent {
    function getOwner() external view returns (address);
    function transferToken(address receiver, int64 amount) external;
}

contract ZeroComController {
    address public owner;

    IERC20 public token;

    event AgentActivated(address agent);
    event CreditsDeducted(address agent, uint256 amount);
    event AgentFrozen(address agent);
    event AgentUnfrozen(address agent);

    constructor(address exchangeToken) {
        owner = msg.sender;
        token = IERC20(address(exchangeToken));
    }

    enum OperationType {
        Low,
        Medium,
        High
    }

    struct IdempotencyData {
        address agent;
        OperationType predictedTokenUsage;
        bool processed;
    }

    // Hardcoded operation rates
    uint256 public constant LOW_RATE = 2;
    uint256 public constant MEDIUM_RATE = 5;
    uint256 public constant HIGH_RATE = 10;

    mapping(address => uint256) public spendingCaps;
    mapping(address => bool) public isAgentFrozen;
    mapping(OperationType => uint256) public operationRates;
    mapping(address => address) public agents;
    mapping(bytes32 => IdempotencyData) public idempotencyKeys;

    modifier onlyAgent() {
        require(
            !isAgentFrozen[msg.sender],
            "Agent is frozen and cannot operate."
        );
        _;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "Unauthourized");
        _;
    }

    // Function to set rates (only callable by the owner of the controller)
    function setOperationRate(
        OperationType operation,
        uint256 rate
    ) external onlyOwner {
        operationRates[operation] = rate;
    }

    // Function called by the agent to initialize itself and set spending cap
    function registerAgent(
        address _agent,
        address _owner,
        uint256 _cap
    ) external {
        require(!isAgentFrozen[_agent], "Agent already initialized.");
        spendingCaps[_agent] = _cap;
        agents[_owner] = _agent;
        emit AgentActivated(_agent);
    }

    // Function to set or update the spending cap (can only be called by the agent contract)
    function setSpendingCap(address agent, uint256 cap) external {
        require(
            IZeroComAgent(agent).getOwner() == msg.sender,
            "Unauthorized: Not the agent's owner"
        );
        spendingCaps[agent] = cap;
    }

    // // Function to freeze/unfreeze an agent (can only be called by the agent)
    function freezeAgent(bool freeze) external onlyAgent {
        isAgentFrozen[msg.sender] = freeze;
        if (freeze) {
            emit AgentFrozen(msg.sender);
        } else {
            emit AgentUnfrozen(msg.sender);
        }
    }

    // Function to generate and store the idempotency key
    function generateIdempotencyKey(
        address agent,
        bytes32 requestHash,
        OperationType predictedTokenUsage
    ) external onlyAgent returns (bytes32) {
        bytes32 idempotencyKey = keccak256(
            abi.encodePacked(agent, requestHash, block.timestamp)
        );
        require(
            !idempotencyKeys[idempotencyKey].processed,
            "Key already processed"
        );
        idempotencyKeys[idempotencyKey] = IdempotencyData({
            agent: agent,
            predictedTokenUsage: predictedTokenUsage,
            processed: false
        });
        return idempotencyKey;
    }

    function processIdempotencyKey(
        address agent,
        address revenueTeam,
        bytes32 idempotencyKey,
        uint256 actualTokenUsage,
        OperationType operation
    ) external onlyAgent {
        IdempotencyData storage data = idempotencyKeys[idempotencyKey];
        require(!data.processed, "Key already processed");

        uint256 rate;
        if (operation == OperationType.Low) {
            rate = LOW_RATE;
        } else if (operation == OperationType.Medium) {
            rate = MEDIUM_RATE;
        } else if (operation == OperationType.High) {
            rate = HIGH_RATE;
        }
        int64 fee = int64(actualTokenUsage * rate);
        IZeroComAgent(agent).transferToken(revenueTeam, fee);
        data.processed = true;
    }

    function getUserAgent(address user) public view returns (address) {
        return agents[user];
    }
}
