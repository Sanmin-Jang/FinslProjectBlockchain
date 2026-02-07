// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameFiStore is Ownable {
  IERC20 public game;
  uint256 public activity; // increases after each buy

  event ItemBought(address indexed buyer, uint256 indexed itemId, uint256 price);

  constructor(address gameToken) Ownable(msg.sender) {
    game = IERC20(gameToken);
  }

  function getPrice(uint256 basePrice) public view returns (uint256) {
    uint256 activityMultiplier = activity * 5e18; // grows each purchase (in token-wei)
    return basePrice + activityMultiplier;
  }

  function buy(uint256 itemId, uint256 basePrice) external {
    uint256 price = getPrice(basePrice);

    require(game.transferFrom(msg.sender, owner(), price), "Payment failed");

    activity += 1;
    emit ItemBought(msg.sender, itemId, price);
  }
}
