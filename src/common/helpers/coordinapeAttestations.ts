import { makeGraphqlRequest } from './graphql';

export type GiveAttestation = {
  from: string;
  amount: number;
  platform: string;
  url: string;
  context: string;
  skill: string;
  tag: string;
  note: string;
  weight: number;
};

const getValue = (data, name: string) => data.find((d: any) => d.name === name)?.value?.value;
const parseRawDataIntoAttestation = (rawData: string): GiveAttestation => {
  const data = JSON.parse(rawData);
  return {
    from: getValue(data, 'from'),
    amount: getValue(data, 'amount'),
    platform: getValue(data, 'platform'),
    url: getValue(data, 'url'),
    context: getValue(data, 'context'),
    skill: getValue(data, 'skill'),
    tag: getValue(data, 'tag'),
    note: getValue(data, 'note'),
    weight: getValue(data, 'weight'),
  };
};

type RawAttestationData = {
  attestations: {
    id: string;
    attester: string;
    recipient: string;
    revoked: boolean;
    timeCreated: number;
    decodedDataJson: string;
  }[];
};


// Give Coordinape Attestation run via onchain.coordinape.eth -> it resolves to:
const ONCHAIN_COORDINAPE_ADDRESS = '0x7e823AE179592525301ceb33b3eC479f8c66ecB9';

const getAttestationsQuery = `
query GetAttestations($addresses: [String!]) {
   attestations(where: {
     attester: { equals: "${ONCHAIN_COORDINAPE_ADDRESS}" },
     recipient: { in: $addresses, mode: insensitive },
     revoked: { equals: false }
   }) {
     id
     attester
     recipient
     revoked
     timeCreated
     decodedDataJson
     }
   }
 `;


export async function getCoordinapeInfoForAddresses(addresses: string): Promise<GiveAttestation[]> {
  if (!addresses || !addresses.length) {
    return [];
  }

  const variables = {
    addresses: addresses.split(','),
  };

  try {
    const response = await makeGraphqlRequest<RawAttestationData>(
      'https://base.easscan.org/graphql',
      getAttestationsQuery,
      variables
    );
    if (response && response.attestations) {
      if (!response.attestations.length) {
        return [];
      }

      const attestations = response.attestations.map((attestation) => (
        parseRawDataIntoAttestation(attestation.decodedDataJson)
      ));
      return attestations;
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error fetching GIVE attestations:', error);
    return [];
  }
}
