const { SignProtocolClient, SpMode, EvmChains } = require("@ethsign/sp-sdk");
const { privateKeyToAccount } = require("viem/accounts");
const axios = require("axios");
const { ethers } = require("ethers");

async function init() {
  const privateKey = process.env.PRIVATE_KEY;
  const client = new SignProtocolClient(SpMode.OnChain, {
    chain: EvmChains.sepolia,
    account: privateKeyToAccount(privateKey),
  });
  console.log("Client initialized");
  return { client };
}

async function createSchema(client, provider) {
  const res = await client.createSchema({
    name: "BlockFeedBack",
    data: [
      { name: "userAddress", type: "address" },
    ],
  });
  console.log("Schema created with ID:", res.schemaId);
  return res.schemaId;
}

async function createNotaryAttestation(client, schemaId, userAddress, signer, provider) {
  const res = await client.createAttestation({
    schemaId: schemaId,
    data: {
      userAddress,
    },
    indexingValue: signer.toLowerCase(),
  });
  console.log("Attestation created");
  console.log(res);
  return res;
}

// Generate a function for making requests to the Sign Protocol Indexing Service
async function makeAttestationRequest(endpoint, options) {
  const url = `https://testnet-rpc.sign.global/api/${endpoint}`;
  const res = await axios.request({
    url,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    ...options,
  });

  if (res.status !== 200) {
    throw new Error(JSON.stringify(res));
  }
  return res.data;
}

async function queryAttestations(schemaId, attester) {
  const response = await makeAttestationRequest("index/attestations", {
    method: "GET",
    params: {
      mode: "onchain", // Data storage location
      schemaId, // クエリするスキーマID
      attester: attester // アテスターのアドレス
    },
  });

  if (!response.success) {
    return {
      success: false,
      message: response?.message ?? "Attestation query failed.",
    };
  }

  if (response.data?.total === 0) {
    return {
      success: false,
      message: "No attestation for this address found.",
    };
  }

  return {
    success: true,
    attestations: response.data.rows,
  };
}

async function main() {
  const { client, provider } = await init();

  // スキーマの作成
  const schemaId = await createSchema(client);

  // アテステーションの作成
  const attestation = await createNotaryAttestation(client, schemaId, "0x02188A89CdB88d045F51A9B1cAeE9451Ca06F319", "0x02188A89CdB88d045F51A9B1cAeE9451Ca06F319", provider);

  // アテステーションのクエリ
  const attestationResults = await queryAttestations(schemaId, "0x02188A89CdB88d045F51A9B1cAeE9451Ca06F319");
  console.log(attestationResults);
}

main();
