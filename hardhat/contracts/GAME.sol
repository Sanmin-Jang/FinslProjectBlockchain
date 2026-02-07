// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GAME is ERC20, Ownable {
  mapping(address => bool) public minters;

  constructor() ERC20("GAME Token", "GAME") Ownable(msg.sender) {}

  function setMinter(address minter, bool allowed) external onlyOwner {
    minters[minter] = allowed;
  }

  function mint(address to, uint256 amount) external {
    require(minters[msg.sender], "Not authorized to mint");
    _mint(to, amount);
  }
}
