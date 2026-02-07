// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Campaign.sol";
import "./GAME.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CampaignFactory is Ownable {
  GAME public gameToken;
  address[] public campaigns;

  event CampaignCreated(address campaignAddress, string title, uint256 goal, uint256 deadline);

  constructor(address _gameToken) Ownable(msg.sender) {
    gameToken = GAME(_gameToken);
  }

  function createCampaign(
    string calldata title,
    uint256 goalWei,
    uint256 durationSeconds
  ) external returns (address) {
    Campaign c = new Campaign(title, goalWei, durationSeconds, address(gameToken), msg.sender);
    campaigns.push(address(c));

    // allow this campaign to mint GAME
    gameToken.setMinter(address(c), true);

    emit CampaignCreated(address(c), title, goalWei, block.timestamp + durationSeconds);
    return address(c);
  }

  function getCampaigns() external view returns (address[] memory) {
    return campaigns;
  }
}
