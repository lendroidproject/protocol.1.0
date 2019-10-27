const blockTimestamp = async web3 => {
  const blockNumber = await web3.eth.getBlockNumber();
  const block = await web3.eth.getBlock(blockNumber);
  return block.timestamp;
};

module.exports = blockTimestamp;
