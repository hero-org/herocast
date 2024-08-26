import { makeGraphqlRequest } from './graphql';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';

export type GiveAttestation = {
  id: string;
  attester: string;
  recipient: string;
  revoked: boolean;
  timeCreated: string;
  expirationTime: string;
  revocationTime: string;
  refUID: string;
  data: {
    givePlatform: string;
    giveProfileId: string;
    giveProfileUrl: string;
    giveUsername: string;
  };
};

// onchain.coordinape.eth -> resolves to:
const ONCHAIN_COORDINAPE_ADDRESS = '0x7e823AE179592525301ceb33b3eC479f8c66ecB9';

export async function getCoordinapeInfoForAddresses(addresses: string): Promise<GiveAttestation[]> {
  if (!addresses || !addresses.length) {
    return [];
  }

  console.log('addresses', addresses);
  // attester: { equals: "${ONCHAIN_COORDINAPE_ADDRESS}" },

  const query = `
    query GetAttestations($addresses: [String!]) {
      attestations(where: {
        recipient: { in: $addresses },
        revoked: { equals: false }
      }) {
        id
        attester
        recipient
        revoked
        timeCreated
        expirationTime
        revocationTime
        refUID
        data
        decodedDataJson
      }
    }
  `;

  const variables = {
    addresses: addresses.split(','),
  };

  console.log('query', query, 'variables', variables);
  try {
    const response = await makeGraphqlRequest<{ attestations: GiveAttestation[] }>(
      'https://base.easscan.org/graphql',
      query,
      variables
    );
    console.log('response', response);

    // const easContractAddress = "0x4200000000000000000000000000000000000021";
    // const schemaUID = "0x82c2ec8ec89cf1d13022ff0867744f1cecf932faa4fe334aa1bb443edbfee3fa";
    // const eas = new EAS(easContractAddress);
    const schemaEncoder = new SchemaEncoder(
      'address from,uint16 amount,string platform,string url,string context,string skill,string tag,string note,uint16 weight'
    );
    if (response && response.attestations) {
      const fa = response.attestations[0];
      console.log('fa', fa);
      if (!fa || !fa.data) {
        return [];
      }
      // try {
      //   const res = schemaEncoder.decodeData(fa.decodedDataJson as string);
      //   console.log('res', res);
      // } catch (error) {
      //   console.error('Error decoding data:', error);
      // }

      // try {
      //   const res2 = schemaEncoder.decodeData(fa.data as string);
      //   console.log('res2', res2);
      // } catch (error) {
      //   console.error('Error decoding data2:', error);
      // }

      try {
        console.log('fa.data', JSON.parse(fa.data));
        const parsedData = JSON.parse(fa.data as string).sig.message.data;
        console.log('parsedData', parsedData);
        const res3 = schemaEncoder.decodeData(parsedData);
        console.log('res3', res3);
      } catch (error) {
        console.error('Error decoding data3:', error);
      }

      const attestations = response.attestations.map((attestation) => ({
        ...attestation,
        data: schemaEncoder.decodeData(attestation.decodedDataJson as string),
        // data: JSON.parse(attestation.data as string)
      }));
      console.log(attestations);
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error fetching GIVE attestations:', error);
    return [];
  }
}
